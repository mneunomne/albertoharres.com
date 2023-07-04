<template>
  <div
    :class="{ hidden, 'no-interaction': transition || currentProject !== null }"
    class="connections-graph"
  >
    .
  </div>
</template>
  
<script>
// import d3ForceLimit from 'd3-force-limit'
import * as THREE from "three";
import SpriteText from "three-spritetext";

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
    currentProject: {
      type: Object,
      required: false,
    },
  },
  data() {
    return {
      g: null,
      hidden: true,
      angle: 0,
      transition: false,
      engineStoped: false,
    };
  },
  mounted() {
    if (!process.browser) {
      return;
    }
    process.nextTick(() => {
      this.buildGraph();
    });
    // listen to event on parent component
    this.$parent.$on("closeProject", () => {
      this.showAllElements();
    });
  },
  watch: {
    currentProject: {
      handler: function (val, oldVal) {
        if (val == null) {
          this.showAllElements();
          //this.focusOnNode(val);
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
        .height(window.innerHeight)
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
          if (this.transition || true) {
            return;
          }
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
      sprite.fontFace = "Libre Bodoni Italic";
      // sprite.material.depthWrite = false; // make sprite background transparent
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

    projectNode(node, group) {
      const imgTexture = new THREE.TextureLoader().load(node.thumbnail);
      imgTexture.colorSpace = THREE.SRGBColorSpace;
      const material = new THREE.SpriteMaterial({ map: imgTexture });
      const sprite = new THREE.Sprite(material);
      sprite.scale.set(1, 1);
      sprite.position.set(0, 0, 0);
      sprite.renderOrder = 9999;
      sprite.material.depthTest = false;
      group.add(sprite);
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
    },

    focusOnNode(node) {
      if (node.type == "project") {
        // stop graph animation
        // this.g.pauseAnimation();
        let { nodes, links } = this.g.graphData();
        var node_el = nodes.find((n) => n.id === node.id);
        this.el.style.cursor = node ? "pointer" : null;
        var dist = 75;
        var offsetY = -20;
        const distRatio = 1 + dist / Math.hypot(node.x, node.y, node.z);
        const newPos =
          node.x || node.y || node.z
            ? {
                x: node.x * distRatio,
                y: node.y * distRatio,
                z: node.z * distRatio,
              }
            : { x: 0, y: 0, z: dist }; // special case if node is in (0,0,0)

        this.g.cameraPosition(
          newPos, // new position
          { x: node.x, y: node.y, z: node.z }, // lookAt ({ x, y, z })
          2000 // ms transition duration
        );
        this.transition = true;
        // disable all graph interactions

        this.$emit("clickProject", {
          id: node.id,
        });
        this.g.enablePointerInteraction(false);
        setTimeout(() => {
          // this.$emit("clickProject", node.id);
          this.transition = false;
          // Assuming you have a camera and an object
          const camera = this.g.camera();
          const objectSize = 1; // Real-world size of the object in meters
          const distanceToObject = dist; // Distance from the camera to the object in meters

          // Get the focal length of the camera
          // const focalLength = camera.getFocalLength();

          var vFOV = (camera.fov * Math.PI) / 180;
          var height = 2 * Math.tan(vFOV / 2) * dist; // visible height

          var objectHeight = node_el.__threeObj.children[0].scale.y;

          var objectHeightOnScreen =
            (objectHeight / height) * window.innerHeight; // visible height

          var objectRatio =
            node_el.__threeObj.children[0].scale.x /
            node_el.__threeObj.children[0].scale.y;

          var objectWidthOnScreen = objectHeightOnScreen * objectRatio;

          this.$emit("showProject", {
            id: node.id,
            width: objectWidthOnScreen,
            height: objectHeightOnScreen,
          });

          /*
          this.hideAllOtherElements(node);
          setTimeout(() => {
            node.__threeObj.children[0].material.opacity = 0;
          }, 100);
          */

          console.log(
            "Object size on screen:",
            objectHeightOnScreen,
            objectWidthOnScreen
          );
        }, 2500);
      }
    },
    hideAllOtherElements(node) {
      let { nodes, links } = this.g.graphData();
      nodes.forEach((n) => {
        if (n.id !== node.id) {
          // n.__threeObj.visible = false;
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

.no-interaction canvas {
  pointer-events: none;
}

.hidden {
  opacity: 0;
  transform: scale(0.9);
}
</style>