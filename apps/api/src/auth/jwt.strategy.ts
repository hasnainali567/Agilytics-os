import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ExtractJwt, Strategy } from "passport-jwt";
import { PassportStrategy } from "@nestjs/passport";
import { passportJwtSecret } from "jwks-rsa";

/**
 * Cognito JWT strategy — the production auth path.
 * Verifies RS256 JWTs against the Cognito user pool's JWKS endpoint.
 * The current JwtAuthGuard (symmetric dev secret) is used until this
 * strategy is switched on; see apps/api/README.md for the wiring checklist.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    const region = config.get<string>("COGNITO_REGION") ?? "ap-south-1";
    const poolId = config.get<string>("COGNITO_USER_POOL_ID") ?? "dev-pool";
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `https://cognito-idp.${region}.amazonaws.com/${poolId}/.well-known/jwks.json`,
      }),
      issuer: `https://cognito-idp.${region}.amazonaws.com/${poolId}`,
      algorithms: ["RS256"],
    });
  }

  validate(payload: Record<string, unknown>) {
    return {
      id: payload.sub,
      tenantId: payload["custom:tenant_id"] ?? payload.tenantId,
      platformRole: payload["custom:platform_role"],
    };
  }
}
