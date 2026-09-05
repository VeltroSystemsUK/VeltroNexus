export function isSafeCompanyNumber(value: string): boolean {
  return /^[A-Z0-9]{6,8}$/i.test(String(value || "").trim());
}

export function isSafeCampaignArg(value: string): boolean {
  const raw = String(value || "");
  return raw.length > 0 && raw.length <= 120 && /^[A-Za-z0-9 ,.\-\/&]+$/.test(raw);
}

export function leadFinderSpawnSpec(
  instruction: string,
  opts: { execPath: string; tsxCli: string; cliPath: string }
): { command: string; args: string[]; shell: false } {
  const trimmed = String(instruction || "").slice(0, 500);
  return {
    command: opts.execPath,
    args: [opts.tsxCli, opts.cliPath, "agent", trimmed],
    shell: false,
  };
}
