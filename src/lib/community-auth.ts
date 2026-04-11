/**
 * Phase 9.0 커뮤니티 인증/해시 유틸
 * - 비밀번호: Node crypto scrypt 기반 해시 (bcrypt 대체, 의존성 없음)
 * - IP: SHA-256 + 서버 salt (개인정보 보호)
 */

import { randomBytes, scryptSync, timingSafeEqual, createHash } from "crypto";

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 32;
const SCRYPT_SALT_LEN = 16;

export function hashPassword(plain: string): string {
  if (typeof plain !== "string" || plain.length < 4) {
    throw new Error("비밀번호는 4자 이상이어야 합니다");
  }
  const salt = randomBytes(SCRYPT_SALT_LEN);
  const derived = scryptSync(plain, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  if (!plain || !stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const saltHex = parts[1];
  const hashHex = parts[2];
  if (!saltHex || !hashHex) return false;

  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const derived = scryptSync(plain, salt, expected.length, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const salt = process.env.COMMUNITY_IP_SALT ?? "factnote-community-default";
  return createHash("sha256")
    .update(`${salt}:${ip}`)
    .digest("hex")
    .slice(0, 32);
}

/** Next.js Request 에서 클라이언트 IP 추정 */
export function extractClientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = headers.get("x-real-ip");
  if (real) return real;
  return null;
}
