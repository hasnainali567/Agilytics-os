import { INestApplication, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app: INestApplication = await NestFactory.create(AppModule);
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
