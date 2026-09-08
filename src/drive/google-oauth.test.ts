import { describe, expect, it, vi } from "vitest";
import {
  CHROME_DRIVE_AUTH_ERROR,
  OAUTH_CONFIGURATION_ERROR,
  GoogleDriveOAuth,
} from "./google-oauth";
import { DRIVE_FILE_SCOPE } from "./google-drive";

describe("GoogleDriveOAuth", () => {
  it("requests a Chrome-managed token with the minimum Drive scope", async () => {
    const getAuthToken = vi.fn(async () => ({ token: "access-token" }));
    const oauth = new GoogleDriveOAuth({ getAuthToken });

    await expect(oauth.getAccessToken(true)).resolves.toBe("access-token");
    expect(getAuthToken).toHaveBeenCalledWith({
      interactive: true,
      scopes: [DRIVE_FILE_SCOPE],
    });
  });

  it("uses a non-interactive Chrome token request during background synchronization", async () => {
    const getAuthToken = vi.fn(async () => ({ token: "cached-access-token" }));
    const oauth = new GoogleDriveOAuth({ getAuthToken });

    await expect(oauth.getAccessToken(false)).resolves.toBe("cached-access-token");
    expect(getAuthToken).toHaveBeenCalledWith({
      interactive: false,
      scopes: [DRIVE_FILE_SCOPE],
    });
  });

  it("removes the latest Chrome-managed token after a 401 response", async () => {
    const removeCachedAuthToken = vi.fn(async () => undefined);
    const oauth = new GoogleDriveOAuth({
      getAuthToken: vi.fn(async () => ({ token: "access-token" })),
      removeCachedAuthToken,
    });

    await oauth.getAccessToken(false);
    await oauth.clearCachedAuth();

    expect(removeCachedAuthToken).toHaveBeenCalledWith({ token: "access-token" });
  });

  it("reports a manifest configuration error when Chrome returns no token", async () => {
    const oauth = new GoogleDriveOAuth({
      getAuthToken: vi.fn(async () => ({})),
    });

    await expect(oauth.getAccessToken(true)).rejects.toThrow(OAUTH_CONFIGURATION_ERROR);
  });

  it("reports Chrome-only Drive support when the identity API is unavailable", async () => {
    const oauth = new GoogleDriveOAuth({});

    await expect(oauth.getAccessToken(true)).rejects.toThrow(CHROME_DRIVE_AUTH_ERROR);
  });

  it("maps unsupported identity API errors to the Chrome-only message", async () => {
    const oauth = new GoogleDriveOAuth({
      getAuthToken: vi.fn(async () => {
        throw new Error("getAuthToken is not supported");
      }),
    });

    await expect(oauth.getAccessToken(true)).rejects.toThrow(CHROME_DRIVE_AUTH_ERROR);
  });
});
