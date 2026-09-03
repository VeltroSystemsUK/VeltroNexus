import { describe, expect, it } from "vitest";
import workforceRouter from "../../routes/workforce";

describe("agent job stop routes", () => {
  it("registers pause and early-complete under the job id", () => {
    const paths = workforceRouter.stack
      .filter((layer) => Boolean(layer.route))
      .map((layer) => ({
        path: layer.route!.path,
        methods: Object.keys(layer.route!.methods),
      }));
    expect(paths).toContainEqual({ path: "/agent-jobs/:jobId/pause", methods: ["post"] });
    expect(paths).toContainEqual({ path: "/agent-jobs/:jobId/complete", methods: ["post"] });
  });
});
