<template>
  <div :class="{ hidden }" class="connections-graph">.</div>
</template>
  
<script>
// import d3ForceLimit from 'd3-force-limit'
import * as THREE from "three";
import SpriteText from "three-spritetext";

const fontSize = 6;

export default {
  name: "ConnectionsGraph",
  props: {
    gData: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      g: null,
      hidden: true,
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
      const el = document.querySelector(".connections-graph");
      const g = ForceGraph3D()(el);

      g.graphData(this.gData)
        .backgroundColor("rgba(0,0,0,0)")
        .showNavInfo(false)
        .numDimensions(3)
        .width(window.innerWidth)
        .height(window.innerHeight)
        .cooldownTicks(100)
        .onNodeHover((node) => {
          if (node && node.type !== "project") {
            this.filterNodes(node);
          }
          // reset
          if (!node) {
            let { nodes, links } = this.g.graphData();
            nodes.forEach((n) => {
              n.__threeObj.children[0].material.opacity = 1;
            });
            links.forEach((l) => {
              l.__lineObj.material.opacity = 0.5;
            });
          }
          el.style.cursor = node ? "pointer" : null;
        })
        .onNodeClick((node) => {
          if (node.type == "project") {
            el.style.cursor = node ? "pointer" : null;
            const distance = 100;
            const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);

            const newPos =
              node.x || node.y || node.z
                ? {
                    x: node.x * distRatio,
                    y: node.y * distRatio,
                    z: node.z * distRatio,
                  }
                : { x: 0, y: 0, z: distance }; // special case if node is in (0,0,0)

            g.cameraPosition(
              newPos, // new position
              node, // lookAt ({ x, y, z })
              3000 // ms transition duration
            );
          } else a;
        })
        .linkColor(() => "rgb(0,0,0)")
        .nodeThreeObject((node) => {
          var group = new THREE.Group();
          if (node.type == "project") {
            return this.projectNode(node, group);
          } else {
            group = this.tagNode(node, group);
          }
          return group;
        });
      this.g = g;
      // on stop animation
      this.g.onEngineStop(() => {
        this.hidden = false;
        //cameraPosition([{x,y,z}], [lookAt], [ms])
        //this.g.cameraPosition({ x: 0, y: 0, z: 400 }, 0, 1000);
      });
      setTimeout(() => {
        process.nextTick(() => {
          const linkForce = this.g.d3Force("link").distance((link) => 50);
          this.g.cameraPosition({ x: 0, y: 0, z: 450 });
          // go through all nodes
          this.g.graphData().nodes.forEach((node) => {
            if (node.type == "project") {
              if (node.__threeObj) {
                const img = document.createElement("img");
                img.src = node.thumbnail;
                // console.log("img", img);
                // on load
                if (img.complete) {
                  // console.log("img.complete");
                  // update to correct aspect ratio
                  const aspect = img.width / img.height;
                  node.__threeObj.children[0].scale.set(35 * aspect, 35);
                } else {
                  img.onload = () => {
                    // update to correct aspect ratio
                    const aspect = img.width / img.height;
                    node.__threeObj.children[0].scale.set(35 * aspect, 35);
                    //node.__threeObj.children[0].material.map.needsUpdate = true; // update texture
                  };
                }
              }
              // update group
            }
          });
        });
      }, 10);
      window.addEventListener("resize", this.onWindowResize, false);
    },

    tagNode(node, group) {
      const sprite = new SpriteText(node.id);
      // sprite.fontFace = "Space Mono";
      sprite.material.depthWrite = false; // make sprite background transparent
      sprite.material.opacity = 1;
      sprite.color = "black";
      sprite.textHeight = 2 * node.val;
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
      //console.log("imgTexture", imgTexture.image);
      // set image to correct aspect ratio
      //const aspect = imgTexture.image.width / imgTexture.image.height;
      sprite.scale.set(1, 1);
      sprite.position.set(0, 0, 0);
      //sprite.renderOrder = 999;
      sprite.material.depthTest = false;
      group.add(sprite);
      return group;
    },
    filterNodes(node) {
      let { nodes, links } = this.g.graphData();
      links = links.filter((l) => l.source === node || l.target === node);

      var hidden_nodes = nodes.filter((n) => {
        return (
          n.id !== node.id &&
          !links.some((l) => l.source.id === n.id || l.target.id === n.id)
        );
      });

      hidden_nodes.forEach((n) => {
        // n.__threeObj.material.opacity = 0.1;
        // change opacity
        n.__threeObj.children[0].material.opacity = 0.1;
      });

      // console.log("links", links);
      // hide links that are not connected to the node
      links.forEach((l) => {
        if (l.source.id !== node.id || l.target.id !== node.id) {
          // l.__lineObj.visible = false;
          l.__lineObj.material.opacity = 0.1;
        }
      });

      // this.g.graphData({ nodes, links });
    },
    onWindowResize() {
      console.log("on Window Resize");
      this.g.width(window.innerWidth);
      this.g.height(window.innerHeight);
    },
  },
};
</script>
  
<style global lang="postcss">
.connections-graph {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  transition: opacity 0.25s ease-in-out;
  transform: scale(1);
}

.hidden {
  opacity: 0;
  transform: scale(0.9);
}
</style>