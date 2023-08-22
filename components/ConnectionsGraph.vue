<template>
  <div>
    <div
      v-show="currentFilter !== null"
      class="remove-filter close"
      @click="showAllElements"
    >
      <button>{{ currentFilter }}</button>
    </div>
    <div
      :class="{ hidden, 'no-interaction': openProject }"
      class="connections-graph"
      :style="{
        top: `-${openProject ? canvasMargin + contentMargin : canvasMargin}px`,
        height: `calc(${canvasHeight}px)`,
      }"
    >
      .
    </div>
  </div>
</template>
  
<script>
// import d3ForceLimit from 'd3-force-limit'
import * as THREE from "three";
import SpriteText from "three-spritetext";

import { mapGetters } from "vuex";

import {
  CAMERA_FOV,
  IMAGE_SCALE,
  CANVAS_OUT_MARGIN,
  CAMERA_DISTANCE,
  MOBILE_CAMERA_DISTANCE,
  getContentMargin,
  getCanvasHeight,
  CAMERA_ANIMATION_DURATION,
} from "~/utils";

const fontSize = 6;
const far_distance = 500;
const lineOpacity = 0.1;

export default {
  name: "ConnectionsGraph",
  computed: {
    ...mapGetters({
      getCurrentProject: "getCurrentProject",
      getIsMobile: "getIsMobile",
    }),
  },
  props: {
    gData: {
      type: Object,
      required: true,
      el: null,
    },
  },
  static() {
    return {
      g: null,
      fullGraphData: null,
    };
  },
  data() {
    return {
      hidden: true,
      angle: 0,
      transition: false,
      engineStoped: false,
      canvasHeight: 0,
      openProject: false,
      contentMargin: 0,
      canvasMargin: CANVAS_OUT_MARGIN,
      currentNode: null,
      currentFilter: null,
      allNodes: null,
      allLinks: null,
    };
  },
  created() {
    // check if starting route is project
  },
  mounted() {
    this.canvasMargin = 0;
    if (!process.browser) {
      return;
    }
    console.log("CANVAS_OUT_MARGIN", CANVAS_OUT_MARGIN);
    // set values
    this.canvasMargin = CANVAS_OUT_MARGIN;
    this.contentMargin = getContentMargin(window);
    this.canvasHeight = getCanvasHeight(window);

    // TODO, add states to store to indicate a project is open
    // AND add a watcher to watch for changes in currentProject
    // if router is on project page, hide graph

    this.buildGraph();
    process.nextTick(() => {
      if (this.$route.name == "works-work") {
        this.setCurrentOpenNode();
      }
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
      this.el = document.querySelector(".connections-graph");
      const g = ForceGraph3D({
        rendererConfig: {
          antialias: true,
          powerPreference: "high-performance",
        },
      })(this.el);
      this.allNodes = [...this.gData.nodes];
      this.allLinks = [...this.gData.links];
      g.graphData(this.gData)
        .backgroundColor("rgba(0,0,0,0)")
        .linkColor(() => "rgb(0,0,0)")
        .linkOpacity(lineOpacity)
        .showNavInfo(false)
        .numDimensions(3)
        .cameraPosition({ x: 0, y: 0, z: far_distance })
        .width(window.innerWidth)
        .height(this.canvasHeight)
        .enableNodeDrag(false)
        //.cooldownTicks(1000)
        //.warmupTicks(100)
        .cooldownTime(1000)
        // on mousedrag to navigate
        .cooldownTicks(100)
        .onNodeHover(this.onNodeHover)
        .onNodeClick(this.onNodeClick)
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
        console.log("onEngineStop");
        this.hidden = false;
        //cameraPosition([{x,y,z}], [lookAt], [ms])
        //this.g.cameraPosition({ x: 0, y: 0, z: 400 }, 0, 1000);
      });

      setTimeout(() => {
        process.nextTick(() => {
          this.setInitialView();
        });
      }, 10);
      window.addEventListener("resize", this.onWindowResize, false);
    },

    setInitialView() {
      this.g.d3Force("link").distance((link) => 50);
      this.g.cameraPosition({ x: 0, y: 0, z: far_distance }, 0, 1000);
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
    },

    tagNode(node, group) {
      const sprite = new SpriteText(node.id);
      sprite.fontFace = "Libre Bodoni Italic";
      //sprite.material.opacity = 1;
      sprite.backgroundColor = "white";
      sprite.padding = [0, 0];
      sprite.color = "black";
      sprite.textHeight = 1 * node.val;
      sprite.padding = 2;
      sprite.renderOrder = 990;
      // sprite.material.depthWrite = true; // make sprite background transparent
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
      sprite.renderOrder = 995;
      sprite.material.depthTest = false;
      group.add(sprite);
      return group;
    },

    autoRotate() {
      // camera orbit
      this.angle = 0;
      this.interval = setInterval(() => {
        g.cameraPosition({
          x: far_distance * Math.sin(this.angle),
          z: far_distance * Math.cos(this.angle),
        });
        this.angle += Math.PI / 900;
      }, 10);
    },
    filterNodes(node) {
      this.currentFilter = node.id;

      let { nodes, links } = this.g.graphData();
      links = links.filter((l) => l.source === node || l.target === node);

      var hidden_nodes = nodes.filter((n) => {
        return (
          n.id !== node.id &&
          !links.some((l) => l.source.id === n.id || l.target.id === n.id)
        );
      });

      hidden_nodes.forEach((n) => {
        // n.__threeObj.children[0].material.opacity = 0.1;
        nodes.splice(nodes.indexOf(n), 1);
      });

      // console.log("links", links);
      // hide links that are not connected to the node
      links.forEach((l) => {
        if (l.source.id !== node.id || l.target.id !== node.id) {
          // l.__lineObj.material.opacity = 0.1;
        }
      });

      this.g.graphData({ nodes, links });
      this.g.d3Force("link").distance((link) => 50);

      // make camera fit to new nodes
      // next tick
      //
      console.log("zoomToFit!");
      process.nextTick(() => {
        setTimeout(() => {
          this.g.zoomToFit(1000, 200);
        }, 10);
      });
    },

    onNodeClick(node) {
      if (node.type == "tag") {
        this.filterNodes(node);
        return;
      }
      if (node.type !== "project") {
        return;
      }

      this.currentNode = node;

      // this.el.style.cursor = node ? "pointer" : null;

      console.log("this.getIsMobile", this.getIsMobile);

      var dist = this.getIsMobile ? MOBILE_CAMERA_DISTANCE : CAMERA_DISTANCE;

      var cameraPos = this.g.cameraPosition();

      // Calculate the direction vector from camera to new point
      this.direction = new THREE.Vector3(
        node.x - cameraPos.x,
        node.y - cameraPos.y,
        node.z - cameraPos.z
      );

      // Normalize the direction vector (to get a unit vector)
      this.direction.normalize();

      // Calculate the new position that is 75 units distant from the new point
      const newPosition = new THREE.Vector3(
        node.x - this.direction.x * dist,
        node.y - this.direction.y * dist,
        node.z - this.direction.z * dist
      );

      this.g.cameraPosition(
        newPosition, // new position
        { x: node.x, y: node.y, z: node.z }, // lookAt ({ x, y, z })
        CAMERA_ANIMATION_DURATION // ms transition duration
      );

      this.transition = true;
      this.g.enablePointerInteraction(false);
      this.openProject = true;

      this.$emit("clickProject", {
        id: node.id,
      });

      setTimeout(() => {
        this.transition = false;
        setTimeout(() => {
          node.__threeObj.children[0].material.opacity = 0;
          this.g.pauseAnimation();
        }, 100);
      }, CAMERA_ANIMATION_DURATION + 500);
    },

    onNodeHover(node) {
      // make current node renderOrder higher
      if (node && node.type) {
        let { nodes } = this.g.graphData();
        nodes.forEach((n) => {
          n.__threeObj.children[0].renderOrder =
            node?.type == "project" ? 995 : 990;
        });
        node.__threeObj.children[0].renderOrder = 999;
        if (node.type == "project") {
          //this.el.style.cursor = "pointer";
          this.$emit("hoverProject", {
            imgUrl: node.thumbnail,
          });
        }
      } else {
        // reset
        let { nodes } = this.g.graphData();
        nodes.forEach((n) => {
          n.__threeObj.children[0].renderOrder =
            node?.type == "project" ? 995 : 990;
        });
      }
    },

    onCloseProject() {
      console.log("getCurrentProject", this.getCurrentProject);
      this.openProject = false;
      var node = this.currentNode;

      this.g.resumeAnimation();

      // reset camera position
      var cameraPos = this.g.cameraPosition();

      // Calculate the direction vector from camera to new point
      var direction = new THREE.Vector3(
        node.x - cameraPos.x,
        node.y - cameraPos.y,
        node.z - cameraPos.z
      );

      var dist = far_distance;

      // Normalize the direction vector (to get a unit vector)
      direction.normalize();

      // Calculate the new position that is 75 units distant from the new point
      const newPosition = new THREE.Vector3(
        node.x - direction.x * dist,
        node.y - direction.y * dist,
        node.z - direction.z * dist
      );

      this.g.cameraPosition(
        newPosition,
        { x: node.x, y: node.y, z: node.z }, // lookAt ({ x, y, z })
        CAMERA_ANIMATION_DURATION // ms transition duration
      );

      let { nodes } = this.g.graphData();
      nodes.forEach((n) => {
        n.__threeObj.children[0].material.opacity = 1;
      });

      this.openProject = false;
      this.g.enablePointerInteraction(true);
      this.$emit("backToInitialView");
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
      this.currentFilter = null;
      this.$emit("backToInitialView");
      this.g.enablePointerInteraction(true);
      this.g.graphData({
        nodes: [...this.allNodes],
        links: [...this.allLinks],
      });
      setTimeout(() => {
        process.nextTick(() => {
          this.setInitialView();
        });
      }, 1);
    },

    setCurrentOpenNode() {
      console.log("setCurrentOpenNode", this.getCurrentProject);
      this.openProject = true;
      let { nodes, links } = this.g.graphData();
      nodes.forEach((n) => {
        if (n.id == this.getCurrentProject.slug) {
          this.currentNode = n;
        }
      });
    },

    onWindowResize() {
      this.contentMargin = getContentMargin(window);
      this.canvasHeight = getCanvasHeight(window);
      this.g.width(window.innerWidth);
      this.g.height(this.canvasHeight);
    },
  },
  watch: {
    // route change
    $route(to, from) {
      if (from.name == "works-work" && to.name == "works") {
        this.onCloseProject();
      }
    },
    getCurrentProject(newVal, oldVal) {
      if (this.getCurrentProject) {
        this.setCurrentOpenNode();
      }
    },
  },
};
</script>
  
<style global lang="scss">
.connections-graph {
  position: fixed;
  left: 0;
  width: 100vw;
  transition: opacity 0.25s ease-in-out, top 2s ease-in-out,
    filter 2s ease-in-out;
  transform: scale(1);
  filter: blur(0px);
}

.no-interaction canvas,
.no-interaction .scene-container {
  pointer-events: none;
}
.no-interaction {
  filter: blur(0px);
}

.hidden {
  opacity: 0;
  transform: scale(0.9);
}

.remove-filter {
  z-index: 1;
  position: absolute;
  left: 50%;
  top: 100px;
  transform: translate(-50%, -50%);
  pointer-events: all;
}

.remove-filter button {
  padding-left: 28px;
  font-family: "Libre Bodoni Italic";
  font-size: 18px;
  line-height: 20px;
  color: black;
}
</style>