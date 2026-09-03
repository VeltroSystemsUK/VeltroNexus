import { readdirSync, readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { BANNED, RATE_CLAIM } from "@shared/craftQueue";
import { reviewEditorialCopy } from "@shared/editorial";
import { DIRECTORS_HANDBOOK_SLUGS, reviewLearnCopy } from "@shared/learn";
import { parseLearnCourseMarkdown } from "@shared/learnCourses";
import { parseLearnLesson, splitLearnQuizzes } from "@shared/learnQuiz";

const COURSE_DIR = path.resolve("scripts/learn_courses");

function loadCourses() {
  const files = readdirSync(COURSE_DIR)
    .filter((name) => name.endsWith(".md"))
    .sort();
  return files.map((name) => {
    const raw = readFileSync(path.join(COURSE_DIR, name), "utf8");
    const parsed = parseLearnCourseMarkdown(raw);
    return { name, ...parsed, quizzes: splitLearnQuizzes(parsed.body).quizzes };
  });
}

describe("director handbook corpus", () => {
  const courses = loadCourses();

  it("publishes one live article per handbook slug", () => {
    expect(courses.map((row) => row.meta.slug).sort()).toEqual([...DIRECTORS_HANDBOOK_SLUGS].sort());
  });

  it("keeps every course inside house policy and packs a real self-check", () => {
    for (const course of courses) {
      expect(course.meta.topic).toBe("directors-handbook");
      expect(course.meta.excerpt.length).toBeGreaterThan(40);
      expect(course.body.length).toBeGreaterThan(1200);
      expect(course.quizzes.length).toBeGreaterThanOrEqual(5);
      expect(course.quizzes.every((quiz) => quiz.choices.length >= 3)).toBe(true);
      const copy = `${course.meta.title} ${course.meta.topic} ${course.meta.excerpt} ${course.body}`;
      expect(BANNED.test(copy), `${course.meta.slug} trips BANNED`).toBe(false);
      expect(RATE_CLAIM.test(copy), `${course.meta.slug} trips RATE_CLAIM`).toBe(false);
      expect(
        reviewEditorialCopy({
          userId: "u1",
          type: "blog",
          title: course.meta.title,
          topic: course.meta.topic,
          body: course.body,
          notes: [],
          engine: null,
          status: "draft",
          compliance: "pending",
          autoPublish: false,
        }).ok,
        `${course.meta.slug} fails editorial review`,
      ).toBe(true);
      expect(reviewLearnCopy(copy).ok, `${course.meta.slug} fails Learn review`).toBe(true);
    }
  });

  it("plays as a section, then a test, not a monolith", () => {
    for (const course of courses) {
      const steps = parseLearnLesson(course.body);
      expect(steps[0]?.kind, course.meta.slug).toBe("copy");
      expect(steps.filter((step) => step.kind === "quiz").length).toBeGreaterThanOrEqual(5);
      const firstQuiz = steps.findIndex((step) => step.kind === "quiz");
      expect(steps[firstQuiz - 1]?.kind, course.meta.slug).toBe("copy");
      const kinds = steps.map((step) => step.kind).join(",");
      expect(kinds, course.meta.slug).toMatch(/copy,quiz/);
    }
  });
});
