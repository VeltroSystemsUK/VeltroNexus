import { useEffect, useRef } from "react";

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
}


export function useAutosave(dirty: boolean, save: () => Promise<void>, delay = 2500): void {
  const saveRef = useRef(save);
  saveRef.current = save;

  useEffect(() => {
    if (!dirty) return;
    const timer = window.setTimeout(() => {
      void saveRef.current();
    }, delay);
    return () => window.clearTimeout(timer);
  }, [dirty, delay]);
}
