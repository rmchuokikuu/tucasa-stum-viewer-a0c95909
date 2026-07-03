import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Button } from '@/components/ui/button';
import { Users, TrendingUp, Building2, MapPin, ArrowLeft, UserCircle, CheckCircle2, XCircle } from 'lucide-react';
import { ExportMenu } from '@/components/ExportMenu';
import { useAuth } from '@/contexts/AuthContext';
import { SEO } from '@/components/SEO';

const CHART_COLORS = [
  'hsl(142, 60%, 35%)',
  'hsl(38, 90%, 55%)',
  'hsl(210, 80%, 50%)',
  'hsl(340, 65%, 50%)',
  'hsl(270, 60%, 50%)',
  'hsl(180, 50%, 40%)',
  'hsl(20, 80%, 50%)',
  'hsl(100, 50%, 40%)',
];

type Stat = { name: string; members: number; active: number; children?: number };

interface HierarchyExportRow {
  [key: string]: string | number;
  Union: string;
  Conference: string;
  Zone: string;
  Branch: string;
  Members: number;
  Active: number;
}

type ScopeMode = 'personal' | 'branch' | 'zone' | 'conference' | 'union';

export default function Reports() {
  const navigate = useNavigate();
  const { highestLevel, userRoles, user, isSuperAdmin, profile } = useAuth();
  const [primaryStats, setPrimaryStats] = useState<Stat[]>([]);
  const [hierarchyRows, setHierarchyRows] = useState<HierarchyExportRow[]>([]);
  const [mode, setMode] = useState<ScopeMode>('personal');
  const [personal, setPersonal] = useState<{
    full_name: string; email: string | null; phone: string | null; institution: string | null;
    is_active: boolean; branch_name?: string; zone_name?: string; conference_name?: string; union_name?: string;
    course?: string | null; course_duration?: number | null; year_of_study?: number | null;
  } | null>(null);
  const [totals, setTotals] = useState({ members: 0, active: 0, zones: 0, conferences: 0, branches: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const [membersRes, branchesRes, zonesRes, confsRes, unionsRes] = await Promise.all([
        supabase.from('members').select('id, full_name, is_active, branch_id, user_id, phone, institution, email'),
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
          return { name: c.name, members: cMembers.length, active: cMembers.filter(m => m.is_active).length, children: cZones.length };
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
          return { name: z.name, members: zMembers.length, active: zMembers.filter(m => m.is_active).length, children: zBranchIds.size };
        }).sort((a, b) => b.members - a.members);
      } else if (isZone) {
        scopedMode = 'zone';
        userRoles.forEach(r => { if (r.hierarchy_level === 'zone') scopedZoneIds.add(r.level_id); });
        const myBranches = branches.filter(b => scopedZoneIds.has(b.zone_id));
        scopedBranchIds = new Set(myBranches.map(b => b.id));
        scopedConfIds = new Set(zones.filter(z => scopedZoneIds.has(z.id)).map(z => z.conference_id));
        primary = myBranches.map(b => {
          const bMembers = members.filter(m => m.branch_id === b.id);
          return { name: b.name, members: bMembers.length, active: bMembers.filter(m => m.is_active).length };
        }).sort((a, b) => b.members - a.members);
      } else if (isBranch) {
        scopedMode = 'branch';
        userRoles.forEach(r => { if (r.hierarchy_level === 'branch') scopedBranchIds.add(r.level_id); });
        scopedZoneIds = new Set(branches.filter(b => scopedBranchIds.has(b.id)).map(b => b.zone_id));
        scopedConfIds = new Set(zones.filter(z => scopedZoneIds.has(z.id)).map(z => z.conference_id));
        // For branch — show members individually
        const myBranches = branches.filter(b => scopedBranchIds.has(b.id));
        primary = myBranches.map(b => {
          const bMembers = members.filter(m => m.branch_id === b.id);
          return { name: b.name, members: bMembers.length, active: bMembers.filter(m => m.is_active).length };
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
            email: (me as any).email,
            phone: (me as any).phone,
            institution: (me as any).institution,
            is_active: me.is_active,
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

      // Totals within scope
      const scopedMembers = members.filter(m => scopedBranchIds.has(m.branch_id));
      setTotals({
        members: scopedMembers.length,
        active: scopedMembers.filter(m => m.is_active).length,
        zones: scopedZoneIds.size,
        conferences: scopedConfIds.size,
        branches: scopedBranchIds.size,
      });

      // Full hierarchy export within scope
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
          Active: bMembers.filter(m => m.is_active).length,
        };
      }).sort((a, b) =>
        a.Conference.localeCompare(b.Conference) ||
        a.Zone.localeCompare(b.Zone) ||
        a.Branch.localeCompare(b.Branch)
      );

      setMode(scopedMode);
      setPrimaryStats(primary);
      setHierarchyRows(hRows);
      setLoading(false);
    };
    fetchData();
  }, [userRoles, user, isSuperAdmin, profile]);

  const activeRate = totals.members > 0 ? Math.round((totals.active / totals.members) * 100) : 0;

  const chartConfig = Object.fromEntries(
    primaryStats.map((c, i) => [c.name, { label: c.name, color: CHART_COLORS[i % CHART_COLORS.length] }])
  );

  if (loading) {
    return (
      <DashboardLayout>
        <SEO title="Reports" description="Loading TUCASA STUM reports and membership analytics." />
        <div className="flex items-center justify-center py-20">
          <p className="text-muted-foreground">Loading reports...</p>
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

  return (
    <DashboardLayout>
      <SEO title="Reports" description="View membership reports scoped to your hierarchy in TUCASA STUM." />
      <div className="page-header flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="page-title text-2xl sm:text-3xl">Reports</h1>
          <p className="page-description text-sm">{scopeLabel} — statistics auto-filtered to your scope.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navigate('/dashboard')} className="h-10 w-10 rounded-full" aria-label="Back to dashboard">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          {mode !== 'personal' && (
            <ExportMenu
              rows={hierarchyRows}
              filename="tucasa-hierarchy-report"
              title="TUCASA Hierarchy Report (Union → Conference → Zone → Branch)"
            />
          )}
        </div>
      </div>

      {mode === 'personal' && personal && (
        <Card className="premium-card-hover mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg font-display">
              <UserCircle className="h-5 w-5 text-primary" /> {personal.full_name}
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm flex items-center gap-1">
              {personal.is_active
                ? <><CheckCircle2 className="h-3.5 w-3.5 text-success" /> Active member</>
                : <><XCircle className="h-3.5 w-3.5 text-destructive" /> Inactive</>}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {personal.email && <div><span className="text-muted-foreground">Email:</span> {personal.email}</div>}
            {personal.phone && <div><span className="text-muted-foreground">Phone:</span> {personal.phone}</div>}
            {personal.institution && <div><span className="text-muted-foreground">Institution:</span> {personal.institution}</div>}
            {personal.course && <div><span className="text-muted-foreground">Course:</span> {personal.course}</div>}
            {personal.course_duration != null && <div><span className="text-muted-foreground">Duration:</span> {personal.course_duration} yrs</div>}
            {personal.year_of_study != null && <div><span className="text-muted-foreground">Year of Study:</span> {personal.year_of_study}</div>}
            {personal.union_name && <div><span className="text-muted-foreground">Union:</span> {personal.union_name}</div>}
            {personal.conference_name && <div><span className="text-muted-foreground">Conference:</span> {personal.conference_name}</div>}
            {personal.zone_name && <div><span className="text-muted-foreground">Zone:</span> {personal.zone_name}</div>}
            {personal.branch_name && <div><span className="text-muted-foreground">Branch:</span> {personal.branch_name}</div>}
          </CardContent>
        </Card>
      )}

      {mode !== 'personal' && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
            <Card className="premium-card-hover stat-card p-3 sm:p-6">
              <CardHeader className="flex flex-row items-center justify-between pb-1 p-0">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Total Members</CardTitle>
                <Users className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent className="p-0 pt-1">
                <div className="text-2xl sm:text-3xl font-bold font-display">{totals.members}</div>
              </CardContent>
            </Card>
            <Card className="premium-card-hover stat-card p-3 sm:p-6">
              <CardHeader className="flex flex-row items-center justify-between pb-1 p-0">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Active Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-success" />
              </CardHeader>
              <CardContent className="p-0 pt-1">
                <div className="text-2xl sm:text-3xl font-bold font-display">{activeRate}%</div>
              </CardContent>
            </Card>
            <Card className="premium-card-hover stat-card p-3 sm:p-6">
              <CardHeader className="flex flex-row items-center justify-between pb-1 p-0">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">{mode === 'branch' ? 'Branches' : mode === 'zone' ? 'Branches' : 'Zones'}</CardTitle>
                <MapPin className="h-4 w-4 text-warning" />
              </CardHeader>
              <CardContent className="p-0 pt-1">
                <div className="text-2xl sm:text-3xl font-bold font-display">{mode === 'zone' || mode === 'branch' ? totals.branches : totals.zones}</div>
              </CardContent>
            </Card>
            <Card className="premium-card-hover stat-card p-3 sm:p-6">
              <CardHeader className="flex flex-row items-center justify-between pb-1 p-0">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Conferences</CardTitle>
                <Building2 className="h-4 w-4 text-info" />
              </CardHeader>
              <CardContent className="p-0 pt-1">
                <div className="text-2xl sm:text-3xl font-bold font-display">{totals.conferences}</div>
              </CardContent>
            </Card>
          </div>

          {/* Primary Bar Chart */}
          <Card className="premium-card-hover mb-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-base sm:text-lg font-display">{primaryTitle[mode]}</CardTitle>
              <CardDescription className="text-xs sm:text-sm">{primaryDesc[mode]}</CardDescription>
            </CardHeader>
            <CardContent className="px-2 sm:px-6">
              {primaryStats.length > 0 ? (
                <ChartContainer config={chartConfig} className="h-[260px] sm:h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={primaryStats} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                      <defs>
                        <linearGradient id="primaryGradient" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor="hsl(142, 60%, 45%)" stopOpacity={0.98} />
                          <stop offset="100%" stopColor="hsl(142, 60%, 35%)" stopOpacity={0.86} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={70} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="members" fill="url(#primaryGradient)" radius={[8, 8, 0, 0]} animationDuration={900} name="Members" />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              ) : (
                <p className="text-muted-foreground text-sm py-8 text-center">No data available</p>
              )}
            </CardContent>
          </Card>

          {/* Distribution Pie */}
          <Card className="premium-card-hover">
            <CardHeader className="pb-2">
              <CardTitle className="text-base sm:text-lg font-display">Distribution</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Share of members across your scope</CardDescription>
            </CardHeader>
            <CardContent>
              {primaryStats.length > 0 ? (
                <ChartContainer config={chartConfig} className="h-[280px] w-full">
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                    <Pie
                      data={primaryStats}
                      dataKey="members"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
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
                <p className="text-muted-foreground text-sm py-8 text-center">No data</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </DashboardLayout>
  );
}
