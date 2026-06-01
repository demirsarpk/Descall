const express = require("express");
const supabase = require("../db/supabase");
const { requireAuth } = require("../middleware/auth");
const { socketToUser } = require("../runtime/sharedState");

const router = express.Router();
const MAX_GROUP_SIZE = 15;

// Kullanicinin socket ID'sini bul
function getUserSocketId(userId) {
  for (const [socketId, id] of socketToUser.entries()) {
    if (id === userId) return socketId;
  }
  return null;
}

// Helper: User'in member oldugu gruplari getir (member detaylari ile)
async function getUserGroups(userId) {
  // once group_members tablosundan group_id'leri al
  const { data: memberships, error: membershipError } = await supabase
    .from("group_members")
    .select("group_id, joined_at")
    .eq("user_id", userId);
  
  if (membershipError) {
    console.error("[Groups] Membership error:", membershipError);
    return [];
  }
  
  if (!memberships || memberships.length === 0) {
    return [];
  }
  
  // group_id'leri al
  const groupIds = memberships.map(m => m.group_id);
  
  // groups tablosundan detaylari al
  const { data: groups, error: groupsError } = await supabase
    .from("groups")
    .select("id, name, avatar_url, created_by, created_at")
    .in("id", groupIds);
  
  if (groupsError) {
    console.error("[Groups] Groups fetch error:", groupsError);
    return [];
  }
  
  // Her grup icin member count ve member listesini al
  const groupsWithDetails = await Promise.all(
    (groups || []).map(async (group) => {
      // Grup uyelerini getir
      const { data: groupMembers, error: membersError } = await supabase
        .from("group_members")
        .select("user_id, joined_at")
        .eq("group_id", group.id);
      
      if (membersError) {
        console.error("[Groups] Members fetch error:", membersError);
      }
      
      // User detaylarini getir
      const memberIds = groupMembers?.map(m => m.user_id) || [];
      let members = [];
      
      if (memberIds.length > 0) {
        const { data: users, error: usersError } = await supabase
          .from("users")
          .select("id, username, avatar_url, status")
          .in("id", memberIds);
        
        if (usersError) {
          console.error("[Groups] Users fetch error:", usersError);
        } else {
          members = users || [];
        }
      }
      
      const membership = memberships.find(m => m.group_id === group.id);
      
      return {
        ...group,
        memberCount: groupMembers?.length || 0,
        memberIds: memberIds, // Grup arama icin gerekli
        members: members, // Grup detay icin
        joinedAt: membership?.joined_at,
      };
    })
  );
  
  return groupsWithDetails;
}

// Get all groups where user is member
router.get("/my", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log("[Groups API] Fetching groups for user:", userId);
    
    const groups = await getUserGroups(userId);
    
    console.log("[Groups API] Found groups:", groups.length);
    res.json({ groups });
  } catch (err) {
    console.error("[Groups API] Error:", err);
    res.status(500).json({ error: "Failed to fetch groups" });
  }
});

// Create new group
router.post("/create", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, memberIds = [] } = req.body;
    
    if (!name || name.trim().length < 2 || name.length > 50) {
      return res.status(400).json({ error: "Group name must be 2-50 characters" });
    }
    
    const totalMembers = memberIds.length + 1; // + creator
    if (totalMembers > MAX_GROUP_SIZE) {
      return res.status(400).json({ error: `Maximum ${MAX_GROUP_SIZE} members allowed` });
    }
    
    // Create group
    const { data: group, error: createError } = await supabase
      .from("groups")
      .insert({ name: name.trim(), created_by: userId })
      .select()
      .single();
    
    if (createError) throw createError;
    
    // Add creator as member
    const allMembers = [userId, ...memberIds.filter(id => id !== userId)].slice(0, MAX_GROUP_SIZE);
    const memberRows = allMembers.map(user_id => ({ group_id: group.id, user_id }));
    
    const { error: memberError } = await supabase
      .from("group_members")
      .insert(memberRows);
    
    if (memberError) throw memberError;
    
    // Socket bildirimi - diger uyelere grup olustugunu bildir
    const io = req.app.get("io");
    if (io) {
      memberIds.forEach(memberId => {
        const memberSocketId = getUserSocketId(memberId);
        if (memberSocketId) {
          io.to(memberSocketId).emit("group:invited", {
            group: { ...group, memberCount: allMembers.length },
            invitedBy: req.user.id
          });
        }
      });
    }
    
    res.json({ 
      message: "Group created", 
      group: { ...group, memberCount: allMembers.length } 
    });
  } catch (err) {
    console.error("[Groups] Create error:", err);
    console.error("[Groups] Stack:", err.stack);
    res.status(500).json({ error: "Failed to create group", details: err.message });
  }
});

// Get group messages
router.get("/:groupId/messages", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { groupId } = req.params;
    const { before, limit = 50 } = req.query;
    
    // Check membership
    const { data: member } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("group_id", groupId)
      .eq("user_id", userId)
      .maybeSingle();
    
    if (!member) return res.status(403).json({ error: "Not a member of this group" });
    
    let query = supabase
      .from("group_messages")
      .select(`
        *,
        sender:sender_id (id, username, avatar_url)
      `)
      .eq("group_id", groupId)
      .order("created_at", { ascending: false })
      .limit(parseInt(limit));
    
    if (before) {
      query = query.lt("created_at", before);
    }
    
    const { data: messages, error } = await query;
    if (error) throw error;

    const normalized = (messages || []).reverse().map((m) => {
      if (m.message_type === "call_summary") {
        try {
          const summary = typeof m.content === "string" ? JSON.parse(m.content) : m.content;
          return { ...m, type: "call_summary", summary };
        } catch {
          return m;
        }
      }
      return m;
    });

    res.json({ messages: normalized });
  } catch (err) {
    console.error("[Groups] Messages error:", err);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// Send message to group
router.post("/:groupId/messages", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { groupId } = req.params;
    const { content, mediaUrl, mediaType } = req.body;
    
    if (!content?.trim() && !mediaUrl) {
      return res.status(400).json({ error: "Message content or media required" });
    }
    
    // Check membership
    const { data: member } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("group_id", groupId)
      .eq("user_id", userId)
      .maybeSingle();
    
    if (!member) return res.status(403).json({ error: "Not a member" });
    
    const { data: message, error } = await supabase
      .from("group_messages")
      .insert({
        group_id: groupId,
        sender_id: userId,
        content: content?.trim() || null,
        media_url: mediaUrl || null,
        media_type: mediaType || null,
      })
      .select(`*, sender:sender_id (id, username, avatar_url)`)
      .single();
    
    if (error) throw error;
    
    // Broadcast to other group members via socket
    const io = req.app.get("io");
    if (io && message) {
      io.to(`group:${groupId}`).emit("group:message", {
        groupId,
        message,
      });
    }
    
    res.json({ message });
  } catch (err) {
    console.error("[Groups] Send error:", err);
    res.status(500).json({ error: "Failed to send message" });
  }
});

// Get group members
router.get("/:groupId/members", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { groupId } = req.params;
    
    // Check membership
    const { data: myMembership } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("group_id", groupId)
      .eq("user_id", userId)
      .maybeSingle();
    
    if (!myMembership) return res.status(403).json({ error: "Not a member" });
    
    const { data: members, error } = await supabase
      .from("group_members")
      .select(`
        joined_at,
        user:user_id (id, username, avatar_url)
      `)
      .eq("group_id", groupId);
    
    if (error) throw error;
    
    res.json({ 
      members: members.map(m => ({ ...m.user, joinedAt: m.joined_at })),
      isFull: members.length >= MAX_GROUP_SIZE
    });
  } catch (err) {
    console.error("[Groups] Members error:", err);
    console.error("[Groups] Stack:", err.stack);
    res.status(500).json({ error: "Failed to fetch members", details: err.message });
  }
});

// Invite user to group
router.post("/:groupId/invite", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { groupId } = req.params;
    const { invitedUserId, invitedUsername, username } = req.body;
    const invitedIdentity = invitedUserId || invitedUsername || username;

    if (!invitedIdentity) {
      return res.status(400).json({ error: "invitedUserId or username required" });
    }

    let resolvedInvitedUserId = invitedIdentity;
    if (typeof invitedIdentity === "string") {
      const trimmed = invitedIdentity.trim();
      if (!trimmed) {
        return res.status(400).json({ error: "Invalid invite target" });
      }
      const isUuidLike = /^[0-9a-fA-F-]{32,36}$/.test(trimmed);
      if (!isUuidLike) {
        const { data: invitedUser, error: invitedLookupError } = await supabase
          .from("users")
          .select("id")
          .eq("username", trimmed)
          .maybeSingle();
        if (invitedLookupError) throw invitedLookupError;
        if (!invitedUser?.id) {
          return res.status(404).json({ error: "User not found" });
        }
        resolvedInvitedUserId = invitedUser.id;
      } else {
        resolvedInvitedUserId = trimmed;
      }
    }
    
    // Check if group has space
    const { count } = await supabase
      .from("group_members")
      .select("*", { count: "exact", head: true })
      .eq("group_id", groupId);
    
    if (count >= MAX_GROUP_SIZE) {
      return res.status(400).json({ error: "Group is full (max 15 members)" });
    }
    
    // Check inviter is member
    const { data: inviter } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("group_id", groupId)
      .eq("user_id", userId)
      .maybeSingle();
    
    if (!inviter) return res.status(403).json({ error: "Not a member" });
    
    // Check not already member
    const { data: existingMember } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("group_id", groupId)
      .eq("user_id", resolvedInvitedUserId)
      .maybeSingle();
    
    if (existingMember) return res.status(409).json({ error: "Already a member" });
    
    // Create invite
    const { data: invite, error } = await supabase
      .from("group_invites")
      .insert({
        group_id: groupId,
        invited_by: userId,
        invited_user_id: resolvedInvitedUserId,
      })
      .select()
      .single();
    
    if (error) throw error;
    
    res.json({ invite, message: "Invitation sent" });
  } catch (err) {
    console.error("[Groups] Invite error:", err);
    res.status(500).json({ error: "Failed to invite" });
  }
});

// Accept/decline invite
router.post("/invites/:inviteId/respond", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { inviteId } = req.params;
    const { accept } = req.body;
    
    const { data: invite } = await supabase
      .from("group_invites")
      .select("*")
      .eq("id", inviteId)
      .eq("invited_user_id", userId)
      .eq("status", "pending")
      .single();
    
    if (!invite) return res.status(404).json({ error: "Invite not found" });
    
    if (!accept) {
      await supabase.from("group_invites").update({ status: "declined" }).eq("id", inviteId);
      return res.json({ message: "Invite declined" });
    }
    
    // Accept - add to group
    await supabase.from("group_members").insert({
      group_id: invite.group_id,
      user_id: userId,
    });
    
    await supabase.from("group_invites").update({ status: "accepted" }).eq("id", inviteId);
    
    res.json({ message: "Joined group" });
  } catch (err) {
    console.error("[Groups] Respond error:", err);
    res.status(500).json({ error: "Failed to respond" });
  }
});

// Add member directly (friends only, no invite flow)
router.post("/:groupId/members", requireAuth, async (req, res) => {
  try {
    const requesterId = req.user.id;
    const { groupId } = req.params;
    const { userId: targetUserId } = req.body;

    if (!targetUserId) return res.status(400).json({ error: "userId required" });

    // Requester must be a member
    const { data: requesterMembership } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("group_id", groupId)
      .eq("user_id", requesterId)
      .maybeSingle();

    if (!requesterMembership) return res.status(403).json({ error: "Not a member of this group" });

    // Target must be a friend of the requester
    const { data: friendship } = await supabase
      .from("friends")
      .select("id")
      .or(
        `and(user_id.eq.${requesterId},friend_id.eq.${targetUserId}),and(user_id.eq.${targetUserId},friend_id.eq.${requesterId})`
      )
      .maybeSingle();

    if (!friendship) return res.status(403).json({ error: "You can only add your friends" });

    // Check group capacity
    const { count } = await supabase
      .from("group_members")
      .select("*", { count: "exact", head: true })
      .eq("group_id", groupId);

    if (count >= MAX_GROUP_SIZE) {
      return res.status(400).json({ error: "Group is full (max 15 members)" });
    }

    // Check not already a member
    const { data: existing } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("group_id", groupId)
      .eq("user_id", targetUserId)
      .maybeSingle();

    if (existing) return res.status(409).json({ error: "User is already a member" });

    // Add directly
    const { error: insertError } = await supabase
      .from("group_members")
      .insert({ group_id: groupId, user_id: targetUserId });

    if (insertError) throw insertError;

    // Fetch added user info for response
    const { data: addedUser } = await supabase
      .from("users")
      .select("id, username, avatar_url")
      .eq("id", targetUserId)
      .single();

    // Notify group members via socket
    const io = req.app.get("io");
    if (io) {
      io.to(`group:${groupId}`).emit("group:member:added", {
        groupId,
        user: addedUser,
        addedBy: requesterId,
      });
    }

    res.json({ message: "Member added", user: addedUser });
  } catch (err) {
    console.error("[Groups] Add member error:", err);
    res.status(500).json({ error: "Failed to add member" });
  }
});

// Leave group
router.post("/:groupId/leave", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { groupId } = req.params;
    
    const { data: group } = await supabase
      .from("groups")
      .select("created_by")
      .eq("id", groupId)
      .single();
    
    if (group?.created_by === userId) {
      // Find remaining members (excluding the creator)
      const { data: remaining } = await supabase
        .from("group_members")
        .select("user_id, joined_at")
        .eq("group_id", groupId)
        .neq("user_id", userId)
        .order("joined_at", { ascending: true })
        .limit(1);

      if (!remaining || remaining.length === 0) {
        // No other members — delete the group entirely
        await supabase.from("group_members").delete().eq("group_id", groupId);
        await supabase.from("groups").delete().eq("id", groupId);
        return res.json({ message: "Left group", deleted: true });
      }

      // Transfer ownership to the earliest-joined remaining member
      const newOwner = remaining[0].user_id;
      await supabase.from("groups").update({ created_by: newOwner }).eq("id", groupId);
    }

    await supabase
      .from("group_members")
      .delete()
      .eq("group_id", groupId)
      .eq("user_id", userId);

    res.json({ message: "Left group" });
  } catch (err) {
    console.error("[Groups] Leave error:", err);
    res.status(500).json({ error: "Failed to leave" });
  }
});

// Rename group
router.post("/:groupId/rename", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { groupId } = req.params;
    const { name } = req.body;
    
    if (!name?.trim()) return res.status(400).json({ error: "Name required" });
    
    // Check if user is creator
    const { data: group, error: fetchError } = await supabase
      .from("groups")
      .select("created_by")
      .eq("id", groupId)
      .single();
    
    if (fetchError || !group) return res.status(404).json({ error: "Group not found" });
    if (group.created_by !== userId) return res.status(403).json({ error: "Only creator can rename" });
    
    const { error } = await supabase
      .from("groups")
      .update({ name: name.trim(), updated_at: new Date() })
      .eq("id", groupId);
    
    if (error) throw error;
    res.json({ success: true, name: name.trim() });
  } catch (err) {
    console.error("[Groups] Rename error:", err);
    res.status(500).json({ error: "Failed to rename group" });
  }
});

// Delete group (creator only)
router.delete("/:groupId", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { groupId } = req.params;

    // Check if user is creator
    const { data: group, error: fetchError } = await supabase
      .from("groups")
      .select("created_by")
      .eq("id", groupId)
      .single();

    if (fetchError || !group) return res.status(404).json({ error: "Group not found" });
    if (group.created_by !== userId) return res.status(403).json({ error: "Only creator can delete group" });

    // Notify members via socket BEFORE deletion
    const io = req.app.get("io");
    if (io) {
      io.to(`group:${groupId}`).emit("group:deleted", { groupId });
    }

    // Delete in order (members first, then messages, then group)
    // Note: Supabase doesn't support multi-table transactions in JS client easily
    // We delete in dependency order to minimize issues
    await supabase.from("group_members").delete().eq("group_id", groupId);
    await supabase.from("group_messages").delete().eq("group_id", groupId);
    await supabase.from("groups").delete().eq("id", groupId);

    res.json({ success: true, message: "Group deleted" });
  } catch (err) {
    console.error("[Groups] Delete error:", err);
    res.status(500).json({ error: "Failed to delete group" });
  }
});

// Update group avatar
router.post("/:groupId/avatar", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { groupId } = req.params;
    const { avatarUrl } = req.body;

    if (!avatarUrl) return res.status(400).json({ error: "Avatar URL required" });

    // Validate URL
    try {
      new URL(avatarUrl);
    } catch {
      return res.status(400).json({ error: "Invalid URL" });
    }

    // Check if user is creator
    const { data: group, error: fetchError } = await supabase
      .from("groups")
      .select("created_by")
      .eq("id", groupId)
      .single();

    if (fetchError || !group) return res.status(404).json({ error: "Group not found" });
    if (group.created_by !== userId) return res.status(403).json({ error: "Only creator can update avatar" });

    const { error } = await supabase
      .from("groups")
      .update({ avatar_url: avatarUrl })
      .eq("id", groupId);

    if (error) throw error;

    // Notify members via socket
    const io = req.app.get("io");
    if (io) {
      io.to(`group:${groupId}`).emit("group:avatar:updated", { groupId, avatarUrl });
    }

    res.json({ success: true, avatarUrl });
  } catch (err) {
    console.error("[Groups] Avatar update error:", err);
    res.status(500).json({ error: "Failed to update avatar" });
  }
});

module.exports = router;
