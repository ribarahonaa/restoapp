import { prisma } from "../prisma.js";
import { hashPassword, verifyPassword } from "./password.js";
import { signAccessToken, signRefreshToken } from "./tokens.js";
import { HttpError } from "../middleware/error.js";

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

function issueTokens(userId: string, role: import("@prisma/client").Role) {
  return {
    accessToken: signAccessToken({ sub: userId, role }),
    refreshToken: signRefreshToken({ sub: userId, role }),
  };
}
