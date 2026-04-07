import type { SupabaseClient } from "@supabase/supabase-js";
import { decrypt } from "@/lib/encryption";

export interface AccountCredentials {
  dataforseoLogin: string;
  dataforseoApiKey: string;
  anthropicApiKey: string;
}

/**
 * Resolves API credentials for the account that owns the given project.
 * Falls back to environment variables so David's own projects (which have no
 * stored credentials) continue to work without any setup.
 */
export async function getCredentialsByProject(
  supabase: SupabaseClient,
  projectId: string
): Promise<AccountCredentials> {
  if (!projectId) throw new Error("projectId is required to resolve credentials");

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("account_id")
    .eq("id", projectId)
    .single();

  if (projectError || !project?.account_id) {
    // Pre-migration or project not found — fall back to env vars entirely
    return envFallback();
  }

  const { data: rows } = await supabase
    .from("account_credentials")
    .select("key, encrypted_value, iv, auth_tag")
    .eq("account_id", project.account_id);

  const stored: Record<string, string> = {};
  for (const row of rows ?? []) {
    try {
      stored[row.key] = decrypt(row.encrypted_value, row.iv, row.auth_tag);
    } catch {
      // Decryption failure — skip this key and fall back to env var
    }
  }

  return {
    dataforseoLogin:  stored["dataforseo_login"]  || process.env.DATAFORSEO_LOGIN  || "",
    dataforseoApiKey: stored["dataforseo_api_key"] || process.env.DATAFORSEO_API_KEY || "",
    anthropicApiKey:  stored["anthropic_api_key"]  || process.env.ANTHROPIC_API_KEY  || "",
  };
}

function envFallback(): AccountCredentials {
  return {
    dataforseoLogin:  process.env.DATAFORSEO_LOGIN  || "",
    dataforseoApiKey: process.env.DATAFORSEO_API_KEY || "",
    anthropicApiKey:  process.env.ANTHROPIC_API_KEY  || "",
  };
}
