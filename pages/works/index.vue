<template>
  <main class="main">
    <ConnectionsGraph
      :gData="gData"
      @clickProject="onClickProject"
      @showProject="showProject"
      :currentProject="currentProject"
    />
    <Project
      v-if="currentProject"
      :width="imageWidth"
      :height="imageHeight"
      :project="currentProject"
      @closeProject="onCloseProject"
      :show="showCurrentProject"
    />
  </main>
</template>
<script>
import ConnectionsGraph from "@/components/general/ConnectionsGraph.vue";
import Project from "@/components/general/Project.vue";

export default {
  components: {
    ConnectionsGraph,
    Project,
  },
  mounted() {
    console.log("mounted!");
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
      // console.log("data", data);
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
          //console.log("found", found)
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
      console.log("nodes", nodes);
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
      // console.log("clicked project", id);
      this.currentProject = this.projects.find(
        (project) => project.slug === id
      );
      console.log("this.currentProject", this.currentProject);
    },
    showProject(data) {
      const { id, width, height } = data;
      this.imageWidth = width;
      this.imageHeight = height;
      this.showCurrentProject = true;
    },
    onCloseProject() {
      this.currentProject = null;
      this.showCurrentProject = false;
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
      // console.log("links", links);
      return links;
    },
  },
};
</script>