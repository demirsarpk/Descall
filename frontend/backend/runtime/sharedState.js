"use strict";

const presence = new Map();
const socketToUser = new Map();
const friends = new Map();
const pendingRequests = new Map();
const lastSeenByUserId = new Map();
const usernameById = new Map();
const dmUnreadByUser = new Map();
const notificationsByUser = new Map();
const dmHistory = new Map();

const MAX_DM_PER_CONV = 500;
const MAX_NOTIFICATIONS = 100;

const bannedUserIds = new Set();
/** userId -> { category, reason, message, bannedAt, expiresAt } */
const banDetailsByUser = new Map();
/** userId -> { until, category, reason, message, timedOutAt, actorId } */
const timedOutUsers = new Map();
const userRoles = new Map();
const auditLog = [];
const MAX_AUDIT = 5000;

const systemConfig = {
  dmRateLimitMs: 200,
  loggingLevel: "info",
  featureFlags: { voice: true, dm: true, video: true, screen: true },
  themeForce: null,
  maintenanceMode: false,
};

const profanityWords = new Set();
const autoDeleteRules = [];
const flaggedMessages = [];
const messageFlags = new Map();
const dmBlockPairs = new Set();
// Instant session revocation: "End session" removes the session from the
// durable users.active_sessions column (shown in Settings) AND adds its id
// here so requests/sockets using that JWT are rejected immediately, without
// a DB round-trip per request. Resets on restart, matching the existing
// in-memory ban/block pattern in this codebase.
const revokedSessionIds = new Set();
// Per (userId:purpose) guess-attempt counter for email verification / 2FA
// login codes, reset whenever a fresh code is issued.
const authCodeAttempts = new Map();
const userLastLoginAt = new Map();
const userSessionStartMs = new Map();
const userOnlineAccumMs = new Map();
const rateLimitDm = new Map();
const activeGroupCalls = new Map(); // groupId -> { initiatorId, initiatorUsername, callType, participants: Set, allParticipants: Set, startTime, dbCallId }
const screenShareSessions = new Map(); // `${groupId}:${userId}` -> dbSessionId
// Enhanced Error Logging
const errorLogs = [];
const archivedErrorLogs = [];
const MAX_ERROR_LOGS = 5000;
const MAX_ARCHIVED_LOGS = 10000;

// User Feedback System
const userFeedbacks = [];
const MAX_FEEDBACKS = 5000;

function appendAudit(actorId, actorUsername, action, target, meta = {}) {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    at: new Date().toISOString(),
    actorId,
    actorUsername,
    action,
    target: target || null,
    meta,
  };
  auditLog.unshift(entry);
  if (auditLog.length > MAX_AUDIT) auditLog.length = MAX_AUDIT;
  return entry;
}

// Legacy error log function (for backward compatibility)
const serverErrorLog = [];
const MAX_ERROR_LOG = 500;

function appendErrorLog(source, message, meta = {}, userId = null, username = null) {
  const entry = { 
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    at: new Date().toISOString(), 
    source, 
    message, 
    meta,
    userId,
    username
  };
  serverErrorLog.unshift(entry);
  if (serverErrorLog.length > MAX_ERROR_LOG) serverErrorLog.length = MAX_ERROR_LOG;
  
  // Also add to new enhanced error logs
  const enhancedEntry = {
    id: entry.id,
    timestamp: entry.at,
    severity: meta.severity || "error",
    source: source,
    message: message,
    stack: meta.stack || null,
    metadata: meta,
    user: userId ? { id: userId, username } : null,
    request: meta.request || null,
  };
  errorLogs.unshift(enhancedEntry);
  if (errorLogs.length > MAX_ERROR_LOGS) errorLogs.length = MAX_ERROR_LOGS;
  
  return enhancedEntry;
}

// Add user feedback
function addFeedback(user, category, priority, message, attachments = []) {
  const feedback = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    user,
    category,
    priority,
    message,
    attachments,
    status: "new",
    viewed: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    replies: [],
  };
  userFeedbacks.unshift(feedback);
  if (userFeedbacks.length > MAX_FEEDBACKS) userFeedbacks.length = MAX_FEEDBACKS;
  return feedback;
}

module.exports = {
  presence,
  socketToUser,
  friends,
  pendingRequests,
  lastSeenByUserId,
  usernameById,
  dmUnreadByUser,
  notificationsByUser,
  dmHistory,
  MAX_DM_PER_CONV,
  MAX_NOTIFICATIONS,
  bannedUserIds,
  banDetailsByUser,
  timedOutUsers,
  userRoles,
  auditLog,
  appendAudit,
  systemConfig,
  profanityWords,
  autoDeleteRules,
  flaggedMessages,
  messageFlags,
  dmBlockPairs,
  revokedSessionIds,
  authCodeAttempts,
  userLastLoginAt,
  userSessionStartMs,
  userOnlineAccumMs,
  rateLimitDm,
  activeGroupCalls,
  screenShareSessions,
  serverErrorLog,
  appendErrorLog,
  MAX_AUDIT,
  // Enhanced Error Logging
  errorLogs,
  archivedErrorLogs,
  MAX_ERROR_LOGS,
  MAX_ARCHIVED_LOGS,
  // User Feedback System
  userFeedbacks,
  MAX_FEEDBACKS,
  addFeedback,
};
