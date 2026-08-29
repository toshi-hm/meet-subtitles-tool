import { OAUTH_CLIENT_ID_ERROR } from "./google-oauth";

export function toDriveErrorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : "";
  if (/oauth client id|bad client id|invalid_client|oauth2 request failed/i.test(message)) {
    return OAUTH_CLIENT_ID_ERROR;
  }
  return fallback;
}
