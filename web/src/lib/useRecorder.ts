import { useRef, useState, useCallback } from "react";
import { api } from "./api";

// Gravação de voz no navegador (grátis, via MediaRecorder) + transcrição no servidor.
// Estados expostos: "idle" | "recording" | "transcribing". Erros viram mensagem.
type RecState = "idle" | "recording" | "transcribing";

export function useRecorder(onText: (text: string) => void) {
  const [state, setState] = useState<RecState>("idle");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const supported = typeof navigator !== "undefined" && !!navigator.mediaDevices && typeof MediaRecorder !== "undefined";

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const start = useCallback(async () => {
    setError(null);
    if (!supported) { setError("Gravação não suportada neste navegador."); return; }
    try {
      // Constraints de áudio "tipo WhatsApp": mono, com redução de ruído, cancelamento
      // de eco e ganho automático — melhora muito a transcrição.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
      chunksRef.current = [];
      // Prefere Opus (melhor qualidade por bit); grava a ~128 kbps.
      const candidates = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/webm"];
      const mimeType = candidates.find((m) => (window as any).MediaRecorder?.isTypeSupported?.(m)) || "";
      const rec = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 128000 } : { audioBitsPerSecond: 128000 });
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        stopTracks();
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        if (!blob.size) { setState("idle"); return; }
        setState("transcribing");
        try {
          const ext = (rec.mimeType || "audio/webm").includes("ogg") ? "ogg" : "webm";
          const text = await api.transcribe(blob, `audio.${ext}`);
          if (text && text.trim()) onText(text.trim());
          else setError("Não consegui entender o áudio. Tente de novo.");
        } catch {
          setError("Falha ao transcrever o áudio.");
        } finally {
          setState("idle");
        }
      };
      rec.start();
      recRef.current = rec;
      setState("recording");
    } catch {
      stopTracks();
      setError("Não foi possível acessar o microfone. Verifique a permissão.");
      setState("idle");
    }
  }, [onText, supported]);

  const stop = useCallback(() => {
    const rec = recRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
  }, []);

  const cancel = useCallback(() => {
    const rec = recRef.current;
    if (rec && rec.state !== "inactive") { rec.onstop = null as any; rec.stop(); }
    stopTracks();
    chunksRef.current = [];
    setState("idle");
  }, []);

  return { state, error, supported, start, stop, cancel, setError };
}
