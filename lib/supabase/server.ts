import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Once you've connected a Supabase project, run:
//   npx supabase gen types typescript --project-id <id> > types/database.ts
// and pass `Database` as the generic to enable full type safety.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component — cookies can't be set; middleware handles refresh
          }
        },
      },
    }
  );
}
