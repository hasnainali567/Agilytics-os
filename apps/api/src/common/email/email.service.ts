import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SESClient } from "@aws-sdk/client-ses";

/**
 * Email service (SES). Used for invites, digests, and notifications.
 * Stub: logs in dev, sends via SES once a verified sender identity exists.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly client: SESClient;

  constructor(private readonly config: ConfigService) {
    this.client = new SESClient({
      region: this.config.get<string>("COGNITO_REGION") ?? "ap-south-1",
    });
    void this.client;
  }

  async send(to: string, subject: string, body: string): Promise<void> {
    this.logger.log(`Email to ${to}: ${subject} (TODO: SES send, body ${body.length} chars)`);
  }
}
