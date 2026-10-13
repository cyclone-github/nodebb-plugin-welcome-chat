import { processWelcomeEvent } from './lib/welcome.js';
import { getSelectableStaffGroups } from './lib/group-options.js';

// NodeBB v4.14+ exposes its internal libraries to ESM plugins via nodebb.require().
const routeHelpers = nodebb.require('./src/routes/helpers');
const groups = nodebb.require('./src/groups');
const messaging = nodebb.require('./src/messaging');
const user = nodebb.require('./src/user');
const db = nodebb.require('./src/database');
const meta = nodebb.require('./src/meta');
const winston = nodebb.require('winston');

export function init({ router }) {
  routeHelpers.setupAdminPageRoute(
    router,
    '/admin/plugins/welcome-chat',
    async (req, res) => {
      const staffGroups = await getSelectableStaffGroups(groups);
      res.render('admin/plugins/welcome-chat', {
        title: 'Welcome Chat',
        staffGroups,
      });
    }
  );
}

export function addAdminNavigation(header) {
  header.plugins.push({
    route: '/plugins/welcome-chat',
    icon: 'fa-comments',
    name: 'Welcome Chat',
  });
  return header;
}

// Serialize overlapping account-created and email-confirmed events in a single
// NodeBB worker. Stored 'sent' markers protect repeat events after restarts.
// Multi-worker installations still require distributed locking for strict
// exactly-once guarantees (documented in the README).
const pending = new Map();

function enqueue(uid, fn) {
  const previous = pending.get(uid) || Promise.resolve();
  const job = previous.catch(() => {}).then(fn);
  pending.set(uid, job);
  void job.finally(() => {
    if (pending.get(uid) === job) pending.delete(uid);
  }).catch(() => {});
  return job;
}

async function handleEvent(event, payload) {
  const uid = Number(event === 'created' ? payload?.user?.uid : payload?.uid);
  if (!Number.isSafeInteger(uid) || uid < 1) return;
  try {
    await enqueue(uid, () => processWelcomeEvent(event, payload, {
      groups, messaging, user, db, meta, logger: winston,
    }));
  } catch (err) {
    // Never disrupt registration or email confirmation on a messaging failure.
    winston.error(`[welcome-chat] ${err.stack || err}`);
  }
}

export async function onUserCreate(payload) {
  await handleEvent('created', payload);
}

export async function onEmailConfirmed(payload) {
  await handleEvent('email-confirmed', payload);
}
