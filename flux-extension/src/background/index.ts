chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "optimize-prompt" && command !== "auto-optimize-prompt") return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  const type = command === "auto-optimize-prompt" ? "PROMPTLY_TRIGGER_AUTO_OPTIMIZE" : "PROMPTLY_TRIGGER_OPTIMIZE";
  chrome.tabs.sendMessage(tab.id, { type }).catch(() => {
    // content script not present on this page (unsupported site) - ignore
  });
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.storage.local.get("promptly_settings_v1").then((res) => {
      if (!res.promptly_settings_v1) {
        chrome.storage.local.set({
          promptly_settings_v1: {
            theme: "dark",
            defaultMode: "auto",
            defaultLevel: "medium",
            shortcutEnabled: true,
            apiBaseUrl: "https://api.promptly-optimizer.app",
            apiKey: "",
            contextProfile: {},
            contextInjectionEnabled: false
          }
        });
      }
    });
  }
});
