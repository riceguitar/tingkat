"use client";

import { useState, useEffect, use } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageSkeleton } from "@/components/shared/loading-skeleton";
import { Save, Send, ExternalLink, Calendar, Globe } from "lucide-react";
import { format } from "date-fns";
import type { Article } from "@/types/database";

const MilkdownEditor = dynamic(
  () => import("@/components/editor/milkdown-editor").then((m) => m.MilkdownEditor),
  { ssr: false, loading: () => <div className="min-h-[500px] rounded-md border bg-muted/30 animate-pulse" /> }
);

const STATUS_VARIANTS: Record<string, "success" | "info" | "warning" | "destructive" | "secondary"> = {
  published: "success", scheduled: "info", draft: "secondary", failed: "destructive", publishing: "warning",
};

export default function ArticleEditorPage({ params }: { params: Promise<{ articleId: string }> }) {
  const { articleId } = use(params);
  const router = useRouter();
  const [article, setArticle] = useState<Article | null>(null);
  const [form, setForm] = useState({ title: "", meta_description: "", content: "", slug: "", featured_image_url: "", scheduled_at: "" });
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishDialog, setPublishDialog] = useState(false);
  const [error, setError] = useState("");
  const [editorReady, setEditorReady] = useState(false);

  useEffect(() => {
    fetch(`/api/articles/${articleId}`)
      .then((r) => r.json())
      .then((data: Article) => {
        setArticle(data);
        setForm({
          title: data.title ?? "",
          meta_description: data.meta_description ?? "",
          content: data.content ?? "",
          slug: data.slug ?? "",
          featured_image_url: data.featured_image_url ?? "",
          scheduled_at: data.scheduled_at ? format(new Date(data.scheduled_at), "yyyy-MM-dd'T'HH:mm") : "",
        });
        setEditorReady(true);
      });
  }, [articleId]);

  async function handleSave() {
    setSaving(true);
    const res = await fetch(`/api/articles/${articleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        meta_description: form.meta_description,
        content: form.content,
        slug: form.slug,
        featured_image_url: form.featured_image_url || null,
        scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
      }),
    });
    const data = await res.json();
    if (res.ok) setArticle(data);
    setSaving(false);
  }

  async function handlePublish(immediate: boolean) {
    setPublishing(true);
    setError("");
    const res = await fetch(`/api/articles/${articleId}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: article?.project_id, immediate }),
    });
    const data = await res.json();
    if (data.success) {
      setArticle((prev) => prev ? { ...prev, status: "published", wordpress_post_url: data.wordpressUrl } : prev);
      setPublishDialog(false);
    } else {
      setError(data.error ?? "Publish failed");
    }
    setPublishing(false);
  }

  async function handleSchedule() {
    if (!form.scheduled_at) return;
    await handleSave();
    const res = await fetch(`/api/articles/${articleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "scheduled", scheduled_at: new Date(form.scheduled_at).toISOString() }),
    });
    const data = await res.json();
    if (res.ok) setArticle(data);
  }

  if (!article) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <PageHeader title={form.title || "Untitled"}>
        <div className="flex items-center gap-2">
          <Badge variant={STATUS_VARIANTS[article.status] ?? "secondary"}>{article.status}</Badge>
          {article.wordpress_post_url && (
            <a href={article.wordpress_post_url} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm"><ExternalLink className="h-4 w-4" /> View post</Button>
            </a>
          )}
          <Button variant="outline" onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save"}
          </Button>
          {article.status !== "published" && (
            <Button onClick={() => setPublishDialog(true)}>
              <Send className="h-4 w-4" /> Publish
            </Button>
          )}
        </div>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        {/* Main editor */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Article title"
              className="text-lg font-medium"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Content</Label>
            {editorReady && (
              <MilkdownEditor
                key={articleId}
                value={form.content}
                onChange={(md) => setForm((f) => ({ ...f, content: md }))}
                placeholder="Start writing your article..."
                minHeight="600px"
              />
            )}
          </div>
        </div>

        {/* Metadata sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">SEO Metadata</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">URL Slug</Label>
                <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="url-slug" className="text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Meta Description</Label>
                <Textarea value={form.meta_description} onChange={(e) => setForm({ ...form, meta_description: e.target.value })} rows={3} className="text-xs" placeholder="160 char description..." />
                <p className="text-xs text-muted-foreground text-right">{form.meta_description.length}/160</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Schedule</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Publish date</Label>
                <Input type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} className="text-xs" />
              </div>
              {form.scheduled_at && article.status === "draft" && (
                <Button size="sm" variant="outline" className="w-full" onClick={handleSchedule}>
                  <Calendar className="h-3.5 w-3.5" /> Schedule
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1"><Globe className="h-3.5 w-3.5" /> WordPress</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Featured Image URL</Label>
                <Input value={form.featured_image_url} onChange={(e) => setForm({ ...form, featured_image_url: e.target.value })} placeholder="https://..." className="text-xs" />
              </div>
              {article.actual_word_count && (
                <p className="text-xs text-muted-foreground">{article.actual_word_count.toLocaleString()} words</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={publishDialog} onOpenChange={setPublishDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Publish to WordPress</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This will publish "{form.title}" to your connected WordPress site.</p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPublishDialog(false)}>Cancel</Button>
            <Button onClick={() => handlePublish(true)} disabled={publishing}>
              <Send className="h-4 w-4" /> {publishing ? "Publishing..." : "Publish now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
