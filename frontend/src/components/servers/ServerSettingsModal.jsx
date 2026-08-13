import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Settings2, Camera, ImagePlus, Trash2, X } from "lucide-react";
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
  const [uploading, setUploading] = useState(false);
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
  const initials = String(name || server?.name || "?")
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const openPicker = (kind) => {
    if (!canManage || busy || uploading) return;
    const ref = kind === "icon" ? iconRef : bannerRef;
    // Keep the user gesture → file dialog chain intact on mobile.
    window.setTimeout(() => ref.current?.click(), 0);
  };

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
    setUploading(true);
    try {
      const uploaded = await uploadFile(file);
      const url = uploaded?.url || uploaded?.mediaUrl || null;
      if (!url) throw new Error(t("Upload failed"));
      if (cropKind === "icon") setIconUrl(url);
      else setBannerUrl(url);
      setCropSrc("");
      setCropKind(null);
      toast(
        cropKind === "icon" ? t("Icon ready — tap Save to apply.") : t("Banner ready — tap Save to apply."),
        "success"
      );
    } catch (err) {
      toast(err?.message || t("Upload failed."), "error");
    } finally {
      setUploading(false);
    }
  };

  const save = async (e) => {
    e?.preventDefault?.();
    if (!server?.id || !canManage || busy || uploading) return;
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
        onClick={() => !busy && !uploading && !cropSrc && onClose?.()}
      >
        <motion.form
          className="server-modal server-settings-modal"
          initial={{ scale: 0.94, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.96, opacity: 0, y: 8 }}
          transition={{ type: "spring", stiffness: 420, damping: 32 }}
          onClick={(e) => e.stopPropagation()}
          onSubmit={save}
        >
          <header className="server-settings-head">
            <div className="server-settings-head-copy">
              <h3>
                <Settings2 size={18} />
                {t("Server Settings")}
              </h3>
              <p className="server-modal-lead">
                {t("Update your server name, description, icon, and banner.")}
              </p>
            </div>
            <button
              type="button"
              className="server-icon-btn"
              onClick={onClose}
              disabled={busy || uploading}
              aria-label={t("Close")}
            >
              <X size={16} />
            </button>
          </header>

          <div className="server-settings-identity">
            <button
              type="button"
              className={`server-settings-banner-btn${bannerUrl ? " has-image" : ""}`}
              disabled={!canManage || busy || uploading}
              onClick={() => openPicker("banner")}
              aria-label={t("Banner")}
            >
              {bannerUrl ? (
                <img src={bannerUrl} alt="" className="server-settings-banner-img" />
              ) : (
                <div className="server-settings-banner-empty">
                  <ImagePlus size={22} />
                  <span>{t("Upload banner")}</span>
                </div>
              )}
              <span className="server-settings-media-chip">
                <ImagePlus size={12} />
                {t("Banner")}
              </span>
            </button>

            <button
              type="button"
              className={`server-settings-icon-btn${iconUrl ? " has-image" : ""}`}
              disabled={!canManage || busy || uploading}
              onClick={() => openPicker("icon")}
              aria-label={t("Icon")}
            >
              {iconUrl ? (
                <img src={iconUrl} alt="" />
              ) : (
                <span className="server-settings-icon-fallback">{initials}</span>
              )}
              <span className="server-settings-icon-camera" aria-hidden>
                <Camera size={14} />
              </span>
            </button>
          </div>

          <div className="server-settings-media-actions">
            <button
              type="button"
              className="server-ghost-btn"
              disabled={!canManage || busy || uploading}
              onClick={() => openPicker("icon")}
            >
              <Camera size={15} />
              {t("Change icon")}
            </button>
            <button
              type="button"
              className="server-ghost-btn"
              disabled={!canManage || busy || uploading}
              onClick={() => openPicker("banner")}
            >
              <ImagePlus size={15} />
              {bannerUrl ? t("Change banner") : t("Add banner")}
            </button>
            {bannerUrl ? (
              <button
                type="button"
                className="server-ghost-btn is-danger-ghost"
                disabled={!canManage || busy || uploading}
                onClick={() => setBannerUrl("")}
              >
                <Trash2 size={15} />
                {t("Remove banner")}
              </button>
            ) : null}
          </div>

          <input
            ref={iconRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="server-hidden-file"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => pickImage(e, "icon")}
          />
          <input
            ref={bannerRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="server-hidden-file"
            tabIndex={-1}
            aria-hidden="true"
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

          <div className="server-settings-footer">
            <button
              type="button"
              className="server-ghost-btn server-settings-cancel"
              onClick={onClose}
              disabled={busy || uploading}
            >
              {t("Cancel")}
            </button>
            <button
              type="submit"
              className="server-primary-btn server-settings-save"
              disabled={!canManage || busy || uploading}
            >
              {busy || uploading ? t("Saving…") : t("Save Changes")}
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
            confirmLabel={uploading ? t("Please wait...") : t("Use photo")}
            outputMimeType="image/jpeg"
            outputFileName={cropKind === "banner" ? "server-banner.jpg" : "server-icon.jpg"}
            maxOutputSize={cropKind === "banner" ? 1280 : 512}
            onCancel={() => {
              if (!uploading) {
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
