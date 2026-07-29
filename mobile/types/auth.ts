import type { Session, User } from "@supabase/supabase-js";

import type { Driver, Profile } from "@/types/driver";

export type AuthState = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  driver: Driver | null;
  loading: boolean;
  mfaRequired: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<{ requiresMfa: boolean }>;
  signOut: () => Promise<void>;
  verifyMfa: (code: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
};
