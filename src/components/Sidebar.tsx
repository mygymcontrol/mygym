'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

interface SidebarProps {
  activeMenu: string;
}

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: '/icons/dashboard.jpg', href: '/dashboard/' },
  { id: 'alunos', label: 'Alunos', icon: '/icons/alunos.jpg', href: '/dashboard/alunos/' },
  { id: 'professores', label: 'Professores', icon: '/icons/professores.png', href: '/dashboard/professores/' },
  { id: 'modalidades', label: 'Modalidades', icon: '/icons/modalidades.jpg', href: '/dashboard/modalidades/' },
  { id: 'mensalidades', label: 'Mensalidades', icon: '/icons/mensalidades.jpg', href: '/dashboard/mensalidades/' },
  { id: 'checkin', label: 'Check-in QR', icon: '/icons/qrcode.png', href: '/dashboard/checkin/' },
  { id: 'convenios', label: 'Convênios', icon: '/icons/convenios.jpg', href: '/dashboard/convenios/' },
  { id: 'avaliacoes', label: 'Avaliações', icon: '/icons/avaliacoes.jpg', href: '/dashboard/avaliacoes/' },
  { id: 'relatorios', label: 'Relatórios', icon: '/icons/relatorios.jpg', href: '/dashboard/relatorios/' },
  { id: 'whatsapp', label: 'WhatsApp', icon: '/icons/whatsapp.png', href: '/dashboard/whatsapp/' },
  { id: 'configuracoes', label: 'Configurações', icon: '/icons/configuracoes.jpg', href: '/dashboard/configuracoes/' },
  { id: 'precadastros', label: 'Pré-Cadastros', icon: '/icons/novo-aluno.jpg', href: '/dashboard/precadastros/' },
  { id: 'mural', label: 'Mural', icon: '/icons/whatsapp.png', href: '/mural/' },
];

export default function Sidebar({ activeMenu }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  return (
    <aside className={`bg-black border-r border-dark-700 h-screen sticky top-0 flex flex-col transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'}`}>
      {/* Header */}
      <div className="p-4 border-b border-dark-700 flex items-center justify-between">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <img src="/IC.png" alt="MyGym" className="w-8 h-8 rounded" />
            <span className="font-bold text-lg text-dark-100">MyGym</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg hover:bg-dark-700 text-dark-400"
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          {collapsed ? '→' : '←'}
        </button>
      </div>

      {/* Menu */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {menuItems.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className={activeMenu === item.id ? 'sidebar-link-active' : 'sidebar-link'}
            title={collapsed ? item.label : undefined}
          >
            <img src={item.icon} alt={item.label} className="w-5 h-5 rounded" />
            {!collapsed && <span>{item.label}</span>}
          </Link>
        ))}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-dark-700">
        <button
          onClick={handleLogout}
          className="sidebar-link w-full text-red-400 hover:bg-red-900/30 hover:text-red-300"
        >
          <img src="/icons/sair.jpg" alt="Sair" className="w-5 h-5 rounded" />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </aside>
  );
}
