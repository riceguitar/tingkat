"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { RefreshCw, TrendingUp, TrendingDown, Minus, MousePointerClick, Eye, MapPin } from "lucide-react";
import { format, subDays } from "date-fns";
import { useProject } from "@/lib/context/project-context";

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
  const searchParams = useSearchParams();
  const { projectId: contextProjectId, project } = useProject();
  const projectId = searchParams.get("projectId") ?? contextProjectId;

  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [localPackMap, setLocalPackMap] = useState<Map<string, { position: number | null; pack_present: boolean }>>(new Map());
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedKeywordId, setSelectedKeywordId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"rankings" | "gsc">("rankings");
  const [gscPerf, setGscPerf] = useState<{
    topQueries: Array<{ query: string; clicks: number; impressions: number; ctr: number; position: number }>;
    byKeyword: Record<string, { clicks: number; impressions: number; position: number }>;
  } | null>(null);

  const fetchSnapshots = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    const from = format(subDays(new Date(), 30), "yyyy-MM-dd");
    const to = format(new Date(), "yyyy-MM-dd");
    const [rankRes, gscRes] = await Promise.all([
      fetch(`/api/rank-tracking?projectId=${projectId}&from=${from}&to=${to}`),
      fetch(`/api/gsc/performance?projectId=${projectId}&days=28`),
    ]);
    const rankData = await rankRes.json();
    setSnapshots(rankData.snapshots ?? []);
    const lpMap = new Map<string, { position: number | null; pack_present: boolean }>();
    for (const lp of (rankData.localPack ?? [])) {
      lpMap.set(lp.keyword_id, { position: lp.position, pack_present: lp.pack_present });
    }
    setLocalPackMap(lpMap);
    const gscData = await gscRes.json();
    if (gscData.topQueries) setGscPerf(gscData);
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
      <PageHeader title={project ? `${project.name} — Rankings` : "Rank Tracking"} description="Monitor your keyword positions in Google">
        <div className="flex items-center gap-2">
          {/* Tab toggle */}
          <div className="flex rounded-md border text-sm overflow-hidden">
            <button
              className={`px-3 py-1.5 ${activeTab === "rankings" ? "bg-muted font-medium" : "hover:bg-muted/50"}`}
              onClick={() => setActiveTab("rankings")}
            >
              Rankings
            </button>
            <button
              className={`px-3 py-1.5 border-l ${activeTab === "gsc" ? "bg-muted font-medium" : "hover:bg-muted/50"}`}
              onClick={() => setActiveTab("gsc")}
            >
              GSC Queries
            </button>
          </div>
          <Button variant="outline" onClick={handleRefresh} disabled={refreshing || !projectId}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </PageHeader>

      {loading ? <TableSkeleton /> : activeTab === "rankings" ? (
        keywords.length === 0 ? (
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
                    {localPackMap.size > 0 && (
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 inline-block mr-1" />Pack
                      </th>
                    )}
                    {gscPerf && (
                      <>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                          <MousePointerClick className="h-3.5 w-3.5 inline-block mr-1" />Clicks
                        </th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                          <Eye className="h-3.5 w-3.5 inline-block mr-1" />Impr
                        </th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {keywords.map((kw) => {
                    const gsc = gscPerf?.byKeyword?.[kw.keyword.toLowerCase()];
                    return (
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
                        {localPackMap.size > 0 && (() => {
                          const lp = localPackMap.get(kw.id);
                          return (
                            <td className="px-4 py-2.5 text-right text-xs">
                              {!lp ? <span className="text-muted-foreground">—</span>
                                : !lp.pack_present ? <span className="text-muted-foreground">No pack</span>
                                : lp.position != null
                                  ? <Badge variant="success" className="text-xs">#{lp.position}</Badge>
                                  : <span className="text-muted-foreground text-xs">Not in pack</span>
                              }
                            </td>
                          );
                        })()}
                        {gscPerf && (
                          <>
                            <td className="px-4 py-2.5 text-right text-muted-foreground text-xs">
                              {gsc ? gsc.clicks.toLocaleString() : "—"}
                            </td>
                            <td className="px-4 py-2.5 text-right text-muted-foreground text-xs">
                              {gsc ? gsc.impressions.toLocaleString() : "—"}
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
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
        )
      ) : (
        /* GSC Queries tab */
        !gscPerf || gscPerf.topQueries.length === 0 ? (
          <EmptyState
            icon={TrendingUp}
            title="No GSC data yet"
            description="Connect Google Search Console and sync data to see your top organic queries."
          />
        ) : (
          <Card>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">Query</th>
                  <th className="px-4 py-3 text-right font-medium">Position</th>
                  <th className="px-4 py-3 text-right font-medium">Clicks</th>
                  <th className="px-4 py-3 text-right font-medium">Impressions</th>
                  <th className="px-4 py-3 text-right font-medium">CTR</th>
                </tr>
              </thead>
              <tbody>
                {gscPerf.topQueries.map((q) => (
                  <tr key={q.query} className="border-b hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-medium max-w-xs truncate">{q.query}</td>
                    <td className="px-4 py-2.5 text-right">
                      <Badge variant={q.position <= 10 ? "success" : q.position <= 30 ? "info" : "secondary"}>
                        #{Math.round(q.position * 10) / 10}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right">{q.clicks.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">{q.impressions.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">
                      {(q.ctr * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )
      )}
    </div>
  );
}
