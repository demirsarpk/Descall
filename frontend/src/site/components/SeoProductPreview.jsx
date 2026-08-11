/**
 * Lightweight product UI preview for SEO landings (first-viewport trust).
 * Decorative structure mirrors real Descall surfaces without shipping screenshots yet.
 */
export default function SeoProductPreview({
  caption = "Descall — chat, voice, and LFG in one lighter app",
}) {
  return (
    <figure className="seo-product-preview" aria-label={caption}>
      <div className="seo-product-preview-frame" role="img" aria-label={caption}>
        <div className="seo-pp-rail" aria-hidden>
          <span />
          <span className="is-active" />
          <span />
          <span />
        </div>
        <div className="seo-pp-list" aria-hidden>
          <div className="seo-pp-list-title">Friends</div>
          <div className="seo-pp-row is-online" />
          <div className="seo-pp-row is-online" />
          <div className="seo-pp-row" />
          <div className="seo-pp-row is-online" />
        </div>
        <div className="seo-pp-main" aria-hidden>
          <div className="seo-pp-chat">
            <div className="seo-pp-bubble" />
            <div className="seo-pp-bubble is-mine" />
            <div className="seo-pp-bubble" />
          </div>
          <div className="seo-pp-call">
            <div className="seo-pp-avatar" />
            <div className="seo-pp-avatar" />
            <div className="seo-pp-controls">
              <i />
              <i />
              <i className="is-danger" />
            </div>
          </div>
        </div>
      </div>
      <figcaption>{caption}</figcaption>
    </figure>
  );
}
