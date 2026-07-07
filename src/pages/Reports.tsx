import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, PieChart, Pie, Cell, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Users, Building2, MapPin, ArrowLeft, UserCircle } from 'lucide-react';
import { ExportMenu } from '@/components/ExportMenu';
import type { LeaderReportData } from '@/lib/exports';
import { useAuth } from '@/contexts/AuthContext';
import { SEO } from '@/components/SEO';
import { GlassCard, GlassPanel, GlassButton } from '@/components/glass';

// Glass-friendly chart palette — white/blue translucent
const CHART_COLORS = [
  'rgba(255,255,255,0.92)',
  'rgba(186,230,253,0.85)',
  'rgba(147,197,253,0.85)',
  'rgba(96,165,250,0.85)',
  'rgba(59,130,246,0.85)',
  'rgba(191,219,254,0.85)',
  'rgba(219,234,254,0.85)',
  'rgba(125,211,252,0.85)',
];

type Stat = { name: string; members: number; children?: number };

interface HierarchyExportRow {
  [key: string]: string | number;
  Union: string;
  Conference: string;
  Zone: string;
  Branch: string;
  Members: number;
}

type ScopeMode = 'personal' | 'branch' | 'zone' | 'conference' | 'union';

function StatTile({ title, value, Icon }: { title: string; value: string | number; Icon: React.ComponentType<{ className?: string }> }) {
  return (
    <GlassCard className="p-4 sm:p-5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] uppercase tracking-[0.2em] text-white/70 font-medium">{title}</p>
        <Icon className="h-4 w-4 text-white/80" />
      </div>
      <div className="text-2xl sm:text-3xl font-semibold text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)]">{value}</div>
    </GlassCard>
  );
}

export default function Reports() {
  const navigate = useNavigate();
  const { highestLevel, userRoles, user, isSuperAdmin, profile } = useAuth();
  const [primaryStats, setPrimaryStats] = useState<Stat[]>([]);
  const [hierarchyRows, setHierarchyRows] = useState<HierarchyExportRow[]>([]);
  const [mode, setMode] = useState<ScopeMode>('personal');
  const [personal, setPersonal] = useState<{
    full_name: string; phone: string | null; institution: string | null;
    branch_name?: string; zone_name?: string; conference_name?: string; union_name?: string;
    course?: string | null; course_duration?: number | null; year_of_study?: number | null;
  } | null>(null);
  const [totals, setTotals] = useState({ members: 0, zones: 0, conferences: 0, branches: 0 });
  const [leaderReport, setLeaderReport] = useState<LeaderReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const [membersRes, branchesRes, zonesRes, confsRes, unionsRes] = await Promise.all([
        supabase.from('members').select('id, full_name, is_active, branch_id, user_id, phone, institution'),
        supabase.from('branches').select('id, name, zone_id'),
        supabase.from('zones').select('id, name, conference_id'),
        supabase.from('conferences').select('id, name, union_id'),
        supabase.from('unions').select('id, name'),
      ]);

      const members = membersRes.data || [];
      const branches = branchesRes.data || [];
      const zones = zonesRes.data || [];
      const conferences = confsRes.data || [];
      const unions = unionsRes.data || [];

      const isUnion = isSuperAdmin || userRoles.some(r => r.hierarchy_level === 'union');
      const isConf = !isUnion && userRoles.some(r => r.hierarchy_level === 'conference');
      const isZone = !isUnion && !isConf && userRoles.some(r => r.hierarchy_level === 'zone');
      const isBranch = !isUnion && !isConf && !isZone && userRoles.some(r => r.hierarchy_level === 'branch');
      const isPlain = userRoles.length === 0 && !isSuperAdmin;

      let scopedMode: ScopeMode = 'personal';
      let scopedBranchIds = new Set<string>();
      let scopedZoneIds = new Set<string>();
      let scopedConfIds = new Set<string>();
      let primary: Stat[] = [];

      if (isUnion) {
        scopedMode = 'union';
        scopedConfIds = new Set(conferences.map(c => c.id));
        scopedZoneIds = new Set(zones.map(z => z.id));
        scopedBranchIds = new Set(branches.map(b => b.id));
        primary = conferences.map(c => {
          const cZones = zones.filter(z => z.conference_id === c.id);
          const cBranchIds = new Set(branches.filter(b => cZones.some(z => z.id === b.zone_id)).map(b => b.id));
          const cMembers = members.filter(m => cBranchIds.has(m.branch_id));
          return { name: c.name, members: cMembers.length, children: cZones.length };
        }).sort((a, b) => b.members - a.members);
      } else if (isConf) {
        scopedMode = 'conference';
        userRoles.forEach(r => { if (r.hierarchy_level === 'conference') scopedConfIds.add(r.level_id); });
        const myZones = zones.filter(z => scopedConfIds.has(z.conference_id));
        scopedZoneIds = new Set(myZones.map(z => z.id));
        scopedBranchIds = new Set(branches.filter(b => scopedZoneIds.has(b.zone_id)).map(b => b.id));
        primary = myZones.map(z => {
          const zBranchIds = new Set(branches.filter(b => b.zone_id === z.id).map(b => b.id));
          const zMembers = members.filter(m => zBranchIds.has(m.branch_id));
          return { name: z.name, members: zMembers.length, children: zBranchIds.size };
        }).sort((a, b) => b.members - a.members);
      } else if (isZone) {
        scopedMode = 'zone';
        userRoles.forEach(r => { if (r.hierarchy_level === 'zone') scopedZoneIds.add(r.level_id); });
        const myBranches = branches.filter(b => scopedZoneIds.has(b.zone_id));
        scopedBranchIds = new Set(myBranches.map(b => b.id));
        scopedConfIds = new Set(zones.filter(z => scopedZoneIds.has(z.id)).map(z => z.conference_id));
        primary = myBranches.map(b => {
          const bMembers = members.filter(m => m.branch_id === b.id);
          return { name: b.name, members: bMembers.length };
        }).sort((a, b) => b.members - a.members);
      } else if (isBranch) {
        scopedMode = 'branch';
        userRoles.forEach(r => { if (r.hierarchy_level === 'branch') scopedBranchIds.add(r.level_id); });
        scopedZoneIds = new Set(branches.filter(b => scopedBranchIds.has(b.id)).map(b => b.zone_id));
        scopedConfIds = new Set(zones.filter(z => scopedZoneIds.has(z.id)).map(z => z.conference_id));
        const myBranches = branches.filter(b => scopedBranchIds.has(b.id));
        primary = myBranches.map(b => {
          const bMembers = members.filter(m => m.branch_id === b.id);
          return { name: b.name, members: bMembers.length };
        });
      } else if (isPlain) {
        scopedMode = 'personal';
        const me = members.find(m => (m as any).user_id === user?.id);
        if (me) {
          const b: any = branches.find(x => x.id === me.branch_id);
          const z: any = b ? zones.find(x => x.id === b.zone_id) : null;
          const c: any = z ? conferences.find(x => x.id === z.conference_id) : null;
          const u: any = c ? unions.find(x => x.id === c.union_id) : null;
          setPersonal({
            full_name: me.full_name,
            phone: (me as any).phone,
            institution: (me as any).institution,
            branch_name: b?.name,
            zone_name: z?.name,
            conference_name: c?.name,
            union_name: u?.name,
            course: profile?.course,
            course_duration: profile?.course_duration,
            year_of_study: profile?.year_of_study,
          });
          scopedBranchIds.add(me.branch_id);
        }
      }

      const scopedMembers = members.filter(m => scopedBranchIds.has(m.branch_id));
      setTotals({
        members: scopedMembers.length,
        zones: scopedZoneIds.size,
        conferences: scopedConfIds.size,
        branches: scopedBranchIds.size,
      });

      const unionMap = new Map(unions.map(u => [u.id, u.name]));
      const confMap = new Map(conferences.map(c => [c.id, c]));
      const zoneMap = new Map(zones.map(z => [z.id, z]));
      const scopedBranches = branches.filter(b => scopedBranchIds.has(b.id));
      const hRows: HierarchyExportRow[] = scopedBranches.map(b => {
        const z: any = zoneMap.get(b.zone_id);
        const c: any = z ? confMap.get(z.conference_id) : null;
        const uName = c ? (unionMap.get(c.union_id) || '') : '';
        const bMembers = scopedMembers.filter(m => m.branch_id === b.id);
        return {
          Union: uName,
          Conference: c?.name || '',
          Zone: z?.name || '',
          Branch: b.name,
          Members: bMembers.length,
        };
      }).sort((a, b) =>
        a.Conference.localeCompare(b.Conference) ||
        a.Zone.localeCompare(b.Zone) ||
        a.Branch.localeCompare(b.Branch)
      );

      setMode(scopedMode);
      setPrimaryStats(primary);
      setHierarchyRows(hRows);

      // Build leader report (grouped members by sub-level)
      if (scopedMode !== 'personal') {
        const branchName = (id: string) => branches.find(b => b.id === id)?.name || '';
        const memberRow = (m: any) => ({
          name: m.full_name,
          branch: branchName(m.branch_id),
          phone: m.phone,
          institution: m.institution,
        });
        const sortMembers = <T extends { name: string }>(arr: T[]) =>
          [...arr].sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

        let groupLabel = 'Branch';
        let groups: { name: string; members: ReturnType<typeof memberRow>[] }[] = [];
        let scopeName = '';

        if (scopedMode === 'union') {
          groupLabel = 'Conference';
          scopeName = unions[0]?.name || 'Union';
          groups = conferences
            .map(c => {
              const cZones = zones.filter(z => z.conference_id === c.id);
              const cBranchIds = new Set(branches.filter(b => cZones.some(z => z.id === b.zone_id)).map(b => b.id));
              const gm = scopedMembers.filter(m => cBranchIds.has(m.branch_id)).map(memberRow);
              return { name: c.name, members: gm };
            })
            .filter(g => g.members.length > 0);
        } else if (scopedMode === 'conference') {
          groupLabel = 'Zone';
          const myConfs = conferences.filter(c => scopedConfIds.has(c.id));
          scopeName = myConfs.map(c => c.name).join(', ') || 'Conference';
          groups = zones
            .filter(z => scopedConfIds.has(z.conference_id))
            .map(z => {
              const zBranchIds = new Set(branches.filter(b => b.zone_id === z.id).map(b => b.id));
              const gm = scopedMembers.filter(m => zBranchIds.has(m.branch_id)).map(memberRow);
              return { name: z.name, members: gm };
            })
            .filter(g => g.members.length > 0);
        } else if (scopedMode === 'zone') {
          groupLabel = 'Branch';
          const myZones = zones.filter(z => scopedZoneIds.has(z.id));
          scopeName = myZones.map(z => z.name).join(', ') || 'Zone';
          groups = branches
            .filter(b => scopedZoneIds.has(b.zone_id))
            .map(b => ({
              name: b.name,
              members: scopedMembers.filter(m => m.branch_id === b.id).map(memberRow),
            }))
            .filter(g => g.members.length > 0);
        } else if (scopedMode === 'branch') {
          groupLabel = 'Branch';
          const myBranches = branches.filter(b => scopedBranchIds.has(b.id));
          scopeName = myBranches.map(b => b.name).join(', ') || 'Branch';
          groups = myBranches.map(b => ({
            name: b.name,
            members: scopedMembers.filter(m => m.branch_id === b.id).map(memberRow),
          }));
        }

        // Alphabetize members within each group and groups by name
        const sortedGroups = groups
          .map(g => ({ ...g, members: sortMembers(g.members) }))
          .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

        setLeaderReport({
          scopeLevel: scopedMode,
          scopeName,
          counts: {
            conferences: scopedMode === 'union' ? scopedConfIds.size : undefined,
            zones: scopedMode === 'union' || scopedMode === 'conference' ? scopedZoneIds.size : undefined,
            branches: scopedBranchIds.size,
            members: scopedMembers.length,
          },
          groupLabel,
          groups: sortedGroups,
        });
      } else {
        setLeaderReport(null);
      }

      setLoading(false);
    };
    fetchData();
  }, [userRoles, user, isSuperAdmin, profile]);

  

  const chartConfig = Object.fromEntries(
    primaryStats.map((c, i) => [c.name, { label: c.name, color: CHART_COLORS[i % CHART_COLORS.length] }])
  );

  if (loading) {
    return (
      <DashboardLayout>
        <SEO title="Reports" description="Loading TUCASA STUM reports and membership analytics." />
        <div className="flex items-center justify-center py-20">
          <p className="text-white/80">Loading reports...</p>
        </div>
      </DashboardLayout>
    );
  }

  const primaryTitle: Record<ScopeMode, string> = {
    union: 'Members by Conference',
    conference: 'Members by Zone',
    zone: 'Members by Branch',
    branch: 'Members in your Branch',
    personal: 'My Personal Report',
  };
  const primaryDesc: Record<ScopeMode, string> = {
    union: 'Roll-up from each conference in the union',
    conference: 'Roll-up from each zone in your conference',
    zone: 'Roll-up from each branch in your zone',
    branch: 'Members belonging to your branch',
    personal: 'Your membership snapshot',
  };

  const scopeLabel = highestLevel
    ? `${highestLevel.charAt(0).toUpperCase()}${highestLevel.slice(1)}-scope reports`
    : mode === 'personal' ? 'My Report' : 'Reports';

  const tooltipContentStyle: React.CSSProperties = {
    background: 'rgba(23,58,130,0.85)',
    border: '1px solid rgba(255,255,255,0.25)',
    borderRadius: 14,
    color: 'white',
    backdropFilter: 'blur(16px)',
  };

  return (
    <DashboardLayout>
      <SEO title="Reports" description="View membership reports scoped to your hierarchy in TUCASA STUM." />

      <GlassPanel
        subtitle={scopeLabel}
        title="Reports"
        className="mb-6"
      >
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <p className="text-sm text-white/80">Statistics auto-filtered to your scope.</p>
          <div className="flex items-center gap-2">
            <GlassButton size="icon" onClick={() => navigate('/dashboard')} className="h-10 w-10 rounded-full" aria-label="Back to dashboard">
              <ArrowLeft className="h-4 w-4" />
            </GlassButton>
            {mode !== 'personal' && (
              <ExportMenu
                rows={hierarchyRows}
                filename={leaderReport ? `tucasa-${leaderReport.scopeLevel}-leader-report` : 'tucasa-hierarchy-report'}
                title="TUCASA Hierarchy Report (Union → Conference → Zone → Branch)"
                leaderReport={leaderReport}
              />
            )}
          </div>
        </div>
      </GlassPanel>

      {mode === 'personal' && personal && (
        <GlassCard className="mb-6">
          <div className="flex items-center gap-2 text-base sm:text-lg font-display text-white mb-1">
            <UserCircle className="h-5 w-5 text-white/90" /> {personal.full_name}
          </div>
          {personal.institution && (
            <div className="text-xs sm:text-sm text-white/80 mb-4">{personal.institution}</div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm text-white">
            {personal.phone && <div><span className="text-white/60">Phone:</span> {personal.phone}</div>}
            {personal.institution && <div><span className="text-white/60">Institution:</span> {personal.institution}</div>}
            {personal.course && <div><span className="text-white/60">Course:</span> {personal.course}</div>}
            {personal.course_duration != null && <div><span className="text-white/60">Duration:</span> {personal.course_duration} yrs</div>}
            {personal.year_of_study != null && <div><span className="text-white/60">Year of Study:</span> {personal.year_of_study}</div>}
            {personal.union_name && <div><span className="text-white/60">Union:</span> {personal.union_name}</div>}
            {personal.conference_name && <div><span className="text-white/60">Conference:</span> {personal.conference_name}</div>}
            {personal.zone_name && <div><span className="text-white/60">Zone:</span> {personal.zone_name}</div>}
            {personal.branch_name && <div><span className="text-white/60">Branch:</span> {personal.branch_name}</div>}
          </div>
        </GlassCard>
      )}

      {mode !== 'personal' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
            <StatTile title="Total Members" value={totals.members} Icon={Users} />
            <StatTile title={mode === 'branch' || mode === 'zone' ? 'Branches' : 'Zones'} value={mode === 'zone' || mode === 'branch' ? totals.branches : totals.zones} Icon={MapPin} />
            <StatTile title="Conferences" value={totals.conferences} Icon={Building2} />
          </div>

          {/* Primary Bar Chart */}
          <GlassCard className="mb-6">
            <div className="mb-3">
              <h2 className="text-base sm:text-lg font-display font-semibold text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)]">{primaryTitle[mode]}</h2>
              <p className="text-xs sm:text-sm text-white/70">{primaryDesc[mode]}</p>
            </div>
            {primaryStats.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[260px] sm:h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={primaryStats} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <defs>
                      <linearGradient id="primaryGradient" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="rgba(255,255,255,0.95)" stopOpacity={0.98} />
                        <stop offset="100%" stopColor="rgba(186,230,253,0.55)" stopOpacity={0.85} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(255,255,255,0.12)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.85)' }} axisLine={{ stroke: 'rgba(255,255,255,0.25)' }} tickLine={false} interval={0} angle={-20} textAnchor="end" height={70} />
                    <YAxis tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.85)' }} axisLine={{ stroke: 'rgba(255,255,255,0.25)' }} tickLine={false} allowDecimals={false} />
                    <ChartTooltip content={<ChartTooltipContent />} wrapperStyle={{ outline: 'none' }} contentStyle={tooltipContentStyle} />
                    <Bar dataKey="members" fill="url(#primaryGradient)" radius={[8, 8, 0, 0]} animationDuration={900} name="Members" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <p className="text-white/70 text-sm py-8 text-center">No data available</p>
            )}
          </GlassCard>

          {/* Distribution Pie */}
          <GlassCard>
            <div className="mb-3">
              <h2 className="text-base sm:text-lg font-display font-semibold text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)]">Distribution</h2>
              <p className="text-xs sm:text-sm text-white/70">Share of members across your scope</p>
            </div>
            {primaryStats.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[280px] w-full">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent nameKey="name" />} contentStyle={tooltipContentStyle} />
                  <Pie
                    data={primaryStats}
                    dataKey="members"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    stroke="rgba(255,255,255,0.35)"
                    label={({ name, members }) => `${name}: ${members}`}
                    labelLine={false}
                  >
                    {primaryStats.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
            ) : (
              <p className="text-white/70 text-sm py-8 text-center">No data</p>
            )}
          </GlassCard>
        </>
      )}
    </DashboardLayout>
  );
}
