import { describe, expect, it, vi } from "vitest";
import { GoogleDriveClient } from "./google-drive";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("GoogleDriveClient", () => {
  it("gets an interactive OAuth token when requested", async () => {
    const identity = {
      getAuthToken: vi.fn().mockResolvedValue({ token: "token" }),
      removeCachedAuthToken: vi.fn().mockResolvedValue(undefined),
    };
    const client = new GoogleDriveClient(fetch, identity);

    await expect(client.getAccessToken(true)).resolves.toBe("token");
    expect(identity.getAuthToken).toHaveBeenCalledWith({ interactive: true });
  });

  it("finds an existing folder or creates it under My Drive", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ files: [] }))
      .mockResolvedValueOnce(jsonResponse({ id: "folder-1" }));
    const client = new GoogleDriveClient(fetcher);

    await expect(client.ensureFolder("token")).resolves.toBe("folder-1");
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[1]?.[1]).toMatchObject({
      method: "POST",
      headers: { Authorization: "Bearer token", "Content-Type": "application/json" },
    });
  });

  it("creates and updates a transcript file", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ id: "file-1" }))
      .mockResolvedValueOnce(jsonResponse(undefined, 204));
    const client = new GoogleDriveClient(fetcher);

    await expect(
      client.createTranscript("token", "folder-1", "captions.txt", "本文"),
    ).resolves.toBe("file-1");
    await expect(client.updateTranscript("token", "file-1", "更新後")).resolves.toBeUndefined();
    expect(fetcher.mock.calls[0]?.[0]).toContain("uploadType=multipart");
    expect(fetcher.mock.calls[0]?.[1]?.body).toContain("本文");
    expect(fetcher.mock.calls[1]?.[1]).toMatchObject({
      method: "PATCH",
      body: "更新後",
    });
  });
});
