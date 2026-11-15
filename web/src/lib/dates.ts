export const WD = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
export const WD_S = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
export const MO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const MOL = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export function sod(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
export const TODAY = sod(new Date());

export function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
export function iso(d: Date) {
  const x = sod(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}
export function pIso(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
export function diffDays(s: string) {
  return Math.round((pIso(s).getTime() - TODAY.getTime()) / 864e5);
}
export function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
export function fmtLong(d: Date) {
  return `${WD[d.getDay()]}, ${d.getDate()} de ${MOL[d.getMonth()]}`;
}
export function fmtRel(s: string) {
  const n = diffDays(s);
  if (n === 0) return "Hoje";
  if (n === 1) return "Amanhã";
  if (n === -1) return "Ontem";
  if (n > 1 && n < 7) return cap(WD[pIso(s).getDay()]);
  const d = pIso(s);
  return `${d.getDate()} ${MO[d.getMonth()]}`;
}
export function isoToday() {
  return iso(TODAY);
}
export function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
