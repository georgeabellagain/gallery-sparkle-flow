import { useEffect, useRef, type RefObject } from "react";

export type TapSide = "left" | "middle" | "right";

interface Options {
  /** Gestures are ignored while this is false. */
  enabled: boolean;
  /** The current zoom (1 is not zoomed). Taps only turn pages when not zoomed in. */
  zoom: () => number;
  /** A quick touch with no movement. The side is by where it landed: the left 40%, the right 40%, or the middle. */
  onTap?: (side: TapSide) => void;
  /** Two fingers moving apart or together: the zoom they ask for, and where between them (0 to 1 across the element). */
  onPinch?: (zoom: number, x: number, y: number) => void;
  onPinchEnd?: () => void;
}

/** Things a finger may be pressing that are not "the page": buttons, links and so on keep their own meaning. */
const INTERACTIVE = "button, a, input, select, textarea, label, [role='dialog'], [role='toolbar'], [role='radiogroup']";

/** Tap to turn, and pinch to zoom, on a touch screen. Mouse and keyboard are not affected. */
export function useTouchGestures(ref: RefObject<HTMLElement | null>, options: Options) {
  const latest = useRef(options);
  latest.current = options;
  useEffect(() => {
    const element = ref.current;
    if (!element || !options.enabled) return;
    let tap: { x: number; y: number; at: number; target: EventTarget | null } | null = null;
    let pinch: { distance: number; zoom: number } | null = null;
    const distance = (touches: TouchList) => Math.hypot(touches[0]!.clientX - touches[1]!.clientX, touches[0]!.clientY - touches[1]!.clientY);

    // The rest of a gesture is heard on the element it began on, for as long as it lasts. If the page redraws that
    // element mid-gesture (a zoom step re-draws a page), the browser keeps sending the gesture to it even though it is
    // no longer in the page, so listening only on the container would lose the gesture half-way.
    const followed = new Set<EventTarget>();
    const follow = (target: EventTarget | null) => {
      if (!target || followed.has(target)) return;
      followed.add(target);
      target.addEventListener("touchmove", move as EventListener, { passive: true });
      target.addEventListener("touchend", end as EventListener, { passive: true });
      target.addEventListener("touchcancel", cancel as EventListener, { passive: true });
    };
    const letGo = () => {
      for (const target of followed) {
        target.removeEventListener("touchmove", move as EventListener);
        target.removeEventListener("touchend", end as EventListener);
        target.removeEventListener("touchcancel", cancel as EventListener);
      }
      followed.clear();
    };
    const start = (event: TouchEvent) => {
      if ((event.target as Element | null)?.closest?.("[data-foldout]")) { tap = null; pinch = null; return; }
      follow(event.target);
      if (!latest.current.enabled) {
        tap = null;
        pinch = null;
        return;
      }
      if (event.touches.length >= 2) {
        tap = null;
        pinch = { distance: Math.max(1, distance(event.touches)), zoom: latest.current.zoom() };
        return;
      }
      const touch = event.touches[0]!;
      tap = { x: touch.clientX, y: touch.clientY, at: performance.now(), target: event.target };
      pinch = null;
    };
    const move = (event: TouchEvent) => {
      if (pinch && event.touches.length >= 2) {
        const rect = element.getBoundingClientRect();
        const midX = (event.touches[0]!.clientX + event.touches[1]!.clientX) / 2;
        const midY = (event.touches[0]!.clientY + event.touches[1]!.clientY) / 2;
        latest.current.onPinch?.(pinch.zoom * (distance(event.touches) / pinch.distance), (midX - rect.left) / rect.width, (midY - rect.top) / rect.height);
        return;
      }
      const touch = event.touches[0];
      if (tap && touch && Math.hypot(touch.clientX - tap.x, touch.clientY - tap.y) > 10) tap = null;
    };
    const end = (event: TouchEvent) => {
      if (event.touches.length === 0) queueMicrotask(letGo);
      if (pinch) {
        if (event.touches.length < 2) {
          pinch = null;
          latest.current.onPinchEnd?.();
        }
        tap = null;
        return;
      }
      const touched = tap;
      tap = null;
      if (!touched || event.touches.length > 0 || !latest.current.enabled) return;
      if (performance.now() - touched.at > 450) return;
      if (latest.current.zoom() > 1.02) return;
      const target = touched.target as Element | null;
      if (target?.closest?.(INTERACTIVE)) return;
      const rect = element.getBoundingClientRect();
      const across = (touched.x - rect.left) / rect.width;
      latest.current.onTap?.(across < 0.4 ? "left" : across > 0.6 ? "right" : "middle");
    };
    const cancel = () => {
      queueMicrotask(letGo);
      tap = null;
      if (pinch) {
        pinch = null;
        latest.current.onPinchEnd?.();
      }
    };
    element.addEventListener("touchstart", start, { passive: true });
    return () => {
      element.removeEventListener("touchstart", start);
      letGo();
    };
  }, [ref, options.enabled]);
}

