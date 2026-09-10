import { formatAsBulletPoints } from "@/lib/formatBulletPoints";
import { cn } from "@/lib/utils";

export function BulletList({
  text,
  className,
  testId,
}: {
  text?: string | null;
  className?: string;
  testId?: string;
}) {
  const items = formatAsBulletPoints(text);
  if (!items.length) return null;
  return (
    <ul className={cn("space-y-1.5 text-sm", className)} data-testid={testId}>
      {items.map((item, i) => (
        <li key={`${i}-${item.slice(0, 24)}`} className="flex gap-2 items-start">
          <span className="text-primary mt-0.5 shrink-0 leading-5">•</span>
          <span className="leading-5">{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function BulletField({
  value,
  onChange,
  placeholder = "One bullet per line",
  disabled,
  testId,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  disabled?: boolean;
  testId?: string;
}) {
  const items = formatAsBulletPoints(value);
  const lines = items.length ? items : [""];

  const commit = (next: string[]) => {
    onChange(
      next
        .map((line) => line.replace(/\n/g, " ").trimEnd())
        .join("\n")
        .replace(/\n+$/, "")
    );
  };

  return (
    <div
      className="rounded-md border bg-background px-3 py-2 space-y-1"
      data-testid={testId}
    >
      {lines.map((item, i) => (
        <div key={i} className="flex gap-2 items-start">
          <span className="text-primary mt-1.5 shrink-0 leading-none">•</span>
          <textarea
            rows={1}
            disabled={disabled}
            placeholder={i === 0 ? placeholder : "Next bullet"}
            value={item}
            className="flex-1 resize-none bg-transparent py-1 text-sm leading-5 outline-none min-h-[1.75rem]"
            onChange={(event) => {
              const next = [...lines];
              next[i] = event.target.value.replace(/\n/g, " ");
              commit(next);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                const next = [...lines];
                next.splice(i + 1, 0, "");
                commit(next);
              }
            }}
          />
        </div>
      ))}
      <p className="text-[11px] text-muted-foreground pt-1">Enter adds a bullet. No paragraphs.</p>
    </div>
  );
}
