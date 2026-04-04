"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Globe, AlertCircle } from "lucide-react";
import type { Project } from "@/types/database";

export default function WordPressSettingsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [form, setForm] = useState({ siteUrl: "", username: "", applicationPassword: "" });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; siteTitle?: string; wpUserLogin?: string; error?: string } | null>(null);

  useEffect(() => {
    fetch("/api/projects").then((r) => r.json()).then((data) => {
      setProjects(data);
      if (data[0]) setProjectId(data[0].id);
    });
  }, []);

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    const res = await fetch("/api/wordpress/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, ...form }),
    });
    const data = await res.json();
    setResult(data);
    setLoading(false);
  }

  return (
    <div className="space-y-6 max-w-xl">
      <PageHeader title="WordPress Connection" description="Connect your WordPress site for auto-publishing" />

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-4 w-4" /> Connect WordPress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleConnect} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Project</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>
                  {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>WordPress Site URL</Label>
              <Input value={form.siteUrl} onChange={(e) => setForm({ ...form, siteUrl: e.target.value })} placeholder="https://yoursite.com" type="url" required />
            </div>

            <div className="space-y-1.5">
              <Label>Username</Label>
              <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="WordPress username" required />
            </div>

            <div className="space-y-1.5">
              <Label>Application Password</Label>
              <Input value={form.applicationPassword} onChange={(e) => setForm({ ...form, applicationPassword: e.target.value })} placeholder="xxxx xxxx xxxx xxxx xxxx xxxx" type="password" required />
              <p className="text-xs text-muted-foreground">
                Generate one in WordPress → Users → Profile → Application Passwords.
              </p>
            </div>

            {result && (
              <div className={`flex items-center gap-2 rounded-lg p-3 text-sm ${result.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                {result.success ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                {result.success ? `Connected to "${result.siteTitle}" as ${result.wpUserLogin}` : result.error}
              </div>
            )}

            <Button type="submit" disabled={loading || !projectId}>
              {loading ? "Connecting..." : "Test & Connect"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Setup Guide</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>1. Log in to your WordPress admin panel.</p>
          <p>2. Go to <strong>Users → Your Profile</strong>.</p>
          <p>3. Scroll to <strong>Application Passwords</strong>.</p>
          <p>4. Enter "Tingkat" as the name and click <strong>Add New Application Password</strong>.</p>
          <p>5. Copy the generated password (it won&apos;t be shown again) and paste it above.</p>
        </CardContent>
      </Card>
    </div>
  );
}
