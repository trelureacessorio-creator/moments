import { useState } from "react";
import { useStore, list, createRecord } from "../lib/store";
import { isoToday, fmtRel, cap, TODAY, iso, addDays } from "../lib/dates";

export function SonhosIdeias({ onBack }: { onBack: () => void }) {
  const s = useStore();
  const [kind, setKind] = useState("ideia"); // ideia | vida | sono
  const [title, setTitle] = useState("");
  const [flash, setFlash] = useState<string | null>(null);

  // Ideias e sonhos vêm de coleções diferentes; juntamos para exibir.
  const dreams = list(s.data, "dreams").filter((d) => !d.deletedAt).map((d: any) => ({ ...d, _c: "dreams" }));
  const ideas = list(s.data, "ideas").filter((d) => !d.deletedAt).map((d: any) => ({ ...d, _c: "ideas", type: "ideia" }));
  const items: any[] = [...dreams, ...ideas].sort((a, b) => String(b.date).localeCompare(String(a.date)));

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    if (kind === "ideia") await createRecord("ideas", { title: title.trim(), date: isoToday() });
    else await createRecord("dreams", { type: kind, title: title.trim(), date: isoToday() });
    setTitle("");
  }

  async function toGoal(it: any) {
    await createRecord("goals", { name: it.title, type: "count", targetValue: 1, currentValue: 0, startDate: isoToday(), deadline: iso(addDays(TODAY, 30)), status: "active" });
    setFlash("Transformado em meta ✓ (veja em Mais › Metas)");
    setTimeout(() => setFlash(null), 2800);
  }

  function meta(t: string) {
    return t === "sono" ? { ic: "🌙", lab: "Sonho" } : t === "vida" ? { ic: "⭐", lab: "Sonho de vida" } : { ic: "💡", lab: "Ideia" };
  }

  return (
    <>
      <button className="back" onClick={onBack}>‹ Mais</button>
      <div className="hero"><h1 className="scr-title">Sonhos e Ideias</h1><p className="scr-sub">Guarde o que você sonha e imagina — e vire meta quando quiser.</p></div>
      {flash && <div className="flash">{flash}</div>}
      <section>
        <div className="card">
          {items.length === 0 ? <div className="empty">Nada guardado ainda.</div> : items.map((d) => {
            const m = meta(d.type);
            return (
              <div className="habit" key={d._c + d.id}>
                <div className="habit-top">
                  <div><div className="habit-name">{d.title}</div><div className="habit-freq">{m.lab} · {cap(fmtRel(d.date))}</div></div>
                  <span className="tag">{m.ic}</span>
                </div>
                {d.description && <div className="di-sum">{d.description}</div>}
                {d.type !== "sono" && <button className="hmark" style={{ marginTop: 10 }} onClick={() => toGoal(d)}>Transformar em meta</button>}
              </div>
            );
          })}
          <form className="addrow" style={{ flexWrap: "wrap" }} onSubmit={add}>
            <select value={kind} onChange={(e) => setKind(e.target.value)} style={{ flex: "none", width: 140 }}>
              <option value="ideia">💡 Ideia</option>
              <option value="vida">⭐ Sonho de vida</option>
              <option value="sono">🌙 Sonho</option>
            </select>
            <input placeholder="Título…" value={title} onChange={(e) => setTitle(e.target.value)} style={{ flex: 1 }} />
            <button type="submit" aria-label="Adicionar">+</button>
          </form>
        </div>
      </section>
    </>
  );
}
