"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { Plus, FileText, ExternalLink, MousePointerClick, FlaskConical, MapPin } from "lucide-react";
import { format } from "date-fns";
import type { Article } from "@/types/database";
import { useProject } from "@/lib/context/project-context";

const STATUS_VARIANTS: Record<string, "success" | "info" | "warning" | "destructive" | "secondary"> = {
  published: "success", scheduled: "info", draft: "secondary", failed: "destructive", publishing: "warning",
};

export default function ContentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { projectId: contextProjectId, project } = useProject();
  const projectId = searchParams.get("projectId") ?? contextProjectId;

  const [articles, setArticles] = useState<(Article & { projects?: { name: string } })[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [gscPerf, setGscPerf] = useState<Record<string, { clicks: number; impressions: number; position: number }>>({});

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (projectId) params.set("projectId", projectId);
    const res = await fetch(`/api/articles?${params}`);
    const data = await res.json();
    setArticles(data.articles ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);

    // Load GSC performance for published articles
    if (projectId) {
      fetch(`/api/gsc/performance?projectId=${projectId}&days=28`)
        .then((r) => r.json())
        .then((perf) => {
          if (perf.byKeyword) setGscPerf(perf.byKeyword);
        })
        .catch(() => {});
    }
  }, [page, statusFilter]);

  useEffect(() => { fetchArticles(); }, [fetchArticles, projectId]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={project ? `${project.name} — Content` : "Content"}
        description={`${total} article${total !== 1 ? "s" : ""}`}
      >
        <Button variant="outline" onClick={() => router.push("/content/service-area")}>
          <MapPin className="h-4 w-4" /> Service Area Pages
        </Button>
        <Button onClick={() => router.push(`/content/new${projectId ? `?projectId=${projectId}` : ""}`)}>
          <Plus className="h-4 w-4" /> Generate Article
        </Button>
      </PageHeader>

      <div className="flex gap-3">
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <TableSkeleton />
      ) : articles.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No articles yet"
          description="Generate your first AI-powered SEO article."
          action={{ label: "Generate article", onClick: () => router.push(`/content/new${projectId ? `?projectId=${projectId}` : ""}`) }}
        />
      ) : (
        <Card>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Title</th>
                <th className="px-4 py-3 text-left font-medium">Project</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Scheduled</th>
                <th className="px-4 py-3 text-left font-medium">Updated</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {articles.map((a) => (
                <tr key={a.id} className="border-b hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link href={`/content/${a.id}`} className="font-medium hover:underline">
                      {a.title ?? "Untitled"}
                    </Link>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {a.actual_word_count && (
                        <span className="text-xs text-muted-foreground">{a.actual_word_count.toLocaleString()} words</span>
                      )}
                      {a.status === "published" && a.primary_keyword && gscPerf[a.primary_keyword] && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MousePointerClick className="h-3 w-3" />
                          {gscPerf[a.primary_keyword].clicks} clicks · #{Math.round(gscPerf[a.primary_keyword].position * 10) / 10} · {gscPerf[a.primary_keyword].impressions.toLocaleString()} impr
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{(a.projects as { name: string } | null)?.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANTS[a.status] ?? "secondary"}>{a.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {a.scheduled_at ? format(new Date(a.scheduled_at), "MMM d, yyyy") : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {format(new Date(a.updated_at), "MMM d")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/content/research?articleId=${a.id}${projectId ? `&projectId=${projectId}` : ""}${a.primary_keyword ? `&primaryKeyword=${encodeURIComponent(a.primary_keyword)}` : ""}`}
                        title="View / run research pipeline"
                      >
                        <FlaskConical className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                      </Link>
                      {a.wordpress_post_url && (
                        <a href={a.wordpress_post_url} target="_blank" rel="noopener noreferrer" title="View on WordPress">
                          <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {total > 20 && (
            <div className="flex items-center justify-center gap-2 p-4 border-t">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button>
              <span className="text-sm text-muted-foreground">Page {page}</span>
              <Button variant="outline" size="sm" disabled={page * 20 >= total} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
