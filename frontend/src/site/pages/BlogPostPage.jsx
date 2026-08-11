import { Link, useParams } from "react-router-dom";
import SeoLandingShell from "../components/SeoLandingShell";
import SeoRelatedLinks from "../components/SeoRelatedLinks";
import { buildArticleLd, buildBreadcrumbLd, buildFaqLd } from "../JsonLd";
import { BLOG_POSTS, BLOG_RELATED, COMPARE_FAQ, GAMER_FAQ } from "../content/discordSeoContent";
import { BLOG_BODIES } from "../seo/blogBodies";
import { useT } from "../../context/LocaleContext";
import NotFoundPage from "./NotFoundPage";

const FAQ_BY_SLUG = {
  "discord-vs-descall": COMPARE_FAQ,
  "best-discord-alternative-for-lfg": GAMER_FAQ,
  "leave-nitro-keep-voice-chat": COMPARE_FAQ.slice(0, 3),
  "best-discord-alternatives-2026": COMPARE_FAQ.slice(0, 4),
  "apps-like-discord": COMPARE_FAQ.slice(0, 3),
  "discord-competitors": COMPARE_FAQ.slice(0, 3),
  "discord-alternative-for-communities-guide": COMPARE_FAQ.slice(0, 3),
  "voice-chat-alternative-to-discord": GAMER_FAQ,
};

export default function BlogPostPage({ onSignIn }) {
  const { slug } = useParams();
  const t = useT();
  const post = BLOG_POSTS.find((p) => p.slug === slug);
  const body = BLOG_BODIES[slug];
  if (!post || !body) return <NotFoundPage />;

  const faq = FAQ_BY_SLUG[slug] || COMPARE_FAQ.slice(0, 3);
  const crumbs = [
    { label: "Home", to: "/" },
    { label: "Blog", to: "/blog" },
    { label: post.title, to: post.path },
  ];

  return (
    <SeoLandingShell
      breadcrumbs={crumbs}
      kicker={post.tags.join(" · ")}
      title={post.title}
      lead={post.description}
      faq={faq}
      jsonLd={[
        buildBreadcrumbLd(crumbs),
        buildFaqLd(faq),
        buildArticleLd({
          title: post.title,
          description: post.description,
          path: post.path,
          datePublished: post.date,
        }),
      ]}
      primaryCta={
        <button type="button" className="mkt-btn mkt-btn-primary" onClick={onSignIn}>
          {t("Try Descall")}
        </button>
      }
      secondaryCta={
        <Link to="/discord-alternative" className="mkt-btn mkt-btn-ghost">
          {t("Discord alternative")}
        </Link>
      }
    >
      {body.sections.map((s) => (
        <section className="seo-section" key={s.h}>
          <h2>{t(s.h)}</h2>
          <p>{t(s.p)}</p>
        </section>
      ))}
      <SeoRelatedLinks title="Related guides" links={BLOG_RELATED} />
      <section className="seo-section">
        <p className="seo-note">
          <Link to="/blog">{t("← Back to blog")}</Link>
        </p>
      </section>
    </SeoLandingShell>
  );
}
