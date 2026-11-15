import { useState } from "react";
import { useStore, list, createRecord, updateRecord } from "../lib/store";
import { TODAY, addDays, iso, pIso, fmtRel, fmtLong, cap, MOL, WD_S } from "../lib/dates";

export function Calendario() {
  const s = useStore();
  const [cursor, setCursor] = useState(new Date(TODAY.getFullYear(), TODAY.getMonth(), 1));
  const [sel, setSel] = useState(iso(TODAY));
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("09:00");

  const appts = list(s.data, "appointments");
  const tasks = list(s.data, "tasks");

  function onDay(di: string) {
    return {
      a: appts.filter((x) => x.date === di),
      t: tasks.filter((x) => x.date === di),
    };
  }

  const y = cursor.getFullYear();
  const mo = cursor.getMonth();
  const first = new Date(y, mo, 1);
  const start = addDays(first, -first.getDay());
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = addDays(start, i);
    const di = iso(d);
    const it = onDay(di);
    const out = d.getMonth() !== mo;
    if (i > 27 && out && d > first) break;
    cells.push(
      <button
        key={di}
        className={"cell" + (out ? " out" : "") + (di === iso(TODAY) ? " today" : "") + (di === sel ? " sel" : "")}
        onClick={() => setSel(di)}
      >
        {d.getDate()}
        <span className="dots">
          {it.a.length > 0 && <span className="d" />}
          {it.t.length > 0 && <span className="d task" />}
        </span>
      </button>
    );
  }

  const day = onDay(sel);
  const rows = [...day.a.sort((a, b) => String(a.time).localeCompare(String(b.time)))];

  async function addAppt(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    setTitle("");
    await createRecord("appointments", { title: t, date: sel, time, status: "scheduled" });
  }

  return (
    <>
      <div className="hero"><h1 className="scr-title">Calendário</h1></div>

      <div className="cal-head">
        <span className="mname">{MOL[mo]} {y}</span>
        <div className="cal-nav">
          <button aria-label="Anterior" onClick={() => setCursor(new Date(y, mo - 1, 1))}>‹</button>
          <button aria-label="Próximo" onClick={() => setCursor(new Date(y, mo + 1, 1))}>›</button>
        </div>
      </div>
      <div className="grid7">
        {WD_S.map((w) => (<div className="dow" key={w}>{w}</div>))}
        {cells}
      </div>

      <section>
        <div className="sec-head"><h2>{cap(fmtRel(sel))} · {pIso(sel).getDate()} de {MOL[pIso(sel).getMonth()]}</h2></div>
        <div className="card">
          {rows.length === 0 && day.t.length === 0 ? (
            <div className="empty">Nada marcado neste dia</div>
          ) : (
            <>
              {rows.map((a) => (
                <div className={"row" + (a.status === "done" ? " done" : "")} key={a.id}>
                  <span className="time">{a.time}</span>
                  <div className="r-main"><div className="r-title">{a.title}</div>{a.place && <div className="r-sub">{a.place}</div>}</div>
                  <button className={"check" + (a.status === "done" ? " on" : "")} aria-label="Concluir" onClick={() => updateRecord("appointments", a.id, { status: a.status === "done" ? "scheduled" : "done" })}>✓</button>
                </div>
              ))}
              {day.t.map((t) => (
                <div className={"row" + (t.done ? " done" : "")} key={t.id}>
                  <button className={"check" + (t.done ? " on" : "")} aria-label="Concluir" onClick={() => updateRecord("tasks", t.id, { done: !t.done, doneAt: t.done ? null : iso(TODAY) })}>✓</button>
                  <div className="r-main"><div className="r-title">{t.text}</div><div className="r-sub">tarefa</div></div>
                </div>
              ))}
            </>
          )}
          <form className="addrow" onSubmit={addAppt}>
            <input placeholder="Novo compromisso…" value={title} onChange={(e) => setTitle(e.target.value)} />
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={{ flex: "none", width: "96px" }} />
            <button type="submit" aria-label="Adicionar">+</button>
          </form>
        </div>
      </section>
    </>
  );
}
