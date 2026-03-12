import { useRef, useState, useEffect, useImperativeHandle, forwardRef, useCallback } from "react";
import EmailEditor, { EditorRef, Editor } from "react-email-editor";
import { EMAIL_MERGE_TAGS } from "@shared/schema";
import { Loader2 } from "lucide-react";
import { MediaGalleryModal } from "./MediaGalleryModal";

// Convert our merge tags into Unlayer's expected format
const unlayerMergeTags = EMAIL_MERGE_TAGS.reduce(
  (acc, mt) => {
    const key = mt.tag.replace(/\{\{|\}\}/g, "");
    acc[key] = {
      name: mt.description,
      value: mt.tag,
    };
    return acc;
  },
  {} as Record<string, { name: string; value: string }>
);

export interface UnlayerEditorHandle {
  exportHtml: () => Promise<{ design: any; html: string }>;
  loadDesign: (design: any) => void;
}

interface UnlayerEmailEditorProps {
  designJson?: any;
  onReady?: () => void;
}

export const UnlayerEmailEditor = forwardRef<UnlayerEditorHandle, UnlayerEmailEditorProps>(
  ({ designJson, onReady }, ref) => {
    const emailEditorRef = useRef<EditorRef>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [loading, setLoading] = useState(true);
    const [height, setHeight] = useState(600);
    const designToLoad = useRef<any>(designJson);

    // Media gallery modal state
    const [galleryOpen, setGalleryOpen] = useState(false);
    const selectImageDone = useRef<((data: { url: string }) => void) | null>(null);

    // Keep track of latest designJson for loading when ready
    useEffect(() => {
      designToLoad.current = designJson;
    }, [designJson]);

    // Measure container height and resize dynamically
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const updateHeight = () => {
        const rect = container.getBoundingClientRect();
        // Use the container's actual pixel height
        setHeight(Math.max(400, Math.floor(rect.height)));
      };

      updateHeight();

      const observer = new ResizeObserver(updateHeight);
      observer.observe(container);

      return () => observer.disconnect();
    }, []);

    useImperativeHandle(ref, () => ({
      exportHtml: () => {
        return new Promise((resolve, reject) => {
          const editor = emailEditorRef.current?.editor;
          if (!editor) {
            reject(new Error("Editor not ready"));
            return;
          }
          editor.exportHtml((data: any) => {
            resolve({ design: data.design, html: data.html });
          });
        });
      },
      loadDesign: (design: any) => {
        emailEditorRef.current?.editor?.loadDesign(design);
      },
    }));

    const handleImageSelect = useCallback((url: string) => {
      if (selectImageDone.current) {
        selectImageDone.current({ url });
        selectImageDone.current = null;
      }
    }, []);

    const handleReady = useCallback((unlayer: Editor) => {
      setLoading(false);
      if (designToLoad.current) {
        unlayer.loadDesign(designToLoad.current);
      }

      // Register custom image picker - shows our Media Gallery modal
      unlayer.registerCallback("selectImage", (_data: any, done: (data: { url: string }) => void) => {
        selectImageDone.current = done;
        setGalleryOpen(true);
      });

      // Register custom image upload handler for drag-and-drop
      unlayer.registerCallback("image", async (file: any, done: (data: { progress: number; url?: string }) => void) => {
        try {
          const formData = new FormData();
          formData.append("file", file.attachments[0]);

          done({ progress: 50 });

          const res = await fetch("/api/media/upload", {
            method: "POST",
            body: formData,
            credentials: "include",
          });

          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: "Upload failed" }));
            console.error("Image upload failed:", err.error);
            return;
          }

          const result = await res.json();
          done({ progress: 100, url: result.url });
        } catch (err) {
          console.error("Image upload error:", err);
        }
      });

      onReady?.();
    }, [onReady]);

    return (
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Loading email editor...</span>
            </div>
          </div>
        )}
        <EmailEditor
          ref={emailEditorRef}
          onReady={handleReady}
          minHeight={`${height}px`}
          style={{ height: `${height}px` }}
          options={{
            displayMode: "email",
            mergeTags: unlayerMergeTags,
            features: {
              textEditor: {
                spellChecker: true,
              },
            },
            appearance: {
              theme: "modern_light",
            },
          }}
        />
        <MediaGalleryModal
          open={galleryOpen}
          onClose={() => {
            setGalleryOpen(false);
            selectImageDone.current = null;
          }}
          onSelect={handleImageSelect}
        />
      </div>
    );
  }
);

UnlayerEmailEditor.displayName = "UnlayerEmailEditor";
