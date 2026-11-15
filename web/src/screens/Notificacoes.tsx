import { useStore, list, updateRecord } from "../lib/store";

const META: Record<string, { ic: string; soft: string }> = {
  morning: { ic: "☀️", soft: "var(--warm-soft)" },
  night: { ic: "🌙", soft: "var(--surface-2)" },
  sunday: { ic: "📅", soft: "var(--surface-2)" },
  goal_alert: { ic: "◈", soft: "var(--accent-soft)" },
  shared_change: { ic: "⇄", soft: "var(--surface-2)" },
};

function whenLabel(n: any) {
  const d = n.scheduledAt ? new Date(n.scheduledAt) : null;
  if (!d || isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function Notificacoes({ onBack }: { onBack?: () => void }) {
  const s = useStore();
  const notes = list(s.data, "notifications")
    .filter((n) => !n.deletedAt)
    .sort((a, b) => String(b.scheduledAt).localeCompare(String(a.scheduledAt)));
  const unread = notes.filter((n) => n.status !== "read" && !n.readAt);

  function markRead(id: string) {
    updateRecord("notifications", id, { status: "read", readAt: new Date().toISOString() });
  }
  function markAll() {
    for (const n of unread) markRead(n.id);
  }

  return (
    <>
      {onBack && <button className="back" onClick={onBack}>‹ Mais</button>}
      <div className="hero">
        <h1 className="scr-title">Notificações</h1>
        <p className="scr-sub">{unread.length ? `${unread.length} não lida${unread.length !== 1 ? "s" : ""}` : "Tudo em dia."}</p>
      </div>

      {unread.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <button className="chip-btn" onClick={markAll}>Marcar todas como lidas</button>
        </div>
      )}

      <section>
        <div className="card">
          {notes.length === 0 ? (
            <div className="empty">Nenhum aviso ainda. Os lembretes chegam nos horários que você configurar (manhã, noite e domingo) e quando uma meta estiver perto do prazo.</div>
          ) : (
            notes.map((n) => {
              const m = META[n.type] || { ic: "🔔", soft: "var(--surface-2)" };
              const isUnread = n.status !== "read" && !n.readAt;
              return (
                <div className="row" key={n.id}>
                  <span className="favatar" style={{ background: m.soft }}>{m.ic}</span>
                  <div className="r-main">
                    <div className="r-title" style={{ fontWeight: isUnread ? 600 : 500 }}>{n.message}</div>
                    <div className="r-sub">{whenLabel(n)}</div>
                  </div>
                  {isUnread ? (
                    <button className="chip-btn" onClick={() => markRead(n.id)}>lida</button>
                  ) : (
                    <span className="r-sub" style={{ flex: "none" }}>✓</span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>
    </>
  );
}
