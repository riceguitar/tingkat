"use client";

import { useEffect, useRef } from "react";
import { Crepe, CrepeFeature } from "@milkdown/crepe";
import "@milkdown/crepe/theme/classic.css";

interface MilkdownEditorProps {
  value: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
  minHeight?: string;
}

async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/upload-image", { method: "POST", body: formData });
  if (!res.ok) throw new Error("Upload failed");
  const data = await res.json();
  return data.url ?? "";
}

export function MilkdownEditor({
  value,
  onChange,
  placeholder = "Start writing your article...",
  minHeight = "500px",
}: MilkdownEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!containerRef.current) return;

    const crepe = new Crepe({
      root: containerRef.current,
      defaultValue: value,
      features: {
        [CrepeFeature.Latex]: false,
      },
      featureConfigs: {
        [CrepeFeature.ImageBlock]: {
          onUpload: uploadImage,
        },
        [CrepeFeature.Placeholder]: {
          text: placeholder,
        },
      },
    });

    crepe.on((listener) => {
      listener.markdownUpdated((_ctx, markdown) => {
        onChangeRef.current(markdown);
      });
    });

    crepe.create();

    return () => {
      crepe.destroy();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ minHeight }}
      className="milkdown-wrapper rounded-md border bg-background"
    />
  );
}
