import { useSyncExternalStore } from "react";
import { api, hasSession, type PublicUser } from "./api";

// Estado global simples com sincronização incremental contra a API.
// O backend é a fonte da verdade; o cliente mantém um cache local por usuário
// e aplica mutações de forma otimista (grava local → push → pull para reconciliar).

export type Record_ = { id: string; rev?: number; deletedAt?: string | null; [k: string]: any };
type Data = Record<string, Record<string, Record_>>;

interface State {
  ready: boolean;
  syncing: boolean;
  user: PublicUser | null;
  cursor: number;
  data: Data;
  error: string | null;
}

let state: State = { ready: false, syncing: false, user: null, cursor: 0, data: {}, error: null };
let snapshot: State = state;
const listeners = new Set<() => void>();

function commit(patch: Partial<State>) {
  state = { ...state, ...patch };
  snapshot = state;
  listeners.forEach((l) => l());
}

export function subscribe(l: () => void) {
  listeners.add(l);
  return () => void listeners.delete(l);
}
export function getSnapshot() {
  return snapshot;
}
export function useStore() {
  return useSyncExternalStore(subscribe, getSnapshot);
}

// ---- cache local ----
function cacheKey(uid: string) {
  return `moments_state_${uid}`;
}
function loadCache(uid: string): { cursor: number; data: Data } | null {
  try {
    const r = localStorage.getItem(cacheKey(uid));
    return r ? JSON.parse(r) : null;
  } catch {
    return null;
  }
}
function saveCache() {
  if (!state.user) return;
  try {
    localStorage.setItem(cacheKey(state.user.id), JSON.stringify({ cursor: state.cursor, data: state.data }));
  } catch {
    /* ignore */
  }
}

function setRecord(collection: string, id: string, rec: Record_) {
  const col = { ...(state.data[collection] || {}), [id]: rec };
  commit({ data: { ...state.data, [collection]: col } });
}
function removeRecord(collection: string, id: string) {
  const col = { ...(state.data[collection] || {}) };
  delete col[id];
  commit({ data: { ...state.data, [collection]: col } });
}

// ---- selectors ----
export function list(data: Data, collection: string): Record_[] {
  return Object.values(data[collection] || {});
}

// ---- ciclo de vida ----
export async function init() {
  if (!hasSession()) {
    commit({ ready: true });
    return;
  }
  try {
    const user = await api.me();
    const cache = loadCache(user.id);
    commit({ user, data: cache?.data || {}, cursor: cache?.cursor || 0 });
    await pull();
  } catch {
    commit({ user: null });
  } finally {
    commit({ ready: true });
  }
}

async function afterAuth(user: PublicUser) {
  const cache = loadCache(user.id);
  commit({ user, data: cache?.data || {}, cursor: cache?.cursor || 0, ready: true, error: null });
  await pull();
}

export async function doLogin(email: string, password: string) {
  await afterAuth(await api.login(email, password));
}
export async function doRegister(email: string, name: string, password: string) {
  await afterAuth(await api.register(email, name, password));
}
export async function doLogout() {
  await api.logout();
  commit({ user: null, data: {}, cursor: 0, error: null });
}
// Atualiza o usuário no estado (ex.: após trocar a foto de perfil).
export function setUser(user: PublicUser) {
  commit({ user });
}

// ---- sincronização ----
export async function pull() {
  if (!state.user) return;
  commit({ syncing: true });
  try {
    const { changes, cursor } = await api.pull(state.cursor);
    const data: Data = { ...state.data };
    for (const [col, rows] of Object.entries(changes)) {
      const m = { ...(data[col] || {}) };
      for (const r of rows as Record_[]) {
        if (r.deletedAt) delete m[r.id];
        else m[r.id] = r;
      }
      data[col] = m;
    }
    commit({ data, cursor: Math.max(state.cursor, cursor), syncing: false, error: null });
    saveCache();
  } catch (e: any) {
    commit({ syncing: false, error: e?.message || "sync_error" });
  }
}

async function pushOne(collection: string, change: Record<string, any>) {
  try {
    await api.push({ [collection]: [change] });
    await pull();
  } catch (e: any) {
    commit({ error: e?.message || "push_error" });
    // Em caso de falha, recarrega o estado autoritativo.
    await pull();
  }
}

export async function createRecord(collection: string, fields: Record<string, any>) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  setRecord(collection, id, { id, ownerId: state.user?.id, rev: 0, deletedAt: null, createdAt: now, updatedAt: now, ...fields });
  saveCache();
  await pushOne(collection, { id, ...fields });
  return id;
}

export async function updateRecord(collection: string, id: string, fields: Record<string, any>) {
  const existing = state.data[collection]?.[id];
  setRecord(collection, id, { ...(existing || { id }), ...fields });
  saveCache();
  await pushOne(collection, { id, ...fields, baseRev: existing?.rev });
}

export async function deleteRecord(collection: string, id: string) {
  const existing = state.data[collection]?.[id];
  removeRecord(collection, id);
  saveCache();
  await pushOne(collection, { id, deleted: true, baseRev: existing?.rev });
}
