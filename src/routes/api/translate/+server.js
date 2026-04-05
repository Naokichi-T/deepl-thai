import { json } from "@sveltejs/kit";

// DeepL APIのURLを返す関数
// 無料プランは api-free.deepl.com、有料プランは api.deepl.com
function getDeepLUrl(apiKey) {
  // APIキーが ":fx" で終わる場合は無料プラン
  if (apiKey.endsWith(":fx")) {
    return "https://api-free.deepl.com/v2/translate";
  }
  return "https://api.deepl.com/v2/translate";
}

// POSTリクエストを受け取って翻訳結果を返す関数
export async function POST({ request }) {
  // リクエストのボディからデータを取り出す
  const { text, sourceLang, targetLang, apiKey } = await request.json();

  // テキストが空の場合はエラーを返す
  if (!text || !text.trim()) {
    return json({ error: "テキストを入力してください" }, { status: 400 });
  }

  // APIキーがない場合はエラーを返す
  if (!apiKey) {
    return json({ error: "APIキーが設定されていません" }, { status: 400 });
  }

  try {
    // DeepL APIを呼び出す
    const response = await fetch(getDeepLUrl(apiKey), {
      method: "POST",
      headers: {
        Authorization: `DeepL-Auth-Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: [text],
        source_lang: sourceLang, // 翻訳元の言語コード（例：TH, JA）
        target_lang: targetLang, // 翻訳先の言語コード（例：JA, TH）
      }),
    });

    // DeepL APIからのレスポンスをJSONとして取得
    const data = await response.json();

    // DeepL APIがエラーを返した場合
    if (!response.ok) {
      console.error("DeepL APIエラー:", data);
      return json({ error: "翻訳に失敗しました" }, { status: response.status });
    }

    // 翻訳結果を返す
    return json({
      translatedText: data.translations[0].text,
    });
  } catch (error) {
    // ネットワークエラーなど予期しないエラー
    console.error("予期しないエラー:", error);
    return json({ error: "エラーが発生しました" }, { status: 500 });
  }
}
