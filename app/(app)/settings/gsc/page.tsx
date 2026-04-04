"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { CheckCircle, BarChart3, RefreshCw } from "lucide-react";
import type { Project } from "@/types/database";

function GscContent() {
  const searchParams = useSearchParams();
  const connected = searchParams.get("connected") === "true";
  const error = searchParams.get("error");

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ synced: number } | null>(null);

  useEffect(() => {
    fetch("/api/projects").then((r) => r.json()).then((data) => {
      setProjects(data);
      if (data[0]) setProjectId(data[0].id);
    });
  }, []);

  async function handleConnect() {
    if (!projectId) return;
    const res = await fetch(`/api/gsc/auth?projectId=${projectId}`);
    const data = await res.json();
    window.location.href = data.authUrl;
  }

  async function handleSync() {
    if (!projectId) return;
    setSyncing(true);
    const res = await fetch(`/api/gsc/data?projectId=${projectId}`);
    const data = await res.json();
    setSyncResult({ synced: data.synced ?? 0 });
    setSyncing(false);
  }

  return (
    <div className="space-y-6 max-w-xl">
      <PageHeader title="Google Search Console" description="Import search analytics data from your GSC property" />

      {connected && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-700">
          <CheckCircle className="h-4 w-4" /> GSC connected successfully!
        </div>
      )}
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          Error: {error.replace(/_/g, " ")}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> Connect GSC
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Project</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
              <SelectContent>
                {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleConnect} disabled={!projectId}>
              Connect with Google
            </Button>
            <Button variant="outline" onClick={handleSync} disabled={!projectId || syncing}>
              <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing..." : "Sync data"}
            </Button>
          </div>

          {syncResult && (
            <p className="text-sm text-muted-foreground">Synced {syncResult.synced} rows from GSC.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function GscSettingsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading...</div>}>
      <GscContent />
    </Suspense>
  );
}
