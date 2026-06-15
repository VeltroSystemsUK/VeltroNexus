import { Router } from "express";
import type { Request, Response } from "express";
import busboy from "busboy";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { isAuthenticated } from "../auth";
import { handleApiError } from "../utils/errorHandler";
import { isSvgContent, hasValidImageMagicBytes } from "../utils/security";
import { PassThrough, Transform } from "stream";
import { ai, DEFAULT_GEMINI_MODEL } from "../utils/geminiClient";

const router = Router();

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp"];

const MEDIA_METADATA_FILE = path.resolve(process.cwd(), "uploads", "media_metadata.json");

interface MediaAsset {
  id: string;
  userId: string;
  filename: string;
  url: string;
  size: number;
  mimeType: string;
  category: string;
  isStock: boolean;
  credit?: string;
  createdAt: string;
}

function readMediaMetadata(): Record<string, MediaAsset> {
  try {
    if (!fs.existsSync(MEDIA_METADATA_FILE)) {
      const dir = path.dirname(MEDIA_METADATA_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(MEDIA_METADATA_FILE, JSON.stringify({}));
      return {};
    }
    const data = fs.readFileSync(MEDIA_METADATA_FILE, "utf8");
    return JSON.parse(data);
  } catch (err) {
    console.error("[Media] Error reading media metadata file:", err);
    return {};
  }
}

function writeMediaMetadata(metadata: Record<string, MediaAsset>) {
  try {
    const dir = path.dirname(MEDIA_METADATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(MEDIA_METADATA_FILE, JSON.stringify(metadata, null, 2));
  } catch (err) {
    console.error("[Media] Error writing media metadata file:", err);
  }
}

// Upload a media file
router.post(
  "/media/upload",
  isAuthenticated,
  (req: Request, res: Response) => {
    const userId = req.user!.id;

    const contentType = req.headers["content-type"];
    if (!contentType?.startsWith("multipart/form-data")) {
      return res.status(400).json({ error: "Content-Type must be multipart/form-data" });
    }

    let uploadPromise: Promise<{ id: string; url: string; filename: string }> | null = null;
    let validationError: string | null = null;

    try {
      const bb = busboy({
        headers: req.headers,
        limits: { fileSize: MAX_FILE_SIZE, files: 1 },
      });

      let categoryValue = "uncategorised";
      bb.on("field", (name: string, val: string) => {
        if (name === "category") categoryValue = val;
      });

      bb.on("file", (fieldname, fileStream, info) => {
        const { filename, mimeType } = info;

        const normalizedMime = mimeType.toLowerCase().split(";")[0].trim();
        const extension = (filename.split(".").pop() || "").toLowerCase();
        const isSvgExtension = extension === "svg" || extension === "svgz";
        const isSvgMime = normalizedMime === "image/svg+xml";

        if (!normalizedMime.startsWith("image/") || isSvgMime || isSvgExtension) {
          validationError = isSvgMime || isSvgExtension
            ? "SVG files are not allowed for security reasons."
            : "Only image files are allowed.";
          fileStream.resume();
          return;
        }

        if (!ALLOWED_EXTENSIONS.includes(extension)) {
          validationError = `File extension '.${extension}' is not allowed. Use PNG, JPEG, GIF, or WebP.`;
          fileStream.resume();
          return;
        }

        const timestamp = Date.now();
        const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
        const storagePath = `media/${userId}/${timestamp}_${safeFilename}`;
        const localFilePath = path.resolve(process.cwd(), "uploads", storagePath);

        uploadPromise = (async () => {
          const dir = path.dirname(localFilePath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          const writeStream = fs.createWriteStream(localFilePath);

          let limitExceeded = false;
          let magicBytesValidated = false;
          let accumulatedBuffer: Buffer = Buffer.alloc(0);
          let totalSize = 0;
          const MAX_VALIDATION_SIZE = 4096;

          fileStream.on("limit", () => {
            limitExceeded = true;
            validationError = "File must be under 5MB";
            writeStream.destroy(new Error("File size limit exceeded"));
          });

          const validationTransform = new Transform({
            transform(chunk, encoding, callback) {
              totalSize += chunk.length;

              if (accumulatedBuffer.length < MAX_VALIDATION_SIZE) {
                accumulatedBuffer = Buffer.concat([accumulatedBuffer, chunk]);
              }

              if (!magicBytesValidated && accumulatedBuffer.length >= 12) {
                if (!hasValidImageMagicBytes(accumulatedBuffer)) {
                  validationError = "Invalid image file - content does not match a recognized image format.";
                  writeStream.destroy(new Error(validationError));
                  return;
                }
                magicBytesValidated = true;
              }

              if (isSvgContent(accumulatedBuffer)) {
                validationError = "File content appears to be SVG disguised as another format.";
                writeStream.destroy(new Error(validationError));
                return;
              }

              if (magicBytesValidated) {
                callback(null, chunk);
              } else {
                callback();
              }
            },
            flush(callback) {
              if (!magicBytesValidated && accumulatedBuffer.length > 0) {
                if (!hasValidImageMagicBytes(accumulatedBuffer)) {
                  validationError = "Invalid image file.";
                  writeStream.destroy(new Error(validationError));
                  return;
                }
                if (isSvgContent(accumulatedBuffer)) {
                  validationError = "File content appears to be SVG disguised as another format.";
                  writeStream.destroy(new Error(validationError));
                  return;
                }
                this.push(accumulatedBuffer);
              }
              callback();
            },
          });

          return new Promise<{ id: string; url: string; filename: string }>((resolve, reject) => {
            fileStream.pipe(validationTransform).pipe(writeStream);

            writeStream.on("error", (err) => {
              reject(err);
            });

            writeStream.on("finish", async () => {
              if (limitExceeded || validationError) {
                try { fs.unlinkSync(localFilePath); } catch {}
                reject(new Error(validationError || "File size limit exceeded"));
                return;
              }

              try {
                const publicUrl = `/uploads/${storagePath}`;
                const docId = crypto.randomUUID();
                
                const metadata = readMediaMetadata();
                metadata[docId] = {
                  id: docId,
                  userId,
                  filename: safeFilename,
                  url: publicUrl,
                  size: totalSize,
                  mimeType: normalizedMime,
                  category: categoryValue,
                  isStock: false,
                  createdAt: new Date().toISOString(),
                };
                writeMediaMetadata(metadata);

                resolve({ id: docId, url: publicUrl, filename: safeFilename });
              } catch (err) {
                reject(err);
              }
            });
          });
        })();
      });

      bb.on("close", async () => {
        try {
          if (validationError) {
            return res.status(400).json({ error: validationError });
          }
          if (!uploadPromise) {
            return res.status(400).json({ error: "No file uploaded" });
          }
          const result = await uploadPromise;
          res.json(result);
        } catch (error: any) {
          console.error("Error completing media upload:", error);
          if (!res.headersSent) {
            handleApiError(res, error, "api-error");
          }
        }
      });

      bb.on("error", (error: any) => {
        console.error("Busboy error:", error);
        if (!res.headersSent) {
          handleApiError(res, error, "api-error");
        }
      });

      req.pipe(bb);
    } catch (error: any) {
      console.error("Error uploading media:", error);
      if (!res.headersSent) {
        handleApiError(res, error, "api-error");
      }
    }
  }
);

// List user's media files (supports ?type=mine|stock and ?category= filtering)
router.get("/media", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const type = (req.query.type as string) || "mine";
    const category = req.query.category as string | undefined;

    let assets: MediaAsset[] = [];
    const metadata = readMediaMetadata();

    if (type === "mine") {
      assets = Object.values(metadata)
        .filter((asset) => asset.userId === userId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (type === "stock") {
      assets = Object.values(metadata)
        .filter((asset) => asset.isStock === true);
      if (category && category !== "all") {
        assets = assets.filter((asset) => asset.category === category);
      }
      assets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    res.json(assets);
  } catch (error: any) {
    console.error("Error listing media:", error);
    handleApiError(res, error, "api-error");
  }
});

// Delete a media file
router.delete("/media/:id", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const metadata = readMediaMetadata();
    const asset = metadata[id];
    if (!asset) {
      return res.status(404).json({ error: "Media asset not found" });
    }

    if (asset.isStock) {
      return res.status(403).json({ error: "Stock library images cannot be deleted" });
    }
    if (asset.userId !== userId) {
      return res.status(403).json({ error: "Not authorized to delete this asset" });
    }

    // Extract storage path from URL
    const urlPrefix = "/uploads/";
    if (asset.url.startsWith(urlPrefix)) {
      const storagePath = asset.url.slice(urlPrefix.length);
      const localFilePath = path.resolve(process.cwd(), "uploads", storagePath);
      try {
        if (fs.existsSync(localFilePath)) {
          fs.unlinkSync(localFilePath);
        }
      } catch (err: any) {
        console.warn("Could not delete file from local storage:", err.message);
      }
    }

    delete metadata[id];
    writeMediaMetadata(metadata);
    res.json({ message: "Media asset deleted" });
  } catch (error: any) {
    console.error("Error deleting media:", error);
    handleApiError(res, error, "api-error");
  }
});

// Search for images using Unsplash API (free, no key needed for small volume)
router.get("/media/search-images", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string;
    if (!query) return res.status(400).json({ error: "Query parameter 'q' is required" });

    const searchUrl = `https://unsplash.com/napi/search/photos?query=${encodeURIComponent(query)}&per_page=20&content_filter=high`;

    const response = await fetch(searchUrl, {
      headers: {
        "Accept": "application/json",
        "Accept-Version": "v1",
      },
    });

    if (!response.ok) {
      console.error("[Media Search] Unsplash API error:", response.status);
      return res.status(502).json({ error: "Image search service unavailable" });
    }

    const data = await response.json();
    const images = (data.results || []).map((photo: any) => ({
      url: photo.urls?.regular || photo.urls?.full || "",
      thumbnail: photo.urls?.small || photo.urls?.thumb || "",
      description: photo.description || photo.alt_description || "",
      credit: photo.user?.name || "Unknown",
      source: "unsplash",
    }));

    res.json({ images });
  } catch (error: any) {
    console.error("Error searching images:", error);
    handleApiError(res, error, "api-error");
  }
});

// AI image generation - takes a source image and prompt, generates a new variation
router.post("/media/ai-generate", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { sourceUrl, prompt } = req.body;
    if (!sourceUrl || !prompt) {
      return res.status(400).json({ error: "sourceUrl and prompt are required" });
    }

    const userId = req.user!.id;

    // Fetch the source image
    const imgResponse = await fetch(sourceUrl);
    if (!imgResponse.ok) {
      return res.status(400).json({ error: "Could not fetch source image" });
    }

    const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());
    const contentType = imgResponse.headers.get("content-type") || "image/jpeg";

    // Use Gemini to generate a new image based on the source and prompt
    const result = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: contentType,
                data: imgBuffer.toString("base64"),
              },
            },
            {
              text: `Based on this image, create a new professional marketing image. Instructions: ${prompt}.

              Generate a new image that follows these instructions while maintaining a professional, clean aesthetic suitable for business email marketing campaigns.`,
            },
          ],
        },
      ],
      config: {
        responseModalities: ["TEXT", "IMAGE"],
      } as any,
    });

    // Check for generated image in the response
    const parts = (result as any).candidates?.[0]?.content?.parts || [];
    let generatedImageData: string | null = null;
    let generatedMimeType = "image/png";

    for (const part of parts) {
      if (part.inlineData) {
        generatedImageData = part.inlineData.data;
        generatedMimeType = part.inlineData.mimeType || "image/png";
        break;
      }
    }

    if (!generatedImageData) {
      return res.status(422).json({
        error: "AI could not generate an image. Try a different prompt or source image.",
      });
    }

    const extension = generatedMimeType.split("/")[1] || "png";
    const filename = `ai-generated-${Date.now()}.${extension}`;
    const storagePath = `media/${userId}/${filename}`;
    const localFilePath = path.resolve(process.cwd(), "uploads", storagePath);
    
    const dir = path.dirname(localFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const imageBuffer = Buffer.from(generatedImageData, "base64");
    fs.writeFileSync(localFilePath, imageBuffer);

    const publicUrl = `/uploads/${storagePath}`;

    // Store metadata
    const docId = crypto.randomUUID();
    const metadata = readMediaMetadata();
    metadata[docId] = {
      id: docId,
      userId,
      filename,
      url: publicUrl,
      size: imageBuffer.length,
      mimeType: generatedMimeType,
      category: "uncategorised",
      isStock: false,
      createdAt: new Date().toISOString(),
    };
    writeMediaMetadata(metadata);

    res.json({ id: docId, url: publicUrl, filename });
  } catch (error: any) {
    console.error("Error generating AI image:", error);
    handleApiError(res, error, "ai-generate");
  }
});

// Seed stock library with curated images
router.post("/media/seed-stock", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const metadata = readMediaMetadata();
    const hasStock = Object.values(metadata).some((asset) => asset.isStock);

    if (hasStock) {
      return res.status(409).json({ error: "Stock library already seeded" });
    }

    const stockImages = getStockImageData();
    for (const img of stockImages) {
      const docId = crypto.randomUUID();
      metadata[docId] = {
        id: docId,
        userId: "__stock__",
        filename: img.filename,
        url: img.url,
        size: 0,
        mimeType: "image/jpeg",
        category: img.category,
        isStock: true,
        credit: img.credit,
        createdAt: new Date().toISOString(),
      };
    }
    writeMediaMetadata(metadata);

    res.json({ message: "Stock library seeded", count: stockImages.length });
  } catch (error: any) {
    console.error("Error seeding stock library:", error);
    handleApiError(res, error, "api-error");
  }
});

function getStockImageData() {
  return [
    // === Business & Corporate ===
    { filename: "business-meeting-team.jpg", url: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=800&q=80", category: "business_corporate", credit: "Austin Distel" },
    { filename: "professional-handshake.jpg", url: "https://images.unsplash.com/photo-1521791136064-7986c2920216?w=800&q=80", category: "business_corporate", credit: "Cytonn Photography" },
    { filename: "modern-office-space.jpg", url: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80", category: "business_corporate", credit: "Alex Kotliarskyi" },
    { filename: "team-collaboration.jpg", url: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&q=80", category: "business_corporate", credit: "Annie Spratt" },
    { filename: "boardroom-discussion.jpg", url: "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=800&q=80", category: "business_corporate", credit: "Campaign Creators" },
    { filename: "startup-workspace.jpg", url: "https://images.unsplash.com/photo-1553877522-43269d4ea984?w=800&q=80", category: "business_corporate", credit: "Memento Media" },
    { filename: "business-strategy.jpg", url: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&q=80", category: "business_corporate", credit: "Scott Graham" },

    // === Finance & Banking ===
    { filename: "financial-growth-chart.jpg", url: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&q=80", category: "finance_banking", credit: "Markus Winkler" },
    { filename: "stock-market-data.jpg", url: "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=800&q=80", category: "finance_banking", credit: "Nick Chong" },
    { filename: "calculator-finances.jpg", url: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&q=80", category: "finance_banking", credit: "Kelly Sikkema" },
    { filename: "currency-pounds.jpg", url: "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=800&q=80", category: "finance_banking", credit: "Jason Leung" },
    { filename: "investment-planning.jpg", url: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80", category: "finance_banking", credit: "Carlos Muza" },
    { filename: "banking-digital.jpg", url: "https://images.unsplash.com/photo-1563986768609-322da13575f2?w=800&q=80", category: "finance_banking", credit: "Tech Daily" },
    { filename: "financial-report.jpg", url: "https://images.unsplash.com/photo-1543286386-713bdd548da4?w=800&q=80", category: "finance_banking", credit: "Isaac Smith" },

    // === Property & Real Estate ===
    { filename: "commercial-building.jpg", url: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&q=80", category: "property_real_estate", credit: "Sean Pollock" },
    { filename: "modern-office-building.jpg", url: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&q=80", category: "property_real_estate", credit: "Jason Dent" },
    { filename: "warehouse-industrial.jpg", url: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800&q=80", category: "property_real_estate", credit: "Elevate" },
    { filename: "property-development.jpg", url: "https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=800&q=80", category: "property_real_estate", credit: "Daniel McCullough" },
    { filename: "retail-storefront.jpg", url: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&q=80", category: "property_real_estate", credit: "Clark Street Mercantile" },
    { filename: "housing-development.jpg", url: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80", category: "property_real_estate", credit: "Tierra Mallorca" },
    { filename: "construction-site.jpg", url: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&q=80", category: "property_real_estate", credit: "Scott Blake" },

    // === Professional People ===
    { filename: "business-professional-woman.jpg", url: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=800&q=80", category: "professional_people", credit: "Christina @ wocintechchat" },
    { filename: "confident-businessman.jpg", url: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=800&q=80", category: "professional_people", credit: "Hunters Race" },
    { filename: "diverse-team-meeting.jpg", url: "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=800&q=80", category: "professional_people", credit: "LinkedIn Sales Solutions" },
    { filename: "consultant-at-desk.jpg", url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80", category: "professional_people", credit: "Joseph Gonzalez" },
    { filename: "team-celebrating.jpg", url: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&q=80", category: "professional_people", credit: "Priscilla Du Preez" },
    { filename: "professional-presentation.jpg", url: "https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=800&q=80", category: "professional_people", credit: "Teemu Paananen" },

    // === Technology & Digital ===
    { filename: "laptop-workspace.jpg", url: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800&q=80", category: "technology_digital", credit: "Kari Shea" },
    { filename: "digital-dashboard.jpg", url: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80", category: "technology_digital", credit: "Luke Chesser" },
    { filename: "smartphone-business.jpg", url: "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800&q=80", category: "technology_digital", credit: "William Hook" },
    { filename: "cloud-technology.jpg", url: "https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=800&q=80", category: "technology_digital", credit: "Pero Kalimero" },
    { filename: "coding-screen.jpg", url: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800&q=80", category: "technology_digital", credit: "Ilya Pavlov" },
    { filename: "automation-ai.jpg", url: "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&q=80", category: "technology_digital", credit: "Emiliano Vittoriosi" },
    { filename: "digital-marketing.jpg", url: "https://images.unsplash.com/photo-1432888622747-4eb9a8efeb07?w=800&q=80", category: "technology_digital", credit: "Firmbee" },

    // === Charts & Data ===
    { filename: "analytics-dashboard.jpg", url: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80", category: "charts_data", credit: "Luke Chesser" },
    { filename: "data-visualization.jpg", url: "https://images.unsplash.com/photo-1543286386-2e659306cd6c?w=800&q=80", category: "charts_data", credit: "Isaac Smith" },
    { filename: "spreadsheet-report.jpg", url: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80", category: "charts_data", credit: "Carlos Muza" },
    { filename: "pie-chart-stats.jpg", url: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80", category: "charts_data", credit: "Luke Chesser" },
    { filename: "growth-metrics.jpg", url: "https://images.unsplash.com/photo-1526628953301-3e589a6a8b74?w=800&q=80", category: "charts_data", credit: "Stephen Dawson" },
    { filename: "business-intelligence.jpg", url: "https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=800&q=80", category: "charts_data", credit: "path digital" },

    // === City & Architecture ===
    { filename: "london-skyline.jpg", url: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=800&q=80", category: "city_architecture", credit: "Benjamin Davies" },
    { filename: "canary-wharf.jpg", url: "https://images.unsplash.com/photo-1564594736624-def7a10ab047?w=800&q=80", category: "city_architecture", credit: "Robert Bye" },
    { filename: "financial-district.jpg", url: "https://images.unsplash.com/photo-1448317846460-907988886b33?w=800&q=80", category: "city_architecture", credit: "Ferdinand Stohr" },
    { filename: "modern-architecture.jpg", url: "https://images.unsplash.com/photo-1487958449943-2429e8be8625?w=800&q=80", category: "city_architecture", credit: "Lance Anderson" },
    { filename: "city-aerial-view.jpg", url: "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&q=80", category: "city_architecture", credit: "Pedro Lastra" },
    { filename: "glass-skyscraper.jpg", url: "https://images.unsplash.com/photo-1486325212027-8081e485255e?w=800&q=80", category: "city_architecture", credit: "Akhil Yerabati" },
    { filename: "tower-bridge-london.jpg", url: "https://images.unsplash.com/photo-1533929736458-ca588d08c8be?w=800&q=80", category: "city_architecture", credit: "Eva Dang" },

    // === Abstract & Backgrounds ===
    { filename: "blue-gradient-abstract.jpg", url: "https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=800&q=80", category: "abstract_backgrounds", credit: "Codioful" },
    { filename: "geometric-pattern.jpg", url: "https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?w=800&q=80", category: "abstract_backgrounds", credit: "Milad Fakurian" },
    { filename: "dark-gradient.jpg", url: "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&q=80", category: "abstract_backgrounds", credit: "Gradienta" },
    { filename: "light-texture.jpg", url: "https://images.unsplash.com/photo-1517483000871-1dbf64a6e1c6?w=800&q=80", category: "abstract_backgrounds", credit: "Pawel Czerwinski" },
    { filename: "professional-blue-bg.jpg", url: "https://images.unsplash.com/photo-1557683316-973673baf926?w=800&q=80", category: "abstract_backgrounds", credit: "Codioful" },
    { filename: "wave-pattern.jpg", url: "https://images.unsplash.com/photo-1550684376-efcbd6e3f031?w=800&q=80", category: "abstract_backgrounds", credit: "Pawel Czerwinski" },
    { filename: "minimalist-white.jpg", url: "https://images.unsplash.com/photo-1533628635777-112b2239b1c7?w=800&q=80", category: "abstract_backgrounds", credit: "Paweł Czerwiński" },
    { filename: "gold-luxury-texture.jpg", url: "https://images.unsplash.com/photo-1518893494013-481c1d8ed3fd?w=800&q=80", category: "abstract_backgrounds", credit: "Pawel Czerwinski" },
  ];
}

export default router;
