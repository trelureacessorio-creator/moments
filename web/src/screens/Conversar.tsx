import { useState, useRef, useEffect } from "react";
import { useStore, list, createRecord, pull } from "../lib/store";
import { api } from "../lib/api";
import { useRecorder } from "../lib/useRecorder";
import { MicIcon, StopIcon } from "../lib/icons";

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
  const [pendingUser, setPendingUser] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<any | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const rec = useRecorder((t) => setInput((prev) => (prev ? prev + " " : "") + t));

  const messages = list(s.data, "aiMessages")
    .filter((m) => !m.deletedAt)
    .sort((a, b) => (a.rev || 0) - (b.rev || 0));

  // Layout "modo chat" (cabeçalho e caixa fixos, só as mensagens rolam) — como no WhatsApp.
  useEffect(() => {
    document.body.classList.add("chat-mode");
    return () => document.body.classList.remove("chat-mode");
  }, []);

  // Rola a ÁREA DE MENSAGENS até o fim (instantâneo e confiável, inclusive no celular).
  const scrollRef = useRef<HTMLDivElement>(null);
  const toBottom = () => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };
  useEffect(() => {
    const r = requestAnimationFrame(toBottom);
    const ids = [0, 60, 160, 320].map((ms) => window.setTimeout(toBottom, ms));
    return () => { cancelAnimationFrame(r); ids.forEach((i) => window.clearTimeout(i)); };
  }, [messages.length, busy, suggestion]);

  async function send(text?: string) {
    const t = (text ?? input).trim();
    if (!t || busy) return;
    setBusy(true);
    setInput("");
    setFlash(null);
    setPendingUser(t);
    try {
      const r = await api.aiMessage(t);
      await pull();
      setSuggestion(r.suggestion || null);
    } catch {
      setFlash("Não foi possível falar com o assistente agora.");
    } finally {
      setBusy(false);
      setPendingUser(null);
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
      <div className="chat-scroll" ref={scrollRef}>
        <div className="chat">
          {messages.length === 0 && (
            <div className="msg bot">Oi, {s.user?.name?.split(" ")[0]}! Pergunte sobre seus compromissos, tarefas, metas ou economias — ou peça para eu anotar algo. Nada é alterado sem você confirmar.</div>
          )}
          {messages.map((m) => (
            <div className={"msg " + (m.role === "user" ? "me" : "bot")} key={m.id}>{m.text}</div>
          ))}
          {busy && pendingUser && <div className="msg me">{pendingUser}</div>}
          {busy && (
            <div className="msg bot typing" aria-label="digitando">
              <span /><span /><span />
            </div>
          )}
        </div>
      </div>

      <div className="chat-bottom">
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

        {(flash || rec.error) && <div className="flash">{flash || rec.error}</div>}
        {rec.state === "recording" && <div className="rec-hint">● Gravando… toque no microfone para parar.</div>}
        {rec.state === "transcribing" && <div className="rec-hint">Transcrevendo seu áudio…</div>}

        {!suggestion && rec.state === "idle" && (
          <div className="chips">
            {SUGESTOES.map((q) => (
              <button className="chip" key={q} onClick={() => send(q)} disabled={busy}>{q}</button>
            ))}
          </div>
        )}

        <form className="composer" onSubmit={(e) => { e.preventDefault(); send(); }}>
          {rec.supported && (
            <button
              type="button"
              className={"mic" + (rec.state === "recording" ? " on" : "")}
              onClick={() => (rec.state === "recording" ? rec.stop() : rec.start())}
              disabled={busy || rec.state === "transcribing"}
              title="Falar"
              aria-label={rec.state === "recording" ? "Parar gravação" : "Gravar voz"}
            >
              {rec.state === "recording" ? <StopIcon /> : rec.state === "transcribing" ? <span className="mic-spin" /> : <MicIcon />}
            </button>
          )}
          <input placeholder="Pergunte ou peça algo…" value={input} onChange={(e) => setInput(e.target.value)} />
          <button type="submit" disabled={busy}>{busy ? "…" : "Enviar"}</button>
        </form>
      </div>
    </>
  );
}
