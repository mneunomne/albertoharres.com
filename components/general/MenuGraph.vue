<template>
  <div class="menu-graph">
    <h1>Menu Graph</h1>
  </div>
</template>

<script>
import * as THREE from "three";
import SpriteText from "three-spritetext";

export default {
  name: "MenuGraph",
  props: {
    gData: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      g: null,
    };
  },
  mounted() {
    if (!process.browser) {
      return;
    }
    process.nextTick(() => {
      this.buildGraph();
    });
  },
  methods: {
    buildGraph() {
      let ForceGraph3D;
      if (window) {
        ForceGraph3D = require("3d-force-graph").default;
      } else {
        return;
      }
      const el = document.querySelector(".menu-graph");
      const g = ForceGraph3D()(el);

      g.graphData(this.gData)
        .backgroundColor("rgba(0,0,0,0)")
        .showNavInfo(false)
        .numDimensions(2)
        .width(250)
        .height(250)
        .onNodeClick((node) => {
          this.$router.push({ path: node.route });
        })
        .linkColor(() => "rgb(0,0,0)")
        .nodeThreeObject((node) => {
          var group = new THREE.Group();
          const sprite = new SpriteText(node.name);
          // sprite.fontFace = "Space Mono";
          sprite.material.depthWrite = false; // make sprite background transparent
          sprite.material.opacity = 1;
          sprite.backgroundColor = "white";
          sprite.color = "black";
          sprite.textHeight = 10;
          sprite.padding = 2;

          sprite.renderOrder = 999;
          sprite.material.depthTest = false;
          sprite.position.set(0, 1.6, 0);
          group.add(sprite);
          return group;
        });

      this.g = g;

      process.nextTick(() => {
        const linkForce = this.g.d3Force("link").distance((link) => 40);
        this.g.cameraPosition({ x: 0, y: 0, z: 200 });
      });
    },
  },
};
</script>


<style global lang="postcss">
.menu-graph {
  position: absolute;
  top: 0;
  width: 200px;
  height: 200px;
  z-index: 999;
}
</style>