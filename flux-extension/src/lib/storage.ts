import { DEFAULT_SETTINGS, PromptlySettings } from '@promptly/types';

const STORAGE_KEY = "promptly_settings_v1";

export async function getSettings(): Promise<PromptlySettings> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const stored = result[STORAGE_KEY] as Partial<PromptlySettings> | undefined;
  return { ...DEFAULT_SETTINGS, ...stored, contextProfile: { ...DEFAULT_SETTINGS.contextProfile, ...(stored?.contextProfile ?? {}) } };
}

export async function setSettings(partial: Partial<PromptlySettings>): Promise<PromptlySettings> {
  const current = await getSettings();
  const next: PromptlySettings = {
    ...current,
    ...partial,
    contextProfile: { ...current.contextProfile, ...(partial.contextProfile ?? {}) }
  };
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
  
  // Background Sync
  if (next.accessToken && next.apiBaseUrl && partial.contextProfile) {
    const endpoint = `${next.apiBaseUrl.replace(/\/$/, "")}/api/contexts`;
    fetch(endpoint, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${next.accessToken}`
      },
      body: JSON.stringify({ contextProfile: next.contextProfile })
    }).catch(err => console.error("Failed to sync context to server:", err));
  }

  return next;
}

export function onSettingsChanged(callback: (settings: PromptlySettings) => void): () => void {
  const listener = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
    if (area === "local" && changes[STORAGE_KEY]) {
      const newValue = changes[STORAGE_KEY].newValue;
      callback({
        ...DEFAULT_SETTINGS,
        ...newValue,
        contextProfile: { ...DEFAULT_SETTINGS.contextProfile, ...(newValue?.contextProfile ?? {}) }
      });
    }
  };
  chrome.storage.onChanged.addListener(listener);
  // Return cleanup so callers (e.g. React useEffect) can remove the listener on unmount.
  // Previously this returned void, causing listeners to stack up indefinitely.
  return () => chrome.storage.onChanged.removeListener(listener);
}
