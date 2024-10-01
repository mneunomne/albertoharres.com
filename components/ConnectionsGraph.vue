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

import _ from "lodash";

import {
  IMAGE_SCALE,
  CANVAS_OUT_MARGIN,
  CAMERA_DISTANCE,
  getContentMargin,
  getCanvasHeight,
  CAMERA_ANIMATION_DURATION,
  getMobileCameraDistance,
  CAMERA_DISTANCE_FAR,
} from "~/utils";

const fontSize = 6;
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
      // for mouse move
      mouseX: 0, // Store the last mouse X position
      mouseY: 0, // Store the last mouse Y position
      inertiaX: 0, // Used for smooth movement
      inertiaY: 0, // Used for smooth movement
      animationFrameId: null, // Store the animation frame ID for canceling it
      azimuthalAngle: 0, // Horizontal rotation angle
      polarAngle: Math.PI / 2, // Vertical rotation angle (set to look at the center)
      radius: CAMERA_DISTANCE_FAR, // Fixed distance from the center
      dragTimeout: null,
      lastCameraPosition: { x: 0, y: 0, z: 0 },
      lastDirection: { x: 0, y: 0, z: 0 },
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
        .cameraPosition({ x: 0, y: 0, z: CAMERA_DISTANCE_FAR })
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

      this.lastCameraPosition = this.g.cameraPosition();

      let controls = g.controls();
      // orbit maxDistance
      controls.maxDistance = 1000;
      // min zoom
      controls.minDistance = 100;

      // Add event listeners to pause/resume animation on scene dragging
      controls.addEventListener("start", () => {
        this.stopAnimation(); // Stop the animation when dragging starts
      });

      controls.addEventListener("end", () => {
        if (this.openProject) {
          clearTimeout(this.dragTimeout);
          return;
        }
        // update position values
        if (this.dragTimeout) {
          clearTimeout(this.dragTimeout);
        }
        this.dragTimeout = setTimeout(() => {
          //this.startAnimation(); // Resume the animation when dragging ends
        }, 2000);
      });

      // on stop animation
      this.g.onEngineStop(() => {
        console.log("onEngineStop");
        this.hidden = false;
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
          window.addEventListener("mousemove", this.throttledMouseMove);
          setTimeout(() => {
            this.startAnimation();
          }, 1100);
        });
      }, 10);
      window.addEventListener("resize", this.onWindowResize, false);
    },

    setInitialView() {
      this.g.d3Force("link").distance((link) => 50);
      this.g.cameraPosition({ x: 0, y: 0, z: CAMERA_DISTANCE_FAR }, 0, 1000);

      const resizeImg = (img, node) => {
        // On desktop, the height is constant, while on mobile, the width is constant
        const aspect = img.width / img.height;
        node.__threeObj.children[0].scale.set(
          IMAGE_SCALE * (this.getIsMobile ? 1 : aspect),
          IMAGE_SCALE / (this.getIsMobile ? aspect : 1)
        );
      };

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
      //sprite.renderOrder = 10;
      //sprite.material.depthWrite = false;
      //sprite.material.depthTest = false;
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
      //sprite.renderOrder = -1;
      sprite.renderOrder = 10;
      //sprite.material.depthWrite = false;
      //sprite.material.depthTest = false;
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

      // stop animation
      this.stopAnimation();

      this.currentNode = node;

      let objectWidth = node.__threeObj.children[0].scale.x;
      let objectHeight = node.__threeObj.children[0].scale.y;

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

      this.lastCameraPosition = this.g.cameraPosition();

      this.lastDirection = { x: node.x, y: node.y, z: node.z };

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
      /*
      if (node && node.type) {
        let { nodes } = this.g.graphData();
        nodes.forEach((n) => {
          if (n.type == "project") {
            n.__threeObj.children[0].renderOrder = 10;
          }
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
      */
    },

    onCloseProject() {
      console.log("getCurrentProject", this.getCurrentProject);
      this.openProject = false;
      var node = this.currentNode;

      setTimeout(() => {
        this.startAnimation();
      }, 2000);

      this.g.resumeAnimation();

      // reset camera position
      var cameraPos = this.g.cameraPosition();

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

    // Throttle the mouse move event to trigger at most every 100ms
    throttledMouseMove: _.throttle(function (event) {
      // Calculate normalized mouse coordinates (-1 to 1)
      this.mouseX = -(event.clientX / window.innerWidth) * 2 + 1;
      this.mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
    }, 10),

    startAnimation() {
      console.log("startAnimation");
      const spherical = new THREE.Spherical();
      spherical.setFromVector3(this.g.cameraPosition());
      this.inertiaX = 0;
      this.inertiaY = 0;

      // Update the azimuthal and polar angles based on the current camera position
      this.azimuthalAngle = spherical.theta; // Horizontal rotation angle (azimuthal)
      this.polarAngle = spherical.phi; // Vertical rotation angle (polar)
      const animate = () => {
        if (this.openProject) return;
        //console.log("animate");
        // Damping factor for smoothness
        const dampingFactor = 0.5;
        this.inertiaX += (this.mouseX - this.inertiaX) * dampingFactor;
        this.inertiaY += (this.mouseY - this.inertiaY) * dampingFactor;

        // Adjust the azimuthal and polar angles based on inertia
        const angleFactor = 0.00075; // Control sensitivity
        this.azimuthalAngle += this.inertiaX * angleFactor;
        this.polarAngle = THREE.MathUtils.clamp(
          this.polarAngle + this.inertiaY * angleFactor,
          0.1, // Prevent looking directly above/below
          Math.PI - 0.1
        );

        // distance from lastCameraPosition to lastDirectoin
        const dist = Math.sqrt(
          Math.pow(this.lastDirection.x - this.lastCameraPosition.x, 2) +
            Math.pow(this.lastDirection.y - this.lastCameraPosition.y, 2) +
            Math.pow(this.lastDirection.z - this.lastCameraPosition.z, 2)
        );

        // Calculate the new camera position using spherical coordinates
        const x =
          dist * Math.sin(this.polarAngle) * Math.sin(this.azimuthalAngle);
        const y = dist * Math.cos(this.polarAngle);
        const z =
          dist * Math.sin(this.polarAngle) * Math.cos(this.azimuthalAngle);

        // Set the camera position while keeping it at the same radius (distance from the center)
        this.g.cameraPosition({ x, y, z }, this.lastDirection); // Keep looking at the center

        // Call the animate function on the next frame
        this.animationFrameId = requestAnimationFrame(animate);
      };

      animate(); // Start the animation loop
    },

    // Call this method if you want to stop the animation (for cleanup, etc.)
    stopAnimation() {
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
      }
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
      console.log("route change", to.name, from.name);
      if (
        from.name == "works-work" &&
        (to.name == "works" || to.name == "index")
      ) {
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