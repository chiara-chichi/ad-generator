import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const isConfigured = supabaseUrl.startsWith("http");

// Browser client (subject to RLS)
export const supabase = isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Admin client (bypasses RLS) - use only in API routes
export const supabaseAdmin =
  isConfigured && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey)
    : null;
