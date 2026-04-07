import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Globe, KeyRound, BarChart3, ChevronRight, Map, Users } from "lucide-react";

const sections = [
  { href: "/settings/wordpress", icon: Globe, title: "WordPress", description: "Connect your WordPress site for auto-publishing" },
  { href: "/settings/gsc", icon: BarChart3, title: "Google Search Console", description: "Connect GSC to import search analytics data" },
  { href: "/settings/sitemaps", icon: Map, title: "Sitemaps", description: "Add project sitemaps for smarter internal linking and cannibalization detection" },
  { href: "/settings/credentials", icon: KeyRound, title: "API Credentials", description: "Manage per-account DataForSEO and Anthropic API keys" },
  { href: "/settings/team", icon: Users, title: "Team", description: "Invite team members and manage account access" },
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
