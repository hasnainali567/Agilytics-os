import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PutObjectCommand } from "@aws-sdk/client-s3";

/** File storage (S3) — presigned upload URLs, never proxied file bytes. */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;

  constructor(config: ConfigService) {
    this.client = new S3Client({ region: config.get<string>("COGNITO_REGION") ?? "ap-south-1" });
  }

  async presignedUploadUrl(bucket: string, key: string): Promise<string> {
    const url = await getSignedUrl(
      this.client,
      new PutObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn: 3600 },
    );
    this.logger.log(`Presigned upload URL issued for ${bucket}/${key}`);
    return url;
  }
}
