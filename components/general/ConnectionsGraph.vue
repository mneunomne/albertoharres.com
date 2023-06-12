<template>
  <div class="connections-graph">.</div>
</template>
  
<script>
// import d3ForceLimit from 'd3-force-limit'
import * as THREE from "three";
import SpriteText from "three-spritetext";

const fontSize = 6;

export default {
  props: {
    gData: {
      type: Object,
      required: true,
    },
  },
  mounted() {
    this.buildGraph();
  },
  methods: {
    buildGraph() {
      let ForceGraph3D;
      if (window) {
        ForceGraph3D = require("3d-force-graph").default;
        console.log("ForceGraph3D", ForceGraph3D);
      } else {
        return;
      }
      const el = document.querySelector(".connections-graph");
      const g = ForceGraph3D()(el);

      console.log("gData", this.gData);

      g.graphData(this.gData)
        .backgroundColor("rgba(0,0,0,0)")
        .showNavInfo(false)
        .numDimensions(3)
        .linkColor(() => "rgb(0,0,0)")
        .nodeThreeObject((node) => {
          var group = new THREE.Group();
          if (node.type == "project") {
            group = this.projectNode(node, group);
          } else {
            group = this.tagNode(node, group);
          }
          return group;
        });
    },

    tagNode(node, group) {
      console.log("node", node);
      const sprite = new SpriteText(node.id);
      // sprite.fontFace = 'Space Mono'
      sprite.material.depthWrite = false; // make sprite background transparent
      sprite.material.opacity = 1;

      sprite.color = "black";
      sprite.textHeight = fontSize;
      sprite.padding = 2;

      sprite.renderOrder = 999;
      sprite.material.depthTest = false;
      sprite.position.set(0, 1.6, 0);
      group.add(sprite);
      return group;
    },

    projectNode(node, group) {
      const imgTexture = new THREE.TextureLoader().load(node.thumbnail);
      imgTexture.colorSpace = THREE.SRGBColorSpace;
      const material = new THREE.SpriteMaterial({ map: imgTexture });
      const sprite = new THREE.Sprite(material);
      //sprite.renderOrder = 999;
      sprite.material.depthTest = false;
      sprite.scale.set(30, 30);
      group.add(sprite);
      return group;
    },
  },
};
</script>
  
<style global lang="postcss">
.connections-graph {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}
</style>