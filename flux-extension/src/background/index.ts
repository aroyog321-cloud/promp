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
  const CORRECT_URL = "https://proenpt.vercel.app";
  const STORAGE_KEY = "promptly_settings_v1";

  if (details.reason === "install") {
    chrome.storage.local.get(STORAGE_KEY).then((res) => {
      if (!res[STORAGE_KEY]) {
        chrome.storage.local.set({
          [STORAGE_KEY]: {
            theme: "dark",
            defaultMode: "general",
            defaultLevel: "medium",
            shortcutEnabled: true,
            apiBaseUrl: CORRECT_URL,
            apiKey: "",
            contextProfile: {},
            contextInjectionEnabled: false
          }
        });
      }
    });
    chrome.tabs.create({ url: "https://proenpt.vercel.app/login" });
  }

  // Migration: fix wrong apiBaseUrl for existing installs (update or install)
  chrome.storage.local.get(STORAGE_KEY).then((res) => {
    const current = res[STORAGE_KEY];
    if (current) {
      const wrongUrls = ["https://api.promptly-optimizer.app"];
      if (!current.apiBaseUrl || wrongUrls.includes(current.apiBaseUrl)) {
        chrome.storage.local.set({
          [STORAGE_KEY]: { ...current, apiBaseUrl: CORRECT_URL }
        });
        console.log("[Promptly] Migrated apiBaseUrl to", CORRECT_URL);
      }
    }
  });
});

// Also fix wrong URL on every browser startup (not just install/update)
function migrateApiBaseUrl() {
  const CORRECT_URL = "https://proenpt.vercel.app";
  const STORAGE_KEY = "promptly_settings_v1";
  const wrongUrls = ["https://api.promptly-optimizer.app"];

  chrome.storage.local.get(STORAGE_KEY).then((res) => {
    const current = res[STORAGE_KEY];
    if (current && (!current.apiBaseUrl || wrongUrls.includes(current.apiBaseUrl))) {
      chrome.storage.local.set({ [STORAGE_KEY]: { ...current, apiBaseUrl: CORRECT_URL } });
      console.log("[Promptly] Fixed apiBaseUrl to", CORRECT_URL);
    }
  });
}

chrome.runtime.onStartup.addListener(migrateApiBaseUrl);

// BACKGROUND FETCH PROXY:
// Bypasses host-page CORS, Content Security Policy (CSP), and Private Network Access (PNA)
// by executing all API fetches from the privileged extension background context.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "PROMPTLY_BG_FETCH") {
    fetch(message.url, {
      method: message.method || "GET",
      headers: message.headers || {},
      body: message.body ? JSON.stringify(message.body) : undefined
    })
    .then(async (res) => {
      const ok = res.ok;
      const status = res.status;
      const statusText = res.statusText;
      let data = null;
      try {
        data = await res.json();
      } catch (e) {
        try {
          data = await res.text();
        } catch (e) {}
      }
      sendResponse({ ok, status, statusText, data });
    })
    .catch((error) => {
      sendResponse({ ok: false, error: error.message || String(error) });
    });
    return true; // Keep the message channel open for asynchronous response
  }
});

// BACKGROUND STREAMING PROXY:
// Connects a persistent port between the content script and background script
// to stream chunks in real-time without hitting browser sandbox blocks.
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "promptly-stream-proxy") {
    port.onMessage.addListener(async (message) => {
      if (message.type === "START_STREAM") {
        try {
          const res = await fetch(message.url, {
            method: "POST",
            headers: message.headers || {},
            body: JSON.stringify(message.body)
          });
          
          if (!res.ok) {
            let errorMsg = `Request failed with status ${res.status}`;
            try {
              const errData = await res.json();
              if (errData.error) errorMsg = errData.error;
            } catch(e){}
            port.postMessage({ type: "ERROR", status: res.status, error: errorMsg });
            return;
          }
          
          const reader = res.body?.getReader();
          if (!reader) {
            port.postMessage({ type: "ERROR", error: "No response body found" });
            return;
          }
          
          const decoder = new TextDecoder();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            port.postMessage({ type: "CHUNK", chunk });
          }
          port.postMessage({ type: "DONE" });
        } catch (e: any) {
          port.postMessage({ type: "ERROR", error: e.message || String(e) });
        }
      }
    });
  }
});

