import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { CRAFT_SWATCHES, toColorInput } from '../lib/looks';

export function InspectorRail({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <aside
      className={cn(
        'flex h-full min-h-0 w-72 shrink-0 flex-col overflow-hidden border-l border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--bg-raised)_88%,transparent)]',
        className,
      )}
    >
      <header className="flex h-10 shrink-0 items-center border-b border-[var(--border-subtle)] px-3">
        <h2 className="font-[family-name:var(--font-ui)] text-[10px] font-bold tracking-[0.16em] text-muted-foreground uppercase">
          {title}
        </h2>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </aside>
  );
}

export function InspectorSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2 border-b border-[var(--border-subtle)] px-3 py-3 last:border-b-0">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-[family-name:var(--font-ui)] text-[10px] font-bold tracking-[0.14em] text-[var(--suite-accent)] uppercase">
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export function ColorPicker({
  value,
  onChange,
  label,
  compact,
}: {
  value: string;
  onChange: (hex: string) => void;
  label?: string;
  compact?: boolean;
}) {
  const hex = toColorInput(value);
  return (
    <div className="grid gap-1.5">
      {label ? <p className="text-[11px] text-muted-foreground">{label}</p> : null}
      <div className="grid grid-cols-8 gap-1">
        {CRAFT_SWATCHES.map((color) => (
          <button
            key={color}
            type="button"
            title={color}
            aria-label={color}
            className={cn(
              compact ? "h-4 w-full rounded-sm border border-white/20" : "h-5 w-full rounded-sm border border-black/20",
              hex.toLowerCase() === color.toLowerCase() ? "ring-2 ring-[var(--suite-accent)] ring-offset-1 ring-offset-background" : "",
            )}
            style={{ background: color }}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onChange(color)}
          />
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <input
          type="color"
          aria-label={label ? `${label} picker` : "Colour picker"}
          className="h-8 w-12 cursor-pointer rounded border border-input bg-transparent"
          value={hex}
          onChange={(event) => onChange(event.target.value)}
        />
        <input
          value={hex}
          aria-label={label ? `${label} hex` : "Colour hex"}
          className="h-8 min-w-0 flex-1 rounded-lg border border-input bg-transparent px-2 font-mono text-[11px] uppercase"
          maxLength={7}
          onChange={(event) => {
            const next = event.target.value.trim();
            if (/^#[0-9a-fA-F]{6}$/.test(next)) onChange(next);
            else if (/^[0-9a-fA-F]{6}$/.test(next)) onChange(`#${next}`);
          }}
        />
      </div>
    </div>
  );
}

export function InspectorHint({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] leading-relaxed text-muted-foreground">{children}</p>
  );
}

export function InspectorSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
}) {
  return (
    <label className="grid grid-cols-[4.6rem_1fr_2.4rem] items-center gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step ?? 1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="accent-[var(--suite-accent)]"
      />
      <span className="tabular-nums text-right text-muted-foreground">
        {format ? format(value) : Math.round(value)}
      </span>
    </label>
  );
}
