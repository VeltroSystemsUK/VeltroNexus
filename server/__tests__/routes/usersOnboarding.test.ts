import { describe, expect, it } from "vitest";
import usersRouter from "../../routes/users";

describe("user onboarding routes", () => {
  it("registers onboarding under /user so the /api mount is not doubled", () => {
    const paths = usersRouter.stack
      .filter((layer: { route?: { path?: string } }) => layer.route)
      .map((layer: { route: { path: string } }) => layer.route.path);
    expect(paths).toContain("/user/onboarding");
    expect(paths).toContain("/user/onboarding/complete-step");
    expect(paths).toContain("/user/onboarding/reset");
    expect(paths).toContain("/user/branding/logo");
    expect(paths).toContain("/teams/:id/members");
    expect(paths).not.toContain("/api/user/onboarding");
  });
});
