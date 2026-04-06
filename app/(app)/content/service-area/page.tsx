"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Sparkles, CheckCircle2, XCircle, Loader2, Plus, X } from "lucide-react";
import { useProject } from "@/lib/context/project-context";

interface GenerationStatus {
  city: string;
  keyword: string;
  status: "pending" | "generating" | "done" | "error";
  articleId?: string;
  error?: string;
  wordCount?: number;
}

const TONES = ["professional", "conversational", "authoritative", "friendly", "technical"];

export default function ServiceAreaPage() {
  const router = useRouter();
  const { projects, projectId: contextProjectId, project } = useProject();

  const [projectId, setProjectId] = useState("");
  const [service, setService] = useState("");
  const [tone, setTone] = useState("professional");
  const [targetWordCount, setTargetWordCount] = useState(1200);
  const [cities, setCities] = useState<string[]>([]);
  const [cityInput, setCityInput] = useState("");
  const [clusterId, setClusterId] = useState("");
  const [clusters, setClusters] = useState<Array<{ id: string; name: string }>>([]);
  const [statuses, setStatuses] = useState<GenerationStatus[]>([]);
  const [running, setRunning] = useState(false);

  // Initialize project from context (localStorage-backed)
  useEffect(() => {
    const pid = contextProjectId;
    if (pid && !projectId) {
      setProjectId(pid);
      loadFromProject(pid);
    }
  }, [contextProjectId]);

  async function loadFromProject(pid: string) {
    // Load clusters
    const cRes = await fetch(`/api/clusters?projectId=${pid}`);
    const cData = await cRes.json();
    setClusters(Array.isArray(cData) ? cData : []);

    // Pre-populate cities from project service_areas
    const pRes = await fetch(`/api/projects/${pid}`);
    const pData = await pRes.json();
    if (pData?.service_areas?.length) {
      setCities(pData.service_areas);
    }
  }

  async function handleProjectChange(pid: string) {
    setProjectId(pid);
    setCities([]);
    setClusters([]);
    loadFromProject(pid);
  }

  function addCity() {
    const c = cityInput.trim();
    if (!c || cities.includes(c)) return;
    setCities((prev) => [...prev, c]);
    setCityInput("");
  }

  function removeCity(city: string) {
    setCities((prev) => prev.filter((c) => c !== city));
  }

  async function runGeneration() {
    if (!projectId || !service || !cities.length) return;
    setRunning(true);

    const initialStatuses: GenerationStatus[] = cities.map((city) => ({
      city,
      keyword: `${service} in ${city}`,
      status: "pending",
    }));
    setStatuses(initialStatuses);

    for (let i = 0; i < cities.length; i++) {
      const city = cities[i];
      const keyword = `${service} in ${city}`;

      setStatuses((prev) =>
        prev.map((s) => (s.city === city ? { ...s, status: "generating" } : s))
      );

      try {
        const res = await fetch("/api/ai/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            keyword,
            brief: `Local service page targeting "${service}" customers in ${city}. Focus on the local area, mention specific neighbourhoods or landmarks where relevant. This is a landing page — focus on conversion.`,
            tone,
            targetWordCount,
            projectId,
            clusterId: clusterId === "__none__" ? undefined : clusterId || undefined,
          }),
        });

        if (!res.ok || !res.body) throw new Error("Generation request failed");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let articleId: string | undefined;
        let wordCount: number | undefined;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value);
          for (const line of text.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            try {
              const event = JSON.parse(line.slice(6));
              if (event.articleId) articleId = event.articleId;
              if (event.type === "done") wordCount = event.wordCount;
            } catch { /* ignore parse errors */ }
          }
        }

        setStatuses((prev) =>
          prev.map((s) =>
            s.city === city ? { ...s, status: "done", articleId, wordCount } : s
          )
        );
      } catch (err) {
        setStatuses((prev) =>
          prev.map((s) =>
            s.city === city
              ? { ...s, status: "error", error: err instanceof Error ? err.message : "Failed" }
              : s
          )
        );
      }
    }

    setRunning(false);
  }

  const canStart = projectId && service.trim() && cities.length > 0 && !running;
  const doneCount = statuses.filter((s) => s.status === "done").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Service Area Pages"
        description="Generate geo-targeted landing pages for each city you serve"
      />

      {/* Config */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
          <CardDescription>Set the service, cities, and writing options. One page will be generated per city.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Project */}
          <div className="space-y-1.5">
            <Label>Project</Label>
            <Select value={projectId} onValueChange={handleProjectChange} disabled={running}>
              <SelectTrigger>
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Service */}
          <div className="space-y-1.5">
            <Label>Base service</Label>
            <Input
              value={service}
              onChange={(e) => setService(e.target.value)}
              placeholder="e.g. HVAC Repair, Plumbing, Dental Implants"
              disabled={running}
            />
            <p className="text-xs text-muted-foreground">
              Each page will target "{service || "service"} in [City]"
            </p>
          </div>

          {/* Cities */}
          <div className="space-y-1.5">
            <Label>Target cities</Label>
            {project?.city && cities.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Auto-populated from project service areas. Edit as needed.
              </p>
            )}
            <div className="flex gap-2">
              <Input
                value={cityInput}
                onChange={(e) => setCityInput(e.target.value)}
                placeholder="Add a city"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCity(); }}}
                disabled={running}
              />
              <Button type="button" variant="outline" onClick={addCity} disabled={running || !cityInput.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {cities.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {cities.map((c) => (
                  <Badge key={c} variant="secondary" className="gap-1">
                    <MapPin className="h-3 w-3" />
                    {c}
                    {!running && (
                      <button onClick={() => removeCity(c)} className="ml-0.5 hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Tone */}
            <div className="space-y-1.5">
              <Label>Tone</Label>
              <Select value={tone} onValueChange={setTone} disabled={running}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TONES.map((t) => (
                    <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Word count */}
            <div className="space-y-1.5">
              <Label>Target word count</Label>
              <Select value={String(targetWordCount)} onValueChange={(v) => setTargetWordCount(Number(v))} disabled={running}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[800, 1000, 1200, 1500, 2000].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n.toLocaleString()} words</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Cluster */}
          {clusters.length > 0 && (
            <div className="space-y-1.5">
              <Label>Keyword cluster (optional)</Label>
              <Select value={clusterId} onValueChange={setClusterId} disabled={running}>
                <SelectTrigger><SelectValue placeholder="No cluster" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No cluster</SelectItem>
                  {clusters.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button onClick={runGeneration} disabled={!canStart} className="w-full">
            {running ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating {doneCount}/{cities.length}…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate {cities.length} page{cities.length !== 1 ? "s" : ""}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Progress */}
      {statuses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Generation Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {statuses.map((s) => (
              <div key={s.city} className="flex items-center gap-3 py-2 border-b last:border-0">
                <div className="w-5 shrink-0">
                  {s.status === "pending" && <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />}
                  {s.status === "generating" && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                  {s.status === "done" && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                  {s.status === "error" && <XCircle className="h-4 w-4 text-destructive" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{s.keyword}</p>
                  {s.status === "error" && (
                    <p className="text-xs text-destructive">{s.error}</p>
                  )}
                  {s.status === "done" && s.wordCount && (
                    <p className="text-xs text-muted-foreground">{s.wordCount.toLocaleString()} words</p>
                  )}
                </div>
                {s.status === "done" && s.articleId && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/content/${s.articleId}`)}
                  >
                    View
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
