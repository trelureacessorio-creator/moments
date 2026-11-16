import { useEffect, useState } from "react";
import { useStore, list, pull } from "../lib/store";
import { api } from "../lib/api";

export function Familia({ onBack }: { onBack: () => void }) {
  const s = useStore();
  const [created, setCreated] = useState<any[]>([]);
  const [received, setReceived] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [apptId, setApptId] = useState("");
  const [email, setEmail] = useState("");
  const [perm, setPerm] = useState("ver");
  const [msg, setMsg] = useState<string | null>(null);

  const myAppts = list(s.data, "appointments").filter((a) => !a.deletedAt && a.ownerId === s.user?.id);

  async function load() {
    try {
      const [sh, ac] = await Promise.all([api.shares(), api.activity()]);
      setCreated(sh.created || []);
      setReceived(sh.received || []);
      setActivity(ac.activity || []);
    } catch { /* ignore */ }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  function titleOf(entityType: string, entityId: string) {
    const r = s.data[entityType]?.[entityId];
    return r ? (r.title || r.text || r.name || "item") : "item";
  }

  async function share(e: React.FormEvent) {
    e.preventDefault();
    const id = apptId || myAppts[0]?.id;
    if (!id || !email.trim()) { setMsg("Escolha um compromisso e informe o e-mail."); return; }
    try {
      await api.createShare({ recipientEmail: email.trim().toLowerCase(), entityType: "appointments", entityId: id, permission: perm });
      setEmail(""); setMsg("Compartilhado ✓");
      await load(); await pull();
    } catch (err: any) {
      const code = err?.body?.error;
      setMsg(code === "recipient_not_found" ? "Essa pessoa ainda não tem conta no Moments." : code === "cannot_share_with_self" ? "Você não pode compartilhar consigo." : "Não foi possível compartilhar.");
    }
    setTimeout(() => setMsg(null), 3000);
  }

  async function togglePerm(sh: any) {
    await api.createShare({ recipientEmail: sh.recipient?.email, entityType: sh.entityType, entityId: sh.entityId, permission: sh.permission === "editar" ? "ver" : "editar" });
    await load();
  }
  async function revoke(id: string) {
    await api.deleteShare(id);
    await load();
  }

  const FIELD: Record<string, string> = { time: "o horário", endTime: "o horário final", title: "o título", date: "a data", place: "o local", notes: "as observações", text: "o texto", status: "a situação", done: "a conclusão", deleted: "o item (excluiu)" };

  const people = new Map<string, any>();
  created.forEach((c) => c.recipient && people.set(c.recipient.id, { ...c.recipient, rel: "compartilho" }));
  received.forEach((r) => r.owner && people.set(r.owner.id, { ...r.owner, rel: "compartilha comigo" }));

  return (
    <>
      <button className="back" onClick={onBack}>‹ Mais</button>
      <div className="hero"><h1 className="scr-title">Planejamento Familiar</h1><p className="scr-sub">Tudo começa privado. Você escolhe o que e com quem compartilhar.</p></div>

      <section>
        <div className="sec-head"><h2>Pessoas conectadas</h2></div>
        <div className="card">
          {people.size === 0 ? <div className="empty">Ninguém conectado ainda.</div> : [...people.values()].map((p) => (
            <div className="row" key={p.id}><span className="avatar">{(p.name || "?").charAt(0).toUpperCase()}</span><div className="r-main"><div className="r-title">{p.name}</div><div className="r-sub">{p.rel} · {p.email}</div></div></div>
          ))}
        </div>
      </section>

      <section>
        <div className="sec-head"><h2>O que você compartilhou</h2></div>
        <div className="card">
          {created.length === 0 ? <div className="empty">Você ainda não compartilhou nada.</div> : created.map((sh) => (
            <div className="row" key={sh.id}>
              <div className="r-main"><div className="r-title">{titleOf(sh.entityType, sh.entityId)}</div><div className="r-sub">com {sh.recipient?.name || sh.recipient?.email}</div></div>
              <button className={"permchip" + (sh.permission === "editar" ? " edit" : "")} onClick={() => togglePerm(sh)}>{sh.permission === "editar" ? "pode editar" : "só vê"}</button>
              <button className="revoke" aria-label="Encerrar" onClick={() => revoke(sh.id)}>×</button>
            </div>
          ))}
          <form className="addrow" style={{ flexWrap: "wrap" }} onSubmit={share}>
            <select value={apptId} onChange={(e) => setApptId(e.target.value)} style={{ flex: "1 1 100%" }}>
              {myAppts.length === 0 && <option value="">(sem compromissos para compartilhar)</option>}
              {myAppts.map((a) => <option key={a.id} value={a.id}>{a.title} · {a.date}</option>)}
            </select>
            <input type="email" placeholder="e-mail do Moments…" value={email} onChange={(e) => setEmail(e.target.value)} style={{ flex: 1 }} />
            <select value={perm} onChange={(e) => setPerm(e.target.value)} style={{ flex: "none", width: 100 }}><option value="ver">só vê</option><option value="editar">pode editar</option></select>
            <button type="submit" aria-label="Compartilhar">+</button>
          </form>
        </div>
        {msg && <div className="flash" style={{ marginTop: 8 }}>{msg}</div>}
        <p className="scr-sub" style={{ fontSize: 11.5, marginTop: 8 }}>Só é possível conectar com quem já tem conta no Moments. Toque na etiqueta para alternar entre só ver e poder editar; o × encerra.</p>
      </section>

      {received.length > 0 && (
        <section>
          <div className="sec-head"><h2>Compartilhado comigo</h2></div>
          <div className="card">
            {received.map((sh) => (
              <div className="row" key={sh.id}><div className="r-main"><div className="r-title">{titleOf(sh.entityType, sh.entityId)}</div><div className="r-sub">de {sh.owner?.name || sh.owner?.email} · {sh.permission === "editar" ? "pode editar" : "só vê"}</div></div></div>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="sec-head"><h2>Histórico de alterações</h2></div>
        <div className="card">
          {activity.length === 0 ? <div className="empty">Nenhuma alteração registrada.</div> : activity.map((c) => (
            <div className="row" key={c.id}><span className="avatar" style={{ background: "var(--warm-soft)", color: "var(--warn)" }}>{(c.actor?.name || "?").charAt(0)}</span><div className="r-main"><div className="r-title">{c.actor?.name || "Alguém"} alterou {FIELD[c.field] || c.field}</div><div className="r-sub">{c.before ? `${c.before} → ${c.after}` : ""}{c.before ? " · " : ""}{new Date(c.createdAt).toLocaleString("pt-BR")}</div></div></div>
          ))}
        </div>
      </section>
    </>
  );
}
