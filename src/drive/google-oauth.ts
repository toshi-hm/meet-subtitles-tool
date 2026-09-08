import { DRIVE_FILE_SCOPE } from "./google-drive";

export const OAUTH_CONFIGURATION_ERROR =
  "エラー: Google DriveのOAuth設定を確認してください。拡張機能を最新版へ更新してから再試行してください。";

export const CHROME_DRIVE_AUTH_ERROR =
  "エラー: Google Drive保存はGoogle Chromeで利用してください。字幕のコピーとTXT保存は引き続き利用できます。";

type OAuthIdentity = {
  getAuthToken?: (details: {
    interactive: boolean;
    scopes: string[];
  }) => Promise<{ token?: string }>;
  removeCachedAuthToken?: (details: { token: string }) => Promise<void>;
};

export class GoogleDriveOAuth {
  private accessToken?: string;

  constructor(private readonly identity: OAuthIdentity) {}

  async getAccessToken(interactive: boolean): Promise<string> {
    if (!this.identity.getAuthToken) throw new Error(CHROME_DRIVE_AUTH_ERROR);

    try {
      const result = await this.identity.getAuthToken({
        interactive,
        scopes: [DRIVE_FILE_SCOPE],
      });
      if (!result.token) throw new Error(OAUTH_CONFIGURATION_ERROR);
      this.accessToken = result.token;
      return result.token;
    } catch (error) {
      if (error instanceof Error && /not supported|not implemented/i.test(error.message)) {
        throw new Error(CHROME_DRIVE_AUTH_ERROR);
      }
      throw error;
    }
  }

  async clearCachedAuth(): Promise<void> {
    const token = this.accessToken;
    this.accessToken = undefined;
    if (token && this.identity.removeCachedAuthToken) {
      await this.identity.removeCachedAuthToken({ token });
    }
  }
}
