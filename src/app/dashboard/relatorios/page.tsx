'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getHoje } from '@/lib/utils';
import DashboardLayout from '@/components/DashboardLayout';

type ReportType = 'alunos' | 'financeiro' | 'inadimplentes' | 'checkins' | 'mensalidades' | 'professores';

export default function RelatoriosPage() {
  const [reportType, setReportType] = useState<ReportType>('alunos');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [periodo, setPeriodo] = useState({
    inicio: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`,
    fim: getHoje(),
  });
  const [filtroProf, setFiltroProf] = useState('');
  const [filtroAluno, setFiltroAluno] = useState('');
  const [listaProfessores, setListaProfessores] = useState<any[]>([]);
  const [listaAlunos, setListaAlunos] = useState<any[]>([]);

  useEffect(() => {
    loadFiltros();
  }, []);

  const loadFiltros = async () => {
    const [{ data: profs }, { data: als }] = await Promise.all([
      supabase.from('professores').select('id, nome').order('nome'),
      supabase.from('alunos').select('id, nome').order('nome'),
    ]);
    if (profs) setListaProfessores(profs);
    if (als) setListaAlunos(als);
  };

  const reports = [
    { id: 'alunos', label: 'Lista de Alunos', icon: '/icons/alunos.jpg', desc: 'Todos os alunos cadastrados com status e plano' },
    { id: 'financeiro', label: 'Receita por Período', icon: '/icons/mensalidades.jpg', desc: 'Total recebido no período selecionado' },
    { id: 'inadimplentes', label: 'Inadimplentes', icon: '/icons/inadimplentes.jpg', desc: 'Alunos com mensalidades em atraso' },
    { id: 'checkins', label: 'Frequência', icon: '/icons/qrcode.png', desc: 'Check-ins realizados no período' },
    { id: 'mensalidades', label: 'Mensalidades', icon: '/icons/mensalidades-pendentes.jpg', desc: 'Todas as mensalidades com status' },
    { id: 'professores', label: 'Professores', icon: '/icons/professores.png', desc: 'Aulas confirmadas e valores por professor' },
  ];

  const generateReport = async () => {
    setLoading(true);
    setData([]);

    try {
      switch (reportType) {
        case 'alunos': {
          const { data: alunos } = await supabase
            .from('alunos')
            .select('id, nome, email, telefone, cpf, status, created_at, convenios(nome)')
            .order('nome');

          // Buscar última mensalidade de cada aluno para pegar o valor atual
          const alunoIds = alunos?.map(a => a.id) || [];
          let mensalidadesMap: Record<string, number> = {};
          if (alunoIds.length > 0) {
            const { data: mensalidades } = await supabase
              .from('mensalidades')
              .select('aluno_id, valor')
              .in('aluno_id', alunoIds)
              .order('data_vencimento', { ascending: false });
            if (mensalidades) {
              mensalidades.forEach(m => {
                if (!mensalidadesMap[m.aluno_id]) {
                  mensalidadesMap[m.aluno_id] = Number(m.valor);
                }
              });
            }
          }

          setData(alunos?.map(a => ({
            Nome: a.nome,
            'E-mail': a.email,
            Telefone: a.telefone,
            CPF: a.cpf || '—',
            Status: a.status,
            Convênio: (a as any).convenios?.nome || '—',
            Mensalidade: mensalidadesMap[a.id] ? `R$ ${mensalidadesMap[a.id].toFixed(2)}` : '—',
            'Cadastrado em': (() => { const d = (a.created_at || "").split("T")[0].split("-"); return d.length === 3 ? `${d[2]}/${d[1]}/${d[0]}` : "—"; })(),
          })) || []);
          break;
        }

        case 'financeiro': {
          const { data: pagamentos } = await supabase
            .from('mensalidades')
            .select('valor, data_pagamento, forma_pagamento, alunos(nome)')
            .eq('status', 'pago')
            .gte('data_pagamento', periodo.inicio)
            .lte('data_pagamento', periodo.fim)
            .order('data_pagamento', { ascending: false });
          setData(pagamentos?.map(p => ({
            Aluno: (p as any).alunos?.nome,
            Valor: `R$ ${Number(p.valor).toFixed(2)}`,
            'Data Pagamento': p.data_pagamento ? (() => { const d = (p.data_pagamento || "").split("T")[0].split("-"); return d.length === 3 ? `${d[2]}/${d[1]}/${d[0]}` : "—"; })() : '—',
            'Forma': p.forma_pagamento || '—',
          })) || []);
          break;
        }

        case 'inadimplentes': {
          const { data: atrasados } = await supabase
            .from('mensalidades')
            .select('valor, data_vencimento, alunos(nome, telefone, email)')
            .in('status', ['atrasado', 'pendente'])
            .lt('data_vencimento', new Date().toISOString().split('T')[0])
            .order('data_vencimento');
          setData(atrasados?.map(m => ({
            Aluno: (m as any).alunos?.nome,
            Telefone: (m as any).alunos?.telefone,
            'E-mail': (m as any).alunos?.email,
            Valor: `R$ ${Number(m.valor).toFixed(2)}`,
            Vencimento: (() => { const d = (m.data_vencimento || "").split("T")[0].split("-"); return d.length === 3 ? `${d[2]}/${d[1]}/${d[0]}` : "—"; })(),
            'Dias em atraso': Math.floor((Date.now() - new Date(m.data_vencimento).getTime()) / 86400000),
          })) || []);
          break;
        }

        case 'checkins': {
          const { data: checks } = await supabase
            .from('checkins')
            .select('data, horario, alunos(nome)')
            .gte('data', periodo.inicio)
            .lte('data', periodo.fim)
            .order('data', { ascending: false });
          setData(checks?.map(c => {
            const [ano, mes, dia] = c.data.split('-');
            return {
              Aluno: (c as any).alunos?.nome,
              Data: `${dia}/${mes}/${ano}`,
              Horário: c.horario?.slice(0, 5),
            };
          }) || []);
          break;
        }

        case 'mensalidades': {
          let mensQuery = supabase
            .from('mensalidades')
            .select('valor, data_vencimento, data_pagamento, status, forma_pagamento, alunos(nome)')
            .gte('data_vencimento', periodo.inicio)
            .lte('data_vencimento', periodo.fim)
            .order('data_vencimento', { ascending: false });
          if (filtroAluno) mensQuery = mensQuery.eq('aluno_id', filtroAluno);

          const { data: mens } = await mensQuery;
          setData(mens?.map(m => ({
            Aluno: (m as any).alunos?.nome,
            Valor: `R$ ${Number(m.valor).toFixed(2)}`,
            Vencimento: (() => { const d = (m.data_vencimento || "").split("T")[0].split("-"); return d.length === 3 ? `${d[2]}/${d[1]}/${d[0]}` : "—"; })(),
            'Pagamento': m.data_pagamento ? (() => { const d = (m.data_pagamento || "").split("T")[0].split("-"); return d.length === 3 ? `${d[2]}/${d[1]}/${d[0]}` : "—"; })() : '—',
            Status: m.status,
            Forma: m.forma_pagamento || '—',
          })) || []);
          break;
        }

        case 'professores': {
          const { data: profs } = await supabase.from('professores').select('id, nome, status');
          let checkinsQuery = supabase
            .from('checkins_professores')
            .select('professor_id, horas_confirmadas, data')
            .gte('data', periodo.inicio)
            .lte('data', periodo.fim)
            .order('data', { ascending: false });
          if (filtroProf) checkinsQuery = checkinsQuery.eq('professor_id', filtroProf);

          const { data: checkins } = await checkinsQuery;
          const { data: valores } = await supabase.from('professor_modalidade_valor').select('professor_id, valor_aula, modalidades(nome)');
          const { data: modsProfVinc } = await supabase.from('modalidades').select('id, nome, professor_id_ref').not('professor_id_ref', 'is', null);

          // Gerar uma linha por check-in (data + aula)
          const rows: any[] = [];
          checkins?.forEach(c => {
            const prof = profs?.find(p => p.id === c.professor_id);
            if (!prof) return;
            const modsProf = modsProfVinc?.filter(m => m.professor_id_ref === c.professor_id) || [];
            const aulaNome = modsProf.map(m => m.nome).join(', ') || '—';
            const valoresProf = valores?.filter(v => v.professor_id === c.professor_id) || [];
            const vlMedio = valoresProf.length > 0 ? valoresProf.reduce((sum: number, v: any) => sum + Number(v.valor_aula), 0) / valoresProf.length : 0;

            const [ano, mes, dia] = c.data.split('-');
            rows.push({
              Professor: prof.nome,
              Data: `${dia}/${mes}/${ano}`,
              Aula: aulaNome,
              Horas: `${c.horas_confirmadas}h`,
              'Valor/Aula': `R$ ${vlMedio.toFixed(2)}`,
              'Valor': `R$ ${(Number(c.horas_confirmadas) * vlMedio).toFixed(2)}`,
            });
          });
          setData(rows);
          break;
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = () => {
    if (data.length === 0) return;

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(';'),
      ...data.map(row => headers.map(h => `"${row[h] || ''}"`).join(';'))
    ].join('\n');

    // BOM para Excel reconhecer UTF-8
    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio_${reportType}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Calcular totais para relatório financeiro
  const totalReceita = reportType === 'financeiro'
    ? data.reduce((sum, row) => sum + parseFloat(row.Valor?.replace('R$ ', '').replace(',', '.') || '0'), 0)
    : 0;

  return (
    <DashboardLayout activeMenu="relatorios" title="Relatórios">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar de relatórios */}
        <div className="space-y-2">
          {reports.map((r) => (
            <button
              key={r.id}
              onClick={() => setReportType(r.id as ReportType)}
              className={`w-full text-left p-4 rounded-xl transition-colors ${
                reportType === r.id ? 'bg-primary-900/30 border-2 border-primary-600' : 'bg-dark-800 border border-dark-700 hover:bg-dark-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <img src={r.icon} alt="" className="w-6 h-6 rounded" />
                <div>
                  <p className="font-medium text-dark-100 text-sm">{r.label}</p>
                  <p className="text-xs text-dark-400">{r.desc}</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Conteúdo do relatório */}
        <div className="lg:col-span-3 space-y-4">
          {/* Filtros */}
          <div className="card">
            <div className="flex flex-wrap items-end gap-4">
              {reportType !== 'alunos' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-dark-200 mb-1">De</label>
                    <input type="date" value={periodo.inicio} onChange={(e) => setPeriodo({...periodo, inicio: e.target.value})} className="input-field" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-200 mb-1">Até</label>
                    <input type="date" value={periodo.fim} onChange={(e) => setPeriodo({...periodo, fim: e.target.value})} className="input-field" />
                  </div>
                </>
              )}
              {reportType === 'professores' && (
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-1">Professor</label>
                  <select value={filtroProf} onChange={(e) => setFiltroProf(e.target.value)} className="input-field">
                    <option value="">Todos</option>
                    {listaProfessores.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                </div>
              )}
              {reportType === 'mensalidades' && (
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-1">Aluno</label>
                  <select value={filtroAluno} onChange={(e) => setFiltroAluno(e.target.value)} className="input-field">
                    <option value="">Todos</option>
                    {listaAlunos.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                  </select>
                </div>
              )}
              <button onClick={generateReport} disabled={loading} className="btn-primary">
                {loading ? 'Gerando...' : '📊 Gerar Relatório'}
              </button>
              {data.length > 0 && (
                <button onClick={exportToExcel} className="btn-secondary">
                  📥 Exportar Excel (CSV)
                </button>
              )}
            </div>
          </div>

          {/* Resumo */}
          {data.length > 0 && (
            <div className="flex gap-4">
              <div className="card flex-1">
                <p className="text-sm text-dark-400">Total de registros</p>
                <p className="text-2xl font-bold text-dark-100">{data.length}</p>
              </div>
              {reportType === 'financeiro' && (
                <div className="card flex-1">
                  <p className="text-sm text-dark-400">Total Recebido</p>
                  <p className="text-2xl font-bold text-primary-600">R$ {totalReceita.toFixed(2)}</p>
                </div>
              )}
              {reportType === 'inadimplentes' && (
                <div className="card flex-1">
                  <p className="text-sm text-dark-400">Total em Atraso</p>
                  <p className="text-2xl font-bold text-red-600">
                    R$ {data.reduce((sum, row) => sum + parseFloat(row.Valor?.replace('R$ ', '') || '0'), 0).toFixed(2)}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Tabela de resultados */}
          {data.length > 0 ? (
            <div className="card overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-dark-800">
                    <tr>
                      {Object.keys(data[0]).map((key) => (
                        <th key={key} className="text-left px-4 py-3 text-xs font-medium text-dark-400 uppercase">{key}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-100">
                    {data.slice(0, 100).map((row, i) => (
                      <tr key={i} className="hover:bg-dark-800">
                        {Object.values(row).map((val: any, j) => (
                          <td key={j} className="px-4 py-3 text-sm text-dark-200">{val}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {data.length > 100 && (
                <div className="p-4 text-center text-sm text-dark-400">
                  Mostrando 100 de {data.length} registros. Exporte para ver todos.
                </div>
              )}
            </div>
          ) : !loading ? (
            <div className="card text-center py-12">
              <span className="text-4xl block mb-4">📊</span>
              <p className="text-dark-400">Selecione um relatório e clique em "Gerar".</p>
            </div>
          ) : null}
        </div>
      </div>
    </DashboardLayout>
  );
}
