import { useEffect, useMemo, useRef, useState } from "react";
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
  const [afkChannelId, setAfkChannelId] = useState(server?.afkChannelId || "");
  const [afkTimeoutSeconds, setAfkTimeoutSeconds] = useState(server?.afkTimeoutSeconds ?? 300);
  const [systemChannelId, setSystemChannelId] = useState(server?.systemChannelId || "");
  const [welcomeChannelId, setWelcomeChannelId] = useState(server?.welcomeChannelId || "");
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
    setAfkChannelId(server?.afkChannelId || "");
    setAfkTimeoutSeconds(server?.afkTimeoutSeconds ?? 300);
    setSystemChannelId(server?.systemChannelId || "");
    setWelcomeChannelId(server?.welcomeChannelId || "");
  }, [
    server?.id,
    server?.name,
    server?.description,
    server?.iconUrl,
    server?.bannerUrl,
    server?.afkChannelId,
    server?.afkTimeoutSeconds,
    server?.systemChannelId,
    server?.welcomeChannelId,
  ]);

  const voiceChannels = useMemo(
    () => (server?.channels || []).filter((c) => c.type === "voice"),
    [server?.channels]
  );
  const textChannels = useMemo(
    () => (server?.channels || []).filter((c) => c.type === "text" || c.type === "announcement"),
    [server?.channels]
  );

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
    // Must stay synchronous — deferred clicks break the file dialog on iOS.
    ref.current?.click();
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
        afkChannelId: afkChannelId || null,
        afkTimeoutSeconds: Number(afkTimeoutSeconds) || 300,
        systemChannelId: systemChannelId || null,
        welcomeChannelId: welcomeChannelId || null,
      });
      onServerUpdated?.(
        data?.server || {
          ...server,
          name: trimmed,
          description: description.trim() || null,
          iconUrl: iconUrl || null,
          bannerUrl: bannerUrl || null,
          afkChannelId: afkChannelId || null,
          afkTimeoutSeconds: Number(afkTimeoutSeconds) || 300,
          systemChannelId: systemChannelId || null,
          welcomeChannelId: welcomeChannelId || null,
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
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
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

          <div className="server-settings-body">
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

          {canManage && (
            <div className="server-settings-channels">
              <h4>{t("System channels")}</h4>
              <label className="server-field">
                <span>{t("AFK voice channel")}</span>
                <select
                  value={afkChannelId}
                  disabled={busy}
                  onChange={(e) => setAfkChannelId(e.target.value)}
                >
                  <option value="">{t("None")}</option>
                  {voiceChannels.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      {ch.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="server-field">
                <span>{t("AFK timeout (seconds)")}</span>
                <input
                  type="number"
                  min={60}
                  max={3600}
                  value={afkTimeoutSeconds}
                  disabled={busy || !afkChannelId}
                  onChange={(e) => setAfkTimeoutSeconds(Number(e.target.value) || 300)}
                />
              </label>
              <label className="server-field">
                <span>{t("System channel")}</span>
                <select
                  value={systemChannelId}
                  disabled={busy}
                  onChange={(e) => setSystemChannelId(e.target.value)}
                >
                  <option value="">{t("None")}</option>
                  {textChannels.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      #{ch.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="server-field">
                <span>{t("Welcome channel")}</span>
                <select
                  value={welcomeChannelId}
                  disabled={busy}
                  onChange={(e) => setWelcomeChannelId(e.target.value)}
                >
                  <option value="">{t("None")}</option>
                  {textChannels.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      #{ch.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          </div>

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
