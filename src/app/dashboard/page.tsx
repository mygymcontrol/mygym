'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getHoje } from '@/lib/utils';
import { renovarMensalidades } from '@/lib/renovar-mensalidades';
import DashboardLayout from '@/components/DashboardLayout';

interface DashboardStats {
  totalAlunos: number;
  alunosAtivos: number;
  inadimplentes: number;
  receitaMes: number;
  checkinsHoje: number;
  mensalidadesPendentes: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalAlunos: 0,
    alunosAtivos: 0,
    inadimplentes: 0,
    receitaMes: 0,
    checkinsHoje: 0,
    mensalidadesPendentes: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      // Renovar mensalidades automaticamente
      await renovarMensalidades();

      // Total de alunos
      const { count: totalAlunos } = await supabase
        .from('alunos')
        .select('*', { count: 'exact', head: true });

      // Alunos ativos
      const { count: alunosAtivos } = await supabase
        .from('alunos')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'ativo');

      // Inadimplentes = alunos com pelo menos 1 mensalidade atrasada
      const { data: mensAtrasadas } = await supabase
        .from('mensalidades')
        .select('aluno_id')
        .eq('status', 'atrasado');
      const alunosInadimplentes = new Set(mensAtrasadas?.map(m => m.aluno_id) || []);
      const inadimplentes = alunosInadimplentes.size;

      // Receita do mês (mensalidades pagas no mês atual)
      const inicioMes = new Date();
      inicioMes.setDate(1);
      const { data: pagamentos } = await supabase
        .from('mensalidades')
        .select('valor')
        .eq('status', 'pago')
        .gte('data_pagamento', inicioMes.toISOString().split('T')[0]);

      const receitaMes = pagamentos?.reduce((sum, p) => sum + Number(p.valor), 0) || 0;

      // Check-ins hoje
      const hoje = getHoje();
      const { count: checkinsHoje } = await supabase
        .from('checkins')
        .select('*', { count: 'exact', head: true })
        .eq('data', hoje);

      // Mensalidades pendentes = atrasadas + pendentes do mês atual
      const mesAtual = new Date().getMonth() + 1;
      const anoAtual = new Date().getFullYear();
      const inicioMesStr = `${anoAtual}-${String(mesAtual).padStart(2, '0')}-01`;
      const fimMesStr = `${anoAtual}-${String(mesAtual).padStart(2, '0')}-31`;

      const { count: atrasadas } = await supabase
        .from('mensalidades')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'atrasado');

      const { count: pendentesMesAtual } = await supabase
        .from('mensalidades')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pendente')
        .gte('data_vencimento', inicioMesStr)
        .lte('data_vencimento', fimMesStr);

      const mensalidadesPendentes = (atrasadas || 0) + (pendentesMesAtual || 0);

      setStats({
        totalAlunos: totalAlunos || 0,
        alunosAtivos: alunosAtivos || 0,
        inadimplentes,
        receitaMes,
        checkinsHoje: checkinsHoje || 0,
        mensalidadesPendentes,
      });
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    } finally {
      setLoading(false);
    }
  };

  const kpiCards = [
    { label: 'Total de Alunos', value: stats.totalAlunos, icon: '/icons/alunos.jpg', color: 'bg-dark-700' },
    { label: 'Alunos Ativos', value: stats.alunosAtivos, icon: '/icons/alunos-ativos.jpg', color: 'bg-dark-700' },
    { label: 'Inadimplentes', value: stats.inadimplentes, icon: '/icons/inadimplentes.jpg', color: 'bg-dark-700' },
    { label: 'Receita do Mês', value: `R$ ${stats.receitaMes.toFixed(2)}`, icon: '/icons/mensalidades.jpg', color: 'bg-dark-700' },
    { label: 'Check-ins Hoje', value: stats.checkinsHoje, icon: '/icons/qrcode.png', color: 'bg-dark-700' },
    { label: 'Mensalidades Pendentes', value: stats.mensalidadesPendentes, icon: '/icons/mensalidades-pendentes.jpg', color: 'bg-dark-700' },
  ];

  return (
    <DashboardLayout activeMenu="dashboard" title="Dashboard">
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-4 bg-dark-700 rounded w-1/2 mb-4"></div>
              <div className="h-8 bg-dark-700 rounded w-1/3"></div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {kpiCards.map((kpi, index) => (
              <div key={index} className="card hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-dark-400 mb-1">{kpi.label}</p>
                    <p className="text-2xl font-bold text-dark-100">{kpi.value}</p>
                  </div>
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${kpi.color}`}>
                    <img src={kpi.icon} alt={kpi.label} className="w-8 h-8 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="card">
            <h2 className="text-lg font-semibold text-dark-100 mb-4">Ações Rápidas</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <a href="/dashboard/alunos/?action=novo" className="p-4 rounded-xl bg-dark-700 text-center hover:bg-dark-600 transition-colors">
                <img src="/icons/novo-aluno.jpg" alt="" className="w-8 h-8 mx-auto mb-2 rounded" />
                <span className="text-sm font-medium text-dark-200">Novo Aluno</span>
              </a>
              <a href="/dashboard/mensalidades/" className="p-4 rounded-xl bg-dark-700 text-center hover:bg-dark-600 transition-colors">
                <img src="/icons/mensalidades2.jpg" alt="" className="w-8 h-8 mx-auto mb-2 rounded" />
                <span className="text-sm font-medium text-dark-200">Mensalidades</span>
              </a>
              <a href="/dashboard/checkin/" className="p-4 rounded-xl bg-dark-700 text-center hover:bg-dark-600 transition-colors">
                <img src="/icons/qrcode.png" alt="" className="w-8 h-8 mx-auto mb-2 rounded" />
                <span className="text-sm font-medium text-dark-200">QR Code</span>
              </a>
              <a href="/dashboard/whatsapp/" className="p-4 rounded-xl bg-dark-700 text-center hover:bg-dark-600 transition-colors">
                <img src="/icons/whatsapp.png" alt="" className="w-8 h-8 mx-auto mb-2 rounded" />
                <span className="text-sm font-medium text-dark-200">WhatsApp</span>
              </a>
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
