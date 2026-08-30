const BASES = ["http://127.0.0.1:8188", "http://localhost:8188"];

const REMBG_CLASSES = [
  "Image Remove Background (rembg)",
  "RemoveBackground",
  "RMBG",
  "BiRefNet",
  "easy imageRemBg",
  "ImageRembg",
];

async function firstBase(): Promise<string | null> {
  for (const base of BASES) {
    try {
      const res = await fetch(`${base}/system_stats`, { signal: AbortSignal.timeout(1500) });
      if (res.ok) return base;
    } catch {
      // try next
    }
  }
  return null;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, body] = dataUrl.split(",");
  const mime = /data:(.*?);/.exec(header)?.[1] ?? "image/png";
  const bytes = atob(body);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

async function uploadImage(base: string, dataUrl: string): Promise<string> {
  const blob = dataUrlToBlob(dataUrl);
  const form = new FormData();
  form.append("image", blob, "craft-cutout.png");
  form.append("overwrite", "true");
  form.append("type", "input");
  const res = await fetch(`${base}/upload/image`, { method: "POST", body: form });
  if (!res.ok) throw new Error(`ComfyUI rejected the upload (${res.status})`);
  const data = await res.json();
  const name = data?.name ?? data?.image;
  if (!name || typeof name !== "string") throw new Error("ComfyUI did not return an uploaded filename.");
  return name;
}

async function findRemover(base: string): Promise<{ classType: string; imageIn: string; imageOut: number } | null> {
  for (const classType of REMBG_CLASSES) {
    try {
      const res = await fetch(`${base}/object_info/${encodeURIComponent(classType)}`, { signal: AbortSignal.timeout(2000) });
      if (!res.ok) continue;
      const data = await res.json();
      const info = data?.[classType];
      if (!info) continue;
      const required = info.input?.required ?? {};
      const imageIn = Object.keys(required).find((key) => {
        const spec = required[key];
        return Array.isArray(spec) && spec[0] === "IMAGE";
      }) ?? "image";
      return { classType, imageIn, imageOut: 0 };
    } catch {
      // try next class
    }
  }
  return null;
}

async function waitForImage(base: string, promptId: string, signal?: AbortSignal): Promise<{ filename: string; subfolder?: string; type?: string }> {
  const started = Date.now();
  while (Date.now() - started < 1000 * 60 * 8) {
    if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
    const res = await fetch(`${base}/history/${promptId}`, { signal });
    if (res.ok) {
      const history = await res.json();
      const outputs = history?.[promptId]?.outputs ?? {};
      const image = Object.values(outputs)
        .flatMap((output: any) => output?.images ?? [])
        .find(Boolean);
      if (image?.filename) return image;
    }
    await new Promise((resolve) => setTimeout(resolve, 800));
  }
  throw new Error("Background removal timed out.");
}

async function viewImage(base: string, image: { filename: string; subfolder?: string; type?: string }): Promise<string> {
  const params = new URLSearchParams({
    filename: image.filename,
    subfolder: image.subfolder ?? "",
    type: image.type ?? "output",
  });
  const res = await fetch(`${base}/view?${params.toString()}`);
  if (!res.ok) throw new Error("Could not load the cut-out.");
  const blob = await res.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function removeWithComfy(dataUrl: string, signal?: AbortSignal): Promise<string> {
  const base = await firstBase();
  if (!base) throw new Error("offline");
  const remover = await findRemover(base);
  if (!remover) throw new Error("no-node");
  const filename = await uploadImage(base, dataUrl);
  const workflow = {
    "1": { class_type: "LoadImage", inputs: { image: filename } },
    "2": { class_type: remover.classType, inputs: { [remover.imageIn]: ["1", 0] } },
    "3": { class_type: "SaveImage", inputs: { images: ["2", remover.imageOut], filename_prefix: "QUIRES_CRAFT_RMBG" } },
  };
  const queued = await fetch(`${base}/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: workflow }),
    signal,
  });
  if (!queued.ok) throw new Error(`ComfyUI rejected rembg (${queued.status})`);
  const data = await queued.json();
  if (!data.prompt_id) throw new Error("ComfyUI did not queue rembg.");
  const image = await waitForImage(base, data.prompt_id, signal);
  return viewImage(base, image);
}

export function localRemoveBackground(dataUrl: string, threshold = 42): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not process the image."));
        return;
      }
      ctx.drawImage(img, 0, 0);
      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const { data, width, height } = frame;
      const sample = (x: number, y: number) => {
        const i = (y * width + x) * 4;
        return [data[i], data[i + 1], data[i + 2]];
      };
      const corners = [sample(0, 0), sample(width - 1, 0), sample(0, height - 1), sample(width - 1, height - 1)];
      const bg = corners.reduce(
        (acc, rgb) => [acc[0] + rgb[0] / 4, acc[1] + rgb[1] / 4, acc[2] + rgb[2] / 4],
        [0, 0, 0],
      );
      for (let i = 0; i < data.length; i += 4) {
        const dr = data[i] - bg[0];
        const dg = data[i + 1] - bg[1];
        const db = data[i + 2] - bg[2];
        const dist = Math.sqrt(dr * dr + dg * dg + db * db);
        if (dist < threshold) data[i + 3] = 0;
        else if (dist < threshold + 24) data[i + 3] = Math.round(((dist - threshold) / 24) * 255);
      }
      ctx.putImageData(frame, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("Could not read the image."));
    img.src = dataUrl;
  });
}

export async function removeBackground(dataUrl: string, signal?: AbortSignal): Promise<{ dataUrl: string; method: "comfy" | "local" }> {
  try {
    return { dataUrl: await removeWithComfy(dataUrl, signal), method: "comfy" };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    return { dataUrl: await localRemoveBackground(dataUrl), method: "local" };
  }
}
