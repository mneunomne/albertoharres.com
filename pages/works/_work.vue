<template>
  <div>
    <Project v-if="project" :height="imageHeight" :width="imageWidth" :project="project" @closeProject="onCloseProject"
      :show="showCurrentProject" />
  </div>
</template>

<script>
import Project from "~/components/Project.vue";
import { getImageSizeOnScreen, CAMERA_ANIMATION_DURATION } from "/utils";
import { mapActions, mapGetters } from "vuex";

export default {
  name: "Work",
  components: {
    Project,
  },
  async asyncData({ params, payload, redirect }) {
    if (payload) return { project: payload };
    // Project pages sit at the root (/:work), so any unknown path lands here
    // too: send it home like the catch-all route used to.
    try {
      return {
        project: await require(`~/assets/content/projects/${params.work}.json`),
      };
    } catch (e) {
      return redirect("/");
    }
  },
  data() {
    return {
      imageHeight: 0,
      imageWidth: 0,
      project: null,
      showCurrentProject: false,
    };
  },
  computed: {
    ...mapGetters({
      getOpeningFromGraph: "getOpeningFromGraph",
    }),
  },
  mounted() {
    this.setCurrentProject(this.project);

    const { width, height } = getImageSizeOnScreen(this.project.thumb_width, this.project.thumb_height);
    this.imageHeight = height;
    this.imageWidth = width;

    // Opened by a click on the graph: the camera is flying to the node, so the
    // overlay waits for it. Anything else (direct URL load, reload, history,
    // a link from another page) shows the project at once; the graph behind
    // snaps itself to the node as soon as it is ready (see ConnectionsGraph).
    const fromGraph = this.getOpeningFromGraph;
    this.setOpeningFromGraph(false);

    if (fromGraph) {
      this._showTimer = setTimeout(() => {
        this.showCurrentProject = true;
      }, CAMERA_ANIMATION_DURATION + 100);
    } else {
      this.showCurrentProject = true;
    }
  },
  beforeDestroy() {
    clearTimeout(this._showTimer);
  },
  methods: {
    ...mapActions({
      setCurrentProject: "setCurrentProject",
      setOpeningFromGraph: "setOpeningFromGraph",
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
    // check if route changed to cv or bio, by checking the route name
    $route(to, from) {
      if (to.name === "cv" || to.name === "bio") {
        this.showCurrentProject = false;
      }
    },
  },
};
</script>