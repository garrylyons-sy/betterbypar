import crypto from "node:crypto";

export function hashSecretToken(token: string) {
  return crypto.createHash("sha256").update(token.trim(), "utf8").digest("hex");
}

export function safeTokenEqualsHash(token: string, hash: string | null | undefined) {
  if (!hash) return false;
  return hashSecretToken(token) === hash;
}
