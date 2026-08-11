/**
 * Lightweight rich-text renderer: autolinks, `inline code`, ```code blocks```, @mentions.
 * Keeps the wire format as plain strings.
 */
const URL_RE = /(https?:\/\/[^\s<]+[^\s<.,;:!?'")\]])/g;
const MENTION_RE = /@([a-zA-Z0-9_]{2,32})/g;

function renderInline(text, keyPrefix = "t") {
  if (!text) return null;
  const parts = [];
  let last = 0;
  const re = /(`[^`]+`)|(@[a-zA-Z0-9_]{2,32})|(https?:\/\/[^\s<]+[^\s<.,;:!?'")\]])/g;
  let m;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      parts.push(<span key={`${keyPrefix}-${i++}`}>{text.slice(last, m.index)}</span>);
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
      parts.push(
        <a
          key={`${keyPrefix}-${i++}`}
          className="msg-link"
          href={token}
          target="_blank"
          rel="noopener noreferrer"
        >
          {token}
        </a>
      );
    }
    last = m.index + token.length;
  }
  if (last < text.length) {
    parts.push(<span key={`${keyPrefix}-${i++}`}>{text.slice(last)}</span>);
  }
  return parts.length ? parts : text;
}

export default function MessageContent({ text }) {
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
            {renderInline(block, `i${idx}`)}
          </span>
        );
      })}
    </div>
  );
}

// silence unused lint for exported helpers used by tests / future
export { URL_RE, MENTION_RE };
