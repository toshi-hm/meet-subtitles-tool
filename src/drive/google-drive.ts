export const DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";
export const MEET_SUBTITLES_FOLDER_NAME = "Meet Subtitles";
const DRIVE_API_BASE = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_BASE = "https://www.googleapis.com/upload/drive/v3";

export type IdentityProvider = {
  getAuthToken: (details?: { interactive?: boolean }) => Promise<{ token?: string }>;
  removeCachedAuthToken: (details: { token: string }) => Promise<void>;
};

export type DriveFile = {
  id: string;
  name?: string;
  mimeType?: string;
};

export class DriveHttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "DriveHttpError";
  }
}

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { message?: string } };
    return body.error?.message ?? response.statusText;
  } catch {
    return response.statusText;
  }
}

export class GoogleDriveClient {
  constructor(
    private readonly fetcher: Fetcher = fetch,
    private readonly identity?: IdentityProvider,
  ) {}

  async getAccessToken(interactive: boolean): Promise<string> {
    if (!this.identity) throw new Error("Google Drive認証が設定されていません");
    const result = await this.identity.getAuthToken({ interactive });
    if (!result.token) throw new Error("Google Driveのアクセストークンを取得できませんでした");
    return result.token;
  }

  async ensureFolder(accessToken: string): Promise<string> {
    const query = [
      `name = '${MEET_SUBTITLES_FOLDER_NAME}'`,
      "mimeType = 'application/vnd.google-apps.folder'",
      "trashed = false",
      "'root' in parents",
    ].join(" and ");
    const params = new URLSearchParams({
      q: query,
      spaces: "drive",
      pageSize: "100",
      fields: "files(id,name,mimeType)",
    });
    const listed = await this.request<{ files?: DriveFile[] }>(
      `${DRIVE_API_BASE}/files?${params.toString()}`,
      accessToken,
    );
    const existing = listed.files?.find((file) => file.id);
    if (existing) return existing.id;

    const created = await this.request<DriveFile>(`${DRIVE_API_BASE}/files`, accessToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: MEET_SUBTITLES_FOLDER_NAME,
        mimeType: "application/vnd.google-apps.folder",
        parents: ["root"],
      }),
    });
    return created.id;
  }

  async createTranscript(
    accessToken: string,
    folderId: string,
    filename: string,
    text: string,
  ): Promise<string> {
    const boundary = `meet-subtitles-${crypto.randomUUID?.() ?? Date.now()}`;
    const metadata = JSON.stringify({
      name: filename,
      mimeType: "text/plain",
      parents: [folderId],
    });
    const body = [
      `--${boundary}`,
      "Content-Type: application/json; charset=UTF-8",
      "",
      metadata,
      `--${boundary}`,
      "Content-Type: text/plain; charset=UTF-8",
      "",
      text,
      `--${boundary}--`,
      "",
    ].join("\r\n");
    const created = await this.request<DriveFile>(
      `${DRIVE_UPLOAD_BASE}/files?uploadType=multipart&fields=id,name`,
      accessToken,
      {
        method: "POST",
        headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
        body,
      },
    );
    return created.id;
  }

  async updateTranscript(accessToken: string, fileId: string, text: string): Promise<void> {
    await this.request<DriveFile>(
      `${DRIVE_UPLOAD_BASE}/files/${encodeURIComponent(fileId)}?uploadType=media`,
      accessToken,
      {
        method: "PATCH",
        headers: { "Content-Type": "text/plain; charset=UTF-8" },
        body: text,
      },
    );
  }

  private async request<T>(url: string, accessToken: string, init: RequestInit = {}): Promise<T> {
    const response = await this.fetcher(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...init.headers,
      },
    });
    if (!response.ok) throw new DriveHttpError(response.status, await readError(response));
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }
}
