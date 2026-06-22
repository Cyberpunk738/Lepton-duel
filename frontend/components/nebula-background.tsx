"use client";

import { useEffect, useRef } from "react";
import { NEBULA } from "@/lib/unicorn";

interface UnicornScene {
  destroy: () => void;
}

interface UnicornStudioApi {
  addScene: (options: {
    element: HTMLElement;
    projectId: string;
    fps: number;
    scale: number;
    dpi: number;
    lazyLoad: boolean;
    interactivity: { mouse: { disabled: boolean } };
  }) => Promise<UnicornScene>;
}

declare global {
  interface Window {
    UnicornStudio?: UnicornStudioApi;
  }
}

let sdkPromise: Promise<UnicornStudioApi> | null = null;

function loadSdk(): Promise<UnicornStudioApi> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.UnicornStudio) return Promise.resolve(window.UnicornStudio);
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = NEBULA.sdkUrl;
    script.async = true;
    script.onload = () => {
      if (window.UnicornStudio) {
        resolve(window.UnicornStudio);
        return;
      }
      sdkPromise = null;
      reject(new Error("UnicornStudio unavailable after load"));
    };
    script.onerror = () => {
      sdkPromise = null;
      reject(new Error("UnicornStudio failed to load"));
    };
    document.head.appendChild(script);
  });

  return sdkPromise;
}

function isDisabled(): boolean {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return true;
  const canvas = document.createElement("canvas");
  return !(canvas.getContext("webgl") || canvas.getContext("experimental-webgl"));
}

export function NebulaBackground() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || isDisabled()) return;

    let scene: UnicornScene | null = null;
    let cancelled = false;

    loadSdk()
      .then((api) =>
        api.addScene({
          element: container,
          projectId: NEBULA.projectId,
          fps: NEBULA.fps,
          scale: NEBULA.scale,
          dpi: NEBULA.dpi,
          lazyLoad: false,
          interactivity: { mouse: { disabled: true } },
        }),
      )
      .then((created) => {
        if (cancelled) {
          created.destroy();
          return;
        }
        scene = created;
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      scene?.destroy();
      scene = null;
    };
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-screen opacity-50 mix-blend-screen brightness-50 saturate-0 [mask-image:linear-gradient(to_bottom,#000_0%,#000_80%,transparent)]"
    >
      <div ref={containerRef} className="absolute inset-0" />
    </div>
  );
}
