import { Link, useParams } from "react-router-dom";
import SeoLandingShell from "../components/SeoLandingShell";
import { buildArticleLd, buildBreadcrumbLd, buildFaqLd } from "../JsonLd";
import { BLOG_POSTS, COMPARE_FAQ, GAMER_FAQ } from "../content/discordSeoContent";
import { useT } from "../../context/LocaleContext";
import NotFoundPage from "./NotFoundPage";

const BODIES = {
  "discord-vs-descall": {
    faq: COMPARE_FAQ,
    sections: [
      {
        h: "The short answer",
        p: "Pick Descall when your group wants a lighter Discord alternative for chat, voice, screen share, and LFG. Keep Discord when you still run large public communities and bots.",
      },
      {
        h: "Chat & presence",
        p: "Both apps deliver real-time messaging. Descall focuses on DMs, groups, and clear presence — less server administration for friend circles.",
      },
      {
        h: "Voice, video & screen share",
        p: "Descall uses modern WebRTC with TURN support and screen-share quality presets. Discord remains battle-tested at massive scale; Descall optimizes for squad-sized calls.",
      },
      {
        h: "Pricing philosophy",
        p: "Descall keeps communication free and sells cosmetics. Discord’s Nitro unlocks many quality-of-life extras. If Nitro fatigue is why you searched “Discord alternative,” Descall is the direct answer.",
      },
    ],
  },
  "best-discord-alternative-for-lfg": {
    faq: GAMER_FAQ,
    sections: [
      {
        h: "LFG without bot hell",
        p: "Most Discord LFG setups depend on bots and role gates. Descall’s Play tab is a productized LFG surface — lobbies, filters, party codes, and voice handoff.",
      },
      {
        h: "Valorant-ready profiles",
        p: "Link Riot Name#TAG so rank can appear after a successful lookup. Your LFG card becomes trustworthy without pasting ranks into a channel every night.",
      },
      {
        h: "From lobby to call",
        p: "The winning Discord alternative for LFG shortens the path from “looking for duo” to “in voice.” Descall is designed around that loop.",
      },
    ],
  },
  "leave-nitro-keep-voice-chat": {
    faq: COMPARE_FAQ.slice(0, 3),
    sections: [
      {
        h: "You don’t need Nitro to talk",
        p: "Friend groups often pay for Nitro out of habit. Core voice and screen share should not require a subscription — that’s the promise of a free Discord alternative like Descall.",
      },
      {
        h: "A two-week migration plan",
        p: "Week 1: create a Descall group, move evening voice. Week 2: move LFG and screen-share sessions. Keep Discord for public servers you still enjoy.",
      },
      {
        h: "What you keep",
        p: "Chat history on Discord stays put. You’re not deleting a culture — you’re choosing a lighter daily driver for the people you actually call.",
      },
    ],
  },
};

export default function BlogPostPage({ onSignIn }) {
  const { slug } = useParams();
  const t = useT();
  const post = BLOG_POSTS.find((p) => p.slug === slug);
  const body = BODIES[slug];
  if (!post || !body) return <NotFoundPage />;

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
      faq={body.faq}
      jsonLd={[
        buildBreadcrumbLd(crumbs),
        buildFaqLd(body.faq),
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
      <section className="seo-section">
        <p className="seo-note">
          <Link to="/blog">{t("← Back to blog")}</Link>
        </p>
      </section>
    </SeoLandingShell>
  );
}
