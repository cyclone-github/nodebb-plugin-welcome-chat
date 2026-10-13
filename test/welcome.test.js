import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { welcomeNewUser, processWelcomeEvent, parseGroups, parseUids, DEFAULT_MESSAGE, DEFAULT_ROOM_TITLE, DEFAULT_RULES_URL } from '../lib/welcome.js';
import { getSelectableStaffGroups } from '../lib/group-options.js';

function fixture({
  settings = { enabled: 'on' },
  members = { administrators: ['2', '3'], 'Global Moderators': ['3', '4'] },
  maxUsersInChatRoom = 0,
  failSendOnce = false,
  failNotifyOnce = false,
  maxChatMessageLength = 0,
  verifiedUsers = [],
} = {}) {
  const store = new Map();
  const calls = { created: [], sent: [], notified: [], groupLookups: [], logs: [] };
  const deps = {
    meta: { settings: { get: async () => settings }, config: { title: 'Example Community', maximumUsersInChatRoom: maxUsersInChatRoom, maximumChatMessageLength: maxChatMessageLength } },
    groups: { getMembers: async (name) => {
      calls.groupLookups.push(name);
      return members[name] || [];
    } },
    user: {
      exists: async uid => uid > 0 && uid < 200,
      getUserField: async (uid, field) => {
        if (field === 'email:confirmed') return verifiedUsers.includes(uid) ? 1 : 0;
        if (field === 'username') return `account${uid}`;
        return undefined;
      },
    },
    db: {
      getObject: async key => store.get(key) || null,
      increment: async key => {
        const next = (Number(store.get(key)) || 0) + 1;
        store.set(key, next);
        return next;
      },
      expire: async () => {},
      delete: async key => { store.delete(key); },
      setObject: async (key, obj) => { store.set(key, { ...store.get(key), ...obj }); },
      setObjectField: async (key, field, value) => {
        store.set(key, { ...store.get(key), [field]: value });
      },
    },
    messaging: {
      notificationSettings: { ALLMESSAGES: 3 },
      newRoom: async (sender, data) => {
        calls.created.push({ sender, data });
        return 100 + calls.created.length;
      },
      sendMessage: async data => {
        calls.sent.push(data);
        if (failSendOnce && calls.sent.length === 1) throw new Error('simulated delivery failure');
        return { mid: 200 + calls.sent.length, content: data.content, roomId: data.roomId, fromuid: data.uid };
      },
      getMessagesData: async mids => [{ mid: mids[0], messageId: mids[0], roomId: 101 }],
      notifyUsersInRoom: async (...args) => {
        calls.notified.push(args);
        if (failNotifyOnce && calls.notified.length === 1) throw new Error('simulated notification failure');
      },
    },
    logger: {
      info: x => calls.logs.push(['info', x]),
      warn: x => calls.logs.push(['warn', x]),
      error: x => calls.logs.push(['error', x]),
    },
  };
  return { deps, calls, store };
}
const data = (uid = 90, username = 'newmember') => ({ user: { uid, username } });

test('ACP defaults match runtime defaults and do not include a rules URL', () => {
  const tpl = readFileSync(new URL('../templates/admin/plugins/welcome-chat.tpl', import.meta.url), 'utf8');
  const template = tpl.match(/<textarea[^>]+id="messageTemplate"[^>]*>([\s\S]*?)<\/textarea>/)?.[1];
  const title = tpl.match(/<input[^>]+id="roomTitle"[^>]+value="([^"]*)"/)?.[1];
  assert.equal(template?.replaceAll('&#123;', '{').replaceAll('&#125;', '}'), DEFAULT_MESSAGE);
  assert.equal(title?.replaceAll('&#123;', '{').replaceAll('&#125;', '}'), DEFAULT_ROOM_TITLE);
  assert.equal(DEFAULT_RULES_URL, '');
  assert.match(tpl, /id="rulesUrl"[^>]*placeholder=/);
  assert.match(tpl, /<option value="approved_verified" selected>/);
  assert.doesNotMatch(tpl, /<option value="created" selected>/);
  assert.doesNotMatch(tpl, /Disabled until enabled and saved below/);
  assert.doesNotMatch(tpl, /Staff membership is resolved when a user registers/);
  assert.match(tpl, /data-group-name="{staffGroups.name}"/);
  assert.match(tpl, /name="groupNames"/);
  assert.match(tpl, /Forum rules: &#123;rulesUrl&#125;/);
});

test('parse and sanitize selected groups and UID lists', () => {
  assert.deepEqual(parseGroups('admins, mods\nadmins'), ['admins', 'mods']);
  assert.deepEqual(parseGroups(''), []);
  assert.deepEqual(parseGroups(undefined), ['administrators', 'Global Moderators']);
  assert.deepEqual(parseGroups('["Global Moderators","My Staff, Local","Global Moderators"]'), ['Global Moderators', 'My Staff, Local']);
  assert.deepEqual(parseGroups('[]'), []);
  assert.deepEqual(parseGroups('[bad-json'), []);
  assert.deepEqual(parseUids('5, 10; invalid -1 5 10'), [5, 10]);
});

test('default off unless enabled in saved ACP settings', async () => {
  const f = fixture({ settings: {} });
  assert.deepEqual(await welcomeNewUser(data(), f.deps), { status: 'disabled' });
  assert.equal(f.calls.created.length, 0);
});

test('create private room with member and de-duplicated current staff; notify all', async () => {
  const f = fixture();
  const result = await welcomeNewUser(data(), f.deps);
  assert.equal(result.status, 'sent');
  assert.equal(f.calls.created.length, 1);
  const room = f.calls.created[0];
  assert.equal(room.sender, 2);
  assert.equal(room.data.type, 'private');
  assert.equal(room.data.roomName, 'Welcome to Example Community');
  assert.deepEqual(room.data.uids, [90, 3, 4]);
  assert.match(f.calls.sent[0].content, /newmember/);
  assert.match(f.calls.sent[0].content, /Welcome to Example Community!/);
  assert.doesNotMatch(f.calls.sent[0].content, /https?:\/\//);
  assert.equal(f.calls.notified.length, 1);
  assert.equal(f.calls.notified[0][0], 2);
  assert.equal(f.store.get('welcome-chat:uid:90').sent, 1);
});

test('do not send again for previously welcomed UID', async () => {
  const f = fixture();
  await welcomeNewUser(data(), f.deps);
  const retry = await welcomeNewUser(data(), f.deps);
  assert.equal(retry.status, 'already-sent');
  assert.equal(f.calls.created.length, 1);
  assert.equal(f.calls.sent.length, 1);
});

test('failed send reuses prior room when attempted again', async () => {
  const f = fixture({ failSendOnce: true });
  await assert.rejects(welcomeNewUser(data(), f.deps), /simulated delivery failure/);
  const record = f.store.get('welcome-chat:uid:90');
  assert.equal(record.roomId, 101);
  assert.equal(record.sent, 0);
  const retry = await welcomeNewUser(data(), f.deps);
  assert.equal(retry.status, 'sent');
  assert.equal(f.calls.created.length, 1);
  assert.equal(f.calls.sent.length, 2);
  assert.equal(f.calls.notified.length, 1);
});

test('choose a preferred staff sender and include additional users', async () => {
  const f = fixture({ settings: { enabled: 'on', senderUid: '4', extraUids: '5, 2' } });
  await welcomeNewUser(data(), f.deps);
  assert.equal(f.calls.created[0].sender, 4);
  assert.deepEqual(f.calls.created[0].data.uids, [90, 2, 3, 5]);
});

test('prefer actual admin UID if preferred sender not a participant', async () => {
  const f = fixture({ settings: { enabled: 'on', senderUid: '9999' } });
  await welcomeNewUser(data(), f.deps);
  assert.equal(f.calls.created[0].sender, 2);
});

test('no staff means no chat', async () => {
  const f = fixture({ members: {} });
  assert.equal((await welcomeNewUser(data(), f.deps)).status, 'no-staff');
  assert.equal(f.calls.created.length, 0);
});

test('respect configured maximum users per room', async () => {
  const f = fixture({ maxUsersInChatRoom: 3 });
  assert.equal((await welcomeNewUser(data(), f.deps)).status, 'participant-limit');
  assert.equal(f.calls.created.length, 0);
});

test('groups are resolved afresh for each new registration', async () => {
  const f = fixture();
  await welcomeNewUser(data(90), f.deps);
  const joined = ['3', '4', '5'];
  f.deps.groups.getMembers = async name => name === 'Global Moderators' ? joined : ['2'];
  await welcomeNewUser(data(91), f.deps);
  assert.deepEqual(f.calls.created[1].data.uids, [91, 3, 4, 5]);
});

test('template variables and custom rules URL', async () => {
  const f = fixture({ settings: {
    enabled: 'on',
    rulesUrl: 'https://example.org/rules',
    messageTemplate: 'Hi {username}; visit {rulesUrl} for {forumName}',
  } });
  await welcomeNewUser(data(90, 'abc$&'), f.deps);
  assert.equal(f.calls.sent[0].content, 'Hi abc$&; visit https://example.org/rules for Example Community');
});


test('generic title and message reflect the configured forum name', async () => {
  const f = fixture({ settings: { enabled: 'on', roomTitle: 'Hello {username} from {forumName}' } });
  const result = await welcomeNewUser(data(90, 'Taylor'), f.deps);
  assert.equal(result.status, 'sent');
  assert.equal(f.calls.created[0].data.roomName, 'Hello Taylor from Example Community');
  assert.match(f.calls.sent[0].content, /Hi Taylor,\n\nWelcome to Example Community!/);
});

test('optional rules URL can be omitted safely', async () => {
  const f = fixture({ settings: { enabled: 'on', rulesUrl: '' } });
  const result = await welcomeNewUser(data(), f.deps);
  assert.equal(result.status, 'sent');
  assert.match(f.calls.sent[0].content, /Thanks for joining!/);
});

test('using a missing rules URL in a message fails before creating a room', async () => {
  const f = fixture({ settings: { enabled: 'on', messageTemplate: 'Read {rulesUrl}' } });
  await assert.rejects(welcomeNewUser(data(), f.deps), /Set a forum rules URL/);
  assert.equal(f.calls.created.length, 0);
});

test('using a missing rules URL in a title fails before creating a room', async () => {
  const f = fixture({ settings: { enabled: 'on', roomTitle: 'Rules {rulesUrl}' } });
  await assert.rejects(welcomeNewUser(data(), f.deps), /Set a forum rules URL/);
  assert.equal(f.calls.created.length, 0);
});

test('optional configured rules link renders in the chat title and message', async () => {
  const f = fixture({ settings: {
    enabled: 'on', rulesUrl: 'https://example.org/rules',
    roomTitle: 'Welcome to {forumName}', messageTemplate: 'Rules: {rulesUrl}',
  } });
  const result = await welcomeNewUser(data(), f.deps);
  assert.equal(result.status, 'sent');
  assert.equal(f.calls.created[0].data.roomName, 'Welcome to Example Community');
  assert.equal(f.calls.sent[0].content, 'Rules: https://example.org/rules');
});

test('reject unsafe rules URL without creating a room', async () => {
  const f = fixture({ settings: { enabled: 'on', rulesUrl: 'javascript:alert(1)' } });
  await assert.rejects(welcomeNewUser(data(), f.deps), /absolute HTTPS/);
  assert.equal(f.calls.created.length, 0);
});


test('specific staff UIDs work with explicitly empty group field', async () => {
  const f = fixture({ settings: { enabled: 'on', groupNames: '', extraUids: '7, 8', senderUid: '8' } });
  const result = await welcomeNewUser(data(), f.deps);
  assert.equal(result.status, 'sent');
  assert.deepEqual(f.calls.groupLookups, []);
  assert.equal(f.calls.created[0].sender, 8);
  assert.deepEqual(f.calls.created[0].data.uids, [90, 7]);
});

test('refuse to include too many members when a large group is selected', async () => {
  const f = fixture({ members: { administrators: Array.from({ length: 101 }, (_, i) => String(i + 1)) } });
  assert.equal((await welcomeNewUser(data(), f.deps)).status, 'staff-limit');
  assert.equal(f.calls.created.length, 0);
});


test('created mode sends immediately and retains a creation marker', async () => {
  const f = fixture({ settings: { enabled: 'on', deliveryMode: 'created' } });
  const result = await processWelcomeEvent('created', data(), f.deps);
  assert.equal(result.status, 'sent');
  assert.equal(f.store.get('welcome-chat:uid:90').registered, 1);
  assert.equal(f.calls.sent.length, 1);
});

test('approval mode sends on account creation (NodeBB approval queue creates only when approved)', async () => {
  const f = fixture({ settings: { enabled: 'on', deliveryMode: 'approved' } });
  assert.equal((await processWelcomeEvent('created', data(), f.deps)).status, 'sent');
  assert.equal(f.calls.sent.length, 1);
});

test('verified mode waits until email confirmation, then delivers exactly once', async () => {
  const verifiedUsers = [];
  const f = fixture({ settings: { enabled: 'on', deliveryMode: 'verified' }, verifiedUsers });
  assert.equal((await processWelcomeEvent('created', data(), f.deps)).status, 'awaiting-email-verification');
  assert.equal(f.calls.created.length, 0);
  assert.equal(f.store.get('welcome-chat:uid:90').registered, 1);
  verifiedUsers.push(90);
  const result = await processWelcomeEvent('email-confirmed', { uid: 90 }, f.deps);
  assert.equal(result.status, 'sent');
  assert.match(f.calls.sent[0].content, /account90/);
  assert.equal((await processWelcomeEvent('email-confirmed', { uid: 90 }, f.deps)).status, 'already-sent');
  assert.equal(f.calls.created.length, 1);
  assert.equal(f.calls.sent.length, 1);
});

test('approved_verified mode waits for verified email even after approval', async () => {
  const verifiedUsers = [];
  const f = fixture({ settings: { enabled: 'on', deliveryMode: 'approved_verified' }, verifiedUsers });
  assert.equal((await processWelcomeEvent('created', data(), f.deps)).status, 'awaiting-email-verification');
  verifiedUsers.push(90);
  assert.equal((await processWelcomeEvent('email-confirmed', { uid: 90 }, f.deps)).status, 'sent');
  assert.equal(f.calls.sent.length, 1);
});

test('email already verified when created: welcome at creation', async () => {
  const f = fixture({ settings: { enabled: 'on', deliveryMode: 'approved_verified' }, verifiedUsers: [90] });
  assert.equal((await processWelcomeEvent('created', data(), f.deps)).status, 'sent');
  assert.equal(f.calls.sent.length, 1);
});

test('email confirmed before creation hook: no premature send, creation checks verified flag', async () => {
  const f = fixture({ settings: { enabled: 'on', deliveryMode: 'verified' }, verifiedUsers: [90] });
  assert.equal((await processWelcomeEvent('email-confirmed', { uid: 90 }, f.deps)).status, 'not-tracked');
  assert.equal(f.calls.sent.length, 0);
  assert.equal((await processWelcomeEvent('created', data(), f.deps)).status, 'sent');
  assert.equal(f.calls.sent.length, 1);
});

test('existing member confirming a changed email does not receive a welcome', async () => {
  const f = fixture({ settings: { enabled: 'on', deliveryMode: 'verified' }, verifiedUsers: [75] });
  assert.equal((await processWelcomeEvent('email-confirmed', { uid: 75 }, f.deps)).status, 'not-tracked');
  assert.equal(f.calls.created.length, 0);
});

test('no welcome when disabled, including on email confirmation', async () => {
  const f = fixture({ settings: { enabled: 'off', deliveryMode: 'approved_verified' }, verifiedUsers: [90] });
  assert.equal((await processWelcomeEvent('created', data(), f.deps)).status, 'disabled');
  assert.equal((await processWelcomeEvent('email-confirmed', { uid: 90 }, f.deps)).status, 'disabled');
  assert.equal(f.store.size, 0);
});

test('email hook cannot send in immediate mode, avoids duplicate even for old records', async () => {
  const f = fixture({ settings: { enabled: 'on', deliveryMode: 'created' }, verifiedUsers: [90] });
  assert.equal((await processWelcomeEvent('created', data(), f.deps)).status, 'sent');
  assert.equal((await processWelcomeEvent('email-confirmed', { uid: 90 }, f.deps)).status, 'not-waiting-for-email');
  assert.equal(f.calls.sent.length, 1);
});

test('unknown mode fails closed instead of sending early', async () => {
  const f = fixture({ settings: { enabled: 'on', deliveryMode: 'unrecognized' }, verifiedUsers: [90] });
  assert.equal((await processWelcomeEvent('created', data(), f.deps)).status, 'invalid-delivery-mode');
  assert.equal(f.calls.sent.length, 0);
});

test('missing delivery mode now defaults to approval and verified email', async () => {
  const f = fixture({ settings: { enabled: 'on' }, verifiedUsers: [] });
  assert.equal((await processWelcomeEvent('created', data(), f.deps)).status, 'awaiting-email-verification');
  assert.equal(f.calls.created.length, 0);
  assert.equal(f.store.get('welcome-chat:uid:90').registered, 1);
  f.deps.user.getUserField = async (uid, field) => field === 'email:confirmed' ? 1 : `account${uid}`;
  assert.equal((await processWelcomeEvent('email-confirmed', { uid: 90 }, f.deps)).status, 'sent');
  assert.equal(f.calls.created.length, 1);
});


test('notification failure retries without sending a duplicate chat message', async () => {
  const f = fixture({ failNotifyOnce: true });
  await assert.rejects(welcomeNewUser(data(), f.deps), /simulated notification failure/);
  const record = f.store.get('welcome-chat:uid:90');
  assert.equal(record.mid, 201);
  assert.equal(record.sent, 0);
  const result = await welcomeNewUser(data(), f.deps);
  assert.equal(result.status, 'sent');
  assert.equal(f.calls.created.length, 1);
  assert.equal(f.calls.sent.length, 1);
  assert.equal(f.calls.notified.length, 2);
});

test('distributed lock prevents simultaneous workers from creating multiple rooms', async () => {
  const f = fixture();
  const results = await Promise.all([
    welcomeNewUser(data(), f.deps),
    welcomeNewUser(data(), f.deps),
  ]);
  assert.deepEqual(results.map(x => x.status).sort(), ['in-progress', 'sent']);
  assert.equal(f.calls.created.length, 1);
  assert.equal(f.calls.sent.length, 1);
  assert.equal(f.store.has('welcome-chat:lock:90'), false);
});

test('lock is removed when delivery throws so an event can retry', async () => {
  const f = fixture({ failSendOnce: true });
  await assert.rejects(welcomeNewUser(data(), f.deps), /simulated delivery failure/);
  assert.equal(f.store.has('welcome-chat:lock:90'), false);
  assert.equal((await welcomeNewUser(data(), f.deps)).status, 'sent');
});

test('reject too-long chat before creating a room', async () => {
  const f = fixture({ maxChatMessageLength: 25 });
  assert.equal((await welcomeNewUser(data(), f.deps)).status, 'message-too-long');
  assert.equal(f.calls.created.length, 0);
  assert.equal(f.store.has('welcome-chat:lock:90'), false);
});


test('ACP picker includes system staff and real custom groups, without membership and privilege groups', async () => {
  let called;
  const options = await getSelectableStaffGroups({
    systemGroups: ['registered-users', 'verified-users', 'administrators', 'Global Moderators', 'banned-users'],
    ephemeralGroups: ['guests', 'spiders'],
    isPrivilegeGroup: name => name.includes(':privileges:'),
    getNonPrivilegeGroups: async (...args) => {
      called = args;
      return [
        { name: 'The Helpers' }, { name: 'registered-users' },
        { name: 'Global Moderators' }, { name: 'guests' },
        { name: 'Staff, Regional' }, { name: 'cid:10:privileges:mods' },
        { name: 'Team A' }, { name: 'Team A' }, { name: 'banned-users' },
      ];
    },
  });
  assert.deepEqual(called, ['groups:createtime', 0, -1, { ephemeral: false }]);
  assert.deepEqual(options.map(x => x.name), ['administrators', 'Global Moderators', 'Staff, Regional', 'Team A', 'The Helpers']);
});

test('saved legacy group names remain compatible, including custom groups', async () => {
  const f = fixture({
    settings: { enabled: 'on', groupNames: 'administrators\nhelpers' },
    members: { administrators: ['2'], helpers: ['5', '6'] },
  });
  assert.equal((await welcomeNewUser(data(), f.deps)).status, 'sent');
  assert.deepEqual(f.calls.groupLookups, ['administrators', 'helpers']);
});

test('group names containing commas can be selected and delivered via JSON', async () => {
  const f = fixture({
    settings: { enabled: 'on', groupNames: '["Staff, Regional"]' },
    members: { 'Staff, Regional': ['7'] },
  });
  assert.equal((await welcomeNewUser(data(), f.deps)).status, 'sent');
  assert.deepEqual(f.calls.groupLookups, ['Staff, Regional']);
});

test('ACP group control is button-based with saved hidden groupNames input', () => {
  const tpl = readFileSync(new URL('../templates/admin/plugins/welcome-chat.tpl', import.meta.url), 'utf8');
  const js = readFileSync(new URL('../public/lib/admin.js', import.meta.url), 'utf8');
  assert.match(tpl, /type="hidden" id="groupNames" name="groupNames"/);
  assert.match(tpl, /aria-pressed="false"/);
  assert.match(js, /load\('welcome-chat', form, \(err\) =>/);
  assert.match(js, /input\.val\(JSON\.stringify\(selected\)\)/);
  assert.match(js, /save\('welcome-chat', form\)/);
});
