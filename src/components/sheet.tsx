"use client";

import { animate, motion, useDragControls, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

/** Where a flick would come to rest (Apple's scroll-deceleration projection). */
function project(velocity: number, decelerationRate = 0.998): number {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/**
 * iOS-style bottom sheet. It stays mounted, so every animation starts from where the sheet is
 * and how fast it's moving: it can be grabbed mid-flight, flicked away, or tugged back.
 * With reduced motion it cross-fades instead of sliding.
 */
export function Sheet({ open, onClose, label, children }: { open: boolean; onClose: () => void; label: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const releaseVelocity = useRef(0);
  const reduce = !!useReducedMotion();
  const controls = useDragControls();
  const y = useMotionValue(0);
  const fade = useMotionValue(1);
  const [shown, setShown] = useState(false);
  const scrim = useTransform(() => {
    const h = ref.current?.offsetHeight || 1;
    return fade.get() * Math.max(0, Math.min(1, 1 - y.get() / h));
  });

  if (open && !shown) setShown(true);

  // Park the sheet just below the screen before the first paint, so opening never flashes.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!open || !el || el.dataset.live) return;
    el.dataset.live = "1";
    if (reduce) {
      y.set(0);
      fade.set(0);
    } else {
      y.set(el.offsetHeight);
      el.style.transform = `translateY(${el.offsetHeight}px)`;
    }
  }, [open, reduce, y, fade]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !shown) return;
    if (open) {
      returnFocus.current = document.activeElement as HTMLElement | null;
      el.focus({ preventScroll: true });
      const a = reduce
        ? animate(fade, 1, { duration: 0.2, ease: "easeOut" })
        : animate(y, 0, { type: "spring", bounce: 0, duration: 0.42, velocity: y.getVelocity() });
      const root = document.documentElement;
      const prev = root.style.overflow;
      root.style.overflow = "hidden";
      return () => {
        a.stop();
        root.style.overflow = prev;
      };
    }
    const done = () => {
      delete el.dataset.live;
      setShown(false);
      returnFocus.current?.focus?.({ preventScroll: true });
    };
    const v = releaseVelocity.current || y.getVelocity();
    releaseVelocity.current = 0;
    const a = reduce
      ? animate(fade, 0, { duration: 0.2, ease: "easeOut", onComplete: done })
      : animate(y, el.offsetHeight, { type: "spring", bounce: 0, duration: 0.34, velocity: v, onComplete: done });
    return () => a.stop();
  }, [open, shown, reduce, y, fade]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div className={shown ? "fixed inset-0 z-50" : "pointer-events-none invisible fixed inset-0 z-50"} inert={!open || undefined}>
      <motion.div className="absolute inset-0 bg-black/35" style={{ opacity: scrim }} onClick={onClose} aria-hidden />
      <motion.div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        style={{ y, opacity: fade }}
        drag={reduce ? false : "y"}
        dragControls={controls}
        dragListener={false}
        dragConstraints={{ top: 0 }}
        dragElastic={{ top: 0.06, bottom: 1 }}
        dragMomentum={false}
        onDragEnd={(_, info) => {
          const h = ref.current?.offsetHeight ?? 600;
          if (y.get() + project(info.velocity.y) > h * 0.45) {
            releaseVelocity.current = info.velocity.y;
            onClose();
          } else {
            // Back home, carrying the finger's velocity; a little give only because the gesture had momentum.
            animate(y, 0, { type: "spring", bounce: Math.abs(info.velocity.y) > 300 ? 0.18 : 0, duration: 0.4, velocity: info.velocity.y });
          }
        }}
        className="absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col rounded-t-[28px] bg-bg pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_40px_-12px_rgb(0_0_0/0.3)] outline-none"
      >
        <div className="flex shrink-0 cursor-grab touch-none justify-center pt-2 pb-3 active:cursor-grabbing" onPointerDown={(e) => !reduce && controls.start(e)}>
          <span className="h-[5px] w-9 rounded-full bg-fill" />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6">{children}</div>
      </motion.div>
    </div>
  );
}
