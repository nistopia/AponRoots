// API client for AponRoots backend.
// Base URL is taken from NEXT_PUBLIC_API_URL (defaults to localhost:8000).

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const TOKEN_KEY = "aponroots_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export type Gender = "M" | "F" | "X";

export interface Person {
  id: number;
  name: string;
  gender: Gender | null;
  birth_date: string | null;
  death_date: string | null;
  notes: string | null;
  photo_url: string | null;
  birthplace: string | null;
  current_location: string | null;
  occupation: string | null;
  parent_ids: number[];
  children_ids: number[];
  spouse_ids: number[];
  owner_id: number | null;
  can_edit: boolean;
}

export interface PersonCreate {
  name: string;
  gender?: Gender | null;
  birth_date?: string | null;
  death_date?: string | null;
  notes?: string | null;
  photo_url?: string | null;
  birthplace?: string | null;
  current_location?: string | null;
  occupation?: string | null;
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
  path_edges: ("parent" | "child" | "spouse")[];
  via: string | null;
}

export interface User {
  id: number;
  email: string;
  name: string | null;
  is_admin: boolean;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init?.headers as Record<string, string>) ?? {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new ApiError(`API ${res.status}: ${text}`, res.status);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  // Auth
  signup: (email: string, password: string, name?: string) =>
    request<AuthResponse>("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
    }),
  login: (email: string, password: string) =>
    request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  google: (credential: string) =>
    request<AuthResponse>("/auth/google", {
      method: "POST",
      body: JSON.stringify({ credential }),
    }),
  me: () => request<User>("/auth/me"),

  // People
  listPersons: (mine = false) =>
    request<Person[]>(`/persons${mine ? "?mine=true" : ""}`),
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
  uploadPhoto: async (personId: number, file: File): Promise<Person> => {
    const token = getToken();
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${API_URL}/persons/${personId}/photo`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: fd,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new ApiError(`API ${res.status}: ${text}`, res.status);
    }
    return res.json();
  },
  removePhoto: (personId: number) =>
    request<Person>(`/persons/${personId}/photo`, { method: "DELETE" }),
  searchPersons: (q: string, limit = 20) =>
    request<Person[]>(
      `/persons/search?q=${encodeURIComponent(q)}&limit=${limit}`,
    ),
  findRelationship: (a: number, b: number) =>
    request<RelationshipResult>(`/relationships?a=${a}&b=${b}`),
};

