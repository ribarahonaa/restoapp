import { prisma } from "../prisma.js";
import { hashPassword, verifyPassword } from "./password.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "./tokens.js";
import { HttpError } from "../middleware/error.js";
import { env } from "../env.js";
import type { Role } from "@prisma/client";

export async function registerUser(input: {
  email: string;
  password: string;
  name: string;
}) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new HttpError(409, "email_taken");

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash: await hashPassword(input.password),
      name: input.name,
      role: "usuario",
    },
  });
  return issueTokens(user.id, user.role);
}

export async function loginUser(input: { email: string; password: string }) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) throw new HttpError(401, "invalid_credentials");
  const ok = await verifyPassword(user.passwordHash, input.password);
  if (!ok) throw new HttpError(401, "invalid_credentials");
  return issueTokens(user.id, user.role);
}

// Emite un par de tokens y persiste el refresh (jti) para poder rotarlo/revocarlo.
async function issueTokens(userId: string, role: Role) {
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL * 1000);
  const record = await prisma.refreshToken.create({ data: { userId, expiresAt } });
  return {
    accessToken: signAccessToken({ sub: userId, role }),
    refreshToken: signRefreshToken({ sub: userId, role, jti: record.id }),
  };
}

// Rota el refresh: valida el JWT, verifica que el jti siga vigente, lo revoca y
// emite uno nuevo. Si se reutiliza un token ya revocado (posible robo), revoca
// toda la cadena del usuario.
export async function rotateTokens(refreshToken: string) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new HttpError(401, "invalid_refresh");
  }
  if (!payload.jti) throw new HttpError(401, "invalid_refresh");

  const record = await prisma.refreshToken.findUnique({ where: { id: payload.jti } });
  if (!record || record.userId !== payload.sub) throw new HttpError(401, "invalid_refresh");

  if (record.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw new HttpError(401, "invalid_refresh");
  }
  if (record.expiresAt < new Date()) throw new HttpError(401, "invalid_refresh");

  await prisma.refreshToken.update({ where: { id: record.id }, data: { revokedAt: new Date() } });
  return issueTokens(payload.sub, payload.role);
}

// Revoca el refresh presentado (logout). Silencioso si el token es inválido.
export async function revokeRefreshToken(refreshToken: string) {
  try {
    const payload = verifyRefreshToken(refreshToken);
    if (payload.jti) {
      await prisma.refreshToken.updateMany({
        where: { id: payload.jti, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
  } catch {
    // token inválido/expirado: nada que revocar
  }
}
