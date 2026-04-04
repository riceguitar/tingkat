import { createBrowserClient } from "@supabase/ssr";

// Once you've connected a Supabase project, run:
//   npx supabase gen types typescript --project-id <id> > types/database.ts
// and pass `Database` as the generic to enable full type safety.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
