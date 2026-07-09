import { describe, expect, it } from 'vitest';
import { buildLeaderReportData } from './leader-report';

describe('buildLeaderReportData', () => {
  it('builds a full conference → zone → branch → member hierarchy for union reports', () => {
    const members = [
      { id: 'm3', full_name: 'Zoe', branch_id: 'b2', phone: null, institution: 'Campus 2' },
      { id: 'm1', full_name: 'Alice', branch_id: 'b1', phone: null, institution: 'Campus 1' },
      { id: 'm2', full_name: 'Bob', branch_id: 'b2', phone: null, institution: 'Campus 2' },
    ];
    const branches = [
      { id: 'b1', name: 'Branch A', zone_id: 'z1' },
      { id: 'b2', name: 'Branch B', zone_id: 'z2' },
    ];
    const zones = [
      { id: 'z1', name: 'Zone A', conference_id: 'c1' },
      { id: 'z2', name: 'Zone B', conference_id: 'c1' },
    ];
    const conferences = [{ id: 'c1', name: 'Conference Alpha', union_id: 'u1' }];

    const data = buildLeaderReportData({
      scopeLevel: 'union',
      scopeName: 'Union',
      members,
      branches,
      zones,
      conferences,
      unions: [{ id: 'u1', name: 'Union' }],
      scopedBranchIds: new Set(['b1', 'b2']),
      scopedZoneIds: new Set(['z1', 'z2']),
      scopedConfIds: new Set(['c1']),
    });

    expect(data.groups).toHaveLength(1);
    const conference = data.groups[0] as import('./leader-report').LeaderReportConferenceNode;
    expect(conference.label).toBe('Conference');
    expect(conference.name).toBe('Conference Alpha');
    expect(conference.memberCount).toBe(3);
    expect(conference.children.map(child => child.name)).toEqual(['Zone A', 'Zone B']);

    const firstZone = conference.children[0];
    expect(firstZone.memberCount).toBe(1);
    expect(firstZone.children[0].name).toBe('Branch A');
    expect(firstZone.children[0].members.map(member => member.name)).toEqual(['ALICE']);

    const secondZone = conference.children[1];
    expect(secondZone.memberCount).toBe(2);
    expect(secondZone.children[0].members.map(member => member.name)).toEqual(['BOB', 'ZOE']);
  });
});
