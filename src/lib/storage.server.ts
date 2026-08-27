// Replaces Supabase Storage. Works with any S3-compatible bucket (Cloudflare
// R2, AWS S3, MinIO, Render Disk via a sidecar, etc.) — configure via env vars.
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function getClient(): S3Client {
  const g = globalThis as unknown as { __s3Client?: S3Client };
  if (!g.__s3Client) {
    const endpoint = process.env.S3_ENDPOINT;
    const region = process.env.S3_REGION || "auto";
    const accessKeyId = process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
    if (!endpoint || !accessKeyId || !secretAccessKey) {
      throw new Error(
        "Missing S3_ENDPOINT / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY. Object storage is not configured.",
      );
    }
    g.__s3Client = new S3Client({
      region,
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
    });
  }
  return g.__s3Client;
}

function bucketName(): string {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error("Missing S3_BUCKET environment variable.");
  return bucket;
}

/**
 * Upload a file. `logicalBucket` mirrors the old Supabase bucket name
 * (e.g. "field-evidence", "rfq-source-models") and is stored as a path
 * prefix, since one real S3 bucket now holds everything.
 */
export async function uploadObject(
  logicalBucket: string,
  path: string,
  body: Buffer | Uint8Array,
  contentType?: string,
): Promise<{ path: string }> {
  const key = `${logicalBucket}/${path}`;
  await getClient().send(
    new PutObjectCommand({
      Bucket: bucketName(),
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
  return { path };
}

/** Short-lived signed download URL — same purpose as Supabase's createSignedUrl. */
export async function getSignedDownloadUrl(
  logicalBucket: string,
  path: string,
  expiresInSeconds = 3600,
): Promise<string> {
  const key = `${logicalBucket}/${path}`;
  const command = new GetObjectCommand({ Bucket: bucketName(), Key: key });
  return getSignedUrl(getClient(), command, { expiresIn: expiresInSeconds });
}

export async function deleteObject(
  logicalBucket: string,
  path: string,
): Promise<void> {
  const key = `${logicalBucket}/${path}`;
  await getClient().send(
    new DeleteObjectCommand({ Bucket: bucketName(), Key: key }),
  );
}

/**
 * Read an object's bytes back out of storage. Added for Bulk Intake document
 * parsing — nothing before this needed to read a file's content server-side,
 * only upload it or hand back a signed URL for the browser to fetch directly.
 */
export async function getObjectBuffer(
  logicalBucket: string,
  path: string,
): Promise<Buffer> {
  const key = `${logicalBucket}/${path}`;
  const response = await getClient().send(
    new GetObjectCommand({ Bucket: bucketName(), Key: key }),
  );
  const body = response.Body;
  if (!body) throw new Error(`Empty object body for ${key}`);
  const chunks: Buffer[] = [];
  // AWS SDK v3's Body is a web/node ReadableStream depending on runtime;
  // both expose an async iterator of Uint8Array chunks.
  for await (const chunk of body as unknown as AsyncIterable<Uint8Array>) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
