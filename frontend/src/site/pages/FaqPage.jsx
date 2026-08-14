import { Link } from "react-router-dom";
import { useT } from "../../context/localeContextInstance";
import { FAQ_ITEMS } from "../faqData";
import JsonLd, { buildFaqLd } from "../JsonLd";

export default function FaqPage() {
  const t = useT();
  return (
    <>
      <JsonLd data={buildFaqLd(FAQ_ITEMS)} />
      <section className="mkt-section" style={{ marginTop: 12 }}>
        <h1>{t("FAQ")}</h1>
        <p className="lead">
          {t("Frequently asked questions about Descall — accounts, desktop download, calls, screen share, and privacy.")}
        </p>
        <div className="mkt-faq">
          {FAQ_ITEMS.map((item) => (
            <details key={item.q}>
              <summary>{t(item.q)}</summary>
              <p>{t(item.a)}</p>
            </details>
          ))}
        </div>
        <div className="mkt-cta-row" style={{ marginTop: 24 }}>
          <Link to="/contact" className="mkt-btn mkt-btn-soft">
            {t("Contact")}
          </Link>
        </div>
      </section>
    </>
  );
}
