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
  const { text, sourceLang, targetLang, apiKey, glossaryId } = await request.json();

  // テキストが空の場合はエラーを返す
  if (!text || !text.trim()) {
    return json({ error: "テキストを入力してください" }, { status: 400 });
  }

  // APIキーがない場合はエラーを返す
  if (!apiKey) {
    return json({ error: "APIキーが設定されていません" }, { status: 400 });
  }

  try {
    // 連続する改行を「区切り」として分割する
    // 「テキスト部分」と「改行部分」を交互に配列に入れる
    // 例：「A\n\n\nB」→ ['A', '\n\n\n', 'B']
    const parts = text.split(/(\n+)/);

    // テキスト部分だけを抜き出してDeepL APIに送る
    // 奇数インデックス（0, 2, 4...）がテキスト、偶数インデックス（1, 3, 5...）が改行
    const textParts = parts.filter((_, i) => i % 2 === 0);
    const newlineParts = parts.filter((_, i) => i % 2 === 1);

    // 空でないテキスト部分だけ翻訳する
    const nonEmptyTexts = textParts.filter((t) => t.trim() !== "");

    const response = await fetch(getDeepLUrl(apiKey), {
      method: "POST",
      headers: {
        Authorization: `DeepL-Auth-Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: nonEmptyTexts,
        source_lang: sourceLang,
        target_lang: targetLang,
        // グロッサリーIDがあれば翻訳に適用する
        ...(glossaryId ? { glossary_id: glossaryId } : {}),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("DeepL APIエラー:", data);
      return json({ error: "翻訳に失敗しました" }, { status: response.status });
    }

    // 翻訳結果を元の改行構造に戻す
    // 空のテキスト部分はそのまま、非空部分は翻訳結果に置き換える
    let translationIndex = 0;
    const translatedParts = textParts.map((t) => {
      if (t.trim() === "") return t;
      return data.translations[translationIndex++].text;
    });

    // テキスト部分と改行部分を交互に結合して元の構造を復元する
    const translatedText = translatedParts.map((t, i) => t + (newlineParts[i] || "")).join("");

    return json({ translatedText });
  } catch (error) {
    // ネットワークエラーなど予期しないエラー
    console.error("予期しないエラー:", error);
    return json({ error: "エラーが発生しました" }, { status: 500 });
  }
}
