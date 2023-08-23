<template>
  <div>
    <!-- <logo /> -->
  </div>
</template>

<script>
import { mapMutations } from "vuex";
import { isMobile } from "~/utils";
export default {
  head() {
    return {
      script: [
        { src: "https://identity.netlify.com/v1/netlify-identity-widget.js" },
      ],
    };
  },
};
</script>

<style>
</style>
