import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { SEO } from '@/components/SEO';

import { Sparkles, PartyPopper, Loader2, CheckCircle2 } from 'lucide-react';

type Stage = 'form' | 'submitting' | 'celebrating' | 'redirecting';

export default function Welcome() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const [course, setCourse] = useState('');
  const [duration, setDuration] = useState('');
  const [year, setYear] = useState('');
  const [stage, setStage] = useState<Stage>('form');

  // If profile already has academic info, skip
  useEffect(() => {
    if (loading) return;
    if (!user) { navigate('/auth', { replace: true }); return; }

    const fromSignup = (location.state as any)?.fromSignup;

    if (profile && (profile as any).course && (profile as any).year_of_study) {
      if (fromSignup) {
        // If we just came from signup, defer the dashboard redirect briefly
        // to avoid a race between auth hydration and route changes.
        setTimeout(() => navigate('/dashboard', { replace: true }), 500);
        // Clear the history state so subsequent mounts don't see fromSignup
        try { window.history.replaceState({}, document.title, window.location.pathname); } catch {}
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [user, profile, loading, navigate, location.state]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const d = parseInt(duration, 10);
    const y = parseInt(year, 10);
    if (!course.trim() || !d || !y || y < 1 || d < 1 || y > d + 10) {
      toast({ title: 'Check your entries', description: 'Please enter a valid course, duration and year of study.', variant: 'destructive' });
      return;
    }
    setStage('submitting');
    const completed = y >= d;
    const { error } = await supabase.from('profiles').update({
      course: course.trim(),
      course_duration: d,
      year_of_study: y,
      academic_completed_at: completed ? new Date().toISOString() : null,
    } as any).eq('user_id', user.id);
    if (error) {
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
      setStage('form');
      return;
    }
    setStage('celebrating');
    setTimeout(() => setStage('redirecting'), 2400);
    setTimeout(() => navigate('/dashboard', { replace: true }), 3800);
  };

  const bgStyle = {
    background:
      "radial-gradient(1200px 700px at 10% -10%, rgba(96,165,250,0.5), transparent 60%)," +
      "radial-gradient(900px 600px at 100% 0%, rgba(186,230,253,0.35), transparent 60%)," +
      "radial-gradient(900px 700px at 50% 120%, rgba(59,130,246,0.45), transparent 60%)," +
      "linear-gradient(180deg, #173A82 0%, #1E4AA0 50%, #173A82 100%)",
  };

  return (
    <>
      <SEO
        title="Complete Registration"
        description="Finish your TUCASA STUM registration by adding course and year of study information."
      />
      <div className="relative min-h-screen w-full overflow-hidden flex items-center justify-center px-4 py-10" style={bgStyle}>
        {/* Confetti / sparkle background layer for celebration */}
        {(stage === 'celebrating' || stage === 'redirecting') && (
          <div className="pointer-events-none fixed inset-0 z-20 overflow-hidden">
            {Array.from({ length: 40 }).map((_, i) => (
              <span
                key={i}
                className="absolute block rounded-sm animate-confetti"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `-10%`,
                  width: `${6 + Math.random() * 8}px`,
                  height: `${10 + Math.random() * 14}px`,
                  background: ['#60A5FA','#FBBF24','#34D399','#F472B6','#A78BFA'][i % 5],
                  animationDelay: `${Math.random() * 1.2}s`,
                  animationDuration: `${2.4 + Math.random() * 1.8}s`,
                  transform: `rotate(${Math.random() * 360}deg)`,
                }}
              />
            ))}
          </div>
        )}

        <div className="relative z-10 w-full max-w-md">
          {stage === 'form' && (
            <div className="rounded-[30px] p-6 sm:p-8 bg-gradient-to-br from-white/25 via-white/12 to-white/5 border border-white/30 shadow-[0_32px_90px_-30px_rgba(2,8,23,0.75)] backdrop-blur-[32px] animate-slide-down">
              <div className="flex flex-col items-center text-center mb-6">
                <img src="/PCM-logo.png" alt="TUCASA" className="w-16 h-16 object-contain drop-shadow-[0_0_25px_rgba(96,165,250,0.5)] mb-3 animate-float" />
                <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-wide drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)]">
                  Welcome to TUCASA STUM
                </h1>
                <p className="mt-2 text-sm text-white/85">Complete this quick form to finish your registration.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-white font-semibold text-sm">Course</Label>
                  <Input
                    className="auth-input-readable"
                    placeholder="e.g. BSc Computer Science"
                    value={course}
                    onChange={e => setCourse(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-white font-semibold text-sm">Course Duration (miaka)</Label>
                  <Input
                    className="auth-input-readable"
                    type="number"
                    min={1}
                    max={10}
                    placeholder="e.g. 3"
                    value={duration}
                    onChange={e => setDuration(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-white font-semibold text-sm">Year of Study</Label>
                  <Input
                    className="auth-input-readable"
                    type="number"
                    min={1}
                    max={10}
                    placeholder="e.g. 2"
                    value={year}
                    onChange={e => setYear(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="auth-submit w-full mt-2">Submit</Button>
              </form>
            </div>
          )}

          {stage === 'submitting' && (
            <div className="rounded-[30px] p-10 text-center bg-gradient-to-br from-white/25 via-white/12 to-white/5 border border-white/30 backdrop-blur-[32px] animate-fade-in">
              <Loader2 className="mx-auto h-12 w-12 text-white animate-spin" />
              <p className="mt-4 text-white font-medium">Saving your information...</p>
            </div>
          )}

          {stage === 'celebrating' && (
            <div className="rounded-[30px] p-8 sm:p-10 text-center bg-gradient-to-br from-white/30 via-white/15 to-white/5 border border-white/40 backdrop-blur-[32px] animate-scale-in shadow-[0_40px_120px_-30px_rgba(2,8,23,0.9)]">
              <div className="relative mx-auto w-20 h-20 mb-4">
                <div className="absolute inset-0 rounded-full bg-emerald-400/30 animate-ping" />
                <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-2xl">
                  <CheckCircle2 className="w-12 h-12 text-white" strokeWidth={2.5} />
                </div>
              </div>
              <div className="flex items-center justify-center gap-2 mb-2">
                <PartyPopper className="w-6 h-6 text-yellow-300 animate-bounce" />
                <h2 className="text-2xl sm:text-3xl font-bold text-white drop-shadow-lg">Congratulations!</h2>
                <Sparkles className="w-6 h-6 text-yellow-300 animate-pulse" />
              </div>
              <p className="text-white/95 text-sm sm:text-base leading-relaxed">
                You have been registered as an <span className="font-semibold text-yellow-200">active member</span> of TUCASA STUM.
              </p>
            </div>
          )}

          {stage === 'redirecting' && (
            <div className="rounded-[30px] p-10 text-center bg-gradient-to-br from-white/25 via-white/12 to-white/5 border border-white/30 backdrop-blur-[32px] animate-fade-in">
              <Loader2 className="mx-auto h-12 w-12 text-white animate-spin" />
              <p className="mt-4 text-white font-medium">Inakupeleka kwenye dashboard...</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
