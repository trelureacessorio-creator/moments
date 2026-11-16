import { useState } from "react";
import { useStore, list, createRecord } from "../lib/store";
import { api } from "../lib/api";
import { useRecorder } from "../lib/useRecorder";
import { MicIcon, StopIcon } from "../lib/icons";
import { isoToday, nowTime, fmtRel, cap } from "../lib/dates";

const MOODS = ["Alegria", "Gratidão", "Tranquilidade", "Neutro", "Cansaço", "Ansiedade", "Tristeza"];

export function Diario() {
  const s = useStore();
  const [composing, setComposing] = useState(false);

  const entries = list(s.data, "diary")
    .filter((e) => !e.deletedAt)
    .sort((a, b) => String(b.date + (b.time || "")).localeCompare(String(a.date + (a.time || ""))));

  return (
    <>
      <div className="hero">
        <h1 className="scr-title">Meu Diário</h1>
        <p className="scr-sub">{entries.length} momento{entries.length !== 1 ? "s" : ""} guardado{entries.length !== 1 ? "s" : ""}.</p>
      </div>

      <button className="btn" style={{ marginTop: 14 }} onClick={() => setComposing(true)}>+ Novo relato</button>

      <section>
        <div className="card">
          {entries.length === 0 ? (
            <div className="empty">Nenhum relato ainda. Escreva como foi o seu dia e o Moments sugere título, resumo e sentimento.</div>
          ) : (
            entries.map((e) => (
              <div className="diary-item" key={e.id}>
                <div className="di-top"><span className="di-title">{e.title}</span><span className="di-date">{cap(fmtRel(e.date))} · {e.time}</span></div>
                {e.summary && <div className="di-sum">{e.summary}</div>}
                {e.mood && <div className="di-tags"><span className="tag mood">{e.mood}</span></div>}
              </div>
            ))
          )}
        </div>
      </section>

      {composing && <Compose onClose={() => setComposing(false)} />}
    </>
  );
}

function Compose({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState("");
  const [analysis, setAnalysis] = useState<any | null>(null);
  const [title, setTitle] = useState("");
  const [mood, setMood] = useState("");
  const [alsoCreate, setAlsoCreate] = useState(true);
  const [busy, setBusy] = useState(false);
  const rec = useRecorder((t) => setText((prev) => (prev ? prev.trim() + " " : "") + t));

  async function analyze() {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const r = await api.analyzeDiary(text.trim());
      setAnalysis(r);
      setTitle(r.title);
      setMood(r.mood);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    await createRecord("diary", {
      date: isoToday(), time: nowTime(),
      title: title || analysis?.title || "Meu relato",
      text: text.trim(), summary: analysis?.summary || "", mood,
    });
    if (analysis?.suggestion && alsoCreate) {
      await createRecord(analysis.suggestion.collection, analysis.suggestion.fields);
    }
    setBusy(false);
    onClose();
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head"><h3>Novo relato</h3><button className="chip-btn" onClick={onClose}>Fechar</button></div>
        <textarea className="note" placeholder="Como foi o seu dia? Escreva ou use o microfone." value={text} onChange={(e) => setText(e.target.value)} autoFocus />

        {rec.supported && (
          <div className="rec-row">
            <button
              type="button"
              className={"mic" + (rec.state === "recording" ? " on" : "")}
              onClick={() => (rec.state === "recording" ? rec.stop() : rec.start())}
              disabled={rec.state === "transcribing"}
              aria-label={rec.state === "recording" ? "Parar gravação" : "Gravar voz"}
            >
              {rec.state === "recording" ? <StopIcon /> : rec.state === "transcribing" ? <span className="mic-spin" /> : <MicIcon />}
            </button>
            <span className="rec-lbl">
              {rec.state === "recording" ? "Gravando… toque para parar." : rec.state === "transcribing" ? "Transcrevendo…" : "Falar o relato"}
            </span>
          </div>
        )}
        {rec.error && <div className="flash" style={{ marginTop: 8 }}>{rec.error}</div>}

        {!analysis ? (
          <div className="sheet-actions">
            <button className="btn" onClick={analyze} disabled={busy || !text.trim()}>{busy ? "Analisando…" : "Analisar com Moments"}</button>
          </div>
        ) : (
          <>
            <div className="sugg" style={{ marginTop: 12 }}>
              <div className="s-top">Sugestão do Moments</div>
              <div className="field" style={{ marginTop: 8 }}><label>Título</label><input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
              <div className="field"><label>Sentimento</label><select value={mood} onChange={(e) => setMood(e.target.value)}>{MOODS.map((m) => <option key={m} value={m}>{m}</option>)}</select></div>
              <div className="di-sum">{analysis.summary}</div>
              {analysis.suggestion && (
                <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, fontSize: 13 }}>
                  <input type="checkbox" checked={alsoCreate} onChange={(e) => setAlsoCreate(e.target.checked)} /> Também criar: {analysis.suggestion.label}
                </label>
              )}
            </div>
            <div className="sheet-actions">
              <button className="btn" onClick={save} disabled={busy}>Salvar relato</button>
              <button className="btn ghost" type="button" onClick={() => setAnalysis(null)}>Reescrever</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
