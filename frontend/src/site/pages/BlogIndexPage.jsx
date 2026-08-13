import { Link } from "react-router-dom";
import SeoLandingShell from "../components/SeoLandingShell";
import { buildBreadcrumbLd } from "../JsonLd";
import { BLOG_POSTS } from "../content/discordSeoContent";
import { useT } from "../../context/localeContextInstance";

const crumbs = [
  { label: "Home", to: "/" },
  { label: "Blog", to: "/blog" },
];

export default function BlogIndexPage() {
  const t = useT();
  return (
    <SeoLandingShell
      breadcrumbs={crumbs}
      kicker="Blog"
      title={t("Descall blog — Discord alternatives & LFG")}
      lead={t(
        "Practical guides on Discord alternatives, Valorant LFG, voice chat, and moving friend groups to Descall."
      )}
      jsonLd={[buildBreadcrumbLd(crumbs)]}
    >
      <section className="seo-section">
        <div className="seo-blog-grid">
          {BLOG_POSTS.map((post) => (
            <article key={post.slug} className="seo-blog-card">
              <time dateTime={post.date}>{post.date}</time>
              <h2>
                <Link to={post.path}>{post.title}</Link>
              </h2>
              <p>{post.description}</p>
              <div className="seo-tags">
                {post.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </SeoLandingShell>
  );
}
