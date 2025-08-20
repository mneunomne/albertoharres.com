<template>
  <div>
    <TextPage @closeProject="onCloseProject" :data="data" />
  </div>
</template>

<script>
import Project from "~/components/Project.vue";
import { mapActions } from "vuex";
import TextPage from "~/components/TextPage.vue";

export default {
  name: "Work",
  components: {
    TextPage,
  },
  async asyncData({ params, payload, route }) {
    console.log("asyncData", params, payload);
    if (payload)
      return {
        data: payload,
      };
    else
      return {
        data: await require(`~/assets/content/site/bio.json`),
      };
  },
  data() {
    return {
      data: null,
    };
  },
  methods: {
    ...mapActions({
      setCurrentProject: "setCurrentProject",
    }),
    onCloseProject() {
      console.log("onCloseProject");
      this.$router.push({ path: "/works" });
    },
  },
};
</script>