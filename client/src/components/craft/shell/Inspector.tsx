import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

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
        'flex w-72 shrink-0 flex-col border-l border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--bg-raised)_88%,transparent)]',
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
