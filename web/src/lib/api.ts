// API client for AponRoots backend.
// Base URL is taken from NEXT_PUBLIC_API_URL (defaults to localhost:8000).

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type Gender = "M" | "F" | "X";

export interface Person {
  id: number;
  name: string;
  gender: Gender | null;
  birth_date: string | null;
  death_date: string | null;
  notes: string | null;
  parent_ids: number[];
  children_ids: number[];
  spouse_ids: number[];
}

export interface PersonCreate {
  name: string;
  gender?: Gender | null;
  birth_date?: string | null;
  death_date?: string | null;
  notes?: string | null;
  parent_ids?: number[];
}

export interface RelationshipResult {
  person_a_id: number;
  person_b_id: number;
  person_a_name: string;
  person_b_name: string;
  relationship: string;
  common_ancestor_id: number | null;
  common_ancestor_name: string | null;
  distance_a: number | null;
  distance_b: number | null;
  path: number[];
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  listPersons: () => request<Person[]>("/persons"),
  getPerson: (id: number) => request<Person>(`/persons/${id}`),
  createPerson: (payload: PersonCreate) =>
    request<Person>("/persons", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updatePerson: (id: number, payload: Partial<PersonCreate>) =>
    request<Person>(`/persons/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deletePerson: (id: number) =>
    request<void>(`/persons/${id}`, { method: "DELETE" }),
  addParent: (childId: number, parentId: number) =>
    request<Person>(`/persons/${childId}/parents`, {
      method: "POST",
      body: JSON.stringify({ parent_id: parentId }),
    }),
  removeParent: (childId: number, parentId: number) =>
    request<void>(`/persons/${childId}/parents/${parentId}`, {
      method: "DELETE",
    }),
  addSpouse: (personId: number, spouseId: number) =>
    request<Person>(`/persons/${personId}/spouses`, {
      method: "POST",
      body: JSON.stringify({ spouse_id: spouseId }),
    }),
  removeSpouse: (personId: number, spouseId: number) =>
    request<void>(`/persons/${personId}/spouses/${spouseId}`, {
      method: "DELETE",
    }),
  findRelationship: (a: number, b: number) =>
    request<RelationshipResult>(`/relationships?a=${a}&b=${b}`),
};
