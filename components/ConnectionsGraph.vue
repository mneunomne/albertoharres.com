<template>
  <div
    :class="{ hidden, 'no-interaction': transition || openProject }"
    class="connections-graph"
  >
    .
  </div>
</template>
  
<script>
// import d3ForceLimit from 'd3-force-limit'
import * as THREE from "three";
import SpriteText from "three-spritetext";

import {
  CAMERA_FOV,
  IMAGE_SCALE,
  CANVAS_OUT_MARGIN,
  CAMERA_DISTANCE,
} from "~/utils";

const fontSize = 6;
const distance = 500;
const lineOpacity = 0.1;

export default {
  name: "ConnectionsGraph",
  props: {
    gData: {
      type: Object,
      required: true,
      el: null,
    },
  },
  data() {
    return {
      g: null,
      hidden: true,
      angle: 0,
      transition: false,
      engineStoped: false,
      canvasHeight: 0,
      openProject: false,
    };
  },
  mounted() {
    if (!process.browser) {
      return;
    }
    // if router is on project page, hide graph
    if (this.$route.path.includes("works/")) {
      this.openProject = true;
    }
    this.canvasHeight = window.innerHeight + CANVAS_OUT_MARGIN;
    process.nextTick(() => {
      this.buildGraph();
    });
    // listen to event on root component
    this.$root.$on("closeProject", () => {
      console.log("closeProject");
      this.openProject = false;
      this.showAllElements();
    });
  },
  watch: {
    currentProject: {
      handler: function (val, oldVal) {
        if (val == null) {
          this.showAllElements();
        }
      },
      deep: true,
    },
  },
  methods: {
    buildGraph() {
      let ForceGraph3D;
      if (window) {
        ForceGraph3D = require("3d-force-graph").default;
      } else {
        return;
      }
      this.el = document.querySelector(".connections-graph");
      const g = ForceGraph3D({
        rendererConfig: {
          antialias: true,
          powerPreference: "high-performance",
        },
      })(this.el);

      g.graphData(this.gData)
        .backgroundColor("rgba(0,0,0,0)")
        .linkColor(() => "rgb(0,0,0)")
        .linkOpacity(lineOpacity)
        .showNavInfo(false)
        .numDimensions(3)
        .cameraPosition({ x: 0, y: 0, z: distance })
        .width(window.innerWidth)
        .height(this.canvasHeight)
        .enableNodeDrag(false)
        .cooldownTicks(1000)
        .cooldownTime(5000)
        .onEngineStop(() => {
          console.log("onEngineStop!");
          //this.engineStoped = true;
        })
        // on mousedrag to navigate
        .cooldownTicks(100)
        .onNodeHover((node) => {
          return;
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
              l.__lineObj.material.opacity = lineOpacity;
            });
          }
          this.el.style.cursor = node ? "pointer" : null;
        })
        .onNodeClick(this.focusOnNode)
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
                // on load
                if (img.complete) {
                  // update to correct aspect ratio
                  const aspect = img.width / img.height;
                  node.__threeObj.children[0].scale.set(
                    IMAGE_SCALE * aspect,
                    IMAGE_SCALE
                  );
                } else {
                  img.onload = () => {
                    // update to correct aspect ratio
                    const aspect = img.width / img.height;
                    node.__threeObj.children[0].scale.set(
                      IMAGE_SCALE * aspect,
                      IMAGE_SCALE
                    );
                    //node.__threeObj.children[0].material.map.needsUpdate = true; // update texture
                  };
                }
              }
            }
          });
        });
      }, 10);
      window.addEventListener("resize", this.onWindowResize, false);
    },

    tagNode(node, group) {
      const sprite = new SpriteText(node.id);
      sprite.fontFace = "Libre Bodoni Italic";
      sprite.material.depthWrite = false; // make sprite background transparent
      //sprite.material.opacity = 1;
      sprite.backgroundColor = "white";
      sprite.padding = [0, 0];
      sprite.color = "black";
      sprite.textHeight = 1 * node.val;
      sprite.padding = 2;
      sprite.renderOrder = 999;
      sprite.material.depthTest = false;
      sprite.position.set(0, 1.6, 0);
      group.add(sprite);
      return group;
    },

    addProjectName(node, group) {
      const sprite = new SpriteText(node.id);
      sprite.fontFace = "Libre Bodoni Italic";
      // sprite.material.depthWrite = false; // make sprite background transparent
      //sprite.material.opacity = 1;
      sprite.backgroundColor = "white";
      sprite.padding = [0, 0];
      sprite.color = "black";
      sprite.textHeight = 2;
      sprite.padding = 2;
      sprite.renderOrder = 999;
      //sprite.material.depthTest = false;
      sprite.position.set(0, 20, 0);
      group.add(sprite);
      return group;
    },

    projectNode(node, group) {
      const imgTexture = new THREE.TextureLoader().load(node.thumbnail);
      imgTexture.colorSpace = THREE.SRGBColorSpace;
      const material = new THREE.SpriteMaterial({ map: imgTexture });
      const sprite = new THREE.Sprite(material);
      sprite.scale.set(1, 1);
      sprite.position.set(0, 0, 0);
      sprite.renderOrder = 999;
      //sprite.material.depthTest = false;
      group.add(sprite);
      // group = this.addProjectName(node, group);
      return group;
    },

    autoRotate() {
      // camera orbit
      this.angle = 0;
      this.interval = setInterval(() => {
        g.cameraPosition({
          x: distance * Math.sin(this.angle),
          z: distance * Math.cos(this.angle),
        });
        this.angle += Math.PI / 900;
      }, 10);
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
        n.__threeObj.children[0].material.opacity = 0.1;
      });

      // console.log("links", links);
      // hide links that are not connected to the node
      links.forEach((l) => {
        if (l.source.id !== node.id || l.target.id !== node.id) {
          l.__lineObj.material.opacity = 0.1;
        }
      });
    },

    focusOnNode(node) {
      if (node.type == "project") {
        // stop graph animation
        // this.g.pauseAnimation();
        let { nodes, links } = this.g.graphData();
        var node_el = nodes.find((n) => n.id === node.id);
        this.el.style.cursor = node ? "pointer" : null;
        var dist = CAMERA_DISTANCE;
        var offsetY = -10;
        const distRatio = 1 + dist / Math.hypot(node.x, node.y, node.z);
        var newPos =
          node.x || node.y || node.z
            ? {
                x: node.x * distRatio,
                y: node.y * distRatio,
                z: node.z * distRatio,
              }
            : { x: 0, y: 0, z: dist }; // special case if node is in (0,0,0)

        // midway between current position from node position
        newPos = {
          x: (node.x + this.g.cameraPosition().x) / 2,
          y: (node.y + this.g.cameraPosition().y) / 2,
          z: (node.z + this.g.cameraPosition().z) / 2,
        };

        var cameraPos = this.g.cameraPosition();

        // Calculate the direction vector from camera to new point
        const direction = new THREE.Vector3(
          node.x - cameraPos.x,
          node.y - cameraPos.y,
          node.z - cameraPos.z
        );

        // Normalize the direction vector (to get a unit vector)
        direction.normalize();

        // Calculate the new position that is 75 units distant from the new point
        const newPosition = new THREE.Vector3(
          node.x - direction.x * dist,
          node.y - direction.y * dist,
          node.z - direction.z * dist
        );

        console.log("distance", distance / CAMERA_DISTANCE);

        this.g.cameraPosition(
          newPosition, // new position
          { x: node.x, y: node.y, z: node.z }, // lookAt ({ x, y, z })
          2000 // ms transition duration
        );
        this.transition = true;

        this.g.enablePointerInteraction(false);
        this.openProject = true;
        setTimeout(() => {
          this.$emit("showProject", {
            id: node.id,
          });
          this.transition = false;
          // Assuming you have a camera and an object
          /*
          this.hideAllOtherElements(node);
          setTimeout(() => {
            node.__threeObj.children[0].material.opacity = 0;
          }, 100);
          */
        }, 2500);
      }
    },
    hideAllOtherElements(node) {
      let { nodes, links } = this.g.graphData();
      nodes.forEach((n) => {
        if (n.id !== node.id) {
          n.__threeObj.children[0].material.opacity = 0;
        }
      });
      links.forEach((l) => {
        l.__lineObj.material.opacity = 0;
      });
    },
    showAllElements() {
      this.g.cameraPosition(
        { x: 0, y: 0, z: distance },
        { x: 0, y: 0, z: 0 }, // lookAt ({ x, y, z })
        2000 // ms transition duration
      );
      //setTimeout(() => {
      this.$emit("backToInitialView");
      //}, 2000);
      this.g.enablePointerInteraction(true);
      let { nodes, links } = this.g.graphData();
      nodes.forEach((n) => {
        n.__threeObj.children[0].material.opacity = 1;
      });
      links.forEach((l) => {
        l.__lineObj.material.opacity = lineOpacity;
      });
    },

    onWindowResize() {
      this.canvasHeight = window.innerHeight + CANVAS_OUT_MARGIN;
      console.log("on Window Resize");
      this.g.width(window.innerWidth);
      this.g.height(this.canvasHeight);
    },
  },
};
</script>
  
<style global lang="postcss">
.connections-graph {
  position: fixed;
  top: -100px;
  left: 0;
  width: 100vw;
  height: calc(100vh + 200px);
  transition: opacity 0.25s ease-in-out, top 2s ease-in-out;
  transform: scale(1);
}

.no-interaction canvas,
.no-interaction .scene-container {
  pointer-events: none;
}
.no-interaction {
  top: -200px;
}

.hidden {
  opacity: 0;
  transform: scale(0.9);
}
</style>