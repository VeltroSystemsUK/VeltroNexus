import type { ProspectWithCompany, Company, InsertProspect, InsertCompany } from "@shared/schema";

const API_BASE = "/api";

async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "An error occurred" }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export const api = {
  prospects: {
    list: () => fetchAPI<ProspectWithCompany[]>("/prospects"),

    get: (id: number) => fetchAPI<ProspectWithCompany>(`/prospects/${id}`),

    create: (data: InsertProspect) =>
      fetchAPI<ProspectWithCompany>("/prospects", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    updateStage: (prospectId: number, stage: string) =>
      fetchAPI<ProspectWithCompany>(`/prospects/${prospectId}/stage`, {
        method: "PATCH",
        body: JSON.stringify({ stage }),
      }),

    update: (id: number, updates: Partial<InsertProspect>) =>
      fetchAPI<ProspectWithCompany>(`/prospects/${id}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      }),
  },

  companies: {
    getByNumber: (number: string) => fetchAPI<Company>(`/companies/${number}`),

    create: (data: InsertCompany) =>
      fetchAPI<Company>("/companies", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },
};
