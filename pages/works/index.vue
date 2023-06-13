<template>
  <main class="main">
    <ConnectionsGraph :gData="gData" />
  </main>
</template>
<script>
import ConnectionsGraph from "@/components/general/ConnectionsGraph.vue";

export default {
  components: {
    ConnectionsGraph,
  },
  mounted() {
    console.log("mounted!");
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
      console.log("links", links);
      return links;
    },
  },
};
</script>