<template>
  <div>
    <div class="menu-graph" :style="{ width: `${width}px`, height: `${height}px` }"
      :class="{ mobile: getIsMobile, show }"></div>
  </div>
</template>

<script>
import * as THREE from "three";
import SpriteText from "three-spritetext";
import { mapGetters } from "vuex";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";

export default {
  name: "MenuGraph",
  props: {
    gData: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      g: null,
      width: 250,
      height: 250,
      cameraDistance: 130,
      show: false,
      composer: null, // For post-processing
    };
  },

  created() {
    if (!process.browser) return
    window.addEventListener("resize", () => {
      this.computeWindowSize();
    });
  },
  mounted() {
    if (!process.browser) return;
    this.computeWindowSize();

    const fontFile = new FontFace(
      "Libre Bodoni Italic",
      "url(/fonts/Libre_Bodoni/static/LibreBodoni-Italic.ttf)",
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
      this.cameraDistance = 100;
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
      if (this.g) this.g.width(this.width).height(this.height);
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
        .numDimensions(2)
        .width(this.width)
        .height(this.height)
        .onNodeClick((node) => {
          if (gtag) gtag('event', 'click', {
            event_category: 'menu_graph_click',
            event_label: node.route
          });

          if (node.route.includes("http")) {
            window.open(node.route, "_blank");
            return;
          } else if (node.name == "mail") {
            var mail = document.createElement("a");
            mail.href = node.route;
            mail.click();
          } else {
            // gp home
            this.$router.push("/");
          }
        })
        .onNodeHover((node) => {
          nodes.forEach((node) => {
            node.__threeObj.children[0].backgroundColor = "white";
          });
        })
        .onNodeDrag((node, translate) => {
          node.fx = node.x;
          node.fy = node.y;
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
        this.g.renderer().setPixelRatio(window.devicePixelRatio);
        this.g.d3Force("link").distance(() => 40);
        this.g.cameraPosition({ x: 0, y: 0, z: this.cameraDistance });
        this.show = true;
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

      // Replace the render loop
      const animate = () => {
        requestAnimationFrame(animate);
        //this.g.tickFrame(); // Render graph animation
        composer.render();
      };
      animate();
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
