'use client';

import { useEffect, useState } from 'react';
import { supabase, Profile } from '@/lib/supabase';
import Sidebar from './Sidebar';

interface DashboardLayoutProps {
  children: React.ReactNode;
  activeMenu: string;
  title: string;
}

export default function DashboardLayout({ children, activeMenu, title }: DashboardLayoutProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      window.location.href = '/';
      return;
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileData) {
      setProfile(profileData);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-dark-400">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar activeMenu={activeMenu} />
      <main className="flex-1 p-6 lg:p-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-dark-100">{title}</h1>
          </div>
          {profile && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-dark-400">Olá, {profile.nome}</span>
              <div className="w-8 h-8 bg-primary-900/50 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-primary-400">
                  {profile.nome?.charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
          )}
        </div>
        {children}
      </main>
    </div>
  );
}
