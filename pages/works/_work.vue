<template>
  <div>
    <Project v-if="project" :height="imageHeight" :width="imageWidth" :project="project" @closeProject="onCloseProject"
      :show="showCurrentProject" />
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
  async asyncData({ params, payload, route }) {
    console.log("asyncData", params, payload);
    const isDirectAccess = process.client && !document.referrer.includes(window.location.host);

    if (payload) return {
      project: payload,
      isDirectAccess
    };
    else
      return {
        project: await require(`~/assets/content/projects/${params.work}.json`),
        isDirectAccess
      };
  },
  data() {
    return {
      imageHeight: 0,
      imageWidth: 0,
      project: null,
      showCurrentProject: false,
      isDirectAccess: false
    };
  },
  mounted() {
    this.setCurrentProject(this.project);

    // Check if there is "graph=true" parameter in the URL
    const urlParams = new URLSearchParams(window.location.search);
    const graphParam = urlParams.get("graph");
    const isDirectNavigation = !graphParam

    getImageSizeOnScreen(this.project.thumbnail).then((size) => {
      this.imageHeight = size.height;
      this.imageWidth = size.width;

      if (isDirectNavigation) {
        // If directly navigated to this page, show project immediately
        this.showCurrentProject = true;
      } else {
        // Otherwise use the camera animation delay
        setTimeout(() => {
          this.showCurrentProject = true;
        }, CAMERA_ANIMATION_DURATION + 100);
      }
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