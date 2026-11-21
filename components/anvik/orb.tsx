"use client";

import dynamic from "next/dynamic";
import { Component, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * The orb is the one "wow" element (owner brief) — kept small, monochrome and
 * modest. Three things matter here:
 *   1. It is lazy. The Three.js canvas is a separate chunk fetched after the
 *      page is interactive, so the first paint is text, not WebGL (audit M-3).
 *   2. It respects prefers-reduced-motion: a static sphere, no animation
 *      (audit L-2).
 *   3. If WebGL is missing or throws, the CSS sphere is already rendered
 *      underneath — there is never an empty hole.
 */

const Scene = dynamic(() => import("./orb-scene"), {
  ssr: false,
  loading: () => null,
});

function OrbFallback({ active = false }: { active?: boolean }) {
  return (
    <div className={`orb-fallback${active ? " orb-fallback-active" : ""}`} aria-hidden="true">
      <span className="fallback-ring fallback-ring-a" />
      <span className="fallback-ring fallback-ring-b" />
      <span className="fallback-core">
        <i />
        <i />
        <i />
      </span>
    </div>
  );
}

class OrbBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export default function Orb({ size = "large", active = false }: { size?: "large" | "small"; active?: boolean }) {
  const [mount, setMount] = useState(false);
  const [reduced, setReduced] = useState(true); // assume reduced until told otherwise
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (reduced) return;
    const node = host.current;
    if (!node) return;
    // Mount the canvas only when the orb is actually near the viewport.
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setMount(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [reduced]);

  const useWebgl = mount && !reduced;

  return (
    <div
      ref={host}
      className={`orb-wrap orb-${size}${active ? " orb-active" : ""}`}
      role="img"
      aria-label="A quiet sphere in deep green, the ANVIK mark in motion"
    >
      <OrbFallback active={active && !reduced} />
      {useWebgl && (
        <OrbBoundary fallback={null}>
          <div className="orb-canvas">
            <Scene count={size === "large" ? 48 : 16} active={active} />
          </div>
        </OrbBoundary>
      )}
    </div>
  );
}
