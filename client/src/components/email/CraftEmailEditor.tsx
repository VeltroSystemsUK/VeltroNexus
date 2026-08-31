import { forwardRef, useEffect, useImperativeHandle } from "react";
import { CraftView } from "@/components/craft/CraftView";
import { useCraftStore } from "@/components/craft/store";
import {
  emailHtmlFromCraft,
  isCraftEmailDesign,
  unwrapCraftEmailDesign,
  wrapCraftEmailDesign,
} from "@/components/craft/lib/emailHtml";
import { normalizeDocument } from "@/components/craft/lib/types";

export interface CraftEmailEditorHandle {
  exportHtml: () => Promise<{ design: unknown; html: string }>;
}

export const CraftEmailEditor = forwardRef<
  CraftEmailEditorHandle,
  { designJson?: unknown; title?: string; templateId?: string | number | null }
>(function CraftEmailEditor({ designJson, title, templateId }, ref) {
  useEffect(() => {
    const id = templateId != null ? `tpl-${templateId}` : `tpl-new-${Date.now().toString(36)}`;
    const existing = unwrapCraftEmailDesign(designJson);
    const fallback =
      existing ??
      (designJson && typeof designJson === "object" && (designJson as { schema?: string }).schema
        ? normalizeDocument(designJson)
        : null);
    useCraftStore.getState().openEmailTemplate(id, fallback, title);
    return () => {
      useCraftStore.getState().close();
    };
  }, [templateId]);

  useImperativeHandle(ref, () => ({
    exportHtml: async () => {
      const doc = useCraftStore.getState().doc;
      if (!doc) throw new Error("Editor not ready");
      return { design: wrapCraftEmailDesign(doc), html: emailHtmlFromCraft(doc) };
    },
  }));

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-[var(--bg-base,#0b0c10)]">
      <CraftView mode="email" />
    </div>
  );
});

export { isCraftEmailDesign };
