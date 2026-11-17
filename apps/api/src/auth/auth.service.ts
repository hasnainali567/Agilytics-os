import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { sign } from "jsonwebtoken";

@Injectable()
export class AuthService {
  constructor(private readonly config: ConfigService) {}

  /** DEV ONLY — see AuthController. */
  devLogin(userId: string, tenantId: string) {
    const secret = this.config.get<string>("JWT_SECRET") ?? "dev-only-change-me";
    const token = sign({ sub: userId, tenantId }, secret, { expiresIn: "1h" });
    return { accessToken: token, tokenType: "Bearer", expiresIn: 3600 };
  }
}
