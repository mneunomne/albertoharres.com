<template>
  <div>
    <Project
      v-if="project"
      :height="imageHeight"
      :project="project"
      @closeProject="onCloseProject"
      :show="showCurrentProject"
    />
  </div>
</template>

<script>
import Project from "~/components/Project.vue";

import { getImageHeightOnScreen } from "/utils";

export default {
  name: "Work",
  components: {
    Project,
  },
  async asyncData({ params, payload }) {
    console.log("params payload", params, payload);
    if (payload) return { project: payload };
    else
      return {
        project: await require(`~/assets/content/projects/${params.work}.json`),
      };
  },
  data() {
    return {
      imageHeight: 0,
      showCurrentProject: false,
    };
  },
  mounted() {
    console.log("mounted project", this.project);
    this.imageHeight = getImageHeightOnScreen();
    this.showCurrentProject = true;
  },
  methods: {
    onCloseProject() {
      console.log("onCloseProject");
      this.showCurrentProject = false;
      this.$router.push("/works");
    },
  },
  watch: {
    project() {
      console.log("changed project", this.project);
      this.showCurrentProject = true;
    },
  },
};
</script>