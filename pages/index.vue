<template>
  <div>
    <!-- Phones only (hidden by CSS on wider screens, where the graph is the home page). -->
    <MobileProjectList />
  </div>
</template>

<script>
import MobileProjectList from "~/components/MobileProjectList.vue";

export default {
  components: {
    MobileProjectList,
  },
  head() {
    return {
      script: [
        {
          hid: "netlify-identity",
          src: "https://identity.netlify.com/v1/netlify-identity-widget.js",
        },
      ],
    };
  },
};
</script>

<style>
</style>
