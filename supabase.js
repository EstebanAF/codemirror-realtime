import { createClient } from "@supabase/supabase-js";

function supabasefun() {
  const runtimeConfig = useRuntimeConfig();
  const supabaseKey = runtimeConfig.public.SUPABASE_SERVICE_ROLE;
  const supabaseUrl = "https://qtxobuzziahciyojcdua.supabase.co";

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
  return [file.content, file.updates];
}

async function setUpdates(updates, content, userId) {
  const { data, error } = await supabase
    .from("files")
    .update({ updates, content, changesBy: userId })
    .eq("github_repo_name", "manifest-project-CFE9NU")
    .eq("branch", "main")
    .eq("file_path", "api/index.js");
}

export { supabase, getFile, setUpdates };
