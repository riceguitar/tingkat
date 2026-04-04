import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Globe, KeyRound, BarChart3, ChevronRight } from "lucide-react";

const sections = [
  { href: "/settings/wordpress", icon: Globe, title: "WordPress", description: "Connect your WordPress site for auto-publishing" },
  { href: "/settings/gsc", icon: BarChart3, title: "Google Search Console", description: "Connect GSC to import search analytics data" },
  { href: "/settings/api-keys", icon: KeyRound, title: "API Keys", description: "View status of configured API keys" },
];

export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="Settings" />

      <div className="space-y-3">
        {sections.map(({ href, icon: Icon, title, description }) => (
          <Link key={href} href={href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-sm">{title}</CardTitle>
                      <CardDescription className="text-xs">{description}</CardDescription>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
