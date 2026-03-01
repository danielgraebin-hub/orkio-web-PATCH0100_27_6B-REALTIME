import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch, uploadFile, chat, chatStream, transcribeAudio, getRealtimeClientSecret, startRealtimeSession, postRealtimeEventsBatch, endRealtimeSession, getRealtimeSession } from "../ui/api.js";
import { clearSession, getTenant, getToken, getUser, isAdmin } from "../lib/auth.js";
import { ORKIO_VOICES, coerceVoiceId } from "../lib/voices.js";

// Icons (inline SVG)
const IconPlus = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const IconSend = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const IconPaperclip = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M21.44 11.05l-8.49 8.49a5 5 0 0 1-7.07-7.07l9.19-9.19a3.5 3.5 0 0 1 4.95 4.95l-9.19 9.19a2 2 0 0 1-2.83-2.83l8.49-8.49" />
  </svg>
);

const IconEdit = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
  </svg>
);

const IconLogout = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const IconSettings = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const IconMessage = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
  </svg>
);

const IconTrash = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
);


function tryParseEvent(content) {
  try {
    if (!content || typeof content !== "string") return null;
    const idx = content.indexOf("ORKIO_EVENT:");
    if (idx < 0) return null;
    const jsonStr = content.slice(idx + "ORKIO_EVENT:".length);
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

function stripEventMarker(content) {
  if (!content || typeof content !== "string") return content;
  const idx = content.indexOf("ORKIO_EVENT:");
  if (idx < 0) return content;
  return content.slice(0, idx).trim();
}

function formatTs(ts) {
  try {
    if (!ts) return "";
    return formatDateTime(ts);
  } catch {
    return "";
  }
}

function formatDateTime(ts) {
  if (ts === null || ts === undefined || ts === "") return "";
  try {
    let ms;
    if (typeof ts === "number") {
      // If value looks like milliseconds (13 digits), keep; if seconds (10 digits), convert.
      ms = ts > 10_000_000_000 ? ts : ts * 1000;
    } else {
      // ISO string or numeric string
      const n = Number(ts);
      if (!Number.isNaN(n) && Number.isFinite(n)) {
        ms = n > 10_000_000_000 ? n : n * 1000;
      } else {
        ms = new Date(ts).getTime();
      }
    }
    const d = new Date(ms);
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(d);
  } catch {
    return "";
  }
}

export default function AppConsole() {
  const nav = useNavigate();
  const [tenant, setTenant] = useState(getTenant() || "public");
  const [token, setToken] = useState(getToken());
  const [user, setUser] = useState(getUser());
  const [health, setHealth] = useState("checking");

  const [threads, setThreads] = useState([]);
  const [threadId, setThreadId] = useState("");
  const [messages, setMessages] = useState([]);
  const [agents, setAgents] = useState([]);
  const agentsByNameRef = useRef(new Map());

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  // Destination selector (Team / single / multi)
  const [destMode, setDestMode] = useState("team"); // team|single|multi
  const [destSingle, setDestSingle] = useState(""); // agent id
  const [destMulti, setDestMulti] = useState([]);   // agent ids

  // Upload modal
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFileObj, setUploadFileObj] = useState(null);
  const [uploadScope, setUploadScope] = useState("thread"); // thread|agents|institutional
  const [uploadAgentIds, setUploadAgentIds] = useState([]);
  const [uploadStatus, setUploadStatus] = useState("");
  const [uploadProgress, setUploadProgress] = useState(false);
  const fileInputRef = useRef(null);

  const messagesEndRef = useRef(null);
  const messagesRef = useRef([]); // PATCH0100_20B: keep latest messages for voice-to-voice sequencing

  // Voice-to-text (manual toggle)
  const [speechSupported] = useState(!!(window.SpeechRecognition || window.webkitSpeechRecognition));
  const speechRef = useRef(null);
  const [micEnabled, setMicEnabled] = useState(false);
  const micEnabledRef = useRef(false);
  const micRetryRef = useRef({ tries: 0, lastTry: 0 });

  // PATCH0100_13: Voice Mode (TTS + auto-send)
  const [voiceMode, setVoiceMode] = useState(false);
  const voiceModeRef = useRef(false);
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const ttsAudioRef = useRef(null);
  const [ttsVoice, setTtsVoice] = useState(localStorage.getItem('orkio_tts_voice') || 'nova');
  const lastSpokenMsgRef = useRef('');
  // PATCH0100_14: agent info from last chat response (for voice/avatar)
  const [lastAgentInfo, setLastAgentInfo] = useState(null);

  
  // Realtime/WebRTC voice mode (ultra low latency)
  const [realtimeMode, setRealtimeMode] = useState(false);
  const realtimeModeRef = useRef(false);
  const rtcPcRef = useRef(null);
  const rtcDcRef = useRef(null);
  const rtcAudioElRef = useRef(null);
  const rtcTextBufRef = useRef("");
  const rtcLastMagicRef = useRef("");
  const [rtcReadyToRespond, setRtcReadyToRespond] = useState(false);
  const rtcLastFinalTranscriptRef = useRef("");
  const rtcMagicEnabledRef = useRef(true);
  const rtcVoiceRef = useRef("cedar");
  const rtcAudioTranscriptBufRef = useRef("");

  // PATCH0100_27A: Realtime persistence (audit)
  const rtcSessionIdRef = useRef(null);
  const rtcThreadIdRef = useRef(null);
  const rtcEventQueueRef = useRef([]);
  const rtcFlushTimerRef = useRef(null);
  // PATCH0100_27_2B: UI log + punct status
  const [rtcAuditEvents, setRtcAuditEvents] = useState([]);
  const [rtcPunctStatus, setRtcPunctStatus] = useState(null); // null | 'pending' | 'done' | 'timeout'



// V2V-PATCH: trace_id por tentativa + status de fase + MediaRecorder
  const v2vTraceRef = useRef(null);
  const [v2vPhase, setV2vPhase] = useState(null); // null | 'recording' | 'stt' | 'chat' | 'tts' | 'playing' | 'error'
  const [v2vError, setV2vError] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  // BUG-02 FIX: flag para distinguir stop intencional (stopMicMediaRecorder)
  // de stop por VAD — evita processar áudio residual quando V2V é desligado
  const stopIntentionalRef = useRef(false);
  const [mediaRecorderSupported] = useState(!!(
    typeof window !== 'undefined' &&
    window.MediaRecorder &&
    navigator.mediaDevices?.getUserMedia
  ));

  useEffect(() => {
    const t = getToken();
    const u = getUser();
    setToken(t);
    setUser(u);
    if (!t) nav("/auth");
  }, []);

  useEffect(() => {
    async function checkHealth() {
      try {
      // stop batch flush timer
      if (rtcFlushTimerRef.current) { try { clearInterval(rtcFlushTimerRef.current); } catch {} rtcFlushTimerRef.current = null; }

      // best-effort flush + close session on server
      const sid = rtcSessionIdRef.current;
      rtcSessionIdRef.current = null;
      if (sid) {
        const pending = rtcEventQueueRef.current || [];
        rtcEventQueueRef.current = [];
        if (pending.length) {
          postRealtimeEventsBatch({ session_id: sid, events: pending }).catch(() => {});
        }
        endRealtimeSession({ session_id: sid, ended_at: Date.now(), meta: { reason: "client_stop" } }).catch(() => {});
      }

        await apiFetch("/api/health", { token, org: tenant });
        setHealth("ok");
      } catch {
        setHealth("down");
      }
    }
    if (token) checkHealth();
  }, [token, tenant]);

  function scrollToBottom() {
    try {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    } catch {}
  }

  useEffect(() => { scrollToBottom(); }, [messages]);

  useEffect(() => {
    function onKeyDown(e) {
      if (!realtimeModeRef.current) return;
      if (!rtcReadyToRespond) return;
      // Don't hijack typing in inputs/textarea/contenteditable
      const el = document.activeElement;
      const tag = el?.tagName?.toLowerCase();
      const isTyping = tag === "input" || tag === "textarea" || el?.isContentEditable;
      if (isTyping) return;

      if (e.code === "Space" || e.key === " " || e.key === "Enter") {
        e.preventDefault();
        triggerRealtimeResponse("hotkey");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [rtcReadyToRespond]);
  useEffect(() => { messagesRef.current = (messages || []); }, [messages]);

  async function loadThreads() {
    try {
      const { data } = await apiFetch("/api/threads", { token, org: tenant });
      setThreads(data || []);
      if (!threadId && data?.[0]?.id) setThreadId(data[0].id);
    } catch (e) {
      console.error("loadThreads error:", e);
      clearSession();
      nav("/auth");
    }
  }

  async function loadMessages(tid) {
    if (!tid) return [];
    try {
      const { data } = await apiFetch(`/api/messages?thread_id=${encodeURIComponent(tid)}`, { token, org: tenant });
      setMessages(data || []);
      return (data || []);
    } catch (e) {
      console.error("loadMessages error:", e);
      return [];
    }
  }

  async function loadAgents() {
    try {
      const { data } = await apiFetch("/api/agents", { token, org: tenant });
      setAgents(data || []);
      try {
        const m = new Map();
        (data || []).forEach(a => { if (a?.name) m.set(String(a.name).trim(), a.id); });
        agentsByNameRef.current = m;
      } catch {}

      // Default destination (single) to Orkio if exists
      if (!destSingle && Array.isArray(data)) {
        const orkio = data.find(a => (a.name || "").toLowerCase() === "orkio") || data.find(a => a.is_default);
        if (orkio) setDestSingle(orkio.id);
      }
    } catch (e) {
      console.error("loadAgents error:", e);
    }
  }

  useEffect(() => {
    if (!token) return;
    loadThreads();
    loadAgents();
  }, [token, tenant]);

  useEffect(() => { if (threadId) loadMessages(threadId); }, [threadId]);

  async function createThread() {
    try {
      const { data } = await apiFetch("/api/threads", {
        method: "POST",
        token,
        org: tenant,
        body: { title: "Nova conversa" },
      });
      if (data?.id) {
        await loadThreads();
        setThreadId(data.id);
      }
    } catch (e) {
      alert(e?.message || "Falha ao criar conversa");
    }
  }

  async function deleteThread(threadId) {
    if (!threadId) return;
    if (!confirm('Deletar esta conversa?')) return;
    try {
      await apiFetch(`/api/threads/${encodeURIComponent(threadId)}`, {
        method: "DELETE",
        token,
        org: tenant,
      });
      // Reload threads and pick a safe next one
      const { data } = await apiFetch("/api/threads", { token, org: tenant });
      const list = data || [];
      setThreads(list);
      const nextId = list?.[0]?.id || "";
      setThreadId(nextId);
      if (nextId) await loadMessages(nextId);
      else setMessages([]);
    } catch (e) {
      console.error("deleteThread error:", e);
      alert(e?.message || "Falha ao deletar conversa");
    }
  }

  async function renameThread(tid) {
    const t = threads.find((x) => x.id === tid);
    const current = t?.title || "Nova conversa";
    const next = prompt("Renomear conversa:", current);
    if (!next) return;
    try {
      await apiFetch(`/api/threads/${encodeURIComponent(tid)}`, {
        method: "PATCH",
        token,
        org: tenant,
        body: { title: next },
      });
      await loadThreads();
    } catch (e) {
      alert(e?.message || "Falha ao renomear");
    }
  }

  function doLogout() {
    clearSession();
    nav("/auth");
  }

  function buildMessagePrefix() {
    if (destMode === "team") return "@Team ";
    if (destMode === "single") {
      const ag = agents.find(a => a.id === destSingle);
      return ag ? `@${ag.name} ` : "";
    }
    if (destMode === "multi") {
      const names = agents.filter(a => destMulti.includes(a.id)).map(a => a.name);
      if (!names.length) return "@Team ";
      // backend parser supports @Name tokens; join them
      return names.map(n => `@${n}`).join(" ") + " ";
    }
    return "";
  }

  async function sendMessage() {
    const msg = (text || "").trim();
    if (!msg || sending) return;
    setSending(true);

    // UX: show progress while waiting
    try { setUploadStatus('⌛ Gerando resposta...'); } catch {}

    try {
      const pref = buildMessagePrefix();
      const finalMsg = pref + msg;

      const agentIdToSend = destSingle || null; // host agent for both single + team (team uses host voice)

      // optimistic message
      setMessages((prev) => [...prev, {
        id: `tmp-${Date.now()}`,
        role: "user",
        content: msg,
        user_name: user?.name || user?.email,
        created_at: Math.floor(Date.now() / 1000),
      }]);

      // optimistic assistant placeholder (improves UX in slow voice/audio)
      setMessages((prev) => [...prev, {
        id: `tmp-ass-${Date.now()}`,
        role: 'assistant',
        content: '⌛ Preparando resposta...',
        agent_name: 'Orkio',
        created_at: Math.floor(Date.now() / 1000),
      }]);
      setText("");

      // V2V-PATCH: gerar trace_id por tentativa de V2V (correlaciona logs backend)
      const traceId = `v2v-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      v2vTraceRef.current = traceId;
      setV2vPhase('chat');
      setV2vError(null);

      // Prefer realtime SSE stream when available (fallback to non-stream)
      let resp = null;
        let newThreadId = threadId;
      try {
        const sseRes = await chatStream({
          token,
          org: tenant,
          thread_id: threadId,
          message: finalMsg,
          agent_id: agentIdToSend,
          trace_id: traceId,
        });
        if (sseRes?.ok && (sseRes.headers.get("content-type") || "").includes("text/event-stream")) {
          const reader = sseRes.body.getReader();
          const dec = new TextDecoder();
          let buf = "";
          let activeAgent = null;

          const appendToPlaceholder = (delta) => {
            setMessages((prev) => {
              const out = [...prev];
              // update last assistant placeholder
              for (let i = out.length - 1; i >= 0; i--) {
                if ((out[i]?.id || "").startsWith("tmp-ass-")) {
                  out[i] = { ...out[i], content: ((out[i].content || "") + delta) };
                  return out;
                }
              }
              return out;
            });
          };

          // V2V-PATCH: SSE loop robusto — done global encerra reader, error cai para fallback
          let sseAborted = false;
          outer: while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            const parts = buf.split("\n\n");
            buf = parts.pop() || "";
            for (const p of parts) {
              const lines = p.split("\n").map((l) => l.trim()).filter(Boolean);
              let ev = "message";
              let data = null;
              for (const ln of lines) {
                if (ln.startsWith("event:")) ev = ln.slice(6).trim();
                if (ln.startsWith("data:")) {
                  const raw = ln.slice(5).trim();
                  try { data = JSON.parse(raw); } catch { data = raw; }
                }
              }
              if (data && typeof data === "object") {
                if (!newThreadId && data.thread_id) newThreadId = data.thread_id;

                if (ev === "status") {
                  // V2V-PATCH: mostrar agente ativo na status bar
                  if (data.agent && data.agent !== activeAgent) {
                    activeAgent = data.agent;
                    appendToPlaceholder(`\n\n[@${activeAgent}] `);
                  }
                  if (data.status) {
                    try { setUploadStatus(`🤖 ${data.status}`); } catch {}
                  }
                }

                if (ev === "chunk" && data.delta) {
                  appendToPlaceholder(data.delta);
                  // guardar message_id do chunk para usar no TTS
                  if (data.message_id) {
                    setMessages(prev => {
                      const out = [...prev];
                      for (let i = out.length - 1; i >= 0; i--) {
                        if ((out[i]?.id || "").startsWith("tmp-ass-")) {
                          out[i] = { ...out[i], _pending_message_id: data.message_id, agent_id: data.agent_id || out[i].agent_id };
                          return out;
                        }
                      }
                      return out;
                    });
                  }
                }

                if (ev === "error") {
                  // V2V-PATCH: backend sinalizou erro — logar, mostrar na UI
                  console.warn("[V2V] SSE error event:", data);
                  const errMsg = data.error || "Erro no servidor durante streaming";
                  setV2vError(errMsg);
                  setV2vPhase('error');
                  try { setUploadStatus(`❌ ${errMsg}`); } catch {}
                  // NÃO quebra o loop — aguarda done global para manter consistência
                }

                if (ev === "done" && data.done === true) {
                  // V2V-PATCH: done global — encerrar reader imediatamente
                  try { reader.cancel(); } catch {}
                  break outer;
                }
              }
            }
          }

          if (newThreadId && newThreadId !== threadId) {
            setThreadId(newThreadId);
          }
          resp = { data: { answer: null } };
        } else {
          resp = await chat({
            token, org: tenant,
            thread_id: threadId, message: finalMsg,
            agent_id: agentIdToSend, trace_id: traceId,
          });
        }
      } catch (e) {
        // V2V-PATCH: SSE falhou — fallback para /api/chat síncrono com mesmo trace_id
        console.warn("[V2V] SSE falhou, fallback para /api/chat:", e?.message);
        setV2vPhase('chat');
        resp = await chat({
          token, org: tenant,
          thread_id: threadId, message: finalMsg,
          agent_id: agentIdToSend, trace_id: traceId,
        });
      }

       // V2V-PATCH: se fallback /api/chat criou thread, capturar thread_id do resp
       if (resp?.data?.thread_id) newThreadId = resp.data.thread_id;
      // F-03 FIX: usar newThreadId (var local) em vez de threadId (closure stale do React)
      // Se a conversa foi criada durante o SSE stream, threadId ainda aponta para a thread antiga
      const effectiveTidForLoad = newThreadId || threadId;
      if (effectiveTidForLoad && effectiveTidForLoad !== threadId) {
        setThreadId(effectiveTidForLoad);
      }
      const freshMessages = await loadMessages(effectiveTidForLoad);

      // PATCH0100_14: store agent info from response
      if (resp?.data) {
        const ai = { agent_id: resp.data.agent_id, agent_name: resp.data.agent_name, voice_id: resp.data.voice_id, avatar_url: resp.data.avatar_url };
        setLastAgentInfo(ai);
      }
      // V2V-PATCH: Auto-play TTS — fase TTS + fase playing com trace_id
      if (voiceModeRef.current) {
        if (micEnabledRef.current) stopMic();
        const prevLast = messagesRef.current?.slice?.().reverse?.().find?.(m => m.role === "assistant" && !String(m?.id||"").startsWith("tmp-ass-"))?.created_at || null;
        const fresh = (freshMessages || []);
        const assistants = (fresh || []).filter(m => m.role === "assistant" && !String(m.id || "").startsWith("tmp-ass-"));
        let toSpeak = assistants;
        if (prevLast) {
          // F-04: epoch Unix (segundos) → ms para JS
          const prevT = new Date((prevLast || 0) * 1000).getTime();
          toSpeak = assistants.filter(m => {
            const t = new Date((m.created_at || 0) * 1000).getTime();
            // BUG-03 FIX: filtro estrito (>) — não incluir a msg anterior (prevT)
            return isFinite(t) && t >= (prevT - 1000);
          });
        } else {
          toSpeak = assistants.slice(-1);
        }

        // Team: fala cada mensagem sequencialmente com voz correta por agente
        // Single: só a última
        if (destMode !== "team" && toSpeak.length > 1) toSpeak = toSpeak.slice(-1);

        const currentTrace = v2vTraceRef.current || traceId;
        for (const m of toSpeak) {
          const content = (m.content || "").trim();
          if (!content) continue;
          const agentIdFallback = m.agent_id || null;
          // preferir message_id (backend resolve voz); agent_id só como fallback
          setV2vPhase('tts');
          try { setUploadStatus(`🔊 Gerando voz (${m.agent_name || 'agente'})...`); } catch {}
          await playTts(content, agentIdFallback, {
            forceAuto: true,
            messageId: m.id || null,
            traceId: currentTrace,
          });
        }
        setV2vPhase(null);
        setV2vError(null);
        // BUG-01 FIX: fallback — se playTts não reiniciou o mic (ex: autoplay bloqueado)
        // garantir que o ciclo V2V continua ouvindo
        if (voiceModeRef.current && !micEnabledRef.current) {
          setTimeout(() => startMic(), 300);
        }
      }

    } catch (e) {
      console.error("[V2V] sendMessage error:", e);
      setV2vPhase('error');
      // BUG-04 FIX: trocar alert() por setV2vError — alert() bloqueia JS thread
      // e impede o V2V de reiniciar o microfone
      setV2vError(e?.message || "Falha ao enviar mensagem");
    } finally {
      setSending(false);
      try { if (!ttsPlaying) setUploadStatus(''); } catch {}
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  // Voice recognition helpers
  function ensureSpeech() {
    if (!speechSupported) return null;
    if (speechRef.current) return speechRef.current;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;
    const rec = new SR();
    rec.lang = "pt-BR";
    rec.interimResults = true;
    rec.continuous = true;
    speechRef.current = rec;
    return rec;
  }

  function stopMic() {
    micEnabledRef.current = false;
    setMicEnabled(false);
    // V2V-PATCH: parar MediaRecorder se ativo
    stopMicMediaRecorder();
    // parar SpeechRecognition se ativo
    const rec = speechRef.current;
    if (rec) {
      try { rec.onend = null; rec.stop(); } catch {}
    }
  }

  // V2V-PATCH: startMic usa MediaRecorder (webm/opus) quando disponível.
  // MediaRecorder → /api/stt (Whisper) → texto → sendMessage()
  // Fallback: SpeechRecognition (Chrome-only) → texto → sendMessage()
  function startMic() {
    micEnabledRef.current = true;
    setMicEnabled(true);
    setV2vError(null);

    // ── Caminho 1: MediaRecorder (todos os browsers modernos, qualidade superior) ──
    if (mediaRecorderSupported && voiceModeRef.current) {
      navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        .then(stream => {
          if (!micEnabledRef.current) {
            stream.getTracks().forEach(t => t.stop());
            return;
          }

          const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
            ? 'audio/webm;codecs=opus'
            : (MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4');

          const mr = new MediaRecorder(stream, { mimeType });
          mediaRecorderRef.current = mr;
          audioChunksRef.current = [];

          mr.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
          };

          mr.onstop = async () => {
            stream.getTracks().forEach(t => t.stop());
            // BUG-02 FIX: stop intencional (stopMicMediaRecorder) → descartar chunks
            if (stopIntentionalRef.current) {
              stopIntentionalRef.current = false;
              audioChunksRef.current = [];
              return;
            }
            if (!micEnabledRef.current && !voiceModeRef.current) return;

            const chunks = audioChunksRef.current;
            audioChunksRef.current = [];
            if (!chunks.length) return;

            const blob = new Blob(chunks, { type: mimeType });
            if (blob.size < 500) {
              console.warn('[V2V] áudio muito curto, ignorando');
              return;
            }

            const trace = `v2v-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
            v2vTraceRef.current = trace;
            setV2vPhase('stt');
            setUploadStatus('🎙️ Transcrevendo fala...');

            console.info('[V2V] v2v_record_received trace_id=%s size=%d', trace, blob.size);

            try {
              const result = await transcribeAudio(blob, { token, org: tenant, trace_id: trace });
              const text = (result?.text || '').trim();
              console.info('[V2V] v2v_stt_ok trace_id=%s chars=%d preview=%s', trace, text.length, text.slice(0, 60));

              if (!text) {
                console.warn('[V2V] v2v_stt_fail trace_id=%s reason=empty_transcript', trace);
                setV2vPhase('error');
                setV2vError('Nenhum texto reconhecido. Fale novamente.');
                setUploadStatus('⚠️ Fala não reconhecida. Tente novamente.');
                setTimeout(() => setUploadStatus(''), 2500);
                // Reiniciar escuta
                if (micEnabledRef.current && voiceModeRef.current) {
                  setTimeout(() => startMic(), 800);
                }
                return;
              }

              setText(text);
              setV2vPhase('chat');
              setUploadStatus(`🎙️ "${text.slice(0, 50)}${text.length > 50 ? '…' : ''}"`);

              if (voiceModeRef.current && micEnabledRef.current) {
                micEnabledRef.current = false;
                setMicEnabled(false);
                // pequeno delay para garantir que o texto aparece no input
                setTimeout(() => sendMessage(), 80);
              }
            } catch (e) {
              console.error('[V2V] v2v_stt_fail trace_id=%s error:', trace, e);
              setV2vPhase('error');
              setV2vError(`STT falhou: ${e?.message || 'erro desconhecido'}`);
              setUploadStatus(`❌ STT: ${e?.message || 'Erro de transcrição'}`);
              setTimeout(() => setUploadStatus(''), 3000);
            }
          };

          // Gravar em segmentos de 4s — silêncio detectado por VAD simples (tamanho do chunk)
          mr.start(100); // PATCH0100_24D: smaller chunks for better VAD // coleta chunks a cada 4s

          // Auto-stop após 30s máximo ou quando detectar silêncio
          let silenceTimer = null;
          let lastSize = 0;

          // PATCH0100_24D: VAD menos agressivo (1.5s de silêncio consecutivo)
          let consecutiveSilences = 0;

          const checkSilence = setInterval(() => {
            const currentSize = audioChunksRef.current.reduce((s, c) => s + c.size, 0);
            const delta = currentSize - lastSize;
            lastSize = currentSize;

            // Espera acumular um mínimo de áudio e só encerra após 3 janelas silenciosas (~1.5s)
            if (currentSize > 3000 && delta < 500) {
              consecutiveSilences += 1;
            } else {
              consecutiveSilences = 0;
            }

            if (consecutiveSilences >= 3) {
              clearInterval(checkSilence);
              if (silenceTimer) clearTimeout(silenceTimer);
              try { mr.stop(); } catch {}
            }
          }, 500);

          silenceTimer = setTimeout(() => {
            clearInterval(checkSilence);
            if (mr.state === 'recording') {
              try { mr.stop(); } catch {}
            }
          }, 30000);

          mr.onerror = (e) => {
            clearInterval(checkSilence);
            clearTimeout(silenceTimer);
            console.error('[V2V] MediaRecorder error:', e);
            micEnabledRef.current = false;
            setMicEnabled(false);
            setV2vPhase('error');
            setV2vError('Erro no microfone. Verifique permissões.');
          };
        })
        .catch(err => {
          console.warn('[V2V] getUserMedia falhou, fallback SpeechRecognition:', err?.message);
          micEnabledRef.current = false;
          setMicEnabled(false);
          // fallback para SpeechRecognition
          _startSpeechRecognition();
        });
      return;
    }

    // ── Caminho 2: SpeechRecognition (fallback Chrome/Edge) ──
    _startSpeechRecognition();
  }

  function stopMicMediaRecorder() {
    // PATCH0100_24D: não zerar chunks antes do onstop (race condition)
    // BUG-02 FIX: sinalizar stop intencional para que onstop descarte os chunks
    stopIntentionalRef.current = true;
    const mr = mediaRecorderRef.current;
    mediaRecorderRef.current = null;

    // NÃO limpar audioChunksRef aqui: o handler onstop consome os chunks.
    if (mr && mr.state === 'recording') {
      try { mr.stop(); } catch {}
    }
  }

  function _startSpeechRecognition() {
    const rec = ensureSpeech();
    if (!rec) {
      setV2vError('Microfone não disponível neste browser. Use Chrome ou ative permissões.');
      micEnabledRef.current = false;
      setMicEnabled(false);
      return;
    }

    let finalText = "";
    let autoSendTimer = null;
    rec.onresult = (evt) => {
      let interim = "";
      for (let i = evt.resultIndex; i < evt.results.length; i++) {
        const transcript = evt.results[i][0].transcript;
        if (evt.results[i].isFinal) finalText += transcript;
        else interim += transcript;
      }
      const merged = (finalText || interim || "").trim();
      if (merged) setText(merged);

      if (voiceModeRef.current && finalText.trim()) {
        if (autoSendTimer) clearTimeout(autoSendTimer);
        autoSendTimer = setTimeout(() => {
          const toSend = finalText.trim();
          if (toSend && voiceModeRef.current) {
            finalText = "";
            try { rec.stop(); } catch {}
            micEnabledRef.current = false;
            setMicEnabled(false);
            sendMessage();
          }
        }, 1500);
      }
    };

    rec.onerror = () => { /* keep enabled; onend will handle retry */ };

    rec.onend = () => {
      if (!micEnabledRef.current) return;
      const now = Date.now();
      const st = micRetryRef.current;
      if (now - st.lastTry > 20000) { st.tries = 0; }
      st.lastTry = now;
      st.tries += 1;
      if (st.tries > 3) {
        micEnabledRef.current = false;
        setMicEnabled(false);
        setUploadStatus("Microfone pausou. Clique no 🎙️ para retomar.");
        setTimeout(() => setUploadStatus(""), 2500);
        return;
      }
      setTimeout(() => {
        if (micEnabledRef.current) { try { rec.start(); } catch {} }
      }, 300);
    };

    try { rec.start(); } catch {}
  }

  function toggleMic() {
    if (!speechSupported) return;
    if (micEnabled) stopMic();
    else startMic();
  }

  // PATCH0100_13: Voice Mode helpers
  function toggleVoiceMode() {
    const next = !voiceMode;
    setVoiceMode(next);
    voiceModeRef.current = next;
    if (next) {
      setV2vPhase(null);
      setV2vError(null);
      // V2V-PATCH: preferir MediaRecorder (qualidade), fallback SpeechRecognition
      const canRecord = mediaRecorderSupported || speechSupported;
      if (canRecord && !micEnabled) startMic();
      const modo = mediaRecorderSupported ? 'MediaRecorder + Whisper' : 'SpeechRecognition';
      setUploadStatus(`🔊 Modo Voz ativo (${modo}) — fale e a resposta será lida em voz alta`);
      setTimeout(() => setUploadStatus(''), 4000);
    } else {
      if (micEnabled) stopMic();
      stopTts();
      setV2vPhase(null);
      setV2vError(null);
      setUploadStatus('');
    }
  }


  async function startRealtime() {
    try {
      setV2vError(null);
      setV2vPhase('connecting');
      setUploadStatus('⚡ Conectando Realtime (WebRTC)...');

      // Close any previous session
      stopRealtime();

      try { setRtcAuditEvents([]); } catch {}
      try { setRtcPunctStatus(null); } catch {}


      const agentIdToSend = destSingle || null; // host agent for both single + team (team uses host voice)
      const ORKIO_ENV = (typeof window !== "undefined" && window.__ORKIO_ENV__) ? window.__ORKIO_ENV__ : {};
      const envVoice = (ORKIO_ENV.VITE_REALTIME_VOICE || import.meta.env.VITE_REALTIME_VOICE || "").trim();
      const rtModel = (ORKIO_ENV.VITE_REALTIME_MODEL || import.meta.env.VITE_REALTIME_MODEL || "gpt-realtime-mini").trim();
      const magicEnabled = (ORKIO_ENV.VITE_REALTIME_MAGICWORDS || import.meta.env.VITE_REALTIME_MAGICWORDS || "true").toString().trim().toLowerCase() !== "false";
      rtcMagicEnabledRef.current = magicEnabled;

      // Voice priority: agent.voice_id (Admin) > env default > fallback ("cedar")
      const selectedAgentObj = (agents || []).find(a => String(a.id) === String(agentIdToSend));
      const agentVoice = ((selectedAgentObj?.voice_id || selectedAgentObj?.voice || selectedAgentObj?.tts_voice || selectedAgentObj?.voiceId || "")).toString().trim();
      const rtVoice = coerceVoiceId(agentVoice || envVoice || "cedar");
      rtcVoiceRef.current = rtVoice;

      // PATCH0100_27A: start server-side realtime session (for audit logging) and receive ephemeral key
      const start = await startRealtimeSession({ agent_id: agentIdToSend, thread_id: threadId || null, voice: rtVoice, model: rtModel, ttl_seconds: 600 });
      const EPHEMERAL_KEY = start?.client_secret?.value;
      if (!EPHEMERAL_KEY) throw new Error('Realtime token vazio');

      rtcSessionIdRef.current = start?.session_id || null;
      rtcThreadIdRef.current = start?.thread_id || threadId || null;
      if (start?.thread_id && start.thread_id !== threadId) {
        try { setThreadId(start.thread_id); } catch {}
      }

      rtcEventQueueRef.current = [];
      if (rtcFlushTimerRef.current) { try { clearInterval(rtcFlushTimerRef.current); } catch {} }
      rtcFlushTimerRef.current = setInterval(() => { try { flushRealtimeEvents(); } catch {} }, 400);


      const pc = new RTCPeerConnection();
      rtcPcRef.current = pc;

      // Remote audio output
      const audioEl = document.createElement('audio');
      audioEl.autoplay = true;
      audioEl.playsInline = true;
      rtcAudioElRef.current = audioEl;
      pc.ontrack = (e) => {
        try {
          audioEl.srcObject = e.streams[0];
          // Ensure element is connected for better autoplay compatibility
          if (!audioEl.isConnected) {
            audioEl.style.display = "none";
            document.body.appendChild(audioEl);
          }
          const p = audioEl.play?.();
          if (p && typeof p.catch === "function") p.catch(() => {});
        } catch {}
      };

      // Mic input
      const ms = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const track = ms.getTracks()[0];
      pc.addTrack(track, ms);

      // Events channel
      const dc = pc.createDataChannel('oai-events');
      rtcDcRef.current = dc;

            dc.addEventListener('open', () => {
        setV2vPhase('listening');
        setUploadStatus('⚡ Realtime ativo — fale normalmente.');
        setTimeout(() => setUploadStatus(''), 1500);

        // Hint transcription language to reduce "foreign language" hallucinations
        try {
          dc.send(JSON.stringify({
  type: "session.update",
  session: {
    type: "realtime",
    audio: {
      input: {
        transcription: {
          model: "gpt-4o-mini-transcribe",
          language: "pt"
        }
      }
    }
  }
}));
        } catch {}
      });

      dc.addEventListener('message', (e) => {
        try {
          const ev = JSON.parse(e.data);

                    // Turn arming + optional Magic Words (B3)
          // We DO NOT auto-respond (create_response=false). We arm the turn on final transcript and
          // only create a response when the user clicks, presses a hotkey, or speaks a magic word.
          if (ev?.type === 'conversation.item.input_audio_transcription.completed') {
            const raw = (ev?.transcript || ev?.text || ev?.result?.transcript || '').toString();
            // persist final transcript (audit)
            queueRealtimeEvent({ event_type: 'transcript.final', role: 'user', content: raw, is_final: true });
            try {
              const mid = `rtc_user_${Date.now()}_${Math.random().toString(16).slice(2)}`;
              setMessages((prev) => prev.concat([{
                id: mid,
                role: "user",
                content: raw,
                created_at: Math.floor(Date.now()/1000),
              }]));
            } catch {}

            rtcLastFinalTranscriptRef.current = raw;
            setRtcReadyToRespond(!!raw.trim());

            const norm = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
            const endsWithCmd = (s, cmd) => s === cmd || s.endsWith(' ' + cmd);
            const isMagic = endsWithCmd(norm, 'prossiga') || endsWithCmd(norm, 'por favor');

            if (rtcMagicEnabledRef.current && isMagic) {
              try {
                // prevent accidental double-fire on duplicate events
                if (rtcLastMagicRef.current !== norm) {
                  rtcLastMagicRef.current = norm;
                  triggerRealtimeResponse("magic");
                }
              } catch (err) {
                console.warn('[Realtime] magic trigger failed', err);
              }
            } else {
              // User must explicitly trigger (button/hotkey)
              if (raw.trim()) {
                setUploadStatus('🟦 Pronto para responder (clique ▶️ ou pressione Espaço/Enter).');
                setTimeout(() => setUploadStatus(''), 1800);
              }
            }
          }
// Basic telemetry + optional live captions
          if (ev?.type === 'response.text.delta' && ev?.delta) {
            rtcTextBufRef.current += ev.delta;
          }
          if (ev?.type === 'response.text.done') {
            const t = (rtcTextBufRef.current || '').trim();
            rtcTextBufRef.current = '';
            if (t) {
            // persist final assistant text (audit)
            queueRealtimeEvent({ event_type: 'response.final', role: 'assistant', content: t, is_final: true });
            try {
              const selectedAgentObj2 = (agents || []).find(a => String(a.id) === String(agentIdToSend));
              const agentName2 = selectedAgentObj2?.name || "Orkio";
              const agentId2 = selectedAgentObj2?.id || (agentIdToSend) || null;
              const mid = `rtc_ass_${Date.now()}_${Math.random().toString(16).slice(2)}`;
              setMessages((prev) => prev.concat([{
                id: mid,
                role: "assistant",
                content: t,
                agent_id: agentId2 ? String(agentId2) : null,
                agent_name: agentName2,
                created_at: Math.floor(Date.now()/1000),
              }]));
            } catch {}

            setUploadStatus('📝 ' + t.slice(0, 80) + (t.length > 80 ? '…' : ''));
          }
            setTimeout(() => setUploadStatus(''), 2500);
          }
          // Audio transcript (when model outputs audio without text)
          if (ev?.type === 'response.audio_transcript.delta' && ev?.delta) {
            rtcAudioTranscriptBufRef.current = (rtcAudioTranscriptBufRef.current || '') + ev.delta;
          }
          if (ev?.type === 'response.audio_transcript.done' || ev?.type === 'response.audio_transcript.final') {
            const at = ((rtcAudioTranscriptBufRef.current || '') + (ev?.transcript || '')).trim();
            rtcAudioTranscriptBufRef.current = '';
            if (at) {
              queueRealtimeEvent({ event_type: 'response.final', role: 'assistant', content: at, is_final: true });
              try {
                const selectedAgentObj2 = (agents || []).find(a => String(a.id) === String(agentIdToSend));
                const agentName2 = selectedAgentObj2?.name || "Orkio";
                const agentId2 = selectedAgentObj2?.id || (agentIdToSend) || null;
                const mid = `rtc_ass_${Date.now()}_${Math.random().toString(16).slice(2)}`;
                setMessages((prev) => prev.concat([{
                  id: mid,
                  role: "assistant",
                  content: at,
                  agent_id: agentId2 ? String(agentId2) : null,
                  agent_name: agentName2,
                  created_at: Math.floor(Date.now()/1000),
                }]));
              } catch {}
            }
          }

          if (ev?.type === 'error') {
            console.warn('[Realtime] error', ev);
            setV2vError(ev?.error?.message || 'Erro Realtime');
            setV2vPhase('error');
          }
        } catch {}
      });

      // SDP handshake
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpResponse = await fetch('https://api.openai.com/v1/realtime/calls', {
        method: 'POST',
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${EPHEMERAL_KEY}`,
          'Content-Type': 'application/sdp',
        },
      });

      if (!sdpResponse.ok) {
        const t = await sdpResponse.text().catch(() => '');
        throw new Error(`SDP handshake falhou (${sdpResponse.status}): ${t || sdpResponse.statusText}`);
      }

      const answer = { type: 'answer', sdp: await sdpResponse.text() };
      await pc.setRemoteDescription(answer);

    } catch (e) {
      console.error('[Realtime] startRealtime error', e);
      setV2vPhase('error');
      setV2vError(e?.message || 'Falha ao iniciar Realtime');
      setUploadStatus('❌ Realtime: ' + (e?.message || 'falha'));
      setTimeout(() => setUploadStatus(''), 3000);
      stopRealtime();
      setRealtimeMode(false);
      realtimeModeRef.current = false;
    }
  }

  
  function triggerRealtimeResponse(reason = "manual") {
    try {
      const dc = rtcDcRef.current;
      if (!dc || dc.readyState !== "open") {
        throw new Error("DataChannel não está aberto");
      }
      dc.send(JSON.stringify({ type: "response.create", response: { modalities: ["audio"], voice: rtcVoiceRef.current } }));
      setRtcReadyToRespond(false);
      setUploadStatus(reason === "magic" ? "✨ Comando recebido — respondendo..." : "▶️ Respondendo...");
      setTimeout(() => setUploadStatus(""), 1500);
    } catch (e) {
      console.warn("[Realtime] triggerRealtimeResponse failed", e);
      setUploadStatus("❌ Falha ao disparar resposta (Realtime).");
      setTimeout(() => setUploadStatus(""), 2000);
    }
  }


  // PATCH0100_27A: Realtime event logging (batched, non-blocking)
  function queueRealtimeEvent({ event_type, role, content = null, is_final = false, meta = null } = {}) {
    const sid = rtcSessionIdRef.current;
    if (!sid) return;
    rtcEventQueueRef.current.push({
      session_id: sid,
      event_type,
      role,
      content,
      created_at: Math.floor(Date.now()/1000),
      is_final,
      meta,
    });
    try {
      if (is_final && (content || '').toString().trim()) {
        const item = {
          session_id: sid,
          event_type,
          role,
          content: (content || '').toString(),
          transcript_punct: null,
          created_at: Math.floor(Date.now()/1000),
        };
        setRtcAuditEvents(prev => prev.concat([item]));
      }
    } catch {}
  }

  async function flushRealtimeEvents() {
    const sid = rtcSessionIdRef.current;
    if (!sid) return;
    const q = rtcEventQueueRef.current || [];
    if (!q.length) return;
    // Take a snapshot to avoid races
    rtcEventQueueRef.current = [];
    try {
      await postRealtimeEventsBatch({ session_id: sid, events: q });
    } catch (err) {
      // On failure, put events back to try later (best-effort)
      rtcEventQueueRef.current = q.concat(rtcEventQueueRef.current || []);
      console.warn('[Realtime] events batch failed', err);
    }
  }


  // PATCH0100_27_2B: finalize session on server + poll punctuated finals (best-effort)
  async function finalizeRealtimeSession(reason = 'client_stop') {
    const sid = rtcSessionIdRef.current;
    if (!sid) return;
    // stop timer
    if (rtcFlushTimerRef.current) { try { clearInterval(rtcFlushTimerRef.current); } catch {} rtcFlushTimerRef.current = null; }
    // flush pending events
    try { await flushRealtimeEvents(); } catch {}
    // end session (best-effort)
    try { await endRealtimeSession({ session_id: sid, ended_at: Date.now(), meta: { reason } }); } catch {}

    // poll for punct updates (best-effort, bounded)
    try {
      try { finalizeRealtimeSession('client_stop'); } catch {}
      setRtcPunctStatus('pending');
      const started = Date.now();
      const deadlineMs = 15000;
      let last = null;
      while (Date.now() - started < deadlineMs) {
        try {
          const data = await getRealtimeSession({ session_id: sid, finals_only: true });
          last = data;
          if (data?.events) {
            setRtcAuditEvents(data.events);
          }
          if (data?.punct?.done) {
            setRtcPunctStatus('done');
            return;
          }
        } catch {}
        await new Promise(r => setTimeout(r, 900));
      }
      // timeout but still set last snapshot
      if (last?.events) setRtcAuditEvents(last.events);
      setRtcPunctStatus('timeout');
    } catch {
      setRtcPunctStatus('timeout');
    }
  }

function stopRealtime() {
    try {
      const dc = rtcDcRef.current;
      rtcDcRef.current = null;
      if (dc) { try { dc.close(); } catch {} }

      const pc = rtcPcRef.current;
      rtcPcRef.current = null;
      if (pc) { try { pc.close(); } catch {} }

      const a = rtcAudioElRef.current;
      rtcAudioElRef.current = null;
      if (a) { try { a.pause(); } catch {} }

      rtcTextBufRef.current = '';
    } catch {}
  }

  function toggleRealtimeMode() {
    const next = !realtimeMode;
    setRealtimeMode(next);
    realtimeModeRef.current = next;

    if (next) {
      // Disable classic voice mode to avoid mic contention
      if (voiceModeRef.current) {
        setVoiceMode(false);
        voiceModeRef.current = false;
      }
      try { stopMic(); } catch {}
      try { stopTts(); } catch {}
      startRealtime();
    } else {
      stopRealtime();
      setV2vPhase(null);
      setV2vError(null);
      setUploadStatus('');
    }
  }

  function stopTts() {
    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause();
      ttsAudioRef.current = null;
    }
    setTtsPlaying(false);
  }

  async function playTts(textToSpeak, agentId, opts = {}) {
    // F-01 FIX: desestruturar opts no início da função
    const { forceAuto = false, messageId = null, traceId = null } = opts || {};
    if (!textToSpeak || textToSpeak.length < 2) return;
    // Evitar reler a mesma mensagem (idempotência)
    if (textToSpeak === lastSpokenMsgRef.current) return;
    lastSpokenMsgRef.current = textToSpeak;

    // Limpar markdown para fala mais natural
    let clean = textToSpeak
      .replace(/```[\s\S]*?```/g, ' código omitido ')
      .replace(/`[^`]+`/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[#*_~>|]/g, '')
      .replace(/\n{2,}/g, '. ')
      .replace(/\n/g, ' ')
      .trim();
    if (voiceModeRef.current) {
      if (clean.length > 1200) clean = clean.slice(0, 1200);
    } else {
      if (clean.length > 4096) clean = clean.slice(0, 4096);
    }
    if (clean.length < 2) return;

    stopTts();
    setTtsPlaying(true);
    setV2vPhase('playing');

    const effectiveTrace = traceId || v2vTraceRef.current || null;
    console.info('[V2V] v2v_play_start trace_id=%s message_id=%s agent_id=%s', effectiveTrace, messageId, agentId);

    try {
      const base = (window.__ORKIO_ENV__?.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '');
      const apiUrl = base.endsWith('/api') ? base.slice(0, -4) : base;

      const ttsHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Org-Slug': tenant,
      };
      if (effectiveTrace) ttsHeaders['X-Trace-Id'] = effectiveTrace;

      const res = await fetch(`${apiUrl}/api/tts`, {
        method: 'POST',
        headers: ttsHeaders,
        // V2V-PATCH: preferir message_id (backend resolve voz correta por agente)
        // agent_id só como fallback se message_id não disponível
        body: JSON.stringify({
          text: clean,
          voice: (forceAuto || messageId) ? null : (ttsVoice === "auto" ? null : ttsVoice),
          speed: 1.0,
          agent_id: messageId ? null : (agentId || null),
          message_id: messageId || null,
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.warn('[V2V] v2v_tts_fail trace_id=%s status=%d body=%s', effectiveTrace, res.status, errText.slice(0, 200));
        setTtsPlaying(false);
        setV2vPhase('error');
        setV2vError(`TTS falhou (HTTP ${res.status})`);
        if (res.status === 401) {
          alert("Sessão expirada. Faça login novamente.");
          try { localStorage.removeItem("orkio_token"); } catch (_) {}
          window.location.href = "/auth";
        }
        return;
      }

      const blob = await res.blob();
      if (!blob || blob.size < 50) {
        console.warn('[V2V] v2v_tts_fail trace_id=%s reason=empty_blob size=%d', effectiveTrace, blob?.size);
        setTtsPlaying(false);
        setV2vPhase('error');
        setV2vError('TTS retornou áudio vazio');
        return;
      }

      console.info('[V2V] v2v_tts_ok trace_id=%s bytes=%d', effectiveTrace, blob.size);
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      ttsAudioRef.current = audio;

      await new Promise((resolve, reject) => {
        audio.onended = () => {
          console.info('[V2V] v2v_play_end trace_id=%s', effectiveTrace);
          setTtsPlaying(false);
          setV2vPhase(null);
          URL.revokeObjectURL(url);
          ttsAudioRef.current = null;
          // Reiniciar microfone após fala (ciclo V2V)
          if (voiceModeRef.current && (speechSupported || mediaRecorderSupported) && !micEnabledRef.current) {
            startMic();
          }
          resolve();
        };
        audio.onerror = (err) => {
          console.error('[V2V] audio.onerror trace_id=%s', effectiveTrace, err);
          setTtsPlaying(false);
          setV2vPhase('error');
          setV2vError('Erro ao reproduzir áudio');
          URL.revokeObjectURL(url);
          ttsAudioRef.current = null;
          reject(new Error('Audio playback error'));
        };
        audio.play().catch(err => {
          // autoplay bloqueado pelo browser — fallback silencioso
          console.warn('[V2V] autoplay blocked trace_id=%s:', effectiveTrace, err?.message);
          setTtsPlaying(false);
          setV2vPhase(null);
          URL.revokeObjectURL(url);
          ttsAudioRef.current = null;
          // BUG-01 FIX: reiniciar mic mesmo sem áudio — ciclo V2V não pode morrer aqui
          if (voiceModeRef.current && !micEnabledRef.current) {
            setTimeout(() => startMic(), 300);
          }
          resolve(); // não rejeitar — V2V deve continuar mesmo sem áudio
        });
      });
    } catch (e) {
      console.error('[V2V] v2v_tts_fail trace_id=%s error:', effectiveTrace, e);
      setTtsPlaying(false);
      setV2vPhase('error');
      setV2vError(e?.message || 'Erro desconhecido no TTS');
    }
  }

  function changeTtsVoice(v) {
    setTtsVoice(v);
    localStorage.setItem('orkio_tts_voice', v);
  }

  // Upload flow
  function onPickFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    e.target.value = "";
    setUploadFileObj(f);
    setUploadScope("thread");
    setUploadAgentIds([]);
    setUploadOpen(true);
  }

  async function confirmUpload() {
    const f = uploadFileObj;
    if (!f) return;
    // PATCH0100_17_ENSURE_THREAD_BEFORE_UPLOAD: uploads need a thread to be visible in chat
    let effectiveThreadId = threadId;
    if (!effectiveThreadId && (uploadScope === "thread" || uploadScope === "institutional")) {
      try {
        const created = await apiFetch("/api/threads", { method: "POST", token, org: tenant, body: { title: "Nova conversa" }});
        effectiveThreadId = created?.data?.id;
        if (effectiveThreadId) setThreadId(effectiveThreadId);
      } catch (e) {
        console.warn("could not create thread before upload", e);
      }
    }

    try {
      setUploadProgress(true);
      setUploadStatus("Enviando arquivo...");

      if (uploadScope === "thread") {
        await uploadFile(f, { token, org: tenant, threadId: effectiveThreadId, intent: "chat" });
        setUploadStatus("Arquivo anexado à conversa ✅");
        try { await loadMessages(effectiveThreadId); } catch {}
      } else if (uploadScope === "agents") {
        if (!uploadAgentIds.length) {
          alert("Selecione ao menos um agente.");
          return;
        }
        await uploadFile(f, { token, org: tenant, agentIds: uploadAgentIds, intent: "agent" });
        setUploadStatus("Arquivo vinculado aos agentes ✅");
      } else if (uploadScope === "institutional") {
        const admin = isAdmin(user);
        if (admin) {
          await uploadFile(f, { token, org: tenant, threadId: effectiveThreadId, intent: "institutional", linkAllAgents: true });
          setUploadStatus("Arquivo institucional (global) ✅");
          // STAB: reload com effectiveThreadId para garantir que mensagem system aparece
          try {
            if (effectiveThreadId) await loadMessages(effectiveThreadId);
          } catch (e) { console.warn("loadMessages after institutional upload failed:", e); }
        } else {
          // B2: request institutionalization; keep accessible in this thread
          await uploadFile(f, { token, org: tenant, threadId: effectiveThreadId, intent: "chat", institutionalRequest: true });
          setUploadStatus("Solicitação enviada ao admin (institucional) ✅");
          try { await loadMessages(effectiveThreadId); } catch {}
        }
      }

      setUploadOpen(false);
      setUploadFileObj(null);
      setTimeout(() => setUploadStatus(""), 2200);
    } catch (e) {
      console.error("upload error", e);
      setUploadStatus(e?.message || "Falha no upload");
      setTimeout(() => setUploadStatus(""), 2500);
    } finally {
      setUploadProgress(false);
    }
  }

  const styles = {
    layout: {
      display: "flex",
      height: "100vh",
      background:
        "radial-gradient(1200px 700px at 30% -10%, rgba(124,92,255,0.25), transparent 60%), linear-gradient(180deg, #05060a, #03030a)",
      color: "#fff",
      fontFamily: "system-ui",
    },
    sidebar: {
      width: "330px",
      borderRight: "1px solid rgba(255,255,255,0.08)",
      display: "flex",
      flexDirection: "column",
      padding: "16px",
      gap: "12px",
    },
    brand: { fontSize: "18px", fontWeight: 800, letterSpacing: "-0.02em" },
    badge: {
      display: "inline-flex",
      alignItems: "center",
      gap: "8px",
      padding: "6px 10px",
      borderRadius: "999px",
      fontSize: "12px",
      border: "1px solid rgba(255,255,255,0.1)",
      background: "rgba(255,255,255,0.04)",
      color: "rgba(255,255,255,0.8)",
    },
    topRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" },
    newThreadBtn: {
      display: "inline-flex",
      alignItems: "center",
      gap: "8px",
      padding: "10px 12px",
      borderRadius: "14px",
      border: "1px solid rgba(255,255,255,0.1)",
      background: "rgba(255,255,255,0.05)",
      color: "#fff",
      cursor: "pointer",
    },
    threads: { flex: 1, overflowY: "auto", padding: "0 8px" },
    emptyThreads: { padding: "20px", textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: "13px" },
    threadItem: {
      display: "flex",
      alignItems: "center",
      gap: "10px",
      width: "100%",
      padding: "12px",
      background: "transparent",
      border: "none",
      borderRadius: "10px",
      color: "rgba(255,255,255,0.7)",
      fontSize: "13px",
      cursor: "pointer",
      textAlign: "left",
      marginBottom: "4px",
    },
    threadItemActive: { background: "rgba(255,255,255,0.1)", color: "#fff" },
    threadTitle: { flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
    threadEditBtn: {
      border: "none",
      background: "transparent",
      color: "rgba(255,255,255,0.55)",
      padding: "4px",
      borderRadius: "8px",
      cursor: "pointer",
    },
    userSection: {
      padding: "16px",
      borderTop: "1px solid rgba(255,255,255,0.08)",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "10px",
    },
    userInfo: { display: "flex", alignItems: "center", gap: "10px" },
    userAvatar: {
      width: "36px",
      height: "36px",
      borderRadius: "50%",
      background: "linear-gradient(135deg, #7c5cff 0%, #35d0ff 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontWeight: 800,
    },
    userDetails: { display: "flex", flexDirection: "column" },
    userName: { fontSize: "13px", fontWeight: 700 },
    userEmail: { fontSize: "12px", color: "rgba(255,255,255,0.55)" },
    userActions: { display: "flex", alignItems: "center", gap: "8px" },
    iconBtn: {
      width: "36px",
      height: "36px",
      borderRadius: "12px",
      border: "1px solid rgba(255,255,255,0.1)",
      background: "rgba(255,255,255,0.05)",
      color: "#fff",
      cursor: "pointer",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
    },

    main: { flex: 1, display: "flex", flexDirection: "column" },
    topbar: {
      padding: "16px 18px",
      borderBottom: "1px solid rgba(255,255,255,0.08)",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "10px",
    },
    title: { fontSize: "16px", fontWeight: 900 },
    health: { fontSize: "12px", color: "rgba(255,255,255,0.6)" },
    chatArea: { flex: 1, overflowY: "auto", padding: "16px 18px" },
    messageRow: { display: "flex", marginBottom: "12px" },
    messageBubble: {
      maxWidth: "820px",
      padding: "12px 12px",
      borderRadius: "16px",
      border: "1px solid rgba(255,255,255,0.1)",
      background: "rgba(255,255,255,0.04)",
    },
    userBubble: { background: "rgba(124,92,255,0.12)", border: "1px solid rgba(124,92,255,0.25)" },
    agentBubble: { background: "rgba(53,208,255,0.10)", border: "1px solid rgba(53,208,255,0.22)" },
    systemBubble: { background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.18)" },
    bubbleHeaderRow: { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "12px", marginBottom: "6px" },
    bubbleHeaderName: { fontSize: "12px", color: "rgba(255,255,255,0.70)", fontWeight: 900 },
    bubbleHeaderTime: { fontSize: "12px", color: "rgba(255,255,255,0.55)", fontWeight: 700 },
    nameUser: { color: "rgba(196,176,255,0.95)" },
    nameAgent: { color: "rgba(160,240,255,0.95)" },
    nameSystem: { color: "rgba(255,255,255,0.82)" },
    messageContent: { whiteSpace: "pre-wrap", lineHeight: 1.45, fontSize: "14px" },
    messageTime: { marginTop: "8px", fontSize: "11px", color: "rgba(255,255,255,0.55)" },

    uploadStatus: {
      padding: "10px 18px",
      fontSize: "13px",
      color: "rgba(255,255,255,0.85)",
      borderTop: "1px solid rgba(255,255,255,0.08)",
      background: "rgba(255,255,255,0.03)",
    },

    realtimeAudit: {
      padding: "10px 18px",
      fontSize: "12px",
      color: "rgba(255,255,255,0.82)",
      borderTop: "1px solid rgba(255,255,255,0.08)",
      background: "rgba(80,160,255,0.06)",
      maxHeight: "220px",
      overflowY: "auto",
    },
    realtimeAuditHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", marginBottom: "8px" },
    realtimeAuditTitle: { fontWeight: 900, letterSpacing: "0.2px" },
    realtimeAuditPill: { padding: "2px 8px", borderRadius: "999px", border: "1px solid rgba(255,255,255,0.16)", background: "rgba(255,255,255,0.05)", fontSize: "11px" },
    realtimeAuditItem: { padding: "8px 10px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.03)", marginBottom: "8px" },
    realtimeAuditMeta: { display: "flex", justifyContent: "space-between", gap: "10px", marginBottom: "6px", opacity: 0.8 },
    realtimeAuditWho: { fontWeight: 900 },
    realtimeAuditText: { whiteSpace: "pre-wrap", lineHeight: 1.45 },


    composerContainer: { padding: "14px 18px", borderTop: "1px solid rgba(255,255,255,0.08)" },
    composer: {
      display: "flex",
      alignItems: "flex-end",
      gap: "10px",
      padding: "10px",
      borderRadius: "18px",
      border: "1px solid rgba(255,255,255,0.12)",
      background: "rgba(255,255,255,0.04)",
    },
    attachBtn: {
      width: "42px",
      height: "42px",
      borderRadius: "14px",
      border: "1px solid rgba(255,255,255,0.1)",
      background: "rgba(255,255,255,0.05)",
      color: "#fff",
      cursor: "pointer",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      opacity: uploadProgress ? 0.6 : 1,
    },
    textarea: {
      flex: 1,
      minHeight: "42px",
      maxHeight: "180px",
      resize: "none",
      background: "transparent",
      border: "none",
      outline: "none",
      color: "#fff",
      fontSize: "14px",
      lineHeight: 1.4,
      padding: "10px 8px",
    },
    micBtn: {
      width: "42px",
      height: "42px",
      borderRadius: "14px",
      border: "1px solid rgba(255,255,255,0.1)",
      background: micEnabled ? "rgba(53,208,255,0.15)" : "rgba(255,255,255,0.05)",
      color: "#fff",
      cursor: speechSupported ? "pointer" : "not-allowed",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      opacity: speechSupported ? 1 : 0.6,
    },
    sendBtn: {
      width: "42px",
      height: "42px",
      borderRadius: "14px",
      border: "1px solid rgba(255,255,255,0.1)",
      background: "rgba(255,255,255,0.05)",
      color: "#fff",
      cursor: "pointer",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      opacity: sending ? 0.6 : 1,
    },
    select: {
      padding: "8px 10px",
      borderRadius: "12px",
      border: "1px solid rgba(255,255,255,0.12)",
      background: "rgba(255,255,255,0.05)",
      color: "#fff",
      fontSize: "12px",
    },
    modalBack: {
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.55)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 50,
      padding: "16px",
    },
    modal: {
      width: "min(720px, 96vw)",
      borderRadius: "18px",
      border: "1px solid rgba(255,255,255,0.12)",
      background: "rgba(12,12,20,0.96)",
      padding: "16px",
    },
    modalTitle: { fontSize: "14px", fontWeight: 900 },
    radioRow: { display: "flex", gap: "10px", alignItems: "center", marginTop: "10px", color: "rgba(255,255,255,0.85)" },
    modalActions: { display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "14px" },
    btn: { border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#fff", padding: "10px 12px", borderRadius: "14px", cursor: "pointer" },
    btnPrimary: { background: "rgba(124,92,255,0.22)", border: "1px solid rgba(124,92,255,0.35)", fontWeight: 800 },
    checkGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "8px", marginTop: "10px" },
    checkItem: { display: "flex", gap: "8px", alignItems: "center", padding: "8px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" },
    hint: { fontSize: "12px", color: "rgba(255,255,255,0.6)", marginTop: "6px" },
  };

  const meName = user?.name || user?.email || "Você";

  return (
    <div style={styles.layout}>
      {/* Sidebar */}
      <div style={styles.sidebar}>
        <div style={styles.topRow}>
          <div>
            <div style={styles.brand}>Orkio</div>
            <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span style={styles.badge}>org: {tenant}</span>
              <span style={styles.badge}>{health === "ok" ? "ready" : health}</span>
            </div>
          </div>

          <button style={styles.newThreadBtn} onClick={createThread} title="Nova conversa">
            <IconPlus /> Novo
          </button>
        </div>

        <div style={styles.threads}>
          {threads.length === 0 ? (
            <div style={styles.emptyThreads}>Nenhuma conversa ainda.</div>
          ) : (
            threads.map((t) => (
              <button
                key={t.id}
                onClick={() => setThreadId(t.id)}
                style={{
                  ...styles.threadItem,
                  ...(t.id === threadId ? styles.threadItemActive : {}),
                }}
              >
                <IconMessage />
                <span style={styles.threadTitle}>{t.title}</span>
                <button
                  style={styles.threadEditBtn}
                  onClick={(e) => { e.stopPropagation(); renameThread(t.id); }}
                  title="Renomear conversa"
                >
                  <IconEdit />
                </button>
                <button
                  style={styles.threadEditBtn}
                  onClick={(e) => { e.stopPropagation(); deleteThread(t.id); }}
                  title="Deletar conversa"
                >
                  <IconTrash />
                </button>
              </button>
            ))
          )}
        </div>

        <div style={styles.userSection}>
          <div style={styles.userInfo}>
            <div style={styles.userAvatar}>{meName.charAt(0).toUpperCase()}</div>
            <div style={styles.userDetails}>
              <div style={styles.userName}>{user?.name || "Usuário"}</div>
              <div style={styles.userEmail}>{user?.email || ""}</div>
            </div>
          </div>

          <div style={styles.userActions}>
            {isAdmin(user) && (
              <button style={styles.iconBtn} onClick={() => nav("/admin")} title="Admin Console">
                <IconSettings />
              </button>
            )}
            <button style={styles.iconBtn} onClick={doLogout} title="Sair">
              <IconLogout />
            </button>
          </div>
        </div>
      </div>

      {/* Main */}
      <div style={styles.main}>
        <div style={styles.topbar}>
          <div>
            <div style={styles.title}>{threads.find((t) => t.id === threadId)?.title || "Conversa"}</div>
            <div style={styles.health}>Destino: {destMode === "team" ? "Team" : destMode === "single" ? "Agente" : "Multi"} • @Team / @Orkio / @Chris / @Orion</div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select style={styles.select} value={destMode} onChange={(e) => setDestMode(e.target.value)}>
              <option value="team">Team</option>
              <option value="single">1 agente</option>
              <option value="multi">multi</option>
            </select>

            {destMode === "single" ? (
              <select style={styles.select} value={destSingle} onChange={(e) => setDestSingle(e.target.value)}>
                {agents.map(a => <option key={a.id} value={a.id}>{a.name}{a.is_default ? " (default)" : ""}</option>)}
              </select>
            ) : null}

            {destMode === "multi" ? (
              <select style={styles.select} value="choose" onChange={() => {}}>
                <option value="choose">Selecionar no envio...</option>
              </select>
            ) : null}
          </div>
        </div>

        {/* Messages */}
        <div style={styles.chatArea}>
          {messages.length === 0 ? (
            <div style={{ color: "rgba(255,255,255,0.55)", fontSize: "14px", padding: "8px" }}>
              Nenhuma mensagem ainda. Você pode chamar múltiplos agentes com <b>@Team</b> ou usar o seletor acima.
            </div>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                style={{
                  ...styles.messageRow,
                  justifyContent: m.role === "user" ? "flex-end" : (m.role === "system" ? "center" : "flex-start"),
                }}
              >
                {/* PATCH0100_14: Agent avatar */}
                {m.role === "assistant" && lastAgentInfo?.avatar_url && (
                  <div style={{ marginRight: 8, flexShrink: 0, alignSelf: "flex-start", marginTop: 4 }}>
                    <img
                      src={lastAgentInfo.avatar_url}
                      alt={m.agent_name || "Agent"}
                      style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(255,255,255,0.15)" }}
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  </div>
                )}
                <div
                  style={{
                    ...styles.messageBubble,
                    ...(m.role === "user"
                      ? styles.userBubble
                      : m.role === "system"
                      ? styles.systemBubble
                      : styles.agentBubble),
                  }}
                >
                  {(() => {
                    const evt = tryParseEvent(m.content);
                    const isUser = m.role === "user";
                    const isSystem = m.role === "system";
                    const name = isUser
                      ? (m.user_name || meName)
                      : (m.agent_name || (isSystem ? "Sistema" : "Agente"));
                    const nameTone = isUser ? styles.nameUser : isSystem ? styles.nameSystem : styles.nameAgent;
                    const created = formatDateTime(m.created_at);
                    const visible = stripEventMarker(m.content);

                    return (
                      <>
                        <div style={styles.bubbleHeaderRow}>
                          <div style={{ ...styles.bubbleHeaderName, ...nameTone }}>{name}</div>
                          <div style={styles.bubbleHeaderTime}>{created}</div>
                        </div>

                        {evt && evt.type === "file_upload" ? (
                          <div style={styles.messageContent}>
                            <div style={{ fontWeight: 900 }}>📎 Upload registrado</div>
                            <div style={{ marginTop: 6 }}>{evt.filename || "arquivo"}</div>
                            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.78 }}>
                              {evt.text || `por ${evt.uploader_name || evt.uploader_email || "Usuário"} • ${formatTs(evt.ts || evt.created_at)}`}
                            </div>
                          </div>
                        ) : (
                          <div style={styles.messageContent}>
                            {visible || m.content}
                            {!isUser && !isSystem && (visible || m.content) && (
                              <button
                                onClick={() => playTts((visible || m.content), (m.agent_id || null), { messageId: m.id || null })}
                                style={{ marginLeft: "8px", background: "none", border: "none", cursor: "pointer", opacity: 0.6, fontSize: "14px", padding: "2px" }}
                                title="Ouvir esta mensagem"
                              >
                                🔊
                              </button>
                            )}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* V2V-PATCH: status panel por fase */}
        {v2vPhase && (
          <div style={{
            padding: "6px 14px", margin: "4px 0",
            borderRadius: "6px", fontSize: "12px", fontWeight: 500,
            background: v2vPhase === 'error' ? "rgba(192,57,43,0.15)" : "rgba(10,126,140,0.12)",
            color: v2vPhase === 'error' ? "#e74c3c" : "#0A7E8C",
            border: `1px solid ${v2vPhase === 'error' ? "rgba(192,57,43,0.3)" : "rgba(10,126,140,0.25)"}`,
            display: "flex", alignItems: "center", gap: "8px",
          }}>
            <span>{
              v2vPhase === 'recording' ? "🔴 Gravando..." :
              v2vPhase === 'stt'       ? "⚙️ Transcrevendo fala..." :
              v2vPhase === 'chat'      ? "🤖 Gerando resposta..." :
              v2vPhase === 'tts'       ? "🔊 Sintetizando voz..." :
              v2vPhase === 'playing'   ? "🔈 Reproduzindo..." :
              v2vPhase === 'error'     ? `❌ ${v2vError || "Erro no V2V"}` :
              "⏳ Aguardando..."
            }</span>
            {v2vPhase === 'error' && (
              <button onClick={() => { setV2vPhase(null); setV2vError(null); }}
                style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#e74c3c", fontSize: "14px" }}>
                ✕
              </button>
            )}
          </div>
        )}
        {uploadStatus ? <div style={styles.uploadStatus}>{uploadStatus}</div> : null}

        {/* Composer */}
        <div style={styles.composerContainer}>
          <div style={styles.composer}>
            <input
              type="file"
              ref={fileInputRef}
              onChange={onPickFile}
              accept=".pdf,.docx,.doc,.txt,.md"
              style={{ display: "none" }}
            />

            <button
              style={styles.attachBtn}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadProgress}
              title="Anexar arquivo (PDF, DOCX, TXT)"
            >
              <IconPaperclip />
            </button>

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite sua mensagem..."
              style={styles.textarea}
              rows={1}
              disabled={sending}
            />

            <button style={styles.micBtn} onClick={toggleMic} title={speechSupported ? "Ditado por voz (manual)" : "Não suportado"}>
              🎙️
            </button>

            <button
              style={{
                ...styles.micBtn,
                background: voiceMode ? "rgba(255,80,80,0.25)" : "rgba(255,255,255,0.05)",
                border: voiceMode ? "1px solid rgba(255,80,80,0.4)" : "1px solid rgba(255,255,255,0.1)",
                position: "relative",
              }}
              onClick={toggleVoiceMode}
              title={voiceMode ? "Desativar Modo Voz" : "Ativar Modo Voz (conversação por voz)"}
            >
              {ttsPlaying ? (
                <span style={{ fontSize: "16px", animation: "pulse 1s infinite" }}>🔊</span>
              ) : voiceMode ? (
                <span style={{ fontSize: "16px" }}>🗣️</span>
              ) : (
                <span style={{ fontSize: "16px" }}>🌐</span>
              )}
              {voiceMode && <span style={{ position: "absolute", top: "-2px", right: "-2px", width: "8px", height: "8px", borderRadius: "50%", background: "#ff5050", animation: "pulse 1.5s infinite" }} />}
            </button>

            <button
              style={{
                ...styles.micBtn,
                background: realtimeMode ? "rgba(80,160,255,0.25)" : "rgba(255,255,255,0.05)",
                border: realtimeMode ? "1px solid rgba(80,160,255,0.5)" : "1px solid rgba(255,255,255,0.1)",
                position: "relative",
              }}
              onClick={toggleRealtimeMode}
              title={realtimeMode ? "Desativar Realtime (WebRTC)" : "Ativar Realtime (WebRTC) — latência mínima"}
            >
              <span style={{ fontSize: "16px" }}>⚡</span>
              {realtimeMode && <span style={{ position: "absolute", top: "-2px", right: "-2px", width: "8px", height: "8px", borderRadius: "50%", background: "#50a0ff", animation: "pulse 1.5s infinite" }} />}
            
            {realtimeMode && (
              <button
                style={{
                  ...styles.sendBtn,
                  opacity: rtcReadyToRespond ? 1 : 0.5,
                  cursor: rtcReadyToRespond ? "pointer" : "not-allowed",
                }}
                onClick={() => rtcReadyToRespond && triggerRealtimeResponse("manual")}
                disabled={!rtcReadyToRespond}
                title={rtcReadyToRespond ? "Responder (Realtime) — Space/Enter" : "Aguardando fala finalizar"}
              >
                ▶️
              </button>
            )}

</button>

            <button style={styles.sendBtn} onClick={sendMessage} disabled={sending} title="Enviar">
              <IconSend />
            </button>
          </div>

          {/* Voice Mode controls — PATCH0100_14 enhanced */}
          {voiceMode && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "4px 8px", fontSize: "12px", color: "rgba(255,255,255,0.7)", flexWrap: "wrap" }}>
              {lastAgentInfo?.avatar_url && (
                <img src={lastAgentInfo.avatar_url} alt="" style={{ width: 24, height: 24, borderRadius: "50%", objectFit: "cover" }} onError={(e) => { e.target.style.display = 'none'; }} />
              )}
              {lastAgentInfo?.agent_name && <span style={{ fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>{lastAgentInfo.agent_name}</span>}
              <span>🔊 Voz:</span>
              <select
                value={ttsVoice}
                onChange={(e) => changeTtsVoice(e.target.value)}
                style={{ ...styles.select, padding: "4px 8px", fontSize: "11px" }}
              >
                <option value="auto">Auto (voz do agente)</option>
                {ORKIO_VOICES.map(v => (
                  <option key={v.id} value={v.id}>{v.label}</option>
                ))}
</select>
              {ttsPlaying && (
                <button
                  onClick={stopTts}
                  style={{ ...styles.btn, padding: "4px 8px", fontSize: "11px" }}
                >
                  ⏹ Parar
                </button>
              )}
              <span style={{ opacity: 0.6 }}>
                {micEnabled ? "🔴 Ouvindo..." : ttsPlaying ? "🔊 Falando..." : "⏸ Aguardando"}
              </span>
            </div>
          )}

          {/* PATCH0100_27_2B: Realtime Audit (finals + punctuação assíncrona) */}
          {(rtcAuditEvents?.length > 0 || rtcPunctStatus) && (
            <div style={styles.realtimeAudit}>
              <div style={styles.realtimeAuditHeader}>
                <div style={styles.realtimeAuditTitle}>🧾 Realtime (auditável)</div>
                <div style={styles.realtimeAuditPill}>
                  {rtcPunctStatus === 'pending' ? 'Pontuando…' : rtcPunctStatus === 'done' ? 'Pontuação OK' : rtcPunctStatus === 'timeout' ? 'Pontuação pendente' : 'Registro local'}
                </div>
              </div>
              {rtcAuditEvents.map((ev, idx) => {
                const who = ev?.role === 'user' ? 'Você' : (ev?.agent_name || 'Assistente');
                const when = ev?.created_at ? new Date(ev.created_at).toLocaleTimeString() : '';
                const text = (ev?.transcript_punct || ev?.content || '').toString();
                return (
                  <div key={(ev?.id || idx) + ''} style={styles.realtimeAuditItem}>
                    <div style={styles.realtimeAuditMeta}>
                      <div style={styles.realtimeAuditWho}>{who}</div>
                      <div style={{ opacity: 0.7 }}>{when}</div>
                    </div>
                    <div style={styles.realtimeAuditText}>{text}</div>
                  </div>
                );
              })}
              {rtcAuditEvents.length === 0 && <div style={{ opacity: 0.8 }}>Sem eventos finais ainda.</div>}
            </div>
          )}


          {destMode === "multi" ? (
            <div style={styles.hint}>
              Multi: selecione os agentes abaixo (será usado no próximo envio).
              <div style={styles.checkGrid}>
                {agents.map(a => (
                  <label key={a.id} style={styles.checkItem}>
                    <input
                      type="checkbox"
                      checked={destMulti.includes(a.id)}
                      onChange={(e) => {
                        setDestMulti(prev => e.target.checked ? [...prev, a.id] : prev.filter(x => x !== a.id));
                      }}
                    />
                    <span>{a.name}</span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Upload Modal */}
      {uploadOpen ? (
        <div style={styles.modalBack} onClick={() => { if (!uploadProgress) setUploadOpen(false); }}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalTitle}>Upload: {uploadFileObj?.name || "arquivo"}</div>
            <div style={styles.hint}>Escolha como este documento será usado.</div>

            <div style={styles.radioRow}>
              <input type="radio" checked={uploadScope === "thread"} onChange={() => setUploadScope("thread")} />
              <span>Somente nesta conversa (contexto do thread)</span>
            </div>

            <div style={styles.radioRow}>
              <input type="radio" checked={uploadScope === "agents"} onChange={() => setUploadScope("agents")} />
              <span>Vincular a agente(s) específico(s)</span>
            </div>

            {uploadScope === "agents" ? (
              <div style={styles.checkGrid}>
                {agents.map(a => (
                  <label key={a.id} style={styles.checkItem}>
                    <input
                      type="checkbox"
                      checked={uploadAgentIds.includes(a.id)}
                      onChange={(e) => {
                        setUploadAgentIds(prev => e.target.checked ? [...prev, a.id] : prev.filter(x => x !== a.id));
                      }}
                    />
                    <span>{a.name}</span>
                  </label>
                ))}
              </div>
            ) : null}

            <div style={styles.radioRow}>
              <input type="radio" checked={uploadScope === "institutional"} onChange={() => setUploadScope("institutional")} />
              <span>Institucional (global do tenant → todos os agentes)</span>
            </div>
            <div style={styles.hint}>
              {isAdmin(user)
                ? "Como admin, o documento vira institucional imediatamente."
                : "Como usuário, isso vira uma SOLICITAÇÃO para o admin aprovar/reprovar. Enquanto isso, ele fica disponível nesta conversa."}
            </div>

            <div style={styles.modalActions}>
              <button style={styles.btn} onClick={() => { if (!uploadProgress) setUploadOpen(false); }}>Cancelar</button>
              <button style={{ ...styles.btn, ...styles.btnPrimary, opacity: uploadProgress ? 0.7 : 1 }} onClick={confirmUpload} disabled={uploadProgress}>
                {uploadProgress ? "Enviando..." : "Enviar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
