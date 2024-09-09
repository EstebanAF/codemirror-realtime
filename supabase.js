import { createClient } from "@supabase/supabase-js";

function supabasefun() {
  const runtimeConfig = useRuntimeConfig();
  const supabaseKey = runtimeConfig.public.SUPABASE_SERVICE_ROLE;
  const supabaseUrl = "https://qtxobuzziahciyojcdua.supabase.co";

  const supabase = createClient(supabaseUrl, supabaseKey);
  return supabase;
}
const supabase = supabasefun();

async function getFile(
  userId,
  github_repo_name = "manifest-project-CFE9NU",
  branch = "main",
  file_path = "api/index.js",
) {
  let { data: file } = await supabase
    .from("files")
    .select("content")
    .eq("github_repo_name", github_repo_name)
    .eq("branch", branch)
    .eq("file_path", file_path)
    .single();
  let { data: update } = await supabase
    .from("realtime")
    .select("users,updates")
    .eq("github_repo_name", github_repo_name)
    .eq("branch", branch)
    .eq("file_path", file_path)
    .single();
  console.log(update);
  if (!update) {
    console.log("join");
    let { data: update } = await supabase.from("realtime").insert({
      github_repo_name,
      branch,
      file_path,
      users: [{ user: userId }],
    });
    return [file.content, []];
  } else {
    const { data, error } = await supabase.rpc("add_user_to_array", {
      repo_name: github_repo_name,
      branch_name: branch,
      file_path_param: file_path,
      new_user: { user: userId },
    });

    if (error) {
      console.error("Error adding user:", error);
    } else {
      console.log("User added successfully:", data);
    }
  }
  return [file.content, update.updates];
}

async function setUpdates(updates, content, userId) {
  const [
    { data: fileData, error: fileError },
    { data: realtimeData, error: realtimeError },
  ] = await Promise.all([
    supabase
      .from("files")
      .update({ content })
      .eq("github_repo_name", "manifest-project-CFE9NU")
      .eq("branch", "main")
      .eq("file_path", "api/index.js"),
    supabase
      .from("realtime")
      .update({ updates, changesBy: userId })
      .eq("github_repo_name", "manifest-project-CFE9NU")
      .eq("branch", "main")
      .eq("file_path", "api/index.js"),
  ]);
}

async function deleteUser(
  user,
  repo_name = "manifest-project-CFE9NU",
  branch_name = "main",
  file_path_param = "api/index.js",
) {
  const { data, error } = await supabase.rpc("delete_user_from_array", {
    repo_name,
    branch_name,
    file_path_param,
    user_to_delete: { user: user },
  });

  if (error) {
    console.error("Error deleting user:", error);
  } else {
    console.log("User deleted successfully:", data);
  }
}

export { supabase, getFile, setUpdates, deleteUser };
