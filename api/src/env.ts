import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(8),
  JWT_REFRESH_SECRET: z.string().min(8),
  ACCESS_TOKEN_TTL: z.coerce.number().default(900),
  REFRESH_TOKEN_TTL: z.coerce.number().default(604800),
  MINIO_ENDPOINT: z.string().default("minio"),
  MINIO_PORT: z.coerce.number().default(9000),
  MINIO_ROOT_USER: z.string().default("minio"),
  MINIO_ROOT_PASSWORD: z.string().default("minio12345"),
  MINIO_BUCKET: z.string().default("restoapp"),
  // Base alcanzable desde el navegador para servir imágenes (host, no red interna)
  MINIO_PUBLIC_URL: z.string().default("http://localhost:9000"),
  MAX_POPUPS_PER_DAY: z.coerce.number().default(3),
  // Orígenes permitidos por CORS, separados por coma. Sin valor => se permite
  // cualquier origen (cómodo en dev). En producción, fijar el/los dominio(s).
  CORS_ORIGIN: z.string().optional(),
});

export const env = schema.parse(process.env);
