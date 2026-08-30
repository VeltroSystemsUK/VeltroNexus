import type { ReactNode } from 'react';
import { VIEWPORT_HINT } from '../canvas/viewport';

export function StatusBar({
  zoom,
  onZoomOut,
  onZoomIn,
  onReset,
  trailing,
}: {
  zoom?: number;
  onZoomOut?: () => void;
  onZoomIn?: () => void;
  onReset?: () => void;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex h-8 shrink-0 items-center gap-2 border-t border-border px-3 text-[11px] text-muted-foreground">
      {zoom !== undefined && (
        <>
          <button type="button" className="hover:text-foreground" onClick={onZoomOut} aria-label="Zoom out">−</button>
          <span className="tabular-nums">{Math.round(zoom * 100)}%</span>
          <button type="button" className="hover:text-foreground" onClick={onZoomIn} aria-label="Zoom in">+</button>
          {onReset && (
            <button type="button" className="hover:text-foreground" onClick={onReset} aria-label="Fit board">Fit</button>
          )}
          <span className="hidden sm:inline">· {VIEWPORT_HINT}</span>
        </>
      )}
      <span className="ml-auto flex items-center gap-2">{trailing}</span>
    </div>
  );
}
