import { createClient } from "@supabase/supabase-js";

function supabasefun() {
  const runtimeConfig = useRuntimeConfig();
  const supabaseKey = runtimeConfig.public.SUPABASE_SERVICE_ROLE;
  const supabaseUrl = "https://dxusbfemztqipqvlneat.supabase.co";

  const supabase = createClient(supabaseUrl, supabaseKey);
  return supabase;
}
const supabase = supabasefun();

export default supabase;
