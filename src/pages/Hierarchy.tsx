import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Building2, MapPin, GitBranch, Globe, Network, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SEO } from '@/components/SEO';
import { GlassOverlay, GlassPanel, GlassScrollContainer, GlassCard, GlassButton, GlassItemButton } from '@/components/glass';
import { computeScope } from '@/lib/scope';

function HierarchyCard({ item, fields, canDelete, onDelete }: {
  item: any;
  fields: { label: string; value: string }[];
  canDelete: boolean;
  onDelete: () => void;
}) {
  return (
    <GlassCard variant="interactive" className="mb-3 !p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-sm text-white">{item.name}</h3>
          <div className="space-y-0.5 mt-1">
            {fields.map(f => (
              <p key={f.label} className="text-xs text-white/70">
                <span className="text-white/60">{f.label}:</span> {f.value || '—'}
              </p>
            ))}
          </div>
        </div>
        {canDelete && (
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-white hover:bg-white/10" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5 text-red-400" />
          </Button>
        )}
      </div>
    </GlassCard>
  );
}

export default function Hierarchy() {
  const navigate = useNavigate();
  const { isUnionLeader, userRoles, profile } = useAuth();
  const { toast } = useToast();

  const [unions, setUnions] = useState<any[]>([]);
  const [conferences, setConferences] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [overlay, setOverlay] = useState<null | { level: 'conferences' } | { level: 'zones'; conference: any } | { level: 'branches'; conference: any; zone: any }>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<'union' | 'conference' | 'zone' | 'branch'>('union');
  const [form, setForm] = useState({ name: '', description: '', institution: '', parent_id: '' });

  const fetchAll = async () => {
    const [u, c, z, b] = await Promise.all([
      supabase.from('unions').select('*'),
      supabase.from('conferences').select('*'),
      supabase.from('zones').select('*'),
      supabase.from('branches').select('*'),
    ]);
    setUnions(u.data || []);
    setConferences(c.data || []);
    setZones(z.data || []);
    setBranches(b.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const scope = useMemo(
    () => computeScope(userRoles as any, conferences, zones, branches, profile?.branch_id || null),
    [userRoles, conferences, zones, branches, profile?.branch_id],
  );

  // Data filtered by user's scope
  const visibleConferences = useMemo(
    () => isUnionLeader ? conferences : conferences.filter(c => scope.conferenceIds.has(c.id)),
    [isUnionLeader, conferences, scope],
  );
  const visibleZones = useMemo(
    () => isUnionLeader ? zones : zones.filter(z => scope.zoneIds.has(z.id)),
    [isUnionLeader, zones, scope],
  );
  const visibleBranches = useMemo(
    () => isUnionLeader ? branches : branches.filter(b => scope.branchIds.has(b.id)),
    [isUnionLeader, branches, scope],
  );

  // Permission to add at each level (based on top role)
  const canAddUnion = isUnionLeader;
  const canAddConference = isUnionLeader;
  const canAddZone = isUnionLeader || scope.topLevel === 'conference';
  const canAddBranch = isUnionLeader || scope.topLevel === 'conference' || scope.topLevel === 'zone';

  const openOverlayConferences = () => setOverlay({ level: 'conferences' });
  const openOverlayZones = (conference: any) => setOverlay({ level: 'zones', conference });
  const openOverlayBranches = (zone: any) => {
    if (!overlay || overlay.level !== 'zones') return;
    setOverlay({ level: 'branches', conference: overlay.conference, zone });
  };
  const closeOverlay = () => setOverlay(null);
  const backOverlay = () => {
    if (!overlay) return;
    if (overlay.level === 'branches') {
      setOverlay({ level: 'zones', conference: overlay.conference });
    } else if (overlay.level === 'zones') {
      setOverlay({ level: 'conferences' });
    }
  };

  const openAdd = (type: typeof dialogType) => {
    setDialogType(type);
    // Pre-select parent when user only has one option
    let parent_id = '';
    if (type === 'zone' && visibleConferences.length === 1) parent_id = visibleConferences[0].id;
    if (type === 'branch' && visibleZones.length === 1) parent_id = visibleZones[0].id;
    setForm({ name: '', description: '', institution: '', parent_id });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    let error: any;
    switch (dialogType) {
      case 'union':
        ({ error } = await supabase.from('unions').insert({ name: form.name, description: form.description || null }));
        break;
      case 'conference':
        ({ error } = await supabase.from('conferences').insert({ name: form.name, description: form.description || null, union_id: form.parent_id }));
        break;
      case 'zone':
        ({ error } = await supabase.from('zones').insert({ name: form.name, description: form.description || null, conference_id: form.parent_id }));
        break;
      case 'branch':
        ({ error } = await supabase.from('branches').insert({ name: form.name, description: form.description || null, institution: form.institution || null, zone_id: form.parent_id }));
        break;
    }

    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: `${dialogType.charAt(0).toUpperCase() + dialogType.slice(1)} created` });
    setDialogOpen(false);
    fetchAll();
  };

  const handleDelete = async (table: string, id: string) => {
    const { error } = await supabase.from(table as any).delete().eq('id', id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Deleted successfully' });
    fetchAll();
  };

  const parentOptions = () => {
    switch (dialogType) {
      case 'conference': return unions;
      case 'zone': return visibleConferences;
      case 'branch': return visibleZones;
      default: return [];
    }
  };

  const parentLabel = () => {
    switch (dialogType) {
      case 'conference': return 'Union';
      case 'zone': return 'Conference';
      case 'branch': return 'Zone';
      default: return '';
    }
  };

  const unionMap = new Map(unions.map(u => [u.id, u.name]));
  const confMap = new Map(conferences.map(c => [c.id, c.name]));
  const zoneMap = new Map(zones.map(z => [z.id, z.name]));

  // Which tabs to expose based on role level
  const showUnionsTab = isUnionLeader;
  const showConferencesTab = isUnionLeader || scope.conferenceIds.size > 0;
  const showZonesTab = isUnionLeader || scope.zoneIds.size > 0;
  const showBranchesTab = true; // everyone with any level can see their branch(es)
  const defaultTab = showUnionsTab ? 'unions'
    : showConferencesTab ? 'conferences'
    : showZonesTab ? 'zones'
    : 'branches';

  return (
    <DashboardLayout>
      <SEO
        title="Hierarchy"
        description="View and manage the organizational structure of unions, conferences, zones, and branches."
      />
      <GlassPanel subtitle="Structure" title="Hierarchy" className="mb-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <p className="text-sm text-white/80">Manage the organizational structure.</p>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg bg-transparent border-0 shadow-none p-0">
          <GlassPanel title={`Add ${dialogType.charAt(0).toUpperCase() + dialogType.slice(1)}`}>
            <DialogHeader className="sr-only">
              <DialogTitle>Add {dialogType.charAt(0).toUpperCase() + dialogType.slice(1)}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-white/90">Name *</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required className="bg-white/10 border-white/20 text-white placeholder:text-white/60" />
              </div>
              <div className="space-y-2">
                <Label className="text-white/90">Description</Label>
                <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="bg-white/10 border-white/20 text-white placeholder:text-white/60" />
              </div>
              {dialogType === 'branch' && (
                <div className="space-y-2">
                  <Label className="text-white/90">Institution</Label>
                  <Input value={form.institution} onChange={e => setForm(f => ({ ...f, institution: e.target.value }))} className="bg-white/10 border-white/20 text-white placeholder:text-white/60" />
                </div>
              )}
              {dialogType !== 'union' && (
                <div className="space-y-2">
                  <Label className="text-white/90">{parentLabel()} *</Label>
                  <Select value={form.parent_id} onValueChange={v => setForm(f => ({ ...f, parent_id: v }))}>
                    <SelectTrigger className="bg-white/10 border-white/20 text-white"><SelectValue placeholder={`Select ${parentLabel()}`} /></SelectTrigger>
                    <SelectContent>
                      {parentOptions().map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <GlassButton type="submit" className="w-full">Create</GlassButton>
            </form>
          </GlassPanel>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue={defaultTab}>
        <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0 mb-4">
          <TabsList className="w-max sm:w-auto">
            {showUnionsTab && <TabsTrigger value="unions" className="gap-1 text-xs sm:text-sm"><Globe className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> <span className="hidden sm:inline">Unions</span><span className="sm:hidden">Union</span></TabsTrigger>}
            {showConferencesTab && <TabsTrigger value="conferences" className="gap-1 text-xs sm:text-sm"><Building2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> <span className="hidden sm:inline">Conferences</span><span className="sm:hidden">Conf</span></TabsTrigger>}
            {showZonesTab && <TabsTrigger value="zones" className="gap-1 text-xs sm:text-sm"><MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Zones</TabsTrigger>}
            {showBranchesTab && <TabsTrigger value="branches" className="gap-1 text-xs sm:text-sm"><GitBranch className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> <span className="hidden sm:inline">Branches</span><span className="sm:hidden">Branch</span></TabsTrigger>}
          </TabsList>
        </div>

        {showUnionsTab && (
        <TabsContent value="unions">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-white/70">{unions.length} union{unions.length !== 1 ? 's' : ''}</p>
            {canAddUnion && <GlassButton size="sm" onClick={() => openAdd('union')}><Plus className="h-4 w-4 mr-1" /> Add</GlassButton>}
          </div>
          {/* Mobile */}
          <div className="md:hidden">
            {unions.map(u => (
              <HierarchyCard key={u.id} item={u} fields={[{ label: 'Description', value: u.description || '—' }]} canDelete={canAddUnion} onDelete={() => handleDelete('unions', u.id)} />
            ))}
          </div>
          {/* Desktop */}
          <GlassCard className="hidden md:block !p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow className="border-white/15 hover:bg-transparent"><TableHead className="text-white/85">Name</TableHead><TableHead className="text-white/85">Description</TableHead>{canAddUnion && <TableHead className="text-right text-white/85">Actions</TableHead>}</TableRow></TableHeader>
                <TableBody>
                  {unions.map(u => (
                    <TableRow key={u.id} className="border-white/10 hover:bg-white/5">
                      <TableCell className="font-medium text-white">{u.name}</TableCell>
                      <TableCell className="text-white/70">{u.description || '—'}</TableCell>
                      {canAddUnion && <TableCell className="text-right"><Button variant="ghost" size="icon" className="text-white/70 hover:bg-white/10" onClick={() => handleDelete('unions', u.id)}><Trash2 className="h-4 w-4 text-red-400" /></Button></TableCell>}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </GlassCard>
        </TabsContent>
        )}

        {showConferencesTab && (
        <TabsContent value="conferences">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-white/70">{visibleConferences.length} conference{visibleConferences.length !== 1 ? 's' : ''}</p>
            {canAddConference && <GlassButton size="sm" onClick={() => openAdd('conference')}><Plus className="h-4 w-4 mr-1" /> Add</GlassButton>}
          </div>
          <div className="md:hidden">
            {visibleConferences.map(c => (
              <HierarchyCard key={c.id} item={c} fields={[{ label: 'Union', value: unionMap.get(c.union_id) || '—' }, { label: 'Description', value: c.description || '—' }]} canDelete={canAddConference} onDelete={() => handleDelete('conferences', c.id)} />
            ))}
          </div>
          <GlassCard className="hidden md:block !p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow className="border-white/15 hover:bg-transparent"><TableHead className="text-white/85">Name</TableHead><TableHead className="text-white/85">Union</TableHead><TableHead className="text-white/85">Description</TableHead>{canAddConference && <TableHead className="text-right text-white/85">Actions</TableHead>}</TableRow></TableHeader>
                <TableBody>
                  {visibleConferences.map(c => (
                    <TableRow key={c.id} className="border-white/10 hover:bg-white/5">
                      <TableCell className="font-medium text-white">{c.name}</TableCell>
                      <TableCell className="text-white/70">{unionMap.get(c.union_id) || '—'}</TableCell>
                      <TableCell className="text-white/70">{c.description || '—'}</TableCell>
                      {canAddConference && <TableCell className="text-right"><Button variant="ghost" size="icon" className="text-white/70 hover:bg-white/10" onClick={() => handleDelete('conferences', c.id)}><Trash2 className="h-4 w-4 text-red-400" /></Button></TableCell>}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </GlassCard>
        </TabsContent>
        )}

        {showZonesTab && (
        <TabsContent value="zones">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-white/70">{visibleZones.length} zone{visibleZones.length !== 1 ? 's' : ''}</p>
            {canAddZone && <GlassButton size="sm" onClick={() => openAdd('zone')}><Plus className="h-4 w-4 mr-1" /> Add</GlassButton>}
          </div>
          <div className="md:hidden">
            {visibleZones.map(z => (
              <HierarchyCard key={z.id} item={z} fields={[{ label: 'Conference', value: confMap.get(z.conference_id) || '—' }, { label: 'Description', value: z.description || '—' }]} canDelete={canAddZone} onDelete={() => handleDelete('zones', z.id)} />
            ))}
          </div>
          <GlassCard className="hidden md:block !p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow className="border-white/15 hover:bg-transparent"><TableHead className="text-white/85">Name</TableHead><TableHead className="text-white/85">Conference</TableHead><TableHead className="text-white/85">Description</TableHead>{canAddZone && <TableHead className="text-right text-white/85">Actions</TableHead>}</TableRow></TableHeader>
                <TableBody>
                  {visibleZones.map(z => (
                    <TableRow key={z.id} className="border-white/10 hover:bg-white/5">
                      <TableCell className="font-medium text-white">{z.name}</TableCell>
                      <TableCell className="text-white/70">{confMap.get(z.conference_id) || '—'}</TableCell>
                      <TableCell className="text-white/70">{z.description || '—'}</TableCell>
                      {canAddZone && <TableCell className="text-right"><Button variant="ghost" size="icon" className="text-white/70 hover:bg-white/10" onClick={() => handleDelete('zones', z.id)}><Trash2 className="h-4 w-4 text-red-400" /></Button></TableCell>}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </GlassCard>
        </TabsContent>
        )}

        {showBranchesTab && (
        <TabsContent value="branches">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-white/70">{visibleBranches.length} branch{visibleBranches.length !== 1 ? 'es' : ''}</p>
            {canAddBranch && <GlassButton size="sm" onClick={() => openAdd('branch')}><Plus className="h-4 w-4 mr-1" /> Add</GlassButton>}
          </div>
          <div className="md:hidden">
            {visibleBranches.map(b => (
              <HierarchyCard key={b.id} item={b} fields={[{ label: 'Zone', value: zoneMap.get(b.zone_id) || '—' }, { label: 'Institution', value: b.institution || '—' }]} canDelete={canAddBranch} onDelete={() => handleDelete('branches', b.id)} />
            ))}
          </div>
          <GlassCard className="hidden md:block !p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow className="border-white/15 hover:bg-transparent"><TableHead className="text-white/85">Name</TableHead><TableHead className="text-white/85">Zone</TableHead><TableHead className="text-white/85">Institution</TableHead>{canAddBranch && <TableHead className="text-right text-white/85">Actions</TableHead>}</TableRow></TableHeader>
                <TableBody>
                  {visibleBranches.map(b => (
                    <TableRow key={b.id} className="border-white/10 hover:bg-white/5">
                      <TableCell className="font-medium text-white">{b.name}</TableCell>
                      <TableCell className="text-white/70">{zoneMap.get(b.zone_id) || '—'}</TableCell>
                      <TableCell className="text-white/70">{b.institution || '—'}</TableCell>
                      {canAddBranch && <TableCell className="text-right"><Button variant="ghost" size="icon" className="text-white/70 hover:bg-white/10" onClick={() => handleDelete('branches', b.id)}><Trash2 className="h-4 w-4 text-red-400" /></Button></TableCell>}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </GlassCard>
        </TabsContent>
        )}
      </Tabs>
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
                      visibleConferences.map(c => (
                        <button key={c.id} onClick={() => openOverlayZones(c)} className="text-left group w-full min-w-0 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/40 transition-colors p-3 flex items-center gap-3 backdrop-blur-md">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-sm text-white break-words">{c.name}</h3>
                            <p className="text-xs text-white/70">{c.description || 'Conference'}</p>
                          </div>
                        </button>
                      ))
                    ) : overlay.level === 'zones' ? (
                      visibleZones.filter(z => z.conference_id === overlay.conference.id).map(z => (
                        <button key={z.id} onClick={() => openOverlayBranches(z)} className="text-left group w-full min-w-0 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/40 transition-colors p-3 flex items-center gap-3 backdrop-blur-md">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-sm text-white break-words">{z.name}</h3>
                            <p className="text-xs text-white/70">{z.description || 'Zone'}</p>
                          </div>
                        </button>
                      ))
                    ) : (
                      visibleBranches.filter(b => b.zone_id === overlay.zone.id).map(b => (
                        <div key={b.id} className="text-left group w-full min-w-0 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/40 transition-colors p-3 flex items-center gap-3 backdrop-blur-md">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-sm text-white break-words">{b.name}</h3>
                            {b.institution && <p className="text-xs text-white/70 break-words">{b.institution}</p>}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </GlassScrollContainer>
                {overlay.level !== 'conferences' && (
                  <div className="mt-4 flex gap-2">
                    <Button variant="outline" size="sm" onClick={backOverlay} className="bg-white/10 border-white/30 text-white hover:bg-white/20">
                      <ArrowLeft className="h-4 w-4 mr-1" /> Back
                    </Button>
                  </div>
                )}
              </GlassPanel>
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
