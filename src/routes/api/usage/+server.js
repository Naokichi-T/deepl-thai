import { json } from "@sveltejs/kit";

// DeepL APIのURLを返す関数（translate/+server.jsと同じロジック）
function getDeepLUrl(apiKey) {
  // APIキーが ":fx" で終わる場合は無料プラン
  if (apiKey.endsWith(":fx")) {
    return "https://api-free.deepl.com/v2/usage";
  }
  return "https://api.deepl.com/v2/usage";
}

// GETリクエストを受け取って使用量を返す関数
export async function GET({ url }) {
  // URLパラメータからAPIキーを取り出す
  const apiKey = url.searchParams.get("apiKey");

  // APIキーがない場合はエラーを返す
  if (!apiKey) {
    return json({ error: "APIキーが設定されていません" }, { status: 400 });
  }

  try {
    // DeepL APIの使用量エンドポイントを呼び出す
    const response = await fetch(getDeepLUrl(apiKey), {
      headers: {
        Authorization: `DeepL-Auth-Key ${apiKey}`,
      },
    });

    // DeepL APIからのレスポンスをJSONとして取得
    const data = await response.json();

    // DeepL APIがエラーを返した場合
    if (!response.ok) {
      console.error("DeepL APIエラー:", data);
      return json({ error: "使用量の取得に失敗しました" }, { status: response.status });
    }

    // 使用量を返す
    // character_count: 今月使った文字数
    // character_limit: 今月の上限文字数
    return json({
      characterCount: data.character_count,
      characterLimit: data.character_limit,
    });
  } catch (error) {
    // ネットワークエラーなど予期しないエラー
    console.error("予期しないエラー:", error);
    return json({ error: "エラーが発生しました" }, { status: 500 });
  }
}
