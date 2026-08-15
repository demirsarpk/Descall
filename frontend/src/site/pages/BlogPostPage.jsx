import { Link, useParams } from "react-router-dom";
import SeoLandingShell from "../components/SeoLandingShell";
import SeoRelatedLinks from "../components/SeoRelatedLinks";
import { buildArticleLd, buildBreadcrumbLd, buildFaqLd } from "../JsonLd";
import { BLOG_POSTS, BLOG_RELATED, BLOG_FAQ_BY_SLUG, GAMER_FAQ } from "../content/discordSeoContent";
import { BLOG_BODIES } from "../seo/blogBodies";
import { useT } from "../../context/localeContextInstance";
import NotFoundPage from "./NotFoundPage";

export default function BlogPostPage({ onSignIn }) {
  const { slug } = useParams();
  const t = useT();
  const post = BLOG_POSTS.find((p) => p.slug === slug);
  const body = BLOG_BODIES[slug];
  if (!post || !body) return <NotFoundPage />;

  const faq = BLOG_FAQ_BY_SLUG[slug] || GAMER_FAQ.slice(0, 2);
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
          dateModified: post.updated || post.date,
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
      <p className="seo-note">
        {t("Published")}: {post.date}
        {post.updated && post.updated !== post.date ? ` · ${t("Updated")}: ${post.updated}` : ""}
      </p>
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
