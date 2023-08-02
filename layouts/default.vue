<template>
  <div class="main">
    <Header />
    <ConnectionsGraph
      :gData="gData"
      @showProject="showProject"
      @backToInitialView="onBackToInitialView"
      :currentProject="currentProject"
    />
    <nuxt />
  </div>
</template>

<script>
import Header from "~/components/Header.vue";
import ConnectionsGraph from "~/components/ConnectionsGraph.vue";

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
    };
  },
  computed: {
    projects() {
      return this.$store.state.projects;
    },
    gData() {
      const data = this.projects;
      console.log("data", data);
      const nodes = [];
      data.map((node) => {
        nodes.push({
          id: node.slug,
          val: 10,
          type: "project",
          thumbnail: node.thumbnail,
        });
        node.tags.forEach((tag) => {
          let found = nodes.find((node) => node.id === tag);
          if (!found) {
            nodes.push({
              id: tag,
              val: 1,
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
    onClickProject(data) {
      const { id } = data;
      this.$router.push(`/works/${id}`);
    },
    showProject(data) {
      const { id, width, height } = data;
      this.imageWidth = width;
      this.imageHeight = height;
      // root event show project
      this.$router.push(`/works/${id}`);
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
