import { useState } from "react";
import { useStore, list } from "../lib/store";
import { TODAY, addDays, iso, isoToday, fmtRel, cap, WD_S } from "../lib/dates";

const money = (n: number) => "R$ " + Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
type View = "semana" | "mes" | "ano";

export function Evolucao({ onBack }: { onBack: () => void }) {
  const s = useStore();
  const [view, setView] = useState<View>("semana");

  const today = isoToday();
  const start = view === "semana" ? iso(addDays(TODAY, -6)) : view === "mes" ? today.slice(0, 8) + "01" : today.slice(0, 4) + "-01-01";
  const plabel = view === "semana" ? "nos últimos 7 dias" : view === "mes" ? "neste mês" : "neste ano";

  const tasks = list(s.data, "tasks").filter((t) => !t.deletedAt);
  const doneT = tasks.filter((t) => t.done && t.doneAt && t.doneAt >= start).length;
  const logs = list(s.data, "habitLogs").filter((l) => !l.deletedAt && l.done && l.date >= start).length;
  const diary = list(s.data, "diary").filter((d) => !d.deletedAt);
  const moments = diary.filter((d) => d.date >= start);
  const saved = list(s.data, "financeNotes").filter((f) => !f.deletedAt && f.type === "economia" && f.date >= start).reduce((a, f) => a + f.amount, 0);
  const metasOk = list(s.data, "goals").filter((g) => !g.deletedAt && g.targetValue != null && g.currentValue >= g.targetValue).length;

  return (
    <>
      <button className="back" onClick={onBack}>‹ Mais</button>
      <div className="hero"><h1 className="scr-title">Minha Evolução</h1></div>
      <div className="seg" style={{ marginTop: 12 }}>
        {(["semana", "mes", "ano"] as View[]).map((v) => (
          <button key={v} className={view === v ? "on" : ""} onClick={() => setView(v)}>{v === "semana" ? "Semana" : v === "mes" ? "Mês" : "Ano"}</button>
        ))}
      </div>

      <p className="scr-sub" style={{ marginTop: 14 }}>
        Você concluiu <b>{doneT}</b> tarefa{doneT !== 1 ? "s" : ""}, registrou <b>{logs}</b> check-in{logs !== 1 ? "s" : ""} de hábitos e guardou <b>{moments.length}</b> momento{moments.length !== 1 ? "s" : ""} {plabel}.
      </p>

      {metasOk > 0 && (
        <div className="alert" style={{ background: "var(--good-soft)", borderColor: "color-mix(in srgb, var(--good) 30%, transparent)" }}>
          <span className="a-ic" style={{ color: "var(--good)" }}>★</span>
          <div className="a-body"><b>{metasOk}</b> meta{metasOk !== 1 ? "s" : ""} alcançada{metasOk !== 1 ? "s" : ""}. Parabéns!</div>
        </div>
      )}

      <div className="tiles" style={{ marginTop: 14 }}>
        <div className="tile"><div className="t-ic">✓</div><div className="t-num">{doneT}</div><div className="t-lab">tarefas concluídas</div></div>
        <div className="tile"><div className="t-ic">✦</div><div className="t-num">{logs}</div><div className="t-lab">check-ins de hábitos</div></div>
        <div className="tile"><div className="t-ic">✎</div><div className="t-num">{moments.length}</div><div className="t-lab">momentos guardados</div></div>
        <div className="tile"><div className="t-ic">◈</div><div className="t-num" style={{ fontSize: 18 }}>{money(saved)}</div><div className="t-lab">economizado</div></div>
      </div>

      {view === "semana" && (
        <section><div className="sec-head"><h2>Hábitos por dia</h2></div><div className="card" style={{ padding: 14 }}><WeekBars data={s.data} /></div></section>
      )}

      <section>
        <div className="sec-head"><h2>Momentos especiais</h2></div>
        <div className="card">
          {moments.length === 0 ? <div className="empty">Nenhum momento neste período</div> : moments.slice(0, 6).map((e) => (
            <div className="row" key={e.id}><span className="favatar" style={{ background: "var(--warm-soft)" }}>✎</span><div className="r-main"><div className="r-title">{e.title}</div><div className="r-sub">{cap(fmtRel(e.date))}{e.mood ? ` · ${e.mood}` : ""}</div></div></div>
          ))}
        </div>
      </section>
    </>
  );
}

function WeekBars({ data }: { data: any }) {
  const logs = list(data, "habitLogs").filter((l) => !l.deletedAt && l.done);
  const days = [];
  let max = 1;
  for (let i = 6; i >= 0; i--) {
    const d = addDays(TODAY, -i);
    const di = iso(d);
    const c = logs.filter((l) => l.date === di).length;
    days.push({ lab: WD_S[d.getDay()], val: c });
    max = Math.max(max, c);
  }
  const W = 512, H = 120, pad = 16, gap = (W - 2 * pad) / 7, bw = gap * 0.56;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }} role="img" aria-label="Check-ins de hábitos por dia na semana">
      {days.map((d, i) => {
        const x = pad + i * gap + (gap - bw) / 2;
        const bh = (d.val / max) * (H - 42);
        const y = H - 24 - bh;
        return (
          <g key={i}>
            <rect x={x} y={y} width={bw} height={Math.max(bh, 2)} rx="3" fill="var(--accent)" />
            <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--muted)">{d.lab}</text>
            {d.val > 0 && <text x={x + bw / 2} y={y - 4} textAnchor="middle" fontSize="10" fill="var(--fg)">{d.val}</text>}
          </g>
        );
      })}
    </svg>
  );
}
