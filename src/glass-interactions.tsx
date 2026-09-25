import { useEffect } from "react";

// The same panels receive their optical treatment in surface-glass.css.
const surfaces =
  ".card, .workout-feature, .ai-banner, .empty-meal, .training-intro, .running-banner, .consistency-card, .history-row, .item-editor, .session-exercise, .plan-day-editor, .food-library, .assistant-context, .assistant-answer details, .formula-details, .meal-total, .upload-zone, .photo-analysis, .workout-focus, .auth-form-box";

/** A single delegated listener: no React renders, timers or per-card listeners on hover. */
export function GlassInteractions() {
  useEffect(() => {
    const pointer = matchMedia("(hover: hover) and (pointer: fine)");
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const contrast = matchMedia("(prefers-contrast: more)");
    const transparency = matchMedia("(prefers-reduced-transparency: reduce)");
    let active: HTMLElement | null = null;
    let frame = 0;
    let x = 0;
    let y = 0;
    const clear = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      active?.removeAttribute("data-glass-hover");
      active?.style.removeProperty("--glass-x");
      active?.style.removeProperty("--glass-y");
      active = null;
    };
    const move = (event: PointerEvent) => {
      if (
        !pointer.matches ||
        reduced.matches ||
        contrast.matches ||
        transparency.matches ||
        event.pointerType !== "mouse"
      ) {
        clear();
        return;
      }
      const target =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>(surfaces)
          : null;
      if (!target || target.matches(":disabled, [aria-disabled=true]")) {
        clear();
        return;
      }
      if (target !== active) {
        clear();
        active = target;
        active.setAttribute("data-glass-hover", "");
      }
      x = event.clientX;
      y = event.clientY;
      if (!frame)
        frame = requestAnimationFrame(() => {
          frame = 0;
          if (!active?.isConnected) {
            clear();
            return;
          }
          const rect = active.getBoundingClientRect();
          active.style.setProperty(
            "--glass-x",
            `${Math.max(0, Math.min(100, ((x - rect.left) / Math.max(1, rect.width)) * 100))}%`,
          );
          active.style.setProperty(
            "--glass-y",
            `${Math.max(0, Math.min(100, ((y - rect.top) / Math.max(1, rect.height)) * 100))}%`,
          );
        });
    };
    const leave = (event: PointerEvent) => {
      if (!event.relatedTarget) clear();
    };
    const hidden = () => {
      if (document.hidden) clear();
    };
    document.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerout", leave, { passive: true });
    document.addEventListener("visibilitychange", hidden);
    document.addEventListener("scroll", clear, {
      passive: true,
      capture: true,
    });
    window.addEventListener("blur", clear);
    const preferences = [pointer, reduced, contrast, transparency];
    preferences.forEach((query) => query.addEventListener("change", clear));
    return () => {
      clear();
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerout", leave);
      document.removeEventListener("visibilitychange", hidden);
      document.removeEventListener("scroll", clear, true);
      window.removeEventListener("blur", clear);
      preferences.forEach((query) =>
        query.removeEventListener("change", clear),
      );
    };
  }, []);
  return null;
}
