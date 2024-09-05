import { createClient } from "@supabase/supabase-js";

function supabasefun() {
  const runtimeConfig = useRuntimeConfig();
  const supabaseKey = runtimeConfig.public.SUPABASE_SERVICE_ROLE;
  const supabaseUrl = "https://dxusbfemztqipqvlneat.supabase.co";

  const supabase = createClient(supabaseUrl, supabaseKey);
  return supabase;
}
const supabase = supabasefun();

async function getFile() {
  let { data: file, error } = await supabase
    .from("files")
    .select("*")
    .eq("github_repo_name", "manifest-project-CFE9NU")
    .eq("branch", "main")
    .eq("file_path", "api/index.js")
    .single();
  console.log(file.content);
  return file.content;
}

export { supabase, getFile };
