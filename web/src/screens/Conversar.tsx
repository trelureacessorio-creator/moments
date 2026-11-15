import { useState } from "react";
import { useStore, list, createRecord, pull } from "../lib/store";
import { api } from "../lib/api";

const SUGESTOES = [
  "Qual meu próximo compromisso?",
  "Quanto economizei este mês?",
  "Quanto falta para minha meta?",
  "Quais tarefas tenho hoje?",
];

export function Conversar() {
  const s = useStore();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [suggestion, setSuggestion] = useState<any | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const messages = list(s.data, "aiMessages")
    .filter((m) => !m.deletedAt)
    .sort((a, b) => (a.rev || 0) - (b.rev || 0));

  async function send(text?: string) {
    const t = (text ?? input).trim();
    if (!t || busy) return;
    setBusy(true);
    setInput("");
    setFlash(null);
    try {
      const r = await api.aiMessage(t);
      await pull(); // traz as mensagens persistidas
      setSuggestion(r.suggestion || null);
    } catch {
      setFlash("Não foi possível falar com o assistente agora.");
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!suggestion) return;
    await createRecord(suggestion.collection, suggestion.fields);
    setSuggestion(null);
    setFlash("Registrado ✓");
    setTimeout(() => setFlash(null), 2500);
  }

  return (
    <>
      <div className="hero">
        <h1 className="scr-title">Conversar com Moments</h1>
        <p className="scr-sub">Respostas vêm só das suas informações. Nada é alterado sem você confirmar.</p>
      </div>

      <div className="chat">
        {messages.length === 0 && (
          <div className="msg bot">Oi, {s.user?.name?.split(" ")[0]}! Pergunte sobre seus compromissos, tarefas, metas ou economias — ou peça para eu anotar algo.</div>
        )}
        {messages.map((m) => (
          <div className={"msg " + (m.role === "user" ? "me" : "bot")} key={m.id}>{m.text}</div>
        ))}
      </div>

      {suggestion && (
        <div className="sugg">
          <div className="s-top">Sugestão — confirme para registrar</div>
          <div className="s-title">{suggestion.label}</div>
          <div className="sugg-actions">
            <button className="ok" onClick={confirm}>Confirmar</button>
            <button className="no" onClick={() => setSuggestion(null)}>Descartar</button>
          </div>
        </div>
      )}

      {flash && <div className="flash">{flash}</div>}

      <div className="chips">
        {SUGESTOES.map((q) => (
          <button className="chip" key={q} onClick={() => send(q)}>{q}</button>
        ))}
      </div>

      <form className="composer" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <input placeholder="Pergunte ou peça algo…" value={input} onChange={(e) => setInput(e.target.value)} />
        <button type="submit" disabled={busy}>{busy ? "…" : "Enviar"}</button>
      </form>
    </>
  );
}
