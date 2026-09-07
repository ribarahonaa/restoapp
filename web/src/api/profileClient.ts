import { authedFetch, type Me } from "../auth/authClient.js";

export async function updateName(name: string): Promise<Me> {
  const res = await authedFetch("/me", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<Me>;
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const res = await authedFetch("/me/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword, newPassword }) });
  if (!res.ok) throw new Error(res.status === 400 ? "invalid_password" : `HTTP ${res.status}`);
}

export async function uploadAvatar(file: File): Promise<{ avatarUrl: string }> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await authedFetch("/me/avatar", { method: "POST", body: fd });
  if (!res.ok) throw new Error(res.status === 400 ? "avatar_invalid" : `HTTP ${res.status}`);
  return res.json() as Promise<{ avatarUrl: string }>;
}

export async function removeAvatar(): Promise<void> {
  const res = await authedFetch("/me/avatar", { method: "DELETE" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}
