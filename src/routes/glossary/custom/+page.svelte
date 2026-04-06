<script>
  import { onMount } from "svelte";
  import { supabase } from "$lib/supabase.js";

  // マウント済みかどうか（SSR対策）
  let mounted = $state(false);

  // 登録済みの単語一覧
  let entries = $state([]);

  // 読み込み中かどうか
  let isLoading = $state(false);

  // 追加中かどうか
  let isAdding = $state(false);

  // エラーメッセージ
  let errorMessage = $state("");

  // 成功メッセージ
  let successMessage = $state("");

  // 新規追加フォームの入力値（元の単語）
  let newSource = $state("");

  // 新規追加フォームの入力値（置換後の単語）
  let newTarget = $state("");

  // Supabaseのセッショントークン（APIリクエストに使う）
  let accessToken = $state("");

  onMount(async () => {
    // ログインチェック
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      window.location.href = "/login";
      return;
    }

    // セッショントークンを保存する（APIリクエストの認証に使う）
    accessToken = sessionData.session.access_token;

    // 独自グロッサリーを取得する
    await fetchEntries();

    mounted = true;
  });

  // 独自グロッサリー一覧を取得する関数
  async function fetchEntries() {
    isLoading = true;

    const response = await fetch("/api/custom-glossary", {
      headers: {
        // セッショントークンをヘッダーに付けて認証する
        authorization: `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();

    if (data.error) {
      errorMessage = data.error;
    } else {
      entries = data.entries;
    }

    isLoading = false;
  }

  // 単語を追加する関数
  async function addEntry() {
    if (!newSource.trim() || !newTarget.trim()) return;

    isAdding = true;
    errorMessage = "";

    const response = await fetch("/api/custom-glossary", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        sourceText: newSource.trim(),
        targetText: newTarget.trim(),
      }),
    });

    const data = await response.json();

    if (data.error) {
      errorMessage = data.error;
    } else {
      await fetchEntries();
      newSource = "";
      newTarget = "";
      // 翻訳画面に更新を知らせるフラグを立てる
      localStorage.setItem("customGlossaryUpdated", Date.now().toString());
      showSuccess("追加しました");
    }

    isAdding = false;
  }

  // 単語を削除する関数
  async function deleteEntry(id) {
    errorMessage = "";

    const response = await fetch(`/api/custom-glossary?id=${id}`, {
      method: "DELETE",
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();

    if (data.error) {
      errorMessage = data.error;
    } else {
      await fetchEntries();
      // 翻訳画面に更新を知らせるフラグを立てる
      localStorage.setItem("customGlossaryUpdated", Date.now().toString());
      showSuccess("削除しました");
    }
  }

  // 成功メッセージを一時的に表示する関数
  function showSuccess(message) {
    successMessage = message;
    setTimeout(() => {
      successMessage = "";
    }, 3000);
  }

  // Enterキーで追加できるようにする関数
  function handleKeydown(e) {
    if (e.key === "Enter" && !e.isComposing) {
      addEntry();
    }
  }
</script>

{#if mounted}
  <div class="container">
    <header>
      <h1>独自用語集</h1>
      <button class="close-btn" onclick={() => window.close()}>✕ 閉じる</button>
    </header>

    <p class="description">
      翻訳前に元の単語を置換してからDeepLに送ります。<br />
      専門用語や固有名詞を統一したいときに使ってください。<br />
      <b>複合名詞を強く推奨します。</b><br />
      ※ ON/OFFは翻訳画面で切り替えられます。
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
      <input type="text" bind:value={newSource} placeholder="元の単語" class="input" onkeydown={handleKeydown} />
      <span class="arrow">→</span>
      <input type="text" bind:value={newTarget} placeholder="置換後" class="input" font-family="Sarabun" onkeydown={handleKeydown} />
      <button class="add-btn" onclick={addEntry} disabled={isAdding || !newSource.trim() || !newTarget.trim()}>
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
            <th>元の単語</th>
            <th>置換後</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each entries as entry}
            <tr>
              <td>{entry.source_text}</td>
              <td class="target-text">{entry.target_text}</td>
              <td>
                <button class="delete-btn" onclick={() => deleteEntry(entry.id)}>削除</button>
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

  .loading,
  .empty {
    color: #aaa;
    font-size: 14px;
  }

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
    border-bottom: 1px solid #eee;
  }

  .target-text {
    font-family: "Sarabun", sans-serif;
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
