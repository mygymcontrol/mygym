import { createClient } from '@supabase/supabase-js';

// Client com service_role para operações administrativas (criar usuários)
// Usado APENAS no contexto do admin logado
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY!;

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
