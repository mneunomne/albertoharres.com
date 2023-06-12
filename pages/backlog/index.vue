<template>
  <main v-if="newsPosts" class="main">
    <h1 class="title text-left">Blog</h1>
    <ul v-for="(newsPosts, index) in newsPosts" :key="index" class="articles">
      <nuxt-link
        :to="`news/${newsPost.slug}`"
        class="article article--clickable"
      >
        <div class="flex justify-between align-baseline">
          <h3 class="article-title">{{ newsPost.title }}</h3>
          <h6
            v-if="newsPost.date"
            class="inline-block py-1 px-2 bg-accent text-white font-medium rounded-sm dark:bg-accent whitespace-no-wrap"
          >
            {{ formatDate(newsPost.date) }}
          </h6>
        </div>
        <div class="mt-4 mb-2">
          <p class="inline">{{ newsPost.description }}</p>
        </div>
      </nuxt-link>
    </ul>
  </main>
</template>
<script>
export default {
  computed: {
    newsPosts() {
      return this.$store.state.newsPosts;
    },
  },
  methods: {
    formatDate(dateString) {
      const date = new Date(dateString);
      return date.toLocaleDateString(process.env.lang) || "";
    },
  },
};
</script>
