import { json } from "@sveltejs/kit";

// DeepL APIのベースURLを返す関数
function getDeepLBaseUrl(apiKey) {
  if (apiKey.endsWith(":fx")) {
    return "https://api-free.deepl.com/v2";
  }
  return "https://api.deepl.com/v2";
}

// GETリクエスト：グロッサリー一覧と登録済み単語を取得する
export async function GET({ url }) {
  const apiKey = url.searchParams.get("apiKey");
  const glossaryId = url.searchParams.get("glossaryId");

  if (!apiKey) {
    return json({ error: "APIキーが設定されていません" }, { status: 400 });
  }

  const baseUrl = getDeepLBaseUrl(apiKey);

  try {
    if (glossaryId) {
      // グロッサリーIDが指定されている場合は単語一覧を取得する
      const response = await fetch(`${baseUrl}/glossaries/${glossaryId}/entries`, {
        headers: {
          Authorization: `DeepL-Auth-Key ${apiKey}`,
          Accept: "text/tab-separated-values",
        },
      });

      if (!response.ok) {
        return json({ error: "単語一覧の取得に失敗しました" }, { status: response.status });
      }

      // TSV形式（タブ区切り）で返ってくるのでパースする
      const tsv = await response.text();
      const entries = tsv
        .trim()
        .split("\n")
        .filter((line) => line.trim() !== "")
        .map((line) => {
          const [source, target] = line.split("\t");
          return { source, target };
        });

      return json({ entries });
    } else {
      // グロッサリーIDがない場合はグロッサリー一覧を取得する
      const response = await fetch(`${baseUrl}/glossaries`, {
        headers: {
          Authorization: `DeepL-Auth-Key ${apiKey}`,
        },
      });

      if (!response.ok) {
        return json({ error: "グロッサリー一覧の取得に失敗しました" }, { status: response.status });
      }

      const data = await response.json();
      return json({ glossaries: data.glossaries });
    }
  } catch (error) {
    console.error("予期しないエラー:", error);
    return json({ error: "エラーが発生しました" }, { status: 500 });
  }
}

// POSTリクエスト：グロッサリーを作成する
export async function POST({ request }) {
  const { apiKey, name, sourceLang, targetLang, entries } = await request.json();

  if (!apiKey) {
    return json({ error: "APIキーが設定されていません" }, { status: 400 });
  }

  if (!entries || entries.length === 0) {
    return json({ error: "単語を1件以上入力してください" }, { status: 400 });
  }

  const baseUrl = getDeepLBaseUrl(apiKey);

  try {
    // entriesをTSV形式に変換する（ソース\tターゲット\n の形式）
    const tsv = entries.map((e) => `${e.source}\t${e.target}`).join("\n");

    const response = await fetch(`${baseUrl}/glossaries`, {
      method: "POST",
      headers: {
        Authorization: `DeepL-Auth-Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        source_lang: sourceLang,
        target_lang: targetLang,
        entries: tsv,
        entries_format: "tsv",
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("DeepL APIエラー:", data);
      return json({ error: `グロッサリーの作成に失敗しました: ${data.message || ""}` }, { status: response.status });
    }

    return json({ glossaryId: data.glossary_id });
  } catch (error) {
    console.error("予期しないエラー:", error);
    return json({ error: "エラーが発生しました" }, { status: 500 });
  }
}

// DELETEリクエスト：グロッサリーを削除する
export async function DELETE({ url }) {
  const apiKey = url.searchParams.get("apiKey");
  const glossaryId = url.searchParams.get("glossaryId");

  if (!apiKey || !glossaryId) {
    return json({ error: "パラメータが不足しています" }, { status: 400 });
  }

  const baseUrl = getDeepLBaseUrl(apiKey);

  try {
    const response = await fetch(`${baseUrl}/glossaries/${glossaryId}`, {
      method: "DELETE",
      headers: {
        Authorization: `DeepL-Auth-Key ${apiKey}`,
      },
    });

    if (!response.ok) {
      return json({ error: "グロッサリーの削除に失敗しました" }, { status: response.status });
    }

    return json({ success: true });
  } catch (error) {
    console.error("予期しないエラー:", error);
    return json({ error: "エラーが発生しました" }, { status: 500 });
  }
}
