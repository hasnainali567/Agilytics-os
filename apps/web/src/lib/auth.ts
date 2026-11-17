import { Amplify } from "aws-amplify";

/**
 * Auth (web) — AWS Amplify v6 (aws-amplify/auth).
 * Configured from VITE_ env vars; until Cognito is wired, this is a no-op
 * placeholder so the app can run locally without a user pool.
 */
export function configureAuth() {
  const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID as string | undefined;
  const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID as string | undefined;
  if (!userPoolId || !clientId) {
    return; // local dev without Cognito — auth is a TODO, see apps/api README
  }
  Amplify.configure({
    Auth: {
      Cognito: { userPoolId, userPoolClientId: clientId },
    },
  });
}
