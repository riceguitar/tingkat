import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, XCircle } from "lucide-react";

const keys = [
  { name: "DataForSEO Login", env: "DATAFORSEO_LOGIN", description: "Required for keyword research and rank tracking" },
  { name: "DataForSEO API Key", env: "DATAFORSEO_API_KEY", description: "Required for keyword research and rank tracking" },
  { name: "GCP Project ID", env: "GOOGLE_CLOUD_PROJECT", description: "Required for Gemini AI (Vertex AI)" },
  { name: "GCP Service Account JSON", env: "GOOGLE_APPLICATION_CREDENTIALS_JSON", description: "Required for Gemini AI (Vertex AI)" },
  { name: "Google Client ID", env: "GOOGLE_CLIENT_ID", description: "Required for Google Search Console OAuth" },
  { name: "Google Client Secret", env: "GOOGLE_CLIENT_SECRET", description: "Required for Google Search Console OAuth" },
  { name: "App Encryption Secret", env: "APP_ENCRYPTION_SECRET", description: "Required for encrypting stored credentials (32 bytes hex)" },
  { name: "Cron Secret", env: "CRON_SECRET", description: "Required for securing Vercel Cron job endpoints" },
  { name: "Supabase URL", env: "NEXT_PUBLIC_SUPABASE_URL", description: "Your Supabase project URL" },
  { name: "Supabase Anon Key", env: "NEXT_PUBLIC_SUPABASE_ANON_KEY", description: "Supabase public anon key" },
];

export default function ApiKeysPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="API Keys" description="Status of configured environment variables" />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground">
            API keys are configured via environment variables — edit your <code className="text-xs bg-muted px-1 py-0.5 rounded">.env.local</code> file to update them.
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {keys.map((key) => {
              const isSet = !!process.env[key.env];
              return (
                <div key={key.env} className="flex items-center justify-between gap-4 py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{key.name}</p>
                    <p className="text-xs text-muted-foreground">{key.description}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isSet ? (
                      <><CheckCircle className="h-4 w-4 text-green-600" /><span className="text-xs text-green-600">Set</span></>
                    ) : (
                      <><XCircle className="h-4 w-4 text-red-500" /><span className="text-xs text-red-500">Not set</span></>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
