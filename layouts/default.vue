<template>
  <div class="main" :class="{ mobile: getIsMobile }">
    <div class="project-bg" :class="{ show: showBackground }"></div>
    <div id="background">
      <img :src="prevImgUrl" :style="{ opacity: imgUrl ? 1 : 0 }" class="background-image prev"
        :class="{ show: showBg }" />
      <!-- current image -->
      <img :src="imgUrl" :style="{ opacity: imgUrl ? 1 : 0 }" class="background-image prev" />
    </div>
    <Header />
    <ConnectionsGraph :gData="gData" @clickProject="onClickProject" @backToInitialView="onBackToInitialView"
      :currentProject="currentProject" @hoverProject="onHoverProject" />
    <nuxt />
  </div>
</template>

<script>
import Header from "~/components/Header.vue";
import ConnectionsGraph from "~/components/ConnectionsGraph.vue";
import { isMobile, CAMERA_ANIMATION_DURATION } from "~/utils";
import { mapGetters } from "vuex";
import { mapActions } from "vuex";

export default {
  components: {
    Header,
    ConnectionsGraph,
  },
  data() {
    return {
      currentProject: null,
      imageWidth: 0,
      imageHeight: 0,
      showCurrentProject: false,
      imgUrl: "",
      prevImgUrl: "",
      showBg: false,
      showBackground: false,
    };
  },
  created() {
    if (!process.browser) {
      return;
    }

    // check is mobile
    this.checkScreenSize();
    window.addEventListener("resize", this.checkScreenSize);
  },
  computed: {
    ...mapGetters({
      getCurrentProject: "getCurrentProject",
      getProjects: "getProjects",
      getIsMobile: "getIsMobile",
    }),
    projects() {
      return this.$store.state.projects.filter((p) => !p.disabled);
    },
    gData() {
      const data = this.projects;
      const nodes = [];
      data.map((node) => {
        nodes.push({
          id: node.slug,
          val: 10,
          type: "project",
          thumbnail: node.thumbnail,
          importance: node.importance,
          title: node.title,
        });
        node.tags.forEach((tag) => {
          let found = nodes.find((node) => node.id === tag);
          if (!found) {
            nodes.push({
              id: tag,
              val: 1,
              type: "tag",
            });
          } else {
            nodes[nodes.indexOf(found)].val += 1;
          }
        });
      });
      // console.log("nodes", nodes);
      const links = this.generateLinks(data, nodes);
      const obj = {
        nodes: nodes,
        links: links,
      };
      return obj;
    },
  },
  methods: {
    ...mapActions({
      setIsMobile: "setIsMobile",
      setIsTabletView: "setIsTabletView",
    }),
    checkScreenSize() {
      this.setIsMobile(window.innerWidth < 768);
      this.setIsTabletView(window.innerWidth > 768 && window.innerWidth < 1200);
    },
    onClickProject(data) {
      const { id, transitionTime } = data;
      // add 'from graph' param
      this.$router.push(`/works/${id}?graph=true`);
    },
    onHoverProject(data) {
      const { imgUrl } = data;
      this.prevImgUrl = this.imgUrl;
      this.imgUrl = imgUrl;
      this.showBg = true;
      this.timeout && clearTimeout(this.timeout);
      this.timeout = setTimeout(() => {
        this.showBg = false;
      }, 1000);
    },
    showProject(data) {
      // const { id } = data;
      // this.$root.$emit("showProject", id);
    },
    onCloseProject() {
      // this.currentProject = null;
      this.showCurrentProject = false;
      this.$emit("closeProject");
    },
    onBackToInitialView() {
      this.currentProject = null;
      this.$emit("closeProject");
    },
    generateLinks(data) {
      const links = [];
      data.forEach((node) => {
        node.tags.forEach((tag) => {
          links.push({
            source: node.slug,
            target: tag,
          });
        });
      });
      return links;
    },
  },
  mounted() {
    if (this.$route.name == "index" || this.$route.name == "works") {
      this.currentProject = null;
      this.showCurrentProject = false;
      this.showBackground = false;
    } else {
      this.showBackground = true;
    }
  },
  watch: {
    $route(to, from) {
      // check if route is /works/:slug
      if (to.name == "bio" || to.name == "cv") {
        this.currentProject = null;
        this.showCurrentProject = false;
        this.showBackground = true;
      }
      if (to.name == "index" || to.name == "works") {
        this.currentProject = null;
        this.showCurrentProject = false;
        this.showBackground = false;
      }
      if (to.name == "works-work") {
        const work = to.params.work;
        const project = this.projects.find((p) => p.slug === work);
        if (project) {
          this.currentProject = project;
          this.showCurrentProject = true;
          setTimeout(() => {
            this.showBackground = true;
          }, CAMERA_ANIMATION_DURATION + 200);
        } else {
          this.currentProject = null;
          this.showCurrentProject = false;
          this.showBackground = false;
        }
      }
    },
  }
};
</script>


<style lang="scss" scoped>
.main {
  .project-bg {
    opacity: 0;
    transition: all 0.5s;
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: 1;
    backdrop-filter: blur(10px);
    background: rgba(255, 255, 255, 0.85);
    pointer-events: none;

    opacity: 0;

    &.show {
      opacity: 1;
    }
  }

  &.mobile {
    .project-bg {
      z-index: 2;
    }
  }
}

#background {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  z-index: -1;
  transition: background-image 0.5s ease-in-out;
}

.background-image {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  z-index: -1;
  transition: opacity 0.5s ease-in-out;

  &.prev {
    z-index: -2;

    &.show {
      z-index: 1;
      opacity: 1;
    }
  }
}
</style>