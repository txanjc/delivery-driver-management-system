import type { SupportedStorage } from "@supabase/supabase-js";

const memoryStorage = new Map<string, string>();

function hasLocalStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export const supabaseStorage: SupportedStorage = {
  getItem(key) {
    if (hasLocalStorage()) {
      return window.localStorage.getItem(key);
    }

    return memoryStorage.get(key) ?? null;
  },
  setItem(key, value) {
    if (hasLocalStorage()) {
      window.localStorage.setItem(key, value);
      return;
    }

    memoryStorage.set(key, value);
  },
  removeItem(key) {
    if (hasLocalStorage()) {
      window.localStorage.removeItem(key);
      return;
    }

    memoryStorage.delete(key);
  },
};
