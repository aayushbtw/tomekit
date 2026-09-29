<script lang="ts">
  let { data } = $props();
</script>

<svelte:head>
  <title>Posts</title>
</svelte:head>

<h1>Posts</h1>
<ul>
  {#each data.posts as post (post.slug)}
    <li><a href="/posts/{post.slug}">{post.title}</a></li>
  {/each}
</ul>
