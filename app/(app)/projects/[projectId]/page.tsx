"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { FileText, Search, TrendingUp, ArrowLeft, Globe, Layers, Plus, Trash2, Pencil, Check, X, ExternalLink, Sparkles, BarChart3, MapPin } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "next/link";
import type { Project, PillarPage } from "@/types/database";

interface PillarSuggestion {
  url: string;
  title: string;
  description: string;
  confidence: "high" | "medium" | "low";
}

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [pillars, setPillars] = useState<PillarPage[]>([]);
  const [pillarsLoading, setPillarsLoading] = useState(false);
  const [gscConnected, setGscConnected] = useState<boolean | null>(null);

  // Discovery state
  const [discovering, setDiscovering] = useState(false);
  const [discoverError, setDiscoverError] = useState("");
  const [suggestions, setSuggestions] = useState<PillarSuggestion[]>([]);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set());
  const [discoverDialogOpen, setDiscoverDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Manual add state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addForm, setAddForm] = useState({ url: "", title: "", description: "", target_keyword: "" });
  const [addSaving, setAddSaving] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: "", target_keyword: "" });
  const [editSaving, setEditSaving] = useState(false);

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Local profile state
  const [localForm, setLocalForm] = useState({
    business_type: "", business_name: "", city: "", state_province: "",
    country_code: "US", location_code: 2840, nap_address: "", nap_phone: "",
    primary_category: "", service_areas_raw: "",
  });
  const [localSaving, setLocalSaving] = useState(false);
  const [localSaved, setLocalSaved] = useState(false);

  useEffect(() => {
    fetch(`/api/projects/${projectId}`)
      .then((r) => r.json())
      .then((data: Project) => {
        setProject(data);
        setLocalForm({
          business_type: data.business_type ?? "",
          business_name: data.business_name ?? "",
          city: data.city ?? "",
          state_province: data.state_province ?? "",
          country_code: data.country_code ?? "US",
          location_code: data.location_code ?? 2840,
          nap_address: data.nap_address ?? "",
          nap_phone: data.nap_phone ?? "",
          primary_category: data.primary_category ?? "",
          service_areas_raw: (data.service_areas ?? []).join(", "),
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
    loadPillars();
    fetch(`/api/gsc/status?projectId=${projectId}`)
      .then((r) => r.json())
      .then((data) => setGscConnected(data.connected && data.propertyChosen))
      .catch(() => setGscConnected(false));
  }, [projectId]);

  async function loadPillars() {
    setPillarsLoading(true);
    const res = await fetch(`/api/projects/${projectId}/pillars`);
    const data = await res.json();
    setPillars(Array.isArray(data) ? data : []);
    setPillarsLoading(false);
  }

  async function handleDiscover() {
    setDiscovering(true);
    setDiscoverError("");
    setSuggestions([]);
    const res = await fetch(`/api/projects/${projectId}/pillars/discover`, { method: "POST" });
    const data = await res.json();
    setDiscovering(false);
    if (!res.ok) {
      setDiscoverError(data.error ?? "Discovery failed");
      return;
    }
    const sugg: PillarSuggestion[] = data.suggestions ?? [];
    setSuggestions(sugg);
    setSelectedSuggestions(new Set(sugg.map((_, i) => i)));
    setDiscoverDialogOpen(true);
  }

  async function handleSaveSelected() {
    const toSave = suggestions.filter((_, i) => selectedSuggestions.has(i));
    if (!toSave.length) return;
    setSaving(true);
    await fetch(`/api/projects/${projectId}/pillars`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pillars: toSave.map((s) => ({ url: s.url, title: s.title, description: s.description })) }),
    });
    setSaving(false);
    setDiscoverDialogOpen(false);
    loadPillars();
  }

  async function handleManualAdd() {
    if (!addForm.url || !addForm.title) return;
    setAddSaving(true);
    await fetch(`/api/projects/${projectId}/pillars`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: addForm.url,
        title: addForm.title,
        description: addForm.description || undefined,
        target_keyword: addForm.target_keyword || undefined,
      }),
    });
    setAddSaving(false);
    setAddDialogOpen(false);
    setAddForm({ url: "", title: "", description: "", target_keyword: "" });
    loadPillars();
  }

  async function handleEditSave(id: string) {
    setEditSaving(true);
    const res = await fetch(`/api/projects/${projectId}/pillars/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: editForm.title, target_keyword: editForm.target_keyword || null }),
    });
    const updated = await res.json();
    setPillars((prev) => prev.map((p) => (p.id === id ? { ...p, ...updated } : p)));
    setEditingId(null);
    setEditSaving(false);
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    await fetch(`/api/projects/${projectId}/pillars/${id}`, { method: "DELETE" });
    setPillars((prev) => prev.filter((p) => p.id !== id));
    setDeletingId(null);
  }

  async function handleSaveLocalProfile() {
    setLocalSaving(true);
    const service_areas = localForm.service_areas_raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const payload = {
      business_type: localForm.business_type || undefined,
      business_name: localForm.business_name || undefined,
      city: localForm.city || undefined,
      state_province: localForm.state_province || undefined,
      country_code: localForm.country_code || undefined,
      location_code: localForm.location_code || undefined,
      service_areas,
      nap_address: localForm.nap_address || undefined,
      nap_phone: localForm.nap_phone || undefined,
      primary_category: localForm.primary_category || undefined,
    };
    const res = await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) { setLocalSaved(true); setTimeout(() => setLocalSaved(false), 2000); }
    setLocalSaving(false);
  }

  function toggleSuggestion(i: number) {
    setSelectedSuggestions((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  const confidenceBadge = { high: "bg-green-100 text-green-700", medium: "bg-yellow-100 text-yellow-700", low: "bg-gray-100 text-gray-600" };

  if (loading) return <div className="p-8 text-muted-foreground">Loading...</div>;
  if (!project) return <div className="p-8 text-destructive">Project not found.</div>;

  return (
    <div className="space-y-6">
      <PageHeader title={project.name} description={project.domain}>
        <Button variant="outline" size="sm" onClick={() => router.push("/projects")}>
          <ArrowLeft className="h-4 w-4" /> All projects
        </Button>
      </PageHeader>

      {/* GSC connection banner */}
      {gscConnected === false && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 px-4 py-3 text-sm">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <BarChart3 className="h-4 w-4 shrink-0" />
            Connect Google Search Console to unlock traffic insights, quick-win opportunities, and cannibalization detection.
          </div>
          <Link
            href={`/settings/gsc?projectId=${projectId}`}
            className="shrink-0 text-xs font-medium text-amber-700 dark:text-amber-400 underline underline-offset-2 hover:no-underline"
          >
            Connect now →
          </Link>
        </div>
      )}

      {/* Quick-access cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push(`/keyword-research?project=${projectId}`)}>
          <CardHeader>
            <Search className="h-5 w-5 text-primary mb-1" />
            <CardTitle className="text-base">Keyword Research</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Find and cluster keywords for this project.</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push(`/content/new?project=${projectId}`)}>
          <CardHeader>
            <FileText className="h-5 w-5 text-primary mb-1" />
            <CardTitle className="text-base">Generate Content</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">AI-powered article creation for this project.</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push(`/rank-tracking?project=${projectId}`)}>
          <CardHeader>
            <TrendingUp className="h-5 w-5 text-primary mb-1" />
            <CardTitle className="text-base">Rank Tracking</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Monitor keyword positions over time.</p>
          </CardContent>
        </Card>
      </div>

      {/* Pillar Pages section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-base">Pillar Pages</h2>
            {!pillarsLoading && pillars.length > 0 && (
              <span className="text-xs text-muted-foreground">({pillars.length})</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setAddDialogOpen(true)}>
              <Plus className="h-4 w-4" /> Add manually
            </Button>
            <Button size="sm" onClick={handleDiscover} disabled={discovering}>
              <Sparkles className="h-4 w-4" /> {discovering ? "Discovering..." : "Discover pillars"}
            </Button>
          </div>
        </div>

        {discoverError && (
          <p className="text-sm text-destructive">{discoverError}</p>
        )}

        {pillarsLoading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : pillars.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-10 text-center space-y-3">
              <Layers className="h-8 w-8 mx-auto text-muted-foreground/50" />
              <div>
                <p className="text-sm font-medium">No pillar pages yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Discover your site&apos;s main service pages, or add them manually. All blog content you generate will support these pages.
                </p>
              </div>
              <Button size="sm" onClick={handleDiscover} disabled={discovering}>
                <Sparkles className="h-4 w-4" /> {discovering ? "Discovering..." : "Discover from site"}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pillars.map((pillar) => {
              const isEditing = editingId === pillar.id;
              return (
                <Card key={pillar.id}>
                  <CardContent className="pt-4 space-y-2">
                    {isEditing ? (
                      <div className="space-y-2">
                        <Input
                          value={editForm.title}
                          onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                          placeholder="Page title"
                          className="text-sm"
                        />
                        <Input
                          value={editForm.target_keyword}
                          onChange={(e) => setEditForm((f) => ({ ...f, target_keyword: e.target.value }))}
                          placeholder="Target keyword (optional)"
                          className="text-sm"
                        />
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditingId(null)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" className="h-7 w-7 p-0" onClick={() => handleEditSave(pillar.id)} disabled={editSaving}>
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium leading-tight">{pillar.title}</p>
                          <div className="flex gap-0.5 shrink-0">
                            <Button
                              size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                              onClick={() => { setEditingId(pillar.id); setEditForm({ title: pillar.title, target_keyword: pillar.target_keyword ?? "" }); }}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                              onClick={() => handleDelete(pillar.id)}
                              disabled={deletingId === pillar.id}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <a
                          href={pillar.url.startsWith("http") ? pillar.url : `https://${project.domain}${pillar.url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground truncate"
                        >
                          <ExternalLink className="h-3 w-3 shrink-0" />
                          <span className="truncate">{pillar.url}</span>
                        </a>
                        {pillar.target_keyword && (
                          <span className="inline-block text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5">
                            {pillar.target_keyword}
                          </span>
                        )}
                        {pillar.description && (
                          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{pillar.description}</p>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {project.description && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Globe className="h-4 w-4" /> About this project
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{project.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Discovery review dialog */}
      <Dialog open={discoverDialogOpen} onOpenChange={setDiscoverDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Discovered Pillar Pages</DialogTitle>
            <p className="text-sm text-muted-foreground">
              {suggestions.length > 0
                ? `Found ${suggestions.length} potential pillar pages. Select the ones to save.`
                : "No pillar pages were identified on this site."}
            </p>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 space-y-2 py-2">
            {suggestions.map((s, i) => (
              <label
                key={i}
                className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${selectedSuggestions.has(i) ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 rounded"
                  checked={selectedSuggestions.has(i)}
                  onChange={() => toggleSuggestion(i)}
                />
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{s.title}</p>
                    <span className={`text-xs rounded-full px-1.5 py-0.5 shrink-0 ${confidenceBadge[s.confidence]}`}>
                      {s.confidence}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{s.url}</p>
                  {s.description && <p className="text-xs text-muted-foreground">{s.description}</p>}
                </div>
              </label>
            ))}
            {suggestions.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                No pillar pages detected. Try adding them manually.
              </p>
            )}
          </div>
          <DialogFooter className="pt-2 border-t">
            <Button variant="outline" onClick={() => setDiscoverDialogOpen(false)}>Cancel</Button>
            {suggestions.length > 0 && (
              <Button onClick={handleSaveSelected} disabled={saving || selectedSuggestions.size === 0}>
                {saving ? "Saving..." : `Save ${selectedSuggestions.size} pillar${selectedSuggestions.size !== 1 ? "s" : ""}`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual add dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Pillar Page</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">URL</label>
              <Input
                value={addForm.url}
                onChange={(e) => setAddForm((f) => ({ ...f, url: e.target.value }))}
                placeholder="/services/seo or https://example.com/services/seo"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Title</label>
              <Input
                value={addForm.title}
                onChange={(e) => setAddForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. SEO Services"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Target keyword <span className="text-muted-foreground font-normal">(optional)</span></label>
              <Input
                value={addForm.target_keyword}
                onChange={(e) => setAddForm((f) => ({ ...f, target_keyword: e.target.value }))}
                placeholder="e.g. SEO agency London"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Description <span className="text-muted-foreground font-normal">(optional)</span></label>
              <Input
                value={addForm.description}
                onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="What this page is about"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleManualAdd} disabled={addSaving || !addForm.url || !addForm.title}>
              {addSaving ? "Saving..." : "Add pillar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Local Profile */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-base">Local SEO Profile</h2>
          <span className="text-xs text-muted-foreground">Used for location-aware content and local rank tracking</span>
        </div>
        <Card>
          <CardContent className="pt-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Business name</Label>
                <Input value={localForm.business_name} onChange={(e) => setLocalForm((f) => ({ ...f, business_name: e.target.value }))} placeholder="e.g. Acme Plumbing Co." />
              </div>
              <div className="space-y-1.5">
                <Label>Business type</Label>
                <Select value={localForm.business_type || "__none__"} onValueChange={(v) => setLocalForm((f) => ({ ...f, business_type: v === "__none__" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Not set</SelectItem>
                    <SelectItem value="service_area">Service-area business (no storefront)</SelectItem>
                    <SelectItem value="brick_mortar">Brick & mortar (customers visit)</SelectItem>
                    <SelectItem value="hybrid">Hybrid (both)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Primary category</Label>
                <Input value={localForm.primary_category} onChange={(e) => setLocalForm((f) => ({ ...f, primary_category: e.target.value }))} placeholder="e.g. Plumber, HVAC, Dentist, Lawyer" />
              </div>
              <div className="space-y-1.5">
                <Label>Phone (NAP)</Label>
                <Input value={localForm.nap_phone} onChange={(e) => setLocalForm((f) => ({ ...f, nap_phone: e.target.value }))} placeholder="+1 (303) 555-0100" />
              </div>
              <div className="space-y-1.5">
                <Label>City</Label>
                <Input value={localForm.city} onChange={(e) => setLocalForm((f) => ({ ...f, city: e.target.value }))} placeholder="Denver" />
              </div>
              <div className="space-y-1.5">
                <Label>State / Province</Label>
                <Input value={localForm.state_province} onChange={(e) => setLocalForm((f) => ({ ...f, state_province: e.target.value }))} placeholder="CO" />
              </div>
              <div className="space-y-1.5">
                <Label>Country code</Label>
                <Input value={localForm.country_code} onChange={(e) => setLocalForm((f) => ({ ...f, country_code: e.target.value.toUpperCase().slice(0, 2) }))} placeholder="US" maxLength={2} className="uppercase" />
              </div>
              <div className="space-y-1.5">
                <Label>DataForSEO location code</Label>
                <Input
                  type="number"
                  value={localForm.location_code}
                  onChange={(e) => setLocalForm((f) => ({ ...f, location_code: parseInt(e.target.value) || 2840 }))}
                  placeholder="2840"
                />
                <p className="text-xs text-muted-foreground">2840 = United States · 1012825 = Denver · Use DataForSEO location search to find city codes.</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Address (NAP)</Label>
              <Input value={localForm.nap_address} onChange={(e) => setLocalForm((f) => ({ ...f, nap_address: e.target.value }))} placeholder="123 Main St, Denver, CO 80202" />
            </div>
            <div className="space-y-1.5">
              <Label>Service areas</Label>
              <Input value={localForm.service_areas_raw} onChange={(e) => setLocalForm((f) => ({ ...f, service_areas_raw: e.target.value }))} placeholder="Denver, Aurora, Lakewood, Englewood" />
              <p className="text-xs text-muted-foreground">Comma-separated city names. Used for service-area content generation and local pack tracking.</p>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleSaveLocalProfile} disabled={localSaving}>
                {localSaved ? <><Check className="h-4 w-4" /> Saved</> : localSaving ? "Saving..." : "Save local profile"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
