
import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";

export class LocalStorageClient {
    private baseDir: string;

    constructor(options: { bucketId?: string; baseDir?: string }) {
        // Store uploads in "uploads" directory in project root
        this.baseDir = options.baseDir || path.resolve(process.cwd(), "uploads");
        if (!fs.existsSync(this.baseDir)) {
            fs.mkdirSync(this.baseDir, { recursive: true });
        }
    }

    async uploadFromStream(key: string, stream: Readable): Promise<void> {
        const filePath = path.join(this.baseDir, key);
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            await fs.promises.mkdir(dir, { recursive: true });
        }
        const writeStream = fs.createWriteStream(filePath);
        await pipeline(stream, writeStream);
    }

    async downloadAsBytes(key: string): Promise<{ data: Uint8Array }> {
        const filePath = path.join(this.baseDir, key);
        if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${key}`);
        }
        const buffer = await fs.promises.readFile(filePath);
        return { data: buffer };
    }

    async delete(key: string): Promise<void> {
        const filePath = path.join(this.baseDir, key);
        if (fs.existsSync(filePath)) {
            await fs.promises.unlink(filePath);
        }
    }

    async list(options: { prefix?: string }): Promise<{ objects: { key: string }[] }> {
        return { objects: [] };
    }
}
