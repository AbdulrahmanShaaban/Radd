import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;
const SALT_BYTES = 16;
const MAX_MEM = 128 * 1024 * 1024;

type ScryptParams = { N: number; r: number; p: number };

const CURRENT: ScryptParams = { N: 65536, r: 8, p: 1 };

function scryptAsync(
  plain: string,
  salt: Buffer,
  keylen: number,
  params: ScryptParams,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      plain,
      salt,
      keylen,
      { N: params.N, r: params.r, p: params.p, maxmem: MAX_MEM },
      (err, derived) => (err ? reject(err) : resolve(derived)),
    );
  });
}

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const derived = await scryptAsync(plain, salt, KEY_LENGTH, CURRENT);
  return [
    "scrypt",
    CURRENT.N,
    CURRENT.r,
    CURRENT.p,
    salt.toString("base64"),
    derived.toString("base64"),
  ].join("$");
}

export async function verifyPassword(
  plain: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p)) {
    return false;
  }
  const salt = Buffer.from(parts[4], "base64");
  const expected = Buffer.from(parts[5], "base64");
  if (expected.length === 0) return false;
  const derived = await scryptAsync(plain, salt, expected.length, { N: n, r, p });
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

let timingHashPromise: Promise<string> | null = null;

function timingHash(): Promise<string> {
  timingHashPromise ??= hashPassword(randomBytes(16).toString("hex"));
  return timingHashPromise;
}

export async function dummyVerifyPassword(plain: string): Promise<boolean> {
  return verifyPassword(plain, await timingHash());
}
