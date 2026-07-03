import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

type Profile = Tables<'profiles'>;

interface UserRole {
  id: string;
  role_id: string;
  hierarchy_level: 'union' | 'conference' | 'zone' | 'branch';
  level_id: string;
  role_name: string;
  permissions: string[];
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  userRoles: UserRole[];
  loading: boolean;
  isUnionLeader: boolean;
  isSuperAdmin: boolean;
  signIn: (phone: string, password: string) => Promise<void>;
  signUp: (phone: string, password: string, fullName: string, branchId: string, institution?: string) => Promise<void>;
  signOut: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  highestLevel: 'union' | 'conference' | 'zone' | 'branch' | null;
  refreshRoles: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();
    setProfile(data);
  };

  const fetchUserRoles = async (userId: string) => {
    const { data: roles } = await supabase
      .from('user_roles')
      .select('id, role_id, hierarchy_level, level_id')
      .eq('user_id', userId);

    if (!roles || roles.length === 0) {
      setUserRoles([]);
      return;
    }

    const roleIds = [...new Set(roles.map(r => r.role_id))];
    const { data: roleData } = await supabase
      .from('roles')
      .select('id, name')
      .in('id', roleIds);

    const { data: rolePerms } = await supabase
      .from('role_permissions')
      .select('role_id, permission_id')
      .in('role_id', roleIds);

    const permIds = [...new Set((rolePerms || []).map(rp => rp.permission_id))];
    const { data: permsData } = permIds.length > 0
      ? await supabase.from('permissions').select('id, name').in('id', permIds)
      : { data: [] };

    const permMap = new Map((permsData || []).map(p => [p.id, p.name]));
    const rolePermMap = new Map<string, string[]>();
    (rolePerms || []).forEach(rp => {
      const perms = rolePermMap.get(rp.role_id) || [];
      const permName = permMap.get(rp.permission_id);
      if (permName) perms.push(permName);
      rolePermMap.set(rp.role_id, perms);
    });

    const roleNameMap = new Map((roleData || []).map(r => [r.id, r.name]));

    const enrichedRoles: UserRole[] = roles.map(r => ({
      id: r.id,
      role_id: r.role_id,
      hierarchy_level: r.hierarchy_level,
      level_id: r.level_id,
      role_name: roleNameMap.get(r.role_id) || 'Unknown',
      permissions: rolePermMap.get(r.role_id) || [],
    }));

    setUserRoles(enrichedRoles);
  };

  const refreshRoles = async () => {
    if (user) await fetchUserRoles(user.id);
  };

  useEffect(() => {
    let mounted = true;

    const hydrate = async (session: Session | null) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        const [, , superRes] = await Promise.all([
          fetchProfile(session.user.id),
          fetchUserRoles(session.user.id),
          supabase.rpc('is_super_admin', { _uid: session.user.id }),
        ]);
        if (mounted) setIsSuperAdmin(Boolean((superRes as any)?.data));
      } else {
        setProfile(null);
        setUserRoles([]);
        setIsSuperAdmin(false);
      }
      if (mounted) setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      // Defer to avoid deadlocks inside the auth callback
      setTimeout(() => hydrate(session), 0);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      hydrate(session);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const isUnionLeader = userRoles.some(r => r.hierarchy_level === 'union') || isSuperAdmin;

  const hasPermission = (permission: string) => {
    if (isSuperAdmin) return true;
    return userRoles.some(r => r.permissions.includes(permission));
  };

  const levelOrder = { union: 0, conference: 1, zone: 2, branch: 3 };
  const highestLevel = userRoles.length > 0
    ? userRoles.reduce((best, r) =>
        levelOrder[r.hierarchy_level] < levelOrder[best] ? r.hierarchy_level : best,
      userRoles[0].hierarchy_level)
    : null;

  const phoneToEmail = (phone: string) => {
    const clean = phone.replace(/\D/g, '');
    return `${clean}@tucasa.local`;
  };

  const signIn = async (phone: string, password: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: phoneToEmail(phone),
        password,
      });
      if (error) throw error;
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (phone: string, password: string, fullName: string, branchId: string, institution?: string) => {
    setLoading(true);
    try {
      const clean = phone.replace(/\D/g, '');
      const { error } = await supabase.auth.signUp({
        email: phoneToEmail(phone),
        password,
        options: {
          data: { full_name: fullName, phone: clean, branch_id: branchId, institution: institution || null },
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{
      user, session, profile, userRoles, loading,
      isUnionLeader, isSuperAdmin, signIn, signUp, signOut, hasPermission, highestLevel, refreshRoles,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
