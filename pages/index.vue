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
  mounted() {
    if (process.browser) {
      console.log("mounted", window.innerWidth);
    }
    if (window.innerWidth < 768 || isMobile()) {
      this.setIsMobile(true);
    } else {
      this.setIsMobile(false);
    }
    // is mobile
    window.addEventListener("resize", () => {
      console.log("resize", window.innerWidth);
      let is_mobile = window.innerWidth < 768 || isMobile();
      this.setIsMobile(is_mobile);
    });
  },
  methods: {
    ...mapMutations({
      setIsMobile: "setIsMobile",
    }),
  },
};
</script>

<style>
</style>
