import { api } from "./api";

// Push no navegador (Web Push). No iPhone, só funciona com o app adicionado à
// Tela de Início (PWA instalado) e no iOS 16.4+.

export function pushSupported(): boolean {
  return typeof navigator !== "undefined" && "serviceWorker" in navigator
    && typeof window !== "undefined" && "PushManager" in window && "Notification" in window;
}

// Detecta se o app está rodando "instalado" (standalone) — necessário no iOS.
export function isStandalone(): boolean {
  try {
    return window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
  } catch { return false; }
}

function urlB64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export type PushState = "unsupported" | "denied" | "on" | "off";

export async function pushStatus(): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    return sub ? "on" : "off";
  } catch { return "off"; }
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export async function enablePush(): Promise<PushState | "error"> {
  if (!pushSupported()) return "unsupported";
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return "denied";
  try {
    const reg = await navigator.serviceWorker.ready;
    const { key } = await api.pushKey();
    const appKey = urlB64ToUint8Array(key);
    let sub = await reg.pushManager.getSubscription();
    if (sub) {
      // Se a chave do servidor mudou, a inscrição antiga não serve: recria.
      const existing = (sub.options && (sub.options as any).applicationServerKey) as ArrayBuffer | null;
      const ok = existing ? sameBytes(new Uint8Array(existing), appKey) : false;
      if (!ok) { await sub.unsubscribe().catch(() => {}); sub = null; }
    }
    if (!sub) {
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: appKey });
    }
    const j: any = sub.toJSON();
    await api.pushSubscribe({ endpoint: sub.endpoint, keys: { p256dh: j.keys.p256dh, auth: j.keys.auth } });
    return "on";
  } catch {
    return "error";
  }
}

// Diagnóstico completo + teste: percorre cada passo e devolve onde falhou (texto claro).
export async function diagnoseAndTest(): Promise<string> {
  if (!pushSupported()) return "Este navegador/app não suporta notificações push.";
  if (typeof Notification !== "undefined" && Notification.permission === "denied") {
    return "As notificações estão BLOQUEADAS. Vá em Ajustes do iPhone → Moments → Notificações e permita.";
  }
  try {
    if (Notification.permission !== "granted") {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return "Permissão não concedida (" + perm + ").";
    }
    const reg = await navigator.serviceWorker.ready;
    let key: string;
    try { key = (await api.pushKey()).key; }
    catch (e: any) { return "Falha ao obter a chave do servidor (código " + (e?.status || "?") + ")."; }
    const appKey = urlB64ToUint8Array(key);

    let sub = await reg.pushManager.getSubscription();
    if (sub) {
      const existing = (sub.options && (sub.options as any).applicationServerKey) as ArrayBuffer | null;
      const ok = existing ? sameBytes(new Uint8Array(existing), appKey) : false;
      if (!ok) { await sub.unsubscribe().catch(() => {}); sub = null; }
    }
    if (!sub) {
      try { sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: appKey }); }
      catch (e: any) { return "Falha ao criar a inscrição no navegador: " + (e?.message || e) + "."; }
    }
    const j: any = sub.toJSON();
    try { await api.pushSubscribe({ endpoint: sub.endpoint, keys: { p256dh: j.keys.p256dh, auth: j.keys.auth } }); }
    catch (e: any) { return "Falha ao salvar a inscrição no servidor (código " + (e?.status || "?") + (e?.body?.error ? ", " + e.body.error : "") + ")."; }
    try { const res = await api.pushTest(); return "Enviado para " + res.devices + " aparelho(s)! Deve chegar em instantes. 🔔"; }
    catch (e: any) { return "Inscrição salva, mas o envio falhou (código " + (e?.status || "?") + (e?.body?.error ? ", " + e.body.error : "") + ")."; }
  } catch (e: any) {
    return "Erro inesperado: " + (e?.message || e) + ".";
  }
}

// Re-registra no servidor a inscrição que o navegador já tem (autocorreção silenciosa).
export async function syncSubscription(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    if (!sub) return;
    const j: any = sub.toJSON();
    await api.pushSubscribe({ endpoint: sub.endpoint, keys: { p256dh: j.keys.p256dh, auth: j.keys.auth } });
  } catch { /* ignore */ }
}

export async function disablePush(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    if (sub) {
      await api.pushUnsubscribe(sub.endpoint).catch(() => {});
      await sub.unsubscribe().catch(() => {});
    }
  } catch { /* ignore */ }
}
