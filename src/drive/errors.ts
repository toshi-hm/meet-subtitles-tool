import { CHROME_DRIVE_AUTH_ERROR, OAUTH_CONFIGURATION_ERROR } from "./google-oauth";

export function toDriveErrorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : "";
  if (message === CHROME_DRIVE_AUTH_ERROR) return CHROME_DRIVE_AUTH_ERROR;
  if (/oauth client id|bad client id|invalid_client|oauth2 request failed/i.test(message)) {
    return OAUTH_CONFIGURATION_ERROR;
  }
  return fallback;
}
