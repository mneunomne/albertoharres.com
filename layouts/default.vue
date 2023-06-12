<template>
  <div class="container">
    <Header />
    <nuxt />
  </div>
</template>

<script>
import Header from "~/components/general/Header.vue";

export default {
  components: {
    Header,
  },
};
</script>
