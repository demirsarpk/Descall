import { useLocale } from "../../context/LocaleContext";
import { PRIVACY_CONTENT } from "../../legal/legalContent";

export default function PrivacyPage() {
  const { locale } = useLocale();
  const data = PRIVACY_CONTENT[locale] || PRIVACY_CONTENT.en;

  return (
    <section className="mkt-section mkt-prose" style={{ marginTop: 12 }}>
      <h2>{data.title}</h2>
      <p className="lead">{data.updated}</p>
      <p>{data.intro}</p>
      {data.sections.map((section) => (
        <div key={section.heading}>
          <h3>{section.heading}</h3>
          {section.paragraphs.map((paragraph, idx) => (
            <p key={idx}>{paragraph}</p>
          ))}
        </div>
      ))}
    </section>
  );
}
