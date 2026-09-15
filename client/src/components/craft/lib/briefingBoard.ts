import type { BriefingBind } from "@shared/briefingRender";
import { fillMergeTags, mergeFieldsFromBind } from "@shared/briefingCraft";
import { fillMirrorPortal } from "@shared/briefingTracks/mirrorPortal";
import { applyBrandToNode } from "./brand";
import { addBlankPage, documentFromBlank, makeImageNode, makeTextStyle } from "./templates";
import type { CraftAsset, CraftDocument, CraftPage, TextNode } from "./types";

function fillPage(
  page: CraftPage,
  theme: string,
  title: string,
  body: string,
  brand: CraftDocument["brand"],
): CraftPage {
  const eyebrow = makeTextStyle(page, brand, "eyebrow", page.width * 0.08, page.height * 0.1);
  const heading = makeTextStyle(page, brand, "heading", page.width * 0.08, page.height * 0.18);
  const copy = makeTextStyle(page, brand, "body", page.width * 0.08, page.height * 0.38);
  return {
    ...page,
    name: title,
    nodes: [
      applyBrandToNode({ ...eyebrow, name: "Eyebrow", text: theme, uppercase: true }, brand),
      applyBrandToNode({ ...heading, name: "Hook 1", text: title, height: page.height * 0.16 }, brand),
      applyBrandToNode({ ...copy, name: "Body", text: body, height: page.height * 0.45, lineHeight: 1.35 }, brand),
    ],
  };
}

export function briefingDocumentFromBind(bound: BriefingBind): CraftDocument {
  let doc = documentFromBlank("post", undefined, bound.companyName);
  const slides = fillMirrorPortal({ ...bound, industry: bound.industry || "your trade" });
  const first = slides[0]!;
  doc.pages[0] = fillPage(doc.pages[0]!, first.theme, first.title, first.body, doc.brand);
  doc.activePageId = doc.pages[0]!.id;
  for (let i = 1; i < slides.length; i++) {
    doc = addBlankPage(doc, "post");
    const page = doc.pages[doc.pages.length - 1]!;
    const slide = slides[i]!;
    doc.pages[doc.pages.length - 1] = fillPage(page, slide.theme, slide.title, slide.body, doc.brand);
    doc.activePageId = doc.pages[0]!.id;
  }
  doc.title = bound.companyName;
  return doc;
}

export function placeImageAssetOnPage(
  doc: CraftDocument,
  pageId: string,
  asset: CraftAsset,
): CraftDocument {
  const page = doc.pages.find((item) => item.id === pageId);
  if (!page) return doc;
  const node = makeImageNode(page, asset.id);
  return {
    ...doc,
    assets: [...doc.assets.filter((item) => item.id !== asset.id), asset],
    pages: doc.pages.map((item) =>
      item.id === page.id ? { ...item, nodes: [...item.nodes, node] } : item
    ),
    updatedAt: new Date().toISOString(),
  };
}

export function fillDocumentMergeTags(doc: CraftDocument, bound: BriefingBind): CraftDocument {
  const fields = mergeFieldsFromBind(bound);
  return {
    ...doc,
    pages: doc.pages.map((page) => ({
      ...page,
      nodes: page.nodes.map((node) => {
        if (node.type === "text") {
          const next: TextNode = { ...node, text: fillMergeTags(node.text, fields) };
          return next;
        }
        if (node.type === "motion" && node.text) {
          return { ...node, text: fillMergeTags(node.text, fields) };
        }
        return node;
      }),
    })),
  };
}
