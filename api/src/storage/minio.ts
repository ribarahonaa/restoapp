import { Client } from "minio";
import { env } from "../env.js";

export const minio = new Client({
  endPoint: env.MINIO_ENDPOINT,
  port: env.MINIO_PORT,
  useSSL: false,
  accessKey: env.MINIO_ROOT_USER,
  secretKey: env.MINIO_ROOT_PASSWORD,
});

const BUCKET = env.MINIO_BUCKET;

// Política public-read: las imágenes se sirven directo vía <img src>.
function publicReadPolicy(bucket: string) {
  return JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Principal: { AWS: ["*"] },
        Action: ["s3:GetObject"],
        Resource: [`arn:aws:s3:::${bucket}/*`],
      },
    ],
  });
}

// Crea el bucket si falta y lo deja público para lectura. Idempotente.
export async function ensureBucket(): Promise<void> {
  const exists = await minio.bucketExists(BUCKET).catch(() => false);
  if (!exists) {
    await minio.makeBucket(BUCKET);
  }
  await minio.setBucketPolicy(BUCKET, publicReadPolicy(BUCKET));
}

// URL pública (alcanzable desde el navegador) de un objeto del bucket.
export function publicUrl(key: string): string {
  return `${env.MINIO_PUBLIC_URL}/${BUCKET}/${key}`;
}

// Descarga una imagen remota y la sube al bucket. Devuelve la URL pública.
export async function uploadFromUrl(sourceUrl: string, key: string): Promise<string> {
  const res = await fetch(sourceUrl);
  if (!res.ok) throw new Error(`fetch ${sourceUrl} -> ${res.status}`);
  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  const buffer = Buffer.from(await res.arrayBuffer());
  await minio.putObject(BUCKET, key, buffer, buffer.length, {
    "Content-Type": contentType,
  });
  return publicUrl(key);
}

// Sube un buffer ya en memoria (ej. archivo subido por el dueño) al bucket.
export async function uploadBuffer(
  buffer: Buffer,
  contentType: string,
  key: string
): Promise<string> {
  await minio.putObject(BUCKET, key, buffer, buffer.length, {
    "Content-Type": contentType,
  });
  return publicUrl(key);
}
