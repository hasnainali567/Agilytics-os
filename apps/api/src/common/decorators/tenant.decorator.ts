import { createParamDecorator, type ExecutionContext } from "@nestjs/common";

/** Reads tenantId set on the request by the JWT guard (from Cognito claims). */
export const TenantId = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest<{ tenantId?: string }>();
  return req.tenantId ?? "demo-tenant";
});
