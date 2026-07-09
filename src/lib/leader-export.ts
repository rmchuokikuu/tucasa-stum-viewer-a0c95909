export type ExportScopeLevel = 'union' | 'conference' | 'zone' | 'branch';

export interface LeaderExportRow {
  full_name: string;
  leadership_position: string;
  scope_level: 'Union' | 'Conference' | 'Zone' | 'Branch';
  union_name: string;
  conference_name: string;
  zone_name: string;
  branch_name: string;
  phone: string;
  email: string;
  gender: string;
  status: string;
}

export interface LeaderExportSummary {
  totalLeaders: number;
  unionLeaders: number;
  conferenceLeaders: number;
  zoneLeaders: number;
  branchLeaders: number;
}

export interface LeaderExportData {
  scopeLevel: ExportScopeLevel;
  scopeName: string;
  summary: LeaderExportSummary;
  rows: LeaderExportRow[];
}

interface LeaderRoleRecord {
  id: string;
  user_id: string;
  role_id: string;
  hierarchy_level: ExportScopeLevel;
  level_id: string;
  is_active: boolean;
  end_date: string | null;
}

interface LeaderRoleName {
  id: string;
  name: string;
}

interface LeaderProfile {
  user_id: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  gender?: string | null;
}

interface LeaderHierarchyNode {
  id: string;
  name: string;
  union_id?: string;
  conference_id?: string;
  zone_id?: string;
}

interface BuildLeaderExportArgs {
  scopeLevel: ExportScopeLevel;
  scopeName: string;
  userRoles: LeaderRoleRecord[];
  roles: LeaderRoleName[];
  profiles: LeaderProfile[];
  unions: LeaderHierarchyNode[];
  conferences: LeaderHierarchyNode[];
  zones: LeaderHierarchyNode[];
  branches: LeaderHierarchyNode[];
  scopedConferenceIds: Set<string>;
  scopedZoneIds: Set<string>;
  scopedBranchIds: Set<string>;
}

function compareStrings(a: string, b: string) {
  return a.toLowerCase().localeCompare(b.toLowerCase());
}

function getLevelLabel(level: ExportScopeLevel): LeaderExportRow['scope_level'] {
  return level === 'union'
    ? 'Union'
    : level === 'conference'
      ? 'Conference'
      : level === 'zone'
        ? 'Zone'
        : 'Branch';
}

export function buildLeaderExportData({
  scopeLevel,
  scopeName,
  userRoles,
  roles,
  profiles,
  unions,
  conferences,
  zones,
  branches,
  scopedConferenceIds,
  scopedZoneIds,
  scopedBranchIds,
}: BuildLeaderExportArgs): LeaderExportData {
  const roleMap = new Map(roles.map(role => [role.id, role.name]));
  const profileMap = new Map(profiles.map(profile => [profile.user_id, profile]));
  const unionMap = new Map(unions.map(union => [union.id, union.name]));
  const conferenceMap = new Map(conferences.map(conference => [conference.id, conference]));
  const zoneMap = new Map(zones.map(zone => [zone.id, zone]));
  const branchMap = new Map(branches.map(branch => [branch.id, branch]));

  const filteredRoles = userRoles.filter(role => {
    if (scopeLevel === 'union') {
      return true;
    }
    if (scopeLevel === 'conference') {
      return role.hierarchy_level === 'conference'
        ? scopedConferenceIds.has(role.level_id)
        : role.hierarchy_level === 'zone'
          ? scopedZoneIds.has(role.level_id)
          : role.hierarchy_level === 'branch'
            ? scopedBranchIds.has(role.level_id)
            : false;
    }
    if (scopeLevel === 'zone') {
      return role.hierarchy_level === 'zone'
        ? scopedZoneIds.has(role.level_id)
        : role.hierarchy_level === 'branch'
          ? scopedBranchIds.has(role.level_id)
          : false;
    }
    return role.hierarchy_level === 'branch' && scopedBranchIds.has(role.level_id);
  });

  const rows = filteredRoles
    .map(role => {
      const profile = profileMap.get(role.user_id);
      const levelName = role.hierarchy_level === 'union'
        ? unionMap.get(role.level_id) || ''
        : role.hierarchy_level === 'conference'
          ? conferenceMap.get(role.level_id)?.name || ''
          : role.hierarchy_level === 'zone'
            ? zoneMap.get(role.level_id)?.name || ''
            : branchMap.get(role.level_id)?.name || '';

      let unionName = '';
      let conferenceName = '';
      let zoneName = '';
      let branchName = '';

      if (role.hierarchy_level === 'union') {
        unionName = unionMap.get(role.level_id) || '';
      } else if (role.hierarchy_level === 'conference') {
        const conference = conferenceMap.get(role.level_id);
        unionName = conference ? unionMap.get(conference.union_id || '') || '' : '';
        conferenceName = conference?.name || '';
      } else if (role.hierarchy_level === 'zone') {
        const zone = zoneMap.get(role.level_id);
        const conference = zone ? conferenceMap.get(zone.conference_id || '') : null;
        unionName = conference ? unionMap.get(conference.union_id || '') || '' : '';
        conferenceName = conference?.name || '';
        zoneName = zone?.name || '';
      } else if (role.hierarchy_level === 'branch') {
        const branch = branchMap.get(role.level_id);
        const zone = branch ? zoneMap.get(branch.zone_id || '') : null;
        const conference = zone ? conferenceMap.get(zone.conference_id || '') : null;
        unionName = conference ? unionMap.get(conference.union_id || '') || '' : '';
        conferenceName = conference?.name || '';
        zoneName = zone?.name || '';
        branchName = branch?.name || '';
      }

      return {
        full_name: (profile?.full_name || 'Unknown').replace(/\s+/g, ' ').trim().toUpperCase(),
        leadership_position: roleMap.get(role.role_id) || 'Unknown',
        scope_level: getLevelLabel(role.hierarchy_level),
        union_name: unionName,
        conference_name: conferenceName,
        zone_name: zoneName,
        branch_name: branchName,
        phone: profile?.phone || '',
        email: profile?.email || '',
        gender: profile?.gender || '',
        status: role.is_active ? 'Active' : 'Inactive',
      } satisfies LeaderExportRow;
    })
    .sort((a, b) => {
      const hierarchyOrder = { Union: 0, Conference: 1, Zone: 2, Branch: 3 } as const;
      const levelRank = hierarchyOrder[a.scope_level] - hierarchyOrder[b.scope_level];
      if (levelRank !== 0) return levelRank;
      const positionRank = compareStrings(a.leadership_position, b.leadership_position);
      if (positionRank !== 0) return positionRank;
      return compareStrings(a.full_name, b.full_name);
    });

  const summary: LeaderExportSummary = {
    totalLeaders: rows.length,
    unionLeaders: rows.filter(row => row.scope_level === 'Union').length,
    conferenceLeaders: rows.filter(row => row.scope_level === 'Conference').length,
    zoneLeaders: rows.filter(row => row.scope_level === 'Zone').length,
    branchLeaders: rows.filter(row => row.scope_level === 'Branch').length,
  };

  return {
    scopeLevel,
    scopeName,
    summary,
    rows,
  };
}
