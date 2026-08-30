import { selectionRect } from "./geometry";
import { DEFAULT_LAYOUT, type AutoLayout, type CraftNode, type CraftPage } from "./types";

export function layoutForGroup(page: CraftPage, groupId: string | undefined): AutoLayout | undefined {
  if (!groupId) return undefined;
  return page.layouts?.[groupId];
}

export function applyAutoLayout(nodes: CraftNode[], groupId: string, layout: AutoLayout): CraftNode[] {
  const members = nodes.filter((node) => node.groupId === groupId && !node.hidden);
  if (members.length < 1) return nodes;
  const sorted = [...members].sort((a, b) => (layout.direction === "row" ? a.x - b.x || a.y - b.y : a.y - b.y || a.x - b.x));
  const bounds = selectionRect(sorted);
  if (!bounds) return nodes;
  const pad = Math.max(0, layout.padding);
  const gap = Math.max(0, layout.gap);
  const originMain = (layout.direction === "row" ? bounds.x : bounds.y) + pad;
  const originCross = (layout.direction === "row" ? bounds.y : bounds.x) + pad;
  const crossSpan = layout.direction === "row" ? Math.max(...sorted.map((node) => node.height)) : Math.max(...sorted.map((node) => node.width));

  let cursor = originMain;
  const nextById = new Map<string, CraftNode>();
  for (const node of sorted) {
    if (layout.direction === "row") {
      const y =
        layout.align === "center"
          ? originCross + (crossSpan - node.height) / 2
          : layout.align === "end"
            ? originCross + crossSpan - node.height
            : originCross;
      nextById.set(node.id, { ...node, x: cursor, y });
      cursor += node.width + gap;
    } else {
      const x =
        layout.align === "center"
          ? originCross + (crossSpan - node.width) / 2
          : layout.align === "end"
            ? originCross + crossSpan - node.width
            : originCross;
      nextById.set(node.id, { ...node, x, y: cursor });
      cursor += node.height + gap;
    }
  }
  return nodes.map((node) => nextById.get(node.id) ?? node);
}

export function enableAutoLayout(page: CraftPage, ids: string[], layout: AutoLayout = DEFAULT_LAYOUT): CraftPage {
  if (ids.length < 2) return page;
  const groupId = page.nodes.find((node) => ids.includes(node.id) && node.groupId)?.groupId ?? `layout_${Date.now().toString(36)}`;
  const nodes = applyAutoLayout(
    page.nodes.map((node) => (ids.includes(node.id) ? { ...node, groupId, groupName: node.groupName ?? "Auto layout" } : node)),
    groupId,
    layout,
  );
  return { ...page, nodes, layouts: { ...page.layouts, [groupId]: layout } };
}

export function updateGroupLayout(page: CraftPage, groupId: string, layout: AutoLayout): CraftPage {
  return {
    ...page,
    layouts: { ...page.layouts, [groupId]: layout },
    nodes: applyAutoLayout(page.nodes, groupId, layout),
  };
}

export function clearGroupLayout(page: CraftPage, groupId: string): CraftPage {
  if (!page.layouts?.[groupId]) return page;
  const layouts = { ...page.layouts };
  delete layouts[groupId];
  return { ...page, layouts };
}
