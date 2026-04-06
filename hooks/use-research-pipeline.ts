"use client";

import { useState, useCallback, useRef } from "react";
import type {
  StepName,
  StepState,
  ResearchParams,
  ResearchSSEEvent,
} from "@/types/research";
import { STEP_ORDER } from "@/types/research";

type PipelineSteps = Record<StepName, StepState>;

function initialSteps(): PipelineSteps {
  return Object.fromEntries(
    STEP_ORDER.map((s) => [s, { status: "idle" } as StepState])
  ) as PipelineSteps;
}

export interface ResearchPipelineState {
  steps: PipelineSteps;
  articleId: string | null;
  wordCount: number | null;
  error: string | null;
  isRunning: boolean;
}

export function useResearchPipeline() {
  const [state, setState] = useState<ResearchPipelineState>({
    steps: initialSteps(),
    articleId: null,
    wordCount: null,
    error: null,
    isRunning: false,
  });

  // Track articleId in a ref so event handlers always have the latest value
  const articleIdRef = useRef<string | null>(null);

  const updateStep = useCallback((step: StepName, patch: Partial<StepState>) => {
    setState((prev) => ({
      ...prev,
      steps: { ...prev.steps, [step]: { ...prev.steps[step], ...patch } },
    }));
  }, []);

  const run = useCallback(
    async (params: ResearchParams) => {
      setState((prev) => {
        // When re-running a single step, only reset that step (and downstream)
        if (params.startFromStep) {
          const startIdx = STEP_ORDER.indexOf(params.startFromStep);
          const resetSteps = { ...prev.steps };
          STEP_ORDER.slice(startIdx).forEach((s) => {
            resetSteps[s] = { status: "idle" };
          });
          return { ...prev, steps: resetSteps, isRunning: true, error: null };
        }
        // Full reset
        return {
          steps: initialSteps(),
          articleId: prev.articleId, // preserve if re-running on same article
          wordCount: null,
          error: null,
          isRunning: true,
        };
      });

      try {
        const res = await fetch("/api/ai/research", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...params,
            articleId: params.articleId ?? articleIdRef.current,
          }),
        });

        if (!res.ok || !res.body) {
          throw new Error("Research pipeline request failed");
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
              const event: ResearchSSEEvent = JSON.parse(line.slice(6));
              handleEvent(event);
            } catch {
              // ignore malformed SSE
            }
          }
        }
      } catch (err) {
        setState((prev) => ({
          ...prev,
          isRunning: false,
          error: err instanceof Error ? err.message : "Pipeline failed",
        }));
      }

      function handleEvent(event: ResearchSSEEvent) {
        switch (event.type) {
          case "step_start":
            updateStep(event.step, { status: "running", streamContent: undefined, data: undefined, error: undefined });
            break;

          case "step_progress":
            // Progress messages are stored transiently; UI can show via step data
            updateStep(event.step, { data: { message: event.message } });
            break;

          case "step_complete":
            updateStep(event.step, { status: "complete", data: event.data });
            break;

          case "step_error":
            updateStep(event.step, { status: "error", error: event.error });
            break;

          case "step_chunk":
            // Streaming content for writing_plan and article_generation steps
            setState((prev) => ({
              ...prev,
              steps: {
                ...prev.steps,
                [event.step]: {
                  ...prev.steps[event.step],
                  streamContent: (prev.steps[event.step].streamContent ?? "") + event.content,
                },
              },
            }));
            break;

          case "chunk":
            // Article generation chunk — also feeds article_generation step stream
            if (event.articleId) {
              articleIdRef.current = event.articleId;
              setState((prev) => ({ ...prev, articleId: event.articleId }));
            }
            setState((prev) => ({
              ...prev,
              steps: {
                ...prev.steps,
                article_generation: {
                  ...prev.steps.article_generation,
                  status: "running",
                  streamContent: (prev.steps.article_generation.streamContent ?? "") + event.content,
                },
              },
            }));
            break;

          case "done":
            articleIdRef.current = event.articleId;
            setState((prev) => ({
              ...prev,
              isRunning: false,
              articleId: event.articleId,
              wordCount: event.wordCount,
              steps: {
                ...prev.steps,
                article_generation: { ...prev.steps.article_generation, status: "complete" },
              },
            }));
            break;

          case "error":
            setState((prev) => ({
              ...prev,
              isRunning: false,
              error: event.error,
            }));
            break;
        }
      }
    },
    [updateStep]
  );

  const runAll = useCallback(
    (params: Omit<ResearchParams, "startFromStep">) => {
      run({ ...params, articleId: articleIdRef.current ?? params.articleId });
    },
    [run]
  );

  const runStep = useCallback(
    (step: StepName, params: Omit<ResearchParams, "startFromStep">) => {
      run({ ...params, startFromStep: step, articleId: articleIdRef.current ?? params.articleId });
    },
    [run]
  );

  /** Allow the user to manually edit a step's result data (e.g. remove a link) */
  const updateStepData = useCallback((step: StepName, data: unknown) => {
    updateStep(step, { data });
  }, [updateStep]);

  const hydrate = useCallback(
    (
      articleId: string,
      research: {
        serp_data?: unknown;
        internal_links?: unknown;
        external_links?: unknown;
        competition_analysis?: unknown;
        writing_plan?: string | null;
      } | null
    ) => {
      articleIdRef.current = articleId;
      setState({
        articleId,
        wordCount: null,
        error: null,
        isRunning: false,
        steps: {
          serp_research: research?.serp_data
            ? { status: "complete", data: research.serp_data }
            : { status: "idle" },
          internal_links: research?.internal_links
            ? { status: "complete", data: research.internal_links }
            : { status: "idle" },
          external_links: research?.external_links
            ? { status: "complete", data: research.external_links }
            : { status: "idle" },
          competition_analysis: research?.competition_analysis
            ? { status: "complete", data: research.competition_analysis }
            : { status: "idle" },
          writing_plan: research?.writing_plan
            ? { status: "complete", streamContent: research.writing_plan }
            : { status: "idle" },
          article_generation: { status: "complete" },
        },
      });
    },
    []
  );

  const reset = useCallback(() => {
    articleIdRef.current = null;
    setState({
      steps: initialSteps(),
      articleId: null,
      wordCount: null,
      error: null,
      isRunning: false,
    });
  }, []);

  return { ...state, runAll, runStep, updateStepData, reset, hydrate };
}
