import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl) {
  throw new Error("SUPABASE_URL is not defined");
}

if (!supabaseKey) {
  throw new Error("SUPABASE_PUBLISHABLE_KEY is not defined");
}

export const createClient = () =>
  createBrowserClient(supabaseUrl!, supabaseKey!);