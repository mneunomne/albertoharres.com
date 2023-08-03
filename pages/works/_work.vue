<template>
  <div>
    <Project
      v-if="project"
      :height="imageHeight"
      :width="imageWidth"
      :project="project"
      @closeProject="onCloseProject"
      :show="showCurrentProject"
    />
  </div>
</template>

<script>
import Project from "~/components/Project.vue";

import { getImageSizeOnScreen } from "/utils";

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
      imageWidth: 0,
      showCurrentProject: false,
    };
  },
  mounted() {
    console.log("mounted project", this.project);
    getImageSizeOnScreen(this.project.thumbnail).then((size) => {
      console.log("size", size);
      this.imageHeight = size.height;
      this.imageWidth = size.width;
      this.showCurrentProject = true;
    });
  },
  methods: {
    onCloseProject() {
      console.log("onCloseProject");
      // go back to route "works"
      //this.showCurrentProject = false;
      this.$router.push({ path: "/works" });
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