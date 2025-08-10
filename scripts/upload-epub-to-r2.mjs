#!/usr/bin/env node
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';

function arg(name, def) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return def;
}

const file = arg('file');
const key = arg('key');
if (!file || !key) {
  console.error('Usage: upload-epub-to-r2.mjs --file <path/to/file.epub> --key <r2/key.epub>');
  process.exit(2);
}
if (!fs.existsSync(file)) {
  console.error(`File not found: ${file}`);
  process.exit(2);
}

const {
  CLOUDFLARE_ACCOUNT_ID,
  R2_UPLOAD_IMAGE_ACCESS_KEY_ID,
  R2_UPLOAD_IMAGE_SECRET_ACCESS_KEY,
  R2_UPLOAD_IMAGE_BUCKET_NAME,
  NEXT_PUBLIC_IMAGE_BASE_URL,
} = process.env;

if (!CLOUDFLARE_ACCOUNT_ID || !R2_UPLOAD_IMAGE_ACCESS_KEY_ID || !R2_UPLOAD_IMAGE_SECRET_ACCESS_KEY || !R2_UPLOAD_IMAGE_BUCKET_NAME) {
  console.error('Missing R2 env vars. Required: CLOUDFLARE_ACCOUNT_ID, R2_UPLOAD_IMAGE_ACCESS_KEY_ID, R2_UPLOAD_IMAGE_SECRET_ACCESS_KEY, R2_UPLOAD_IMAGE_BUCKET_NAME');
  process.exit(2);
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_UPLOAD_IMAGE_ACCESS_KEY_ID,
    secretAccessKey: R2_UPLOAD_IMAGE_SECRET_ACCESS_KEY,
  },
});

try {
  const buf = fs.readFileSync(file);
  await s3.send(new PutObjectCommand({
    Bucket: R2_UPLOAD_IMAGE_BUCKET_NAME,
    Key: key,
    Body: buf,
    ContentType: 'application/epub+zip',
    ACL: 'public-read',
  }));

  const base = (NEXT_PUBLIC_IMAGE_BASE_URL && NEXT_PUBLIC_IMAGE_BASE_URL.replace(/\/$/, '')) ||
               `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_UPLOAD_IMAGE_BUCKET_NAME}`;
  const url = `${base}/${key}`;
  // Print the URL so GitHub Actions can capture it
  console.log(url);
} catch (err) {
  console.error('Upload failed:', err?.message || err);
  process.exit(1);
}
