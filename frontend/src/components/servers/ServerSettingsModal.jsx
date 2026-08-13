import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Settings2, Camera, ImagePlus } from "lucide-react";
import { useT } from "../../context/LocaleContext";
import { useToast } from "../../context/ToastContext";
import { updateServer } from "../../api/servers";
import { uploadFile } from "../../api/media";
import { readFileAsDataUrl } from "../../lib/cropImage";
import { serverHasPermission } from "../../lib/serverPermissions";
import ImageCropModal from "../ui/ImageCropModal";

/**
 * Unified server settings: name, description, icon, banner.
 */
export default function ServerSettingsModal({ server, onClose, onServerUpdated }) {
  const t = useT();
  const { toast } = useToast();
  const [name, setName] = useState(server?.name || "");
  const [description, setDescription] = useState(server?.description || "");
  const [iconUrl, setIconUrl] = useState(server?.iconUrl || "");
  const [bannerUrl, setBannerUrl] = useState(server?.bannerUrl || "");
  const [busy, setBusy] = useState(false);
  const [cropSrc, setCropSrc] = useState("");
  const [cropKind, setCropKind] = useState(null); // 'icon' | 'banner'
  const iconRef = useRef(null);
  const bannerRef = useRef(null);

  useEffect(() => {
    setName(server?.name || "");
    setDescription(server?.description || "");
    setIconUrl(server?.iconUrl || "");
    setBannerUrl(server?.bannerUrl || "");
  }, [server?.id, server?.name, server?.description, server?.iconUrl, server?.bannerUrl]);

  const canManage = serverHasPermission(server, "MANAGE_GUILD");

  const pickImage = async (e, kind) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) {
      toast(t("Please choose a JPG, PNG, WebP, or GIF image."), "error");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast(t("Image must be 8 MB or smaller."), "error");
      return;
    }
    try {
      setCropKind(kind);
      setCropSrc(await readFileAsDataUrl(file));
    } catch {
      toast(t("Could not read that image."), "error");
    }
  };

  const onCropConfirm = async (file) => {
    if (!file || !cropKind) {
      setCropSrc("");
      setCropKind(null);
      return;
    }
    setBusy(true);
    try {
      const uploaded = await uploadFile(file);
      const url = uploaded?.url || uploaded?.mediaUrl || null;
      if (!url) throw new Error(t("Upload failed"));
      if (cropKind === "icon") setIconUrl(url);
      else setBannerUrl(url);
      setCropSrc("");
      setCropKind(null);
    } catch (err) {
      toast(err?.message || t("Upload failed."), "error");
    } finally {
      setBusy(false);
    }
  };

  const save = async (e) => {
    e?.preventDefault?.();
    if (!server?.id || !canManage) return;
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      toast(t("Server name must be at least 2 characters."), "error");
      return;
    }
    setBusy(true);
    try {
      const data = await updateServer(server.id, {
        name: trimmed,
        description: description.trim() || null,
        iconUrl: iconUrl || null,
        bannerUrl: bannerUrl || null,
      });
      onServerUpdated?.(
        data?.server || {
          ...server,
          name: trimmed,
          description: description.trim() || null,
          iconUrl: iconUrl || null,
          bannerUrl: bannerUrl || null,
        }
      );
      toast(t("Saved"), "success");
      onClose?.();
    } catch (err) {
      toast(err?.message || t("Something went wrong."), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <motion.div
        className="server-modal-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.form
          className="server-modal server-settings-modal"
          initial={{ scale: 0.94, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.94, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          onSubmit={save}
        >
          <h3>
            <Settings2 size={18} />
            {t("Server Settings")}
          </h3>
          <p className="server-modal-lead">
            {t("Update your server name, description, icon, and banner.")}
          </p>

          {bannerUrl ? (
            <div
              className="server-settings-banner"
              style={{
                backgroundImage: `url(${bannerUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                height: 96,
                borderRadius: 10,
                marginBottom: 12,
              }}
            />
          ) : null}

          <div className="server-settings-media-row" style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
            {iconUrl ? (
              <img
                src={iconUrl}
                alt=""
                width={40}
                height={40}
                style={{ borderRadius: 10, objectFit: "cover" }}
              />
            ) : null}
            <button
              type="button"
              className="btn-ghost"
              disabled={!canManage || busy}
              onClick={() => iconRef.current?.click()}
            >
              <Camera size={14} />
              {t("Icon")}
            </button>
            <button
              type="button"
              className="btn-ghost"
              disabled={!canManage || busy}
              onClick={() => bannerRef.current?.click()}
            >
              <ImagePlus size={14} />
              {t("Banner")}
            </button>
            {bannerUrl ? (
              <button
                type="button"
                className="btn-ghost"
                disabled={!canManage || busy}
                onClick={() => setBannerUrl("")}
              >
                {t("Remove banner")}
              </button>
            ) : null}
          </div>

          <input
            ref={iconRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            hidden
            onChange={(e) => pickImage(e, "icon")}
          />
          <input
            ref={bannerRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            hidden
            onChange={(e) => pickImage(e, "banner")}
          />

          <label className="server-field">
            <span>{t("Server name")}</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              disabled={!canManage || busy}
              required
            />
          </label>

          <label className="server-field">
            <span>{t("Description")}</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={3}
              disabled={!canManage || busy}
              placeholder={t("What is this server about?")}
            />
          </label>

          <div className="server-modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>
              {t("Cancel")}
            </button>
            <button type="submit" className="btn-primary" disabled={!canManage || busy}>
              {busy ? t("Saving…") : t("Save")}
            </button>
          </div>
        </motion.form>
      </motion.div>

      <AnimatePresence>
        {cropSrc ? (
          <ImageCropModal
            key={`server-settings-${cropKind}-crop`}
            imageSrc={cropSrc}
            aspect={cropKind === "banner" ? 16 / 9 : 1}
            cropShape="rect"
            title={cropKind === "banner" ? t("Adjust banner") : t("Adjust server icon")}
            confirmLabel={busy ? t("Please wait...") : t("Use photo")}
            outputMimeType="image/jpeg"
            outputFileName={cropKind === "banner" ? "server-banner.jpg" : "server-icon.jpg"}
            maxOutputSize={cropKind === "banner" ? 1280 : 512}
            onCancel={() => {
              if (!busy) {
                setCropSrc("");
                setCropKind(null);
              }
            }}
            onConfirm={onCropConfirm}
          />
        ) : null}
      </AnimatePresence>
    </>
  );
}
