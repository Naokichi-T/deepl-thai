<script>
  import { onMount } from "svelte";
  import { supabase } from "$lib/supabase.js";

  // 子ページのコンテンツを表示するための変数
  let { children } = $props();

  // マウント済みかどうか（SSR対策）
  let mounted = $state(false);

  // ログイン済みかどうか
  let loggedIn = $state(false);

  onMount(async () => {
    // セッション（ログイン状態）を確認する
    const { data } = await supabase.auth.getSession();

    if (data.session) {
      // ログイン済み
      loggedIn = true;
    } else {
      // 未ログインならログインページへ移動
      // ただしログインページ自体にいる場合は移動しない
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }

    mounted = true;
  });
</script>

{#if mounted}
  {@render children()}
{/if}
