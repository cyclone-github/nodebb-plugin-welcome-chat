/**
 * Welcome chat logic. Kept independent of the NodeBB global so it can be unit-tested.
 * NodeBB core only creates queued users when their registrations are approved.
 * A created user is not necessarily email-verified.
 */

const SETTINGS_NAMESPACE = 'welcome-chat';
const VERIFIED_MODES = new Set(['verified', 'approved_verified']);
const DELIVERY_MODES = new Set(['created', 'approved', 'verified', 'approved_verified']);
const DEFAULT_RULES_URL = '';
const DEFAULT_ROOM_TITLE = 'Welcome to {forumName}';
const DEFAULT_MESSAGE = [
  'Welcome to {forumName}, {username}!',
  '',
  'Thanks for joining our community.',
  '',
  'This private chat includes members of the forum team. If you have questions,',
  'you can reply here when your account has permission to send chats.',
  '',
  'We look forward to seeing you around!'
].join('\n');

const DEFAULT_GROUPS = ['administrators', 'Global Moderators'];
const MAX_CONFIGURED_GROUPS = 10;
const MAX_CONFIGURED_EXTRA_USERS = 100;
const MAX_STAFF_PARTICIPANTS = 100;
const MAX_MESSAGE_TEMPLATE = 12000;

export function parseGroups(value) {
  if (typeof value !== 'string') {
    return [...DEFAULT_GROUPS];
  }
  if (!value.trim()) {
    return []; // Explicitly empty: allow specific staff UIDs only.
  }
  return [...new Set(value.split(/[\r\n,]+/).map(s => s.trim()).filter(Boolean))]
    .slice(0, MAX_CONFIGURED_GROUPS);
}

export function parseUids(value) {
  return [...new Set(String(value || '')
    .split(/[\s,;]+/)
    .filter(v => /^[1-9]\d{0,9}$/.test(v))
    .map(Number)
  )].slice(0, MAX_CONFIGURED_EXTRA_USERS);
}

function positiveUid(value) {
  const uid = Number(value);
  return Number.isSafeInteger(uid) && uid > 0 ? uid : 0;
}

function makeVariables(settings, username, forumName) {
  // A rules URL is optional. A default pointing at a particular forum would
  // silently send newcomers to the wrong site on public installations.
  const rulesUrl = String(settings.rulesUrl ?? DEFAULT_RULES_URL).trim();
  if (rulesUrl && !/^https:\/\/[^\s]+$/i.test(rulesUrl)) {
    throw new Error('The rules URL must be an absolute HTTPS URL');
  }
  return {
    username: String(username),
    rulesUrl,
    forumName: String(forumName || 'the forum'),
  };
}

function renderTemplate(template, variables) {
  // A callback keeps usernames containing '$' literal.
  return template.replace(/\{(username|rulesUrl|forumName)\}/g, (_, name) => variables[name]);
}

function makeContent(settings, variables) {
  const template = typeof settings.messageTemplate === 'string' && settings.messageTemplate.trim()
    ? settings.messageTemplate
    : DEFAULT_MESSAGE;
  if (template.length > MAX_MESSAGE_TEMPLATE) {
    throw new Error(`Welcome message template exceeds ${MAX_MESSAGE_TEMPLATE} characters`);
  }
  if (template.includes('{rulesUrl}') && !variables.rulesUrl) {
    throw new Error('Set a forum rules URL before using {rulesUrl} in the welcome message');
  }
  return renderTemplate(template, variables);
}

/**
 * Handle the two NodeBB lifecycle hooks. Email confirmation can happen both
 * during account creation (SSO / preverified email) and later (email link).
 * The creation hook is authoritative: record that this is a newly created
 * account, then evaluate its current email verification status. The email hook
 * only processes accounts recorded by this plugin at creation time. This
 * prevents old members who change/verify an email from receiving welcomes.
 *
 * NodeBB's native approval queue creates the account ONLY when approved, so
 * both "created" and "approved" run at creation time for queued accounts.
 * An approval requirement does not delay unqueued registrations.
 */
export async function processWelcomeEvent(event, payload, deps) {
  const uid = positiveUid(event === 'created' ? payload?.user?.uid : payload?.uid);
  if (!uid) {
    return { status: 'invalid-user' };
  }
  if (event !== 'created' && event !== 'email-confirmed') {
    return { status: 'invalid-event' };
  }

  const settings = await deps.meta.settings.get(SETTINGS_NAMESPACE) || {};
  if (settings.enabled !== 'on') {
    return { status: 'disabled' };
  }
  const mode = settings.deliveryMode || 'created'; // Backwards-compatible default
  if (!DELIVERY_MODES.has(mode)) {
    deps.logger.error(`[welcome-chat] Unsupported delivery mode: ${mode}`);
    return { status: 'invalid-delivery-mode' }; // Fail closed rather than welcoming too early
  }

  const key = `welcome-chat:uid:${uid}`;
  if (event === 'created') {
    // Use a field-level update to preserve previously created rooms and status.
    await deps.db.setObjectField(key, 'registered', 1);
  } else {
    // Do not retroactively welcome accounts created before this plugin ran.
    const record = await deps.db.getObject(key);
    if (!record || Number(record.registered) !== 1) {
      return { status: 'not-tracked' };
    }
    if (!VERIFIED_MODES.has(mode)) {
      return { status: 'not-waiting-for-email' };
    }
  }

  if (VERIFIED_MODES.has(mode)) {
    const confirmed = await deps.user.getUserField(uid, 'email:confirmed');
    if (Number(confirmed) !== 1) {
      return { status: 'awaiting-email-verification' };
    }
  }

  // The confirmation hook carries a uid but no username. Always resolve the
  // canonical current username when it was not included in the event.
  const username = event === 'created' ? payload.user.username : await deps.user.getUserField(uid, 'username');
  return welcomeNewUser({ user: { uid, username } }, deps);
}

/**
 * Serialize delivery across NodeBB workers using the atomic database increment
 * supported by NodeBB's Redis and MongoDB abstraction. The lock lives in its
 * own expiring key so it cannot expire the permanent sent/room tracking record.
 * Concurrent callers return in-progress. A process crash releases the lock via
 * TTL (five minutes); very slow jobs must finish within that lease.
 *
 * This is a best-effort lock, not a transactional exactly-once guarantee.
 */
export async function welcomeNewUser(payload, deps) {
  const uid = positiveUid(payload?.user?.uid);
  if (!uid) return { status: 'invalid-user' };

  const settings = await deps.meta.settings.get(SETTINGS_NAMESPACE) || {};
  if (settings.enabled !== 'on') return { status: 'disabled' };

  const lockKey = `welcome-chat:lock:${uid}`;
  const claim = await deps.db.increment(lockKey);
  if (Number(claim) !== 1) {
    return { status: 'in-progress' };
  }

  try {
    await deps.db.expire(lockKey, 300);
    return await deliverWelcome(payload, deps, settings);
  } finally {
    await deps.db.delete(lockKey);
  }
}

async function deliverWelcome(payload, { groups, messaging, user, db, meta, logger }, settings) {
  const uid = positiveUid(payload.user.uid);
  const key = `welcome-chat:uid:${uid}`;
  const previous = await db.getObject(key);
  if (previous && Number(previous.sent) === 1) {
    return { status: 'already-sent', roomId: Number(previous.roomId) };
  }

  const configuredGroups = parseGroups(settings.groupNames);
  // Read at most 101 users from each group, so accidentally selecting a huge
  // group (e.g. registered-users) cannot cause an unbounded query.
  const memberships = await Promise.all(configuredGroups.map(group =>
    groups.getMembers(group, 0, MAX_STAFF_PARTICIPANTS)
  ));
  if (memberships.some(uids => uids.length > MAX_STAFF_PARTICIPANTS)) {
    logger.error('[welcome-chat] A selected staff group has over 100 members; refusing to create a mass chat');
    return { status: 'staff-limit' };
  }
  const staff = new Set();
  memberships.forEach(uids => uids.forEach(memberUid => {
    const id = positiveUid(memberUid);
    if (id && id !== uid) staff.add(id);
  }));
  for (const extraUid of parseUids(settings.extraUids)) {
    if (extraUid !== uid && await user.exists(extraUid)) {
      staff.add(extraUid);
    }
  }
  if (staff.size > MAX_STAFF_PARTICIPANTS) {
    logger.error('[welcome-chat] Over 100 staff participants selected; refusing to create a mass chat');
    return { status: 'staff-limit' };
  }
  if (!staff.size) {
    logger.warn(`[welcome-chat] No staff found for new user uid=${uid}; no chat created`);
    return { status: 'no-staff' };
  }

  const adminsIndex = configuredGroups.indexOf('administrators');
  const admins = adminsIndex !== -1
    ? memberships[adminsIndex].map(positiveUid).filter(id => id && staff.has(id))
    : [];
  const preferredSender = positiveUid(settings.senderUid);
  const sortedStaff = [...staff].sort((a, b) => a - b);
  const senderUid = (preferredSender && staff.has(preferredSender))
    ? preferredSender
    : (admins.length ? Math.min(...admins) : sortedStaff[0]);

  // The sender (a staff user) is the room owner. Other staff and the new user
  // are room members. The new member cannot remove staff from this room.
  const participants = [uid, ...sortedStaff.filter(id => id !== senderUid)];
  const limit = Number(meta.config?.maximumUsersInChatRoom) || 0;
  if (limit > 0 && participants.length + 1 > limit) {
    logger.error(`[welcome-chat] ${participants.length + 1} chat participants exceed configured limit ${limit}`);
    return { status: 'participant-limit' };
  }
  if (meta.config?.disableChat) {
    logger.warn('[welcome-chat] Chat is disabled in NodeBB settings');
    return { status: 'chat-disabled' };
  }

  const variables = makeVariables(settings, payload.user.username || `user ${uid}`, meta.config?.title);
  const content = makeContent(settings, variables);
  const messageLimit = Number(meta.config?.maximumChatMessageLength) || 0;
  if (messageLimit > 0 && content.length > messageLimit) {
    logger.error(`[welcome-chat] Message length ${content.length} exceeds maximumChatMessageLength=${messageLimit}`);
    return { status: 'message-too-long' };
  }
  const roomTitleTemplate = String(settings.roomTitle || DEFAULT_ROOM_TITLE).trim();
  if (roomTitleTemplate.includes('{rulesUrl}') && !variables.rulesUrl) {
    throw new Error('Set a forum rules URL before using {rulesUrl} in the chat title');
  }
  const roomName = renderTemplate(roomTitleTemplate, variables);
  if (!roomName) {
    throw new Error('Welcome chat room title is empty');
  }

  let roomId = positiveUid(previous?.roomId);
  let fromUid = positiveUid(previous?.senderUid) || senderUid;
  if (!roomId) {
    roomId = await messaging.newRoom(senderUid, {
      roomName,
      type: 'private',
      uids: participants,
      joinLeaveMessages: 0,
      notificationSetting: messaging.notificationSettings.ALLMESSAGES,
    });
    fromUid = senderUid;
    // Persist before sending. If delivery fails, a later retry can reuse the
    // room rather than creating another chat.
    await db.setObject(key, { roomId, senderUid: fromUid, sent: 0 });
  }

  // Checkpoint the saved mid *before* notifying users. If notification fails,
  // the next attempt reloads the existing message instead of posting it twice.
  let message;
  if (positiveUid(previous?.mid)) {
    const messages = await messaging.getMessagesData([Number(previous.mid)], fromUid, roomId, true);
    message = messages?.[0];
    if (!message) {
      throw new Error(`Saved welcome message mid=${previous.mid} could not be retrieved from room=${roomId}`);
    }
  } else {
    message = await messaging.sendMessage({ uid: fromUid, roomId, content });
    const mid = positiveUid(message?.mid || message?.messageId);
    if (!mid) {
      throw new Error('NodeBB did not return a valid saved chat message ID');
    }
    await db.setObjectField(key, 'mid', mid);
  }
  // NodeBB saves the message with sendMessage, then dispatches notifications
  // separately. Store sent=1 only once notification processing has returned.
  await messaging.notifyUsersInRoom(fromUid, roomId, message);
  await db.setObjectField(key, 'sent', 1);
  logger.info(`[welcome-chat] Welcomed uid=${uid} in room=${roomId} with ${staff.size} staff`);
  return { status: 'sent', roomId };
}

export { DEFAULT_RULES_URL, DEFAULT_ROOM_TITLE, DEFAULT_MESSAGE };
