import { createClient } from '@supabase/supabase-js';
// @ts-expect-error Vite provides build-time public environment values.
const url = import.meta.env.VITE_SUPABASE_URL;
// @ts-expect-error Vite provides build-time public environment values.
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = url && key ? createClient(url,key) : null;
