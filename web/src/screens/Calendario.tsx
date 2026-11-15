import { useState } from "react";
import { useStore, list, createRecord, updateRecord } from "../lib/store";
import { ApptEditor } from "../components/ApptEditor";
import { TODAY, addDays, iso, pIso, fmtRel, cap, MOL, MO, WD, WD_S } from "../lib/dates";

type View = "dia" | "semana" | "mes";

export function Calendario() {
  const s = useStore();
  const [view, setView] = useState<View>("mes");
  const [cursor, setCursor] = useState(new Date(TODAY.getFullYear(), TODAY.getMonth(), 1));
  const [sel, setSel] = useState(iso(TODAY));
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("09:00");
  const [editing, setEditing] = useState<any | null>(null);

  const appts = list(s.data, "appointments");
  const tasks = list(s.data, "tasks");
  const onDay = (di: string) => ({
    a: appts.filter((x) => x.date === di).sort((a, b) => String(a.time).localeCompare(String(b.time))),
    t: tasks.filter((x) => x.date === di),
  });

  async function addAppt(e: React.FormEvent, day: string) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    setTitle("");
    await createRecord("appointments", { title: t, date: day, time, status: "scheduled" });
  }

  function apptRow(a: any) {
    return (
      <div className={"row" + (a.status === "done" ? " done" : "")} key={a.id}>
        <span className="time">{a.time}</span>
        <div className="r-main clickable" onClick={() => setEditing(a)}>
          <div className="r-title">{a.title}</div>
          <div className="r-sub">{a.place ? a.place + " · " : ""}toque para editar</div>
        </div>
        <button className={"check" + (a.status === "done" ? " on" : "")} aria-label="Concluir" onClick={() => updateRecord("appointments", a.id, { status: a.status === "done" ? "scheduled" : "done" })}>✓</button>
      </div>
    );
  }
  function taskRow(t: any) {
    return (
      <div className={"row" + (t.done ? " done" : "")} key={t.id}>
        <button className={"check" + (t.done ? " on" : "")} aria-label="Concluir" onClick={() => updateRecord("tasks", t.id, { done: !t.done, doneAt: t.done ? null : iso(TODAY) })}>✓</button>
        <div className="r-main"><div className="r-title">{t.text}</div><div className="r-sub">tarefa</div></div>
      </div>
    );
  }

  function dayPanel(di: string) {
    const day = onDay(di);
    const empty = day.a.length === 0 && day.t.length === 0;
    return (
      <div className="card">
        {empty ? <div className="empty">Nada marcado neste dia</div> : (<>{day.a.map(apptRow)}{day.t.map(taskRow)}</>)}
        <form className="addrow" onSubmit={(e) => addAppt(e, di)}>
          <input placeholder="Novo compromisso…" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={{ flex: "none", width: "96px" }} />
          <button type="submit" aria-label="Adicionar">+</button>
        </form>
      </div>
    );
  }

  // ---- Mês ----
  function monthGrid() {
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
        <button key={di} className={"cell" + (out ? " out" : "") + (di === iso(TODAY) ? " today" : "") + (di === sel ? " sel" : "")} onClick={() => setSel(di)}>
          {d.getDate()}
          <span className="dots">{it.a.length > 0 && <span className="d" />}{it.t.length > 0 && <span className="d task" />}</span>
        </button>
      );
    }
    return (
      <>
        <div className="cal-head">
          <span className="mname">{MOL[mo]} {y}</span>
          <div className="cal-nav">
            <button aria-label="Anterior" onClick={() => setCursor(new Date(y, mo - 1, 1))}>‹</button>
            <button aria-label="Próximo" onClick={() => setCursor(new Date(y, mo + 1, 1))}>›</button>
          </div>
        </div>
        <div className="grid7">{WD_S.map((w) => (<div className="dow" key={w}>{w}</div>))}{cells}</div>
        <section>
          <div className="sec-head"><h2>{cap(fmtRel(sel))} · {pIso(sel).getDate()} de {MOL[pIso(sel).getMonth()]}</h2></div>
          {dayPanel(sel)}
        </section>
      </>
    );
  }

  // ---- Semana ----
  function weekList() {
    const base = pIso(sel);
    const start = addDays(base, -base.getDay());
    const label = `${start.getDate()} ${MO[start.getMonth()]} – ${addDays(start, 6).getDate()} ${MO[addDays(start, 6).getMonth()]}`;
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(start, i);
      const di = iso(d);
      const it = onDay(di);
      days.push(
        <section key={di}>
          <div className="sec-head"><h2>{cap(WD[d.getDay()])} · {d.getDate()} {MO[d.getMonth()]}{di === iso(TODAY) ? " · hoje" : ""}</h2></div>
          <div className="card">{it.a.length === 0 && it.t.length === 0 ? <div className="empty">Sem itens</div> : <>{it.a.map(apptRow)}{it.t.map(taskRow)}</>}</div>
        </section>
      );
    }
    return (
      <>
        <div className="cal-head">
          <span className="mname" style={{ textTransform: "none" }}>Semana de {label}</span>
          <div className="cal-nav">
            <button aria-label="Anterior" onClick={() => setSel(iso(addDays(start, -7)))}>‹</button>
            <button aria-label="Próximo" onClick={() => setSel(iso(addDays(start, 7)))}>›</button>
          </div>
        </div>
        {days}
      </>
    );
  }

  // ---- Dia ----
  function dayView() {
    return (
      <>
        <div className="cal-head">
          <span className="mname" style={{ textTransform: "none" }}>{cap(fmtRel(sel))}, {pIso(sel).getDate()} de {MOL[pIso(sel).getMonth()]}</span>
          <div className="cal-nav">
            <button aria-label="Anterior" onClick={() => setSel(iso(addDays(pIso(sel), -1)))}>‹</button>
            <button aria-label="Próximo" onClick={() => setSel(iso(addDays(pIso(sel), 1)))}>›</button>
          </div>
        </div>
        {dayPanel(sel)}
      </>
    );
  }

  return (
    <>
      <div className="hero"><h1 className="scr-title">Calendário</h1></div>
      <div className="seg">
        {(["dia", "semana", "mes"] as View[]).map((v) => (
          <button key={v} className={view === v ? "on" : ""} onClick={() => setView(v)}>{v === "dia" ? "Dia" : v === "semana" ? "Semana" : "Mês"}</button>
        ))}
      </div>

      {view === "mes" && monthGrid()}
      {view === "semana" && weekList()}
      {view === "dia" && dayView()}

      {editing && <ApptEditor appt={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
