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

import { getImageSizeOnScreen, CAMERA_ANIMATION_DURATION } from "/utils";

import { mapActions } from "vuex";

export default {
  name: "Work",
  components: {
    Project,
  },
  async asyncData({ params, payload }) {
    console.log("asyncData", params, payload);
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
      project: null,
      showCurrentProject: false,
    };
  },
  mounted() {
    console.log("mounted work", this.project);
    this.setCurrentProject(this.project);
    getImageSizeOnScreen(this.project.thumbnail).then((size) => {
      this.imageHeight = size.height;
      this.imageWidth = size.width;
      setTimeout(() => {
        this.showCurrentProject = true;
      }, CAMERA_ANIMATION_DURATION + 100);
    });
  },
  methods: {
    ...mapActions({
      setCurrentProject: "setCurrentProject",
    }),
    onCloseProject() {
      console.log("onCloseProject");
      // go back to route "works"
      this.showCurrentProject = false;
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