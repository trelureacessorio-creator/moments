import { useState } from "react";
import { useStore, list, createRecord, deleteRecord } from "../lib/store";
import { isoToday, fmtRel, cap } from "../lib/dates";

const ICON: Record<string, string> = { documento: "📄", foto: "🖼️", comprovante: "🧾", audio: "🎙️" };
const CATLABEL: Record<string, string> = { documento: "Documento", foto: "Foto", comprovante: "Comprovante", audio: "Áudio" };

export function Arquivos({ onBack }: { onBack: () => void }) {
  const s = useStore();
  const [q, setQ] = useState("");
  const [name, setName] = useState("");
  const [ftype, setFtype] = useState("documento");

  const files = list(s.data, "files").filter((f) => !f.deletedAt).sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  const query = q.trim().toLowerCase();
  const shown = files.filter((f) => !query || (f.name || "").toLowerCase().includes(query) || (f.category || "").toLowerCase().includes(query));

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await createRecord("files", { name: name.trim(), fileType: ftype, category: CATLABEL[ftype], date: isoToday(), privacy: "private" });
    setName("");
  }

  return (
    <>
      <button className="back" onClick={onBack}>‹ Mais</button>
      <div className="hero"><h1 className="scr-title">Meus Arquivos</h1><p className="scr-sub">Documentos, fotos e áudios organizados.</p></div>

      <input className="srch" placeholder="Buscar por nome ou categoria…" value={q} onChange={(e) => setQ(e.target.value)} />

      <section>
        <div className="card">
          {shown.length === 0 ? <div className="empty">{files.length ? "Nada encontrado." : "Nenhum arquivo ainda."}</div> : shown.map((f) => (
            <div className="row" key={f.id}>
              <span className="favatar">{ICON[f.fileType] || "📄"}</span>
              <div className="r-main"><div className="r-title">{f.name}</div><div className="r-sub">{f.category || CATLABEL[f.fileType] || ""} · {cap(fmtRel(f.date || isoToday()))}</div></div>
              <button className="chip-btn" onClick={() => deleteRecord("files", f.id)}>excluir</button>
            </div>
          ))}
          <form className="addrow" onSubmit={add}>
            <input placeholder="Nome do arquivo…" value={name} onChange={(e) => setName(e.target.value)} />
            <select value={ftype} onChange={(e) => setFtype(e.target.value)} style={{ flex: "none", width: 128 }}>
              <option value="documento">📄 Documento</option>
              <option value="foto">🖼️ Foto</option>
              <option value="comprovante">🧾 Comprovante</option>
              <option value="audio">🎙️ Áudio</option>
            </select>
            <button type="submit" aria-label="Adicionar">+</button>
          </form>
        </div>
        <p className="scr-sub" style={{ fontSize: 11.5, marginTop: 8 }}>Nesta versão, os arquivos guardam apenas os dados (nome, tipo, categoria). O envio do arquivo em si entra quando o armazenamento de arquivos for ativado.</p>
      </section>
    </>
  );
}
