export async function resultWithin<T>(work: Promise<T>, ms: number): Promise<T | null> {
  try {
    return await Promise.race([
      work,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
    ]);
  } catch {
    return null;
  }
}
