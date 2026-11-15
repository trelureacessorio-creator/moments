import { useState } from "react";
import { useStore, list, createRecord, deleteRecord } from "../lib/store";
import { TODAY, addDays, iso, isoToday, WD_S } from "../lib/dates";

export function Habitos({ onBack }: { onBack: () => void }) {
  const s = useStore();
  const [name, setName] = useState("");

  const habits = list(s.data, "habits").filter((h) => !h.deletedAt);
  const logs = list(s.data, "habitLogs").filter((l) => !l.deletedAt && l.done);
  const logFor = (habitId: string, date: string) => logs.find((l) => l.habitId === habitId && l.date === date);

  function streak(habitId: string) {
    let c = 0;
    for (let i = 0; ; i++) {
      if (logFor(habitId, iso(addDays(TODAY, -i)))) c++;
      else break;
    }
    return c;
  }
  function weekCount(habitId: string) {
    let c = 0;
    for (let j = 0; j < 7; j++) if (logFor(habitId, iso(addDays(TODAY, -j)))) c++;
    return c;
  }
  async function toggle(habitId: string, date: string) {
    const existing = logFor(habitId, date);
    if (existing) await deleteRecord("habitLogs", existing.id);
    else await createRecord("habitLogs", { habitId, date, done: true });
  }
  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await createRecord("habits", { name: name.trim(), frequency: "Diário", startDate: isoToday(), status: "active" });
    setName("");
  }

  return (
    <>
      <button className="back" onClick={onBack}>‹ Mais</button>
      <div className="hero"><h1 className="scr-title">Meus Hábitos</h1><p className="scr-sub">Marque o que fez e acompanhe suas sequências.</p></div>
      <section>
        <div className="card">
          {habits.length === 0 ? <div className="empty">Nenhum hábito ainda.</div> : habits.map((h) => {
            const today = isoToday();
            const todayOn = !!logFor(h.id, today);
            return (
              <div className="habit" key={h.id}>
                <div className="habit-top">
                  <div><div className="habit-name">{h.name}</div><div className="habit-freq">{h.frequency || "Diário"} · {weekCount(h.id)}/7 nesta semana</div></div>
                  <span className="streak">{streak(h.id)} 🔥</span>
                </div>
                <div className="strip">
                  {Array.from({ length: 14 }, (_, k) => 13 - k).map((back) => {
                    const d = iso(addDays(TODAY, -back));
                    return <button key={d} className={"hday" + (logFor(h.id, d) ? " on" : "") + (back === 0 ? " today" : "")} aria-label={d} onClick={() => toggle(h.id, d)} />;
                  })}
                </div>
                <button className={"hmark" + (todayOn ? " on" : "")} onClick={() => toggle(h.id, today)}>{todayOn ? "✓ Feito hoje" : "Marcar hoje"}</button>
              </div>
            );
          })}
          <form className="addrow" onSubmit={add}><input placeholder="Novo hábito…" value={name} onChange={(e) => setName(e.target.value)} /><button type="submit" aria-label="Adicionar">+</button></form>
        </div>
      </section>
    </>
  );
}
