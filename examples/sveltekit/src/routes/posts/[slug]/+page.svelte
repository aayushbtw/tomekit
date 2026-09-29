<script lang="ts">
  let { data } = $props();
</script>

<svelte:head>
  <title>{data.post.metadata.title}</title>
  <meta name="description" content={data.post.metadata.description} />
</svelte:head>

<article>
  <h1>{data.post.metadata.title}</h1>
  <time datetime={data.post.metadata.publishedAt.toISOString()}>
    {data.post.metadata.publishedAt.toDateString()}
  </time>
  <!-- Rendered by marked at build time from your own Markdown files. -->
  {@html data.post.body}
</article>
