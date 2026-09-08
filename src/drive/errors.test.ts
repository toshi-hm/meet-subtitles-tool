import { describe, expect, it } from "vitest";
import { CHROME_DRIVE_AUTH_ERROR, OAUTH_CONFIGURATION_ERROR } from "./google-oauth";
import { toDriveErrorMessage } from "./errors";

describe("toDriveErrorMessage", () => {
  it("hides the raw OAuth client configuration error", () => {
    expect(
      toDriveErrorMessage(
        new Error("OAuth2 request failed: Service responded with error: 'bad client id: {0}'"),
        "保存に失敗しました",
      ),
    ).toBe(OAUTH_CONFIGURATION_ERROR);
  });

  it("preserves the Chrome-only Drive support message", () => {
    expect(toDriveErrorMessage(new Error(CHROME_DRIVE_AUTH_ERROR), "保存に失敗しました")).toBe(
      CHROME_DRIVE_AUTH_ERROR,
    );
  });

  it("returns the operation-specific fallback for other errors", () => {
    expect(toDriveErrorMessage(new Error("network error"), "保存に失敗しました")).toBe(
      "保存に失敗しました",
    );
  });
});
