import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  BarChart3,
  Headphones,
  MessageSquareText,
  RefreshCw,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useT } from "../../context/LocaleContext";
import { useToast } from "../../context/ToastContext";
import { getServerInsights } from "../../api/servers";
import { serverHasPermission } from "../../lib/serverPermissions";

const RANGES = [
  { days: 7, labelKey: "7 days" },
  { days: 14, labelKey: "14 days" },
  { days: 30, labelKey: "30 days" },
];

function MiniBars({ values, color }) {
  const max = Math.max(1, ...values.map((v) => Number(v) || 0));
  return (
    <div className="server-insights-bars" aria-hidden>
      {values.map((v, i) => {
        const n = Number(v) || 0;
        const h = Math.max(4, Math.round((n / max) * 72));
        return (
          <div key={i} className="server-insights-bar-col" title={String(n)}>
            <div className="server-insights-bar" style={{ height: h, background: color }} />
          </div>
        );
      })}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, hint }) {
  return (
    <div className="server-insights-stat">
      <div className="server-insights-stat-icon">
        <Icon size={16} />
      </div>
      <div className="server-insights-stat-body">
        <span className="server-insights-stat-label">{label}</span>
        <strong className="server-insights-stat-value">{value}</strong>
        {hint ? <span className="server-insights-stat-hint">{hint}</span> : null}
      </div>
    </div>
  );
}

/**
 * Server Insights — messages / joins / voice minutes over recent days.
 */
export default function ServerInsightsModal({ server, onClose }) {
  const t = useT();
  const { toast } = useToast();
  const canView = serverHasPermission(server, "VIEW_GUILD_INSIGHTS");
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState(null);

  const load = async () => {
    if (!server?.id || !canView) return;
    setLoading(true);
    try {
      const data = await getServerInsights(server.id, { days });
      setInsights(data?.insights || null);
    } catch (err) {
      toast(err?.message || t("Something went wrong."), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [server?.id, days]);

  const daily = insights?.daily || [];
  const totals = insights?.totals || { messages: 0, joins: 0, voiceMinutes: 0 };
  const messageSeries = useMemo(() => daily.map((d) => d.messages || 0), [daily]);
  const joinSeries = useMemo(() => daily.map((d) => d.joins || 0), [daily]);
  const voiceSeries = useMemo(() => daily.map((d) => d.voiceMinutes || 0), [daily]);

  return (
    <motion.div
      className="server-modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="server-modal server-insights-modal"
        initial={{ scale: 0.94, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.94, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="server-moderation-head">
          <h3>
            <BarChart3 size={16} style={{ marginRight: 8, verticalAlign: -2 }} />
            {t("Server Insights")}
          </h3>
          <div className="server-insights-head-actions">
            <button
              type="button"
              className="icon-btn"
              onClick={load}
              title={t("Refresh")}
              disabled={loading || !canView}
              aria-label={t("Refresh")}
            >
              <RefreshCw size={16} />
            </button>
            <button type="button" className="icon-btn" onClick={onClose} aria-label={t("Close")}>
              <X size={16} />
            </button>
          </div>
        </div>

        <p className="server-modal-lead">
          {t("Activity for {name}: messages, joins, and voice time.", {
            name: server?.name || t("this server"),
          })}
        </p>

        {!canView ? (
          <p className="server-modal-error">{t("Missing permission.")}</p>
        ) : (
          <>
            <div className="server-insights-ranges">
              {RANGES.map((r) => (
                <button
                  key={r.days}
                  type="button"
                  className={`server-insights-range${days === r.days ? " is-active" : ""}`}
                  onClick={() => setDays(r.days)}
                >
                  {t(r.labelKey)}
                </button>
              ))}
            </div>

            {loading && !insights ? (
              <p className="server-empty-hint">{t("Please wait...")}</p>
            ) : (
              <>
                <div className="server-insights-stats">
                  <StatCard
                    icon={Users}
                    label={t("Members")}
                    value={insights?.memberCount ?? "—"}
                    hint={t("Current members")}
                  />
                  <StatCard
                    icon={MessageSquareText}
                    label={t("Messages")}
                    value={totals.messages ?? 0}
                    hint={t("Last {n} days", { n: days })}
                  />
                  <StatCard
                    icon={UserPlus}
                    label={t("Joins")}
                    value={totals.joins ?? 0}
                    hint={t("Last {n} days", { n: days })}
                  />
                  <StatCard
                    icon={Headphones}
                    label={t("Voice minutes")}
                    value={totals.voiceMinutes ?? 0}
                    hint={t("Last {n} days", { n: days })}
                  />
                </div>

                <section className="server-insights-chart">
                  <div className="server-insights-chart-head">
                    <Activity size={14} />
                    <h4>{t("Messages per day")}</h4>
                  </div>
                  <MiniBars values={messageSeries} color="rgba(88,101,242,0.85)" />
                  <div className="server-insights-x">
                    {daily.map((d) => (
                      <span key={`m-${d.date}`}>{String(d.date).slice(5)}</span>
                    ))}
                  </div>
                </section>

                <section className="server-insights-chart">
                  <div className="server-insights-chart-head">
                    <UserPlus size={14} />
                    <h4>{t("Joins per day")}</h4>
                  </div>
                  <MiniBars values={joinSeries} color="rgba(59,165,93,0.85)" />
                  <div className="server-insights-x">
                    {daily.map((d) => (
                      <span key={`j-${d.date}`}>{String(d.date).slice(5)}</span>
                    ))}
                  </div>
                </section>

                <section className="server-insights-chart">
                  <div className="server-insights-chart-head">
                    <Headphones size={14} />
                    <h4>{t("Voice minutes per day")}</h4>
                  </div>
                  <MiniBars values={voiceSeries} color="rgba(240,165,0,0.85)" />
                  <div className="server-insights-x">
                    {daily.map((d) => (
                      <span key={`v-${d.date}`}>{String(d.date).slice(5)}</span>
                    ))}
                  </div>
                </section>
              </>
            )}
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
