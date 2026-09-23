import { describe, expect, it } from "vitest";
import {
  hmrcPositionHasContent,
  resolveHmrcPosition,
  seedHmrcPositionForFile,
  ttpRequiredNewlyTicked,
} from "@shared/hmrcPosition";

describe("resolveHmrcPosition", () => {
  it("returns empty when nothing is recorded", () => {
    expect(resolveHmrcPosition({})).toEqual({
      narrative: "",
      ttpRequired: false,
      arrangementsCommentary: "",
    });
  });

  it("reads the authored HMRC position fields", () => {
    expect(
      resolveHmrcPosition({
        hmrcPosition: {
          narrative: "  VAT arrears of about £40k.  ",
          ttpRequired: true,
          arrangementsCommentary: " Kept a TTP in 2023. ",
        },
      }),
    ).toEqual({
      narrative: "VAT arrears of about £40k.",
      ttpRequired: true,
      arrangementsCommentary: "Kept a TTP in 2023.",
    });
  });

  it("seeds arrangements commentary from a legacy active or historic flag", () => {
    expect(resolveHmrcPosition({ hmrcTimeToPay: "active" }).arrangementsCommentary).toBe("Active");
    expect(resolveHmrcPosition({ hmrcTimeToPay: "historic" }).arrangementsCommentary).toBe("Historic");
  });

  it("does not treat a legacy flag as TTP required", () => {
    expect(resolveHmrcPosition({ hmrcTimeToPay: "active" }).ttpRequired).toBe(false);
  });

  it("does not re-seed commentary once an HMRC position has been saved", () => {
    expect(
      resolveHmrcPosition({
        hmrcTimeToPay: "active",
        hmrcPosition: { narrative: "Cleared.", ttpRequired: false, arrangementsCommentary: "" },
      }).arrangementsCommentary,
    ).toBe("");
  });
});

describe("hmrcPositionHasContent", () => {
  it("is empty when nothing is recorded", () => {
    expect(hmrcPositionHasContent(resolveHmrcPosition({}))).toBe(false);
    expect(hmrcPositionHasContent(resolveHmrcPosition({ hmrcTimeToPay: "none" }))).toBe(false);
  });

  it("is content when TTP is required or either text box is filled", () => {
    expect(hmrcPositionHasContent(resolveHmrcPosition({ hmrcPosition: { ttpRequired: true } }))).toBe(true);
    expect(hmrcPositionHasContent(resolveHmrcPosition({ hmrcPosition: { narrative: "PAYE arrears" } }))).toBe(true);
    expect(
      hmrcPositionHasContent(resolveHmrcPosition({ hmrcPosition: { arrangementsCommentary: "Historic TTP" } })),
    ).toBe(true);
    expect(hmrcPositionHasContent(resolveHmrcPosition({ hmrcTimeToPay: "historic" }))).toBe(true);
  });
});

describe("ttpRequiredNewlyTicked", () => {
  it("fires when TTP required is first ticked", () => {
    expect(ttpRequiredNewlyTicked({}, { hmrcPosition: { ttpRequired: true } })).toBe(true);
    expect(
      ttpRequiredNewlyTicked(
        { hmrcPosition: { ttpRequired: false } },
        { hmrcPosition: { ttpRequired: true } },
      ),
    ).toBe(true);
  });

  it("does not re-fire when it was already ticked", () => {
    expect(
      ttpRequiredNewlyTicked(
        { hmrcPosition: { ttpRequired: true } },
        { hmrcPosition: { ttpRequired: true } },
      ),
    ).toBe(false);
  });

  it("does not treat a legacy active TTP as already ticked", () => {
    expect(ttpRequiredNewlyTicked({ hmrcTimeToPay: "active" }, { hmrcPosition: { ttpRequired: true } })).toBe(
      true,
    );
  });
});

describe("seedHmrcPositionForFile", () => {
  const scratch = JSON.stringify({
    hmrcPosition: {
      narrative: "PAYE arrears of £28k.",
      ttpRequired: true,
      arrangementsCommentary: "Historic TTP kept.",
    },
  });

  it("uses Credit Tools scratch when the company file has no HMRC position", () => {
    expect(seedHmrcPositionForFile({}, scratch)).toEqual({
      narrative: "PAYE arrears of £28k.",
      ttpRequired: true,
      arrangementsCommentary: "Historic TTP kept.",
      fromScratch: true,
    });
  });

  it("does not overwrite a position already saved on the company file", () => {
    const seeded = seedHmrcPositionForFile(
      { hmrcPosition: { narrative: "On the file.", ttpRequired: false } },
      scratch,
    );
    expect(seeded.narrative).toBe("On the file.");
    expect(seeded.fromScratch).toBe(false);
  });
});
