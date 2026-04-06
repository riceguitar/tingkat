"use client";

import { useState, useCallback } from "react";

interface StreamState {
  streaming: boolean;
  content: string;
  articleId: string | null;
  wordCount: number | null;
  error: string | null;
}

export function useStreamGeneration() {
  const [state, setState] = useState<StreamState>({
    streaming: false,
    content: "",
    articleId: null,
    wordCount: null,
    error: null,
  });

  const generate = useCallback(async (params: {
    keyword: string;
    brief: string;
    tone: string;
    targetWordCount: number;
    projectId: string;
    articleId?: string;
    pillarPageId?: string | null;
    clusterId?: string | null;
  }) => {
    setState({ streaming: true, content: "", articleId: params.articleId ?? null, wordCount: null, error: null });

    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      if (!res.ok || !res.body) {
        throw new Error("Generation request failed");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "chunk") {
              setState((prev) => ({ ...prev, content: prev.content + event.content, articleId: event.articleId ?? prev.articleId }));
            } else if (event.type === "done") {
              setState((prev) => ({ ...prev, streaming: false, wordCount: event.wordCount, articleId: event.articleId ?? prev.articleId }));
            } else if (event.type === "error") {
              setState((prev) => ({ ...prev, streaming: false, error: event.error }));
            }
          } catch {}
        }
      }
    } catch (err) {
      setState((prev) => ({
        ...prev,
        streaming: false,
        error: err instanceof Error ? err.message : "Generation failed",
      }));
    }
  }, []);

  const reset = useCallback(() => {
    setState({ streaming: false, content: "", articleId: null, wordCount: null, error: null });
  }, []);

  return { ...state, generate, reset };
}
