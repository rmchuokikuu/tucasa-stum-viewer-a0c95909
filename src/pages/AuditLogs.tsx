import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ExportMenu } from '@/components/ExportMenu';
import { ShieldAlert, Search, ArrowLeft } from 'lucide-react';
import { SEO } from '@/components/SEO';
import { GlassCard, GlassPanel, GlassButton } from '@/components/glass';

interface AuditRow {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  created_at: string;
  old_values: any;
  new_values: any;
}

const ACTION_COLORS: Record<string, string> = {
  created: 'bg-success/15 text-success border-success/30',
  updated: 'bg-info/15 text-info border-info/30',
  deleted: 'bg-destructive/15 text-destructive border-destructive/30',
};

export default function AuditLogs() {
  const navigate = useNavigate();
  const { isUnionLeader } = useAuth();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [actorNames, setActorNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [entityFilter, setEntityFilter] = useState<string>('all');

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      const fetched = (data as AuditRow[]) || [];
      setRows(fetched);
      // Fetch actor names for any actor_ids we have
      const ids = Array.from(new Set(fetched.map(r => r.actor_id).filter(Boolean) as string[]));
      if (ids.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', ids);
        const map: Record<string, string> = {};
        (profiles || []).forEach(p => { (map as any)[p.user_id] = p.full_name; });
        setActorNames(map);
      }
      setLoading(false);
    })();
  }, []);

  if (!isUnionLeader) {
    return (
      <DashboardLayout>
        <SEO
          title="Audit Logs"
          description="Audit logs are restricted to Union leaders in TUCASA STUM."
        />
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <ShieldAlert className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h2 className="font-display text-lg font-semibold">Restricted</h2>
          <p className="text-sm text-muted-foreground max-w-md">Audit logs are only visible to Union-level leaders.</p>
        </div>
      </DashboardLayout>
    );
  }

  const filtered = rows.filter(r => {
    if (actionFilter !== 'all' && r.action !== actionFilter) return false;
    if (entityFilter !== 'all' && r.entity_type !== entityFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        (r.actor_id && r.actor_id.toLowerCase().includes(q)) ||
        (actorNames[r.actor_id || ''] && actorNames[r.actor_id || ''].toLowerCase().includes(q)) ||
        r.entity_type.toLowerCase().includes(q) ||
        r.entity_id?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const entityTypes = Array.from(new Set(rows.map(r => r.entity_type)));

  const exportRows = filtered.map(r => ({
    Timestamp: new Date(r.created_at).toLocaleString(),
    Actor: actorNames[r.actor_id || ''] || r.actor_id || 'system',
    Action: r.action,
    Entity: r.entity_type,
    'Record ID': r.entity_id || '',
  }));

  return (
    <DashboardLayout>
      <SEO
        title="Audit Logs"
        description="Review the last 500 system changes for TUCASA STUM with audit logging."
      />
      <GlassPanel
        subtitle="Audit"
        title="Audit Logs"
        className="mb-4"
      >
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <p className="text-sm text-white/80">Last 500 changes across the system.</p>
          <div className="flex items-center gap-2">
            <GlassButton size="icon" onClick={() => navigate('/dashboard')} className="h-10 w-10 rounded-full" aria-label="Back to dashboard">
              <ArrowLeft className="h-4 w-4" />
            </GlassButton>
            <ExportMenu rows={exportRows} filename="audit-logs" title="TUCASA Audit Logs" />
          </div>
        </div>
      </GlassPanel>

      <GlassCard variant="subtle" className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/70" />
          <Input placeholder="Search actor, entity, id..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-white/10 border-white/20 text-white placeholder:text-white/60" />
        </div>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-full sm:w-[140px] bg-white/10 border-white/20 text-white"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            <SelectItem value="created">Created</SelectItem>
            <SelectItem value="updated">Updated</SelectItem>
            <SelectItem value="deleted">Deleted</SelectItem>
          </SelectContent>
        </Select>
        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="w-full sm:w-[160px] bg-white/10 border-white/20 text-white"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All entities</SelectItem>
            {entityTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </GlassCard>

      {loading ? (
        <p className="text-center text-white/70 py-8">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="text-center text-white/70 py-8">No audit entries match.</p>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {filtered.map(r => (
              <GlassCard key={r.id} variant="subtle">
                <div className="flex items-center justify-between mb-1">
                  <Badge variant="outline" className={ACTION_COLORS[r.action] || ''}>{r.action}</Badge>
                  <span className="text-[10px] text-white/70">{new Date(r.created_at).toLocaleString()}</span>
                </div>
                <p className="text-sm font-medium text-white">{r.entity_type}</p>
                <p className="text-xs text-white/70 truncate">by {actorNames[r.actor_id || ''] || r.actor_id || 'system'}</p>
              </GlassCard>
            ))}
          </div>

          {/* Desktop table */}
          <GlassCard className="hidden md:block !p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/15 hover:bg-transparent">
                    <TableHead className="text-white/85">Time</TableHead>
                    <TableHead className="text-white/85">Actor</TableHead>
                    <TableHead className="text-white/85">Action</TableHead>
                    <TableHead className="text-white/85">Entity</TableHead>
                    <TableHead className="text-white/85">Record ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(r => (
                    <TableRow key={r.id} className="border-white/10 hover:bg-white/5">
                      <TableCell className="text-xs whitespace-nowrap text-white/90">{new Date(r.created_at).toLocaleString()}</TableCell>
                      <TableCell className="text-xs text-white/90">{actorNames[r.actor_id || ''] || r.actor_id || <span className="text-white/60">system</span>}</TableCell>
                      <TableCell><Badge variant="outline" className={ACTION_COLORS[r.action] || ''}>{r.action}</Badge></TableCell>
                      <TableCell className="text-xs font-mono text-white/90">{r.entity_type}</TableCell>
                      <TableCell className="text-xs font-mono text-white/70">{r.entity_id?.slice(0, 8)}…</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </GlassCard>
        </>
      )}
    </DashboardLayout>
  );
}
