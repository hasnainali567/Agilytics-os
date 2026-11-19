import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";

/** Marks a route as public — JwtAuthGuard skips it (OAuth callbacks, incoming webhooks). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
