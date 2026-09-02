import crypto from "crypto";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
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

const globalForPhotoStorage = globalThis as typeof globalThis & {
  jobPhotoS3Client?: S3Client;
};

type PhotoStorageDriver = "filesystem" | "s3";

type S3Config = {
  bucket: string;
  region: string;
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
};

function uploadsDirectory() {
  if (process.env.PHOTO_UPLOAD_DIR?.trim()) {
    return process.env.PHOTO_UPLOAD_DIR.trim();
  }

  return path.join(process.cwd(), "public", "uploads", "jobs");
}

function photoStorageDriver(): PhotoStorageDriver {
  return process.env.PHOTO_STORAGE_DRIVER?.trim().toLowerCase() === "s3" ? "s3" : "filesystem";
}

function envValue(...names: string[]) {
  for (const name of names) {
    const current = process.env[name]?.trim();
    if (current) {
      return current;
    }
  }

  return "";
}

function booleanEnv(name: string) {
  return /^(1|true|yes)$/i.test(process.env[name]?.trim() ?? "");
}

function requireS3Config(): S3Config {
  const config = {
    bucket: envValue("S3_BUCKET", "BUCKET"),
    region: envValue("S3_REGION", "REGION") || "auto",
    endpoint: envValue("S3_ENDPOINT", "ENDPOINT") || undefined,
    accessKeyId: envValue("S3_ACCESS_KEY_ID", "ACCESS_KEY_ID"),
    secretAccessKey: envValue("S3_SECRET_ACCESS_KEY", "SECRET_ACCESS_KEY"),
    forcePathStyle: booleanEnv("S3_FORCE_PATH_STYLE"),
  };

  const missing = [
    ["S3_BUCKET", config.bucket],
    ["S3_ACCESS_KEY_ID", config.accessKeyId],
    ["S3_SECRET_ACCESS_KEY", config.secretAccessKey],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new HttpError(
      500,
      "PHOTO_STORAGE_NOT_CONFIGURED",
      `S3 photo storage is missing required value(s): ${missing.join(", ")}`,
    );
  }

  return config;
}

function getS3Client() {
  if (!globalForPhotoStorage.jobPhotoS3Client) {
    const config = requireS3Config();

    globalForPhotoStorage.jobPhotoS3Client = new S3Client({
      region: config.region,
      ...(config.endpoint ? { endpoint: config.endpoint } : {}),
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  return globalForPhotoStorage.jobPhotoS3Client;
}

function extensionForMimeType(mimeType: string) {
  const extension = allowedMimeToExtension[mimeType.toLowerCase()];
  if (!extension) {
    throw new HttpError(400, "UNSUPPORTED_IMAGE_TYPE", "Unsupported image format");
  }

  return extension;
}

function photoObjectKey(jobId: string, fileName: string) {
  return `jobs/${jobId}/${fileName}`;
}

function photoObjectRoute(jobId: string, key: string) {
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  return `/api/jobs/${encodeURIComponent(jobId)}/photos/file/${encodedKey}`;
}

async function saveFileSystemPhoto(params: {
  jobId: string;
  fileName: string;
  buffer: Buffer;
}) {
  const targetDirectory = uploadsDirectory();
  const absolutePath = path.join(/*turbopackIgnore: true*/ targetDirectory, params.fileName);

  await fs.mkdir(targetDirectory, { recursive: true });
  await fs.writeFile(absolutePath, params.buffer);

  return {
    url: `/uploads/jobs/${params.fileName}`,
    storage: "filesystem" as const,
  };
}

async function saveS3Photo(params: {
  jobId: string;
  fileName: string;
  buffer: Buffer;
  mimeType: string;
}) {
  const config = requireS3Config();
  const key = photoObjectKey(params.jobId, params.fileName);

  await getS3Client().send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: params.buffer,
      ContentType: params.mimeType,
      CacheControl: "private, max-age=31536000, immutable",
    }),
  );

  return {
    url: photoObjectRoute(params.jobId, key),
    storage: "s3" as const,
    key,
  };
}

function assertValidPhotoObjectKey(jobId: string, key: string) {
  const normalized = key.replace(/\\/g, "/");
  const expectedPrefix = `jobs/${jobId}/`;

  if (
    normalized !== key ||
    normalized.includes("..") ||
    !normalized.startsWith(expectedPrefix) ||
    normalized.length <= expectedPrefix.length
  ) {
    throw new HttpError(400, "INVALID_PHOTO_KEY", "Invalid photo object key");
  }
}

async function s3BodyToBuffer(body: unknown) {
  const withTransform = body as {
    transformToByteArray?: () => Promise<Uint8Array>;
  };

  if (typeof withTransform.transformToByteArray === "function") {
    return Buffer.from(await withTransform.transformToByteArray());
  }

  const iterable = body as AsyncIterable<Buffer | Uint8Array | string>;
  if (iterable && typeof iterable[Symbol.asyncIterator] === "function") {
    const chunks: Buffer[] = [];
    for await (const chunk of iterable) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
  }

  throw new HttpError(500, "PHOTO_STORAGE_READ_FAILED", "Photo object response was not readable");
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
  const saved =
    photoStorageDriver() === "s3"
      ? await saveS3Photo({
          jobId: params.jobId,
          fileName,
          buffer,
          mimeType: file.type,
        })
      : await saveFileSystemPhoto({
          jobId: params.jobId,
          fileName,
          buffer,
        });

  return {
    ...saved,
    bytes: buffer.byteLength,
    mimeType: file.type,
  };
}

export async function readJobPhotoObject(params: {
  jobId: string;
  key: string;
}) {
  if (photoStorageDriver() !== "s3") {
    throw new HttpError(404, "PHOTO_OBJECT_NOT_FOUND", "Photo object storage is not enabled");
  }

  assertValidPhotoObjectKey(params.jobId, params.key);

  const config = requireS3Config();
  const result = await getS3Client().send(
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: params.key,
    }),
  );

  if (!result.Body) {
    throw new HttpError(404, "PHOTO_OBJECT_NOT_FOUND", "Photo object was empty");
  }

  return {
    body: await s3BodyToBuffer(result.Body),
    contentType: result.ContentType || "application/octet-stream",
  };
}
