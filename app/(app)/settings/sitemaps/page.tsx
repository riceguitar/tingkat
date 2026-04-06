"use client";

import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trash2, RefreshCw, Plus, Map, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { useProject } from "@/lib/context/project-context";

interface Sitemap {
  id: string;
  url: string;
  last_crawled_at: string | null;
  page_count: number;
  created_at: string;
}

export default function SitemapsSettingsPage() {
  const { projects, projectId: contextProjectId } = useProject();
  const [projectId, setProjectId] = useState(contextProjectId);
  const [sitemaps, setSitemaps] = useState<Sitemap[]>([]);
  const [newUrl, setNewUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [crawling, setCrawling] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [samplePages, setSamplePages] = useState<Record<string, Array<{ url: string; title: string | null }>>>({});

  useEffect(() => {
    if (!projectId && contextProjectId) setProjectId(contextProjectId);
  }, [contextProjectId]);

  const loadSitemaps = useCallback(async () => {
    if (!projectId) return;
    const res = await fetch(`/api/projects/${projectId}/sitemaps`);
    const data = await res.json();
    setSitemaps(Array.isArray(data) ? data : []);
  }, [projectId]);

  useEffect(() => {
    loadSitemaps();
  }, [loadSitemaps]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newUrl.trim() || !projectId) return;
    setAdding(true);
    const res = await fetch(`/api/projects/${projectId}/sitemaps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: newUrl.trim() }),
    });
    if (res.ok) {
      setNewUrl("");
      await loadSitemaps();
    }
    setAdding(false);
  }

  async function handleCrawl(sitemapId: string) {
    setCrawling(sitemapId);
    const res = await fetch(`/api/projects/${projectId}/sitemaps/${sitemapId}/crawl`, { method: "POST" });
    if (res.ok) {
      await loadSitemaps();
      // Load sample pages
      const pagesRes = await fetch(`/api/projects/${projectId}/sitemaps/pages?limit=5`);
      if (pagesRes.ok) {
        const pages = await pagesRes.json();
        setSamplePages((prev) => ({ ...prev, [sitemapId]: pages }));
      }
    }
    setCrawling(null);
  }

  async function handleDelete(sitemapId: string) {
    setDeleting(sitemapId);
    await fetch(`/api/projects/${projectId}/sitemaps/${sitemapId}`, { method: "DELETE" });
    setSitemaps((prev) => prev.filter((s) => s.id !== sitemapId));
    setDeleting(null);
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Sitemaps"
        description="Add your project's sitemaps to enable smarter internal linking and cannibalization detection"
      />

      {/* Project selector */}
      <div className="space-y-1.5 max-w-xs">
        <Label>Project</Label>
        <Select value={projectId} onValueChange={setProjectId}>
          <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
          <SelectContent>
            {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {projectId && (
        <>
          {/* Add sitemap */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Map className="h-4 w-4" /> Add Sitemap URL
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAdd} className="flex gap-2">
                <Input
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://example.com/sitemap.xml"
                  className="flex-1"
                />
                <Button type="submit" disabled={adding || !newUrl.trim()}>
                  <Plus className="h-4 w-4" /> Add
                </Button>
              </form>
              <p className="text-xs text-muted-foreground mt-2">
                Supports sitemap index files. Paste the full URL to any sitemap XML file.
              </p>
            </CardContent>
          </Card>

          {/* Sitemaps list */}
          {sitemaps.length > 0 ? (
            <div className="space-y-3">
              {sitemaps.map((sitemap) => (
                <Card key={sitemap.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <a
                            href={sitemap.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium hover:underline truncate max-w-xs flex items-center gap-1"
                          >
                            {sitemap.url}
                            <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                          </a>
                          {sitemap.last_crawled_at ? (
                            <Badge variant="success">{sitemap.page_count} pages</Badge>
                          ) : (
                            <Badge variant="secondary">Not crawled</Badge>
                          )}
                        </div>
                        {sitemap.last_crawled_at && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Last crawled {format(new Date(sitemap.last_crawled_at), "MMM d, yyyy 'at' h:mm a")}
                          </p>
                        )}
                        {samplePages[sitemap.id]?.length > 0 && (
                          <div className="mt-2 space-y-0.5">
                            {samplePages[sitemap.id].map((p) => (
                              <p key={p.url} className="text-xs text-muted-foreground truncate">
                                • {p.title ?? p.url}
                              </p>
                            ))}
                            <p className="text-xs text-muted-foreground italic">…and {sitemap.page_count - samplePages[sitemap.id].length} more</p>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8"
                          disabled={crawling === sitemap.id}
                          onClick={() => handleCrawl(sitemap.id)}
                        >
                          <RefreshCw className={`h-3.5 w-3.5 ${crawling === sitemap.id ? "animate-spin" : ""}`} />
                          {crawling === sitemap.id ? "Crawling…" : sitemap.last_crawled_at ? "Re-crawl" : "Crawl"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                          disabled={deleting === sitemap.id}
                          onClick={() => handleDelete(sitemap.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-10 text-center">
                <Map className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No sitemaps added yet.</p>
                <p className="text-xs text-muted-foreground mt-1">Add a sitemap URL above to get started.</p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
