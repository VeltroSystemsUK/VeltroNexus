import { DIRECTORS_HANDBOOK_SLUGS } from "./learn";

export type LearnCourseMeta = {
  slug: string;
  title: string;
  excerpt: string;
  durationLabel: string;
  topic: string;
};

export function parseLearnCourseMarkdown(raw: string): { meta: LearnCourseMeta; body: string } {
  const match = String(raw || "").replace(/^\uFEFF/, "").match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) throw new Error("Course needs YAML frontmatter.");
  const fields: Record<string, string> = {};
  for (const line of match[1]!.split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx < 1) continue;
    fields[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  const slug = fields.slug || "";
  const title = fields.title || "";
  const excerpt = fields.excerpt || "";
  const durationLabel = fields.durationLabel || "";
  const topic = fields.topic || "directors-handbook";
  if (!slug || !title || !excerpt || !durationLabel) {
    throw new Error("Course frontmatter needs slug, title, excerpt, and durationLabel.");
  }
  if (!(DIRECTORS_HANDBOOK_SLUGS as readonly string[]).includes(slug)) {
    throw new Error(`Slug is not on the director handbook: ${slug}`);
  }
  return { meta: { slug, title, excerpt, durationLabel, topic }, body: match[2]!.trim() };
}
