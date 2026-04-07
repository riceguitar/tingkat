"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { Project, Account } from "@/types/database";

interface ProjectContextValue {
  projects: Project[];
  accounts: Account[];
  projectId: string;
  project: Project | null;
  setProjectId: (id: string) => void;
}

const ProjectContext = createContext<ProjectContextValue>({
  projects: [],
  accounts: [],
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
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [projectId, setProjectIdState] = useState(initialProjectId || "");

  // Hydrate from localStorage after mount to avoid SSR/client mismatch
  useEffect(() => {
    if (!initialProjectId) {
      const stored = readLocalStorage();
      if (stored) setProjectIdState(stored);
    }
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/projects").then((r) => r.json()),
      fetch("/api/accounts").then((r) => r.json()),
    ]).then(([projectData, accountData]) => {
      setProjects(Array.isArray(projectData) ? projectData : []);
      const rows: { account: Account; role: string }[] = Array.isArray(accountData) ? accountData : [];
      setAccounts(rows.map((a) => a.account));
      if (!projectId && projectData[0]) {
        const id = projectData[0].id;
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
    <ProjectContext.Provider value={{ projects, accounts, projectId, project, setProjectId }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  return useContext(ProjectContext);
}
