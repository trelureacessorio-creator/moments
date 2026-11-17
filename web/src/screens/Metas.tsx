import { useState } from "react";
import { useStore, list, createRecord, updateRecord, deleteRecord } from "../lib/store";
import { TODAY, pIso, iso, isoToday, fmtRel, cap } from "../lib/dates";

function del(collection: string, id: string) {
  if (confirm("Excluir este item? Esta ação não pode ser desfeita.")) deleteRecord(collection, id);
}

const money = (n: number) => "R$ " + Number(n).toLocaleString("pt-BR");
function daysLeft(deadline: string) {
  return Math.round((pIso(deadline).getTime() - TODAY.getTime()) / 864e5);
}
function pct(g: any) {
  return g.targetValue ? Math.min(100, Math.round((g.currentValue / g.targetValue) * 100)) : 0;
}
function pace(g: any) {
  const n = daysLeft(g.deadline);
  const rem = (g.targetValue ?? 0) - g.currentValue;
  if (n <= 0 || rem <= 0) return "—";
  return g.type === "money" ? `${money(rem / n)} por dia` : `${Math.ceil((rem / n) * 7)} ${g.unit || ""}/semana`.trim();
}

export function Metas({ onBack }: { onBack: () => void }) {
  const s = useStore();
  const [sel, setSel] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [type, setType] = useState("count");

  const goals = list(s.data, "goals").filter((g) => !g.deletedAt);
  const current = sel ? goals.find((g) => g.id === sel) : null;
  if (sel && current) return <Detail g={current} data={s.data} onBack={() => setSel(null)} />;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const tg = parseFloat(target.replace(",", "."));
    if (!name.trim() || !(tg > 0)) return;
    const id = await createRecord("goals", { name: name.trim(), type, targetValue: tg, currentValue: 0, unit: type === "count" ? "" : "", startDate: isoToday(), deadline: iso(new Date(TODAY.getFullYear(), TODAY.getMonth() + 1, TODAY.getDate())), status: "active" });
    await createRecord("goalHistory", { goalId: id, date: isoToday(), value: 0, source: "manual" });
    setName(""); setTarget("");
  }

  return (
    <>
      <button className="back" onClick={onBack}>‹ Mais</button>
      <div className="hero"><h1 className="scr-title">Minhas Metas</h1><p className="scr-sub">Acompanhe o progresso e o ritmo de cada objetivo.</p></div>
      <section>
        <div className="card">
          {goals.length === 0 ? <div className="empty">Nenhuma meta ainda.</div> : goals.map((g) => {
            const n = daysLeft(g.deadline);
            return (
              <div className="goal tap" key={g.id} onClick={() => setSel(g.id)}>
                <div className="goal-top"><span className="goal-name">{g.name}</span><span className={"goal-dl" + (n >= 0 && n <= 10 ? " soon" : "")}>{n < 0 ? "prazo passou" : n === 0 ? "vence hoje" : `faltam ${n} dias`}</span></div>
                <div className="track"><div className="fill" style={{ width: pct(g) + "%" }} /></div>
                <div className="goal-foot"><span className="goal-nums">{g.type === "money" ? <><b>{money(g.currentValue)}</b> de {money(g.targetValue)}</> : <><b>{g.currentValue}</b> de {g.targetValue} {g.unit}</>} · {pct(g)}%</span><span style={{ display: "flex", gap: 10, alignItems: "center" }}><button className="chip-btn" onClick={(e) => { e.stopPropagation(); del("goals", g.id); }}>excluir</button><span className="upd">Ver →</span></span></div>
              </div>
            );
          })}
        </div>
      </section>
      <div className="card" style={{ marginTop: 14 }}>
        <form className="addrow" onSubmit={add}>
          <input placeholder="Nova meta…" value={name} onChange={(e) => setName(e.target.value)} />
          <select value={type} onChange={(e) => setType(e.target.value)} style={{ flex: "none", width: 92 }}><option value="count">unid.</option><option value="money">R$</option></select>
          <input type="number" inputMode="decimal" placeholder="alvo" value={target} onChange={(e) => setTarget(e.target.value)} style={{ flex: "none", width: 80 }} />
          <button type="submit" aria-label="Adicionar">+</button>
        </form>
      </div>
    </>
  );
}

function Detail({ g, data, onBack }: { g: any; data: any; onBack: () => void }) {
  const [val, setVal] = useState("");
  const [stepText, setStepText] = useState("");
  const steps = list(data, "goalSteps").filter((x) => x.goalId === g.id && !x.deletedAt);
  const history = list(data, "goalHistory").filter((x) => x.goalId === g.id && !x.deletedAt).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const n = daysLeft(g.deadline);
  const rem = (g.targetValue ?? 0) - g.currentValue;
  const remTxt = g.type === "money" ? money(rem) : `${rem} ${g.unit || ""}`.trim();

  async function register() {
    const v = parseFloat(val.replace(",", "."));
    if (!(v > 0)) return;
    const nv = Math.min(g.targetValue ?? Infinity, g.currentValue + v);
    await updateRecord("goals", g.id, { currentValue: nv });
    await createRecord("goalHistory", { goalId: g.id, date: isoToday(), value: nv, source: "manual" });
    setVal("");
  }
  async function addStep() {
    if (!stepText.trim()) return;
    await createRecord("goalSteps", { goalId: g.id, text: stepText.trim(), done: false });
    setStepText("");
  }

  return (
    <>
      <button className="back" onClick={onBack}>‹ Metas</button>
      <div className="hero"><h1 className="scr-title">{g.name}</h1></div>
      <div className="card" style={{ marginTop: 14, padding: 16 }}>
        <div className="track" style={{ height: 12 }}><div className="fill" style={{ width: pct(g) + "%" }} /></div>
        <div className="goal-foot"><span className="goal-nums">{g.type === "money" ? <><b>{money(g.currentValue)}</b> de {money(g.targetValue)}</> : <><b>{g.currentValue}</b> de {g.targetValue} {g.unit}</>}</span><span className="goal-nums"><b>{pct(g)}%</b></span></div>
        <div className="tiles" style={{ marginTop: 14 }}>
          <div className="tile"><div className="t-num" style={{ fontSize: 19 }}>{n < 0 ? 0 : n}</div><div className="t-lab">dias restantes</div></div>
          <div className="tile"><div className="t-num" style={{ fontSize: 19 }}>{remTxt}</div><div className="t-lab">ainda faltam</div></div>
          <div className="tile"><div className="t-num" style={{ fontSize: 16 }}>{pace(g)}</div><div className="t-lab">ritmo sugerido</div></div>
          <div className="tile"><div className="t-num" style={{ fontSize: 16 }}>{cap(fmtRel(g.deadline))}</div><div className="t-lab">prazo final</div></div>
        </div>
        <div className="updbox">
          <input type="number" inputMode="decimal" placeholder={g.type === "money" ? "+ valor (R$)" : "+ quantidade"} value={val} onChange={(e) => setVal(e.target.value)} />
          <button className="go" onClick={register}>Registrar progresso</button>
        </div>
      </div>

      {history.length > 1 && (
        <section><div className="sec-head"><h2>Evolução</h2></div><div className="card" style={{ padding: 14 }}><Chart history={history} target={g.targetValue} /></div></section>
      )}

      <section>
        <div className="sec-head"><h2>Etapas</h2></div>
        <div className="card">
          {steps.length === 0 ? <div className="empty">Sem etapas</div> : steps.map((st) => (
            <div className="row" key={st.id}>
              <button className={"check" + (st.done ? " on" : "")} aria-label="Concluir" onClick={() => updateRecord("goalSteps", st.id, { done: !st.done })}>✓</button>
              <div className="r-main"><div className="r-title" style={{ textDecoration: st.done ? "line-through" : "none", color: st.done ? "var(--faint)" : "var(--fg)" }}>{st.text}</div></div>
              <button className="chip-btn" onClick={() => del("goalSteps", st.id)}>excluir</button>
            </div>
          ))}
          <div className="addrow"><input placeholder="Nova etapa…" value={stepText} onChange={(e) => setStepText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addStep(); }} /><button onClick={addStep} aria-label="Adicionar">+</button></div>
        </div>
      </section>

      <section>
        <div className="sec-head"><h2>Histórico</h2></div>
        <div className="card">
          {history.length === 0 ? <div className="empty">Sem registros</div> : history.slice().reverse().map((h, i, arr) => {
            const prev = arr[i + 1];
            const delta = prev ? h.value - prev.value : h.value;
            return (
              <div className="row" key={h.id}><div className="r-main"><div className="r-title">{g.type === "money" ? money(h.value) : `${h.value} ${g.unit || ""}`}</div><div className="r-sub">{cap(fmtRel(h.date))}{delta ? ` · ${delta > 0 ? "+" : ""}${g.type === "money" ? money(delta) : delta}` : ""}</div></div></div>
            );
          })}
        </div>
      </section>

      <section>
        <button className="btn ghost" style={{ width: "100%", color: "var(--crit)" }}
          onClick={() => { if (confirm(`Excluir a meta "${g.name}"? Esta ação não pode ser desfeita.`)) { deleteRecord("goals", g.id); onBack(); } }}>
          Excluir meta
        </button>
      </section>
    </>
  );
}

function Chart({ history, target }: { history: any[]; target: number }) {
  const W = 512, H = 130, pad = 14, top = 12;
  const max = Math.max(target || 1, ...history.map((h) => h.value || 0)) || 1;
  const t0 = pIso(history[0].date).getTime();
  const t1 = Math.max(pIso(history[history.length - 1].date).getTime(), t0 + 1);
  const sx = (t: number) => pad + ((t - t0) / (t1 - t0)) * (W - 2 * pad);
  const sy = (v: number) => top + (1 - v / max) * (H - 2 * top);
  const pts = history.map((h) => `${sx(pIso(h.date).getTime()).toFixed(1)},${sy(h.value).toFixed(1)}`);
  const area = `M${pad},${H - top} L${pts.join(" L")} L${sx(t1).toFixed(1)},${H - top} Z`;
  const ty = sy(target);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }} role="img" aria-label="Evolução do progresso da meta">
      <line x1={pad} y1={ty} x2={W - pad} y2={ty} stroke="var(--warm)" strokeWidth="1" strokeDasharray="4 4" />
      <path d={area} fill="var(--accent-soft)" opacity="0.6" />
      <polyline points={pts.join(" ")} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />
      {history.map((h, i) => <circle key={i} cx={sx(pIso(h.date).getTime())} cy={sy(h.value)} r="3" fill="var(--accent)" />)}
    </svg>
  );
}
