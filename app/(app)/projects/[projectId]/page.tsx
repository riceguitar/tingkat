"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Search, TrendingUp, ArrowLeft, Globe } from "lucide-react";
import type { Project } from "@/types/database";

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/projects/${projectId}`)
      .then((r) => r.json())
      .then((data) => { setProject(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [projectId]);

  if (loading) return <div className="p-8 text-muted-foreground">Loading...</div>;
  if (!project) return <div className="p-8 text-destructive">Project not found.</div>;

  return (
    <div className="space-y-6">
      <PageHeader title={project.name} description={project.domain}>
        <Button variant="outline" size="sm" onClick={() => router.push("/projects")}>
          <ArrowLeft className="h-4 w-4" /> All projects
        </Button>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => router.push(`/keyword-research?project=${projectId}`)}
        >
          <CardHeader>
            <Search className="h-5 w-5 text-primary mb-1" />
            <CardTitle className="text-base">Keyword Research</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Find and cluster keywords for this project.</p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => router.push(`/content/new?project=${projectId}`)}
        >
          <CardHeader>
            <FileText className="h-5 w-5 text-primary mb-1" />
            <CardTitle className="text-base">Generate Content</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">AI-powered article creation for this project.</p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => router.push(`/rank-tracking?project=${projectId}`)}
        >
          <CardHeader>
            <TrendingUp className="h-5 w-5 text-primary mb-1" />
            <CardTitle className="text-base">Rank Tracking</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Monitor keyword positions over time.</p>
          </CardContent>
        </Card>
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
    </div>
  );
}
