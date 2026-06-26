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
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { bboxCollide } from "d3-bboxCollide";

export default {
  name: "MenuGraph",
  props: {
    gData: {
      type: Object,
      required: true,
    },
  },
  // Non-reactive: the graph instance and its post-processing composer hold
  // Three.js objects (and the gData nodes get __threeObj attached). Keeping
  // them out of reactive `data()` stops Vue from deep-walking the scene graph.
  static() {
    return {
      g: null,
      composer: null,
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
    if (this._rafId) cancelAnimationFrame(this._rafId);
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

      var nodes = this.gData.nodes;
      g.graphData(this.gData)
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
          nodes.forEach((node) => {
            node.__threeObj.children[0].backgroundColor = "white";
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
      // Access the Three.js components
      const renderer = this.g.renderer();
      const scene = this.g.scene();
      const camera = this.g.camera();

      // Set up post-processing
      const composer = new EffectComposer(renderer);
      const renderPass = new RenderPass(scene, camera);
      composer.addPass(renderPass);

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

      const radialGradientPass = new ShaderPass(radialGradientShader);
      composer.addPass(radialGradientPass);

      // Save composer for the render loop
      this.composer = composer;

      // Stop the library's own perpetual render loop; we drive rendering on
      // demand through the composer instead (avoids a second, always-on loop).
      this.g.pauseAnimation();
      this.wakeRender(2500); // render the initial layout settle
    },

    // Render a single frame: advance the layout, then run the post-processing
    // composer (which applies the radial fade mask).
    renderFrame() {
      if (!this.g || !this.composer) return;
      this.g.tickFrame();
      this.composer.render();
    },

    // Keep rendering for `ms` after the latest request, then stop. Cheap idle
    // state: no RAF scheduled once the menu is static and nothing interacts.
    wakeRender(ms = 1200) {
      this._renderUntil = (window.performance ? performance.now() : 0) + ms;
      if (this._rafId) return; // already looping
      const loop = () => {
        this.renderFrame();
        const now = window.performance ? performance.now() : this._renderUntil;
        if (now < this._renderUntil) {
          this._rafId = requestAnimationFrame(loop);
        } else {
          this._rafId = null;
        }
      };
      this._rafId = requestAnimationFrame(loop);
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
