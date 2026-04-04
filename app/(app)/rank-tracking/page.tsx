"use client";

import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { RefreshCw, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { format, subDays } from "date-fns";
import type { Project } from "@/types/database";

interface Snapshot {
  id: string;
  keyword_id: string;
  position: number | null;
  url: string | null;
  snapshot_date: string;
  device: string;
  keywords?: { keyword: string };
}

export default function RankTrackingPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedKeywordId, setSelectedKeywordId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/projects").then((r) => r.json()).then((data) => {
      setProjects(data);
      if (data[0]) setProjectId(data[0].id);
    });
  }, []);

  const fetchSnapshots = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    const from = format(subDays(new Date(), 30), "yyyy-MM-dd");
    const to = format(new Date(), "yyyy-MM-dd");
    const res = await fetch(`/api/rank-tracking?projectId=${projectId}&from=${from}&to=${to}`);
    const data = await res.json();
    setSnapshots(data.snapshots ?? []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetchSnapshots(); }, [fetchSnapshots]);

  async function handleRefresh() {
    setRefreshing(true);
    await fetch("/api/rank-tracking/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId }),
    });
    await fetchSnapshots();
    setRefreshing(false);
  }

  // Get unique keywords with their latest position
  const keywordMap = new Map<string, { keyword: string; positions: Snapshot[] }>();
  for (const s of snapshots) {
    const key = s.keyword_id;
    const kwName = s.keywords?.keyword ?? "Unknown";
    if (!keywordMap.has(key)) keywordMap.set(key, { keyword: kwName, positions: [] });
    keywordMap.get(key)!.positions.push(s);
  }

  const keywords = Array.from(keywordMap.entries()).map(([id, { keyword, positions }]) => {
    const sorted = positions.sort((a, b) => new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime());
    const latest = sorted[sorted.length - 1]?.position ?? null;
    const prev = sorted[sorted.length - 2]?.position ?? null;
    const change = latest != null && prev != null ? prev - latest : null;
    return { id, keyword, latest, change, positions: sorted };
  });

  const selectedKeyword = selectedKeywordId ? keywords.find((k) => k.id === selectedKeywordId) : null;
  const chartData = selectedKeyword?.positions.map((s) => ({
    date: format(new Date(s.snapshot_date), "MMM d"),
    position: s.position,
  })) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="Rank Tracking" description="Monitor your keyword positions in Google">
        <div className="flex gap-2">
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Select project" /></SelectTrigger>
            <SelectContent>
              {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleRefresh} disabled={refreshing || !projectId}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </PageHeader>

      {loading ? <TableSkeleton /> : keywords.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="No rank data yet"
          description="Add keywords to your project, then click Refresh to pull SERP positions."
          action={projectId ? { label: "Refresh now", onClick: handleRefresh } : undefined}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <Card>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">Keyword</th>
                  <th className="px-4 py-3 text-right font-medium">Position</th>
                  <th className="px-4 py-3 text-right font-medium">Change</th>
                </tr>
              </thead>
              <tbody>
                {keywords.map((kw) => (
                  <tr
                    key={kw.id}
                    className={`border-b hover:bg-muted/30 cursor-pointer ${selectedKeywordId === kw.id ? "bg-muted/50" : ""}`}
                    onClick={() => setSelectedKeywordId(kw.id === selectedKeywordId ? null : kw.id)}
                  >
                    <td className="px-4 py-2.5 font-medium">{kw.keyword}</td>
                    <td className="px-4 py-2.5 text-right">
                      {kw.latest != null ? (
                        <Badge variant={kw.latest <= 10 ? "success" : kw.latest <= 30 ? "info" : "secondary"}>
                          #{kw.latest}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {kw.change == null ? <Minus className="h-4 w-4 text-muted-foreground ml-auto" /> :
                        kw.change > 0 ? <span className="text-green-600 flex items-center justify-end gap-0.5"><TrendingUp className="h-3.5 w-3.5" />+{kw.change}</span> :
                        kw.change < 0 ? <span className="text-red-600 flex items-center justify-end gap-0.5"><TrendingDown className="h-3.5 w-3.5" />{kw.change}</span> :
                        <Minus className="h-4 w-4 text-muted-foreground ml-auto" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {selectedKeyword && chartData.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm truncate">{selectedKeyword.keyword}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis reversed domain={[1, "auto"]} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => [`#${v}`, "Position"]} />
                    <Line type="monotone" dataKey="position" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
