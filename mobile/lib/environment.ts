type PublicEnvironment = {
  supabaseUrl: string;
  supabasePublishableKey: string;
  googleMapsApiKey?: string;
};

function requirePublicEnv(
  name: string,
  value: string | undefined,
): string {
  if (!value) {
    throw new Error(`Missing required mobile environment variable: ${name}`);
  }

  return value;
}

export const environment: PublicEnvironment = {
  supabaseUrl: requirePublicEnv(
    "EXPO_PUBLIC_SUPABASE_URL",
    process.env.EXPO_PUBLIC_SUPABASE_URL,
  ),
  supabasePublishableKey: requirePublicEnv(
    "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  ),
  googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
};