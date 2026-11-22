import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';

export const UPLOAD_DIR = path.join(path.dirname(new URL(import.meta.url).pathname), '../../uploads');
const ALLOWED = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.txt', '.doc', '.docx']);
const MAX_BYTES = 5 * 1024 * 1024;

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    cb(null, UPLOAD_DIR);
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase();
    cb(null, `${crypto.randomBytes(16).toString('hex')}${ALLOWED.has(ext) ? ext : ''}`);
  }
});

function fileFilter(_req, file, cb) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (!ALLOWED.has(ext)) {
    const err = new Error('This file type is not allowed. Use pdf, png, jpg, txt, doc, or docx.');
    err.code = 'BAD_FILE';
    err.status = 400;
    return cb(err);
  }
  cb(null, true);
}

const upload = multer({ storage, fileFilter, limits: { fileSize: MAX_BYTES } });

// JSON submissions stay as they are. A file is accepted only as multipart field "file".
export function acceptSubmissionFile(req, res, next) {
  const type = req.headers['content-type'] || '';
  if (!type.includes('multipart/form-data')) return next();
  upload.single('file')(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ message: 'File must be 5 MB or smaller.' });
    if (err.code === 'BAD_FILE' || err.status === 400) return res.status(400).json({ message: err.message });
    next(err);
  });
}

export function safeOriginalName(file) {
  const base = path.basename(file?.originalname || 'file').replace(/[^\w.\- ()]+/g, '_').slice(0, 180);
  return base || 'file';
}

export async function removeStored(name) {
  if (!name) return;
  const full = path.join(UPLOAD_DIR, path.basename(name));
  await fs.promises.unlink(full).catch(() => {});
}
