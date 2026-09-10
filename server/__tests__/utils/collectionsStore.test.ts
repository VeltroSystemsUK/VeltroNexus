import { describe, expect, it } from "vitest";
import { mergeCollections, parseCollectionsStore } from "../../utils/collectionsStore";

describe("collections store", () => {
  it("refuses to parse invalid JSON instead of returning an empty object", () => {
    expect(() => parseCollectionsStore("{")).toThrow();
    expect(() => parseCollectionsStore("[]")).toThrow(/not an object/);
    expect(parseCollectionsStore('{"report_tasks":[]}').report_tasks).toEqual([]);
  });

  it("keeps collections a stale write omitted", () => {
    const onDisk = { report_tasks: [{ id: 1 }], report_log: [{ id: 2 }], learn_pieces: [{ id: 3 }] };
    const incoming = { learn_pieces: [{ id: 4 }] };
    const merged = mergeCollections(onDisk, incoming);
    expect(merged.report_tasks).toEqual([{ id: 1 }]);
    expect(merged.report_log).toEqual([{ id: 2 }]);
    expect(merged.learn_pieces).toEqual([{ id: 4 }]);
  });
});
