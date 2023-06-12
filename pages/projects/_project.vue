<!--

<template>
  <article
    v-if="projectPost"
    class="main article"
  >
    <h1 class="article-title">{{ projectPost.title }}</h1>
    <p class="mt-4">{{ projectPost.description }}</p>
    <img
      class="cover-image"
      :src="projectPost.cover"
    >
    <div
      class="block mt-8 mb-4"
      v-html="$md.render(projectPost.body)"
    />
    <div v-if="projectPost.gallery">
      <img
        v-for="image in projectPost.gallery"
        class="image"
        :key="image.id"
        :src="image"
      >
    </div>
  </article>
</template>
<script>
export default {
  async asyncData({ params, payload }) {
    if (payload) return { projectPost: payload }
    else
      return {
        projectPost: await require(`~/assets/content/projects/${params.project}.json`)
      }
  }
}
</script>


<template>
  <main
    v-if="projectPosts"
    class="main"
  >
    <h1 class="title text-left">Projects</h1>
    <ul
      v-for="(projectPost, index) in projectPosts"
      :key="index"
      class="articles"
    >
      <nuxt-link
        class="article article--clickable"
        :to="`projects/${projectPost.slug}`"
      >
        <h3 class="article-title">{{ projectPost.title }}</h3>
        <div class="mt-4 mb-2">
          <h2 class="inline py-1 px-2 mr-1 bg-accent text-white font-medium rounded-sm dark:bg-accent">{{ projectPost.project_type }}</h2>
          <p class="inline">{{ projectPost.description }}</p>
        </div>
      </nuxt-link>
    </ul>
  </main>
</template>
<script>
export default {
  computed: {
    projectPosts() {
      return this.$store.state.projectPosts
    }
  }
}
</script>

-->