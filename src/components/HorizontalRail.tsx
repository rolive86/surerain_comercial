"use client";

import { Children, useCallback, useLayoutEffect, useRef, useState } from "react";

function Chevron({ dir }: { dir: "prev" | "next" }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className="h-4 w-4" fill="none">
      <path
        d={dir === "prev" ? "M12.5 4.5 7 10l5.5 5.5" : "M7.5 4.5 13 10l-5.5 5.5"}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function HorizontalRail({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const itemCount = Children.count(children);

  const sync = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setCanPrev(el.scrollLeft > 8);
    setCanNext(max > 8 && el.scrollLeft < max - 8);
  }, []);

  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    sync();
    const frame = requestAnimationFrame(sync);
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    el.addEventListener("scroll", sync, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      el.removeEventListener("scroll", sync);
    };
  }, [sync, itemCount]);

  function step() {
    const el = scrollerRef.current;
    const card = el?.querySelector<HTMLElement>("[data-rail-card]");
    if (!el || !card) return el?.clientWidth ?? 240;
    const gap = Number.parseFloat(getComputedStyle(el).columnGap || getComputedStyle(el).gap) || 12;
    return card.getBoundingClientRect().width + gap;
  }

  function go(dir: -1 | 1) {
    scrollerRef.current?.scrollBy({ left: dir * step(), behavior: "smooth" });
  }

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-xl font-semibold text-sr-ink">{title}</h2>
          {subtitle ? <p className="text-sm text-sr-ink/50">{subtitle}</p> : null}
        </div>
        {itemCount > 2 ? (
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              aria-label="Ver productos anteriores"
              disabled={!canPrev}
              onClick={() => go(-1)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white text-sr-ink shadow-sm transition hover:border-sr-green/40 hover:text-sr-green disabled:pointer-events-none disabled:opacity-35"
            >
              <Chevron dir="prev" />
            </button>
            <button
              type="button"
              aria-label="Ver más productos"
              disabled={!canNext}
              onClick={() => go(1)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white text-sr-ink shadow-sm transition hover:border-sr-green/40 hover:text-sr-green disabled:pointer-events-none disabled:opacity-35"
            >
              <Chevron dir="next" />
            </button>
          </div>
        ) : null}
      </div>
      <div
        ref={scrollerRef}
        role="region"
        aria-label={title}
        className="flex items-stretch gap-3 overflow-x-auto overscroll-x-contain scroll-smooth snap-x snap-mandatory pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
    </section>
  );
}
