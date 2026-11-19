import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { sign } from "jsonwebtoken";

@Injectable()
export class AuthService {
  constructor(private readonly config: ConfigService) {}

  /** DEV ONLY — see AuthController. */
  devLogin(userId: string, tenantId: string) {
    const secret = this.config.get<string>("JWT_SECRET") ?? "dev-only-change-me";
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
