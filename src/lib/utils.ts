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
 * Retorna a data de HOJE no formato YYYY-MM-DD usando fuso local
 * SEM problemas de timezone (não usa toISOString)
 */
export function getHoje(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
