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
  data: () => ({
    center_data: {
      id: "alberto-harres",
      name: "alberto harres",
      route: "/",
      fx: 5 - Math.random() * 10,
      fy: 5 - Math.random() * 10,
    },
    pages_data: [
      {
        name: "bio",
        route: "/bio",
      },
      {
        name: "git",
        route: "https://github.com/mneunomne",
      },
      {
        name: "cv",
        route: "/cv",
      },
      // Language switch. Its label is the language it switches to ("pt" or
      // "en"), set by MenuGraph from the store; it never navigates.
      {
        id: "lang",
        name: "pt",
        type: "lang",
      },
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
            id: page.name,
            type: "page",
            ...page,
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

<style></style>
