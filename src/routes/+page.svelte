<script>
  import { onMount } from "svelte";
  import { supabase } from "$lib/supabase.js";

  // マウント済みかどうか（SSR対策）
  let mounted = $state(false);

  // ログインユーザーのDeepL APIキー
  let apiKey = $state("");

  // 翻訳元テキスト
  let sourceText = $state("");

  // 翻訳結果テキスト
  let translatedText = $state("");

  // 翻訳方向（'TH_JA' = タイ語→日本語、'JA_TH' = 日本語→タイ語）
  let direction = $state("TH_JA");

  // 翻訳中かどうか
  let isLoading = $state(false);

  // エラーメッセージ
  let errorMessage = $state("");

  // 今月の使用文字数
  let characterCount = $state(null);

  // 今月の上限文字数
  let characterLimit = $state(null);

  // コピー完了メッセージを表示するかどうか
  let showCopied = $state(false);

  onMount(async () => {
    // ログインユーザーのセッションを取得する
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;

    if (userId) {
      // user_settingsテーブルからAPIキーを取得する
      const { data, error } = await supabase.from("user_settings").select("deepl_api_key").eq("user_id", userId).single();

      if (data) {
        apiKey = data.deepl_api_key;

        // APIキーが取得できたら使用量も取得する
        await fetchUsage();
      }
    }

    mounted = true;
  });

  // 使用量を取得する関数
  async function fetchUsage() {
    const response = await fetch(`/api/usage?apiKey=${apiKey}`);
    const data = await response.json();

    if (!data.error) {
      characterCount = data.characterCount;
      characterLimit = data.characterLimit;
    }
  }

  // 翻訳方向から翻訳元・翻訳先の言語コードを取得する関数
  function getLangCodes() {
    if (direction === "TH_JA") {
      return { sourceLang: "TH", targetLang: "JA" };
    } else {
      return { sourceLang: "JA", targetLang: "TH" };
    }
  }

  // 翻訳ボタンを押したときの処理
  async function handleTranslate() {
    if (!sourceText.trim()) return;

    isLoading = true;
    errorMessage = "";
    translatedText = "";

    const { sourceLang, targetLang } = getLangCodes();

    const response = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: sourceText,
        sourceLang,
        targetLang,
        apiKey,
      }),
    });

    const data = await response.json();

    if (data.error) {
      errorMessage = data.error;
    } else {
      translatedText = data.translatedText;

      // 翻訳後に使用量を更新する
      await fetchUsage();
    }

    isLoading = false;
  }

  // 翻訳方向を反転させる関数
  function toggleDirection() {
    // 方向を切り替える
    direction = direction === "TH_JA" ? "JA_TH" : "TH_JA";

    // テキストエリアの内容も入れ替える
    const temp = sourceText;
    sourceText = translatedText;
    translatedText = temp;
  }

  // 翻訳結果をクリップボードにコピーする関数
  async function copyResult() {
    if (!translatedText) return;

    await navigator.clipboard.writeText(translatedText);

    // 「コピーしました」を一時的に表示する
    showCopied = true;
    setTimeout(() => {
      showCopied = false;
    }, 2000);
  }

  // ログアウトする関数
  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  // 使用量をパーセントで計算する関数
  function getUsagePercent() {
    if (!characterCount || !characterLimit) return 0;
    return Math.round((characterCount / characterLimit) * 100);
  }

  // 数字を読みやすい形式にフォーマットする関数（例：500000 → 500,000）
  function formatNumber(num) {
    if (num === null) return "-";
    return num.toLocaleString();
  }
</script>

{#if mounted}
  <div class="container">
    <!-- ヘッダー -->
    <header>
      <h1>DeepL翻訳</h1>
      <button class="logout-btn" onclick={handleLogout}>ログアウト</button>
    </header>

    <!-- 使用量表示 -->
    {#if characterLimit !== null}
      <div class="usage">
        <div class="usage-text">
          今月の使用量：{formatNumber(characterCount)} / {formatNumber(characterLimit)} 文字 （{getUsagePercent()}%）
        </div>
        <div class="usage-bar">
          <div class="usage-bar-fill" style="width: {getUsagePercent()}%"></div>
        </div>
      </div>
    {/if}

    <!-- 翻訳方向の切り替え -->
    <div class="direction">
      <span class="lang-label">
        {direction === "TH_JA" ? "タイ語" : "日本語"}
      </span>
      <button class="toggle-btn" onclick={toggleDirection}>⇄</button>
      <span class="lang-label">
        {direction === "TH_JA" ? "日本語" : "タイ語"}
      </span>
    </div>

    <!-- 翻訳エリア -->
    <div class="translate-area">
      <!-- 入力エリア -->
      <div class="text-box">
        <textarea bind:value={sourceText} placeholder={direction === "TH_JA" ? "タイ語を入力..." : "日本語を入力..."} rows="6"></textarea>
        {#if sourceText}
          <button
            class="clear-btn"
            onclick={() => {
              sourceText = "";
              translatedText = "";
            }}>✕</button
          >
        {/if}
      </div>

      <!-- 翻訳ボタン -->
      <button class="translate-btn" onclick={handleTranslate} disabled={isLoading || !sourceText.trim()}>
        {isLoading ? "翻訳中..." : "翻訳する"}
      </button>

      <!-- 結果エリア -->
      <div class="text-box result-box">
        {#if translatedText}
          <p class="result-text">{translatedText}</p>
          <button class="copy-btn" onclick={copyResult}>
            {showCopied ? "✅ コピーしました" : "コピー"}
          </button>
        {:else if errorMessage}
          <p class="error">{errorMessage}</p>
        {:else}
          <p class="placeholder">翻訳結果がここに表示されます</p>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .container {
    max-width: 640px;
    margin: 0 auto;
    padding: 20px;
  }

  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
  }

  h1 {
    font-size: 24px;
    margin: 0;
  }

  .logout-btn {
    background: none;
    border: 1px solid #ddd;
    border-radius: 6px;
    padding: 6px 12px;
    cursor: pointer;
    font-size: 14px;
    color: #555;
  }

  .logout-btn:hover {
    background: #f5f5f5;
  }

  /* 使用量バー */
  .usage {
    margin-bottom: 24px;
  }

  .usage-text {
    font-size: 13px;
    color: #666;
    margin-bottom: 6px;
  }

  .usage-bar {
    height: 6px;
    background: #eee;
    border-radius: 3px;
    overflow: hidden;
  }

  .usage-bar-fill {
    height: 100%;
    background: #7b78a8;
    border-radius: 3px;
    transition: width 0.3s;
  }

  /* 翻訳方向 */
  .direction {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    margin-bottom: 16px;
  }

  .lang-label {
    font-size: 16px;
    font-weight: bold;
    color: #333;
    min-width: 60px;
    text-align: center;
  }

  .toggle-btn {
    background: #f0f0f0;
    border: none;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    font-size: 20px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .toggle-btn:hover {
    background: #e0e0e0;
  }

  /* 翻訳エリア */
  .translate-area {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .text-box {
    position: relative;
    border: 1px solid #ddd;
    border-radius: 8px;
    overflow: hidden;
  }

  textarea {
    width: 100%;
    padding: 12px;
    border: none;
    font-size: 16px;
    resize: vertical;
    font-family: "Sarabun", sans-serif;
    box-sizing: border-box;
  }

  textarea:focus {
    outline: none;
  }

  .clear-btn {
    position: absolute;
    top: 8px;
    right: 8px;
    background: #eee;
    border: none;
    border-radius: 50%;
    width: 24px;
    height: 24px;
    cursor: pointer;
    font-size: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .clear-btn:hover {
    background: #ddd;
  }

  .translate-btn {
    padding: 12px;
    background: #7b78a8;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 16px;
    cursor: pointer;
  }

  .translate-btn:hover {
    background: #6a6797;
  }

  .translate-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .result-box {
    min-height: 120px;
    padding: 12px;
    background: #f9f9f9;
  }

  .result-text {
    margin: 0;
    font-size: 16px;
    line-height: 1.6;
    white-space: pre-wrap;
    font-family: "Sarabun", sans-serif;
  }

  .placeholder {
    margin: 0;
    color: #aaa;
    font-size: 14px;
  }

  .error {
    margin: 0;
    color: #e55;
    font-size: 14px;
  }

  .copy-btn {
    margin-top: 8px;
    background: none;
    border: 1px solid #ddd;
    border-radius: 6px;
    padding: 4px 12px;
    font-size: 13px;
    cursor: pointer;
  }

  .copy-btn:hover {
    background: #f0f0f0;
  }
</style>
