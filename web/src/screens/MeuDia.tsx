import { useState } from "react";
import { useStore, list, createRecord, updateRecord } from "../lib/store";
import { isoToday, fmtLong, TODAY, cap, iso, addDays } from "../lib/dates";

export function MeuDia() {
  const s = useStore();
  const [taskText, setTaskText] = useState("");
  const [busy, setBusy] = useState(false);

  const today = isoToday();
  const appts = list(s.data, "appointments")
    .filter((a) => a.date === today)
    .sort((a, b) => String(a.time).localeCompare(String(b.time)));
  const openAppts = appts.filter((a) => a.status !== "done");
  const tasks = list(s.data, "tasks");
  const pending = tasks.filter((t) => !t.done);
  const goals = list(s.data, "goals").filter((g) => g.status !== "done");

  const hour = new Date().getHours();
  const greet = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    const text = taskText.trim();
    if (!text) return;
    setBusy(true);
    setTaskText("");
    await createRecord("tasks", { text, done: false, date: today, priority: "" });
    setBusy(false);
  }

  const weekAgo = iso(addDays(TODAY, -6));
  const doneWeek = tasks.filter((t) => t.done && t.doneAt && t.doneAt >= weekAgo).length;
  const apptsWeek = list(s.data, "appointments").filter((a) => a.date >= today && a.date <= iso(addDays(TODAY, 6))).length;

  return (
    <>
      <div className="hero">
        <h1>
          {greet}, <span className="accent">{s.user?.name?.split(" ")[0]}</span>
        </h1>
        <p>
          {cap(fmtLong(TODAY))} · {openAppts.length ? `${openAppts.length} compromisso${openAppts.length > 1 ? "s" : ""}` : "nenhum compromisso"} e {pending.length} tarefa{pending.length !== 1 ? "s" : ""} por fazer.
        </p>
      </div>

      {goals.map((g) => {
        const n = Math.round((new Date(g.deadline + "T00:00:00").getTime() - TODAY.getTime()) / 864e5);
        if (!(g.currentValue < (g.targetValue ?? Infinity) && n >= 0 && n <= 10)) return null;
        const falta = g.type === "money" ? `R$ ${(g.targetValue - g.currentValue).toLocaleString("pt-BR")}` : `${g.targetValue - g.currentValue} ${g.unit || ""}`;
        return (
          <div className="alert" key={g.id}>
            <span className="a-ic">◈</span>
            <div className="a-body">
              Faltam <b>{n === 0 ? "menos de 1 dia" : `${n} dias`}</b> para a meta <b>{g.name}</b>. Ainda faltam <b>{falta}</b>.
            </div>
          </div>
        );
      })}

      <section>
        <div className="sec-head"><h2>Hoje</h2><span className="count">{appts.length ? `${openAppts.length} aberto${openAppts.length !== 1 ? "s" : ""}` : ""}</span></div>
        <div className="card">
          {appts.length === 0 ? (
            <div className="empty">Nenhum compromisso hoje. Aproveite 🌿</div>
          ) : (
            appts.map((a) => (
              <div className={"row" + (a.status === "done" ? " done" : "")} key={a.id}>
                <span className="time">{a.time}</span>
                <div className="r-main">
                  <div className="r-title">{a.title}</div>
                  {a.place && <div className="r-sub">{a.place}</div>}
                </div>
                <button
                  className={"check" + (a.status === "done" ? " on" : "")}
                  aria-label="Concluir"
                  onClick={() => updateRecord("appointments", a.id, { status: a.status === "done" ? "scheduled" : "done" })}
                >
                  ✓
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      <section>
        <div className="sec-head"><h2>Tarefas</h2><span className="count">{pending.length} pendente{pending.length !== 1 ? "s" : ""}</span></div>
        <div className="card">
          {pending.length === 0 ? (
            <div className="empty">Tudo em dia ✨</div>
          ) : (
            pending.map((t) => (
              <div className="row" key={t.id}>
                <button className="check" aria-label="Concluir" onClick={() => updateRecord("tasks", t.id, { done: true, doneAt: isoToday() })}>✓</button>
                <div className="r-main"><div className="r-title">{t.text}</div></div>
                {t.priority ? <span className={"pri " + t.priority}>{t.priority === "alta" ? "Alta" : "Média"}</span> : null}
              </div>
            ))
          )}
          <form className="addrow" onSubmit={addTask}>
            <input placeholder="Nova tarefa…" value={taskText} onChange={(e) => setTaskText(e.target.value)} />
            <button type="submit" aria-label="Adicionar" disabled={busy}>+</button>
          </form>
        </div>
      </section>

      <section>
        <div className="sec-head"><h2>Resumo da semana</h2></div>
        <div className="tiles">
          <div className="tile"><div className="t-num">{doneWeek}</div><div className="t-lab">tarefas concluídas</div></div>
          <div className="tile"><div className="t-num">{apptsWeek}</div><div className="t-lab">compromissos na semana</div></div>
        </div>
      </section>
    </>
  );
}
