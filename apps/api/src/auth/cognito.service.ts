import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";

/**
 * Cognito client — used by the auth module for admin operations
 * (e.g. looking up a user by email). End-user sign-in happens through
 * Cognito's hosted UI / managed login in the web app (aws-amplify/auth),
 * not through this service.
 */
@Injectable()
export class CognitoService {
  private readonly logger = new Logger(CognitoService.name);
  private readonly client: CognitoIdentityProviderClient;

  constructor(private readonly config: ConfigService) {
    this.client = new CognitoIdentityProviderClient({
      region: this.config.get<string>("COGNITO_REGION") ?? "ap-south-1",
    });
    void this.client;
    this.logger.log("Cognito client ready (TODO: wire user-pool admin calls)");
  }
}
