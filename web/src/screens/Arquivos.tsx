import { useState, useRef } from "react";
import { useStore, list, createRecord, deleteRecord, pull } from "../lib/store";
import { api } from "../lib/api";
import { isoToday, fmtRel, cap } from "../lib/dates";

const ICON: Record<string, string> = { documento: "📄", foto: "🖼️", comprovante: "🧾", audio: "🎙️" };
const CATLABEL: Record<string, string> = { documento: "Documento", foto: "Foto", comprovante: "Comprovante", audio: "Áudio" };

// Infere o tipo a partir do MIME do arquivo escolhido.
function inferType(mime: string): string {
  if (mime.startsWith("image/")) return "foto";
  if (mime.startsWith("audio/")) return "audio";
  return "documento";
}

function human(bytes?: number) {
  if (!bytes) return "";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
  return (bytes / 1024 / 1024).toFixed(1) + " MB";
}

export function Arquivos({ onBack }: { onBack: () => void }) {
  const s = useStore();
  const [q, setQ] = useState("");
  const [name, setName] = useState("");
  const [ftype, setFtype] = useState("documento");
  const [picked, setPicked] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const files = list(s.data, "files").filter((f) => !f.deletedAt).sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  const query = q.trim().toLowerCase();
  const shown = files.filter((f) => !query || (f.name || "").toLowerCase().includes(query) || (f.category || "").toLowerCase().includes(query));

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] || null;
    setPicked(f);
    setErr(null);
    if (f) {
      if (!name.trim()) setName(f.name.replace(/\.[^.]+$/, ""));
      setFtype(inferType(f.type));
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const finalName = name.trim() || picked?.name || "";
    if (!finalName) { setErr("Dê um nome ou escolha um arquivo."); return; }
    if (picked && picked.size > 15 * 1024 * 1024) { setErr("Arquivo muito grande (máximo 15 MB)."); return; }
    setBusy(true);
    setErr(null);
    try {
      const id = await createRecord("files", { name: finalName, fileType: ftype, category: CATLABEL[ftype], date: isoToday(), privacy: "private" });
      if (picked) {
        await api.uploadFile(id, picked, picked.name);
        await pull(); // atualiza o storageKey (marca que tem conteúdo)
      }
      setName(""); setPicked(null); setFtype("documento");
      if (fileInput.current) fileInput.current.value = "";
    } catch {
      setErr("Não foi possível enviar o arquivo. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  async function open(id: string) {
    setOpening(id);
    setErr(null);
    try {
      const url = await api.fileBlobUrl(id);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      setErr("Não foi possível abrir o arquivo.");
    } finally {
      setOpening(null);
    }
  }

  return (
    <>
      <button className="back" onClick={onBack}>‹ Mais</button>
      <div className="hero"><h1 className="scr-title">Meus Arquivos</h1><p className="scr-sub">Documentos, fotos e comprovantes guardados com segurança.</p></div>

      <input className="srch" placeholder="Buscar por nome ou categoria…" value={q} onChange={(e) => setQ(e.target.value)} />

      <section>
        <div className="card">
          {shown.length === 0 ? <div className="empty">{files.length ? "Nada encontrado." : "Nenhum arquivo ainda."}</div> : shown.map((f) => (
            <div className="row" key={f.id}>
              <span className="favatar">{ICON[f.fileType] || "📄"}</span>
              <div className="r-main">
                <div className="r-title">{f.name}</div>
                <div className="r-sub">{f.category || CATLABEL[f.fileType] || ""} · {cap(fmtRel(f.date || isoToday()))}{f.storageKey ? " · 📎 anexado" : ""}</div>
              </div>
              {f.storageKey ? (
                <button className="chip-btn" onClick={() => open(f.id)} disabled={opening === f.id}>{opening === f.id ? "…" : "abrir"}</button>
              ) : null}
              <button className="chip-btn" onClick={() => deleteRecord("files", f.id)}>excluir</button>
            </div>
          ))}

          <form className="addrow" onSubmit={add} style={{ flexWrap: "wrap" }}>
            <input placeholder="Nome do arquivo…" value={name} onChange={(e) => setName(e.target.value)} />
            <select value={ftype} onChange={(e) => setFtype(e.target.value)} style={{ flex: "none", width: 128 }}>
              <option value="documento">📄 Documento</option>
              <option value="foto">🖼️ Foto</option>
              <option value="comprovante">🧾 Comprovante</option>
              <option value="audio">🎙️ Áudio</option>
            </select>
            <button type="submit" aria-label="Adicionar" disabled={busy}>{busy ? "…" : "+"}</button>
            <div className="file-pick">
              <input ref={fileInput} id="file-input" type="file" onChange={onPick} hidden />
              <label htmlFor="file-input" className="chip-btn">{picked ? `📎 ${picked.name} (${human(picked.size)})` : "📎 Escolher arquivo"}</label>
              {picked && <button type="button" className="chip-btn" onClick={() => { setPicked(null); if (fileInput.current) fileInput.current.value = ""; }}>remover</button>}
            </div>
          </form>
          {err && <div className="flash" style={{ margin: "4px 12px 12px" }}>{err}</div>}
        </div>
        <p className="scr-sub" style={{ fontSize: 11.5, marginTop: 8 }}>Os arquivos são enviados e guardados com segurança (até 15 MB cada). Toque em “abrir” para visualizar ou baixar. Você também pode só registrar os dados, sem anexar um arquivo.</p>
      </section>
    </>
  );
}
