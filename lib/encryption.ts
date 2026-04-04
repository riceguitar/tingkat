import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";

function getSecret(): Buffer {
  const hex = process.env.APP_ENCRYPTION_SECRET;
  if (!hex) throw new Error("APP_ENCRYPTION_SECRET is not set");
  return Buffer.from(hex, "hex");
}

export function encrypt(plaintext: string): {
  iv: string;
  authTag: string;
  ciphertext: string;
} {
  const secret = getSecret();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, secret, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  return {
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    ciphertext: encrypted.toString("base64"),
  };
}

export function decrypt(
  ciphertext: string,
  iv: string,
  authTag: string
): string {
  const secret = getSecret();
  const decipher = createDecipheriv(
    ALGORITHM,
    secret,
    Buffer.from(iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(authTag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
