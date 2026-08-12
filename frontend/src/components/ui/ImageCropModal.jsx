import { useCallback, useState } from "react";
import Cropper from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import { motion } from "framer-motion";
import { X, ZoomIn, ZoomOut, Check } from "lucide-react";
import { useT } from "../../context/LocaleContext";
import { getCroppedImageFile } from "../../lib/cropImage";
import "./ImageCropModal.css";

/**
 * Shared image crop / zoom modal for avatars and server icons.
 *
 * @param {object} props
 * @param {string} props.imageSrc — data URL or blob URL
 * @param {number} [props.aspect=1]
 * @param {'round'|'rect'} [props.cropShape='round']
 * @param {string} [props.title]
 * @param {string} [props.confirmLabel]
 * @param {() => void} props.onCancel
 * @param {(file: File) => void | Promise<void>} props.onConfirm
 * @param {string} [props.outputMimeType='image/jpeg']
 * @param {string} [props.outputFileName='crop.jpg']
 * @param {number} [props.maxOutputSize=1024]
 */
export default function ImageCropModal({
  imageSrc,
  aspect = 1,
  cropShape = "round",
  title,
  confirmLabel,
  onCancel,
  onConfirm,
  outputMimeType = "image/jpeg",
  outputFileName = "crop.jpg",
  maxOutputSize = 1024,
}) {
  const t = useT();
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const onCropComplete = useCallback((_area, pixels) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleConfirm = async () => {
    if (!croppedAreaPixels || busy) return;
    setBusy(true);
    setError("");
    try {
      const file = await getCroppedImageFile(imageSrc, croppedAreaPixels, {
        mimeType: outputMimeType,
        quality: 0.92,
        fileName: outputFileName,
        maxSize: maxOutputSize,
      });
      await onConfirm(file);
    } catch (err) {
      setError(err?.message || t("Failed to crop image."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      className="img-crop-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onCancel}
    >
      <motion.div
        className="img-crop-modal"
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="img-crop-title"
      >
        <div className="img-crop-head">
          <h3 id="img-crop-title">{title || t("Adjust photo")}</h3>
          <button type="button" className="img-crop-icon-btn" onClick={onCancel} aria-label={t("Close")} disabled={busy}>
            <X size={18} />
          </button>
        </div>
        <p className="img-crop-lead">{t("Drag to reposition. Use the slider to zoom in or out.")}</p>

        <div className={`img-crop-stage${cropShape === "round" ? " is-round" : " is-rect"}`}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            cropShape={cropShape === "round" ? "round" : "rect"}
            showGrid={cropShape !== "round"}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            objectFit="contain"
          />
        </div>

        <div className="img-crop-zoom">
          <ZoomOut size={16} aria-hidden />
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            aria-label={t("Zoom")}
            disabled={busy}
          />
          <ZoomIn size={16} aria-hidden />
        </div>

        {error && <p className="img-crop-error">{error}</p>}

        <div className="img-crop-actions">
          <button type="button" className="img-crop-btn ghost" onClick={onCancel} disabled={busy}>
            {t("Cancel")}
          </button>
          <button type="button" className="img-crop-btn primary" onClick={handleConfirm} disabled={busy || !croppedAreaPixels}>
            <Check size={16} />
            {busy ? t("Please wait...") : confirmLabel || t("Apply")}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
