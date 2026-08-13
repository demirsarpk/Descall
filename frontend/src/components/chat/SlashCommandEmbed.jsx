import { Avatar } from "../ui/Avatar";

function colorToCss(color) {
  const n = Number(color);
  if (!Number.isFinite(n)) return "var(--primary)";
  const hex = Math.max(0, Math.min(0xffffff, n)).toString(16).padStart(6, "0");
  return `#${hex}`;
}

function renderInlineMarkdown(text) {
  const raw = String(text ?? "");
  if (!raw) return null;
  const parts = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let m;
  let i = 0;
  while ((m = re.exec(raw)) !== null) {
    if (m.index > last) parts.push(<span key={`t-${i++}`}>{raw.slice(last, m.index)}</span>);
    const token = m[0];
    if (token.startsWith("**")) {
      parts.push(<strong key={`b-${i++}`}>{token.slice(2, -2)}</strong>);
    } else {
      parts.push(
        <code key={`c-${i++}`} className="slash-embed-code">
          {token.slice(1, -1)}
        </code>
      );
    }
    last = m.index + token.length;
  }
  if (last < raw.length) parts.push(<span key={`t-${i++}`}>{raw.slice(last)}</span>);
  return parts.length ? parts : raw;
}

function FieldValue({ value }) {
  if (value && typeof value === "object" && value.kind === "user") {
    const label = value.displayName || value.username || "User";
    return (
      <span className="slash-embed-user">
        <Avatar
          name={label}
          size={18}
          user={{ id: value.id, username: value.username, avatarUrl: value.avatarUrl }}
          imageUrl={value.avatarUrl || undefined}
        />
        <span className="slash-embed-user-name">{label}</span>
        {value.username ? <span className="slash-embed-user-handle">@{value.username}</span> : null}
      </span>
    );
  }
  return <span className="slash-embed-field-value">{renderInlineMarkdown(value)}</span>;
}

/**
 * Discord-style rich embed for Descall Apps slash-command replies.
 */
export default function SlashCommandEmbed({ embed, type }) {
  if (!embed || typeof embed !== "object") return null;

  const accent = colorToCss(embed.color);
  const fields = Array.isArray(embed.fields) ? embed.fields : [];
  const thumbUrl = embed.thumbnail?.url || null;
  const imageUrl = embed.image?.url || null;
  const author = embed.author || null;
  const footer = embed.footer || null;

  return (
    <div className={`slash-embed slash-embed-${String(type || "app").replace(/[^\w-]/g, "")}`}>
      <div className="slash-embed-accent" style={{ background: accent }} aria-hidden />
      <div className="slash-embed-body">
        {author?.name ? (
          <div className="slash-embed-author">
            {author.iconUrl ? (
              <img src={author.iconUrl} alt="" className="slash-embed-author-icon" />
            ) : null}
            <span>{author.name}</span>
          </div>
        ) : null}

        <div className={`slash-embed-main${thumbUrl ? " has-thumb" : ""}`}>
          <div className="slash-embed-copy">
            {embed.title ? <h3 className="slash-embed-title">{embed.title}</h3> : null}
            {embed.description ? (
              <p className="slash-embed-desc">{renderInlineMarkdown(embed.description)}</p>
            ) : null}

            {fields.length ? (
              <div className="slash-embed-fields">
                {fields.map((f, idx) => (
                  <div
                    key={`${f?.name || "f"}-${idx}`}
                    className={`slash-embed-field${f?.inline === false ? " is-block" : ""}`}
                  >
                    <div className="slash-embed-field-name">{f?.name}</div>
                    <FieldValue value={f?.value} />
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {thumbUrl ? (
            <img src={thumbUrl} alt="" className="slash-embed-thumb" loading="lazy" />
          ) : null}
        </div>

        {imageUrl ? (
          <a
            className="slash-embed-image-wrap"
            href={imageUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <img src={imageUrl} alt="" className="slash-embed-image" loading="lazy" />
          </a>
        ) : null}

        {footer?.text ? (
          <div className="slash-embed-footer">
            {footer.iconUrl ? (
              <img src={footer.iconUrl} alt="" className="slash-embed-footer-icon" />
            ) : null}
            <span>{footer.text}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
