<template>
  <div>
    <MenuGraph :gData="gData" />
    <a v-show="false" rel="me" href="https://mastodon.social/@mneunomne"
      >Mastodon</a
    >
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

<style></style>
