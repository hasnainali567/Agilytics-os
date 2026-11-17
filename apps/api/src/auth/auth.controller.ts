import { Body, Controller, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AuthService } from "./auth.service";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /**
   * DEV ONLY — issues a local JWT for testing. In production, tokens come
   * from Cognito (hosted UI / managed login) and this endpoint is removed.
   */
  @Post("dev-login")
  devLogin(@Body() body: { userId: string; tenantId: string }) {
    return this.auth.devLogin(body.userId, body.tenantId);
  }
}
