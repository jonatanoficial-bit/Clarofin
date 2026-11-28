'use client';

import type { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowRight, KeyRound, LoaderCircle, LockKeyhole, LogIn, Mail, ShieldCheck, UserRound } from 'lucide-react';
import { ensureCloudProfile } from '@/lib/cloud-finance-store';
import { supabase } from '@/lib/supabase';

type AuthMode = 'sign-in' | 'sign-up' | 'recovery' | 'update-password';
type ClarofinAuth = { user: User; signOut: () => Promise<void>; deleteAccount: () => Promise<void> };
const AuthContext = createContext<ClarofinAuth | null>(null);

function redirectUrl() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/Clarofin';
  return `${window.location.origin}${basePath.endsWith('/') ? basePath : `${basePath}/`}`;
}

export function useClarofinAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('A sessão do Clarofin não está disponível.');
  return context;
}

export default function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => { if (active) { setSession(data.session); setReady(true); } });
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      if (event === 'PASSWORD_RECOVERY') setMode('update-password');
      if (nextSession?.user) void ensureCloudProfile(nextSession.user).catch(() => setMessage('A sessão foi iniciada, mas o perfil ainda não pôde ser atualizado.'));
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  const auth = useMemo<ClarofinAuth | null>(() => session ? ({
    user: session.user,
    signOut: async () => { const { error } = await supabase.auth.signOut(); if (error) throw error; },
    deleteAccount: async () => {
      const { error } = await supabase.functions.invoke('clarofin-delete-account');
      if (error) throw error;
      const result = await supabase.auth.signOut();
      if (result.error) throw result.error;
    },
  }) : null, [session]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      if (mode === 'sign-in') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === 'sign-up') {
        const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name.trim() }, emailRedirectTo: redirectUrl() } });
        if (error) throw error;
        setMessage('Cadastro criado. Confirme o e-mail enviado para continuar.');
      } else if (mode === 'recovery') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl() });
        if (error) throw error;
        setMessage('Enviamos as instruções de recuperação para seu e-mail.');
      } else {
        if (password.length < 8) throw new Error('Escolha uma senha com pelo menos 8 caracteres.');
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setMode('sign-in'); setPassword(''); setMessage('Senha atualizada. Entre novamente para continuar.');
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível concluir esta ação.'); }
    finally { setBusy(false); }
  };

  const googleSignIn = async () => {
    setBusy(true); setMessage('');
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectUrl() } });
    if (error) { setMessage(error.message); setBusy(false); }
  };

  if (!ready) return <main className="auth-screen"><div className="auth-card loading"><LoaderCircle className="spin" /><p>Preparando sua área financeira…</p></div></main>;
  if (auth) return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;

  const title = mode === 'sign-up' ? 'Crie sua conta' : mode === 'recovery' ? 'Recupere sua senha' : mode === 'update-password' ? 'Defina uma nova senha' : 'Entre no Clarofin';
  const subtitle = mode === 'sign-up' ? 'Sua área financeira começa vazia, privada e protegida.' : mode === 'recovery' ? 'Informe seu e-mail para receber um link seguro.' : mode === 'update-password' ? 'Escolha uma senha forte para continuar.' : 'Organize sua vida financeira em todos os seus dispositivos.';
  return <main className="auth-screen"><section className="auth-card"><div className="auth-brand"><span><ShieldCheck /></span><div><strong>claro<b>fin</b></strong><small>Cloud Edition</small></div></div><div className="auth-heading"><h1>{title}</h1><p>{subtitle}</p></div><button className="google-button" type="button" disabled={busy || mode === 'update-password'} onClick={() => void googleSignIn()}><span className="google-g">G</span> Continuar com Google</button><div className="auth-divider"><span />ou<span /></div><form onSubmit={submit} className="auth-form">{mode === 'sign-up' && <label><UserRound />Nome<input required value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" /></label>}{mode !== 'update-password' && <label><Mail />E-mail<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></label>}<label><LockKeyhole />Senha<input required type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'} /></label>{message && <p className="auth-message" role="status">{message}</p>}<button className="auth-submit" disabled={busy} type="submit">{busy ? <LoaderCircle className="spin" /> : mode === 'recovery' ? <KeyRound /> : <LogIn />}{mode === 'sign-up' ? 'Criar conta' : mode === 'recovery' ? 'Enviar instruções' : mode === 'update-password' ? 'Atualizar senha' : 'Entrar'}<ArrowRight /></button></form><div className="auth-actions">{mode === 'sign-in' && <><button type="button" onClick={() => { setMode('recovery'); setMessage(''); }}>Esqueci minha senha</button><button type="button" onClick={() => { setMode('sign-up'); setMessage(''); }}>Criar conta</button></>}{mode === 'sign-up' && <button type="button" onClick={() => { setMode('sign-in'); setMessage(''); }}>Já tenho uma conta</button>}{mode === 'recovery' && <button type="button" onClick={() => { setMode('sign-in'); setMessage(''); }}>Voltar para entrar</button>}</div><p className="auth-privacy"><ShieldCheck /> Seus dados financeiros ficam vinculados exclusivamente à sua conta.</p></section></main>;
}

