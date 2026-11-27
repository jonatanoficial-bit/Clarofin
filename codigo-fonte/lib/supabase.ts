import { createClient } from '@supabase/supabase-js';

// These are intentionally public browser values. No service-role key or OAuth
// secret is included in the application or in the repository.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://nnjoqwvowdokzofsztxy.supabase.co';
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_mfG4ZWTNPdlm_MuIDuHzpw_cG2MWSom';

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true, storageKey: 'clarofin-auth-v1' },
});

