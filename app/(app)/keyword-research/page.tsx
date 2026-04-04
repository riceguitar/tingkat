"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Sparkles, Save, TrendingUp, DollarSign, Target } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import type { Project } from "@/types/database";

interface KeywordResult {
  keyword: string;
  search_volume: number;
  difficulty: number;
  cpc: number;
  intent: string;
  competition: number;
  trend: number[];
}

interface Cluster {
  name: string;
  intent: string;
  color: string;
  keywords: string[];
}

export default function KeywordResearchPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [seedKeyword, setSeedKeyword] = useState("");
  const [results, setResults] = useState<KeywordResult[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [loading, setLoading] = useState(false);
  const [clustering, setClustering] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/projects").then((r) => r.json()).then((data) => {
      setProjects(data);
      if (data[0]) setProjectId(data[0].id);
    });
  }, []);

  async function handleResearch(e: React.FormEvent) {
    e.preventDefault();
    if (!seedKeyword || !projectId) return;
    setLoading(true);
    setResults([]);
    setClusters([]);
    setSelected(new Set());

    const res = await fetch("/api/keywords/research", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seedKeyword, projectId, limit: 100 }),
    });
    const data = await res.json();
    setResults(data.keywords ?? []);
    setLoading(false);
  }

  function toggleSelect(keyword: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(keyword) ? next.delete(keyword) : next.add(keyword);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === results.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(results.map((r) => r.keyword)));
    }
  }

  async function handleCluster() {
    const kws = results.filter((r) => selected.has(r.keyword));
    if (!kws.length) return;
    setClustering(true);
    const res = await fetch("/api/ai/cluster", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keywords: kws.map((k) => ({ keyword: k.keyword, volume: k.search_volume, intent: k.intent })) }),
    });
    const data = await res.json();
    setClusters(data.clusters ?? []);
    setClustering(false);
  }

  async function handleSave() {
    if (!projectId || !results.length) return;
    setSaving(true);
    const kws = results.filter((r) => selected.has(r.keyword));
    await fetch("/api/keywords", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        keywords: kws.map((k) => ({
          keyword: k.keyword,
          searchVolume: k.search_volume,
          difficulty: k.difficulty,
          cpc: k.cpc,
          intent: k.intent,
          competition: k.competition,
          trend: k.trend,
        })),
      }),
    });
    setSaving(false);
    alert(`Saved ${kws.length} keywords to project.`);
  }

  function difficultyColor(d: number) {
    if (d < 30) return "success";
    if (d < 60) return "warning";
    return "destructive";
  }

  const intentColors: Record<string, string> = {
    informational: "bg-blue-100 text-blue-700",
    commercial: "bg-purple-100 text-purple-700",
    transactional: "bg-green-100 text-green-700",
    navigational: "bg-gray-100 text-gray-700",
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Keyword Research" description="Find and cluster keywords for your content strategy" />

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleResearch} className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1.5 flex-1 min-w-48">
              <Label>Seed keyword</Label>
              <Input value={seedKeyword} onChange={(e) => setSeedKeyword(e.target.value)} placeholder="e.g. email marketing" required />
            </div>
            <div className="space-y-1.5 w-48">
              <Label>Project</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>
                  {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={loading}>
              <Search className="h-4 w-4" /> {loading ? "Researching..." : "Research"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{results.length} keywords found · {selected.size} selected</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={toggleAll}>
                {selected.size === results.length ? "Deselect all" : "Select all"}
              </Button>
              {selected.size > 0 && (
                <>
                  <Button variant="outline" size="sm" onClick={handleCluster} disabled={clustering}>
                    <Sparkles className="h-4 w-4" /> {clustering ? "Clustering..." : "AI Cluster"}
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={saving}>
                    <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save to project"}
                  </Button>
                </>
              )}
            </div>
          </div>

          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="w-8 px-4 py-3 text-left">
                      <input type="checkbox" checked={selected.size === results.length} onChange={toggleAll} className="rounded" />
                    </th>
                    <th className="px-4 py-3 text-left font-medium">Keyword</th>
                    <th className="px-4 py-3 text-right font-medium"><span className="flex items-center gap-1 justify-end"><TrendingUp className="h-3 w-3" />Volume</span></th>
                    <th className="px-4 py-3 text-right font-medium"><span className="flex items-center gap-1 justify-end"><Target className="h-3 w-3" />KD</span></th>
                    <th className="px-4 py-3 text-right font-medium"><span className="flex items-center gap-1 justify-end"><DollarSign className="h-3 w-3" />CPC</span></th>
                    <th className="px-4 py-3 text-left font-medium">Intent</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((kw) => (
                    <tr key={kw.keyword} className="border-b hover:bg-muted/30 cursor-pointer" onClick={() => toggleSelect(kw.keyword)}>
                      <td className="px-4 py-2.5">
                        <input type="checkbox" checked={selected.has(kw.keyword)} onChange={() => {}} className="rounded" />
                      </td>
                      <td className="px-4 py-2.5 font-medium">{kw.keyword}</td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground">{formatNumber(kw.search_volume)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <Badge variant={difficultyColor(kw.difficulty) as "success" | "warning" | "destructive"}>{Math.round(kw.difficulty)}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground">${kw.cpc.toFixed(2)}</td>
                      <td className="px-4 py-2.5">
                        <span className={`rounded-full px-2 py-0.5 text-xs ${intentColors[kw.intent] ?? "bg-gray-100 text-gray-700"}`}>
                          {kw.intent}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {clusters.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold">AI Clusters</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {clusters.map((cluster) => (
                  <Card key={cluster.name}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: cluster.color }} />
                        {cluster.name}
                        <span className="text-xs font-normal text-muted-foreground ml-auto">{cluster.keywords.length} kw</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground">{cluster.keywords.slice(0, 4).join(", ")}{cluster.keywords.length > 4 ? `… +${cluster.keywords.length - 4}` : ""}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
