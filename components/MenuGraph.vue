<template>
  <div>
    <div ref="el" class="menu-graph" :style="{ width: `${width}px`, height: `${height}px` }"
      :class="{ mobile: getIsMobile, show }"></div>
  </div>
</template>

<script>
import * as THREE from "three";
import SpriteText from "~/utils/CrispSpriteText";
import _ from "lodash";
import { mapGetters } from "vuex";
import { bboxCollide } from "d3-bboxCollide";
import { whenTabVisible } from "~/utils";
import { otherLocale } from "~/utils/i18n";

// Per viewport tier: canvas side length, the camera distance that keeps the
// labels at a readable, consistent scale, and the link length that keeps the
// whole graph inside the un-faded part of a canvas that size. First match wins.
// The menu graph is only mounted from NAV_BAR_BREAKPOINT (1024px) up; smaller
// canvases than the last tier's cut the outer labels off.
const SIZE_TIERS = [
  { minWidth: 1200, size: 300, cameraDistance: 170, linkDistance: 40 },
  { minWidth: 0, size: 260, cameraDistance: 160, linkDistance: 36 },
];

// Declared in assets/css/_fonts.scss. The labels are rasterised onto canvases,
// so the face has to be resident before the first label is drawn.
const LABEL_FONT = "Libre Bodoni Italic";
const FONT_WAIT_MS = 3000;

const LABEL_HEIGHT = 10;

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
      width: SIZE_TIERS[0].size,
      height: SIZE_TIERS[0].size,
      cameraDistance: SIZE_TIERS[0].cameraDistance,
      linkDistance: SIZE_TIERS[0].linkDistance,
      show: false,
    };
  },
  computed: {
    ...mapGetters({
      getIsMobile: "getIsMobile",
      getLocale: "getLocale",
    }),
  },

  created() {
    if (!process.browser) return;
    this._onResize = _.throttle(() => this.applySize(), 150);
    window.addEventListener("resize", this._onResize);
  },
  mounted() {
    if (!process.browser) return;
    this.applySize();
    // Wait for the font and for the tab to be visible: in a background tab no
    // frame runs, so the layout cool-down would expire before the first one.
    this.whenFontReady()
      .then(() => whenTabVisible())
      .then(() => {
        if (!this._destroyed) this.buildGraph();
      });
  },
  beforeDestroy() {
    if (!process.browser) return;
    this._destroyed = true;
    clearTimeout(this._sleepTimer);
    if (this._onResize) window.removeEventListener("resize", this._onResize);
    if (this._el && this._onPointer) {
      ["pointermove", "pointerdown"].forEach((type) =>
        this._el.removeEventListener(type, this._onPointer)
      );
    }
    if (this.g) {
      this.g.pauseAnimation();
      if (this.g.renderer) this.g.renderer().dispose();
      this.g._destructor && this.g._destructor();
      this.g = null;
    }
  },

  methods: {
    // Resolves once the label font is usable (or after a short timeout, so a
    // missing font can never prevent the menu from appearing).
    whenFontReady() {
      if (!document.fonts || !document.fonts.load) return Promise.resolve();
      const load = document.fonts.load(`italic 90px "${LABEL_FONT}"`);
      const timeout = new Promise((resolve) => setTimeout(resolve, FONT_WAIT_MS));
      return Promise.race([load.catch(() => {}), timeout]);
    },

    sizeTier() {
      if (this.getIsMobile) return SIZE_TIERS[SIZE_TIERS.length - 1];
      const w = window.innerWidth;
      return SIZE_TIERS.find((tier) => w >= tier.minWidth);
    },

    // Single source of truth for the canvas size and camera distance; called on
    // mount, on resize and when the mobile flag flips.
    applySize() {
      const tier = this.sizeTier();
      const linkChanged = tier.linkDistance !== this.linkDistance;
      this.width = tier.size;
      this.height = tier.size;
      this.cameraDistance = tier.cameraDistance;
      this.linkDistance = tier.linkDistance;
      if (this.g) {
        this.g.width(this.width).height(this.height);
        this.g.cameraPosition({ x: 0, y: 0, z: this.cameraDistance });
        if (linkChanged) {
          this.g.d3Force("link").distance(() => this.linkDistance);
          this.g.d3ReheatSimulation();
        }
        this.wake(600);
      }
    },

    buildGraph() {
      const ForceGraph3D = require("3d-force-graph").default;
      const el = this.$refs.el;
      this._el = el;

      const g = ForceGraph3D({
        rendererConfig: {
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        },
      })(el);
      this.g = g;

      g.graphData(this.gData)
        .backgroundColor("rgba(0,0,0,0)")
        .showNavInfo(false)
        .numDimensions(2)
        .width(this.width)
        .height(this.height)
        // Settle the layout a little before the first frame so the menu never
        // pops in as an overlapping clump, then animate the rest.
        .warmupTicks(20)
        // Stop the simulation once it has effectively settled instead of
        // running it for the library's default 15s cooldown.
        .d3AlphaMin(0.01)
        .onEngineTick(() => {
          this._engineRunning = true;
        })
        .onEngineStop(() => {
          this._engineRunning = false;
          this.scheduleSleep(300);
        })
        .onNodeClick((node) => {
          if (node.type === "lang") {
            const locale = otherLocale(this.getLocale);
            if (typeof gtag === "function") {
              gtag("event", "click", {
                event_category: "menu_graph_click",
                event_label: `lang:${locale}`,
              });
            }
            this.$store.dispatch("setLocale", locale);
            return;
          }
          if (typeof gtag === "function") {
            gtag("event", "click", {
              event_category: "menu_graph_click",
              event_label: node.route,
            });
          }
          if (node.route && node.route.includes("/")) {
            this.$router.push({ path: node.route });
          } else {
            this.$router.push("/");
          }
        })
        // The library pins the node and reheats the simulation itself while
        // dragging; we only need to keep the frames coming.
        .onNodeDrag(() => this.wake(600))
        .nodeLabel(() => "")
        .linkColor(() => "rgb(0,0,0)")
        .nodeThreeObject((node) => this.makeLabel(node));

      g.d3Force("link").distance(() => this.linkDistance);
      g.d3Force(
        "collide",
        bboxCollide((node) =>
          node.route === "/"
            ? [
                [-50, -10],
                [50, 10],
              ]
            : [
                [-10, -10],
                [10, 10],
              ]
        )
      );

      const controls = g.controls();
      controls.noZoom = true;
      controls.noPan = true;
      controls.noRotate = true;

      g.renderer().setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      // Skip three's synchronous shader-link validation (a main-thread stall
      // per compile); no custom shaders here.
      g.renderer().debug.checkShaderErrors = false;
      g.cameraPosition({ x: 0, y: 0, z: this.cameraDistance });

      // Hover/click detection happens inside the render loop, so wake it on
      // any pointer activity (pointerdown covers taps, which may not move).
      this._onPointer = () => this.wake(800);
      ["pointermove", "pointerdown"].forEach((type) =>
        el.addEventListener(type, this._onPointer, { passive: true })
      );

      // The loop is already running; let it go until the layout settles.
      this._engineRunning = true;
      this.scheduleSleep(1000);
      this.show = true;
    },

    labelText(node) {
      return node.type === "lang" ? otherLocale(this.getLocale) : node.name;
    },

    makeLabel(node) {
      const sprite = new SpriteText(this.labelText(node), LABEL_HEIGHT, "black");
      sprite.fontFace = LABEL_FONT;
      sprite.backgroundColor = "white";
      sprite.padding = 2;
      sprite.material.depthWrite = true; // the white box hides the link ends
      sprite.renderOrder = 999;
      sprite.position.set(0, 1.6, 0);

      const group = new THREE.Group();
      group.add(sprite);
      return group;
    },

    // On-demand rendering: run the library's loop while something is
    // happening (layout settling, pointer over the menu, resize) and pause it
    // when idle so a static menu costs nothing.
    wake(idleMs = 800) {
      if (!this.g) return;
      this.g.resumeAnimation();
      this.scheduleSleep(idleMs);
    },
    scheduleSleep(ms) {
      clearTimeout(this._sleepTimer);
      this._sleepTimer = setTimeout(() => this.sleepIfIdle(), ms);
    },
    sleepIfIdle() {
      if (!this.g) return;
      if (this._engineRunning) {
        // Layout still moving: pausing now would freeze it mid-motion.
        this.scheduleSleep(250);
        return;
      }
      this.g.pauseAnimation();
    },
  },

  watch: {
    getIsMobile() {
      this.applySize();
    },
    // Swap the language switch's label ("pt" <-> "en") in place.
    getLocale() {
      if (!this.g) return;
      this.g.graphData().nodes.forEach((node) => {
        const sprite = node.type === "lang" && node.__threeObj && node.__threeObj.children[0];
        if (sprite) sprite.text = this.labelText(node);
      });
      this.wake(300);
    },
  },
};
</script>

<style global lang="scss">
// Unused library tooltip, repositioned on every pointermove.
.menu-graph .scene-tooltip {
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
  z-index: 2;

  // Radial fade towards the edges. Done in CSS rather than as a
  // post-processing pass: an extra pass forces the scene through a linear
  // render target and skips the renderer's sRGB output conversion, which made
  // every antialiased edge pixel darker and the labels look bold.
  // Fully opaque out to 70% of the half-side, smoothstep-like fade to the
  // corners (which sit at ~141%), so nodes stay readable on the small tiers.
  -webkit-mask-image: radial-gradient(
    circle closest-side,
    #000 70%,
    rgba(0, 0, 0, 0.84) 85%,
    rgba(0, 0, 0, 0.5) 100%,
    rgba(0, 0, 0, 0.16) 115%,
    transparent 130%
  );
  mask-image: radial-gradient(
    circle closest-side,
    #000 70%,
    rgba(0, 0, 0, 0.84) 85%,
    rgba(0, 0, 0, 0.5) 100%,
    rgba(0, 0, 0, 0.16) 115%,
    transparent 130%
  );

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
