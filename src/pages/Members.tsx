import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Edit, Trash2, Mail, Phone, Building, ChevronRight, ArrowLeft, Users, Network, MapPin, GitBranch } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SEO } from '@/components/SEO';
import { ExportMenu } from '@/components/ExportMenu';
import { GlassCard, GlassButton, GlassPanel, GlassOverlay, GlassScrollContainer, GlassItemButton } from '@/components/glass';
import type { Tables } from '@/integrations/supabase/types';

type Member = Tables<'members'>;
type Branch = Tables<'branches'>;
type Zone = Tables<'zones'>;
type Conference = Tables<'conferences'>;

type View =
  | { level: 'conferences' }
  | { level: 'zones'; conference: Conference }
  | { level: 'branches'; conference: Conference; zone: Zone }
  | { level: 'members'; conference: Conference; zone: Zone; branch: Branch };

function DrillCard({ icon: Icon, title, subtitle, count, onClick }: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left group"
    >
      <Card className="premium-card-hover">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm truncate">{title}</h3>
            {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
          </div>
          <div className="text-right shrink-0">
            <div className="text-lg font-semibold leading-none">{count}</div>
            <div className="text-[10px] text-muted-foreground mt-1">members</div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
        </CardContent>
      </Card>
    </button>
  );
}

function MemberCard({ member, canEdit, canDelete, onEdit, onDelete }: {
  member: Member;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (m: Member) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Card className="premium-card-hover mb-3">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-sm truncate">{member.full_name}</h3>
              <Badge variant={member.is_active ? 'default' : 'secondary'} className="text-[10px] shrink-0">
                {member.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <div className="space-y-1 text-xs text-muted-foreground">
              {member.phone && <div className="flex items-center gap-1.5"><Phone className="h-3 w-3 shrink-0" /><span>{member.phone}</span></div>}
              {member.institution && <div className="flex items-center gap-1.5"><Building className="h-3 w-3 shrink-0" /><span>{member.institution}</span></div>}
            </div>
          </div>
          {(canEdit || canDelete) && (
            <div className="flex gap-1 shrink-0">
              {canEdit && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(member)}><Edit className="h-3.5 w-3.5" /></Button>}
              {canDelete && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onDelete(member.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function StatCard({ title, value, icon: Icon, accent }: { title: string; value: number; icon: React.ComponentType<{ className?: string }>; accent: string }) {
  return (
    <Card className="premium-card-hover">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`h-11 w-11 rounded-2xl bg-gradient-to-br ${accent} text-white flex items-center justify-center shadow-lg shadow-black/10`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] tracking-[0.24em] uppercase text-muted-foreground">{title}</p>
          <p className="mt-2 text-xl font-semibold text-foreground">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Members() {
  const navigate = useNavigate();
  const { hasPermission, userRoles, user, isSuperAdmin } = useAuth();
  const { toast } = useToast();
  const [conferences, setConferences] = useState<Conference[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>({ level: 'conferences' });
  const [overlay, setOverlay] = useState<null | { level: 'zones'; conference: Conference } | { level: 'branches'; conference: Conference; zone: Zone }>(null);
  const [restoreOverlay, setRestoreOverlay] = useState<null | { level: 'branches'; conference: Conference; zone: Zone }>(null);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', institution: '', branch_id: '' });
  const [scopeReady, setScopeReady] = useState(false);

  const canAdd = hasPermission('add_member');
  const canEdit = hasPermission('edit_member');
  const canDelete = hasPermission('delete_member');

  // ---- SCOPE COMPUTATION ----
  const isUnion = userRoles.some(r => r.hierarchy_level === 'union') || isSuperAdmin;
  const isPlainMember = userRoles.length === 0 && !isSuperAdmin;

  const { conferenceIds, zoneIds, branchIds } = (() => {
    if (isUnion) {
      return {
        conferenceIds: new Set(conferences.map(c => c.id)),
        zoneIds: new Set(zones.map(z => z.id)),
        branchIds: new Set(branches.map(b => b.id)),
      };
    }
    const cSet = new Set<string>();
    const zSet = new Set<string>();
    const bSet = new Set<string>();
    userRoles.forEach(r => {
      if (r.hierarchy_level === 'conference') cSet.add(r.level_id);
      else if (r.hierarchy_level === 'zone') zSet.add(r.level_id);
      else if (r.hierarchy_level === 'branch') bSet.add(r.level_id);
    });
    zones.forEach(z => { if (cSet.has(z.conference_id)) zSet.add(z.id); });
    branches.forEach(b => { if (zSet.has(b.zone_id)) bSet.add(b.id); });
    // Plain member: only own branch (found via members table lookup below)
    return { conferenceIds: cSet, zoneIds: zSet, branchIds: bSet };
  })();

  const fetchData = async () => {
    const [confRes, zoneRes, branchRes, memberRes] = await Promise.all([
      supabase.from('conferences').select('*').order('name'),
      supabase.from('zones').select('*').order('name'),
      supabase.from('branches').select('*').order('name'),
      supabase.from('members').select('*').order('full_name'),
    ]);
    setConferences(confRes.data || []);
    setZones(zoneRes.data || []);
    setBranches(branchRes.data || []);
    setMembers(memberRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // Set starting view based on scope (once data is loaded)
  useEffect(() => {
    if (loading || scopeReady) return;
    if (isUnion) { setScopeReady(true); return; }

    // Plain member: jump straight to their branch's member list
    if (isPlainMember) {
      (async () => {
        if (!user) { setScopeReady(true); return; }
        const { data: myMember } = await (supabase.from('members') as any)
          .select('branch_id').eq('user_id', user.id).maybeSingle();
        const myBranchId = (myMember as any)?.branch_id;
        const b = branches.find(x => x.id === myBranchId);
        const z = b ? zones.find(x => x.id === b.zone_id) : null;
        const c = z ? conferences.find(x => x.id === z.conference_id) : null;
        if (b && z && c) setView({ level: 'members', conference: c, zone: z, branch: b });
        setScopeReady(true);
      })();
      return;
    }

    // Leader with a single scope: jump into it
    const cIds = [...conferenceIds];
    const zIds = [...zoneIds];
    const bIds = [...branchIds];
    const topLevel = userRoles.reduce<string | null>((best, r) => {
      const order = { union: 0, conference: 1, zone: 2, branch: 3 } as any;
      if (!best || order[r.hierarchy_level] < order[best]) return r.hierarchy_level;
      return best;
    }, null);

    if (topLevel === 'conference' && cIds.length === 1) {
      const c = conferences.find(x => x.id === cIds[0]);
      if (c) setView({ level: 'zones', conference: c });
    } else if (topLevel === 'zone' && zIds.length === 1) {
      const z = zones.find(x => x.id === zIds[0]);
      const c = z ? conferences.find(x => x.id === z.conference_id) : null;
      if (z && c) setView({ level: 'branches', conference: c, zone: z });
    } else if (topLevel === 'branch' && bIds.length === 1) {
      const b = branches.find(x => x.id === bIds[0]);
      const z = b ? zones.find(x => x.id === b.zone_id) : null;
      const c = z ? conferences.find(x => x.id === z.conference_id) : null;
      if (b && z && c) setView({ level: 'members', conference: c, zone: z, branch: b });
    }
    setScopeReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // Counts
  const branchMemberCount = useMemo(() => {
    const map = new Map<string, number>();
    members.forEach(m => map.set(m.branch_id, (map.get(m.branch_id) || 0) + 1));
    return map;
  }, [members]);

  const zoneMemberCount = useMemo(() => {
    const map = new Map<string, number>();
    branches.forEach(b => {
      const c = branchMemberCount.get(b.id) || 0;
      map.set(b.zone_id, (map.get(b.zone_id) || 0) + c);
    });
    return map;
  }, [branches, branchMemberCount]);

  const conferenceMemberCount = useMemo(() => {
    const map = new Map<string, number>();
    zones.forEach(z => {
      const c = zoneMemberCount.get(z.id) || 0;
      map.set(z.conference_id, (map.get(z.conference_id) || 0) + c);
    });
    return map;
  }, [zones, zoneMemberCount]);

  const zoneBranchCount = useMemo(() => {
    const map = new Map<string, number>();
    branches.forEach(b => map.set(b.zone_id, (map.get(b.zone_id) || 0) + 1));
    return map;
  }, [branches]);

  const conferenceZoneCount = useMemo(() => {
    const map = new Map<string, number>();
    zones.forEach(z => map.set(z.conference_id, (map.get(z.conference_id) || 0) + 1));
    return map;
  }, [zones]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim() || !form.branch_id) return;
    if (editing) {
      const { error } = await supabase.from('members').update({
        full_name: form.full_name, phone: form.phone || null,
        institution: form.institution || null, branch_id: form.branch_id,
      }).eq('id', editing.id);
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'Member updated' });
    } else {
      const { error } = await supabase.from('members').insert({
        full_name: form.full_name, phone: form.phone || null,
        institution: form.institution || null, branch_id: form.branch_id,
      });
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'Member added' });
    }
    setDialogOpen(false);
    setEditing(null);
    setForm({ full_name: '', email: '', phone: '', institution: '', branch_id: '' });
    fetchData();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('members').delete().eq('id', id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Member deleted' });
    fetchData();
  };

  const openEdit = (m: Member) => {
    setEditing(m);
    setForm({ full_name: m.full_name, email: '', phone: m.phone || '', institution: m.institution || '', branch_id: m.branch_id });
    setDialogOpen(true);
  };

  const openAddInBranch = (branchId: string) => {
    setEditing(null);
    setForm({ full_name: '', email: '', phone: '', institution: '', branch_id: branchId });
    setDialogOpen(true);
  };

  const openConferenceOverlay = (conference: Conference) => {
    setOverlay({ level: 'zones', conference });
  };

  const openZoneOverlay = (zone: Zone) => {
    if (!overlay || overlay.level !== 'zones') return;
    setOverlay({ level: 'branches', conference: overlay.conference, zone });
  };

  const openBranchFromOverlay = (branch: Branch) => {
    if (!overlay || overlay.level !== 'branches') return;
    setRestoreOverlay({ level: 'branches', conference: overlay.conference, zone: overlay.zone });
    setOverlay(null);
    setSearch('');
    setView({ level: 'members', conference: overlay.conference, zone: overlay.zone, branch });
  };

  // Breadcrumb
  const crumbs: { label: string; onClick?: () => void }[] = [{ label: 'Conferences & Fields', onClick: () => { setView({ level: 'conferences' }); setSearch(''); } }];
  if (view.level !== 'conferences') crumbs.push({ label: view.conference.name, onClick: view.level === 'zones' ? undefined : () => { setView({ level: 'zones', conference: view.conference }); setSearch(''); } });
  if (view.level === 'branches' || view.level === 'members') crumbs.push({ label: view.zone.name, onClick: view.level === 'branches' ? undefined : () => { setView({ level: 'branches', conference: (view as any).conference, zone: view.zone }); setSearch(''); } });
  if (view.level === 'members') crumbs.push({ label: view.branch.name });

  const goBack = () => {
    setSearch('');
    if (view.level === 'members' && restoreOverlay) {
      setOverlay(restoreOverlay);
      setRestoreOverlay(null);
      return;
    }
    if (view.level === 'zones') setView({ level: 'conferences' });
    else if (view.level === 'branches') setView({ level: 'zones', conference: view.conference });
    else if (view.level === 'members') setView({ level: 'branches', conference: view.conference, zone: view.zone });
  };

  // Filtered lists for current view (scope-aware)
  const visibleConfs = conferences
    .filter(c => conferenceIds.has(c.id))
    .filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
  const visibleZones = view.level !== 'conferences'
    ? zones.filter(z => z.conference_id === view.conference.id && zoneIds.has(z.id) && z.name.toLowerCase().includes(search.toLowerCase()))
    : [];
  const visibleBranches = (view.level === 'branches' || view.level === 'members')
    ? branches.filter(b => b.zone_id === view.zone.id && branchIds.has(b.id) && b.name.toLowerCase().includes(search.toLowerCase()))
    : [];
  const visibleMembers = view.level === 'members'
    ? members.filter(m => m.branch_id === view.branch.id && (
        m.full_name.toLowerCase().includes(search.toLowerCase()) ||
        (m.phone?.toLowerCase().includes(search.toLowerCase()))
      ))
    : [];

  // Totals scoped to what the user can access
  const scopedBranches = branches.filter(b => branchIds.has(b.id));
  const scopedZones = zones.filter(z => zoneIds.has(z.id));
  const scopedConfs = conferences.filter(c => conferenceIds.has(c.id));
  const scopedMembers = members.filter(m => branchIds.has(m.branch_id));
  const totalConferences = scopedConfs.length;
  const totalZones = scopedZones.length;
  const totalBranches = scopedBranches.length;
  const totalMembers = scopedMembers.length;

  return (
    <DashboardLayout>
      <SEO
        title="Members"
        description="Manage member profiles, search across branches, and export membership data in TUCASA STUM."
      />
      <div className="premium-card p-5 mb-6 border border-white/10 shadow-2xl">
        <div className="page-header mb-4 flex items-center justify-between gap-3">
          <div>
            <h1 className="page-title text-2xl sm:text-3xl">Members</h1>
            <p className="page-description text-sm">Browse members by Conference → Zone → Branch.</p>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate('/dashboard')}
            className="h-10 w-10 rounded-full"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard title="Conferences" value={totalConferences} icon={Network} accent="from-church-blue to-church-blue-light" />
          <StatCard title="Zones" value={totalZones} icon={MapPin} accent="from-teal-500 to-cyan-500" />
          <StatCard title="Branches" value={totalBranches} icon={GitBranch} accent="from-violet-500 to-fuchsia-500" />
          <StatCard title="Members" value={totalMembers} icon={Users} accent="from-gold to-gold-light" />
        </div>
      </div>

      <Card className="premium-card border border-white/15 shadow-2xl p-4 mb-6">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 max-w-full sm:max-w-md">
            {view.level !== 'conferences' && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  setOverlay(null);
                  setRestoreOverlay(null);
                  setSearch('');
                  setView({ level: 'conferences' });
                }}
                className="shrink-0"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={
                  view.level === 'conferences' ? 'Search conferences...' :
                  view.level === 'zones' ? 'Search zones...' :
                  view.level === 'branches' ? 'Search branches...' :
                  'Search members...'
                }
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          {view.level === 'members' && (
            <div className="flex gap-2 flex-wrap justify-end">
              <ExportMenu
                rows={visibleMembers.map(m => ({
                  Name: m.full_name, Phone: m.phone || '',
                  Institution: m.institution || '', Branch: view.branch.name,
                  Status: m.is_active ? 'Active' : 'Inactive',
                  Joined: new Date(m.created_at).toLocaleDateString(),
                }))}
                filename={`members-${view.branch.name}`}
                title={`Members — ${view.branch.name}`}
              />
              {canAdd && (
                <Button onClick={() => openAddInBranch(view.branch.id)}>
                  <Plus className="h-4 w-4 mr-2" /> Add Member
                </Button>
              )}
            </div>
          )}
        </div>
      </Card>

      {overlay && (
        <>
          <GlassOverlay onClick={() => setOverlay(null)} />
          <div className="fixed inset-x-0 top-4 z-50 flex justify-center px-3 sm:px-4 animate-slide-down">
            <div className="w-full max-w-3xl min-w-0">
              <GlassPanel
                title={overlay.level === 'zones' ? overlay.conference.name : `${overlay.zone.name} — ${overlay.conference.name}`}
                subtitle={overlay.level === 'zones' ? 'Choose zone' : 'Choose branch'}
                showClose
                onClose={() => setOverlay(null)}
              >
                <GlassScrollContainer>
                  <div className="grid gap-2 sm:gap-3 sm:grid-cols-2">
                    {overlay.level === 'zones' ? (
                      zones
                        .filter(z => z.conference_id === overlay.conference.id)
                        .map(z => (
                          <GlassItemButton
                            key={z.id}
                            title={z.name}
                            subtitle={`${zoneBranchCount.get(z.id) || 0} branch${(zoneBranchCount.get(z.id) || 0) !== 1 ? 'es' : ''}`}
                            count={zoneMemberCount.get(z.id) || 0}
                            countLabel="members"
                            onClick={() => openZoneOverlay(z)}
                          />
                        ))
                    ) : (
                      branches
                        .filter(b => b.zone_id === overlay.zone.id)
                        .map(b => (
                          <GlassItemButton
                            key={b.id}
                            title={b.name}
                            subtitle={b.institution || undefined}
                            count={branchMemberCount.get(b.id) || 0}
                            countLabel="members"
                            onClick={() => openBranchFromOverlay(b)}
                          />
                        ))
                    )}
                  </div>
                </GlassScrollContainer>
                {overlay.level === 'branches' && (
                  <div className="mt-4 flex gap-2">
                    <GlassButton
                      size="sm"
                      onClick={() => setOverlay({ level: 'zones', conference: overlay.conference })}
                    >
                      Back
                    </GlassButton>
                  </div>
                )}
              </GlassPanel>
            </div>
          </div>
        </>
      )}



      {/* Breadcrumbs */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground mb-4">
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight className="h-3 w-3" />}
            {c.onClick ? (
              <button onClick={c.onClick} className="hover:text-foreground transition-colors">{c.label}</button>
            ) : (
              <span className="text-foreground font-medium">{c.label}</span>
            )}
          </span>
        ))}
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground py-8">Loading...</p>
      ) : view.level === 'conferences' ? (
        visibleConfs.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No conferences or fields found.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {visibleConfs.map(c => (
              <DrillCard
                key={c.id}
                icon={Network}
                title={c.name}
                subtitle={`${conferenceZoneCount.get(c.id) || 0} zone${(conferenceZoneCount.get(c.id) || 0) !== 1 ? 's' : ''}`}
                count={conferenceMemberCount.get(c.id) || 0}
                onClick={() => overlay?.level === 'zones' && overlay.conference.id === c.id ? setOverlay(null) : openConferenceOverlay(c)}
              />
            ))}
          </div>
        )
      ) : view.level === 'zones' ? (
        visibleZones.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No zones in this conference.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {visibleZones.map(z => (
              <DrillCard
                key={z.id}
                icon={MapPin}
                title={z.name}
                subtitle={`${zoneBranchCount.get(z.id) || 0} branch${(zoneBranchCount.get(z.id) || 0) !== 1 ? 'es' : ''}`}
                count={zoneMemberCount.get(z.id) || 0}
                onClick={() => setView({ level: 'branches', conference: view.conference, zone: z })}
              />
            ))}
          </div>
        )
      ) : view.level === 'branches' ? (
        visibleBranches.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No branches in this zone.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {visibleBranches.map(b => (
              <DrillCard
                key={b.id}
                icon={GitBranch}
                title={b.name}
                subtitle={b.institution || undefined}
                count={branchMemberCount.get(b.id) || 0}
                onClick={() => setView({ level: 'members', conference: view.conference, zone: view.zone, branch: b })}
              />
            ))}
          </div>
        )
      ) : (
        <>
          <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span>{visibleMembers.length} member{visibleMembers.length !== 1 ? 's' : ''} in {view.branch.name}</span>
          </div>
          {visibleMembers.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No members in this branch.</p>
          ) : (
            <Card className="premium-card border border-white/15 shadow-2xl">
              <CardContent className="p-0">
                <div className="md:hidden space-y-3 p-4">
                  {visibleMembers.map(m => (
                    <MemberCard key={m.id} member={m} canEdit={canEdit} canDelete={canDelete} onEdit={openEdit} onDelete={handleDelete} />
                  ))}
                </div>
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Institution</TableHead>
                        <TableHead>Status</TableHead>
                        {(canEdit || canDelete) && <TableHead className="text-right">Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleMembers.map(m => (
                        <TableRow key={m.id}>
                          <TableCell className="font-medium">{m.full_name}</TableCell>
                          <TableCell>{m.phone || '—'}</TableCell>
                          <TableCell>{m.institution || '—'}</TableCell>
                          <TableCell>
                            <Badge variant={m.is_active ? 'default' : 'secondary'}>
                              {m.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          {(canEdit || canDelete) && (
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                {canEdit && <Button variant="ghost" size="icon" onClick={() => openEdit(m)}><Edit className="h-4 w-4" /></Button>}
                                {canDelete && <Button variant="ghost" size="icon" onClick={() => handleDelete(m.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setEditing(null); setForm({ full_name: '', email: '', phone: '', institution: '', branch_id: '' }); } }}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Member' : 'Add New Member'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} required />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="space-y-2">
                {/* space reserved for layout symmetry; email intentionally hidden */}
                <Label className="text-transparent">Email</Label>
                <div />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Institution</Label>
              <Input value={form.institution} onChange={e => setForm(f => ({ ...f, institution: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Branch *</Label>
              <Select value={form.branch_id} onValueChange={v => setForm(f => ({ ...f, branch_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                <SelectContent>
                  {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full">{editing ? 'Update' : 'Add'} Member</Button>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
