import { useState } from "react";
import { useStore, list, createRecord, updateRecord, deleteRecord } from "../lib/store";
import { isoToday, fmtRel, cap } from "../lib/dates";

export function Tarefas() {
  const s = useStore();
  const [text, setText] = useState("");
  const [priority, setPriority] = useState("");
  const [showDone, setShowDone] = useState(false);

  const tasks = list(s.data, "tasks");
  const pending = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done).sort((a, b) => String(b.doneAt).localeCompare(String(a.doneAt)));

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const v = text.trim();
    if (!v) return;
    setText("");
    await createRecord("tasks", { text: v, done: false, priority, date: isoToday() });
    setPriority("");
  }

  return (
    <>
      <div className="hero"><h1 className="scr-title">Tarefas</h1><p className="scr-sub">{pending.length} pendente{pending.length !== 1 ? "s" : ""} · {done.length} concluída{done.length !== 1 ? "s" : ""}</p></div>

      <section>
        <div className="card">
          {pending.length === 0 ? (
            <div className="empty">Nenhuma tarefa pendente ✨</div>
          ) : (
            pending.map((t) => (
              <div className="row" key={t.id}>
                <button className="check" aria-label="Concluir" onClick={() => updateRecord("tasks", t.id, { done: true, doneAt: isoToday() })}>✓</button>
                <div className="r-main"><div className="r-title">{t.text}</div></div>
                {t.priority ? <span className={"pri " + t.priority}>{t.priority === "alta" ? "Alta" : "Média"}</span> : null}
              </div>
            ))
          )}
          <form className="addrow" onSubmit={add}>
            <input placeholder="Nova tarefa…" value={text} onChange={(e) => setText(e.target.value)} />
            <select value={priority} onChange={(e) => setPriority(e.target.value)} style={{ flex: "none", width: "92px" }}>
              <option value="">normal</option>
              <option value="media">média</option>
              <option value="alta">alta</option>
            </select>
            <button type="submit" aria-label="Adicionar">+</button>
          </form>
        </div>
      </section>

      {done.length > 0 && (
        <section>
          <div className="sec-head">
            <h2>Concluídas ({done.length})</h2>
            <button className="chip-btn" onClick={() => setShowDone((v) => !v)}>{showDone ? "ocultar" : "mostrar"}</button>
          </div>
          {showDone && (
            <div className="card">
              {done.map((t) => (
                <div className="row done" key={t.id}>
                  <button className="check on" aria-label="Reabrir" onClick={() => updateRecord("tasks", t.id, { done: false, doneAt: null })}>✓</button>
                  <div className="r-main"><div className="r-title">{t.text}</div>{t.doneAt && <div className="r-sub">{cap(fmtRel(t.doneAt))}</div>}</div>
                  <button className="chip-btn" onClick={() => deleteRecord("tasks", t.id)}>excluir</button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </>
  );
}
