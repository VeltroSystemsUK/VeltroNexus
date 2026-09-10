export type PersonIdentity = {
  forename?: string;
  middleName?: string;
  surname?: string;
  displayName?: string;
  dobMonth?: number;
  dobYear?: number;
  postalCode?: string;
  outwardCode?: string;
  postcodeArea?: string;
  locality?: string;
  addressLine1?: string;
};

export type OfficerMatch = {
  ok: boolean;
  score: number;
  reasons: string[];
  reject?: string;
};

type NamedRecord = {
  name?: string;
  title?: string;
  name_elements?: {
    forename?: string;
    middle_name?: string;
    surname?: string;
  };
  date_of_birth?: { month?: number; year?: number };
  address?: {
    premises?: string;
    address_line_1?: string;
    address_line_2?: string;
    locality?: string;
    region?: string;
    postal_code?: string;
  };
  address_snippet?: string;
  officer_role?: string;
  kind?: string;
};

const CORPORATE_ROLE = /corporate|nominee-director|llp-member/i;
const CORPORATE_KIND = /corporate-entity|legal-person/i;
const COMPANY_NAME = /\b(limited|ltd\.?|plc|llp|llc|inc\.?|company|co\.?)\b/i;

function fold(value: string | undefined | null): string {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function titleCaseName(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function normalizePostcode(value: string | undefined | null): string {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export function postcodeOutward(compact: string): string {
  if (compact.length < 5) return compact;
  return compact.slice(0, compact.length - 3);
}

export function postcodeArea(compact: string): string {
  const match = compact.match(/^[A-Z]+/);
  return match ? match[0] : "";
}

function firstToken(value: string | undefined): string {
  return (value || "").split(/\s+/)[0] || "";
}

const TITLE_TOKEN = /^(mr|mrs|ms|miss|mx|dr|sir|dame|lord|lady|prof|professor)$/i;

function withoutTitle(tokens: string[]): string[] {
  if (tokens.length > 1 && TITLE_TOKEN.test(tokens[0])) return tokens.slice(1);
  return tokens;
}

function parseCommaName(name: string): { forename?: string; middleName?: string; surname?: string } {
  const [surname, rest] = name.split(",").map((part) => fold(part));
  if (!rest) {
    const tokens = withoutTitle(fold(name).split(/\s+/).filter(Boolean));
    if (tokens.length < 2) return { surname: tokens[0] };
    return { forename: tokens[0], middleName: tokens.slice(1, -1).join(" ") || undefined, surname: tokens[tokens.length - 1] };
  }
  const tokens = withoutTitle(rest.split(/\s+/).filter(Boolean));
  return {
    surname: withoutTitle(surname.split(/\s+/).filter(Boolean)).join(" ") || surname,
    forename: tokens[0],
    middleName: tokens.slice(1).join(" ") || undefined,
  };
}

export function identityFromOfficer(record: NamedRecord | null | undefined): PersonIdentity {
  const rec = record || {};
  const fromElements = rec.name_elements
    ? {
        forename: fold(rec.name_elements.forename),
        middleName: fold(rec.name_elements.middle_name) || undefined,
        surname: fold(rec.name_elements.surname),
      }
    : null;
  const parsed = fromElements?.surname && fromElements.forename ? fromElements : parseCommaName(rec.name || rec.title || "");
  const postalCode = normalizePostcode(rec.address?.postal_code);
  const snippet = fold(rec.address_snippet);
  const locality = fold(rec.address?.locality) || snippet.split(" ").filter(Boolean).slice(-2, -1)[0];
  const line = fold([rec.address?.premises, rec.address?.address_line_1].filter(Boolean).join(" "));
  const display =
    parsed.forename && parsed.surname
      ? `${titleCaseName(parsed.forename)} ${titleCaseName(parsed.surname)}`
      : rec.name || rec.title || "";
  return {
    forename: parsed.forename || undefined,
    middleName: parsed.middleName || undefined,
    surname: parsed.surname || undefined,
    displayName: display,
    dobMonth: rec.date_of_birth?.month,
    dobYear: rec.date_of_birth?.year,
    postalCode: postalCode || undefined,
    outwardCode: postalCode ? postcodeOutward(postalCode) : undefined,
    postcodeArea: postalCode ? postcodeArea(postalCode) : undefined,
    locality: locality || undefined,
    addressLine1: line || undefined,
  };
}

export function officerSearchQuery(identity: PersonIdentity, fallbackName = ""): string {
  if (identity.forename && identity.surname) {
    return `${titleCaseName(identity.forename)} ${titleCaseName(identity.surname)}`;
  }
  if (fallbackName.includes(",")) {
    return identityFromOfficer({ name: fallbackName }).displayName || fallbackName;
  }
  return fallbackName.trim();
}

export function isIndividualPerson(record: NamedRecord | null | undefined): boolean {
  const rec = record || {};
  if (rec.officer_role && CORPORATE_ROLE.test(rec.officer_role)) return false;
  if (rec.kind && CORPORATE_KIND.test(rec.kind)) return false;
  const name = rec.name || rec.title || "";
  if (COMPANY_NAME.test(name) && !rec.date_of_birth) return false;
  return Boolean(name.trim());
}

function forenamesCompatible(a?: string, b?: string): boolean {
  if (!a || !b) return true;
  if (a === b) return true;
  if (a.length === 1 && b.startsWith(a)) return true;
  if (b.length === 1 && a.startsWith(b)) return true;
  return firstToken(a) === firstToken(b);
}

function withPostcodeParts(person: PersonIdentity): PersonIdentity {
  const postalCode = person.postalCode ? normalizePostcode(person.postalCode) : "";
  if (!postalCode) return person;
  return {
    ...person,
    postalCode,
    outwardCode: person.outwardCode || postcodeOutward(postalCode),
    postcodeArea: person.postcodeArea || postcodeArea(postalCode),
  };
}

export function scoreOfficerMatch(subject: PersonIdentity, candidate: PersonIdentity): OfficerMatch {
  subject = withPostcodeParts(subject);
  candidate = withPostcodeParts(candidate);
  const reasons: string[] = [];
  if (!subject.surname || !candidate.surname || subject.surname !== candidate.surname) {
    return { ok: false, score: 0, reasons, reject: "Different surname" };
  }
  if (!forenamesCompatible(subject.forename, candidate.forename)) {
    return { ok: false, score: 0, reasons, reject: "Different forename" };
  }

  const bothDob = subject.dobYear && candidate.dobYear && subject.dobMonth && candidate.dobMonth;
  const dobMatch = Boolean(
    bothDob && subject.dobYear === candidate.dobYear && subject.dobMonth === candidate.dobMonth
  );
  if (bothDob && !dobMatch) {
    return { ok: false, score: 0, reasons, reject: "Different date of birth" };
  }
  if (dobMatch) reasons.push("date of birth");

  let geoScore = 0;
  if (subject.postalCode && candidate.postalCode) {
    if (subject.postalCode === candidate.postalCode) {
      geoScore = 50;
      reasons.push("same postcode");
    } else if (subject.outwardCode && subject.outwardCode === candidate.outwardCode) {
      geoScore = 30;
      reasons.push("nearby postcode");
    } else if (subject.postcodeArea && subject.postcodeArea === candidate.postcodeArea) {
      geoScore = 8;
      reasons.push("same postcode area");
    } else if (!dobMatch) {
      return { ok: false, score: 0, reasons, reject: "Lives elsewhere" };
    }
  } else if (subject.locality && candidate.locality) {
    if (subject.locality === candidate.locality) {
      geoScore = 20;
      reasons.push("same town");
    } else if (!dobMatch && subject.postalCode && candidate.postalCode) {
      return { ok: false, score: 0, reasons, reject: "Lives elsewhere" };
    } else if (!dobMatch && subject.postcodeArea && candidate.postcodeArea && subject.postcodeArea !== candidate.postcodeArea) {
      return { ok: false, score: 0, reasons, reject: "Lives elsewhere" };
    } else if (!dobMatch && !subject.postalCode && !candidate.postalCode) {
      return { ok: false, score: 0, reasons, reject: "Lives elsewhere" };
    }
  }

  if (subject.addressLine1 && candidate.addressLine1 && subject.addressLine1 === candidate.addressLine1) {
    geoScore = Math.max(geoScore, 40);
    reasons.push("same street");
  }

  let score = geoScore;
  if (dobMatch) score += 40;
  if (subject.middleName && candidate.middleName && subject.middleName === candidate.middleName) {
    score += 5;
    reasons.push("middle name");
  }

  const ok = dobMatch || geoScore >= 20;
  if (!ok) {
    return { ok: false, score, reasons, reject: "Not enough to confirm the same person" };
  }
  return { ok: true, score, reasons };
}

export function pickMatchingOfficerHits<T>(
  subject: PersonIdentity,
  hits: T[],
  getIdentity: (hit: T) => PersonIdentity
): T[] {
  const ranked = hits
    .map((hit) => ({ hit, match: scoreOfficerMatch(subject, getIdentity(hit)) }))
    .filter((row) => row.match.ok)
    .sort((a, b) => b.match.score - a.match.score);
  if (!ranked.length) return [];
  const top = ranked[0].match.score;
  return ranked.filter((row) => row.match.score >= top - 5).map((row) => row.hit);
}

export function matchReasons(subject: PersonIdentity, candidate: PersonIdentity): string {
  return scoreOfficerMatch(subject, candidate).reasons.join(", ");
}

export function officerAppointmentsPath(record: {
  links?: { self?: string; officer?: { appointments?: string } };
} | null | undefined): string | null {
  const path = record?.links?.officer?.appointments || record?.links?.self || "";
  return path.startsWith("/officers/") && path.includes("/appointments") ? path : null;
}
