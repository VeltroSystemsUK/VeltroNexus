export function parseCollectionsStore(raw: string): Record<string, unknown[]> {
  const data = JSON.parse(raw);
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("collections store is not an object");
  }
  return data as Record<string, unknown[]>;
}

/** Keep collections that a stale writer omitted, so one key update cannot wipe the rest. */
export function mergeCollections(
  onDisk: Record<string, unknown[]>,
  incoming: Record<string, unknown[]>,
): Record<string, unknown[]> {
  return { ...onDisk, ...incoming };
}
