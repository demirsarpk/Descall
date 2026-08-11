"use strict";

const express = require("express");
const multer = require("multer");
const { requireAuth } = require("../middleware/auth");
const supabase = require("../db/supabase");
const { cacheUserProfile, broadcastUserProfileUpdate, toPublicUser } = require("../lib/userProfile");

const router = express.Router();

const ALLOWED_IMAGE = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ALLOWED_VIDEO = ["video/mp4", "video/webm"];
const ALLOWED_AUDIO = [
  "audio/webm",
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "audio/mp4",
  "audio/aac",
  "audio/x-m4a",
  "audio/m4a",
];
const ALLOWED_DOCUMENT = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "application/zip",
  "application/x-zip-compressed",
  "application/x-rar-compressed",
  "application/json",
];
const ALLOWED_ALL = [...ALLOWED_IMAGE, ...ALLOWED_VIDEO, ...ALLOWED_AUDIO, ...ALLOWED_DOCUMENT];
const MAX_FILE_SIZE = 100 * 1024 * 1024;

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_ALL.includes(file.mimetype)) return cb(null, true);
    cb(new Error(`File type ${file.mimetype} is not allowed.`));
  },
});

router.use(requireAuth);

// Upload file to Supabase Storage
async function uploadToSupabase(file, folder = "files") {
  const ext = file.originalname.split('.').pop();
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;
  const filePath = `${folder}/${filename}`;

  const { data, error } = await supabase.storage
    .from("media")
    .upload(filePath, file.buffer, {
      contentType: file.mimetype,
      upsert: true,
    });

  if (error) throw error;

  const { data: { publicUrl } } = supabase.storage
    .from("media")
    .getPublicUrl(filePath);

  return { url: publicUrl, path: filePath };
}

router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded." });

    const file = req.file;
    let mediaType = "file";
    if (ALLOWED_IMAGE.includes(file.mimetype)) mediaType = "image";
    else if (ALLOWED_VIDEO.includes(file.mimetype)) mediaType = "video";
    else if (ALLOWED_AUDIO.includes(file.mimetype)) mediaType = "audio";
    else if (ALLOWED_DOCUMENT.includes(file.mimetype)) mediaType = "document";

    const folder = mediaType === "image" ? "images" : "files";
    const { url, path: storagePath } = await uploadToSupabase(file, folder);

    await supabase.from("media_uploads").insert({
      uploader_id: req.user.id,
      storage_path: storagePath,
      public_url: url,
      media_type: mediaType,
      mime_type: file.mimetype,
      file_size: file.size,
      original_name: file.originalname,
    });

    res.json({
      url,
      mediaType,
      mimeType: file.mimetype,
      size: file.size,
      originalName: file.originalname,
    });
  } catch (err) {
    console.error("[MEDIA] Upload error:", err);
    res.status(500).json({ error: "Upload failed." });
  }
});

const MAX_AVATAR_SIZE = 8 * 1024 * 1024;

router.post("/avatar", upload.single("avatar"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No avatar uploaded." });
    if (!ALLOWED_IMAGE.includes(req.file.mimetype)) {
      return res.status(400).json({ error: "Avatar must be JPG, PNG, WebP, or GIF." });
    }
    if (req.file.size > MAX_AVATAR_SIZE) {
      return res.status(400).json({ error: "Avatar must be 8 MB or smaller." });
    }

    const userId = req.user.id;
    const { url } = await uploadToSupabase(req.file, "avatars");

    const { error } = await supabase
      .from("users")
      .update({ avatar_url: url, updated_at: new Date().toISOString() })
      .eq("id", userId);

    if (error) {
      return res.status(500).json({ error: "Failed to update avatar." });
    }

    const profile = cacheUserProfile({
      id: userId,
      username: req.user.username,
      avatar_url: url,
      updated_at: new Date().toISOString(),
    });

    const io = req.app.get("io");
    if (io) await broadcastUserProfileUpdate(io, userId);

    res.json({ avatarUrl: url, user: toPublicUser(profile) });
  } catch (err) {
    console.error("[MEDIA] Avatar upload error:", err);
    res.status(500).json({ error: "Avatar upload failed." });
  }
});

router.post("/banner", upload.single("banner"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No banner uploaded." });
    if (!ALLOWED_IMAGE.includes(req.file.mimetype)) {
      return res.status(400).json({ error: "Banner must be an image." });
    }

    const userId = req.user.id;
    const { url } = await uploadToSupabase(req.file, "banners");

    const { error } = await supabase
      .from("users")
      .update({ banner_url: url })
      .eq("id", userId);

    if (error) {
      return res.status(500).json({ error: "Failed to update banner." });
    }

    res.json({ bannerUrl: url });
  } catch (err) {
    console.error("[MEDIA] Banner upload error:", err);
    res.status(500).json({ error: "Banner upload failed." });
  }
});

module.exports = router;
