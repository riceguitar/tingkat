import { google } from "googleapis";
import { encrypt, decrypt } from "@/lib/encryption";

export function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

export function getAuthUrl(state: string): string {
  const oauth2Client = createOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/webmasters.readonly"],
    state,
  });
}

export interface TokenData {
  access_token: string;
  refresh_token: string;
  expires_at: Date;
}

export async function exchangeCodeForTokens(code: string): Promise<TokenData> {
  const oauth2Client = createOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error("Missing tokens in OAuth response");
  }

  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: new Date(tokens.expiry_date ?? Date.now() + 3600 * 1000),
  };
}

export function encryptTokens(tokenData: TokenData): {
  encrypted_access: string;
  encrypted_refresh: string;
  iv: string;
  auth_tag: string;
} {
  const combined = JSON.stringify({
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
  });
  const enc = encrypt(combined);
  return {
    encrypted_access: enc.ciphertext,
    encrypted_refresh: "",
    iv: enc.iv,
    auth_tag: enc.authTag,
  };
}

export function decryptTokens(
  ciphertext: string,
  iv: string,
  authTag: string
): { access_token: string; refresh_token: string } {
  const json = decrypt(ciphertext, iv, authTag);
  return JSON.parse(json);
}

export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expires_at: Date;
}> {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await oauth2Client.refreshAccessToken();

  if (!credentials.access_token) {
    throw new Error("Failed to refresh access token");
  }

  return {
    access_token: credentials.access_token,
    expires_at: new Date(credentials.expiry_date ?? Date.now() + 3600 * 1000),
  };
}

export interface GscRow {
  query: string;
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  date: string;
}

export async function getSearchAnalytics(
  accessToken: string,
  siteUrl: string,
  startDate: string,
  endDate: string
): Promise<GscRow[]> {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });

  const sc = google.webmasters({ version: "v3", auth: oauth2Client });

  const res = await sc.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate,
      endDate,
      dimensions: ["query", "page", "date"],
      rowLimit: 25000,
    },
  });

  return (res.data.rows ?? []).map((row) => ({
    query: row.keys?.[0] ?? "",
    page: row.keys?.[1] ?? "",
    date: row.keys?.[2] ?? "",
    clicks: row.clicks ?? 0,
    impressions: row.impressions ?? 0,
    ctr: row.ctr ?? 0,
    position: row.position ?? 0,
  }));
}

export async function listGscProperties(accessToken: string): Promise<string[]> {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });

  const sc = google.webmasters({ version: "v3", auth: oauth2Client });
  const res = await sc.sites.list();

  return (res.data.siteEntry ?? []).map((s) => s.siteUrl ?? "").filter(Boolean);
}
