<script lang="ts">
  let { children } = $props();
</script>

<main>
  <a href="/">Posts</a>
  {@render children()}
</main>
