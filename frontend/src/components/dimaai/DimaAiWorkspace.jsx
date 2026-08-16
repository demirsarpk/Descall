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
  Search,
  Lightbulb,
  PenLine,
  ScanSearch,
  Wand2,
} from "lucide-react";
import { useLocale, useT } from "../../context/LocaleContext";
import {
  createDimaConversation,
  deleteDimaConversation,
  getDimaConversation,
  listDimaConversations,
  streamDimaMessage,
} from "../../api/dimaai";
import { renderDimaMarkdown } from "./dimaMarkdown";
import { formatRelTime, historyBucket } from "./historyUtils";

const SUGGESTIONS = [
  { id: "explain", prompt: "Explain this concept in simple terms: ", icon: Lightbulb },
  { id: "write", prompt: "Help me write a clear message about: ", icon: PenLine },
  { id: "analyze", prompt: "Analyze this and list the key takeaways:\n\n", icon: ScanSearch },
  { id: "brainstorm", prompt: "Brainstorm ideas for: ", icon: Wand2 },
];

function pinMobileViewport() {
  try {
    window.scrollTo(0, 0);
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
  } catch {
    /* ignore */
  }
}

function conversationIdFromPath(pathname) {
  const parts = String(pathname || "").split("/").filter(Boolean);
  if (parts[0] !== "dimaai") return null;
  return parts[1] || null;
}

function DimaBubble({ message, onCopy, onRegenerate, canRegenerate, copiedId, youLabel }) {
  const html = useMemo(
    () => (message.role === "assistant" ? renderDimaMarkdown(message.content || "") : ""),
    [message.content, message.role],
  );
  const isUser = message.role === "user";
  return (
    <article className={`dima-msg ${isUser ? "is-user" : "is-assistant"}`}>
      <div className="dima-msg-label">{isUser ? youLabel : "Dima 1.0"}</div>
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
  const { locale } = useLocale();
  const navigate = useNavigate();
  const location = useLocation();
  const activeId = conversationIdFromPath(location.pathname);

  const [history, setHistory] = useState([]);
  const [query, setQuery] = useState("");
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

  useEffect(() => {
    const el = inputRef.current;
    if (!el || !isMobile) return undefined;
    const onBlur = () => {
      window.setTimeout(pinMobileViewport, 40);
      window.setTimeout(pinMobileViewport, 280);
    };
    el.addEventListener("blur", onBlur);
    return () => el.removeEventListener("blur", onBlur);
  }, [isMobile]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 24), 148)}px`;
  }, [draft]);

  const groupedHistory = useMemo(() => {
    const q = query.trim().toLowerCase();
    const items = q
      ? history.filter((c) => String(c.title || "").toLowerCase().includes(q))
      : history;
    const buckets = { today: [], yesterday: [], previous: [] };
    for (const c of items) {
      buckets[historyBucket(c.updated_at || c.created_at)].push(c);
    }
    return buckets;
  }, [history, query]);

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
  const canSend = Boolean(draft.trim()) && !busy;
  const historySections = [
    ["today", groupedHistory.today],
    ["yesterday", groupedHistory.yesterday],
    ["previous", groupedHistory.previous],
  ];
  const historyEmpty = history.length === 0;
  const searchEmpty = !historyEmpty && historySections.every(([, items]) => items.length === 0);

  const renderHistoryItem = (c) => (
    <button
      key={c.id}
      type="button"
      className={`dima-history-item ${activeId === c.id ? "active" : ""}`}
      onClick={() => {
        navigate(`/dimaai/${c.id}`);
        if (isMobile) setMobileShowList(false);
      }}
    >
      <span className="dima-history-orb" aria-hidden="true">
        <MessageSquare size={14} />
      </span>
      <span className="dima-history-copy">
        <span className="dima-history-name">{c.title || t("dimaai.newChat")}</span>
        <span className="dima-history-time">
          {formatRelTime(c.updated_at || c.created_at, locale)}
        </span>
      </span>
      <span
        className="dima-history-del"
        role="button"
        tabIndex={0}
        onClick={(e) => onDelete(c.id, e)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onDelete(c.id, e);
        }}
        aria-label={t("common.delete")}
      >
        <Trash2 size={14} />
      </span>
    </button>
  );

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
            <div className="dima-history-brand">
              <span className="dima-kicker">DimaAI</span>
              <strong>{t("dimaai.history")}</strong>
            </div>
          </div>
        </div>

        <button type="button" className="dima-history-new" onClick={openNew}>
          <Plus size={16} />
          {t("dimaai.newChat")}
        </button>

        <label className="dima-history-search">
          <Search size={15} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("dimaai.search")}
            aria-label={t("dimaai.search")}
          />
        </label>

        <div className="dima-history-list">
          {historyEmpty && (
            <div className="dima-history-empty">
              <Sparkles size={18} />
              <p>{t("dimaai.noHistory")}</p>
            </div>
          )}
          {searchEmpty && <p className="dima-muted">{t("dimaai.noSearch")}</p>}
          {historySections.map(([key, items]) =>
            items.length ? (
              <div key={key} className="dima-history-group">
                <h3>{t(`dimaai.group.${key}`)}</h3>
                {items.map(renderHistoryItem)}
              </div>
            ) : null,
          )}
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
            <p>Dima 1.0{title ? ` · ${title}` : ` · ${t("dimaai.taglineShort")}`}</p>
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
                {SUGGESTIONS.map((s) => {
                  const Icon = s.icon;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      className="dima-chip"
                      onClick={() => {
                        setDraft(s.prompt);
                        inputRef.current?.focus();
                      }}
                    >
                      <span className="dima-chip-icon" aria-hidden="true">
                        <Icon size={16} />
                      </span>
                      <span>{t(`dimaai.suggest.${s.id}`)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="dima-thread">
              {messages.map((m) => (
                <DimaBubble
                  key={m.id}
                  message={m}
                  copiedId={copiedId}
                  youLabel={t("common.you")}
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

        <div className="dima-dock">
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
              enterKeyHint="send"
              onFocus={() => {
                if (!isMobile) return;
                pinMobileViewport();
                requestAnimationFrame(() => {
                  pinMobileViewport();
                  const scroller = scrollerRef.current;
                  if (scroller) scroller.scrollTop = scroller.scrollHeight;
                });
              }}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(draft);
                }
              }}
            />
            <div className="dima-composer-bar">
              <span className="dima-composer-hint">{t("dimaai.composerHint")}</span>
              {busy ? (
                <button type="button" className="dima-send is-stop" onClick={stop} aria-label={t("dimaai.stop")}>
                  <Square size={15} />
                </button>
              ) : (
                <button
                  type="submit"
                  className={`dima-send${canSend ? " is-ready" : ""}`}
                  disabled={!canSend}
                  aria-label={t("common.send")}
                >
                  <Send size={16} />
                </button>
              )}
            </div>
          </form>
          <p className="dima-foot">{t("dimaai.disclaimer")}</p>
        </div>
      </div>
    </section>
  );
}
