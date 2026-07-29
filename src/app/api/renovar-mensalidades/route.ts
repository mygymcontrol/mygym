import { NextResponse } from 'next/server';
import { renovarMensalidades } from '@/lib/renovar-mensalidades';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await renovarMensalidades();
    return NextResponse.json({ ok: true, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Erro ao renovar mensalidades:', error);
    return NextResponse.json({ ok: false, error: 'Erro interno' }, { status: 500 });
  }
}
