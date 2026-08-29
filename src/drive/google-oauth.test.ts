import { describe, expect, it, vi } from "vitest";
import { OAUTH_CLIENT_ID_ERROR, GoogleDriveOAuth } from "./google-oauth";

function createStorage(initial: Record<string, unknown> = {}) {
  const values = { ...initial };
  return {
    get: vi.fn(async (keys: string[]) => Object.fromEntries(keys.map((key) => [key, values[key]]))),
    set: vi.fn(async (items: Record<string, unknown>) => {
      Object.assign(values, items);
    }),
    remove: vi.fn(async (keys: string[]) => {
      for (const key of keys) delete values[key];
    }),
  };
}

describe("GoogleDriveOAuth", () => {
  it("requires a configured OAuth Client ID", async () => {
    const storage = createStorage();
    const oauth = new GoogleDriveOAuth(
      { getRedirectURL: () => "https://extension.chromiumapp.org/", launchWebAuthFlow: vi.fn() },
      storage,
    );

    await expect(oauth.getAccessToken(true)).rejects.toThrow(OAUTH_CLIENT_ID_ERROR);
    expect(storage.get).toHaveBeenCalledWith(["driveOAuthClientId"]);
  });

  it("exchanges an authorization code and stores tokens", async () => {
    const storage = createStorage({
      driveOAuthClientId: "1234567890-example.apps.googleusercontent.com",
    });
    const identity = {
      getRedirectURL: () => "https://extension.chromiumapp.org/",
      launchWebAuthFlow: vi.fn(async ({ url }: { url: string }) => {
        const authUrl = new URL(url);
        return `${identity.getRedirectURL()}?code=authorization-code&state=${authUrl.searchParams.get("state")}`;
      }),
    };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: "access-token",
          expires_in: 3600,
          refresh_token: "refresh-token",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const oauth = new GoogleDriveOAuth(identity, storage, fetcher);

    await expect(oauth.getAccessToken(true)).resolves.toBe("access-token");
    expect(identity.launchWebAuthFlow).toHaveBeenCalledWith(
      expect.objectContaining({ interactive: true }),
    );
    expect(fetcher).toHaveBeenCalledWith(
      "https://oauth2.googleapis.com/token",
      expect.objectContaining({ method: "POST" }),
    );
    expect(storage.set).toHaveBeenCalledWith({
      driveOAuthTokens: {
        accessToken: "access-token",
        expiresAt: expect.any(Number),
        refreshToken: "refresh-token",
      },
    });
  });
});
