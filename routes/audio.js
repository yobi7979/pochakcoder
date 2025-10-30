const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const router = express.Router();

// Ensure upload directory exists
const AUDIO_DIR = path.join(process.cwd(), 'uploads', 'audio');
fs.mkdirSync(AUDIO_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, AUDIO_DIR);
  },
  filename: function (req, file, cb) {
    const ts = Date.now();
    const safe = (file.originalname || 'audio').replace(/[^a-zA-Z0-9_.-]/g, '_');
    cb(null, `${ts}_${safe}`);
  }
});

const upload = multer({ storage });

// POST /api/audio/upload → { url }
router.post('/upload', upload.single('audio'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    const url = `/uploads/audio/${req.file.filename}`;
    return res.json({ success: true, url });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;


