import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { SEO } from '@/components/SEO';
import { StartupScreen } from '@/components/StartupScreen';
import {
  Users, ShieldCheck, FileText, Network, UserCircle,
  Camera, Shield, Pencil,
  type LucideIcon,
} from 'lucide-react';
import {
  HERO_BACKGROUNDS,
  getStoredHeroBg,
  getStoredAvatar,
  setStoredAvatar,
} from '@/lib/heroBackgrounds';

interface MyMembership {
  id?: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  institution: string | null;
  is_active: boolean;
  branch_name?: string;
  zone_name?: string;
  conference_name?: string;
  union_name?: string;
}

const ALL_MODULES: Array<{ to: string; title: string; desc: string; Icon: LucideIcon; accent: string; unionOnly?: boolean }> = [
  { to: '/members',    title: 'Members',    desc: 'Tazama waumini kwa hierarkia yako.', Icon: Users,       accent: 'from-church-blue to-church-blue-light' },
  { to: '/leadership', title: 'Leadership', desc: 'Viongozi wa ngazi yako.',            Icon: ShieldCheck, accent: 'from-gold to-gold-light' },
  { to: '/reports',    title: 'Reports',    desc: 'Ripoti za ngazi yako.',              Icon: FileText,    accent: 'from-emerald to-emerald' },
  { to: '/hierarchy',  title: 'Hierarchy',  desc: 'Union, Conferences, Zones na Branches.', Icon: Network, accent: 'from-bronze to-gold', unionOnly: true },
];

export default function Dashboard() {
  const { user, profile, userRoles, highestLevel, isUnionLeader, isSuperAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [myMembership, setMyMembership] = useState<MyMembership | null>(null);
  const [dashboardReady, setDashboardReady] = useState(false);
  const [bgId] = useState<string>(getStoredHeroBg());
  const [avatar, setAvatar] = useState<string | null>(user ? getStoredAvatar(user.id) : null);
  const [activeModule, setActiveModule] = useState<{ title: string; to: string } | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ full_name: '', phone: '', institution: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const isPlainMember = userRoles.length === 0 && !isSuperAdmin;
  const hasAnyLeadership = userRoles.length > 0 || isSuperAdmin;
  // Plain members can only see the Leadership module (to know their leaders).
  const visibleModules = ALL_MODULES.filter(m => {
    if (m.unionOnly && !hasAnyLeadership) return false;
    if (isPlainMember && m.to !== '/leadership' && m.to !== '/reports') return false;
    return true;
  });

  useEffect(() => {
    if (user) setAvatar(getStoredAvatar(user.id));
  }, [user]);

  useEffect(() => {
    if (!user) {
      setDashboardReady(false);
      return;
    }

    let cancelled = false;
    const startedAt = Date.now();

    (async () => {
      try {
        const { data: m } = await (supabase.from('members') as any)
          .select('id, full_name, email, phone, institution, is_active, branch_id')
          .eq('user_id', user.id).maybeSingle();
        if (!m || cancelled) return;

        setMyMembership({
          id: (m as any).id,
          full_name: (m as any).full_name,
          email: (m as any).email,
          phone: (m as any).phone,
          institution: (m as any).institution,
          is_active: (m as any).is_active,
        });

        const [bRes, allZ, allC, allU] = await Promise.all([
          supabase.from('branches').select('name, zone_id').eq('id', (m as any).branch_id).maybeSingle(),
          supabase.from('zones').select('id, name, conference_id'),
          supabase.from('conferences').select('id, name, union_id'),
          supabase.from('unions').select('id, name'),
        ]);

        if (cancelled) return;

        const b: any = bRes.data;
        const z: any = b ? (allZ.data || []).find((x: any) => x.id === b.zone_id) : null;
        const c: any = z ? (allC.data || []).find((x: any) => x.id === z.conference_id) : null;
        const u: any = c ? (allU.data || []).find((x: any) => x.id === c.union_id) : null;

        setMyMembership(prev => prev ? {
          ...prev,
          branch_name: b?.name,
          zone_name: z?.name,
          conference_name: c?.name,
          union_name: u?.name,
        } : prev);

        const elapsed = Date.now() - startedAt;
        const remaining = Math.max(0, 800 - elapsed);
        window.setTimeout(() => {
          if (!cancelled) setDashboardReady(true);
        }, remaining);
      } catch {
        if (!cancelled) setDashboardReady(true);
      }
    })();

    return () => { cancelled = true; };
  }, [user]);

  const currentBg = HERO_BACKGROUNDS.find(b => b.id === bgId) || HERO_BACKGROUNDS[0];
  const heroStyle = { ['--hero-bg-image' as any]: `url(${currentBg.url})`, transition: 'background-image 0.4s ease' } as React.CSSProperties;

  const handleAvatarPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setAvatar(dataUrl);
      setStoredAvatar(user.id, dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleModuleTap = (module: { title: string; to: string }) => {
    if (window.matchMedia('(max-width: 768px)').matches) {
      setActiveModule(module);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    navigate(module.to);
  };

  const levelLabel = highestLevel
    ? highestLevel.charAt(0).toUpperCase() + highestLevel.slice(1) + ' Leader'
    : 'Member';

  const formatHeroName = (fullName?: string) => {
    const fallback = 'Member';
    if (!fullName) return fallback;
    const words = fullName.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return fallback;

    const firstTwo = words.slice(0, 2).join(' ');
    // If two names together are too long, fall back to single first name
    const MAX_LEN = 24;
    if (firstTwo.length > MAX_LEN) return words[0];

    return words.length === 1 ? words[0] : firstTwo;
  };

  if (!dashboardReady) {
    return <StartupScreen />;
  }

  return (
    <DashboardLayout>
      <SEO
        title="Dashboard"
        description="TUCASA STUM member dashboard with quick access to members, leadership, hierarchy and reports."
      />
      {/* ───── HERO ───── */}
      <section className="relative hero-bg px-4 py-5 sm:p-10 mb-8" style={heroStyle}>
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="/PCM-logo.png" alt="PCM Logo" className="h-10 w-10 rounded-lg object-contain" />
            <div>
              <span className="text-lg font-semibold uppercase tracking-[0.22em] text-white">
                TUCASA STUM
              </span>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-white text-sm uppercase tracking-[0.18em]">
            <span>Dashboard</span>
          </div>
        </div>
        <div className="flex flex-col md:flex-row items-center md:items-stretch justify-between gap-8">
          {/* LEFT: profile */}
          <div className="flex items-center gap-5 sm:gap-6 text-white">
            <div className="relative group -ml-3 sm:ml-0 flex-shrink-0">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border-4 border-white/70 shadow-xl bg-white/10 backdrop-blur-sm">
                {avatar ? (
                  <img src={avatar} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <UserCircle className="w-16 h-16 text-white/80" />
                  </div>
                )}
              </div>
              <button
                onClick={() => fileRef.current?.click()}
                className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full gradient-gold border-2 border-white shadow-lg flex items-center justify-center hover:scale-110 transition-transform"
                aria-label="Change photo"
                type="button"
              >
                <Camera className="w-4 h-4 text-white" />
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarPick} />
            </div>

            <div className="min-w-0">
              <h1 title={profile?.full_name} className="font-display text-3xl sm:text-4xl leading-tight text-white truncate">
                {formatHeroName(profile?.full_name)}
              </h1>
              <div className="hidden sm:inline-flex mt-2 items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md border border-white/25 text-sm">
                <Shield className="w-3.5 h-3.5 text-gold-light" />
                <span className="text-white/95">{levelLabel}</span>
              </div>
            </div>
          </div>

          {/* RIGHT: sign out action */}
          <div className="hidden sm:flex flex-col items-center sm:items-end gap-2 text-center sm:text-right text-white">
            <Button
              variant="outline"
              size="sm"
              onClick={signOut}
              className="rounded-full border-white/40 bg-white/20 text-white hover:bg-white/40 hover:text-black shadow-lg"
            >
              Sign Out
            </Button>
          </div>
          {/* Mobile-only bottom corners */}
          <div className="sm:hidden">
            <div className="absolute left-4 -bottom-8 z-50">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md border border-white/25 text-sm">
                <Shield className="w-3.5 h-3.5 text-gold-light" />
                <span className="text-white/95">{levelLabel}</span>
              </div>
            </div>
            <div className="absolute right-4 -bottom-8 z-50">
              <Button
                variant="outline"
                size="sm"
                onClick={signOut}
                className="rounded-full border-white/40 bg-white/20 text-white hover:bg-white/40 hover:text-black shadow-lg"
              >
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ───── MODULE CARDS ───── */}
      <section className="mb-8">
        {activeModule && (
          <>
            <div
              className="fixed inset-0 z-40 bg-[#0a1228]/45 backdrop-blur-[2px]"
              onClick={() => setActiveModule(null)}
            />
            <div className="fixed inset-x-0 top-4 z-50 flex justify-center px-4">
              <div className="w-full max-w-[420px] animate-slide-down">
              <div className="glass-card p-5 border border-white/25 shadow-2xl backdrop-blur-2xl bg-gradient-to-br from-white/25 via-white/12 to-white/5 rounded-[28px]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.28em] text-white/70">Quick actions</p>
                    <h3 className="mt-2 text-lg font-semibold text-white">{activeModule.title}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveModule(null)}
                    className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs text-white hover:bg-white/20"
                  >
                    Close
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigate(activeModule.to);
                    setActiveModule(null);
                  }}
                  className="mt-4 w-full rounded-2xl bg-gradient-to-r from-church-blue to-church-blue-light px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-church-blue/20"
                >
                    Open {activeModule.title}
                </button>
              </div>
              </div>
            </div>
          </>
        )}

        {visibleModules.length > 0 && (
          <div className="glass-card p-3 sm:p-5 xl:p-6 border border-white/15 shadow-2xl">
            <div className="grid grid-cols-3 gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-4">
              {visibleModules.map((module) => (
                <button
                  key={module.to}
                  type="button"
                  onClick={() => handleModuleTap(module)}
                  className="glass-card-hover group h-full p-3 sm:p-5 flex flex-col items-center justify-center text-center overflow-hidden relative focus:outline-none focus-visible:ring-2 focus-visible:ring-church-blue/50"
                >
                  <div className={`absolute -top-8 -right-8 w-24 h-24 rounded-full bg-gradient-to-br ${module.accent} opacity-10 group-hover:opacity-25 group-hover:scale-105 transition-all duration-500`} />
                  <div className={`inline-flex items-center justify-center mx-auto mb-3 w-10 h-10 sm:w-12 sm:h-12 rounded-3xl bg-gradient-to-br ${module.accent} text-white shadow-xl group-hover:scale-110 transition-transform`}>
                    <module.Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <h3 className="font-display text-sm sm:text-base font-semibold text-foreground leading-tight">{module.title}</h3>

                  <div className="hidden md:block absolute left-1/2 -bottom-6 transform -translate-x-1/2 pointer-events-none">
                    <module.Icon className="reflection-icon w-10 h-10 text-foreground/60" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {myMembership && (
        <Card className="glass-card mb-6">
              <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg font-display">
                  <UserCircle className="h-5 w-5 text-church-blue" /> My Membership Details
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline" size="sm" className="gap-1"
                    onClick={() => {
                      setEditForm({
                        full_name: myMembership.full_name || '',
                        phone: myMembership.phone || '',
                        institution: myMembership.institution || '',
                      });
                      setEditOpen(true);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                </div>
              </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div><span className="text-muted-foreground">Name:</span> <span className="font-medium">{myMembership.full_name}</span></div>
            <div><span className="text-muted-foreground">Status:</span> <span className="font-medium">{myMembership.is_active ? 'Active' : 'Inactive'}</span></div>
            {myMembership.phone && <div><span className="text-muted-foreground">Phone:</span> {myMembership.phone}</div>}
            {myMembership.institution && <div><span className="text-muted-foreground">Institution:</span> {myMembership.institution}</div>}
            {myMembership.union_name && <div><span className="text-muted-foreground">Union:</span> {myMembership.union_name}</div>}
            {myMembership.conference_name && <div><span className="text-muted-foreground">Conference:</span> {myMembership.conference_name}</div>}
            {myMembership.zone_name && <div><span className="text-muted-foreground">Zone:</span> {myMembership.zone_name}</div>}
            {myMembership.branch_name && <div><span className="text-muted-foreground">Branch:</span> {myMembership.branch_name}</div>}
          </CardContent>
        </Card>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit My Details</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!user || !myMembership?.id) return;
              setSavingProfile(true);
              const payload = {
                full_name: editForm.full_name.trim(),
                phone: editForm.phone.trim() || null,
                institution: editForm.institution.trim() || null,
              };
              const { error: mErr } = await supabase.from('members').update(payload).eq('id', myMembership.id);
              const { error: pErr } = await supabase.from('profiles').update(payload).eq('user_id', user.id);
              setSavingProfile(false);
              if (mErr || pErr) {
                  toast({ title: 'Error', description: (mErr || pErr)?.message, variant: 'destructive' });
                return;
              }
                toast({ title: 'Details saved' });
              setEditOpen(false);
              setMyMembership(prev => prev ? { ...prev, ...payload } : prev);
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={editForm.full_name} onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Institution / College</Label>
              <Input value={editForm.institution} onChange={e => setEditForm(f => ({ ...f, institution: e.target.value }))} />
            </div>
            <p className="text-xs text-muted-foreground">Note: Branch cannot be changed here. Contact your branch leader if you have moved.</p>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={savingProfile}>{savingProfile ? 'Saving...' : 'Save'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {isPlainMember && !myMembership && (
        <Card className="border-dashed glass-card">
          <CardContent className="py-10 text-center px-4">
            <Users className="h-10 w-10 mx-auto text-muted-foreground/40 mb-4" />
            <h3 className="font-display text-lg mb-2">Your details are not available</h3>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              Contact your branch leader.
            </p>
          </CardContent>
        </Card>
      )}
    </DashboardLayout>
  );
}
