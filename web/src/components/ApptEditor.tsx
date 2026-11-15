import { useState } from "react";
import { updateRecord, deleteRecord } from "../lib/store";

export function ApptEditor({ appt, onClose }: { appt: any; onClose: () => void }) {
  const [title, setTitle] = useState(appt.title || "");
  const [date, setDate] = useState(appt.date || "");
  const [time, setTime] = useState(appt.time || "09:00");
  const [endTime, setEndTime] = useState(appt.endTime || "");
  const [place, setPlace] = useState(appt.place || "");
  const [notes, setNotes] = useState(appt.notes || "");
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    await updateRecord("appointments", appt.id, {
      title: title.trim(),
      date,
      time,
      endTime: endTime || null,
      place: place || null,
      notes: notes || null,
    });
    setBusy(false);
    onClose();
  }

  async function del() {
    setBusy(true);
    await deleteRecord("appointments", appt.id);
    setBusy(false);
    onClose();
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h3>Compromisso</h3>
          <button className="chip-btn" onClick={onClose}>Fechar</button>
        </div>
        <form onSubmit={save}>
          <div className="field"><label>Título</label><input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus /></div>
          <div className="row2">
            <div className="field"><label>Data</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div className="field"><label>Hora</label><input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
          </div>
          <div className="row2">
            <div className="field"><label>Fim (opcional)</label><input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></div>
            <div className="field"><label>Local</label><input value={place} onChange={(e) => setPlace(e.target.value)} /></div>
          </div>
          <div className="field"><label>Observações</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          <div className="sheet-actions">
            <button className="btn" type="submit" disabled={busy}>Salvar</button>
            <button className="btn ghost" type="button" onClick={del} disabled={busy}>Excluir</button>
          </div>
        </form>
      </div>
    </div>
  );
}
