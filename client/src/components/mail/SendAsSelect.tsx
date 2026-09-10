import { AGENT_DIRECTORY } from "@shared/agentMailboxes";

export function SendAsSelect({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (agentId: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
      <span className="shrink-0">Send as</span>
      <select
        data-testid="select-send-as"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 max-w-[16rem] rounded-md border border-input bg-background px-2 text-sm text-foreground"
      >
        {AGENT_DIRECTORY.map((row) => (
          <option key={row.agentId} value={row.agentId}>
            {row.displayName} · {row.role}
          </option>
        ))}
      </select>
    </label>
  );
}
