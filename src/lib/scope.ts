// Hierarchy scoping helpers — chuja data kwa ngazi ya user

export type HierarchyLevel = 'union' | 'conference' | 'zone' | 'branch';

export interface UserRoleLike {
  hierarchy_level: HierarchyLevel;
  level_id: string;
}

interface MinConf { id: string }
interface MinZone { id: string; conference_id: string }
interface MinBranch { id: string; zone_id: string }

export interface Scope {
  isUnion: boolean;
  isPlainMember: boolean;         // hakuna role yoyote
  conferenceIds: Set<string>;
  zoneIds: Set<string>;
  branchIds: Set<string>;
  /** Ngazi ya juu zaidi ya role ya user (kama ipo) */
  topLevel: HierarchyLevel | null;
  /** Level ya kuanzia UI ya drill-down */
  startLevel: 'conferences' | 'zones' | 'branches' | 'members';
  startConferenceId: string | null;
  startZoneId: string | null;
  startBranchId: string | null;
}

const LEVEL_ORDER: Record<HierarchyLevel, number> = { union: 0, conference: 1, zone: 2, branch: 3 };

export function computeScope(
  userRoles: UserRoleLike[],
  conferences: MinConf[],
  zones: MinZone[],
  branches: MinBranch[],
  myBranchId: string | null,
): Scope {
  const isUnion = userRoles.some(r => r.hierarchy_level === 'union');
  const isPlainMember = userRoles.length === 0;

  if (isUnion) {
    return {
      isUnion: true, isPlainMember: false, topLevel: 'union',
      conferenceIds: new Set(conferences.map(c => c.id)),
      zoneIds: new Set(zones.map(z => z.id)),
      branchIds: new Set(branches.map(b => b.id)),
      startLevel: 'conferences',
      startConferenceId: null, startZoneId: null, startBranchId: null,
    };
  }

  const confIds = new Set<string>();
  const zoneIds = new Set<string>();
  const branchIds = new Set<string>();

  userRoles.forEach(r => {
    if (r.hierarchy_level === 'conference') confIds.add(r.level_id);
    else if (r.hierarchy_level === 'zone') zoneIds.add(r.level_id);
    else if (r.hierarchy_level === 'branch') branchIds.add(r.level_id);
  });

  // Panua chini: conference -> zones -> branches
  zones.forEach(z => { if (confIds.has(z.conference_id)) zoneIds.add(z.id); });
  branches.forEach(b => { if (zoneIds.has(b.zone_id)) branchIds.add(b.id); });

  // topLevel = ngazi ya juu zaidi
  let topLevel: HierarchyLevel | null = null;
  userRoles.forEach(r => {
    if (!topLevel || LEVEL_ORDER[r.hierarchy_level] < LEVEL_ORDER[topLevel]) {
      topLevel = r.hierarchy_level;
    }
  });

  if (isPlainMember) {
    return {
      isUnion: false, isPlainMember: true, topLevel: null,
      conferenceIds: new Set(),
      zoneIds: new Set(),
      branchIds: myBranchId ? new Set([myBranchId]) : new Set(),
      startLevel: 'members',
      startConferenceId: null, startZoneId: null, startBranchId: myBranchId,
    };
  }

  // Amua wapi kuanzia UI
  let startLevel: Scope['startLevel'] = 'conferences';
  let startConferenceId: string | null = null;
  let startZoneId: string | null = null;
  let startBranchId: string | null = null;

  if (topLevel === 'conference') {
    if (confIds.size === 1) { startLevel = 'zones'; startConferenceId = [...confIds][0]; }
  } else if (topLevel === 'zone') {
    if (zoneIds.size === 1) {
      const zid = [...zoneIds][0];
      const z = zones.find(x => x.id === zid);
      startLevel = 'branches';
      startZoneId = zid;
      startConferenceId = z?.conference_id || null;
    }
  } else if (topLevel === 'branch') {
    if (branchIds.size === 1) {
      const bid = [...branchIds][0];
      const b = branches.find(x => x.id === bid);
      const z = b ? zones.find(x => x.id === b.zone_id) : null;
      startLevel = 'members';
      startBranchId = bid;
      startZoneId = b?.zone_id || null;
      startConferenceId = z?.conference_id || null;
    }
  }

  return {
    isUnion: false, isPlainMember: false, topLevel,
    conferenceIds: confIds, zoneIds, branchIds,
    startLevel, startConferenceId, startZoneId, startBranchId,
  };
}
