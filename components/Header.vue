<template>
  <div>
    <MenuGraph :gData="gData" />
  </div>
</template>

<script>
import MenuGraph from "~/components/MenuGraph.vue";
import { mapGetters } from "vuex";

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
      //fx: 10,
      //fy: -10,
    },
    pages_data: [
      {
        name: "about",
        route: "/works/about",
      },
      {
        name: "works",
        route: "/works",
        fy: 35,
        fx: 20,
      },
      /*
      {
        name: "backlog",
        route: "/backlog",
      },
      */
    ],
  }),
  computed: {
    ...mapGetters({
      getIsMobile: "getIsMobile",
    }),
    gData() {
      const nodes = this.pages_data
        .map((page) => {
          return {
            ...page,
            id: page.name,
            type: "page",
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
