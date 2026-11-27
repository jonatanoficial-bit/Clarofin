import { createClient } from 'npm:@supabase/supabase-js@2.119.2';
import { corsHeaders } from 'jsr:@supabase/supabase-js@2/cors';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'Método não permitido.' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  const authorization = request.headers.get('Authorization');
  const projectUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!authorization || !projectUrl || !serviceRoleKey) return new Response(JSON.stringify({ error: 'Não foi possível validar esta solicitação.' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  const admin = createClient(projectUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const token = authorization.replace(/^Bearer\s+/i, '');
  const { data: { user }, error: userError } = await admin.auth.getUser(token);
  if (userError || !user) return new Response(JSON.stringify({ error: 'Sessão inválida.' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  const { error: deletionError } = await admin.auth.admin.deleteUser(user.id);
  if (deletionError) return new Response(JSON.stringify({ error: 'Não foi possível excluir a conta.' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  return new Response(JSON.stringify({ deleted: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});

