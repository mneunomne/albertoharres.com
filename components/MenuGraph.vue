<template>
  <div>
    <!--<h1>Menu Graph</h1>-->
    <div
      class="menu-graph"
      :style="{ width: `${width}px`, height: `${height}px` }"
      :class="{ mobile: getIsMobile, show }"
    ></div>
  </div>
</template>

<script>
import * as THREE from "three";
import SpriteText from "three-spritetext";
import { mapGetters } from "vuex";

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
      width: 250,
      height: 250,
      show: false,
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
  computed: {
    ...mapGetters({
      getIsMobile: "getIsMobile",
    }),
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
      const g = ForceGraph3D({
        rendererConfig: {
          antialias: true,
          powerPreference: "high-performance",
        },
      })(el);

      g.graphData(this.gData)
        .backgroundColor("rgba(0,0,0,0)")
        .showNavInfo(false)
        .numDimensions(2)
        .width(this.width)
        .height(this.height)
        .onNodeClick((node) => {
          this.$router.push({ path: node.route });
        })
        .nodeLabel((node) => {
          return false;
        })
        .linkColor(() => "rgb(0,0,0)")
        .nodeThreeObject((node) => {
          var group = new THREE.Group();
          const sprite = new SpriteText(node.name);
          sprite.fontFace = "Libre Bodoni Italic";
          // sprite.fontStyle = "italic";
          sprite.material.depthWrite = true; // make sprite background transparent
          sprite.material.opacity = 1;
          sprite.backgroundColor = "white";
          sprite.color = "black";
          sprite.textHeight = 10;
          sprite.padding = 2;

          sprite.renderOrder = 999;
          //sprite.material.depthTest = false;
          sprite.position.set(0, 1.6, 0);
          group.add(sprite);
          return group;
        });

      this.g = g;
      this.g.controls().noZoom = true;
      this.g.controls().noPan = true;
      this.g.controls().noRotate = true;

      process.nextTick(() => {
        this.g.renderer().setPixelRatio(window.devicePixelRatio);
        this.g.d3Force("link").distance((link) => 40);
        this.g.cameraPosition({ x: 0, y: 0, z: 150 });
        this.show = true;
      });
    },
  },
};
</script>


<style global lang="scss">
.menu-graph {
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.25s;
  position: fixed;
  top: 0;
  margin: 0px;
  width: 250px;
  height: 250px;
  z-index: 2;
  font-family: "Libre Bodoni Italic";
  &.mobile {
    z-index: 1;
  }
  &.show {
    opacity: 1;
    pointer-events: all;
  }
}
</style>