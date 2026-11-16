// Tema do app: "light" (claro), "dark" (escuro) ou "system" (segue o sistema).
export type Theme = "light" | "dark" | "system";
const KEY = "moments_theme";

export function getTheme(): Theme {
  try {
    const t = localStorage.getItem(KEY);
    if (t === "light" || t === "dark" || t === "system") return t;
  } catch { /* ignore */ }
  return "system";
}

export function applyTheme(t: Theme) {
  const el = document.documentElement;
  if (t === "system") el.removeAttribute("data-theme");
  else el.setAttribute("data-theme", t);
  try { localStorage.setItem(KEY, t); } catch { /* ignore */ }
}
