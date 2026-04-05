<script>
  // Supabaseクライアントを読み込む
  import { supabase } from "$lib/supabase.js";

  // 入力値を管理する変数
  let email = $state("");
  let password = $state("");

  // エラーメッセージを管理する変数
  let errorMessage = $state("");

  // ログイン中かどうかを管理する変数
  let isLoading = $state(false);

  // ログインボタンを押したときの処理
  async function handleLogin() {
    isLoading = true;
    errorMessage = "";

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // ログイン失敗
      errorMessage = "メールアドレスまたはパスワードが正しくありません";
      isLoading = false;
    } else {
      // ログイン成功 → トップページへ移動
      window.location.href = "/";
    }
  }
</script>

<div class="container">
  <h1>ログイン</h1>

  <div class="form">
    <div class="field">
      <label for="email">メールアドレス</label>
      <input id="email" type="email" bind:value={email} placeholder="メールアドレス" />
    </div>

    <div class="field">
      <label for="password">パスワード</label>
      <input id="password" type="password" bind:value={password} placeholder="パスワード" />
    </div>

    {#if errorMessage}
      <p class="error">{errorMessage}</p>
    {/if}

    <button onclick={handleLogin} disabled={isLoading}>
      {isLoading ? "ログイン中..." : "ログイン"}
    </button>
  </div>
</div>

<style>
  .container {
    max-width: 400px;
    margin: 80px auto;
    padding: 0 20px;
  }

  h1 {
    font-size: 24px;
    margin-bottom: 32px;
    text-align: center;
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  label {
    font-size: 14px;
    color: #555;
  }

  input {
    padding: 10px 12px;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 16px;
  }

  input:focus {
    outline: none;
    border-color: #7b78a8;
  }

  button {
    padding: 12px;
    background: #7b78a8;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 16px;
    cursor: pointer;
  }

  button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .error {
    color: #e55;
    font-size: 14px;
    text-align: center;
  }
</style>
