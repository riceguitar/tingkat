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

export function ProjectProvider({
  children,
  initialProjectId = "",
}: {
  children: React.ReactNode;
  initialProjectId?: string;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectIdState] = useState(initialProjectId);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data: Project[]) => {
        setProjects(data);
        if (!projectId && data[0]) {
          setProjectIdState(data[0].id);
        }
      });
  }, []);

  const setProjectId = useCallback((id: string) => {
    setProjectIdState(id);
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
