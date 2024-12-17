<template>
  <div class="main">
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
import { isMobile } from "~/utils";
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
      return this.$store.state.projects;
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
          title_en: node.title_en,
          title_pt: node.title_pt,
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
      this.$router.push(`/works/${id}`);
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
};
</script>


<style lang="scss" scoped>
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