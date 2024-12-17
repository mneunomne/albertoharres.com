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
      fx: 5 - Math.random() * 10,
      fy: 5 - Math.random() * 10,
    },
    pages_data: [
      {
        name: "ig",
        route: "https://www.instagram.com/mneu_nomne/",

      },
      {
        name: "m",
        route: "https://mastodon.social/@mneunomne",
      },
      {
        name: "git",
        route: "https://github.com/mneunomne",

      },
      {
        name: "cv",
        route: "https://docs.google.com/spreadsheets/d/1UepqwFz3A6oJvinS_eg5EG3NHAwfTDn6WnMvGzc1DVI/edit?gid=0#gid=0",
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
            type: "page"
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
