import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, FileText, Search, BarChart3 } from "lucide-react";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = await createClient();

  const [
    { count: projectCount },
    { count: articleCount },
    { count: keywordCount },
    { data: recentArticlesRaw },
  ] = await Promise.all([
    supabase.from("projects").select("*", { count: "exact", head: true }),
    supabase.from("articles").select("*", { count: "exact", head: true }),
    supabase.from("keywords").select("*", { count: "exact", head: true }),
    supabase.from("articles").select("id, title, status, updated_at, projects(name)").order("updated_at", { ascending: false }).limit(5),
  ]);

  const recentArticles = (recentArticlesRaw ?? []) as unknown as Array<{
    id: string;
    title: string | null;
    status: string;
    updated_at: string;
    projects: { name: string } | null;
  }>;

  const statusVariant: Record<string, "success" | "info" | "warning" | "destructive" | "secondary"> = {
    published: "success",
    scheduled: "info",
    draft: "secondary",
    failed: "destructive",
    publishing: "warning",
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Your SEO overview" />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FolderIcon className="h-4 w-4" /> Projects
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{projectCount ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" /> Articles
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{articleCount ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Search className="h-4 w-4" /> Keywords
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{keywordCount ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Rankings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">—</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" /> Recent Content
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentArticles?.length ? (
              <div className="space-y-3">
                {recentArticles.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={`/content/${a.id}`} className="text-sm font-medium hover:underline truncate block">
                        {a.title ?? "Untitled"}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {(a.projects as { name: string } | null)?.name}
                      </p>
                    </div>
                    <Badge variant={statusVariant[a.status] ?? "secondary"} className="shrink-0">
                      {a.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">No articles yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/content/new" className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Generate new article</p>
                <p className="text-xs text-muted-foreground">AI-powered content creation</p>
              </div>
            </Link>
            <Link href="/keyword-research" className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors">
              <Search className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Keyword research</p>
                <p className="text-xs text-muted-foreground">Find and cluster keywords</p>
              </div>
            </Link>
            <Link href="/rank-tracking" className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Check rankings</p>
                <p className="text-xs text-muted-foreground">Track SERP positions</p>
              </div>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h4l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
    </svg>
  );
}
