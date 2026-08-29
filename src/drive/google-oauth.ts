import {
  loadOAuthClientId,
  OAUTH_TOKENS_STORAGE_KEY,
  type ExtensionStorage,
} from "../settings/drive-oauth";
import { DRIVE_FILE_SCOPE } from "./google-drive";

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const TOKEN_EXPIRY_MARGIN_MS = 60_000;
const OAUTH_CLIENT_ID_PATTERN = /^[0-9]+-[^\s]+\.apps\.googleusercontent\.com$/;

export const OAUTH_CLIENT_ID_ERROR =
  "エラー: OAuth Client IDを設定してください。拡張機能のポップアップから保存してください。";

type OAuthIdentity = {
  getRedirectURL: () => string;
  launchWebAuthFlow: (details: {
    url: string;
    interactive: boolean;
  }) => Promise<string | undefined>;
};

type OAuthTokens = {
  accessToken: string;
  expiresAt: number;
  refreshToken?: string;
};

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  error?: string;
  error_description?: string;
};

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function createRandomString(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return encodeBase64Url(bytes);
}

function isValidClientId(clientId: string): boolean {
  return OAUTH_CLIENT_ID_PATTERN.test(clientId);
}

function isValidStoredTokens(value: unknown): value is OAuthTokens {
  if (!value || typeof value !== "object") return false;
  const tokens = value as Partial<OAuthTokens>;
  return (
    typeof tokens.accessToken === "string" &&
    typeof tokens.expiresAt === "number" &&
    (!tokens.refreshToken || typeof tokens.refreshToken === "string")
  );
}

export class GoogleDriveOAuth {
  constructor(
    private readonly identity: OAuthIdentity,
    private readonly storage: ExtensionStorage,
    private readonly fetcher: Fetcher = fetch,
  ) {}

  async getAccessToken(interactive: boolean): Promise<string> {
    const clientId = await loadOAuthClientId(this.storage);
    if (!isValidClientId(clientId)) throw new Error(OAUTH_CLIENT_ID_ERROR);

    const storedTokens = await this.loadTokens();
    if (storedTokens && storedTokens.expiresAt > Date.now() + TOKEN_EXPIRY_MARGIN_MS) {
      return storedTokens.accessToken;
    }
    if (storedTokens?.refreshToken) {
      try {
        const refreshed = await this.refreshAccessToken(clientId, storedTokens.refreshToken);
        await this.saveTokens({
          ...refreshed,
          refreshToken: refreshed.refreshToken ?? storedTokens.refreshToken,
        });
        return refreshed.accessToken;
      } catch {
        await this.clearTokens();
      }
    }
    if (!interactive)
      throw new Error(
        "エラー: Google Driveの認証が必要です。会議中にDrive接続を実行してください。",
      );

    const tokens = await this.authorize(clientId);
    await this.saveTokens(tokens);
    return tokens.accessToken;
  }

  async clearCachedAuth(): Promise<void> {
    await this.clearTokens();
  }

  private async authorize(clientId: string): Promise<OAuthTokens> {
    const redirectUri = this.identity.getRedirectURL();
    const state = createRandomString(24);
    const codeVerifier = createRandomString(48);
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(codeVerifier));
    const codeChallenge = encodeBase64Url(new Uint8Array(digest));
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: DRIVE_FILE_SCOPE,
      access_type: "offline",
      prompt: "consent",
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });
    const responseUrl = await this.identity.launchWebAuthFlow({
      url: `${AUTH_ENDPOINT}?${params.toString()}`,
      interactive: true,
    });
    if (!responseUrl) throw new Error("Google Driveの認証結果を受け取れませんでした");

    const result = new URL(responseUrl);
    if (result.searchParams.get("state") !== state) {
      throw new Error("Google Driveの認証を確認できませんでした");
    }
    const error = result.searchParams.get("error");
    if (error)
      throw new Error(
        error === "invalid_client"
          ? OAUTH_CLIENT_ID_ERROR
          : "Google Driveの認証がキャンセルされました",
      );
    const code = result.searchParams.get("code");
    if (!code) throw new Error("Google Driveの認証コードを受け取れませんでした");
    return this.exchangeCode(clientId, redirectUri, code, codeVerifier);
  }

  private async exchangeCode(
    clientId: string,
    redirectUri: string,
    code: string,
    codeVerifier: string,
  ): Promise<OAuthTokens> {
    const response = await this.fetcher(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        code,
        code_verifier: codeVerifier,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });
    return this.parseTokenResponse(response);
  }

  private async refreshAccessToken(clientId: string, refreshToken: string): Promise<OAuthTokens> {
    const response = await this.fetcher(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });
    return this.parseTokenResponse(response);
  }

  private async parseTokenResponse(response: Response): Promise<OAuthTokens> {
    const body = (await response.json()) as TokenResponse;
    if (!response.ok || !body.access_token) {
      if (body.error === "invalid_client") throw new Error(OAUTH_CLIENT_ID_ERROR);
      throw new Error("Google Driveのアクセストークンを取得できませんでした");
    }
    return {
      accessToken: body.access_token,
      expiresAt: Date.now() + (body.expires_in ?? 3_600) * 1_000,
      ...(body.refresh_token ? { refreshToken: body.refresh_token } : {}),
    };
  }

  private async loadTokens(): Promise<OAuthTokens | undefined> {
    const values = await this.storage.get([OAUTH_TOKENS_STORAGE_KEY]);
    const tokens = values[OAUTH_TOKENS_STORAGE_KEY];
    return isValidStoredTokens(tokens) ? tokens : undefined;
  }

  private async saveTokens(tokens: OAuthTokens): Promise<void> {
    await this.storage.set({ [OAUTH_TOKENS_STORAGE_KEY]: tokens });
  }

  private async clearTokens(): Promise<void> {
    if (this.storage.remove) {
      await this.storage.remove([OAUTH_TOKENS_STORAGE_KEY]);
      return;
    }
    await this.storage.set({ [OAUTH_TOKENS_STORAGE_KEY]: undefined });
  }
}
