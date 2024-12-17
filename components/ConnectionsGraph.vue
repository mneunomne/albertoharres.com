<template>
  <div>
    <div v-show="currentFilter !== null" class="remove-filter close" @click="showAllElements">
      <button>{{ currentFilter }}</button>
    </div>
    <div class="view-mode">
      <span @click="gridMode = true" class="grid-mode" :class="{ active: gridMode }">grid</span> /
      <span @click="gridMode = false" class="grid-mode" :class="{ active: !gridMode }">network</span>
    </div>
    <div :class="{ hidden, 'no-interaction': openProject }" class="connections-graph" :style="{
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
  getVisibleHeight
} from "~/utils";

const LINE_OPACITY = 0.1;

const LINK_DISTANCE = 40;

// desktop values
const GRID_MARGIN = 20
const TOP_MARGIN = 40
const LEFT_MARGIN = 20
const BOTTOM_MARGIN = 40
const RIGHT_MARGIN = 20
const BLANK_SPACE_RATIO = 0.70

// mobile values
const GRID_MARGIN_MOBILE = 5
const TOP_MARGIN_MOBILE = 30
const LEFT_MARGIN_MOBILE = 10
const BOTTOM_MARGIN_MOBILE = 20
const RIGHT_MARGIN_MOBILE = 10
const BLANK_SPACE_RATIO_MOBILE = 0.35

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
      gridMode: false
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

    // set values
    this.canvasMargin = CANVAS_OUT_MARGIN;
    this.contentMargin = getContentMargin(window);
    this.canvasHeight = getCanvasHeight(window);

    this.buildGraph();

    process.nextTick(() => {
      if (this.$route.name == "works-work") {
        // get current project
        let { nodes } = this.g.graphData();
        nodes.forEach((n) => {
          if (n.id == this.$route.params.work) {
            this.onNodeClick(n);
          }
        });
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
        controlType: 'orbit',
      })(this.el);
      this.allNodes = [...this.gData.nodes];
      this.allLinks = [...this.gData.links];
      g.graphData(this.gData)
        .backgroundColor("rgba(0,0,0,0)")
        .linkColor(() => "rgb(0,0,0)")
        .linkOpacity(LINE_OPACITY)
        .showNavInfo(false)
        .numDimensions(3)
        .cameraPosition({ x: 0, y: 0, z: CAMERA_DISTANCE_FAR })
        .width(window.innerWidth)
        .height(this.canvasHeight)
        .enableNodeDrag(false)
        .cooldownTime(Infinity)
        .cooldownTicks(Infinity)
        .d3VelocityDecay(0.4)
        .d3AlphaMin(0.0)
        .d3AlphaDecay(0.0228)
        .onNodeClick(this.onNodeClick)
        .onNodeHover((node) => {
          if (!node) {
            this.el.style.cursor = null;
          } else {
            this.el.style.cursor = "pointer";
          }
        })
        .nodeLabel((node) => {
          console.log("node", node)
          let title = node[`title_${this.$i18n.locale}`];
          return `<div class="project-title">${title}</div>`;
        })
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
        // enter transition
        this.g.cameraPosition(
          { x: 0, y: 0, z: CAMERA_DISTANCE_FAR + 10 },
          0,
          1000
        );
      });

      setTimeout(() => {
        process.nextTick(() => {
          this.setInitialView();
        });
      }, 10);
      window.addEventListener("resize", this.onWindowResize, false);
    },

    setInitialView() {
      this.g.d3Force("link").distance((link) => LINK_DISTANCE);
      this.g.cameraPosition({ x: 0, y: 0, z: CAMERA_DISTANCE_FAR }, 0, 1000);
      let project_nodes = this.g.graphData().nodes.filter((n) => n.type == "project");

      const resizeImg = (img, node) => {
        this.imageLoaded++;
        console.log("imageLoaded", this.imageLoaded)
        if (this.imageLoaded == project_nodes.length) {
          allImagesLoaded();
        }
        let importance = 1// node.importance; // need to check this later because of the camera distance calculation
        // On desktop, the height is constant, while on mobile, the width is constant
        const aspect = img.width / img.height;
        const w = importance * IMAGE_SCALE * (this.getIsMobile ? 1 : aspect);
        const h = importance * IMAGE_SCALE / (this.getIsMobile ? aspect : 1);
        node.__threeObj.children[0].scale.set(w, h);
        let margin = 1
        node.bbox = [
          [-w / 2 - margin, -h / 2 - margin],
          [w / 2 + margin, h / 2 + margin],
        ];
      };
      this.imageLoaded = 0;
      // set image sizes...
      this.g.graphData().nodes.forEach((node) => {
        if (node.type == "project") {
          if (node.__threeObj) {
            const img = document.createElement("img");
            img.src = node.thumbnail;
            // on load
            if (img.complete) {
              resizeImg(img, node);
            } else {
              img.onload = () => {
                resizeImg(img, node);
              };
            }
          }
        }
      });
      const allImagesLoaded = () => {
        console.log("allImagesLoaded")
        this.hidden = false;
      };
    },

    tagNode(node, group) {
      const sprite = new SpriteText(node.id);
      sprite.fontFace = "Libre Bodoni Italic";
      sprite.backgroundColor = "white";
      sprite.padding = [0, 0];
      sprite.color = "black";
      sprite.textHeight = 1 * node.val;
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
      group.add(sprite);
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
      this.g.d3Force("link").distance((link) => LINK_DISTANCE);

      // make camera fit to new nodes
      // next tick
      //

    },

    onNodeClick(node) {
      console.log("onNodeClick", node);
      if (node.type == "tag") {
        this.filterNodes(node);
        return;
      }
      if (node.type !== "project") {
        return;
      }

      this.currentNode = node;

      var dist = this.getIsMobile ? CAMERA_DISTANCE_FAR - 50 : CAMERA_DISTANCE;

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

    onCloseProject() {
      console.log("getCurrentProject", this.getCurrentProject, node);
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
          { x: node.x, y: node.y, z: node.z }, // lookAt ({ x, y, z })
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

      // update debug background plane size 
      var h = getVisibleHeight(window) - TOP_MARGIN - BOTTOM_MARGIN
      var w = h * window.innerWidth / window.innerHeight - LEFT_MARGIN - RIGHT_MARGIN
      var plane = this.g.scene().children.filter((child) => child.name == "limit-plane")[0]
      if (plane) {
        plane.geometry = new THREE.PlaneGeometry(w, h, 32);
      }

    },
    organizeGraphInGrid() {
      let project_nodes = this.g.graphData().nodes.filter((n) => n.type == "project");

      // remove all linaks
      this.g.graphData({
        nodes: project_nodes,
        links: [],
      }).cooldownTicks(Infinity)
        .cooldownTime(Infinity)
        .numDimensions(2)
        .d3VelocityDecay(0.8)
        .d3AlphaMin(0.0)
        .d3AlphaDecay(0.1)

      this.g.d3Force(
        'limit', this.limitWindow(project_nodes)
      ).d3Force("colide", bboxCollide((node) => {
        return node.bbox
      }))

      // add a plane to the backgroud to debug the limit area
      var h = getVisibleHeight(window) - TOP_MARGIN - BOTTOM_MARGIN
      var w = h * window.innerWidth / window.innerHeight - LEFT_MARGIN - RIGHT_MARGIN
      var geometry = new THREE.PlaneGeometry(w, h, 32);

      // fit =camera distance to plane
      this.g.cameraPosition({ x: 0, y: 0, z: 330 }, 0, 1000);

      var material = new THREE.MeshBasicMaterial({ color: 0xffff00, side: THREE.DoubleSide });
      // transparent material
      material.transparent = true;
      material.opacity = 0.0;

      var plane = new THREE.Mesh(geometry, material);
      plane.position.z = -10;
      plane.name = "limit-plane"
      // add id to plane
      // this.g.scene().add(plane);
      this.g.d3ReheatSimulation()
    },

    limitWindow(nodes) {
      let isMobile = this.getIsMobile
      var marginTop = isMobile ? TOP_MARGIN_MOBILE : TOP_MARGIN
      var marginLeft = isMobile ? LEFT_MARGIN_MOBILE : LEFT_MARGIN
      var marginBottom = isMobile ? BOTTOM_MARGIN_MOBILE : BOTTOM_MARGIN
      var marginRight = isMobile ? RIGHT_MARGIN_MOBILE : RIGHT_MARGIN
      // project correct window size based on camera distance and window.size

      return () => {
        var window_height = getVisibleHeight(window) - TOP_MARGIN - BOTTOM_MARGIN
        var window_width = window_height * window.innerWidth / window.innerHeight - LEFT_MARGIN - RIGHT_MARGIN

        nodes.forEach((node) => {
          // node.vx = 10
          // node.x =  (window.innerWidth / 4)
          const prevPos = { x: node.x, y: node.y };
          // const nextPos = {x: node.x + node.vx, y: node.y + node.vy};
          let topRight = [prevPos.x + node.bbox[1][0], prevPos.y + node.bbox[0][1]];
          let topLeft = [prevPos.x + node.bbox[0][0], prevPos.y + node.bbox[0][1]];
          let bottomRight = [prevPos.x + node.bbox[1][0], prevPos.y + node.bbox[1][1]];
          let bottomLeft = [prevPos.x + node.bbox[0][0], prevPos.y + node.bbox[1][1]];

          const prevCorners = [topRight, topLeft, bottomRight, bottomLeft].map((corner) => {
            corner[0] += window_width / 2;
            corner[1] += window_height / 2;
            return corner;
          })

          const nextCorner = prevCorners.map((corner) => {
            return [corner[0] + node.vx, corner[1] + node.vy]
          })

          const checkCorners = ((corners) => {
            var is_inside = true
            var diff_x = 0
            var diff_y = 0
            // top right
            if (corners[0][0] > window_width - marginRight) {
              // node.vx *= -1
              is_inside = false
              diff_x = corners[0][0] - (window_width - marginRight)
            }

            // top left
            if (corners[1][0] < marginLeft) {
              is_inside = false
              diff_x = corners[1][0] - marginLeft
            }

            // bottom right
            if (corners[2][1] > window_height - marginBottom) {
              is_inside = false
              diff_y = corners[2][1] - (window_height - marginBottom)
            }

            // top left
            if (corners[1][1] < marginTop) {
              is_inside = false
              diff_y = corners[1][1] - marginTop
            }
            return {
              is_inside,
              diff_x,
              diff_y,
            }
          })

          var checkPrev = checkCorners(prevCorners)

          //console.log("checkPrev", checkPrev)

          // only check next corners if prev are inside
          if (checkPrev.is_inside) {
            this.checkNext = checkCorners(nextCorner)
            // prev inside
            if (!this.checkNext.is_inside) {
              // but next outside
              node.vx *= -1
              node.vy *= -1
              //console.log("next outside!", node, node.vx, node.vy)
            }
          } else {
            // console.log("prev outside!", checkPrev)
            node.vx = -checkPrev.diff_x
            node.vy = -checkPrev.diff_y
          }
        });
      }
    },
  },
  watch: {
    gridMode(isGrid) {
      if (isGrid) {
        this.organizeGraphInGrid()
      } else {
        this.g.numDimensions(3);
        // disable limit force
        this.g.d3Force("limit", null)
        // disable colide
        this.g.d3Force("colide", null)
        this.g.graphData(this.gData)
        // camera far
        this.g.cameraPosition({ x: 0, y: 0, z: CAMERA_DISTANCE_FAR }, 0, 1000);
        // camera rotation
        console.log("camera", this.g.camera())
        var plane = this.g.scene().children.filter((child) => child.name == "limit-plane")[0]
        if (plane) {
          /// remove plane
          this.g.scene().remove(plane)
        }
        // reheata
        this.g.d3ReheatSimulation()
          .d3VelocityDecay(0.4)
          .d3AlphaMin(0.0)
          .d3AlphaDecay(0.0228)
      }
    },
    // route change
    $route(to, from) {
      let to_name = to.name.split("__")[0];
      let from_name = from.name.split("__")[0];
      console.log("route change", to_name, from_name);
      if (
        from_name == "works-work" &&
        (to_name == "works" || to_name == "index")
      ) {
        this.onCloseProject();
      }
      if (to.name == "works-work") {
        // this.setCurrentOpenNode();
        // find node from gData
        console.log("to.params.slug", to.params.work);
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
  font-size: 18px;
  line-height: 20px;
  color: black;
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

.view-mode {
  z-index: 1;
  position: absolute;
  left: 50%;
  bottom: 50px;
  transform: translate(-50%, -50%);
  pointer-events: all;
}

.view-mode .active {
  text-decoration: underline;
  cursor: default;
}

.view-mode :not(.active) {
  cursor: pointer;
  ;
}

.remove-filter button {
  padding-left: 28px;
  font-family: "Libre Bodoni Italic";
  font-size: 18px;
  line-height: 20px;
  color: black;
}
</style>