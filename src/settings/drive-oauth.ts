export const OAUTH_CLIENT_ID_STORAGE_KEY = "driveOAuthClientId";
export const OAUTH_TOKENS_STORAGE_KEY = "driveOAuthTokens";

export type ExtensionStorage = {
  get: (keys: string[]) => Promise<Record<string, unknown>>;
  set: (items: Record<string, unknown>) => Promise<void>;
  remove?: (keys: string[]) => Promise<void>;
};

export async function loadOAuthClientId(storage: ExtensionStorage): Promise<string> {
  const values = await storage.get([OAUTH_CLIENT_ID_STORAGE_KEY]);
  const value = values[OAUTH_CLIENT_ID_STORAGE_KEY];
  return typeof value === "string" ? value.trim() : "";
}

export async function saveOAuthClientId(
  storage: ExtensionStorage,
  clientId: string,
): Promise<void> {
  await storage.set({ [OAUTH_CLIENT_ID_STORAGE_KEY]: clientId.trim() });
  await storage.remove?.([OAUTH_TOKENS_STORAGE_KEY]);
}
