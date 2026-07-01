'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getHoje } from '@/lib/utils';
import DashboardLayout from '@/components/DashboardLayout';

export default function AniversariantesPage() {
  const [aniversariantesHoje, setAniversariantesHoje] = useState<any[]>([]);
  const [aniversariantesMes, setAniversariantesMes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const { data: alunos } = await supabase
      .from('alunos')
      .select('id, nome, email, telefone, data_nascimento, status')
      .eq('status', 'ativo')
      .not('data_nascimento', 'is', null)
      .order('nome');

    if (!alunos) { setLoading(false); return; }

    const hoje = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const diaHoje = hoje.getDate();
    const mesHoje = hoje.getMonth() + 1;

    const doHoje: any[] = [];
    const doMes: any[] = [];

    alunos.forEach(a => {
      if (!a.data_nascimento) return;
      const [ano, mes, dia] = a.data_nascimento.split('-').map(Number);
      if (mes === mesHoje) {
        const idade = hoje.getFullYear() - ano;
        const item = { ...a, dia, idade };
        if (dia === diaHoje) doHoje.push(item);
        doMes.push(item);
      }
    });

    doMes.sort((a, b) => a.dia - b.dia);
    setAniversariantesHoje(doHoje);
    setAniversariantesMes(doMes);
    setLoading(false);
  };

  const meses = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const mesAtual = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })).getMonth() + 1;

  return (
    <DashboardLayout activeMenu="aniversariantes" title="Aniversariantes">
      {loading ? (
        <div className="card animate-pulse"><div className="h-20 bg-dark-700 rounded"></div></div>
      ) : (
        <div className="space-y-6">
          {/* Aniversariantes de Hoje */}
          <div className="card">
            <h2 className="text-lg font-semibold text-dark-100 mb-4">🎂 Aniversariantes de Hoje</h2>
            {aniversariantesHoje.length === 0 ? (
              <p className="text-dark-400 text-center py-6">Nenhum aniversariante hoje.</p>
            ) : (
              <div className="space-y-3">
                {aniversariantesHoje.map(a => (
                  <div key={a.id} className="flex items-center justify-between p-4 bg-yellow-900/20 border border-yellow-700 rounded-xl">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">🎉</span>
                      <div>
                        <p className="font-semibold text-dark-100">{a.nome}</p>
                        <p className="text-sm text-dark-400">{a.telefone} • {a.email}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-yellow-400">{a.idade}</p>
                      <p className="text-xs text-dark-400">anos</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Aniversariantes do Mês */}
          <div className="card">
            <h2 className="text-lg font-semibold text-dark-100 mb-4">📅 Aniversariantes de {meses[mesAtual]}</h2>
            {aniversariantesMes.length === 0 ? (
              <p className="text-dark-400 text-center py-6">Nenhum aniversariante este mês.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-dark-800">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-medium text-dark-400 uppercase">Dia</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-dark-400 uppercase">Nome</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-dark-400 uppercase">Telefone</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-dark-400 uppercase">Idade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-700">
                    {aniversariantesMes.map(a => {
                      const isHoje = a.dia === new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })).getDate();
                      return (
                        <tr key={a.id} className={isHoje ? 'bg-yellow-900/20' : 'hover:bg-dark-800'}>
                          <td className="px-4 py-3">
                            <span className={`font-bold ${isHoje ? 'text-yellow-400' : 'text-dark-200'}`}>
                              {String(a.dia).padStart(2, '0')}/{String(mesAtual).padStart(2, '0')}
                            </span>
                            {isHoje && <span className="ml-2 text-xs">🎂</span>}
                          </td>
                          <td className="px-4 py-3 font-medium text-dark-100">{a.nome}</td>
                          <td className="px-4 py-3 text-sm text-dark-300">{a.telefone}</td>
                          <td className="px-4 py-3 text-sm text-dark-300">{a.idade} anos</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-xs text-dark-500 mt-3 text-center">{aniversariantesMes.length} aniversariante(s) em {meses[mesAtual]}</p>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
