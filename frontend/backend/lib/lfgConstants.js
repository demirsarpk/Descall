/**
 * Valorant LFG shared constants + helpers
 */

const VALORANT_RANKS = [
  "Iron 1", "Iron 2", "Iron 3",
  "Bronze 1", "Bronze 2", "Bronze 3",
  "Silver 1", "Silver 2", "Silver 3",
  "Gold 1", "Gold 2", "Gold 3",
  "Platinum 1", "Platinum 2", "Platinum 3",
  "Diamond 1", "Diamond 2", "Diamond 3",
  "Ascendant 1", "Ascendant 2", "Ascendant 3",
  "Immortal 1", "Immortal 2", "Immortal 3",
  "Radiant",
];

const RANK_INDEX = Object.fromEntries(VALORANT_RANKS.map((r, i) => [r, i]));

const VALORANT_MODES = [
  { id: "competitive", label: "Competitive" },
  { id: "unrated", label: "Unrated" },
  { id: "swiftplay", label: "Swiftplay" },
  { id: "spikerush", label: "Spike Rush" },
  { id: "premier", label: "Premier" },
];

const VALORANT_REGIONS = [
  { id: "eu", label: "Europe" },
  { id: "tr", label: "Turkey" },
  { id: "na", label: "North America" },
  { id: "ap", label: "Asia Pacific" },
];

const VALORANT_ROLES = ["Duelist", "Initiator", "Controller", "Sentinel", "Flex"];

function rankIndex(rank) {
  if (rank == null) return -1;
  const key = String(rank).trim();
  return Object.prototype.hasOwnProperty.call(RANK_INDEX, key) ? RANK_INDEX[key] : -1;
}

function isValidRank(rank) {
  return rankIndex(rank) >= 0;
}

function publicLobby(row, { includePartyCode = false, members = null } = {}) {
  if (!row) return null;
  const base = {
    id: row.id,
    hostId: row.host_id,
    groupId: row.group_id,
    game: row.game || "valorant",
    mode: row.mode,
    region: row.region,
    partySizeCurrent: row.party_size_current,
    partySizeMax: row.party_size_max,
    hostRank: row.host_rank,
    rankMin: row.rank_min,
    rankMax: row.rank_max,
    needRoles: row.need_roles || [],
    micRequired: Boolean(row.mic_required),
    note: row.note || "",
    status: row.status,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    updatedAt: row.updated_at,
    hasPartyCode: Boolean(row.party_code),
  };
  if (includePartyCode) {
    base.partyCode = row.party_code || "";
  }
  if (members) {
    base.members = members;
  }
  return base;
}

module.exports = {
  VALORANT_RANKS,
  VALORANT_MODES,
  VALORANT_REGIONS,
  VALORANT_ROLES,
  RANK_INDEX,
  rankIndex,
  isValidRank,
  publicLobby,
};
