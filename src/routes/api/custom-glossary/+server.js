import { json } from "@sveltejs/kit";
import { createClient } from "@supabase/supabase-js";
import { PUBLIC_SUPABASE_URL } from "$env/static/public";
import { SUPABASE_SERVICE_ROLE_KEY } from "$env/static/private";

// Service Role Keyを使ってSupabaseクライアントを作成する関数
// Service Role KeyはRLSをバイパスできるので、user_idを明示的に渡す
function createServiceSupabase() {
  return createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

// リクエストのAuthorizationヘッダーからユーザーIDを取得する関数
async function getUserId(request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "");

  if (!token) return null;

  // Service Role Keyを使ってトークンを検証する
  const supabase = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data, error } = await supabase.auth.getUser(token);
  console.log("getUserId結果:", data?.user?.id, error);
  return data?.user?.id || null;
}

// GETリクエスト：独自グロッサリー一覧を取得する
export async function GET({ request }) {
  const userId = await getUserId(request);
  if (!userId) {
    return json({ error: "認証エラー" }, { status: 401 });
  }

  const supabase = createServiceSupabase();

  const { data, error } = await supabase.from("custom_glossary").select("*").eq("user_id", userId).order("created_at", { ascending: true });

  if (error) {
    console.error("取得エラー:", error);
    return json({ error: "取得に失敗しました" }, { status: 500 });
  }

  return json({ entries: data });
}

// POSTリクエスト：独自グロッサリーに単語を追加する
export async function POST({ request }) {
  const userId = await getUserId(request);
  if (!userId) {
    return json({ error: "認証エラー" }, { status: 401 });
  }

  const supabase = createServiceSupabase();
  const { sourceText, targetText } = await request.json();

  if (!sourceText?.trim() || !targetText?.trim()) {
    return json({ error: "単語を入力してください" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("custom_glossary")
    .insert({
      user_id: userId,
      source_text: sourceText.trim(),
      target_text: targetText.trim(),
    })
    .select()
    .single();

  if (error) {
    console.error("追加エラー:", error);
    return json({ error: "追加に失敗しました" }, { status: 500 });
  }

  return json({ entry: data });
}

// DELETEリクエスト：独自グロッサリーから単語を削除する
export async function DELETE({ request, url }) {
  const userId = await getUserId(request);
  if (!userId) {
    return json({ error: "認証エラー" }, { status: 401 });
  }

  const supabase = createServiceSupabase();
  const id = url.searchParams.get("id");

  if (!id) {
    return json({ error: "IDが指定されていません" }, { status: 400 });
  }

  const { error } = await supabase.from("custom_glossary").delete().eq("id", id).eq("user_id", userId);

  if (error) {
    console.error("削除エラー:", error);
    return json({ error: "削除に失敗しました" }, { status: 500 });
  }

  return json({ success: true });
}
