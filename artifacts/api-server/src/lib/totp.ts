import { generateSecret, generateURI, verify, NobleCryptoPlugin } from "otplib";
import qrcode from "qrcode";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";

const ISSUER = "Provider Mais Fibra";
const cryptoPlugin = new NobleCryptoPlugin();

export function generateTotpSecret(): string {
  return generateSecret({ crypto: cryptoPlugin });
}

export function buildOtpauthUrl(email: string, secret: string): string {
  return generateURI({ issuer: ISSUER, label: email, secret, strategy: "totp" });
}

export async function buildQrDataUrl(otpauthUrl: string): Promise<string> {
  return qrcode.toDataURL(otpauthUrl, { width: 240, margin: 1 });
}

export async function verifyTotpCode(token: string, secret: string): Promise<boolean> {
  const t = token.trim();
  if (!/^\d{6}$/.test(t)) return false;
  try {
    // epochTolerance of 1 step (~30s) on each side absorbs minor clock drift.
    const result = await verify({
      token: t,
      secret,
      strategy: "totp",
      epochTolerance: [1, 1],
      crypto: cryptoPlugin,
    });
    return result.valid === true;
  } catch {
    return false;
  }
}

export async function generateRecoveryCodes(): Promise<{
  plain: string[];
  hashes: string[];
}> {
  const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const plain: string[] = [];
  for (let i = 0; i < 8; i++) {
    const buf = randomBytes(10);
    let code = "";
    for (let j = 0; j < 10; j++) {
      code += ALPHABET[buf[j]! % ALPHABET.length];
    }
    plain.push(`${code.slice(0, 5)}-${code.slice(5)}`);
  }
  const hashes = await Promise.all(plain.map((c) => bcrypt.hash(c, 10)));
  return { plain, hashes };
}

export async function consumeRecoveryCode(
  candidate: string,
  hashes: string[],
): Promise<{ matchedIndex: number; remaining: string[] } | null> {
  const norm = candidate.trim().toUpperCase();
  if (norm.length === 0) return null;
  for (let i = 0; i < hashes.length; i++) {
    const ok = await bcrypt.compare(norm, hashes[i]!);
    if (ok) {
      const remaining = hashes.slice();
      remaining.splice(i, 1);
      return { matchedIndex: i, remaining };
    }
  }
  return null;
}
