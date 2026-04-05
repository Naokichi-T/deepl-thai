<script>
  import { onMount } from "svelte";
  import { supabase } from "$lib/supabase.js";

  // マウント済みかどうか（SSR対策）
  let mounted = $state(false);

  // 履歴データの配列
  let history = $state([]);

  // 方向ラベルを返す関数
  function getDirectionLabel(direction) {
    return direction === "TH_JA" ? "タイ語 → 日本語" : "日本語 → タイ語";
  }

  // 日時を読みやすい形式にフォーマットする関数
  function formatDate(isoString) {
    const d = new Date(isoString);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  // この履歴を翻訳画面に復元する関数
  // LocalStorageに復元データを書き込んで翻訳画面を開く
  function restoreHistory(item) {
    localStorage.setItem(
      "restoreTranslation",
      JSON.stringify({
        sourceText: item.sourceText,
        translatedText: item.translatedText,
        direction: item.direction,
      }),
    );
    // 翻訳画面を別タブで開く
    window.open("/", "_blank");
  }

  onMount(async () => {
    // ログインチェック
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      window.location.href = "/login";
      return;
    }

    // LocalStorageから履歴を読み込む
    const saved = localStorage.getItem("translationHistory");
    history = saved ? JSON.parse(saved) : [];

    mounted = true;
  });
</script>

{#if mounted}
  <div class="container">
    <header>
      <h1>翻訳履歴</h1>
      <!-- 翻訳画面に戻るリンク（別タブで開かれているので閉じるだけ） -->
      <button class="close-btn" onclick={() => window.close()}>✕ 閉じる</button>
    </header>

    {#if history.length === 0}
      <p class="empty">履歴がありません</p>
    {:else}
      <div class="history-list">
        {#each history as item, i}
          <div class="history-item">
            <!-- 履歴のヘッダー：方向・日時・復元ボタン -->
            <div class="item-header">
              <span class="direction-label">{getDirectionLabel(item.direction)}</span>
              <span class="date-label">{formatDate(item.createdAt)}</span>
              <button class="restore-btn" onclick={() => restoreHistory(item)}> この翻訳を復元 </button>
            </div>

            <!-- 翻訳内容：左右2カラム -->
            <div class="item-body">
              <div class="text-box">
                <pre class="text-content">{item.sourceText}</pre>
              </div>
              <div class="text-box result-box">
                <pre class="text-content">{item.translatedText}</pre>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<style>
  .container {
    max-width: 1400px;
    margin: 0 auto;
    padding: 16px 20px;
  }

  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
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

  .empty {
    color: #aaa;
    text-align: center;
    margin-top: 80px;
    font-size: 16px;
  }

  .history-list {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .history-item {
    border: 1px solid #ddd;
    border-radius: 8px;
    overflow: hidden;
  }

  /* 履歴アイテムのヘッダー */
  .item-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 16px;
    background: #f5f5f5;
    border-bottom: 1px solid #ddd;
  }

  .direction-label {
    font-size: 14px;
    font-weight: bold;
    color: #555;
  }

  .date-label {
    font-size: 13px;
    color: #999;
  }

  .restore-btn {
    margin-left: auto;
    background: #7b78a8;
    color: white;
    border: none;
    border-radius: 6px;
    padding: 4px 12px;
    font-size: 13px;
    cursor: pointer;
  }

  .restore-btn:hover {
    background: #6a6797;
  }

  /* 翻訳内容：左右2カラム */
  .item-body {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0;
  }

  .text-box {
    padding: 16px;
    /* heightではなくmax-heightにして内容が少ない場合は縮む */
    max-height: 80px;
    overflow: hidden;
  }

  .result-box {
    background: #f9f9f9;
    border-left: 1px solid #ddd;
  }

  .text-content {
    margin: 0;
    font-size: 16px;
    line-height: 1.7;
    white-space: pre-wrap;
    font-family: "Sarabun", sans-serif;
    word-wrap: break-word;
    overflow-wrap: break-word;
    /* はみ出た部分を...で省略する */
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    overflow: hidden;
  }
</style>
