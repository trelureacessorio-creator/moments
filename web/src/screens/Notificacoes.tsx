import { useEffect, useState } from "react";
import { useStore, list } from "../lib/store";
import { api } from "../lib/api";
import { isoToday, TODAY } from "../lib/dates";

export function Notificacoes() {
  const s = useStore();
  const [activity, setActivity] = useState<any[]>([]);

  useEffect(() => {
    api.activity().then((r) => setActivity(r.activity || [])).catch(() => setActivity([]));
  }, []);

  const today = isoToday();
  const apptsToday = list(s.data, "appointments").filter((a) => a.date === today);
  const pending = list(s.data, "tasks").filter((t) => !t.done);
  const goals = list(s.data, "goals");

  const items: { ic: string; title: string; body: string; when: string; soft: string }[] = [];
  items.push({ ic: "☀️", title: "Resumo da manhã", body: `${apptsToday.length} compromisso${apptsToday.length !== 1 ? "s" : ""} e ${pending.length} tarefa${pending.length !== 1 ? "s" : ""} para hoje.`, when: "07:00", soft: "var(--warm-soft)" });
  for (const g of goals) {
    const n = Math.round((new Date(g.deadline + "T00:00:00").getTime() - TODAY.getTime()) / 864e5);
    if (g.currentValue < (g.targetValue ?? Infinity) && n >= 0 && n <= 10) {
      items.push({ ic: "◈", title: "Meta perto do prazo", body: `Faltam ${n === 0 ? "menos de 1 dia" : `${n} dias`} para "${g.name}".`, when: "hoje", soft: "var(--accent-soft)" });
    }
  }
  for (const c of activity) {
    items.push({ ic: "⇄", title: `${c.actor?.name || "Alguém"} alterou`, body: `${c.field}: ${c.before} → ${c.after}`, when: new Date(c.createdAt).toLocaleDateString("pt-BR"), soft: "var(--surface-2)" });
  }
  items.push({ ic: "🌙", title: "Conferência noturna", body: pending.length ? `Você ainda tem ${pending.length} tarefa${pending.length !== 1 ? "s" : ""} pendente${pending.length !== 1 ? "s" : ""}.` : "Tudo concluído por hoje ✨", when: "20:00", soft: "var(--surface-2)" });
  items.push({ ic: "📅", title: "Planejamento de domingo", body: "Resumo da próxima semana, todo domingo.", when: "Dom · 18:00", soft: "var(--surface-2)" });

  return (
    <>
      <div className="hero"><h1 className="scr-title">Notificações</h1><p className="scr-sub">Avisos gerados a partir das suas informações.</p></div>
      <section>
        <div className="card">
          {items.map((n, i) => (
            <div className="row" key={i}>
              <span className="favatar" style={{ background: n.soft }}>{n.ic}</span>
              <div className="r-main"><div className="r-title">{n.title}</div><div className="r-sub">{n.body}</div></div>
              <span style={{ fontSize: "11.5px", color: "var(--faint)", flex: "none" }}>{n.when}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
