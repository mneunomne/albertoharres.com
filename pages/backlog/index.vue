<template>
  <main class="main">
    <h1 class="">Backlog</h1>
  </main>
</template>
<script>
export default {
  computed: {
    news() {
      return this.$store.state.news;
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
