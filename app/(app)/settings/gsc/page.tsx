"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle, BarChart3, RefreshCw, AlertCircle, Link2, X,
  Calendar, Database,
} from "lucide-react";
import type { Project } from "@/types/database";

interface GscStatus {
  connected: boolean;
  propertyUrl: string | null;
  propertyChosen: boolean;
  lastSyncDate: string | null;
  rowCount: number;
  tokenExpired?: boolean;
}

function GscContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const choosingProperty = searchParams.get("choosingProperty") === "true";

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState(searchParams.get("projectId") ?? "");
  const [status, setStatus] = useState<GscStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  // Property picker state
  const [properties, setProperties] = useState<string[]>([]);
  const [propertiesLoading, setPropertiesLoading] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState("");
  const [savingProperty, setSavingProperty] = useState(false);

  // Sync state
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ synced: number } | null>(null);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data: Project[]) => {
        setProjects(data);
        if (!projectId && data[0]) setProjectId(data[0].id);
      });
  }, []);

  useEffect(() => {
    if (projectId) loadStatus();
  }, [projectId]);

  // When redirected back after OAuth with choosingProperty=true, auto-load properties
  useEffect(() => {
    if (choosingProperty && projectId) loadProperties();
  }, [choosingProperty, projectId]);

  async function loadStatus() {
    setStatusLoading(true);
    const res = await fetch(`/api/gsc/status?projectId=${projectId}`);
    const data = await res.json();
    setStatus(data);
    setStatusLoading(false);

    // If token exists but no property chosen, load the picker
    if (data.connected && !data.propertyChosen) {
      loadProperties();
    }
  }

  async function loadProperties() {
    setPropertiesLoading(true);
    const res = await fetch(`/api/gsc/properties?projectId=${projectId}`);
    const data = await res.json();
    if (Array.isArray(data.properties)) {
      setProperties(data.properties);
      if (data.properties.length === 1) setSelectedProperty(data.properties[0]);
    }
    setPropertiesLoading(false);
  }

  async function handleConnect() {
    if (!projectId) return;
    const res = await fetch(`/api/gsc/auth?projectId=${projectId}`);
    const data = await res.json();
    window.location.href = data.authUrl;
  }

  async function handleSaveProperty() {
    if (!selectedProperty || !projectId) return;
    setSavingProperty(true);
    await fetch(`/api/gsc/properties?projectId=${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propertyUrl: selectedProperty }),
    });
    setSavingProperty(false);

    // Auto-trigger 90-day historical sync
    await handleSync(90);
    await loadStatus();
  }

  async function handleSync(days = 28) {
    if (!projectId) return;
    setSyncing(true);
    setSyncResult(null);
    const from = new Date();
    from.setDate(from.getDate() - days);
    const fromStr = from.toISOString().split("T")[0];
    const res = await fetch(`/api/gsc/data?projectId=${projectId}&from=${fromStr}`);
    const data = await res.json();
    setSyncResult({ synced: data.synced ?? 0 });
    setSyncing(false);
    await loadStatus();
  }

  async function handleChangeProperty() {
    setProperties([]);
    setSelectedProperty("");
    await loadProperties();
  }

  const showPicker = (status?.connected && !status.propertyChosen) || properties.length > 0;

  return (
    <div className="space-y-6 max-w-xl">
      <PageHeader
        title="Google Search Console"
        description="Import search analytics data to unlock traffic insights and quick-win opportunities"
      />

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Error: {error.replace(/_/g, " ")}
        </div>
      )}

      {/* Project selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> Project
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select
            value={projectId}
            onValueChange={(v) => {
              setProjectId(v);
              setStatus(null);
              setProperties([]);
              setSyncResult(null);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select project" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Connection status card */}
      {projectId && !statusLoading && status && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              {status.connected && status.propertyChosen ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : status.connected ? (
                <AlertCircle className="h-4 w-4 text-amber-500" />
              ) : (
                <X className="h-4 w-4 text-muted-foreground" />
              )}
              {status.connected && status.propertyChosen
                ? "Connected"
                : status.connected
                ? "Connected — property not selected"
                : "Not connected"}
            </CardTitle>
          </CardHeader>

          {status.connected && status.propertyChosen && (
            <CardContent className="space-y-4">
              {/* Property URL */}
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-sm">
                    <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium text-xs text-muted-foreground uppercase tracking-wide">Property</span>
                  </div>
                  <p className="text-sm font-medium">{status.propertyUrl}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 text-xs"
                  onClick={handleChangeProperty}
                >
                  Change
                </Button>
              </div>

              {/* Stats row */}
              <div className="flex gap-6 pt-1 border-t">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" /> Last sync
                  </div>
                  <p className="text-sm font-medium">
                    {status.lastSyncDate ?? "Never"}
                  </p>
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Database className="h-3 w-3" /> Rows stored
                  </div>
                  <p className="text-sm font-medium">
                    {status.rowCount.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSync(28)}
                  disabled={syncing}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
                  {syncing ? "Syncing…" : "Sync last 28 days"}
                </Button>
                <Button variant="ghost" size="sm" onClick={handleConnect}>
                  Re-connect Google
                </Button>
              </div>

              {syncResult && (
                <p className="text-xs text-muted-foreground">
                  Synced {syncResult.synced.toLocaleString()} rows.
                </p>
              )}
            </CardContent>
          )}

          {/* Property picker — shown after OAuth redirect or when property is null */}
          {showPicker && (
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>
                  {propertiesLoading
                    ? "Loading your GSC properties…"
                    : `Select property (${properties.length} available)`}
                </Label>
                <Select
                  value={selectedProperty}
                  onValueChange={setSelectedProperty}
                  disabled={propertiesLoading || properties.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={propertiesLoading ? "Loading…" : "Choose a property"} />
                  </SelectTrigger>
                  <SelectContent>
                    {properties.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  We&apos;ll automatically sync the last 90 days of data after you confirm.
                </p>
              </div>

              {syncing && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Syncing historical data (this may take a moment)…
                </div>
              )}

              {syncResult && !syncing && (
                <div className="flex items-center gap-2 text-sm text-green-700">
                  <CheckCircle className="h-4 w-4" />
                  Synced {syncResult.synced.toLocaleString()} rows successfully.
                </div>
              )}

              <Button
                onClick={handleSaveProperty}
                disabled={!selectedProperty || savingProperty || syncing}
              >
                {savingProperty || syncing ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    {syncing ? "Syncing data…" : "Saving…"}
                  </>
                ) : (
                  "Confirm & sync data"
                )}
              </Button>
            </CardContent>
          )}

          {/* Not connected */}
          {!status.connected && (
            <CardContent>
              <Button onClick={handleConnect} disabled={!projectId}>
                Connect with Google
              </Button>
            </CardContent>
          )}
        </Card>
      )}

      {/* Initial connect card — shown while status is loading or not yet connected */}
      {projectId && !statusLoading && status && !status.connected && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground font-normal">
              Connecting GSC unlocks:
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              {[
                "Click & impression data in the dashboard",
                "Quick-win keyword opportunities",
                "Cannibalization warnings before writing new articles",
                "Traffic data on your published articles",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {statusLoading && projectId && (
        <div className="text-sm text-muted-foreground animate-pulse">Loading connection status…</div>
      )}
    </div>
  );
}

export default function GscSettingsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading…</div>}>
      <GscContent />
    </Suspense>
  );
}
