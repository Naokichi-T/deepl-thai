<script>
  import { onMount } from "svelte";
  import { supabase } from "$lib/supabase.js";

  // マウント済みかどうか（SSR対策）
  let mounted = $state(false);

  // ログインユーザーのDeepL APIキー
  let apiKey = $state("");

  // 読み込み中かどうか
  let isLoading = $state(false);

  // エラーメッセージ
  let errorMessage = $state("");

  // 成功メッセージ
  let successMessage = $state("");

  // 現在のグロッサリーID（LocalStorageに保存）
  let glossaryId = $state("");

  // 登録済みの単語一覧
  let entries = $state([]);

  // 新規追加フォームの入力値
  // JA→TH方向の入力
  let newJa = $state("");
  // TH→JA方向の入力
  let newTh = $state("");

  // 追加中かどうか
  let isAdding = $state(false);

  onMount(async () => {
    // ログインチェック
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      window.location.href = "/login";
      return;
    }

    const userId = sessionData.session.user.id;

    // APIキーを取得する
    const { data } = await supabase.from("user_settings").select("deepl_api_key").eq("user_id", userId).single();

    if (data) {
      apiKey = data.deepl_api_key;
      // LocalStorageからグロッサリーIDを復元する
      const savedId = localStorage.getItem("glossaryId");
      if (savedId) {
        glossaryId = savedId;
        // 登録済み単語を取得する
        await fetchEntries();
      }
    }

    mounted = true;
  });

  // 登録済み単語を取得する関数
  async function fetchEntries() {
    if (!glossaryId) return;

    isLoading = true;
    const response = await fetch(`/api/glossary?apiKey=${apiKey}&glossaryId=${glossaryId}`);
    const data = await response.json();

    if (data.error) {
      // グロッサリーが存在しない場合はLocalStorageから削除する
      errorMessage = data.error;
      glossaryId = "";
      localStorage.removeItem("glossaryId");
    } else {
      entries = data.entries;
    }

    isLoading = false;
  }

  // グロッサリーを新規作成する関数
  async function createGlossary(initialEntries) {
    isLoading = true;
    errorMessage = "";

    const response = await fetch("/api/glossary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey,
        name: "deepl-thai-glossary",
        // TH→JA方向で作成する
        sourceLang: "TH",
        targetLang: "JA",
        entries: initialEntries,
      }),
    });

    const data = await response.json();

    if (data.error) {
      errorMessage = data.error;
    } else {
      glossaryId = data.glossaryId;
      localStorage.setItem("glossaryId", glossaryId);
      await fetchEntries();
      newJa = "";
      newTh = "";
      showSuccess("グロッサリーを作成しました");
    }

    isLoading = false;
  }

  // 単語を追加する関数
  // DeepL APIはグロッサリーの編集ができないため、
  // 既存の単語＋新しい単語でグロッサリーを作り直す
  async function addEntry() {
    if (!newJa.trim() || !newTh.trim()) return;

    isAdding = true;
    errorMessage = "";

    // 既存の単語に新しい単語を追加する
    const newEntries = [...entries, { source: newJa.trim(), target: newTh.trim() }];

    if (!glossaryId) {
      // グロッサリーがまだない場合は新規作成する（最初の1件を渡す）
      await createGlossary(newEntries);
      isAdding = false;
      return;
    }

    // 既存のグロッサリーを削除して作り直す
    await deleteGlossary(false);

    const response = await fetch("/api/glossary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey,
        name: "deepl-thai-glossary",
        sourceLang: "TH",
        targetLang: "JA",
        entries: newEntries,
      }),
    });

    const data = await response.json();

    if (data.error) {
      errorMessage = data.error;
    } else {
      glossaryId = data.glossaryId;
      localStorage.setItem("glossaryId", glossaryId);
      await fetchEntries();
      newJa = "";
      newTh = "";
      showSuccess("単語を追加しました");
    }

    isAdding = false;
  }

  // 単語を削除する関数
  async function deleteEntry(index) {
    errorMessage = "";

    // 指定したインデックスの単語を除いた新しい配列を作る
    const newEntries = entries.filter((_, i) => i !== index);

    if (newEntries.length === 0) {
      // 単語が0件になる場合はグロッサリーごと削除する
      await deleteGlossary(true);
      return;
    }

    // グロッサリーを作り直す
    await deleteGlossary(false);

    const response = await fetch("/api/glossary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey,
        name: "deepl-thai-glossary",
        sourceLang: "JA",
        targetLang: "TH",
        entries: newEntries,
      }),
    });

    const data = await response.json();

    if (data.error) {
      errorMessage = data.error;
    } else {
      glossaryId = data.glossaryId;
      localStorage.setItem("glossaryId", glossaryId);
      await fetchEntries();
      showSuccess("単語を削除しました");
    }
  }

  // グロッサリーを削除する関数
  // showMessage: 削除完了メッセージを表示するかどうか
  async function deleteGlossary(showMessage) {
    if (!glossaryId) return;

    const response = await fetch(`/api/glossary?apiKey=${apiKey}&glossaryId=${glossaryId}`, { method: "DELETE" });

    const data = await response.json();

    if (data.error) {
      errorMessage = data.error;
    } else {
      glossaryId = "";
      entries = [];
      localStorage.removeItem("glossaryId");
      if (showMessage) showSuccess("グロッサリーを削除しました");
    }
  }

  // 成功メッセージを一時的に表示する関数
  function showSuccess(message) {
    successMessage = message;
    setTimeout(() => {
      successMessage = "";
    }, 3000);
  }
</script>

{#if mounted}
  <div class="container">
    <header>
      <h1>グロッサリー管理</h1>
      <button class="close-btn" onclick={() => window.close()}>✕ 閉じる</button>
    </header>

    <!-- グロッサリーの説明 -->
    <p class="description">
      登録した単語は翻訳時に自動で適用されます。<br />
      ※ DeepL APIの仕様上、タイ語グロッサリーは日本語→タイ語の方向のみ対応しています。
    </p>

    <!-- エラー・成功メッセージ -->
    {#if errorMessage}
      <p class="error-msg">{errorMessage}</p>
    {/if}
    {#if successMessage}
      <p class="success-msg">{successMessage}</p>
    {/if}

    <!-- 単語追加フォーム -->
    <div class="add-form">
      <input type="text" bind:value={newJa} placeholder="日本語（例：研究）" class="input" />
      <span class="arrow">→</span>
      <input type="text" bind:value={newTh} placeholder="タイ語（例：วิจัย）" class="input" />
      <button class="add-btn" onclick={addEntry} disabled={isAdding || !newJa.trim() || !newTh.trim()}>
        {isAdding ? "追加中..." : "追加"}
      </button>
    </div>

    <!-- 登録済み単語一覧 -->
    {#if isLoading}
      <p class="loading">読み込み中...</p>
    {:else if entries.length === 0}
      <p class="empty">登録済みの単語がありません</p>
    {:else}
      <table class="entries-table">
        <thead>
          <tr>
            <th>日本語</th>
            <th>タイ語</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each entries as entry, i}
            <tr>
              <td>{entry.source}</td>
              <td>{entry.target}</td>
              <td>
                <button class="delete-btn" onclick={() => deleteEntry(i)}>削除</button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>
{/if}

<style>
  .container {
    max-width: 800px;
    margin: 0 auto;
    padding: 16px 20px;
  }

  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  h1 {
    font-size: 20px;
    margin: 0;
  }

  .close-btn {
    background: none;
    border: 1px solid #ddd;
    border-radius: 6px;
    padding: 6px 12px;
    cursor: pointer;
    font-size: 14px;
    color: #555;
  }

  .close-btn:hover {
    background: #f5f5f5;
  }

  .description {
    font-size: 14px;
    color: #666;
    margin-bottom: 20px;
    line-height: 1.6;
  }

  .error-msg {
    color: #e55;
    font-size: 14px;
    margin-bottom: 12px;
  }

  .success-msg {
    color: #5a5;
    font-size: 14px;
    margin-bottom: 12px;
  }

  /* 単語追加フォーム */
  .add-form {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 24px;
  }

  .input {
    flex: 1;
    padding: 8px 12px;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 15px;
    font-family: "Sarabun", sans-serif;
  }

  .input:focus {
    outline: none;
    border-color: #7b78a8;
  }

  .arrow {
    color: #999;
    font-size: 18px;
  }

  .add-btn {
    padding: 8px 20px;
    background: #7b78a8;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    cursor: pointer;
    white-space: nowrap;
  }

  .add-btn:hover {
    background: #6a6797;
  }

  .add-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .loading {
    color: #aaa;
    font-size: 14px;
  }

  .empty {
    color: #aaa;
    font-size: 14px;
  }

  /* 登録済み単語テーブル */
  .entries-table {
    width: 100%;
    border-collapse: collapse;
  }

  .entries-table th {
    text-align: left;
    padding: 8px 12px;
    font-size: 13px;
    color: #666;
    border-bottom: 2px solid #ddd;
  }

  .entries-table td {
    padding: 10px 12px;
    font-size: 15px;
    font-family: "Sarabun", sans-serif;
    border-bottom: 1px solid #eee;
  }

  .delete-btn {
    background: none;
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 3px 10px;
    font-size: 13px;
    color: #e55;
    cursor: pointer;
  }

  .delete-btn:hover {
    background: #fff0f0;
    border-color: #e55;
  }
</style>
