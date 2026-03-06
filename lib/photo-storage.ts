import crypto from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { HttpError } from "@/lib/errors";

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const allowedMimeToExtension: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

function uploadsDirectory() {
  if (process.env.PHOTO_UPLOAD_DIR?.trim()) {
    return process.env.PHOTO_UPLOAD_DIR.trim();
  }

  return path.join(process.cwd(), "public", "uploads", "jobs");
}

function extensionForMimeType(mimeType: string) {
  const extension = allowedMimeToExtension[mimeType.toLowerCase()];
  if (!extension) {
    throw new HttpError(400, "UNSUPPORTED_IMAGE_TYPE", "Unsupported image format");
  }

  return extension;
}

export async function saveJobPhotoUpload(params: {
  jobId: string;
  file: File;
}) {
  const file = params.file;

  if (!file || typeof file.arrayBuffer !== "function") {
    throw new HttpError(400, "PHOTO_FILE_REQUIRED", "Photo file is required");
  }

  if (!file.type) {
    throw new HttpError(400, "PHOTO_TYPE_REQUIRED", "Photo MIME type is required");
  }

  if (file.size <= 0) {
    throw new HttpError(400, "EMPTY_PHOTO", "Photo file is empty");
  }

  if (file.size > MAX_PHOTO_BYTES) {
    throw new HttpError(400, "PHOTO_TOO_LARGE", "Photo must be 8MB or smaller");
  }

  const extension = extensionForMimeType(file.type);
  const buffer = Buffer.from(await file.arrayBuffer());
  const fileName = `${params.jobId}-${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const targetDirectory = uploadsDirectory();
  const absolutePath = path.join(targetDirectory, fileName);

  await fs.mkdir(targetDirectory, { recursive: true });
  await fs.writeFile(absolutePath, buffer);

  return {
    url: `/uploads/jobs/${fileName}`,
    bytes: buffer.byteLength,
    mimeType: file.type,
  };
}
