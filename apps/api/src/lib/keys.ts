import { exportJWK, exportPKCS8, exportSPKI, generateKeyPair, importPKCS8, importSPKI } from "jose";
import type { JWK } from "jose";
import type { KeyObject } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const KEY_DIR = process.env.WOLF_KEY_DIR ?? path.join(process.cwd(), "data", "keys");

type CryptoKeyLike = CryptoKey | KeyObject;

export type WolfKeySet = {
  kid: string;
  privateKey: CryptoKeyLike;
  publicKey: CryptoKeyLike;
  publicJwk: JWK;
};

let cached: WolfKeySet | null = null;

export async function getSigningKeys(): Promise<WolfKeySet> {
  if (cached) return cached;
  fs.mkdirSync(KEY_DIR, { recursive: true });
  const privPath = path.join(KEY_DIR, "handoff-ed25519.pkcs8");
  const pubPath = path.join(KEY_DIR, "handoff-ed25519.spki");
  const kidPath = path.join(KEY_DIR, "handoff-kid.txt");

  if (fs.existsSync(privPath) && fs.existsSync(pubPath) && fs.existsSync(kidPath)) {
    const privateKey = await importPKCS8(fs.readFileSync(privPath, "utf8"), "EdDSA");
    const publicKey = await importSPKI(fs.readFileSync(pubPath, "utf8"), "EdDSA");
    const kid = fs.readFileSync(kidPath, "utf8").trim();
    const publicJwk = { ...(await exportJWK(publicKey)), kid, alg: "EdDSA", use: "sig" };
    cached = { kid, privateKey, publicKey, publicJwk };
    return cached;
  }

  const { privateKey, publicKey } = await generateKeyPair("EdDSA", { extractable: true });
  const kid = `wolf-handoff-${Date.now()}`;
  fs.writeFileSync(privPath, await exportPKCS8(privateKey));
  fs.writeFileSync(pubPath, await exportSPKI(publicKey));
  fs.writeFileSync(kidPath, kid);
  const publicJwk = { ...(await exportJWK(publicKey)), kid, alg: "EdDSA", use: "sig" };
  cached = { kid, privateKey, publicKey, publicJwk };
  return cached;
}

export function resetKeysForTests(): void {
  cached = null;
  try {
    fs.rmSync(KEY_DIR, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}
