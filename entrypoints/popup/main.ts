import { loadOAuthClientId, saveOAuthClientId } from "../../src/settings/drive-oauth";

const form = document.querySelector<HTMLFormElement>("#oauth-form");
const input = document.querySelector<HTMLInputElement>("#client-id");
const status = document.querySelector<HTMLElement>("#status");

if (form && input && status) {
  loadOAuthClientId(browser.storage.local)
    .then((clientId) => {
      if (clientId)
        status.textContent = "OAuth Client IDは保存済みです。再入力すると更新できます。";
    })
    .catch(() => {
      status.textContent = "設定を読み込めませんでした。";
    });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const clientId = input.value.trim();
    void saveOAuthClientId(browser.storage.local, clientId)
      .then(() => {
        input.value = "";
        status.textContent = clientId
          ? "OAuth Client IDを保存しました。"
          : "OAuth Client IDを削除しました。";
      })
      .catch(() => {
        status.textContent = "OAuth Client IDを保存できませんでした。";
      });
  });
}
