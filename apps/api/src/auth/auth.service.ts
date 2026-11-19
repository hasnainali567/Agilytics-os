import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { sign } from "jsonwebtoken";

@Injectable()
export class AuthService {
  constructor(private readonly config: ConfigService) {}

  /** DEV ONLY — see AuthController. Throws when JWT_SECRET is unset. */
  devLogin(userId: string, tenantId: string) {
    const secret = this.config.get<string>("JWT_SECRET");
    if (!secret) {
      // No fallback: a missing secret must fail loudly, never silently
      // sign with a well-known value. Production auth is Cognito (JWKS),
      // not this endpoint — see SECURITY.md §2.
      throw new Error(
        "JWT_SECRET is not configured — set JWT_SECRET in the environment " +
          "(see apps/api/.env.example). Dev-login cannot issue tokens without it.",
      );
    }
    // DEV ONLY: the platform-admin test user gets the platformRole claim so
    // /admin works without Cognito. In production this claim comes from
    // Cognito (custom:platform_role) and is never self-asserted.
    const isPlatformAdmin = userId === "platform-admin";
    const token = sign(
      {
        sub: userId,
        tenantId,
        ...(isPlatformAdmin
          ? { platformRole: "PLATFORM_ADMIN", "custom:platform_role": "PLATFORM_ADMIN" }
          : {}),
      },
      secret,
      { expiresIn: "1h" },
    );
    return { accessToken: token, tokenType: "Bearer", expiresIn: 3600 };
  }
}
