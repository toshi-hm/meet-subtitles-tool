import { describe, expect, it } from "vitest";
import { OAUTH_CLIENT_ID_ERROR } from "./google-oauth";
import { toDriveErrorMessage } from "./errors";

describe("toDriveErrorMessage", () => {
  it("hides the raw bad client id error", () => {
    expect(
      toDriveErrorMessage(
        new Error("OAuth2 request failed: Service responded with error: 'bad client id: {0}'"),
        "保存に失敗しました",
      ),
    ).toBe(OAUTH_CLIENT_ID_ERROR);
  });

  it("returns the operation-specific fallback for other errors", () => {
    expect(toDriveErrorMessage(new Error("network error"), "保存に失敗しました")).toBe(
      "保存に失敗しました",
    );
  });
});
