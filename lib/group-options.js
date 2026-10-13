/**
 * Staff group options for the ACP. Built from NodeBB's actual group records.
 * Hide built-in membership groups that should never be used as staff lists.
 */
const DEFAULT_STAFF_GROUPS = ['administrators', 'Global Moderators'];

export async function getSelectableStaffGroups(groups) {
  // groups:createtime includes hidden custom groups; the ephemeral and
  // privilege groups are not candidates for private staff welcome chats.
  const existing = await groups.getNonPrivilegeGroups('groups:createtime', 0, -1, { ephemeral: false });
  const blocked = new Set((groups.systemGroups || []).filter(name => !DEFAULT_STAFF_GROUPS.includes(name)));
  const names = new Set(DEFAULT_STAFF_GROUPS);
  for (const group of existing) {
    const name = group?.name;
    if (typeof name !== 'string' || !name.trim() || blocked.has(name) ||
        groups.isPrivilegeGroup?.(name) || groups.ephemeralGroups?.includes(name)) {
      continue;
    }
    names.add(name);
  }
  return [
    ...DEFAULT_STAFF_GROUPS,
    ...[...names].filter(name => !DEFAULT_STAFF_GROUPS.includes(name)).sort((a, b) => a.localeCompare(b)),
  ].map(name => ({ name }));
}
