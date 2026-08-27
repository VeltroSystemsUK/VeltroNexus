import { LocalStorageClient as ObjectStorageClient } from "../localStorage";

// Memoized object storage singleton — shared across all router files that need it.
// The let must be at module scope so all importers share the same instance.
let _objectStorage: ObjectStorageClient | null = null;

export function getObjectStorage(): ObjectStorageClient {
    if (_objectStorage) return _objectStorage;
    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID || "local";
    _objectStorage = new ObjectStorageClient({ bucketId });
    return _objectStorage;
}

// CSV line parser that handles quoted values and escaped quotes.
// Used by the leads upload route.
export function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === "," && !inQuotes) {
            result.push(current);
            current = "";
        } else {
            current += char;
        }
    }
    result.push(current);
    return result;
}
