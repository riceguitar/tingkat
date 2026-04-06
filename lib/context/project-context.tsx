"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { Project } from "@/types/database";

interface ProjectContextValue {
  projects: Project[];
  projectId: string;
  project: Project | null;
  setProjectId: (id: string) => void;
}

const ProjectContext = createContext<ProjectContextValue>({
  projects: [],
  projectId: "",
  project: null,
  setProjectId: () => {},
});

const LS_KEY = "tingkat_active_project_id";

function readLocalStorage(): string {
  try {
    return localStorage.getItem(LS_KEY) ?? "";
  } catch {
    return "";
  }
}

export function ProjectProvider({
  children,
  initialProjectId = "",
}: {
  children: React.ReactNode;
  initialProjectId?: string;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectIdState] = useState(initialProjectId || readLocalStorage());

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data: Project[]) => {
        setProjects(data);
        if (!projectId && data[0]) {
          const id = data[0].id;
          setProjectIdState(id);
          try { localStorage.setItem(LS_KEY, id); } catch { /* ignore */ }
        }
      });
  }, []);

  const setProjectId = useCallback((id: string) => {
    setProjectIdState(id);
    try { localStorage.setItem(LS_KEY, id); } catch { /* ignore */ }
  }, []);

  const project = projects.find((p) => p.id === projectId) ?? null;

  return (
    <ProjectContext.Provider value={{ projects, projectId, project, setProjectId }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  return useContext(ProjectContext);
}
