<template>
  <div>
    <MenuGraph :gData="gData" />
  </div>
</template>

<script>
import MenuGraph from "~/components/MenuGraph.vue";

export default {
  name: "Header",
  components: {
    MenuGraph,
  },
  head() {
    return {
      script: [
        { src: "https://identity.netlify.com/v1/netlify-identity-widget.js" },
      ],
    };
  },
  data: () => ({
    center_data: {
      id: "alberto-harres",
      name: "alberto harres",
      route: "/",
    },
    pages_data: [
      {
        name: "about",
        route: "/about",
      },
      {
        name: "works",
        route: "/works",
      },
      {
        name: "backlog",
        route: "/backlog",
      },
    ],
  }),
  computed: {
    gData() {
      const nodes = this.pages_data
        .map((page) => {
          return {
            id: page.name,
            name: page.name,
            type: "page",
            route: page.route,
          };
        })
        .concat([this.center_data]);

      return {
        nodes: nodes,
        links: this.generateLinks(nodes),
      };
    },
  },
  methods: {
    generateLinks(nodes) {
      const links = [];
      nodes.forEach((node) => {
        if (node.id !== this.center_data.id) {
          links.push({
            source: node.id,
            target: this.center_data.id,
          });
        }
      });
      return links;
    },
  },
};
</script>

<style>
</style>
