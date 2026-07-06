import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Shield, Network, MapPin, GitBranch, ArrowLeft, Globe, Building2, ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { SEO } from '@/components/SEO';
import { GlassCard, GlassPanel, GlassButton, GlassOverlay, GlassScrollContainer, GlassItemButton } from '@/components/glass';

interface LeaderRow {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  role_name: string;
  level_id: string;
  hierarchy_level: string;
  level_name: string;
  is_active: boolean;
  end_date: string | null;
}

const LEADERSHIP_POSITIONS = [
  'Chairperson',
  'Chaplain',
  'Deputy Chairperson',
  'Executive Secretary',
  'Deputy Executive Secretary',
  'Treasurer',
  'Deputy Treasurer',
  'Communication Director',
  'Deputy Communication Director',
  'Spiritual & Evangelism Coordinator',
  'Deputy Spiritual & Evangelism Coordinator',
  'Internal Auditor',
  'Education Coordinator',
  'Medical Missionary Coordinator',
  'Project Manager',
  'Religious Liberty Coordinator',
  'Adventist Possibility Ministry Coordinator',
  'Music Coordinator',
  'Youth Training Coordinator',
] as const;

const leadershipPositionIndex = new Map(LEADERSHIP_POSITIONS.map((name, index) => [name, index]));

function LeaderCard({ leader, canManage, onRemove, onToggleActive }: {
  leader: LeaderRow;
  canManage: boolean;
  onRemove: (id: string) => void;
  onToggleActive: (id: string, next: boolean) => void;
}) {
  return (
    <GlassCard variant="interactive" className="mb-3 !p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-sm truncate text-white">{leader.user_name}</h3>
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <Badge variant="outline" className="gap-1 text-[10px] bg-white/10 border-white/30 text-white">
              <Shield className="h-2.5 w-2.5" />{leader.role_name}
            </Badge>
            <Badge variant="secondary" className="text-[10px] bg-white/10 border-white/30 text-white/90">{leader.hierarchy_level}</Badge>
            <Badge variant={leader.is_active ? 'default' : 'outline'} className="text-[10px]">
              {leader.is_active ? 'Active' : 'Inactive'}
            </Badge>
            <span className="text-xs text-white/70">· {leader.level_name}</span>
          </div>
        </div>
        {canManage && (
          <div className="flex flex-col gap-1 shrink-0">
            <Button variant="ghost" size="sm" className="h-7 text-[10px] px-2 text-white hover:bg-white/10" onClick={() => onToggleActive(leader.id, !leader.is_active)}>
              {leader.is_active ? 'Deactivate' : 'Activate'}
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-white/10" onClick={() => onRemove(leader.id)}>
              <Trash2 className="h-3.5 w-3.5 text-red-400" />
            </Button>
          </div>
        )}
      </div>
    </GlassCard>
  );
}

export default function Leadership() {
  const navigate = useNavigate();
  const { hasPermission, isSuperAdmin, isUnionLeader, userRoles, profile } = useAuth();
  const { toast } = useToast();
  const [leaders, setLeaders] = useState<LeaderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [overlay, setOverlay] = useState<null | { level: 'conferences' } | { level: 'zones'; conference: any } | { level: 'branches'; conference: any; zone: any }>(null);
  const [restoreOverlay, setRestoreOverlay] = useState<null | { level: 'branches'; conference: any; zone: any }>(null);
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([]);
  const [profiles, setProfiles] = useState<{ user_id: string; full_name: string; email: string | null; branch_id?: string | null }[]>([]);
  const [unions, setUnions] = useState<{ id: string; name: string }[]>([]);
  const [conferences, setConferences] = useState<{ id: string; name: string }[]>([]);
  const [zones, setZones] = useState<{ id: string; name: string; conference_id: string }[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string; zone_id: string }[]>([]);

  const [form, setForm] = useState({ user_id: '', role_id: '', hierarchy_level: '' as string, level_id: '' });
  const [openLevel, setOpenLevel] = useState<string | null>(null);
  

  // Scope derived from user roles + membership
  const isUnion = isUnionLeader || isSuperAdmin;

  // Levels user can manage (add/edit)
  const manageableConfIds = new Set<string>();
  const manageableZoneIds = new Set<string>();
  const manageableBranchIds = new Set<string>();
  const manageableUnion = isUnion;

  if (isUnion) {
    conferences.forEach(c => manageableConfIds.add(c.id));
    zones.forEach(z => manageableZoneIds.add(z.id));
    branches.forEach(b => manageableBranchIds.add(b.id));
  } else {
    userRoles.forEach(r => {
      if (r.hierarchy_level === 'conference') manageableConfIds.add(r.level_id);
      else if (r.hierarchy_level === 'zone') manageableZoneIds.add(r.level_id);
      else if (r.hierarchy_level === 'branch') manageableBranchIds.add(r.level_id);
    });
    // Cascade down
    zones.forEach(z => { if (manageableConfIds.has(z.conference_id)) manageableZoneIds.add(z.id); });
    branches.forEach(b => { if (manageableZoneIds.has(b.zone_id)) manageableBranchIds.add(b.id); });
  }

  // Only Union can assign at any level. Every other leader can assign strictly
  // BELOW their own level — never their own level or above.
  const allowedLevels: Array<'union'|'conference'|'zone'|'branch'> = [];
  if (manageableUnion) {
    allowedLevels.push('union', 'conference', 'zone', 'branch');
  } else {
    const hasConfRole = userRoles.some(r => r.hierarchy_level === 'conference');
    const hasZoneRole = userRoles.some(r => r.hierarchy_level === 'zone');
    if (hasConfRole) allowedLevels.push('zone', 'branch');
    else if (hasZoneRole) allowedLevels.push('branch');
    // Branch leaders (and plain members) cannot assign anyone.
  }
  const canManage = allowedLevels.length > 0;

  const fetchData = async () => {
    const [urRes, rolesRes, profilesRes, unionsRes, confsRes, zonesRes, branchesRes] = await Promise.all([
      supabase.from('user_roles').select('*'),
      supabase.from('roles').select('id, name'),
      supabase.from('profiles').select('user_id, full_name, email, branch_id'),
      supabase.from('unions').select('id, name'),
      supabase.from('conferences').select('id, name'),
      supabase.from('zones').select('id, name, conference_id'),
      supabase.from('branches').select('id, name, zone_id'),
    ]);

    const allRoles = (rolesRes.data || []);
    setRoles(allRoles);
    setProfiles(profilesRes.data || []);
    setUnions(unionsRes.data || []);
    setConferences(confsRes.data || []);
    setZones((zonesRes.data as any) || []);
    setBranches((branchesRes.data as any) || []);

    const roleMap = new Map((rolesRes.data || []).map(r => [r.id, r.name]));
    const profileMap = new Map((profilesRes.data || []).map(p => [p.user_id, p]));
    const levelMap = new Map([
      ...(unionsRes.data || []).map(u => [u.id, u.name] as [string, string]),
      ...(confsRes.data || []).map(c => [c.id, c.name] as [string, string]),
      ...(zonesRes.data || []).map(z => [z.id, z.name] as [string, string]),
      ...(branchesRes.data || []).map(b => [b.id, b.name] as [string, string]),
    ]);

    // Compute visible scope
    const allZones = (zonesRes.data as any[]) || [];
    const allBranches = (branchesRes.data as any[]) || [];
    const isUnionScope = isUnionLeader || isSuperAdmin;

    let visibleConferences = new Set<string>();
    let visibleZones = new Set<string>();
    let visibleBranches = new Set<string>();
    let showUnion = false;

    if (isUnionScope) {
      showUnion = true;
      visibleConferences = new Set((confsRes.data || []).map(c => c.id));
      visibleZones = new Set(allZones.map(z => z.id));
      visibleBranches = new Set(allBranches.map(b => b.id));
    } else if (userRoles.length > 0) {
      // Leader scope: their own level + descendants + view union
      showUnion = true;
      userRoles.forEach(r => {
        if (r.hierarchy_level === 'conference') visibleConferences.add(r.level_id);
        else if (r.hierarchy_level === 'zone') visibleZones.add(r.level_id);
        else if (r.hierarchy_level === 'branch') visibleBranches.add(r.level_id);
      });
      // Also see parent chain for context
      allZones.forEach(z => { if (visibleZones.has(z.id)) visibleConferences.add(z.conference_id); });
      allBranches.forEach(b => {
        if (visibleBranches.has(b.id)) {
          visibleZones.add(b.zone_id);
          const zz = allZones.find(x => x.id === b.zone_id);
          if (zz) visibleConferences.add(zz.conference_id);
        }
      });
      // Cascade down
      allZones.forEach(z => { if (visibleConferences.has(z.conference_id)) visibleZones.add(z.id); });
      allBranches.forEach(b => { if (visibleZones.has(b.zone_id)) visibleBranches.add(b.id); });
    } else {
      // Plain member: see union + their conference/zone/branch chain
      showUnion = true;
      const myBranch = profile?.branch_id ? allBranches.find(b => b.id === profile.branch_id) : null;
      const myZone = myBranch ? allZones.find(z => z.id === myBranch.zone_id) : null;
      if (myBranch) visibleBranches.add(myBranch.id);
      if (myZone) { visibleZones.add(myZone.id); visibleConferences.add(myZone.conference_id); }
    }

    const enriched: LeaderRow[] = (urRes.data || [])
      .filter((ur: any) => {
        if (ur.hierarchy_level === 'union') return showUnion;
        if (ur.hierarchy_level === 'conference') return visibleConferences.has(ur.level_id);
        if (ur.hierarchy_level === 'zone') return visibleZones.has(ur.level_id);
        if (ur.hierarchy_level === 'branch') return visibleBranches.has(ur.level_id);
        return false;
      })
      .map((ur: any) => {
        const prof = profileMap.get(ur.user_id);
        return {
          id: ur.id,
          user_id: ur.user_id,
          user_email: '',
          user_name: prof?.full_name || 'Unknown',
          role_name: roleMap.get(ur.role_id) || 'Unknown',
          level_id: ur.level_id,
          hierarchy_level: ur.hierarchy_level,
          level_name: levelMap.get(ur.level_id) || 'Unknown',
          is_active: ur.is_active ?? true,
          end_date: ur.end_date ?? null,
        };
      })
      .sort((a, b) => {
        const aIndex = leadershipPositionIndex.has(a.role_name) ? leadershipPositionIndex.get(a.role_name)! : Number.MAX_SAFE_INTEGER;
        const bIndex = leadershipPositionIndex.has(b.role_name) ? leadershipPositionIndex.get(b.role_name)! : Number.MAX_SAFE_INTEGER;
        if (aIndex !== bIndex) return aIndex - bIndex;
        return a.role_name.localeCompare(b.role_name);
      });

    setLeaders(enriched);
    setLoading(false);
  };

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, [userRoles, profile?.branch_id, isSuperAdmin]);

  const openOverlayConferences = () => setOverlay({ level: 'conferences' });
  const openOverlayZones = (conference: any) => setOverlay({ level: 'zones', conference });
  const openOverlayBranches = (zone: any) => {
    if (!overlay || overlay.level !== 'zones') return;
    setOverlay({ level: 'branches', conference: overlay.conference, zone });
  };
  const closeOverlay = () => setOverlay(null);

  const openAssignFor = (level: 'union' | 'conference' | 'zone' | 'branch', levelId: string) => {
    setForm({ user_id: '', role_id: '', hierarchy_level: level, level_id: levelId });
    setDialogOpen(true);
  };

  const profilesForScope = (level: string, levelId: string) => {
    if (!level || !levelId) return [] as typeof profiles;
    if (level === 'union') {
      const confsInUnion = conferences.filter(c => c.union_id === levelId).map(c => c.id);
      const zonesInConfs = zones.filter(z => confsInUnion.includes(z.conference_id)).map(z => z.id);
      const branchesInZones = branches.filter(b => zonesInConfs.includes(b.zone_id)).map(b => b.id);
      return profiles.filter(p => p.branch_id && branchesInZones.includes(p.branch_id));
    }
    if (level === 'conference') {
      const zonesInConf = zones.filter(z => z.conference_id === levelId).map(z => z.id);
      const branchesInZones = branches.filter(b => zonesInConf.includes(b.zone_id)).map(b => b.id);
      return profiles.filter(p => p.branch_id && branchesInZones.includes(p.branch_id));
    }
    if (level === 'zone') {
      const branchesInZone = branches.filter(b => b.zone_id === levelId).map(b => b.id);
      return profiles.filter(p => p.branch_id && branchesInZone.includes(p.branch_id));
    }
    if (level === 'branch') {
      return profiles.filter(p => p.branch_id === levelId);
    }
    return [] as typeof profiles;
  };

  const levelOptions = () => {
    switch (form.hierarchy_level) {
      case 'union': return unions;
      case 'conference': return conferences.filter(c => manageableConfIds.has(c.id));
      case 'zone': return zones.filter(z => manageableZoneIds.has(z.id));
      case 'branch': return branches.filter(b => manageableBranchIds.has(b.id));
      default: return [];
    }
  };

  const resolveRoleId = async (roleName: string) => {
    const existing = roles.find(r => r.name === roleName);
    if (existing) return existing.id;

    const { data: inserted, error: insertError } = await supabase
      .from('roles')
      .insert({ name: roleName })
      .select('id, name')
      .single();

    if (insertError) throw insertError;
    setRoles(prev => [...prev, inserted]);
    return inserted.id;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.user_id || !form.role_id || !form.hierarchy_level || !form.level_id) return;

    try {
      const roleId = await resolveRoleId(form.role_id);
      const { error } = await supabase.from('user_roles').insert({
        user_id: form.user_id,
        role_id: roleId,
        hierarchy_level: form.hierarchy_level as any,
        level_id: form.level_id,
      });

      if (error) throw error;
      toast({ title: 'Leader assigned' });
      setDialogOpen(false);
      setForm({ user_id: '', role_id: '', hierarchy_level: '', level_id: '' });
      fetchData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Could not assign leader.', variant: 'destructive' });
    }
  };


  const handleRemove = async (id: string) => {
    const { error } = await supabase.from('user_roles').delete().eq('id', id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Leader removed' });
    fetchData();
  };

  const handleToggleActive = async (id: string, next: boolean) => {
    const { error } = await supabase
      .from('user_roles')
      .update({ is_active: next, end_date: next ? null : new Date().toISOString() } as any)
      .eq('id', id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: next ? 'Leader activated' : 'Leader deactivated' });
    fetchData();
  };

  return (
    <DashboardLayout>
      <SEO
        title="Leadership"
        description="Assign and manage leadership roles across TUCASA hierarchy levels."
      />
      <GlassPanel subtitle="Team" title="Leadership" className="mb-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <p className="text-sm text-white/80">Manage leaders across all organizational levels.</p>
          <div className="flex items-center gap-2">
            <GlassButton size="icon" onClick={() => navigate('/dashboard')} className="h-10 w-10 rounded-full" aria-label="Back to dashboard">
              <ArrowLeft className="h-4 w-4" />
            </GlassButton>
            <GlassButton size="icon" onClick={openOverlayConferences} className="h-10 w-10 rounded-full" aria-label="Browse conferences">
              <Network className="h-4 w-4" />
            </GlassButton>
          </div>
        </div>
      </GlassPanel>

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-white/70">{leaders.length} leader{leaders.length !== 1 ? 's' : ''}</p>
        {canManage && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <GlassButton size="sm" className="gap-1"><Plus className="h-4 w-4" /> <span className="hidden sm:inline">Assign Leader</span><span className="sm:hidden">Assign</span></GlassButton>
            </DialogTrigger>
            <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg bg-transparent border-0 shadow-none p-0">
              <GlassPanel title="Assign Leader">
                <DialogHeader className="sr-only"><DialogTitle>Assign Leader</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-white/90">Role</Label>
                    <Select value={form.role_id} onValueChange={v => setForm(f => ({ ...f, role_id: v }))}>
                      <SelectTrigger className="bg-white/10 border-white/20 text-white"><SelectValue placeholder="Select role" /></SelectTrigger>
                      <SelectContent>
                        {LEADERSHIP_POSITIONS.map(name => (
                          <SelectItem key={name} value={name}>{name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white/90">Level</Label>
                    <Select value={form.hierarchy_level} onValueChange={v => setForm(f => ({ ...f, hierarchy_level: v, level_id: '', user_id: '' }))}>
                      <SelectTrigger className="bg-white/10 border-white/20 text-white"><SelectValue placeholder="Select level" /></SelectTrigger>
                      <SelectContent>
                        {allowedLevels.includes('union') && <SelectItem value="union">Union</SelectItem>}
                        {allowedLevels.includes('conference') && <SelectItem value="conference">Conference</SelectItem>}
                        {allowedLevels.includes('zone') && <SelectItem value="zone">Zone</SelectItem>}
                        {allowedLevels.includes('branch') && <SelectItem value="branch">Branch</SelectItem>}
                      </SelectContent>
                    </Select>
                  </div>
                  {form.hierarchy_level && (
                    <div className="space-y-2">
                      <Label className="text-white/90">Assign to</Label>
                      <Select value={form.level_id} onValueChange={v => setForm(f => ({ ...f, level_id: v }))}>
                        <SelectTrigger className="bg-white/10 border-white/20 text-white"><SelectValue placeholder="Select..." /></SelectTrigger>
                        <SelectContent>
                          {levelOptions().map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {/* User select moved to bottom and filtered by selected scope */}
                  <div className="space-y-2">
                    <Label className="text-white/90">User</Label>
                    <Select value={form.user_id} onValueChange={v => setForm(f => ({ ...f, user_id: v }))}>
                      <SelectTrigger className="bg-white/10 border-white/20 text-white"><SelectValue placeholder="Select user" /></SelectTrigger>
                      <SelectContent>
                        {profilesForScope(form.hierarchy_level, form.level_id).map(p => <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <GlassButton type="submit" className="w-full">Assign</GlassButton>
                </form>
              </GlassPanel>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {loading ? (
        <p className="text-center text-white/70 py-8">Loading...</p>
      ) : leaders.length === 0 ? (
        <p className="text-center text-white/70 py-8">No leaders assigned yet.</p>
      ) : (
        (() => {
          const levelMeta: Record<string, { label: string; Icon: typeof Globe }> = {
            union:      { label: 'Union',      Icon: Globe },
            conference: { label: 'Conference', Icon: Building2 },
            zone:       { label: 'Zone',       Icon: MapPin },
            branch:     { label: 'Branch',     Icon: GitBranch },
          };
          const order: Array<'union'|'conference'|'zone'|'branch'> = ['union','conference','zone','branch'];
          // Flatten into one entry per (level, level_id)
          const groups: Array<{ key: string; lvl: 'union'|'conference'|'zone'|'branch'; scopeId: string; scopeName: string; list: LeaderRow[] }> = [];
          order.forEach(lvl => {
            const rows = leaders.filter(l => l.hierarchy_level === lvl);
            const byScope = new Map<string, { name: string; list: LeaderRow[] }>();
            rows.forEach(r => {
              const existing = byScope.get(r.level_id) || { name: r.level_name, list: [] };
              existing.list.push(r);
              byScope.set(r.level_id, existing);
            });
            [...byScope.entries()].forEach(([scopeId, entry]) => {
              groups.push({ key: `${lvl}::${scopeId}`, lvl, scopeId, scopeName: entry.name, list: entry.list });
            });
          });
          return (
            <div className="space-y-3">
              {groups.map(({ key, lvl, scopeId, scopeName, list }) => {
                const meta = levelMeta[lvl];
                return (
                  <Collapsible key={key} asChild open={openLevel === key} onOpenChange={(o) => setOpenLevel(o ? key : null)}>
                    <GlassCard variant="subtle" className="!p-0 overflow-hidden">
                      <CollapsibleTrigger className="w-full group flex items-center gap-3 text-left p-3 sm:p-4">
                        <div className="h-9 w-9 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0 text-white">
                          <meta.Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h2 className="font-display text-base sm:text-lg font-semibold text-white truncate">{scopeName}</h2>
                          <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">{meta.label}</p>
                        </div>
                            <Badge variant="outline" className="bg-white/10 border-white/30 text-white">{list.length}</Badge>
                            {canManage && allowedLevels.includes(lvl) && (
                              <GlassButton size="sm" onClick={(e) => { e.stopPropagation(); openAssignFor(lvl, scopeId); }} className="ml-2 gap-1 hidden sm:flex">
                                <Plus className="h-4 w-4 mr-1" /> <span className="text-sm">Add</span>
                              </GlassButton>
                            )}
                            <ChevronDown className="h-4 w-4 text-white/70 transition-transform group-data-[state=open]:rotate-180" />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="px-3 sm:px-4 pb-3 sm:pb-4 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {list.map(l => (
                            <GlassCard key={l.id} variant="interactive" className="!p-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <h4 className="font-medium text-sm truncate text-white">{l.user_name}</h4>
                                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                    <Badge variant="outline" className="gap-1 text-[10px] bg-white/10 border-white/30 text-white">
                                      <Shield className="h-2.5 w-2.5" />{l.role_name}
                                    </Badge>
                                    <Badge variant="outline" className={`text-[10px] border-white/30 ${l.is_active ? 'bg-white/20 text-white' : 'bg-white/5 text-white/70'}`}>
                                      {l.is_active ? 'Active' : 'Inactive'}
                                    </Badge>
                                  </div>
                                </div>
                                {canManage && (
                                  <div className="flex flex-col gap-1 shrink-0">
                                    <Button variant="ghost" size="sm" className="h-7 text-[10px] px-2 text-white hover:bg-white/10" onClick={() => handleToggleActive(l.id, !l.is_active)}>
                                      {l.is_active ? 'Deactivate' : 'Activate'}
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-white/10" onClick={() => handleRemove(l.id)}>
                                      <Trash2 className="h-3.5 w-3.5 text-red-400" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </GlassCard>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </GlassCard>
                  </Collapsible>
                );
              })}
            </div>
          );
        })()
      )}
      {overlay && (
        <>
          <GlassOverlay onClick={closeOverlay} />
          <div className="fixed inset-x-0 top-4 z-50 flex justify-center px-3 sm:px-4 animate-slide-down">
            <div className="w-full max-w-3xl min-w-0">
              <GlassPanel
                title={`Browse ${overlay.level}`}
                subtitle={overlay.level === 'conferences' ? 'Conferences' : overlay.level === 'zones' ? 'Zones' : 'Branches'}
                showClose
                onClose={closeOverlay}
              >
                <GlassScrollContainer>
                  <div className="grid gap-2 sm:gap-3 sm:grid-cols-2">
                    {overlay.level === 'conferences' ? (
                      conferences.map(c => (
                        <GlassItemButton key={c.id} onClick={() => openOverlayZones(c)} title={c.name} subtitle="Conference" />
                      ))
                    ) : overlay.level === 'zones' ? (
                      zones.filter(z => z.conference_id === overlay.conference.id).map(z => (
                        <GlassItemButton key={z.id} onClick={() => openOverlayBranches(z)} title={z.name} subtitle="Zone" />
                      ))
                    ) : (
                      branches.filter(b => b.zone_id === overlay.zone.id).map(b => (
                        <GlassCard key={b.id} variant="interactive" className="!p-3">
                          <h3 className="font-medium text-sm text-white break-words">{b.name}</h3>
                        </GlassCard>
                      ))
                    )}
                  </div>
                </GlassScrollContainer>
              </GlassPanel>
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
