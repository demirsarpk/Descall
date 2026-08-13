/**
 * Lightweight rich-text renderer: autolinks, `inline code`, ```code blocks```, @mentions.
 * Keeps the wire format as plain strings.
 */
import { splitHighlightRanges } from "../../lib/textHighlight";
import { isDescallInviteUrl, parseDescallInviteUrl, isVanityServerInvite, vanitySlugFromInviteCode } from "../../lib/inviteLinks";

const URL_RE =
  /((?:https?:\/\/|(?:www\.)?descall\.(?:com|vercel\.app)\/|des-call\.onrender\.com\/)[^\s<]+[^\s<.,;:!?'")\]])/g;
const MENTION_RE = /@([a-zA-Z0-9_]{2,32})/g;

function inviteLinkLabel(href) {
  const parsed = parseDescallInviteUrl(href);
  if (!parsed) return href;
  if (parsed.kind === "server") {
    if (isVanityServerInvite(parsed)) {
      return `descall.com/s/${vanitySlugFromInviteCode(parsed.code)}`;
    }
    return `descall.com/servers/join/${parsed.code}`;
  }
  if (parsed.kind === "group") return `descall.com/invite/${parsed.code}`;
  if (parsed.kind === "friend") return `descall.com/register?ref=${parsed.username || parsed.code}`;
  return href;
}

/** Wrap case-insensitive matches of `needle` inside plain text with <mark>. */
function highlightPlain(value, needle, keyPrefix) {
  if (!needle) return value;
  const segments = splitHighlightRanges(value, needle);
  if (segments.length <= 1 && !segments[0]?.isMatch) return value;
  return segments.map((segment, idx) =>
    segment.isMatch ? (
      <mark key={`${keyPrefix}-hl-${idx}`} className="msg-search-hit">{segment.text}</mark>
    ) : (
      <span key={`${keyPrefix}-hl-${idx}`}>{segment.text}</span>
    )
  );
}

function renderInline(text, keyPrefix = "t", highlight = "") {
  if (!text) return null;
  const parts = [];
  let last = 0;
  const re =
    /(`[^`]+`)|(@[a-zA-Z0-9_]{2,32})|((?:https?:\/\/|(?:www\.)?descall\.(?:com|vercel\.app)\/|des-call\.onrender\.com\/)[^\s<]+[^\s<.,;:!?'")\]])/g;
  let m;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      parts.push(<span key={`${keyPrefix}-${i++}`}>{highlightPlain(text.slice(last, m.index), highlight, `${keyPrefix}-${i}`)}</span>);
    }
    const token = m[0];
    if (token.startsWith("`")) {
      parts.push(
        <code key={`${keyPrefix}-${i++}`} className="msg-inline-code">
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("@")) {
      parts.push(
        <span key={`${keyPrefix}-${i++}`} className="msg-mention">
          {token}
        </span>
      );
    } else {
      const isInvite = isDescallInviteUrl(token);
      const href = /^https?:\/\//i.test(token) ? token : `https://${token.replace(/^\/\//, "")}`;
      parts.push(
        <a
          key={`${keyPrefix}-${i++}`}
          className={isInvite ? "msg-link msg-link-invite" : "msg-link"}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
        >
          {isInvite ? inviteLinkLabel(token) : token}
        </a>
      );
    }
    last = m.index + token.length;
  }
  if (last < text.length) {
    parts.push(<span key={`${keyPrefix}-${i++}`}>{highlightPlain(text.slice(last), highlight, `${keyPrefix}-${i}`)}</span>);
  }
  return parts.length ? parts : highlightPlain(text, highlight, keyPrefix);
}

export default function MessageContent({ text, highlight = "" }) {
  if (!text) return null;

  const blocks = text.split(/(```[\s\S]*?```)/g);

  return (
    <div className="message-text">
      {blocks.map((block, idx) => {
        if (block.startsWith("```") && block.endsWith("```")) {
          const inner = block.slice(3, -3).replace(/^\n/, "").replace(/\n$/, "");
          return (
            <pre key={`code-${idx}`} className="msg-code-block">
              <code>{inner}</code>
            </pre>
          );
        }
        return (
          <span key={`p-${idx}`} className="msg-text-chunk">
            {renderInline(block, `i${idx}`, highlight)}
          </span>
        );
      })}
    </div>
  );
}

// silence unused lint for exported helpers used by tests / future
export { URL_RE, MENTION_RE };
