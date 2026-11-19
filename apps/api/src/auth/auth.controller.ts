import { Body, Controller, ForbiddenException, Post } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { AuthService } from "./auth.service";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /**
   * DEV ONLY — issues a local JWT for testing. In production, tokens come
   * from Cognito (hosted UI / managed login) and this endpoint is removed.
   * Gated on NODE_ENV: in production it answers 403, always.
   */
  @ApiOperation({ summary: "Dev login" })
  @ApiResponse({ status: 201, description: "Created" })
  @Post("dev-login")
  devLogin(@Body() body: { userId: string; tenantId: string }) {
    if (process.env.NODE_ENV === "production") {
      throw new ForbiddenException(
        "dev-login is disabled in production — tokens come from Cognito.",
      );
    }
    return this.auth.devLogin(body.userId, body.tenantId);
  }
}
