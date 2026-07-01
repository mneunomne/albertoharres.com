<template>
  <div>
    <div class="menu-graph" :style="{ width: `${width}px`, height: `${height}px` }"
      :class="{ mobile: getIsMobile, show }"></div>
  </div>
</template>

<script>
import * as THREE from "three";
import SpriteText from "three-spritetext";
import _ from "lodash";
import { mapGetters } from "vuex";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { bboxCollide } from "d3-bboxCollide";

export default {
  name: "MenuGraph",
  props: {
    gData: {
      type: Object,
      required: true,
    },
  },
  // Non-reactive: the graph instance holds Three.js objects (and the gData
  // nodes get __threeObj attached). Keeping it out of reactive `data()` stops
  // Vue from deep-walking the scene graph.
  static() {
    return {
      g: null,
    };
  },
  data() {
    return {
      width: 250,
      height: 250,
      cameraDistance: 130,
      show: false,
    };
  },

  created() {
    if (!process.browser) return;
    this._onResize = _.throttle(() => this.computeWindowSize(), 150);
    window.addEventListener("resize", this._onResize);
  },
  beforeDestroy() {
    if (!process.browser) return;
    if (this._idleTimer) clearTimeout(this._idleTimer);
    if (this._onResize) window.removeEventListener("resize", this._onResize);
    if (this.g) {
      this.g.pauseAnimation();
      if (this.g.renderer) this.g.renderer().dispose();
      this.g._destructor && this.g._destructor();
    }
  },
  mounted() {
    if (!process.browser) return;
    this.computeWindowSize();

    const fontFile = new FontFace(
      "Libre Bodoni Italic",
      "url(/fonts/Libre_Bodoni/static/LibreBodoni-Italic.ttf)"
    );
    fontFile.load().then((font) => {
      document.fonts.add(font);
      this.buildGraph();
      setTimeout(() => {
        this.canvasMask();
      }, 1000);
    });
    //document.fonts.add(fontFile);

    if (this.getIsMobile) {
      this.width = 150;
      this.height = 150;
      this.cameraDistance = 120;
    }
  },
  computed: {
    ...mapGetters({
      getIsMobile: "getIsMobile",
    }),
  },
  methods: {
    computeWindowSize() {
      this.width = 300;
      this.height = 300;
      this.cameraDistance = 170;

      if (window.innerWidth < 1200) {
        this.width = 180;
        this.height = 180;
        this.cameraDistance = 120;
      }
      if (window.innerWidth < 900) {
        this.width = 150;
        this.height = 150;
        this.cameraDistance = 100;
      }
      if (this.g) {
        this.g.width(this.width).height(this.height);
        this.wakeRender(600);
      }
    },
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

      // Detach from Vue reactivity (see ConnectionsGraph): the engine reads and
      // mutates these objects every frame, so hand it plain copies rather than
      // reactive proxies.
      const graphData = {
        nodes: this.gData.nodes.map((n) => ({ ...n })),
        links: this.gData.links.map((l) => ({ ...l })),
      };
      var nodes = graphData.nodes;
      g.graphData(graphData)
        .backgroundColor("rgba(0,0,0,0)")
        .showNavInfo(false)
        //.d3VelocityDecay(0.8)
        //.d3AlphaMin(0.1)
        //.d3AlphaDecay(0.1)
        .numDimensions(2)
        .width(this.width)
        .height(this.height)
        .onNodeClick((node) => {
          if (gtag)
            gtag("event", "click", {
              event_category: "menu_graph_click",
              event_label: node.route,
            });
          if (node.route.includes("/")) {
            this.$router.push({ path: node.route });
            return;
          } else {
            // gp home
            this.$router.push("/");
          }
        })
        .onNodeHover((node) => {
          // Only write backgroundColor when it actually changes — the setter
          // regenerates the sprite's canvas + GPU texture (three-spritetext).
          nodes.forEach((n) => {
            const label = n.__threeObj.children[0];
            if (label.backgroundColor !== "white") label.backgroundColor = "white";
          });
          this.wakeRender(600);
        })
        .onNodeDrag((node, translate) => {
          node.fx = node.x;
          node.fy = node.y;
          this.wakeRender(600);
        })
        .onNodeDragEnd((node) => {
          node.fx = null;
          node.fy = null;
        })
        .nodeLabel((node) => {
          return false;
        })
        .linkColor(() => "rgb(0,0,0)")
        .nodeThreeObject((node) => {
          const group = new THREE.Group();
          const sprite = new SpriteText(node.name);
          sprite.fontFace = "Libre Bodoni Italic";
          sprite.material.depthWrite = true; // make sprite background transparent
          sprite.material.opacity = 1;
          sprite.backgroundColor = "white";
          sprite.color = "black";
          sprite.textHeight = 10;
          sprite.padding = 2;
          sprite.renderOrder = 999;
          sprite.position.set(0, 1.6, 0);
          group.add(sprite);
          return group;
        });

      this.g = g;
      this.g.controls().noZoom = true;
      this.g.controls().noPan = true;
      this.g.controls().noRotate = true;

      process.nextTick(() => {
        this.g.renderer().setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        // Avoid the synchronous getProgramInfoLog / LINK_STATUS stall on every
        // shader compile (see ConnectionsGraph).
        this.g.renderer().debug.checkShaderErrors = false;
        this.g.d3Force("link").distance(() => 40);
        this.g.cameraPosition({ x: 0, y: 0, z: this.cameraDistance });
        this.show = true;
        this.g.d3Force(
          "colide",
          bboxCollide((node) => {
            if (node.route == "/") {
              return [
                [-50, -10],
                [50, 10],
              ];
            } else {
              return [
                [-10, -10],
                [10, 10],
              ];
            }
          })
        );
      });
    },

    canvasMask() {
      if (!this.g) return;

      // Custom radial gradient shader
      const radialGradientShader = {
        uniforms: {
          tDiffuse: { value: null },
          resolution: { value: new THREE.Vector2(this.width, this.height) },
          center: { value: new THREE.Vector2(0.5, 0.5) },
          radius: { value: 0.6 }, // Radius of the gradient
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform sampler2D tDiffuse;
          uniform vec2 center;
          uniform float radius;
          varying vec2 vUv;

          void main() {
            vec4 texColor = texture2D(tDiffuse, vUv);
            float dist = distance(vUv, center);
            float mask = smoothstep(radius, radius - 0.3, dist);

            // Apply mask to the alpha channel to fade to transparent
            gl_FragColor = vec4(texColor.rgb, texColor.a * mask);
          }
        `,
      };

      // Add the radial fade to the graph's own post-processing composer. The
      // library already wired a RenderPass into it and drives it through its
      // animation loop, so EffectComposer routes this (the last pass) to the
      // screen. Building a second composer on the same renderer is what caused
      // the "Maximum call stack size exceeded" texture recursion.
      const radialGradientPass = new ShaderPass(radialGradientShader);
      this.g.postProcessingComposer().addPass(radialGradientPass);

      // Idle by default; the library's perpetual render loop stays paused until
      // something needs to be drawn (settle, hover, drag, resize).
      this.g.pauseAnimation();
      this.wakeRender(2500); // render the initial layout settle
    },

    // Run the library's render loop for `ms` after the latest request, then
    // pause it again. Its loop advances the force layout (tickFrame) and renders
    // through the composer, so nothing keeps drawing once the menu is static.
    wakeRender(ms = 1200) {
      if (!this.g) return;
      this.g.resumeAnimation(); // idempotent: only restarts if paused
      if (this._idleTimer) clearTimeout(this._idleTimer);
      this._idleTimer = setTimeout(() => {
        this._idleTimer = null;
        if (this.g) this.g.pauseAnimation();
      }, ms);
    },
  },
  watch: {
    getIsMobile(isMobile) {
      if (this.g) {
        if (isMobile) {
          this.width = 150;
          this.height = 150;
          this.g.cameraPosition({ x: 0, y: 0, z: 120 });
        } else {
          this.width = 250;
          this.height = 250;
          this.g.cameraPosition({ x: 0, y: 0, z: 150 });
        }
        this.g.width(this.width).height(this.height);
        this.wakeRender(600);
      }
    },
  },
};
</script>

<style global lang="scss">
.menu-graph .scene-tooltip {
  // Unused tooltip; repositioned via getBoundingClientRect on every pointermove.
  display: none !important;
}

.menu-graph {
  mix-blend-mode: darken;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.25s;
  position: fixed;
  top: 0;
  margin: 0px;
  width: 250px;
  height: 250px;
  z-index: 2;

  &.mobile {
    z-index: 1;
  }

  &.show {
    opacity: 1;
    pointer-events: all;
  }
}

@media (max-width: 1200px) {
  .menu-graph {
    z-index: 1;
  }
}
</style>
