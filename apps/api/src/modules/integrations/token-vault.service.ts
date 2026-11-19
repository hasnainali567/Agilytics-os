/**
 * Token vault — AES-256-GCM encryption of OAuth tokens at rest.
 *
 * SECURITY PLACEHOLDER (zero-cost dev): this is an ENV-BASED AES
 * placeholder, NOT AWS KMS. The encryption key is derived from the
 * `TOKEN_ENCRYPTION_KEY` env var with scrypt (random 16-byte salt per
 * value) and each value gets a fresh random 12-byte IV. Until AWS KMS
 * is wired after funding, anyone with the env var (or a database dump
 * AND the env var) can decrypt the tokens — so treat
 * TOKEN_ENCRYPTION_KEY like a production secret: never commit it, never
 * log it, rotate it by re-connecting every provider (old ciphertext
 * cannot be decrypted with a new key).
 *
 * Format (all base64, dot-separated):
 *   v1.<salt>.<iv>.<authTag>.<ciphertext>
 * Tokens are never logged; only the ciphertext is stored, in
 * `Integration.encryptedCredentials`.
 *
 * No env var? The service generates an EPHEMERAL in-memory key and
 * logs a loud warning: tokens encrypted with it will NOT survive a
 * restart and every provider must be re-connected. Plaintext storage
 * is never an option — this service fails loudly instead.
 */
import { Injectable, Logger } from "@nestjs/common";
import { randomBytes, scryptSync, createCipheriv, createDecipheriv } from "node:crypto";

const FORMAT_VERSION = "v1";
const SALT_BYTES = 16;
const IV_BYTES = 12;
const KEY_BYTES = 32;

function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return scryptSync(passphrase, salt, KEY_BYTES);
}

/** Pure encrypt — exported for unit tests (no Nest wiring needed). */
export function encryptToken(plaintext: string, passphrase: string): string {
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const key = deriveKey(passphrase, salt);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    FORMAT_VERSION,
    salt.toString("base64"),
    iv.toString("base64"),
    tag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(".");
}

/** Pure decrypt — throws (never returns partial plaintext) on bad key / tampered data. */
export function decryptToken(blob: string, passphrase: string): string {
  const parts = blob.split(".");
  if (parts.length !== 5 || parts[0] !== FORMAT_VERSION) {
    throw new Error("Token vault: unsupported ciphertext format");
  }
  const [, saltB64, ivB64, tagB64, ciphertextB64] = parts;
  const key = deriveKey(passphrase, Buffer.from(saltB64, "base64"));
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivB64, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/** Test helper: build a vault bound to an explicit passphrase (no env). */
export function createTokenVaultForTest(passphrase: string): TokenVaultService {
  const vault = new TokenVaultService();
  (vault as unknown as { passphrase: string }).passphrase = passphrase;
  return vault;
}

@Injectable()
export class TokenVaultService {
  private readonly logger = new Logger(TokenVaultService.name);
  private passphrase: string;
  readonly isEphemeral: boolean;

  constructor() {
    const fromEnv = process.env.TOKEN_ENCRYPTION_KEY;
    if (fromEnv && fromEnv.trim().length > 0) {
      this.passphrase = fromEnv;
      this.isEphemeral = false;
    } else {
      // Dev default: ephemeral in-memory key. Loud warning, every boot.
      this.passphrase = randomBytes(KEY_BYTES).toString("hex");
      this.isEphemeral = true;
      this.logger.warn(
        "TOKEN_ENCRYPTION_KEY is not set — using an EPHEMERAL in-memory key. " +
          "OAuth tokens encrypted now will NOT survive a restart; set " +
          "TOKEN_ENCRYPTION_KEY in .env for persistent encryption. " +
          "This is an AES placeholder until AWS KMS is wired after funding.",
      );
    }
  }

  encrypt(plaintext: string): string {
    return encryptToken(plaintext, this.passphrase);
  }

  decrypt(blob: string): string {
    return decryptToken(blob, this.passphrase);
  }
}
