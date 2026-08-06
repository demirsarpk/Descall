import { useT } from "../../context/LocaleContext";

const GITHUB = "https://github.com/demirrsarppkurtlarr/Descall";

export default function ContactPage() {
  const t = useT();
  return (
    <section className="mkt-section mkt-prose" style={{ marginTop: 12 }}>
      <h2>{t("Contact")}</h2>
      <p className="lead">
        {t("Get in touch with the Descall team — support, feedback, and press.")}
      </p>
      <h3>{t("Support & feedback")}</h3>
      <p>
        {t("Open an issue or discussion on GitHub:")}{" "}
        <a href={GITHUB} target="_blank" rel="noopener noreferrer">
          {GITHUB.replace("https://", "")}
        </a>
      </p>
      <h3>{t("Security")}</h3>
      <p>
        {t("Report suspected vulnerabilities privately via GitHub security advisories when available, or mark issues clearly as security-related.")}
      </p>
    </section>
  );
}
