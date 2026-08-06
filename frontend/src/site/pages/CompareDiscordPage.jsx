import { Link } from "react-router-dom";
import { useT } from "../../context/LocaleContext";

const ROWS = [
  { feature: "Real-time chat", descall: "Yes", discord: "Yes" },
  { feature: "Group voice & video", descall: "Yes", discord: "Yes" },
  { feature: "Screen share", descall: "Yes", discord: "Yes" },
  { feature: "Desktop app", descall: "Windows + web", discord: "All major platforms" },
  { feature: "Servers / communities", descall: "Groups-focused", discord: "Servers & channels" },
  { feature: "Price", descall: "Free", discord: "Free + Nitro" },
];

export default function CompareDiscordPage() {
  const t = useT();
  return (
    <section className="mkt-section" style={{ marginTop: 12 }}>
      <h2>Descall vs Discord</h2>
      <p className="lead">
        {t(
          "Compare Descall and Discord for chat, voice, video, and screen share — a lighter alternative for friends and groups."
        )}
      </p>
      <table className="mkt-table">
        <thead>
          <tr>
            <th>{t("Features")}</th>
            <th>Descall</th>
            <th>Discord</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => (
            <tr key={row.feature}>
              <td>{t(row.feature)}</td>
              <td>{t(row.descall)}</td>
              <td>{t(row.discord)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mkt-cta-row" style={{ marginTop: 28 }}>
        <Link to="/download" className="mkt-btn mkt-btn-primary">
          {t("Download")} Descall
        </Link>
        <Link to="/features" className="mkt-btn mkt-btn-ghost">
          {t("Features")}
        </Link>
      </div>
    </section>
  );
}
