import { describe, expect, it } from "vitest";
import {
  identityFromOfficer,
  isIndividualPerson,
  officerAppointmentsPath,
  officerSearchQuery,
  pickMatchingOfficerHits,
  scoreOfficerMatch,
} from "../../utils/officerIdentity";

const bristolKirsty = {
  name: "BEVAN, Kirsty Jane",
  name_elements: { forename: "Kirsty", middle_name: "Jane", surname: "Bevan" },
  date_of_birth: { month: 3, year: 1984 },
  address: {
    address_line_1: "17 West Walk",
    locality: "Yate",
    postal_code: "BS37 4AX",
  },
  officer_role: "director",
};

describe("identityFromOfficer", () => {
  it("parses Companies House SURNAME, Forename into identity fields", () => {
    const id = identityFromOfficer({
      name: "BEVAN, Kirsty Jane",
      address: { locality: "Yate", postal_code: "BS37 4AX" },
      date_of_birth: { month: 3, year: 1984 },
    });
    expect(id.forename).toBe("kirsty");
    expect(id.surname).toBe("bevan");
    expect(id.postalCode).toBe("BS374AX");
    expect(id.locality).toBe("yate");
    expect(id.dobMonth).toBe(3);
    expect(id.dobYear).toBe(1984);
  });

  it("strips Miss/Mr titles from PSC-style names", () => {
    const id = identityFromOfficer({ name: "Miss Kirsty Bevan" });
    expect(id.forename).toBe("kirsty");
    expect(id.surname).toBe("bevan");
    expect(officerSearchQuery(id)).toBe("Kirsty Bevan");
  });
});

describe("officerSearchQuery", () => {
  it("searches forename then surname, not SURNAME, Forename", () => {
    expect(officerSearchQuery(identityFromOfficer(bristolKirsty))).toBe("Kirsty Bevan");
  });
});

describe("isIndividualPerson", () => {
  it("skips corporate directors and corporate PSCs", () => {
    expect(isIndividualPerson({ officer_role: "director", name: "BEVAN, Kirsty" })).toBe(true);
    expect(isIndividualPerson({ officer_role: "corporate-director", name: "ACME LIMITED" })).toBe(false);
    expect(isIndividualPerson({ kind: "corporate-entity-person-with-significant-control", name: "ACME LTD" })).toBe(
      false
    );
    expect(isIndividualPerson({ kind: "individual-person-with-significant-control", name: "BEVAN, Kirsty" })).toBe(
      true
    );
  });
});

describe("scoreOfficerMatch", () => {
  const subject = identityFromOfficer(bristolKirsty);

  it("rejects a namesake with a different date of birth", () => {
    const result = scoreOfficerMatch(subject, {
      forename: "kirsty",
      surname: "bevan",
      dobMonth: 11,
      dobYear: 1962,
      postalCode: "BS374AX",
      locality: "yate",
    });
    expect(result.ok).toBe(false);
    expect(result.reject).toMatch(/date of birth/i);
  });

  it("rejects a namesake who lives in a different postcode area when dates of birth do not match", () => {
    const result = scoreOfficerMatch(
      identityFromOfficer({ ...bristolKirsty, date_of_birth: undefined }),
      {
        forename: "kirsty",
        surname: "bevan",
        postalCode: "M11AA",
        locality: "manchester",
      }
    );
    expect(result.ok).toBe(false);
    expect(result.reject).toMatch(/elsewhere|postcode|address/i);
  });

  it("keeps the same person who has moved, when date of birth matches", () => {
    const result = scoreOfficerMatch(subject, {
      forename: "kirsty",
      surname: "bevan",
      dobMonth: 3,
      dobYear: 1984,
      postalCode: "M11AA",
      locality: "manchester",
    });
    expect(result.ok).toBe(true);
    expect(result.reasons.join(" ")).toMatch(/date of birth/i);
  });

  it("accepts the same outward postcode and name when date of birth is missing", () => {
    const result = scoreOfficerMatch(
      identityFromOfficer({ ...bristolKirsty, date_of_birth: undefined }),
      {
        forename: "kirsty",
        surname: "bevan",
        postalCode: "BS375ZZ",
        locality: "chipping sodbury",
      }
    );
    expect(result.ok).toBe(true);
    expect(result.reasons.join(" ")).toMatch(/postcode/i);
  });

  it("accepts the same town when neither record has a postcode", () => {
    const result = scoreOfficerMatch(
      { forename: "kirsty", surname: "bevan", locality: "yate" },
      { forename: "kirsty", surname: "bevan", locality: "yate" }
    );
    expect(result.ok).toBe(true);
  });

  it("rejects a different forename even at the same address", () => {
    const result = scoreOfficerMatch(subject, {
      forename: "david",
      surname: "bevan",
      postalCode: "BS374AX",
      locality: "yate",
    });
    expect(result.ok).toBe(false);
    expect(result.reject).toMatch(/forename|name/i);
  });
});

describe("officerAppointmentsPath", () => {
  it("uses the officer appointments link, or the search result self link", () => {
    expect(
      officerAppointmentsPath({
        links: { officer: { appointments: "/officers/abc/appointments" } },
      })
    ).toBe("/officers/abc/appointments");
    expect(officerAppointmentsPath({ links: { self: "/officers/abc/appointments" } })).toBe(
      "/officers/abc/appointments"
    );
  });
});

describe("pickMatchingOfficerHits", () => {
  it("keeps the nearby director and drops random namesakes from elsewhere", () => {
    const subject = identityFromOfficer({
      name: "SMITH, John",
      address: { locality: "Bristol", postal_code: "BS1 4DJ" },
    });
    const hits = [
      { title: "John Smith", address: { postal_code: "M1 1AA", locality: "Manchester" } },
      { title: "John Smith", address: { postal_code: "BS1 5AH", locality: "Bristol" } },
      { title: "John Smith", address: { postal_code: "G1 1AA", locality: "Glasgow" } },
    ];
    const matched = pickMatchingOfficerHits(subject, hits, (hit) => identityFromOfficer(hit));
    expect(matched).toHaveLength(1);
    expect(matched[0].address.locality).toBe("Bristol");
  });

  it("returns nobody when every hit lives far from the subject and dates of birth do not match", () => {
    const subject = identityFromOfficer({
      name: "SMITH, John",
      address: { locality: "Bristol", postal_code: "BS1 4DJ" },
    });
    const hits = [
      { title: "John Smith", address: { postal_code: "M1 1AA", locality: "Manchester" } },
      { title: "John Smith", address: { postal_code: "G1 1AA", locality: "Glasgow" } },
    ];
    expect(pickMatchingOfficerHits(subject, hits, (hit) => identityFromOfficer(hit))).toEqual([]);
  });
});
