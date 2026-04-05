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

  // ↑ボタンを表示するかどうか（少しスクロールしたら表示）
  let showScrollTop = $state(false);

  // タイ語のフォントサイズ（18 / 20 / 22px）LocalStorageから復元する
  let thaiFontSize = $state(20);

  // 入力エリアのDOM要素への参照（高さ自動調節に使う）
  let sourceTextarea = $state(null);

  // 結果エリアのDOM要素への参照（高さをそろえるために使う）
  let resultBox = $state(null);

  onMount(async () => {
    // LocalStorageからタイ語フォントサイズを復元する
    const saved = localStorage.getItem("thaiFontSize");
    if (saved) {
      thaiFontSize = parseInt(saved);
    }

    // ログインユーザーのセッションを取得する
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;

    if (userId) {
      // user_settingsテーブルからAPIキーを取得する
      const { data } = await supabase.from("user_settings").select("deepl_api_key").eq("user_id", userId).single();

      if (data) {
        apiKey = data.deepl_api_key;
        // APIキーが取得できたら使用量も取得する
        await fetchUsage();
      }
    }

    mounted = true;

    // 履歴ページから復元データがあれば読み込む
    const restore = localStorage.getItem("restoreTranslation");
    if (restore) {
      const parsed = JSON.parse(restore);
      sourceText = parsed.sourceText;
      translatedText = parsed.translatedText;
      direction = parsed.direction;
      // 読み込んだら削除する（余計なデータを残さない）
      localStorage.removeItem("restoreTranslation");
    }

    // ページ表示後に入力欄に自動でフォーカスを当てる
    setTimeout(() => {
      sourceTextarea?.focus();
    }, 0);

    // スクロール量に応じて↑ボタンの表示を切り替える
    window.addEventListener("scroll", () => {
      showScrollTop = window.scrollY > 100;
    });
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
      // 翻訳履歴をLocalStorageに保存する
      saveHistory(sourceText, data.translatedText, direction);
    }

    isLoading = false;
  }

  // 翻訳方向を反転させる関数
  function toggleDirection() {
    direction = direction === "TH_JA" ? "JA_TH" : "TH_JA";
    // テキストエリアの内容も入れ替える
    const temp = sourceText;
    sourceText = translatedText;
    translatedText = temp;
    // 方向切り替え後に高さをリセット
    setTimeout(() => {
      autoResize(sourceTextarea);
    }, 0);
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

  // タイ語フォントサイズを変更してLocalStorageに保存する関数
  function setThaiFontSize(size) {
    thaiFontSize = size;
    localStorage.setItem("thaiFontSize", String(size));
  }

  // 現在の翻訳方向に応じたフォントサイズを返す関数
  // 日本語は常に18px、タイ語はユーザー設定値
  function getSourceFontSize() {
    return direction === "JA_TH" ? 18 : thaiFontSize;
  }

  function getResultFontSize() {
    return direction === "TH_JA" ? 18 : thaiFontSize;
  }

  // textareaの高さをコンテンツに合わせて自動調節する関数
  function autoResize(el) {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }

  // sourceTextが変わるたびにtextareaの高さを調節してからそろえる
  $effect(() => {
    if (sourceText !== undefined) {
      autoResize(sourceTextarea);
    }
  });

  // ページ上部に戻る関数
  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // 翻訳履歴をLocalStorageに保存する関数
  // 最新5件だけ保持し、古いものは自動で削除する
  function saveHistory(sourceText, translatedText, direction) {
    const HISTORY_KEY = "translationHistory";
    const MAX_HISTORY = 5;

    // 既存の履歴を取得する（なければ空配列）
    const existing = localStorage.getItem(HISTORY_KEY);
    const history = existing ? JSON.parse(existing) : [];

    // 新しい履歴を先頭に追加する
    history.unshift({
      sourceText,
      translatedText,
      direction,
      // 日時を保存する（履歴ページで表示するため）
      createdAt: new Date().toISOString(),
    });

    // 最新5件だけ残して古いものを削除する
    const trimmed = history.slice(0, MAX_HISTORY);

    // LocalStorageに保存する
    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  }
</script>

{#if mounted}
  <div class="container">
    <!-- ヘッダー -->
    <header>
      <h1>DeepL翻訳</h1>

      <div class="header-right">
        <!-- タイ語フォントサイズ切り替えボタン -->
        <div class="font-size-btns">
          <span class="font-size-label">タイ語文字サイズ：</span>
          {#each [18, 20, 22] as size}
            <button class="font-size-btn" class:active={thaiFontSize === size} onclick={() => setThaiFontSize(size)}>
              {size}
            </button>
          {/each}
        </div>

        <!-- 履歴ページを別タブで開く -->
        <a class="history-btn" href="/history" target="_blank" rel="noreferrer">履歴</a>

        <button class="logout-btn" onclick={handleLogout}>ログアウト</button>
      </div>
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

    <!-- 言語ラベル行：グリッドの外に独立して配置 -->
    <div class="lang-row">
      <!-- 左側：コピーボタンと対称にするための空スペース -->
      <div class="lang-row-side"></div>

      <!-- 中央：タイ語 ⇄ 日本語 -->
      <div class="lang-row-center">
        <span class="lang-label">{direction === "TH_JA" ? "タイ語" : "日本語"}</span>
        <button class="toggle-btn" onclick={toggleDirection}>⇄</button>
        <span class="lang-label">{direction === "TH_JA" ? "日本語" : "タイ語"}</span>
      </div>

      <!-- 右側：コピーボタン -->
      <div class="lang-row-side right">
        {#if translatedText}
          <button class="copy-btn" onclick={copyResult}>
            {#if showCopied}
              <span>✅ コピーしました</span>
            {:else}
              <span>コピー</span>
            {/if}
          </button>
        {/if}
      </div>
    </div>

    <!-- 翻訳エリア（左右2カラム） -->
    <div class="translate-area">
      <!-- 入力エリア -->
      <div class="text-box">
        <textarea
          bind:this={sourceTextarea}
          bind:value={sourceText}
          placeholder={direction === "TH_JA" ? "タイ語を入力..." : "日本語を入力..."}
          style="font-size: {getSourceFontSize()}px;"
          oninput={() => autoResize(sourceTextarea)}
        ></textarea>
        {#if sourceText}
          <button
            class="clear-btn"
            onclick={() => {
              sourceText = "";
              translatedText = "";
              setTimeout(() => autoResize(sourceTextarea), 0);
            }}>✕</button
          >
        {/if}
      </div>

      <!-- 中央：翻訳ボタン -->
      <div class="translate-btn-wrap">
        <button class="translate-btn" onclick={handleTranslate} disabled={isLoading || !sourceText.trim()}>
          {isLoading ? "..." : "翻訳"}
        </button>
      </div>

      <!-- 結果エリア -->
      <div class="text-box result-box" bind:this={resultBox}>
        {#if translatedText}
          <pre class="result-text" style="font-size: {getResultFontSize()}px;">{translatedText}</pre>
        {:else if errorMessage}
          <p class="error">{errorMessage}</p>
        {:else}
          <p class="placeholder">翻訳結果がここに表示されます</p>
        {/if}
      </div>
    </div>
  </div>

  <!-- 右下固定：ページ上部に戻るボタン（100px以上スクロールしたら表示） -->
  {#if showScrollTop}
    <button class="scroll-top-btn" onclick={scrollToTop}>↑</button>
  {/if}
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
    margin-bottom: 12px;
  }

  h1 {
    font-size: 20px;
    margin: 0;
  }

  /* ヘッダー右側：フォントサイズボタン＋ログアウトをまとめる */
  .header-right {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  /* タイ語フォントサイズ切り替えボタン群 */
  .font-size-btns {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .font-size-label {
    font-size: 13px;
    color: #666;
    margin-right: 4px;
  }

  .font-size-btn {
    background: #f0f0f0;
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 4px 8px;
    font-size: 13px;
    cursor: pointer;
    color: #555;
  }

  .font-size-btn:hover {
    background: #e0e0e0;
  }

  /* 選択中のフォントサイズボタン */
  .font-size-btn.active {
    background: #7b78a8;
    border-color: #7b78a8;
    color: white;
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
    margin-bottom: 12px;
  }

  .usage-text {
    font-size: 13px;
    color: #666;
    margin-bottom: 4px;
  }

  .usage-bar {
    height: 4px;
    background: #eee;
    border-radius: 2px;
    overflow: hidden;
  }

  .usage-bar-fill {
    height: 100%;
    background: #7b78a8;
    border-radius: 2px;
    transition: width 0.3s;
  }

  .lang-label {
    font-size: 16px;
    font-weight: bold;
    color: #333;
  }

  .toggle-btn {
    background: #f0f0f0;
    border: none;
    border-radius: 50%;
    width: 36px;
    height: 36px;
    font-size: 18px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .toggle-btn:hover {
    background: #e0e0e0;
  }

  /* 翻訳エリア：3カラム×2行のグリッド */
  .translate-area {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    gap: 12px;
  }

  .text-box {
    position: relative;
    border: 1px solid #ddd;
    border-radius: 8px;
    overflow: hidden;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
  }

  textarea {
    width: 100%;
    /* 最低限の高さ（画面の高さから上部UIを引いた分） */
    min-height: calc(100vh - 200px);
    padding: 12px;
    border: none;
    /* コンテンツに応じて伸びるのでoverflowはvisibleに */
    overflow: hidden;
    resize: none;
    font-family: "Sarabun", sans-serif;
    line-height: 1.7;
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
    z-index: 1;
  }

  .clear-btn:hover {
    background: #ddd;
  }

  /* 翻訳ボタンのラッパー：上端に合わせて配置 */
  .translate-btn-wrap {
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 12px;
  }

  .translate-btn {
    padding: 10px 16px;
    background: #7b78a8;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 15px;
    cursor: pointer;
    white-space: nowrap;
  }

  .translate-btn:hover {
    background: #6a6797;
  }

  .translate-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* 結果エリア */
  .result-box {
    padding: 12px;
    background: #f9f9f9;
    position: relative;
    /* 最低限の高さをtextareaに合わせる */
    min-height: calc(100vh - 200px);
    box-sizing: border-box;
  }

  /* コピーボタンを結果エリアの右上に固定 */
  .copy-btn {
    background: white;
    border: 1px solid #ddd;
    border-radius: 6px;
    padding: 4px 12px;
    font-size: 13px;
    cursor: pointer;
  }

  .copy-btn:hover {
    background: #f0f0f0;
  }

  .copy-btn span {
    display: inline-block;
    /* 「✅ コピーしました」の幅に合わせて固定する */
    min-width: 110px;
    text-align: center;
  }

  .result-text {
    margin: 0;
    line-height: 1.7;
    white-space: pre-wrap;
    font-family: "Sarabun", sans-serif;
    /* preタグのデフォルトフォントを上書きする */
    font-size: inherit;
    word-wrap: break-word;
    overflow-wrap: break-word;
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

  /* 右下固定：ページ上部に戻るボタン */
  .scroll-top-btn {
    position: fixed;
    bottom: 24px;
    right: 24px;
    width: 44px;
    height: 44px;
    background: #7b78a8;
    color: white;
    border: none;
    border-radius: 50%;
    font-size: 20px;
    cursor: pointer;
    /* 他の要素より手前に表示する */
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }

  .scroll-top-btn:hover {
    background: #6a6797;
  }

  /* 言語ラベル行全体 */
  .lang-row {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 8px;
    position: relative;
  }

  /* 中央のタイ語⇄日本語をまとめるエリア */
  .lang-row-center {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  /* 左右の余白エリア（コピーボタンと対称にするため同じ幅にする） */
  .lang-row-side {
    flex: 1;
  }

  /* 右側はコピーボタンを右端に寄せる */
  .lang-row-side.right {
    display: flex;
    justify-content: flex-end;
  }

  .history-btn {
    background: none;
    border: 1px solid #ddd;
    border-radius: 6px;
    padding: 6px 12px;
    font-size: 14px;
    color: #555;
    text-decoration: none;
    cursor: pointer;
  }

  .history-btn:hover {
    background: #f5f5f5;
  }
</style>
