import "react-native-url-polyfill/auto";

import { createClient } from "@supabase/supabase-js";
import { AppState, Platform } from "react-native";

import { environment } from "@/lib/environment";
import { supabaseStorage } from "@/lib/supabase-storage";
import type { Database } from "@/types/database";

export const supabase = createClient<Database>(
  environment.supabaseUrl,
  environment.supabasePublishableKey,
  {
    auth: {
      storage: supabaseStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") {
      void supabase.auth.startAutoRefresh();
    } else {
      void supabase.auth.stopAutoRefresh();
    }
  });
}
