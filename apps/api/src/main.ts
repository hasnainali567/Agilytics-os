import { INestApplication, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import { AppModule } from "./app.module";

async function bootstrap() {
  // Auth must be configured before the API serves anything: either the
  // local-dev symmetric secret (JWT_SECRET) or a Cognito user pool
  // (production, JWKS). Without either, every authenticated request
  // would fail — fail fast here with a clear message instead.
  // When the guard/gateway swap to Cognito JWKS verification, this
  // check becomes "Cognito pool required" and JWT_SECRET goes away.
  if (!process.env.JWT_SECRET && !process.env.COGNITO_USER_POOL_ID) {
    throw new Error(
      "No auth configured: set JWT_SECRET (local dev) or COGNITO_USER_POOL_ID " +
        "(production Cognito). See apps/api/.env.example and SECURITY.md §2.",
    );
  }
  // rawBody: true — Nest keeps the raw request bytes on `req.rawBody`
  // so webhook signature verification (GitHub/Slack HMAC) can run on
  // exactly what the sender signed. JSON parsing is unaffected.
  const app: INestApplication = await NestFactory.create(AppModule, { rawBody: true });
  app.use(helmet());
  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.enableCors({ origin: process.env.WEB_ORIGIN ?? "http://localhost:5173" });

  const config = new DocumentBuilder()
    .setTitle("Agilytics OS API")
    .setDescription("AI-powered operating system for teams and project management — v2")
    .setVersion("1.0")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document);

  await app.listen(process.env.API_PORT ?? 3001);
}
bootstrap();
