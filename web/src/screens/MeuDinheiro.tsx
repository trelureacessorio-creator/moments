import { useState } from "react";
import { useStore, list, createRecord, deleteRecord } from "../lib/store";
import { isoToday, fmtRel, cap, pIso } from "../lib/dates";

function del(collection: string, id: string) {
  if (confirm("Excluir este item? Esta ação não pode ser desfeita.")) deleteRecord(collection, id);
}

const money = (n: number) => "R$ " + Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 2 });

export function MeuDinheiro({ onBack }: { onBack: () => void }) {
  const s = useStore();
  const [type, setType] = useState("despesa");
  const [val, setVal] = useState("");
  const [cat, setCat] = useState("");

  const all = list(s.data, "financeNotes").filter((f) => !f.deletedAt);
  const monthStart = isoToday().slice(0, 8) + "01";
  const mf = all.filter((f) => f.date >= monthStart);
  const sum = (t: string, arr = mf) => arr.filter((f) => f.type === t).reduce((a, f) => a + f.amount, 0);
  const rec = sum("receita"), desp = sum("despesa"), eco = sum("economia");
  const hasSaldo = rec > 0 && desp > 0;

  const cats: Record<string, number> = {};
  mf.filter((f) => f.type === "despesa").forEach((f) => { const c = f.category || "Outros"; cats[c] = (cats[c] || 0) + f.amount; });
  const catArr = Object.entries(cats).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  const maxc = catArr.reduce((m, c) => Math.max(m, c.value), 0) || 1;

  const ecoAll = all.filter((f) => f.type === "economia").sort((a, b) => String(a.date).localeCompare(String(b.date)));
  let cum = 0;
  const series = ecoAll.map((f) => ({ date: f.date, value: (cum += f.amount) }));

  const mov = all.slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 8);

  async function add() {
    const v = parseFloat(val.replace(",", "."));
    if (!(v > 0)) return;
    const fields: any = { type, amount: v, date: isoToday() };
    if (cat.trim()) fields.category = cat.trim();
    await createRecord("financeNotes", fields);
    setVal(""); setCat("");
  }

  return (
    <>
      <button className="back" onClick={onBack}>‹ Mais</button>
      <div className="hero"><h1 className="scr-title">Meu Dinheiro</h1><p className="scr-sub">Suas anotações deste mês. O Moments não movimenta dinheiro.</p></div>

      <div className="tiles" style={{ marginTop: 14 }}>
        <div className="tile"><div className="t-ic" style={{ color: "var(--good)" }}>▲</div><div className="t-num" style={{ fontSize: 18 }}>{money(rec)}</div><div className="t-lab">receitas no mês</div></div>
        <div className="tile"><div className="t-ic" style={{ color: "var(--crit)" }}>▼</div><div className="t-num" style={{ fontSize: 18 }}>{money(desp)}</div><div className="t-lab">despesas no mês</div></div>
        <div className="tile"><div className="t-ic">◈</div><div className="t-num" style={{ fontSize: 18 }}>{money(eco)}</div><div className="t-lab">economizado</div></div>
        <div className="tile"><div className="t-ic">=</div><div className="t-num" style={{ fontSize: 18 }}>{hasSaldo ? money(rec - desp) : "—"}</div><div className="t-lab">{hasSaldo ? "saldo do mês" : "saldo (dados insuf.)"}</div></div>
      </div>

      <section>
        <div className="sec-head"><h2>Gastos por categoria</h2></div>
        <div className="card" style={{ padding: 14 }}>
          {catArr.length === 0 ? <div className="empty">Sem despesas neste mês</div> : catArr.map((c) => (
            <div className="bar-row" key={c.label}><span className="bar-lab">{c.label}</span><div className="bar-track"><div className="bar-fill" style={{ width: Math.round((c.value / maxc) * 100) + "%" }} /></div><span className="bar-val">{money(c.value)}</span></div>
          ))}
        </div>
      </section>

      {series.length > 1 && (
        <section>
          <div className="sec-head"><h2>Economias acumuladas</h2></div>
          <div className="card" style={{ padding: 14 }}><LineChart series={series} /></div>
        </section>
      )}

      <section>
        <div className="sec-head"><h2>Movimentações</h2></div>
        <div className="card">
          {mov.length === 0 ? <div className="empty">Nenhuma anotação ainda</div> : mov.map((f) => {
            const sign = f.type === "despesa" ? "−" : "+";
            const col = f.type === "despesa" ? "var(--crit)" : f.type === "receita" ? "var(--good)" : "var(--accent)";
            const lab = f.type === "receita" ? "Receita" : f.type === "despesa" ? "Despesa" : "Economia";
            return (
              <div className="row" key={f.id}><div className="r-main"><div className="r-title">{f.category || lab}</div><div className="r-sub">{lab} · {cap(fmtRel(f.date))}</div></div><span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums", color: col }}>{sign}{money(f.amount)}</span><button className="chip-btn" onClick={() => del("financeNotes", f.id)}>excluir</button></div>
            );
          })}
          <div className="addrow">
            <select value={type} onChange={(e) => setType(e.target.value)} style={{ flex: "none", width: 104 }}><option value="despesa">Despesa</option><option value="receita">Receita</option><option value="economia">Economia</option></select>
            <input type="number" inputMode="decimal" placeholder="R$" value={val} onChange={(e) => setVal(e.target.value)} />
            <input placeholder="categoria" value={cat} onChange={(e) => setCat(e.target.value)} />
            <button onClick={add} aria-label="Adicionar">+</button>
          </div>
        </div>
        <div className="foot-note" style={{ marginTop: 10, fontSize: 11.5, color: "var(--faint)", textAlign: "center" }}>Economias ligadas a metas não são contadas duas vezes.</div>
      </section>
    </>
  );
}

function LineChart({ series }: { series: { date: string; value: number }[] }) {
  const W = 512, H = 130, pad = 14, top = 12;
  const max = Math.max(...series.map((s) => s.value)) || 1;
  const t0 = pIso(series[0].date).getTime();
  const t1 = Math.max(pIso(series[series.length - 1].date).getTime(), t0 + 1);
  const sx = (t: number) => pad + ((t - t0) / (t1 - t0)) * (W - 2 * pad);
  const sy = (v: number) => top + (1 - v / max) * (H - 2 * top);
  const pts = series.map((p) => `${sx(pIso(p.date).getTime()).toFixed(1)},${sy(p.value).toFixed(1)}`);
  const area = `M${pad},${H - top} L${pts.join(" L")} L${sx(t1).toFixed(1)},${H - top} Z`;
  const last = series[series.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }} role="img" aria-label="Economias acumuladas">
      <path d={area} fill="var(--accent-soft)" opacity="0.6" />
      <polyline points={pts.join(" ")} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />
      {series.map((p, i) => <circle key={i} cx={sx(pIso(p.date).getTime())} cy={sy(p.value)} r="3" fill="var(--accent)" />)}
      <text x={W - pad} y="16" textAnchor="end" fontSize="11" fill="var(--muted)">{money(last.value)}</text>
    </svg>
  );
}
