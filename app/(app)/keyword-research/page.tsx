"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Search, Sparkles, Save, TrendingUp, DollarSign, Target,
  ChevronDown, ChevronUp, X, Trash2, FileText, CheckCircle2,
} from "lucide-react";
import { formatNumber } from "@/lib/utils";
import type { Project, KeywordCluster, Keyword } from "@/types/database";

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

type SavedCluster = KeywordCluster & { keywords: Pick<Keyword, "id" | "keyword" | "search_volume" | "difficulty" | "intent">[] };

export default function KeywordResearchPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [seedKeyword, setSeedKeyword] = useState("");
  const [results, setResults] = useState<KeywordResult[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [loading, setLoading] = useState(false);
  const [clustering, setClustering] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clustersSaved, setClustersSaved] = useState(false);
  const [expandedClusters, setExpandedClusters] = useState<Set<string>>(new Set());
  const [savedClusters, setSavedClusters] = useState<SavedCluster[]>([]);
  const [expandedSaved, setExpandedSaved] = useState<Set<string>>(new Set());
  const [deletingCluster, setDeletingCluster] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/projects").then((r) => r.json()).then((data) => {
      setProjects(data);
      if (data[0]) setProjectId(data[0].id);
    });
  }, []);

  useEffect(() => {
    if (projectId) loadSavedClusters();
  }, [projectId]);

  async function loadSavedClusters() {
    const res = await fetch(`/api/clusters?projectId=${projectId}`);
    const data = await res.json();
    setSavedClusters(Array.isArray(data) ? data : []);
  }

  async function handleResearch(e: React.FormEvent) {
    e.preventDefault();
    if (!seedKeyword || !projectId) return;
    setLoading(true);
    setResults([]);
    setClusters([]);
    setSelected(new Set());
    setClustersSaved(false);

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
    setClusters([]);
    setClustersSaved(false);
    const res = await fetch("/api/ai/cluster", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        keywords: kws.map((k) => ({ keyword: k.keyword, volume: k.search_volume, intent: k.intent })),
      }),
    });
    const data = await res.json();
    setClusters(data.clusters ?? []);
    setClustering(false);
  }

  async function handleSaveClusters() {
    if (!projectId || !clusters.length) return;
    setSaving(true);

    // 1. Create each cluster in DB, collect ids
    const clusterIdMap: Record<string, string> = {};
    for (const c of clusters) {
      const res = await fetch("/api/clusters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, name: c.name, color: c.color, intent: c.intent }),
      });
      const saved = await res.json();
      clusterIdMap[c.name] = saved.id;
    }

    // 2. Build keyword → clusterId map
    const kwToClusterId: Record<string, string> = {};
    for (const c of clusters) {
      for (const kw of c.keywords) {
        kwToClusterId[kw] = clusterIdMap[c.name];
      }
    }

    // 3. Save all selected keywords with cluster assignments
    const selectedResults = results.filter((r) => selected.has(r.keyword));
    await fetch("/api/keywords", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        keywords: selectedResults.map((k) => ({
          keyword: k.keyword,
          clusterId: kwToClusterId[k.keyword] ?? null,
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
    setClustersSaved(true);
    loadSavedClusters();
  }

  async function handleSaveKeywords() {
    if (!projectId || !selected.size) return;
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

  function removeKeywordFromCluster(clusterName: string, keyword: string) {
    setClusters((prev) =>
      prev.map((c) =>
        c.name === clusterName ? { ...c, keywords: c.keywords.filter((k) => k !== keyword) } : c
      )
    );
  }

  function toggleClusterExpand(name: string) {
    setExpandedClusters((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }

  function toggleSavedExpand(id: string) {
    setExpandedSaved((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleDeleteCluster(id: string) {
    setDeletingCluster(id);
    await fetch(`/api/clusters/${id}`, { method: "DELETE" });
    setSavedClusters((prev) => prev.filter((c) => c.id !== id));
    setDeletingCluster(null);
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

  // Map keyword → cluster for table row coloring
  const keywordToCluster = useMemo(() => {
    const map = new Map<string, Cluster>();
    clusters.forEach((c) => c.keywords.forEach((kw) => map.set(kw, c)));
    return map;
  }, [clusters]);

  return (
    <div className="space-y-6">
      <PageHeader title="Keyword Research" description="Find and cluster keywords for your content strategy" />

      {/* Search form */}
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

      {/* Research results */}
      {results.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm text-muted-foreground">{results.length} keywords found · {selected.size} selected</p>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={toggleAll}>
                {selected.size === results.length ? "Deselect all" : "Select all"}
              </Button>
              {selected.size > 0 && (
                <>
                  <Button variant="outline" size="sm" onClick={handleCluster} disabled={clustering}>
                    <Sparkles className="h-4 w-4" /> {clustering ? "Clustering..." : "AI Cluster"}
                  </Button>
                  {clusters.length === 0 && (
                    <Button size="sm" onClick={handleSaveKeywords} disabled={saving}>
                      <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save to project"}
                    </Button>
                  )}
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
                      <input type="checkbox" checked={selected.size === results.length && results.length > 0} onChange={toggleAll} className="rounded" />
                    </th>
                    <th className="px-4 py-3 text-left font-medium">Keyword</th>
                    <th className="px-4 py-3 text-right font-medium"><span className="flex items-center gap-1 justify-end"><TrendingUp className="h-3 w-3" />Volume</span></th>
                    <th className="px-4 py-3 text-right font-medium"><span className="flex items-center gap-1 justify-end"><Target className="h-3 w-3" />KD</span></th>
                    <th className="px-4 py-3 text-right font-medium"><span className="flex items-center gap-1 justify-end"><DollarSign className="h-3 w-3" />CPC</span></th>
                    <th className="px-4 py-3 text-left font-medium">Intent</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((kw) => {
                    const clusterMatch = keywordToCluster.get(kw.keyword);
                    return (
                      <tr
                        key={kw.keyword}
                        className="border-b hover:bg-muted/30 cursor-pointer"
                        onClick={() => toggleSelect(kw.keyword)}
                        style={clusterMatch ? { borderLeft: `3px solid ${clusterMatch.color}` } : undefined}
                      >
                        <td className="px-4 py-2.5">
                          <input type="checkbox" checked={selected.has(kw.keyword)} onChange={() => {}} className="rounded" />
                        </td>
                        <td className="px-4 py-2.5 font-medium">
                          <span className="flex items-center gap-2">
                            {clusterMatch && (
                              <span
                                className="h-2 w-2 rounded-full shrink-0"
                                style={{ backgroundColor: clusterMatch.color }}
                                title={clusterMatch.name}
                              />
                            )}
                            {kw.keyword}
                          </span>
                        </td>
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* AI Cluster cards */}
          {clusters.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">AI Clusters</h3>
                {!clustersSaved ? (
                  <Button size="sm" onClick={handleSaveClusters} disabled={saving}>
                    <Save className="h-4 w-4" /> {saving ? "Saving clusters..." : "Save clusters + keywords"}
                  </Button>
                ) : (
                  <span className="flex items-center gap-1 text-sm text-green-600 font-medium">
                    <CheckCircle2 className="h-4 w-4" /> Clusters saved
                  </span>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {clusters.map((cluster) => {
                  const isExpanded = expandedClusters.has(cluster.name);
                  const displayKeywords = isExpanded ? cluster.keywords : cluster.keywords.slice(0, 6);
                  return (
                    <Card key={cluster.name} className="overflow-hidden">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: cluster.color }} />
                          <span className="flex-1 min-w-0 truncate">{cluster.name}</span>
                          <span className="text-xs font-normal text-muted-foreground shrink-0">{cluster.keywords.length} kw</span>
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-xs ${intentColors[cluster.intent] ?? "bg-gray-100 text-gray-700"}`}>
                            {cluster.intent}
                          </span>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex flex-wrap gap-1">
                          {displayKeywords.map((kw) => (
                            <span
                              key={kw}
                              className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"
                            >
                              {kw}
                              <button
                                onClick={() => removeKeywordFromCluster(cluster.name, kw)}
                                className="text-muted-foreground hover:text-destructive ml-0.5"
                                title="Remove from cluster"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                          {!isExpanded && cluster.keywords.length > 6 && (
                            <span className="text-xs text-muted-foreground py-0.5">+{cluster.keywords.length - 6} more</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between pt-1">
                          {cluster.keywords.length > 6 && (
                            <button
                              onClick={() => toggleClusterExpand(cluster.name)}
                              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                            >
                              {isExpanded ? <><ChevronUp className="h-3 w-3" /> Show less</> : <><ChevronDown className="h-3 w-3" /> Show all</>}
                            </button>
                          )}
                          <div className="ml-auto">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => {
                                const params = new URLSearchParams({
                                  clusterName: cluster.name,
                                  keywords: cluster.keywords.join(","),
                                });
                                router.push(`/content/new?${params.toString()}`);
                              }}
                            >
                              <FileText className="h-3 w-3" /> Generate article
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Saved Clusters panel */}
      {savedClusters.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-base">Saved Clusters</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {savedClusters.map((cluster) => {
              const isExpanded = expandedSaved.has(cluster.id);
              const kws = cluster.keywords ?? [];
              const displayKws = isExpanded ? kws : kws.slice(0, 6);
              return (
                <Card key={cluster.id} className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: cluster.color }} />
                      <span className="flex-1 min-w-0 truncate">{cluster.name}</span>
                      <span className="text-xs font-normal text-muted-foreground shrink-0">{kws.length} kw</span>
                    </CardTitle>
                    {cluster.intent && (
                      <span className={`w-fit rounded-full px-2 py-0.5 text-xs ${intentColors[cluster.intent] ?? "bg-gray-100 text-gray-700"}`}>
                        {cluster.intent}
                      </span>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex flex-wrap gap-1">
                      {displayKws.map((kw) => (
                        <span key={kw.id} className="rounded-full bg-muted px-2 py-0.5 text-xs">{kw.keyword}</span>
                      ))}
                      {!isExpanded && kws.length > 6 && (
                        <span className="text-xs text-muted-foreground py-0.5">+{kws.length - 6} more</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      {kws.length > 6 && (
                        <button
                          onClick={() => toggleSavedExpand(cluster.id)}
                          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                        >
                          {isExpanded ? <><ChevronUp className="h-3 w-3" /> Show less</> : <><ChevronDown className="h-3 w-3" /> Show all</>}
                        </button>
                      )}
                      <div className="ml-auto flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => {
                            const params = new URLSearchParams({
                              clusterId: cluster.id,
                              clusterName: cluster.name,
                              keywords: kws.map((k) => k.keyword).join(","),
                            });
                            router.push(`/content/new?${params.toString()}`);
                          }}
                        >
                          <FileText className="h-3 w-3" /> Generate article
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          disabled={deletingCluster === cluster.id}
                          onClick={() => handleDeleteCluster(cluster.id)}
                          title="Delete cluster"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
