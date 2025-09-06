<template>
  <div>
    <div v-show="currentFilter !== null" class="remove-filter close" @click="showAllElements">
      <button>{{ currentFilter }}</button>
    </div>
    <div class="loading" v-if="hidden">
      <span>loading</span><span class="dot">.</span><span class="dot">.</span><span class="dot">.</span>
    </div>

    <div :class="{
      hidden,
      'no-interaction': openProject,
      'hide-tooltip': openProject || transition,
    }" class="connections-graph" :style="{
      top: `-${openProject ? canvasMargin + contentMargin : canvasMargin}px`,
      height: `calc(${canvasHeight}px)`,
    }">
      .
    </div>
  </div>
</template>

<script>
// import d3ForceLimit from 'd3-force-limit'
import * as THREE from "three";
import SpriteText from "three-spritetext";

import _ from 'lodash';

// import d3-bboxCollide
import { bboxCollide } from "d3-bboxCollide";

import { mapGetters } from "vuex";

import {
  IMAGE_SCALE,
  CANVAS_OUT_MARGIN,
  CAMERA_DISTANCE,
  getContentMargin,
  getCanvasHeight,
  CAMERA_ANIMATION_DURATION,
  getMobileCameraDistance,
  CAMERA_DISTANCE_FAR,
  getVisibleHeight,
} from "~/utils";

const LINE_OPACITY = 0.1;

const LINK_DISTANCE = 50;

// desktop values
const GRID_MARGIN = 20;
const TOP_MARGIN = 20;
const LEFT_MARGIN = 5;
const BOTTOM_MARGIN = 20;
const RIGHT_MARGIN = 5;
const BLANK_SPACE_RATIO = 0.7;
const FRONT_MARGIN = 20;
const BACK_MARGIN = 20;
const PROJECT_MARGIN = 3;

// mobile values
const GRID_MARGIN_MOBILE = 5;
const TOP_MARGIN_MOBILE = 20;
const LEFT_MARGIN_MOBILE = 10;
const BOTTOM_MARGIN_MOBILE = 10;
const RIGHT_MARGIN_MOBILE = 10;
const BLANK_SPACE_RATIO_MOBILE = 0.35;
const FRONT_MARGIN_MOBILE = 2;
const BACK_MARGIN_MOBILE = 2;
const PROJECT_MARGIN_MOBILE = 1;

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
      graphData: null,
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
  mounted() {
    this.canvasMargin = 0;
    if (!process.browser) {
      return;
    }

    // set values
    this.canvasMargin = CANVAS_OUT_MARGIN;
    this.contentMargin = getContentMargin(window);
    this.canvasHeight = getCanvasHeight(window);

    process.nextTick(() => {
      const fontFile = new FontFace(
        "Libre Bodoni Italic",
        "url(/fonts/Libre_Bodoni/static/LibreBodoni-Italic.ttf)"
      );
      fontFile.load().then((font) => {
        document.fonts.add(font);
        this.buildGraph();
      }).catch((err) => {
        console.error("Error loading font", err);
      });
      setTimeout(() => {
        if (this.$route.name == "works-work") {
          // get current project
          let { nodes } = this.g.graphData();
          nodes.forEach((n) => {
            if (n.id == this.$route.params.work) {
              this.onNodeClick(n);
            }
          });
        }
      }, 10);
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
        controlType: "orbit",
      })(this.el);
      this.allNodes = [...this.gData.nodes];
      this.allLinks = [...this.gData.links];

      this.graphData = {
        nodes: [...this.gData.nodes],
        links: [...this.gData.links],
      };

      g.graphData(this.graphData)
        .backgroundColor("rgba(0,0,0,0)")
        .linkColor(() => "rgb(0,0,0)")
        .linkOpacity(LINE_OPACITY)
        .showNavInfo(false)
        .numDimensions(3)
        .cameraPosition({ x: 0, y: 0, z: CAMERA_DISTANCE_FAR })
        .width(window.innerWidth)
        .height(this.canvasHeight)
        .enableNodeDrag(false)
        .cooldownTime(2000)
        .cooldownTicks(Infinity)
        .d3VelocityDecay(0.71)    // Higher = faster settling 
        .d3AlphaMin(0.01)       // Higher = stops earlier 
        .d3AlphaDecay(0.04)      // Higher = faster cooldown
        .onNodeClick(this.onNodeClick)
        .onNodeHover(this.onNodeHover)
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
      });

      setTimeout(() => {
        process.nextTick(() => {
          this.setInitialView();
        });
      }, 1);
      window.addEventListener("resize", _.throttle(this.onWindowResize, 1000), false);
    },

    setInitialView() {
      this.g.d3Force("link").distance((link) => LINK_DISTANCE);
      this.g.cameraPosition({ x: 0, y: 0, z: CAMERA_DISTANCE_FAR }, 0, 1000);
      let project_nodes = this.g
        .graphData()
        .nodes.filter((n) => n.type == "project");

      // Set image sizes directly from node data
      this.g.graphData().nodes.forEach((node) => {
        if (node.type == "project" && node.__threeObj && node.width && node.height) {
          let importance = node.importance;
          const aspect = node.width / node.height;
          const w = importance * IMAGE_SCALE * (this.getIsMobile ? 1 : aspect);
          const h = (importance * IMAGE_SCALE) / (this.getIsMobile ? aspect : 1);
          node.__threeObj.children[1].scale.set(w, h);
          let margin = this.getIsMobile ? PROJECT_MARGIN_MOBILE : PROJECT_MARGIN;
          node.bbox = [
            [-w / 2 - margin, -h / 2 - margin],
            [w / 2 + margin, h / 2 + margin],
          ];
          // border
          node.__threeObj.children[2].scale.set(w, h);
        }
      });

      console.log('Images sized from node data')
      var h = getVisibleHeight(window) - TOP_MARGIN - BOTTOM_MARGIN;
      var w =
        (h * window.innerWidth) / window.innerHeight -
        LEFT_MARGIN -
        RIGHT_MARGIN;
      var geometry = new THREE.PlaneGeometry(w, h, 32);
      var material = new THREE.MeshBasicMaterial({
        color: 0xffff00,
        side: THREE.DoubleSide,
      });
      // transparent material
      material.transparent = true;
      material.opacity = 1;

      var plane = new THREE.Mesh(geometry, material);
      plane.position.z = -BACK_MARGIN - 1;
      plane.name = "limit-plane";
      this.g.d3Force("limit", this.limitWindow(project_nodes)).d3Force(
        "colide",
        bboxCollide((node) => {
          if (node.bbox) {
            return node.bbox;
          } else {
            return [
              [-2, -1],
              [2, 1],
            ];
          }
        })
      );
      this.hidden = false;
    },

    tagNode(node, group) {
      const sprite = new SpriteText(node.id);
      sprite.fontFace = "Libre Bodoni Italic";
      sprite.backgroundColor = "white";
      sprite.padding = [0, 0];
      sprite.color = "black";
      sprite.textHeight = 1 * (node.val / 2);
      sprite.padding = 2;
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
      sprite.renderOrder = 10;
      // add border
      const border = new THREE.Sprite(
        new THREE.SpriteMaterial({ color: 0xffffff })
      );
      border.scale.set(1, 1);
      border.position.set(0, 0, 0);
      border.renderOrder = 9;
      //make transparent
      // opacity 0
      border.material.opacity = 0;

      // add text with the project title
      const title = new SpriteText(node.title);
      title.fontFace = "Libre Bodoni Italic";
      title.backgroundColor = "white";
      title.padding = [0, 0];
      title.color = "black";
      title.textHeight = 1;
      title.padding = 2;
      title.renderOrder = 100;
      title.visible = false;
      //title.position.set(0, 0, 0);
      //title.scale.set(1, 1, 1);

      group.add(title);
      group.add(sprite);
      group.add(border);
      return group;
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
        nodes.splice(nodes.indexOf(n), 1);
      });

      // hide links that are not connected to the node
      links.forEach((l) => {
        if (l.source.id !== node.id || l.target.id !== node.id) {
          // l.__lineObj.material.opacity = 0.1;
        }
      });

      this.g.graphData({ nodes, links });
      this.g.d3Force("link").distance((link) => LINK_DISTANCE);
    },

    onNodeClick(node) {
      if (gtag) {
        gtag("event", "click", {
          event_category: "node_click",
          event_label: node.id,
        });
      }
      if (node.type == "tag") {
        if (!this.getIsMobile) this.filterNodes(node);
        return;
      }
      if (node.type !== "project") {
        return;
      }


      this.currentNode = node;
      this.openProject = true;

      this.$emit("clickProject", {
        id: node.id,
      });

      if (node.__threeObj) {
        node.__threeObj.children[0].renderOrder = 99;

        this.resetNodesStyle();
        // Calculate adjusted camera distance based on node importance
        const baseDist = this.getIsMobile ? CAMERA_DISTANCE_FAR - 50 : CAMERA_DISTANCE;
        const baseHeight = IMAGE_SCALE; // height when importance = 1
        const nodeHeight = node.importance * IMAGE_SCALE; // actual height of this node
        const adjustedDist = baseDist * (nodeHeight / baseHeight);

        var dist = adjustedDist;

        var cameraPos = this.g.cameraPosition();
        this.g.enablePointerInteraction(false);

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

        setTimeout(() => {
          this.transition = false;
          setTimeout(() => {
            node.__threeObj.children[0].material.opacity = 0;
            this.g.pauseAnimation();
          }, 100);
        }, CAMERA_ANIMATION_DURATION + 500);
      }
    },
    resetNodesStyle() {
      this.allNodes.forEach((_node) => {
        if (_node.type == "tag" && _node.__threeObj) {
          _node.__threeObj.children[0].backgroundColor = "white";
        }
        if (_node.type == "project" && _node.__threeObj) {
          _node.__threeObj.children[1].renderOrder = 10;
          _node.__threeObj.children[0].visible = false; // title
        }
      });
    },
    onNodeHover(node) {
      // stop animation
      this.resetNodesStyle();
      if (node) {
        this.g.pauseAnimation();
        if (node.type == "project") {
          //node.__threeObj.children[1].material.opacity = 1;
          node.__threeObj.children[1].renderOrder = 99;
          node.__threeObj.children[1].depthWrite = true;

          node.__threeObj.children[0].visible = true; // title
        }
        if (node.type == "tag") {
          node.__threeObj.children[0].backgroundColor =
            "rgba(255, 255, 255, 0)";
        }
      }
    },
    async onCloseProject() {
      this.openProject = false;
      var node = this.currentNode;

      this.g.resumeAnimation();

      // reset camera position
      var cameraPos = this.g.cameraPosition();

      if (node) {
        // Calculate the direction vector from camera to new point
        var direction = new THREE.Vector3(
          node.x - cameraPos.x,
          node.y - cameraPos.y,
          node.z - cameraPos.z
        );
        var dist = CAMERA_DISTANCE_FAR;

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
          { x: 0, y: 0, z: 0 }, // lookAt ({ x, y, z })
          CAMERA_ANIMATION_DURATION // ms transition duration
        );
      }

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
      this.openProject = true;
    },
    onWindowResize() {
      this.contentMargin = getContentMargin(window);
      this.canvasHeight = getCanvasHeight(window);
      this.g.width(window.innerWidth);
      this.g.height(this.canvasHeight);

      let marginRight = this.getIsMobile ? RIGHT_MARGIN_MOBILE : RIGHT_MARGIN;
      let marginLeft = this.getIsMobile ? LEFT_MARGIN_MOBILE : LEFT_MARGIN;
      let marginTop = this.getIsMobile ? TOP_MARGIN_MOBILE : TOP_MARGIN;
      let marginBottom = this.getIsMobile
        ? BOTTOM_MARGIN_MOBILE
        : BOTTOM_MARGIN;

      // update debug background plane size
      var h = getVisibleHeight(window) - marginTop - marginBottom;
      var w =
        (h * window.innerWidth) / window.innerHeight - marginLeft - marginRight;
      var plane = this.g
        .scene()
        .children.filter((child) => child.name == "limit-plane")[0];
      if (plane) {
        plane.geometry = new THREE.PlaneGeometry(w, h, 32);
      }
      // reheat
      this.g.d3ReheatSimulation();
    },
    // Cache these values and only recalculate when window resizes
    limitWindow(nodes) {
      // Calculate once and cache
      const isMobile = this.getIsMobile;
      const margins = {
        top: isMobile ? TOP_MARGIN_MOBILE : TOP_MARGIN,
        left: isMobile ? LEFT_MARGIN_MOBILE : LEFT_MARGIN,
        bottom: isMobile ? BOTTOM_MARGIN_MOBILE : BOTTOM_MARGIN,
        right: isMobile ? RIGHT_MARGIN_MOBILE : RIGHT_MARGIN,
        back: isMobile ? BACK_MARGIN_MOBILE : BACK_MARGIN,
        front: isMobile ? FRONT_MARGIN_MOBILE : FRONT_MARGIN,
      };

      const window_height = getVisibleHeight(window) - TOP_MARGIN - BOTTOM_MARGIN;
      const window_width = (window_height * window.innerWidth) / window.innerHeight - LEFT_MARGIN - RIGHT_MARGIN;

      // Pre-calculate boundaries
      const bounds = {
        xMax: window_width / 2 - margins.right,
        xMin: -window_width / 2 + margins.left,
        yMax: window_height / 2 - margins.top,
        yMin: -window_height / 2 + margins.bottom,
        zMax: margins.front,
        zMin: -margins.back,
      };

      return () => {
        // Use for loop for better performance than forEach
        for (let i = 0; i < nodes.length; i++) {
          const node = nodes[i];

          // Check current position first (simpler logic)
          if (node.x < bounds.xMin || node.x > bounds.xMax) {
            node.vx = node.x < bounds.xMin ? Math.abs(node.vx) : -Math.abs(node.vx);
          }

          if (node.y < bounds.yMin || node.y > bounds.yMax) {
            node.vy = node.y < bounds.yMin ? Math.abs(node.vy) : -Math.abs(node.vy);
          }

          if (node.z < bounds.zMin || node.z > bounds.zMax) {
            node.vz = node.z < bounds.zMin ? Math.abs(node.vz) : -Math.abs(node.vz);
            if (node.type === "pag" && node.z < bounds.zMin) {
              node.vz += 0.1;
            }
          }
        }
      };
    }
  },
  watch: {
    // route change
    $route(to, from) {
      let to_name = to.name.split("__")[0];
      let from_name = from.name.split("__")[0];
      if (
        from_name == "works-work" &&
        (to_name == "works" || to_name == "index" || to_name == "cv" || to_name == "bio")
      ) {
        this.onCloseProject();
      }
      if (to.name == "works-work") {
        // this.setCurrentOpenNode();
        // find node from gData
        let { nodes } = this.g.graphData();
        nodes.forEach((n) => {
          if (n.id == to.params.work) {
            this.onNodeClick(n);
          }
        });
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
.project-title {
  font-family: "Libre Bodoni Italic";
  font-size: 14px;
  line-height: 20px;
  color: black;
  display: inline-block;
  background-color: white;
  padding: 2px 5px;
  margin-top: 10px;
  margin-left: 20px;
}

.connections-graph.hide-tooltip {
  .project-title {
    display: none;
  }
}

.connections-graph {
  font-family: "Libre Bodoni Italic";
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
  opacity: 0 !important;
}

.connections-graph .hidden {
  transform: scale(0.9);
}

.loading {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 3;
  font-family: "Libre Bodoni Italic";
  font-size: 14px;
  line-height: 20px;
  color: black;
  display: flex;
  align-items: center;
}

.dot {
  opacity: 0;
  animation: dot-flash 1.5s infinite;
}

.dot:nth-child(2) {
  animation-delay: 0.2s;
}

.dot:nth-child(3) {
  animation-delay: 0.4s;
}

.dot:nth-child(4) {
  animation-delay: 0.6s;
}

@keyframes dot-flash {

  0%,
  20% {
    opacity: 0;
  }

  50% {
    opacity: 1;
  }

  100% {
    opacity: 0;
  }
}

.remove-filter {
  z-index: 1;
  position: absolute;
  left: 50%;
  top: 100px;
  transform: translate(-50%, -50%);
  pointer-events: all;
  color: black !important;
}

.view-mode {
  z-index: 1;
  position: absolute;
  left: 50%;
  bottom: 50px;
  transform: translate(-50%, -50%);
  pointer-events: all;
  background: white;
  padding: 2px 5px;
  transition: opacity 0.25s ease-in-out;
  opacity: 1;
}

.view-mode .active {
  text-decoration: underline;
}

.view-mode :not(.active) {
  cursor: pointer;
}

.remove-filter button {
  padding-left: 28px;
  font-family: "Libre Bodoni Italic";
  font-size: 18px;
  line-height: 20px;
  color: black;
}
</style>