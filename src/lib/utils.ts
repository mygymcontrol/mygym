/**
 * Formata uma data ISO (YYYY-MM-DD) para formato brasileiro (DD/MM/YYYY)
 * SEM problemas de timezone
 */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const [year, month, day] = dateStr.split('T')[0].split('-');
  return `${day}/${month}/${year}`;
}

/**
 * Retorna a data de HOJE no formato YYYY-MM-DD usando fuso de São Paulo (UTC-3)
 */
export function getHoje(): string {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Retorna o mês atual no formato YYYY-MM usando fuso de São Paulo
 */
export function getMesAtual(): string {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Formata valor monetário no padrão brasileiro: R$ 14.500,00
 */
export function formatMoney(valor: number | string | null | undefined): string {
  if (valor === null || valor === undefined || valor === '') return 'R$ 0,00';
  const num = typeof valor === 'string' ? parseFloat(valor) : valor;
  if (isNaN(num)) return 'R$ 0,00';
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
