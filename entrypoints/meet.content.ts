export default defineContentScript({
  matches: ["https://meet.google.com/*"],
  runAt: "document_start",
  main() {
    // Meet DOM監視とフローティングUIは次の作業単位で追加する。
  },
});
