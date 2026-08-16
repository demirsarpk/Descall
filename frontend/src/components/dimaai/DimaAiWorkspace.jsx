import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Sparkles,
  Plus,
  Send,
  Square,
  Copy,
  Check,
  RefreshCw,
  Trash2,
  ArrowLeft,
  MessageSquare,
} from "lucide-react";
import { useT } from "../../context/LocaleContext";
import {
  createDimaConversation,
  deleteDimaConversation,
  getDimaConversation,
  listDimaConversations,
  streamDimaMessage,
} from "../../api/dimaai";
import { renderDimaMarkdown } from "./dimaMarkdown";

const SUGGESTIONS = [
  { id: "explain", prompt: "Explain this concept in simple terms: " },
  { id: "write", prompt: "Help me write a clear message about: " },
  { id: "analyze", prompt: "Analyze this and list the key takeaways:\n\n" },
  { id: "brainstorm", prompt: "Brainstorm ideas for: " },
];

function conversationIdFromPath(pathname) {
  const parts = String(pathname || "").split("/").filter(Boolean);
  if (parts[0] !== "dimaai") return null;
  return parts[1] || null;
}

function DimaBubble({ message, onCopy, onRegenerate, canRegenerate, copiedId }) {
  const html = useMemo(
    () => (message.role === "assistant" ? renderDimaMarkdown(message.content || "") : ""),
    [message.content, message.role],
  );
  const isUser = message.role === "user";
  return (
    <article className={`dima-msg ${isUser ? "is-user" : "is-assistant"}`}>
      <div className="dima-msg-label">{isUser ? "You" : "Dima 1.0"}</div>
      {isUser ? (
        <div className="dima-msg-body">{message.content}</div>
      ) : (
        <div className="dima-msg-body dima-md" dangerouslySetInnerHTML={{ __html: html }} />
      )}
      <div className="dima-msg-actions">
        <button type="button" className="dima-icon-btn" onClick={() => onCopy(message)} aria-label="Copy">
          {copiedId === (message.id || message._tmp) ? <Check size={14} /> : <Copy size={14} />}
        </button>
        {!isUser && canRegenerate && (
          <button type="button" className="dima-icon-btn" onClick={onRegenerate} aria-label="Regenerate">
            <RefreshCw size={14} />
          </button>
        )}
      </div>
    </article>
  );
}

export default function DimaAiWorkspace({ me, isMobile, onClose }) {
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const activeId = conversationIdFromPath(location.pathname);

  const [history, setHistory] = useState([]);
  const [messages, setMessages] = useState([]);
  const [title, setTitle] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState(null);
  const [mobileShowList, setMobileShowList] = useState(
    () => !!isMobile && !conversationIdFromPath(typeof window !== "undefined" ? window.location.pathname : ""),
  );
  const abortRef = useRef(null);
  const scrollerRef = useRef(null);
  const inputRef = useRef(null);

  const loadHistory = useCallback(async () => {
    try {
      const data = await listDimaConversations();
      setHistory(data.conversations || []);
    } catch {
      /* keep previous */
    }
  }, []);

  const loadConversation = useCallback(async (id) => {
    if (!id) {
      setMessages([]);
      setTitle("");
      return;
    }
    try {
      const data = await getDimaConversation(id);
      setMessages(data.messages || []);
      setTitle(data.conversation?.title || "");
      setError("");
    } catch (err) {
      setError(err.message || t("dimaai.unavailable"));
    }
  }, [t]);

  useEffect(() => {
    document.title = "DimaAI — Dima 1.0";
    const meta = document.querySelector('meta[name="description"]');
    const prev = meta?.getAttribute("content");
    if (meta) meta.setAttribute("content", "Dima 1.0 — AI assistant inside Descall.");
    loadHistory();
    return () => {
      document.title = "Descall";
      if (meta && prev) meta.setAttribute("content", prev);
    };
  }, [loadHistory]);

  useEffect(() => {
    if (isMobile && activeId) setMobileShowList(false);
  }, [isMobile, activeId]);

  useEffect(() => {
    if (busy) return;
    loadConversation(activeId);
  }, [activeId, loadConversation, busy]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
  };

  const openNew = () => {
    stop();
    setMessages([]);
    setTitle("");
    setDraft("");
    setError("");
    navigate("/dimaai");
    if (isMobile) setMobileShowList(false);
    inputRef.current?.focus();
  };

  const goHome = () => {
    if (onClose) onClose();
    else navigate("/direct");
  };

  const backToList = () => {
    setMobileShowList(true);
  };

  const send = async (text, { regenerate = false } = {}) => {
    const content = String(text || draft).trim();
    if (!content && !regenerate) return;
    if (busy) return;
    setError("");
    setBusy(true);

    let conversationId = activeId;
    try {
      if (!conversationId) {
        const created = await createDimaConversation(content);
        conversationId = created.conversation.id;
        navigate(`/dimaai/${conversationId}`, { replace: true });
        setHistory((prev) => [created.conversation, ...prev.filter((c) => c.id !== conversationId)]);
        setTitle(created.conversation.title);
      }

      if (!regenerate) {
        const userMsg = {
          id: `tmp-user-${Date.now()}`,
          role: "user",
          content,
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, userMsg]);
        setDraft("");
      }

      const tmpId = `tmp-ai-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        { id: tmpId, _tmp: tmpId, role: "assistant", content: "", streaming: true },
      ]);

      const controller = new AbortController();
      abortRef.current = controller;
      const result = await streamDimaMessage({
        conversationId,
        content,
        regenerate,
        signal: controller.signal,
        onToken: (_chunk, assembled) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === tmpId ? { ...m, content: assembled } : m)),
          );
        },
      });

      setMessages((prev) =>
        prev.map((m) =>
          m.id === tmpId
            ? { ...(result || m), streaming: false, content: result?.content || m.content }
            : m,
        ),
      );
      await loadHistory();
    } catch (err) {
      if (err?.name === "AbortError") {
        setMessages((prev) => prev.filter((m) => !m.streaming || (m.content || "").trim()));
      } else {
        setError(err.message || t("dimaai.unavailable"));
        setMessages((prev) => prev.filter((m) => !(m.streaming && !(m.content || "").trim())));
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  };

  const onCopy = async (message) => {
    try {
      await navigator.clipboard.writeText(message.content || "");
      setCopiedId(message.id || message._tmp);
      setTimeout(() => setCopiedId(null), 1200);
    } catch {
      /* ignore */
    }
  };

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant" && !m.streaming);

  const onDelete = async (id, event) => {
    event?.stopPropagation();
    try {
      await deleteDimaConversation(id);
      setHistory((prev) => prev.filter((c) => c.id !== id));
      if (activeId === id) openNew();
    } catch (err) {
      setError(err.message || t("dimaai.unavailable"));
    }
  };

  const empty = messages.length === 0 && !busy;
  const showChatPane = !isMobile || !mobileShowList;

  return (
    <section
      className={`dima-workspace${showChatPane && isMobile ? " is-chat" : ""}`}
      data-dimaai="1"
    >
      <aside className="dima-history">
        <div className="dima-history-head">
          <div className="dima-history-title">
            {onClose && (
              <button
                type="button"
                className="dima-back-btn"
                onClick={goHome}
                title={t("Back to Descall")}
                aria-label={t("Back to Descall")}
              >
                <ArrowLeft size={18} />
                <span className="dima-back-label">{t("nav.chats")}</span>
              </button>
            )}
            <strong>{t("dimaai.history")}</strong>
          </div>
          <button type="button" className="dima-icon-btn" onClick={openNew} aria-label={t("dimaai.newChat")}>
            <Plus size={16} />
          </button>
        </div>
        <div className="dima-history-list">
          {history.length === 0 && <p className="dima-muted">{t("dimaai.noHistory")}</p>}
          {history.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`dima-history-item ${activeId === c.id ? "active" : ""}`}
              onClick={() => {
                navigate(`/dimaai/${c.id}`);
                if (isMobile) setMobileShowList(false);
              }}
            >
              <MessageSquare size={14} />
              <span>{c.title || t("dimaai.newChat")}</span>
              <span
                className="dima-history-del"
                role="button"
                tabIndex={0}
                onClick={(e) => onDelete(c.id, e)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onDelete(c.id, e);
                }}
              >
                <Trash2 size={12} />
              </span>
            </button>
          ))}
        </div>
      </aside>

      <div className="dima-main">
        <header className="dima-topbar">
          {isMobile && (
            <button
              type="button"
              className="dima-back-btn"
              onClick={backToList}
              aria-label={t("common.back")}
            >
              <ArrowLeft size={18} />
              <span className="dima-back-label">{t("dimaai.history")}</span>
            </button>
          )}
          <div className="dima-brand-mark" aria-hidden="true">
            <Sparkles size={18} />
          </div>
          <div className="dima-topbar-text">
            <h1>DimaAI</h1>
            <p>Dima 1.0{title ? ` · ${title}` : ""}</p>
          </div>
          <button type="button" className="dima-new-btn" onClick={openNew}>
            <Plus size={14} /> {t("dimaai.newChat")}
          </button>
        </header>

        <div className="dima-scroll" ref={scrollerRef}>
          {empty ? (
            <div className="dima-welcome">
              <div className="dima-welcome-orb">
                <Sparkles size={28} />
              </div>
              <h2>Dima 1.0</h2>
              <p>{t("dimaai.tagline")}</p>
              <div className="dima-suggestions">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="dima-chip"
                    onClick={() => {
                      setDraft(s.prompt);
                      inputRef.current?.focus();
                    }}
                  >
                    {t(`dimaai.suggest.${s.id}`)}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="dima-thread">
              {messages.map((m) => (
                <DimaBubble
                  key={m.id}
                  message={m}
                  copiedId={copiedId}
                  onCopy={onCopy}
                  canRegenerate={!busy && lastAssistant?.id === m.id}
                  onRegenerate={() => send(m.content, { regenerate: true })}
                />
              ))}
              {busy && messages[messages.length - 1]?.streaming && !messages[messages.length - 1]?.content && (
                <div className="dima-typing" aria-live="polite">
                  <span />
                  <span />
                  <span />
                </div>
              )}
            </div>
          )}
        </div>

        {error && <div className="dima-error" role="alert">{error}</div>}

        <form
          className="dima-composer"
          onSubmit={(e) => {
            e.preventDefault();
            send(draft);
          }}
        >
          <textarea
            ref={inputRef}
            className="dima-input"
            rows={1}
            value={draft}
            placeholder={t("dimaai.placeholder")}
            disabled={busy}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(draft);
              }
            }}
          />
          {busy ? (
            <button type="button" className="dima-send is-stop" onClick={stop} aria-label={t("dimaai.stop")}>
              <Square size={16} />
            </button>
          ) : (
            <button type="submit" className="dima-send" disabled={!draft.trim()} aria-label={t("common.send")}>
              <Send size={16} />
            </button>
          )}
        </form>
        <p className="dima-foot">{t("dimaai.disclaimer")}</p>
      </div>
    </section>
  );
}
