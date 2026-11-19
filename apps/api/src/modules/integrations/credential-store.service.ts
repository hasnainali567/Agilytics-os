/**
 * Credential store — the one place Integration rows are read/written.
 *
 * Storage: `Integration.encryptedCredentials` holds the TokenVault
 * ciphertext of a JSON object (never plaintext, never logged). The JSON
 * shape is per-provider, e.g. `{ access_token, refresh_token, ... }`;
 * providers may also keep small non-secret metadata in the same object
 * (e.g. Notion `links`, webhook `url`) — it is all encrypted at rest.
 *
 * Provider-name normalisation: the Prisma `IntegrationProvider` enum
 * has no bare `GOOGLE` value — the Google provider (Calendar + Gmail +
 * Drive) is stored as `GOOGLE_CALENDAR`. Callers may use either name;
 * it is normalised here and in the registry.
 */
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { ProviderKind } from "./providers/provider.interface";
import { TokenVaultService } from "./token-vault.service";

/** Map the code-level alias to the Prisma enum value stored in the DB. */
export function normalizeProviderKind(provider: ProviderKind): ProviderKind {
  return provider === "GOOGLE" ? "GOOGLE_CALENDAR" : provider;
}

@Injectable()
export class IntegrationCredentialStore {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vault: TokenVaultService,
  ) {}

  /** Decrypted credential JSON for a workspace+provider, or null when not connected. */
  async load(
    tenantId: string,
    provider: ProviderKind,
  ): Promise<Record<string, unknown> | null> {
    const row = await this.prisma.integration.findFirst({
      where: { tenantId, provider: normalizeProviderKind(provider) as never },
      select: { encryptedCredentials: true, isActive: true },
    });
    if (!row || !row.isActive) return null;
    try {
      return JSON.parse(this.vault.decrypt(row.encryptedCredentials)) as Record<string, unknown>;
    } catch {
      // Corrupt ciphertext or rotated key: treat as not connected, never crash.
      return null;
    }
  }

  /** Encrypt + upsert the credential JSON for a workspace+provider. */
  async save(
    tenantId: string,
    provider: ProviderKind,
    credentials: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.integration.upsert({
      where: {
        tenantId_provider: { tenantId, provider: normalizeProviderKind(provider) as never },
      },
      update: { encryptedCredentials: this.vault.encrypt(JSON.stringify(credentials)), isActive: true },
      create: {
        tenantId,
        provider: normalizeProviderKind(provider) as never,
        encryptedCredentials: this.vault.encrypt(JSON.stringify(credentials)),
        isActive: true,
      },
    });
  }

  /** Merge new fields into the stored credential JSON (keeps existing tokens). */
  async merge(
    tenantId: string,
    provider: ProviderKind,
    patch: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const current = (await this.load(tenantId, provider)) ?? {};
    const next = { ...current, ...patch };
    await this.save(tenantId, provider, next);
    return next;
  }

  /** Remove the stored credentials for a workspace+provider (disconnect). */
  async clear(tenantId: string, provider: ProviderKind): Promise<void> {
    await this.prisma.integration.deleteMany({
      where: { tenantId, provider: normalizeProviderKind(provider) as never },
    });
  }
}
