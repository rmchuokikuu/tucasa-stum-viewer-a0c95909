export interface LeaderReportMemberRow {
  name: string;
  branch?: string;
  phone?: string | null;
  institution?: string | null;
}

export interface LeaderReportBranchNode {
  id: string;
  name: string;
  label: 'Branch';
  memberCount: number;
  members: LeaderReportMemberRow[];
}

export interface LeaderReportZoneNode {
  id: string;
  name: string;
  label: 'Zone';
  memberCount: number;
  children: LeaderReportBranchNode[];
}

export interface LeaderReportConferenceNode {
  id: string;
  name: string;
  label: 'Conference';
  memberCount: number;
  children: LeaderReportZoneNode[];
}

export type LeaderReportGroupNode = LeaderReportConferenceNode | LeaderReportZoneNode | LeaderReportBranchNode;

export interface LeaderReportData {
  scopeLevel: 'union' | 'conference' | 'zone' | 'branch';
  scopeName: string;
  counts: {
    conferences?: number;
    zones?: number;
    branches: number;
    members: number;
  };
  groupLabel: string;
  groups: LeaderReportGroupNode[];
}

interface RawMember {
  id: string;
  full_name: string;
  branch_id: string;
  phone?: string | null;
  institution?: string | null;
}

interface RawBranch {
  id: string;
  name: string;
  zone_id: string;
}

interface RawZone {
  id: string;
  name: string;
  conference_id: string;
}

interface RawConference {
  id: string;
  name: string;
  union_id: string;
}

interface BuildLeaderReportArgs {
  scopeLevel: LeaderReportData['scopeLevel'];
  scopeName: string;
  members: RawMember[];
  branches: RawBranch[];
  zones: RawZone[];
  conferences: RawConference[];
  scopedBranchIds: Set<string>;
  scopedZoneIds: Set<string>;
  scopedConfIds: Set<string>;
}

function compareStrings(a: string, b: string) {
  return a.toLowerCase().localeCompare(b.toLowerCase());
}

function sortMembers(members: RawMember[]) {
  return [...members].sort((a, b) => compareStrings(a.full_name, b.full_name));
}

function createMemberRows(members: RawMember[], branchName: string): LeaderReportMemberRow[] {
  return members.map(member => ({
    name: member.full_name,
    branch: branchName,
    phone: member.phone,
    institution: member.institution,
  }));
}

export function buildLeaderReportData({
  scopeLevel,
  scopeName,
  members,
  branches,
  zones,
  conferences,
  scopedBranchIds,
  scopedZoneIds,
  scopedConfIds,
}: BuildLeaderReportArgs): LeaderReportData {
  const scopedMembers = members.filter(member => scopedBranchIds.has(member.branch_id));

  const makeBranchNode = (branch: RawBranch): LeaderReportBranchNode => {
    const branchMembers = sortMembers(scopedMembers.filter(member => member.branch_id === branch.id));
    return {
      id: branch.id,
      name: branch.name,
      label: 'Branch',
      memberCount: branchMembers.length,
      members: createMemberRows(branchMembers, branch.name),
    };
  };

  const makeZoneNode = (zone: RawZone): LeaderReportZoneNode => {
    const zoneBranches = branches
      .filter(branch => branch.zone_id === zone.id && scopedBranchIds.has(branch.id))
      .sort((a, b) => compareStrings(a.name, b.name))
      .map(makeBranchNode);

    return {
      id: zone.id,
      name: zone.name,
      label: 'Zone',
      memberCount: zoneBranches.reduce((sum, branch) => sum + branch.memberCount, 0),
      children: zoneBranches,
    };
  };

  const makeConferenceNode = (conference: RawConference): LeaderReportConferenceNode => {
    const conferenceZones = zones
      .filter(zone => zone.conference_id === conference.id && scopedZoneIds.has(zone.id))
      .sort((a, b) => compareStrings(a.name, b.name))
      .map(makeZoneNode);

    return {
      id: conference.id,
      name: conference.name,
      label: 'Conference',
      memberCount: conferenceZones.reduce((sum, zone) => sum + zone.memberCount, 0),
      children: conferenceZones,
    };
  };

  const groups: LeaderReportGroupNode[] = (() => {
    if (scopeLevel === 'union') {
      return conferences
        .filter(conference => scopedConfIds.has(conference.id))
        .sort((a, b) => compareStrings(a.name, b.name))
        .map(makeConferenceNode);
    }

    if (scopeLevel === 'conference') {
      return zones
        .filter(zone => scopedZoneIds.has(zone.id))
        .sort((a, b) => compareStrings(a.name, b.name))
        .map(makeZoneNode);
    }

    if (scopeLevel === 'zone') {
      return branches
        .filter(branch => scopedBranchIds.has(branch.id))
        .sort((a, b) => compareStrings(a.name, b.name))
        .map(makeBranchNode);
    }

    return [];
  })();

  const counts = {
    conferences: scopeLevel === 'union' ? scopedConfIds.size : undefined,
    zones: scopeLevel === 'union' || scopeLevel === 'conference' ? scopedZoneIds.size : undefined,
    branches: scopedBranchIds.size,
    members: scopedMembers.length,
  };

  return {
    scopeLevel,
    scopeName,
    counts,
    groupLabel: scopeLevel === 'union' ? 'Conference' : scopeLevel === 'conference' ? 'Zone' : 'Branch',
    groups,
  };
}
