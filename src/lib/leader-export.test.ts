import { describe, expect, it } from 'vitest';
import { buildLeaderExportData } from './leader-export';
import { exportLeaderExportCSV, exportLeaderExportExcel, exportLeaderExportPDF } from './exports';

describe('leader export helpers', () => {
  it('exports the leader export helper functions from the exports module', () => {
    expect(typeof exportLeaderExportCSV).toBe('function');
    expect(typeof exportLeaderExportExcel).toBe('function');
    expect(typeof exportLeaderExportPDF).toBe('function');
  });
});

describe('buildLeaderExportData', () => {
  it('filters leaders to the selected conference scope and sorts by hierarchy, position, and name', () => {
    const leaderRows = buildLeaderExportData({
      scopeLevel: 'conference',
      scopeName: 'Conference Alpha',
      userRoles: [
        { id: 'ur1', user_id: 'u1', role_id: 'r1', hierarchy_level: 'conference', level_id: 'c1', is_active: true, end_date: null },
        { id: 'ur2', user_id: 'u2', role_id: 'r2', hierarchy_level: 'zone', level_id: 'z1', is_active: true, end_date: null },
        { id: 'ur3', user_id: 'u3', role_id: 'r3', hierarchy_level: 'branch', level_id: 'b1', is_active: true, end_date: null },
        { id: 'ur4', user_id: 'u4', role_id: 'r4', hierarchy_level: 'conference', level_id: 'c2', is_active: true, end_date: null },
      ],
      roles: [{ id: 'r1', name: 'Chairperson' }, { id: 'r2', name: 'Secretary' }, { id: 'r3', name: 'Treasurer' }, { id: 'r4', name: 'Chairperson' }],
      profiles: [
        { user_id: 'u1', full_name: 'Bob', email: 'bob@example.com', phone: '111', gender: 'Male' },
        { user_id: 'u2', full_name: 'Alice', email: 'alice@example.com', phone: '222', gender: 'Female' },
        { user_id: 'u3', full_name: 'Carol', email: 'carol@example.com', phone: '333', gender: 'Female' },
        { user_id: 'u4', full_name: 'Zed', email: 'zed@example.com', phone: '444', gender: 'Male' },
      ],
      unions: [{ id: 'u', name: 'Union Name' }],
      conferences: [{ id: 'c1', name: 'Conference Alpha', union_id: 'u' }, { id: 'c2', name: 'Conference Beta', union_id: 'u' }],
      zones: [{ id: 'z1', name: 'Zone One', conference_id: 'c1' }, { id: 'z2', name: 'Zone Two', conference_id: 'c2' }],
      branches: [{ id: 'b1', name: 'Branch One', zone_id: 'z1' }, { id: 'b2', name: 'Branch Two', zone_id: 'z2' }],
      scopedConferenceIds: new Set(['c1']),
      scopedZoneIds: new Set(['z1']),
      scopedBranchIds: new Set(['b1']),
    });

    expect(leaderRows.summary.totalLeaders).toBe(3);
    expect(leaderRows.summary.conferenceLeaders).toBe(1);
    expect(leaderRows.summary.zoneLeaders).toBe(1);
    expect(leaderRows.summary.branchLeaders).toBe(1);
    expect(leaderRows.rows.map(row => row.full_name)).toEqual(['Bob', 'Alice', 'Carol']);
    expect(leaderRows.rows[0].conference_name).toBe('Conference Alpha');
    expect(leaderRows.rows[1].scope_level).toBe('Zone');
    expect(leaderRows.rows[2].branch_name).toBe('Branch One');
  });
});
