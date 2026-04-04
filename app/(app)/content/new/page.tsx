"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStreamGeneration } from "@/hooks/use-stream-generation";
import { Sparkles, ArrowRight, RotateCcw } from "lucide-react";
import type { Project } from "@/types/database";

const TONES = ["professional", "conversational", "authoritative", "friendly", "technical"];

export default function NewContentPage() {
  const router = useRouter();
  const { generate, streaming, content, articleId, wordCount, error, reset } = useStreamGeneration();
  const [projects, setProjects] = useState<Project[]>([]);
  const [form, setForm] = useState({ keyword: "", brief: "", tone: "professional", targetWordCount: 1500, projectId: "" });
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/projects").then((r) => r.json()).then((data) => {
      setProjects(data);
      if (data[0]) setForm((prev) => ({ ...prev, projectId: data[0].id }));
    });
  }, []);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [content]);

  function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.projectId) return;
    reset();
    generate(form);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Generate Content" description="AI-powered SEO article creation">
        {articleId && (
          <Button onClick={() => router.push(`/content/${articleId}`)}>
            Open in Editor <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        {/* Generation form */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> Generation Settings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleGenerate} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Project</Label>
                <Select value={form.projectId} onValueChange={(v) => setForm({ ...form, projectId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Target keyword</Label>
                <Input
                  value={form.keyword}
                  onChange={(e) => setForm({ ...form, keyword: e.target.value })}
                  placeholder="e.g. best email marketing tools"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label>Brief / notes</Label>
                <Textarea
                  value={form.brief}
                  onChange={(e) => setForm({ ...form, brief: e.target.value })}
                  placeholder="Key points, sections to cover, competitor URLs to beat..."
                  rows={4}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Tone</Label>
                <Select value={form.tone} onValueChange={(v) => setForm({ ...form, tone: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TONES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Target word count</Label>
                <Select value={String(form.targetWordCount)} onValueChange={(v) => setForm({ ...form, targetWordCount: parseInt(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[800, 1000, 1500, 2000, 2500, 3000].map((n) => (
                      <SelectItem key={n} value={String(n)}>{n.toLocaleString()} words</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2 pt-2">
                <Button type="submit" className="flex-1" disabled={streaming || !form.projectId}>
                  <Sparkles className="h-4 w-4" /> {streaming ? "Generating..." : "Generate"}
                </Button>
                {content && (
                  <Button type="button" variant="outline" size="icon" onClick={reset} title="Reset">
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Output */}
        <Card className="overflow-hidden">
          <CardHeader className="border-b">
            <CardTitle className="text-base flex items-center justify-between">
              <span>Article Output</span>
              {wordCount && (
                <span className="text-xs font-normal text-muted-foreground flex items-center gap-1">
                  {wordCount.toLocaleString()} words
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div
              ref={outputRef}
              className="h-[60vh] overflow-y-auto p-6 font-mono text-sm leading-relaxed whitespace-pre-wrap"
            >
              {content || (
                <p className="text-muted-foreground italic">
                  {streaming ? "Generating..." : "Fill in the form and click Generate to create your article."}
                </p>
              )}
              {streaming && <span className="inline-block h-4 w-0.5 bg-foreground animate-pulse ml-0.5" />}
            </div>
          </CardContent>
        </Card>
      </div>

      {error && (
        <p className="text-sm text-destructive">Error: {error}</p>
      )}
    </div>
  );
}
