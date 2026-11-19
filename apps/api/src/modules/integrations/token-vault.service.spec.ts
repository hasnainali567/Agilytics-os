import { describe, expect, it } from "@jest/globals";
import {
  createTokenVaultForTest,
  decryptToken,
  encryptToken,
  TokenVaultService,
} from "./token-vault.service";

const KEY = "test-passphrase-do-not-use-in-prod";
const OTHER_KEY = "a-completely-different-passphrase";
const SECRET_JSON = JSON.stringify({
  access_token: "xoxb-12345-secret-token",
  refresh_token: "1//refresh-token-value",
});

describe("TokenVault (AES-256-GCM, scrypt, per-value salt+IV)", () => {
  it("encrypt/decrypt round-trips the exact plaintext", () => {
    const blob = encryptToken(SECRET_JSON, KEY);
    expect(decryptToken(blob, KEY)).toBe(SECRET_JSON);
  });

  it("two encryptions of the same plaintext differ (random salt+IV)", () => {
    expect(encryptToken(SECRET_JSON, KEY)).not.toBe(encryptToken(SECRET_JSON, KEY));
  });

  it("ciphertext contains no plaintext (no token leaks into storage)", () => {
    const blob = encryptToken(SECRET_JSON, KEY);
    expect(blob).not.toContain("xoxb-12345");
    expect(blob).not.toContain("refresh-token-value");
    expect(blob).not.toContain("access_token");
  });

  it("decrypt with the wrong key fails (auth tag mismatch, never partial plaintext)", () => {
    const blob = encryptToken(SECRET_JSON, KEY);
    expect(() => decryptToken(blob, OTHER_KEY)).toThrow();
  });

  it("tampered ciphertext fails", () => {
    const blob = encryptToken(SECRET_JSON, KEY);
    const tampered = `${blob.slice(0, -4)}AAAA`;
    expect(() => decryptToken(tampered, KEY)).toThrow();
  });

  it("malformed blobs are rejected, not decrypted", () => {
    expect(() => decryptToken("not-a-vault-blob", KEY)).toThrow("unsupported ciphertext format");
    expect(() => decryptToken("", KEY)).toThrow();
  });

  it("service wraps the same round-trip; test factory binds an explicit key", () => {
    const vault = createTokenVaultForTest(KEY);
    const blob = vault.encrypt(SECRET_JSON);
    expect(vault.decrypt(blob)).toBe(SECRET_JSON);
    expect(() => createTokenVaultForTest(OTHER_KEY).decrypt(blob)).toThrow();
  });

  it("service without env uses an ephemeral key and says so", () => {
    const saved = process.env.TOKEN_ENCRYPTION_KEY;
    delete process.env.TOKEN_ENCRYPTION_KEY;
    try {
      const vault = new TokenVaultService();
      expect(vault.isEphemeral).toBe(true);
      expect(vault.decrypt(vault.encrypt("hello"))).toBe("hello");
    } finally {
      if (saved !== undefined) process.env.TOKEN_ENCRYPTION_KEY = saved;
    }
  });
});
