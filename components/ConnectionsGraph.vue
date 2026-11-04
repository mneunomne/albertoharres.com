<template>
  <div>
    <div key="remove-filter" v-show="currentFilter !== null" class="remove-filter close" @click="showAllElements">
      <button>{{ currentFilter === null ? "" : $tag(currentFilter) }}</button>
    </div>
    <div key="loading" class="loading" v-if="hidden && !openProject">
      <span>{{ $t("loading") }}</span><span class="dot">.</span><span class="dot">.</span><span class="dot">.</span>
    </div>

    <!-- Every root sibling is keyed: the WebGL scene is mounted inside the
         graph div by the library, so Vue must never recycle that element for
         another sibling when the v-if ones (loading, spacer) toggle. -->
    <div key="graph" ref="graph" :class="{
      hidden,
      'no-interaction': openProject || textPageOpen,
      'hide-tooltip': openProject || transition || textPageOpen,
    }" class="connections-graph" :style="{
      top: `-${canvasMargin}px`,
      // Shift via transform (compositor-only) instead of animating `top`,
      // which forced a layout on every frame of the 2s camera tween.
      transform: `translate3d(0, ${openProject ? -contentMargin : 0}px, 0)`,
      height: `calc(${canvasHeight}px)`,
    }">
      .
    </div>

    <!-- 3d graph <-> 2d grid toggle -->
    <div key="view-mode" class="view-mode" v-show="!hidden && !openProject && !textPageOpen && currentFilter === null">
      <span :class="{ active: getViewMode === '3d' }" @click="setView('3d')">3d</span>
      /
      <span :class="{ active: getViewMode === '2d' }" @click="setView('2d')">2d</span>
    </div>

    <!-- In 2d the grid is taller than the viewport: this spacer gives the
         document the grid's height so native scrolling drives the camera. -->
    <div key="grid-scroll-spacer" v-if="gridScrollHeight > 0 && !openProject" class="grid-scroll-spacer"
      :style="{ height: `${gridScrollHeight}px` }"></div>
  </div>
</template>

<script>
// import d3ForceLimit from 'd3-force-limit'
import * as THREE from "three";
import SpriteText from "~/utils/CrispSpriteText";

import _ from 'lodash';

// import d3-bboxCollide
import { bboxCollide } from "d3-bboxCollide";

import { mapGetters, mapActions } from "vuex";
import { localized, tagLabel } from "~/utils/i18n";

// Cancel the force-graph renderer's in-flight camera tweens (it animates
// `cameraPosition(..., duration)` through this same TWEEN singleton), so a
// morph never fights one. Required lazily: like 3d-force-graph, the package
// is browser-only and must stay out of the SSR bundle.
function isTextPageRoute(route) {
  const name = route && route.name ? route.name.split("__")[0] : "";
  return name == "bio" || name == "cv";
}

function cancelCameraTweens() {
  if (!process.browser) return;
  const T = require("@tweenjs/tween.js");
  const removeAll = T.removeAll || (T.default && T.default.removeAll);
  if (removeAll) removeAll();
}

import {
  IMAGE_SCALE,
  CANVAS_OUT_MARGIN,
  CAMERA_DISTANCE,
  CAMERA_DISTANCE_2D,
  VIEW_TRANSITION_DURATION,
  getContentMargin,
  getCanvasHeight,
  CAMERA_ANIMATION_DURATION,
  getMobileCameraDistance,
  CAMERA_DISTANCE_FAR,
  getVisibleHeight,
  getProjectImageFit,
  whenTabVisible,
} from "~/utils";

const LINE_OPACITY = 0.1;

// 2d grid view. All px values are CSS pixels at the 2d camera distance and
// are converted to world units with worldPerPx().
const GRID_COLS_DESKTOP = 3;
const GRID_COLS_SMALL = 2;       // tablet + mobile
const GRID_GAP_PX = 24;          // between thumbnails
const GRID_TOP_PX = 80;          // viewport top -> first row
const GRID_BOTTOM_PX = 80;       // last row -> document end
const GRID_WIDTH_RATIO = 0.72;   // grid width as a share of the viewport
const GRID_MAX_WIDTH_PX = 1100;
const GRID_SMALL_MARGIN_PX = 12; // mobile: side margins
const GRID_FIT_EXTRA_COLS = 2;   // fit-to-screen may add up to this many columns
const GRID_FIT_MIN_COL_PX = 160; // below this, don't fit: scroll instead
const GRID_TAG_Z = -60;          // tags sink away behind the grid while hidden
const GRID_RESIZE_DURATION = 300;
// Device pixel ratio while a morph is running. The full-screen canvas at 2x
// with MSAA is fill-rate bound; rendering the motion at 1x costs a quarter of
// the pixels and is restored (sharp) on the final frame. 0 = keep full res.
const MOTION_PIXEL_RATIO = 1;

const LINK_DISTANCE = 50;

// Narrowest viewport aspect (width / height) the 3d layout is designed for.
// Below it (tablet portrait) the layout box would get too narrow for the
// images, so the box is scaled up by (MIN_LAYOUT_ASPECT / aspect) ^
// LAYOUT_SCALE_EXP and the camera pulls back by the same factor, so the whole
// box still fits on screen (0.5 would keep the box's area; less keeps the
// images larger and relies on squeezeX to narrow the cluster).
const MIN_LAYOUT_ASPECT = 1.4;
const LAYOUT_SCALE_EXP = 0.3;
// Strength of squeezeX(), scaled by how far below MIN_LAYOUT_ASPECT we are.
const SQUEEZE_STRENGTH = 0.3;

// Max pointer travel (px) between down and up that still counts as a click.
const CLICK_TOLERANCE = 6;

// Shared texture loader + cache so each thumbnail is decoded only once and
// reused across (re)builds and filtering instead of re-fetching per node.
const textureLoader = new THREE.TextureLoader();
const textureCache = new Map();
function loadTexture(url) {
  let tex = textureCache.get(url);
  if (!tex) {
    tex = textureLoader.load(url);
    tex.colorSpace = THREE.SRGBColorSpace;
    textureCache.set(url, tex);
  }
  return tex;
}

// Drop shadows drawn in the scene. This replaces a CSS `filter: drop-shadow`
// on the canvas, which re-filtered the whole full-screen layer on every WebGL
// frame. Values roughly match the old `rgba(0,0,0,.25) 0 0 5px` at the default
// camera distance. One small texture per rectangle size, shared and cached.
const SHADOW_SIGMA = 0.6; // world units (≈2.5px at the far camera distance)
const SHADOW_MARGIN = SHADOW_SIGMA * 3;
const shadowCache = new Map();
function shadowTexture(w, h) {
  const key = `${w.toFixed(2)}x${h.toFixed(2)}`;
  let tex = shadowCache.get(key);
  if (tex) return tex;
  const W = w + SHADOW_MARGIN * 2;
  const H = h + SHADOW_MARGIN * 2;
  const ppu = Math.min(6, 512 / Math.max(W, H)); // canvas px per world unit
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(2, Math.ceil(W * ppu));
  canvas.height = Math.max(2, Math.ceil(H * ppu));
  const ctx = canvas.getContext("2d");
  // Draw the rect off-canvas and only its shadow on-canvas.
  const off = canvas.width + 100;
  ctx.shadowColor = "rgba(0, 0, 0, 0.25)";
  ctx.shadowBlur = SHADOW_SIGMA * 2 * ppu;
  ctx.shadowOffsetX = off;
  ctx.fillStyle = "#000";
  ctx.fillRect(SHADOW_MARGIN * ppu - off, SHADOW_MARGIN * ppu, w * ppu, h * ppu);
  tex = new THREE.CanvasTexture(canvas);
  shadowCache.set(key, tex);
  return tex;
}

function createShadowSprite(renderOrder) {
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ transparent: true, depthWrite: false })
  );
  sprite.renderOrder = renderOrder;
  sprite.visible = false; // until sized
  sprite.raycast = () => {}; // never a hover/click target
  sprite.userData.isShadow = true;
  return sprite;
}

function sizeShadowSprite(sprite, w, h) {
  const tex = shadowTexture(w, h);
  if (sprite.material.map !== tex) {
    sprite.material.map = tex;
    sprite.material.needsUpdate = true;
  }
  sprite.scale.set(w + SHADOW_MARGIN * 2, h + SHADOW_MARGIN * 2, 1);
  sprite.visible = true;
}

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
      getViewMode: "getViewMode",
      getLocale: "getLocale",
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
      // Non-reactive: these hold the live node/link objects that the physics
      // engine mutates every frame (x/y/z, vx/vy/vz) and to which it attaches
      // Three.js objects (__threeObj). Keeping them out of reactive `data()`
      // prevents Vue 2 from deep-walking the entire scene graph 60x/sec.
      allNodes: null,
      allLinks: null,
      currentNode: null,
      // Scratch vectors reused across camera transitions (no per-click alloc).
      _dir: null,
      _camTarget: null,
      // RAF id / settle bookkeeping for on-demand rendering.
      _isPaused: false,
    };
  },
  data() {
    // Direct load of a project page (/:slug): start in the "project open" state (canvas
    // offset, no interaction) so it is already in place on the first paint
    // instead of transitioning into it after mount.
    const directProject = this.$route && this.$route.name == "works-work";
    return {
      hidden: true,
      // /bio and /cv: a text page is open on top of the graph. The backdrop
      // lets the pointer through, so the graph must ignore hover and clicks
      // itself (see textPageOpen in the $route watcher).
      textPageOpen: isTextPageRoute(this.$route),
      angle: 0,
      transition: false,
      engineStoped: false,
      canvasHeight: 0,
      openProject: directProject,
      contentMargin: 0,
      canvasMargin: CANVAS_OUT_MARGIN,
      currentFilter: null,
      // Document height the 2d grid needs (0 while in 3d).
      gridScrollHeight: 0,
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
        // Never build in a background tab: the layout cool-down would expire
        // before a single frame ran (see whenTabVisible).
        return whenTabVisible();
      }).then(() => {
        if (this._destroyed) return;
        this.buildGraph();
      }).catch((err) => {
        console.error("Error loading font", err);
      });
    });

    // Direct load of a project page (/:slug): the project page is already showing on
    // top, so put the graph in its "project open" state right away (canvas
    // offset, no interaction) and keep it hidden until the layout has settled
    // and the camera has been snapped onto the node (see onEngineStop). Only
    // then does the close transition have a correctly framed graph to fly
    // out of.
    if (this.$route.name == "works-work") {
      this.openProject = true;
      this._pendingOpen = this.$route.params.work;
    }
  },
  beforeDestroy() {
    if (!process.browser) return;
    this._destroyed = true;
    if (this._onVisibility) document.removeEventListener("visibilitychange", this._onVisibility);
    clearTimeout(this._sleepTimer);
    clearTimeout(this._morphTimer);
    clearInterval(this._keepAlive);
    if (this._morphRaf) cancelAnimationFrame(this._morphRaf);
    if (this._onResize) window.removeEventListener("resize", this._onResize);
    if (this._onScroll) window.removeEventListener("scroll", this._onScroll);
    if (this.el && this._onPointerMove) {
      this.el.removeEventListener("pointermove", this._onPointerMove);
      this.el.removeEventListener("pointerdown", this._onPointerDown);
      this.el.removeEventListener("pointerup", this._onPointerUp);
      this.el.removeEventListener("pointercancel", this._onPointerCancel);
    }
    if (this.g) {
      this.g.pauseAnimation();
      // Release WebGL context / GPU resources.
      if (this.g.renderer) this.g.renderer().dispose();
      this.g._destructor && this.g._destructor();
    }
  },
  methods: {
    ...mapActions({
      setViewMode: "setViewMode",
    }),

    // Stop the render loop. "idle" tells the layout the canvas is static now,
    // so it can re-bake the blurred copy behind the page overlay.
    sleep() {
      this.g.pauseAnimation();
      this.$emit("idle");
    },

    // Draw what the canvas currently shows into a 2d context whose pixels
    // map to the viewport at `scale` (used for the overlay's baked blur).
    // Returns false when there is nothing visible to draw.
    drawSnapshot(ctx, scale) {
      if (!this.g || this.hidden) return false;
      // No preserveDrawingBuffer: the buffer is only guaranteed intact in the
      // task that rendered it, so render a frame now and copy it right away.
      const composer = this.g.postProcessingComposer();
      if (composer) composer.render();
      else this.g.renderer().render(this.g.scene(), this.g.camera());
      const src = this.g.renderer().domElement;
      const r = src.getBoundingClientRect();
      ctx.drawImage(src, r.left * scale, r.top * scale, r.width * scale, r.height * scale);
      return true;
    },

    buildGraph() {
      let ForceGraph3D;
      if (window) {
        ForceGraph3D = require("3d-force-graph").default;
      } else {
        return;
      }
      this.el = this.$refs.graph;
      const g = ForceGraph3D({
        rendererConfig: {
          antialias: true,
          powerPreference: "high-performance",
        },
        controlType: "orbit",
      })(this.el);
      // Detach the graph data from Vue's reactivity. The physics engine mutates
      // these objects (x/y/z, __threeObj) 60x/sec and reads their fields during
      // layout + rendering; plain copies keep all of that off Vue's reactive
      // getters/setters entirely. allNodes and graphData.nodes intentionally
      // share the SAME instances so the __threeObj the engine attaches is
      // visible through both.
      const plainNodes = this.gData.nodes.map((n) => ({ ...n }));
      const plainLinks = this.gData.links.map((l) => ({ ...l }));
      this.allNodes = plainNodes;
      this.allLinks = plainLinks;

      this.graphData = {
        nodes: [...plainNodes],
        links: [...plainLinks],
      };

      // Reusable scratch vectors for camera maths (avoid per-click allocation).
      this._dir = new THREE.Vector3();
      this._camTarget = new THREE.Vector3();

      g.graphData(this.graphData)
        .backgroundColor("rgba(0,0,0,0)")
        .linkColor(() => "rgb(0,0,0)")
        .linkOpacity(LINE_OPACITY)
        .showNavInfo(false)
        .numDimensions(3)
        .cameraPosition({ x: 0, y: 0, z: this.farDistance() })
        .width(window.innerWidth)
        .height(this.canvasHeight)
        .enableNodeDrag(false)
        .cooldownTime(2000)
        .cooldownTicks(200)
        .d3VelocityDecay(0.71)    // Higher = faster settling
        .d3AlphaMin(0.01)       // Higher = stops earlier
        .d3AlphaDecay(0.04)      // Higher = faster cooldown
        // Clicks are detected by our own pointerdown/up handler (see
        // onPointerUp). A no-op here only keeps the library's pointer cursor.
        .onNodeClick(() => {})
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
      // Cap pixel ratio: hi-DPI phones otherwise render at 3x cost for no
      // visible gain on these sprite-based scenes. (Motion renders at
      // MOTION_PIXEL_RATIO, see setMotionResolution.)
      g.renderer().setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      // Three validates every shader link with a synchronous
      // gl.getProgramInfoLog + gl.getProgramParameter(LINK_STATUS) round-trip
      // when this is on (its default). That blocks the main thread until the
      // GPU finishes compiling — it's exactly the getProgramInfoLog cost in the
      // profile. We don't author shaders here, so turn it off in the browser.
      g.renderer().debug.checkShaderErrors = false;
      this.g = g;

      // No-op force that only observes the simulation's alpha (the library
      // has no getter). Leaving 3d mid-settle remembers it so the return trip
      // can resume the cool-down there instead of restarting it at alpha 1,
      // which would spread the layout further than a normal load does. See
      // finishMorph.
      g.d3Force("alphaProbe", (alpha) => {
        this._alpha = alpha;
        if (this._resumeAlpha != null && alpha <= this._resumeAlpha) this.resumeLayout();
      });

      // Once the layout settles, stop the perpetual render loop. It is woken
      // on demand by pointer activity / clicks / resize (see requestRender).
      this.g.onEngineStop(() => {
        this._settled = true;
        // Cool-down budget ran out before alpha got back down: release anyway.
        if (this._resumeAlpha != null) this.resumeLayout();
        if (this._pendingOpen) {
          // Positions are final now: frame the node instantly (no tween, the
          // overlay already covers the canvas), then reveal the graph.
          const id = this._pendingOpen;
          this._pendingOpen = null;
          const node = this.g.graphData().nodes.find((n) => n.id == id);
          if (node) this.openNode(node, 0);
          this.hidden = false;
          return;
        }
        // Back in 3d after a morph: the nodes were kept pinned on their
        // restored positions until the simulation came to rest, so releasing
        // them now cannot move anything.
        if (this._unpinWhenStopped) {
          this._unpinWhenStopped = false;
          this.g.graphData().nodes.forEach((n) => {
            n.fx = n.fy = n.fz = undefined;
          });
        }
        // Don't cut short a pending render window (e.g. a camera tween) or a
        // running 3d<->2d morph.
        if (
          !this.openProject &&
          !this._morphing &&
          performance.now() >= (this._renderUntil || 0)
        ) {
          this.sleep();
        }
      });

      // 2d grid: native page scroll moves the camera down the grid.
      this._onScroll = () => this.onGridScroll();
      window.addEventListener("scroll", this._onScroll, { passive: true });

      // Wake rendering while the pointer is over the canvas so hover raycasting
      // and highlights work; it sleeps again shortly after the pointer stops.
      this._onPointerMove = () => this.requestRender(800);
      this.el.addEventListener("pointermove", this._onPointerMove, { passive: true });

      // Own click detection. The library drops any click whose pointer moved
      // even 1px while pressed (treated as an orbit drag) and resolves the
      // target from the hover state of the last rendered frame, so clicks on a
      // still-moving graph (or taps while the loop is idle) were often lost.
      this._raycaster = new THREE.Raycaster();
      this._ndc = new THREE.Vector2();
      this._onPointerDown = (ev) => {
        this._downPos = { x: ev.clientX, y: ev.clientY };
        this.requestRender(800);
      };
      this._onPointerUp = (ev) => this.onPointerUp(ev);
      this._onPointerCancel = () => (this._downPos = null);
      this.el.addEventListener("pointerdown", this._onPointerDown, { passive: true });
      this.el.addEventListener("pointerup", this._onPointerUp, { passive: true });
      this.el.addEventListener("pointercancel", this._onPointerCancel, { passive: true });

      setTimeout(() => {
        process.nextTick(() => {
          this.setInitialView();
          // Already in 2d before the graph was built: lay the grid out at once, no morph.
          if (this.getViewMode === "2d") this.morphTo("2d", 0);
        });
      }, 1);
      this._onResize = _.throttle(this.onWindowResize, 1000);
      window.addEventListener("resize", this._onResize, false);

      // Tab hidden while the initial layout was still cooling down: no frames
      // ran meanwhile, so restart the cool-down clock on return instead of
      // letting the first frame stop the engine mid-clump.
      this._onVisibility = () => {
        if (document.hidden || !this.g || this._settled) return;
        this.g.d3ReheatSimulation();
        this.g.resumeAnimation();
      };
      document.addEventListener("visibilitychange", this._onVisibility);
    },

    // On-demand rendering: resume the loop and schedule it to pause again after
    // `ms` of inactivity. No-op until the initial layout has settled so we never
    // interrupt the first cool-down.
    requestRender(ms = 800) {
      if (!this.g || !this._settled) return;
      this.g.resumeAnimation();
      // Only ever extend the render window, never shorten it: a short request
      // (pointermove) must not pause the loop in the middle of a camera tween.
      const until = performance.now() + ms;
      if (this._renderUntil && until <= this._renderUntil) return;
      this._renderUntil = until;
      clearTimeout(this._sleepTimer);
      this._sleepTimer = setTimeout(() => {
        this._renderUntil = 0;
        // Never pause under a running 3d<->2d morph: a pointermove over the
        // canvas just before clicking the toggle would otherwise freeze the
        // morph halfway. finishMorph() schedules the sleep once it is done.
        if (this.g && !this.openProject && !this._morphing) this.sleep();
      }, ms);
    },

    onPointerUp(ev) {
      const down = this._downPos;
      this._downPos = null;
      if (!down || ev.button !== 0 || !this.g || this.openProject || this.textPageOpen) return;
      // Small movement is still a click; larger movement is a real orbit drag.
      if (Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > CLICK_TOLERANCE) return;
      const node = this.nodeAt(ev.clientX, ev.clientY);
      if (node) this.onNodeClick(node);
    },

    // Raycast the node under a screen point against what is currently drawn.
    nodeAt(clientX, clientY) {
      const rect = this.g.renderer().domElement.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      this._ndc.set(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1
      );
      this._raycaster.setFromCamera(this._ndc, this.g.camera());

      const byObj = new Map();
      this.g.graphData().nodes.forEach((n) => {
        if (n.__threeObj) byObj.set(n.__threeObj, n);
      });
      const hits = this._raycaster.intersectObjects([...byObj.keys()], true);
      for (const hit of hits) {
        if (!hit.object.visible) continue; // e.g. hidden title sprites
        for (let o = hit.object; o; o = o.parent) {
          if (byObj.has(o)) return byObj.get(o);
        }
      }
      return null;
    },

    // Pin every node where it currently is so the layout can't drift while the
    // camera flies to (and the overlay sits on top of) the clicked project.
    freezeLayout() {
      if (this._frozen) return;
      this._frozen = true;
      this._frozenBeforeSettle = !this._settled;
      this.g.graphData().nodes.forEach((n) => {
        n.fx = n.x;
        n.fy = n.y;
        n.fz = n.z;
        n.vx = n.vy = n.vz = 0;
      });
    },

    releaseLayout() {
      if (!this._frozen) return;
      this._frozen = false;
      // In 2d every node stays pinned to its grid slot; nothing to release.
      if (this.getViewMode === "2d") {
        this._frozenBeforeSettle = false;
        return;
      }
      this.g.graphData().nodes.forEach((n) => {
        n.fx = n.fy = n.fz = undefined;
      });
      // If we froze mid-settle, let the layout finish settling.
      if (this._frozenBeforeSettle) {
        this._frozenBeforeSettle = false;
        this.g.d3ReheatSimulation();
        this.requestRender(3000);
      }
    },

    setInitialView() {
      this.g.d3Force("link").distance((link) => LINK_DISTANCE);
      // In 2d the camera is placed by the grid morph; a tween here would
      // fight it.
      if (this.getViewMode !== "2d") {
        this.g.cameraPosition({ x: 0, y: 0, z: this.farDistance() }, 0, 1000);
      }
      let project_nodes = this.g
        .graphData()
        .nodes.filter((n) => n.type == "project");

      // Set image sizes directly from node data
      this.g.graphData().nodes.forEach((node) => {
        if (node.type == "project" && node.__threeObj && node.width && node.height) {
          const { w, h } = this.size3d(node);
          node.__threeObj.children[1].scale.set(w, h);
          let margin = this.getIsMobile ? PROJECT_MARGIN_MOBILE : PROJECT_MARGIN;
          node.bbox = [
            [-w / 2 - margin, -h / 2 - margin],
            [w / 2 + margin, h / 2 + margin],
          ];
          // border
          node.__threeObj.children[2].scale.set(w, h);
          // drop shadow
          const shadow = node.__threeObj.children[3];
          if (shadow) sizeShadowSprite(shadow, w, h);
        }
      });

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
      this.g.d3Force("squeeze", this.squeezeX());
      // While a direct-load open is pending the graph stays hidden until the
      // camera has been placed on the node (see onEngineStop).
      if (!this._pendingOpen) this.hidden = false;
    },

    // Label of a node in the current language (tags keep their English id).
    nodeLabel(node) {
      return node.type == "project"
        ? localized(node, "title", this.getLocale)
        : tagLabel(this.getLocale, node.id);
    },

    // Language switched: rewrite the title / tag sprites in place (the
    // canvas texture is regenerated, the sprite keeps its material and state).
    relabelNodes() {
      if (!this.g) return;
      this.g.graphData().nodes.forEach((node) => {
        const group = node.__threeObj;
        if (!group) return;
        const label = this.nodeLabel(node);
        const sprite = group.children[0];
        if (!sprite || sprite.text === label) return;
        sprite.text = label;
        if (node.type == "tag") {
          // The label box changed width: resize its drop shadow to match.
          const shadow = group.children[1];
          if (shadow && shadow.userData.isShadow) sizeShadowSprite(shadow, sprite.scale.x, sprite.scale.y);
        }
      });
      // While a project is open the loop is paused and would not go back to
      // sleep (see requestRender); the new labels show on the next render.
      if (!this.openProject) this.requestRender();
    },

    tagNode(node, group) {
      const sprite = new SpriteText(this.nodeLabel(node));
      sprite.fontFace = "Libre Bodoni Italic";
      sprite.backgroundColor = "white";
      sprite.padding = [0, 0];
      sprite.color = "black";
      sprite.textHeight = 1 * (node.val / 2);
      sprite.padding = 2;
      sprite.position.set(0, 1.6, 0);
      // Sort with the images by depth instead of always drawing first, and
      // never write depth: a transparent quad that writes depth punches a hole
      // into everything drawn behind it later, which showed as images
      // "blinking" wherever a label crossed them while fading in/out.
      sprite.renderOrder = 10;
      sprite.material.depthWrite = false;
      group.add(sprite);
      // children[1]: drop shadow behind the label box
      const shadow = createShadowSprite(-1);
      shadow.position.copy(sprite.position);
      sizeShadowSprite(shadow, sprite.scale.x, sprite.scale.y);
      group.add(shadow);
      return group;
    },

    projectNode(node, group) {
      const imgTexture = loadTexture(node.thumbnail);
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
      // Invisible, so it must not carve its quad out of sprites drawn after it.
      border.material.depthWrite = false;
      // Never shown (opacity 0): don't draw it at all, it would be another
      // full-screen transparent quad when a project is zoomed in.
      border.visible = false;

      // add text with the project title
      const title = new SpriteText(this.nodeLabel(node));
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

      group.add(title); // children[0]
      group.add(sprite); // children[1]
      group.add(border); // children[2]
      // children[3]: drop shadow, sized in setInitialView with the image.
      group.add(createShadowSprite(8));
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
      this.requestRender(3000);
    },

    onNodeClick(node) {
      if (gtag) {
        gtag("event", "click", {
          event_category: "node_click",
          event_label: node.id,
        });
      }
      if (node.type == "tag") {
        // Tags are hidden in the 2d grid.
        if (!this.getIsMobile && this.getViewMode !== "2d") this.filterNodes(node);
        return;
      }
      if (node.type !== "project" || this._morphing) {
        return;
      }


      this.$emit("clickProject", {
        id: node.id,
      });
      this.openNode(node, CAMERA_ANIMATION_DURATION);
    },

    // Put the graph in its "project open" state and frame `node` with the
    // camera. `duration` > 0 flies there (click in the graph); 0 snaps there
    // instantly (direct load, where the project overlay is already showing).
    openNode(node, duration = CAMERA_ANIMATION_DURATION) {
      this.currentNode = node;
      this.openProject = true;
      clearTimeout(this._openTimer);
      clearTimeout(this._openSettleTimer);

      if (!node.__threeObj) return;

      // Stop the simulation from moving the node away from the camera target.
      this.freezeLayout();
      node.__threeObj.children[0].renderOrder = 99;

      this.resetNodesStyle();
      // Camera distance scales with the sprite's height so every project image
      // ends up the same size on screen (matches getImageSizeOnScreen, which
      // assumes IMAGE_SCALE at CAMERA_DISTANCE). In 3d that height comes from
      // importance; in the 2d grid from the column width.
      const baseDist = this.getIsMobile ? CAMERA_DISTANCE_FAR - 50 : CAMERA_DISTANCE;
      const slot = this.getViewMode === "2d" && this._grid ? this._grid.slots.get(node.id) : null;
      // Narrow screens shrink the overlay image (getProjectImageFit): back
      // off by the same factor.
      const fit = getProjectImageFit(node.width, node.height);
      const dist = (slot ? baseDist * (slot.h / IMAGE_SCALE) : baseDist * node.importance) / fit;

      const cameraPos = this.g.cameraPosition();
      this.g.enablePointerInteraction(false);

      let newPosition;
      if (slot) {
        // 2d grid: dolly straight in, perpendicular to the grid. The camera
        // only translates (never turns toward an off-centre project), so the
        // surrounding grid stays flat instead of skewing in perspective.
        newPosition = { x: node.x, y: node.y, z: node.z + dist };
      } else {
        // Direction from camera to node (reused scratch vector).
        this._dir
          .set(node.x - cameraPos.x, node.y - cameraPos.y, node.z - cameraPos.z)
          .normalize();

        // Position `dist` units away from the node, on that line.
        newPosition = {
          x: node.x - this._dir.x * dist,
          y: node.y - this._dir.y * dist,
          z: node.z - this._dir.z * dist,
        };
      }
      const lookAt = { x: node.x, y: node.y, z: node.z };

      if (!duration) {
        this.g.cameraPosition(newPosition, lookAt);
        node.__threeObj.children[0].material.opacity = 0;
        // Paint a frame with the new camera, then idle under the overlay.
        this.g.resumeAnimation();
        this._openSettleTimer = setTimeout(() => {
          if (this.g && this.openProject) this.sleep();
        }, 300);
        return;
      }

      // Keep rendering through the camera transition, then it sleeps again.
      this.requestRender(duration + 800);
      this.g.cameraPosition(newPosition, lookAt, duration);

      this.transition = true;
      this._openTimer = setTimeout(() => {
        this.transition = false;
        this._openSettleTimer = setTimeout(() => {
          node.__threeObj.children[0].material.opacity = 0;
          if (this.g && this.openProject) this.sleep();
        }, 100);
      }, duration + 500);
    },
    resetNodesStyle() {
      this.allNodes.forEach((_node) => {
        if (_node.type == "tag" && _node.__threeObj) {
          // Assigning backgroundColor regenerates the label's canvas texture;
          // only write it when it actually changes (just the hovered tag).
          const label = _node.__threeObj.children[0];
          if (label.backgroundColor !== "white") label.backgroundColor = "white";
          // shadow (stays hidden with the tag in the 2d grid)
          if (_node.__threeObj.children[1]) {
            _node.__threeObj.children[1].visible = this.getViewMode !== "2d";
          }
        }
        if (_node.type == "project" && _node.__threeObj) {
          _node.__threeObj.children[1].renderOrder = 10;
          _node.__threeObj.children[0].visible = false; // title
        }
      });
    },
    onNodeHover(node) {
      this.resetNodesStyle();
      // Ensure the hover highlight paints even if pointer motion has stopped.
      this.requestRender();
      // Hidden tags (2d grid) are still raycast by the library; ignore them.
      if (node && node.type == "tag" && this.getViewMode === "2d") return;
      if (node) {
        if (node.type == "project") {
          //node.__threeObj.children[1].material.opacity = 1;
          node.__threeObj.children[1].renderOrder = 99;
          node.__threeObj.children[1].depthWrite = true;

          node.__threeObj.children[0].visible = true; // title
        }
        if (node.type == "tag") {
          node.__threeObj.children[0].backgroundColor =
            "rgba(255, 255, 255, 0)";
          // No box on hover, so no box shadow either.
          if (node.__threeObj.children[1]) node.__threeObj.children[1].visible = false;
        }
      }
    },
    async onCloseProject() {
      this.openProject = false;
      clearTimeout(this._openTimer);
      clearTimeout(this._openSettleTimer);
      // Closed before the graph was built / settled (direct load, quick close):
      // just drop the pending open; the graph reveals itself normally.
      this._pendingOpen = null;
      if (!this.g) {
        this.$emit("backToInitialView");
        return;
      }
      this.hidden = false;
      var node = this.currentNode;
      this.currentNode = null;

      // Wake rendering for the return camera transition, then let it settle.
      this.requestRender(CAMERA_ANIMATION_DURATION + 800);

      // reset camera position
      var cameraPos = this.g.cameraPosition();

      if (this.getViewMode === "2d") {
        // Straight back to the top of the grid (the route change scrolled the
        // document to the top, so camera and scroll agree again).
        this.transition = true;
        clearTimeout(this._closeTimer);
        this._closeTimer = setTimeout(() => {
          this.transition = false;
        }, CAMERA_ANIMATION_DURATION);
        this.g.cameraPosition(
          { x: 0, y: 0, z: CAMERA_DISTANCE_2D },
          { x: 0, y: 0, z: 0 },
          CAMERA_ANIMATION_DURATION
        );
      } else if (node) {
        // Calculate the direction vector from camera to new point (reused scratch)
        var dist = this.farDistance();
        this._dir
          .set(node.x - cameraPos.x, node.y - cameraPos.y, node.z - cameraPos.z)
          .normalize();

        // Calculate the new position that is `dist` units from the new point
        const newPosition = {
          x: node.x - this._dir.x * dist,
          y: node.y - this._dir.y * dist,
          z: node.z - this._dir.z * dist,
        };

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

      this.releaseLayout();

      this.openProject = false;
      // Closed into /bio or /cv (not back to the graph): keep it frozen.
      if (!this.textPageOpen) this.g.enablePointerInteraction(true);
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
      if (!this.textPageOpen) this.g.enablePointerInteraction(true);
      this.g.graphData({
        nodes: [...this.allNodes],
        links: [...this.allLinks],
      });
      this.requestRender(3000);
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
        // Dispose the previous geometry so the GPU buffer is freed instead of
        // leaking on every resize.
        plane.geometry.dispose();
        plane.geometry = new THREE.PlaneGeometry(w, h, 32);
      }

      // New viewport, new bounds (e.g. a tablet rotated).
      if (this.currentFilter === null) {
        const projects = this.g.graphData().nodes.filter((n) => n.type == "project");
        this.g.d3Force("limit", this.limitWindow(projects));
      }
      this.g.d3Force("squeeze", this.squeezeX());
      // And the overview camera distance that frames them, keeping the
      // current viewing direction. Not while a project is framed or the grid /
      // a morph owns the camera.
      if (this.getViewMode !== "2d" && !this.openProject && !this._morphing) {
        const cam = this.cameraState();
        const t = cam.lookAt;
        const dir = new THREE.Vector3(cam.x - t.x, cam.y - t.y, cam.z - t.z);
        if (dir.lengthSq() > 0) {
          dir.setLength(this.farDistance());
          this.g.cameraPosition({ x: t.x + dir.x, y: t.y + dir.y, z: t.z + dir.z }, t, 600);
        }
      }

      // reheat (and keep rendering until the layout settles again)
      this.g.d3ReheatSimulation();
      this.requestRender(3000);

      // Re-flow the grid for the new viewport (nodes stay pinned, so the
      // reheat above cannot disturb it).
      if (this.getViewMode === "2d" && this._layout3d && !this.openProject) {
        this.morphTo("2d", GRID_RESIZE_DURATION, { keepScroll: true });
      }
    },

    // -----------------------------------------------------------------------
    // 2d grid view
    //
    // The grid is not a second renderer or DOM: it is the same scene with the
    // project sprites tweened onto grid slots, tags and links faded out and
    // the camera moved to look straight at z = 0. Going back
    // tweens everything to the positions snapshotted when 3d was left, so the
    // round trip is exact.
    // -----------------------------------------------------------------------

    setView(mode) {
      if (mode === this.getViewMode || this._morphing) return;
      if (gtag) {
        gtag("event", "click", {
          event_category: "view_mode",
          event_label: mode,
        });
      }
      this.setViewMode(mode);
    },

    // Camera position plus the orbit centre (OrbitControls' target), which is
    // what cameraPosition(pos, lookAt) actually sets.
    cameraState() {
      const p = this.g.camera().position;
      const t = this.g.controls().target;
      return {
        x: p.x,
        y: p.y,
        z: p.z,
        lookAt: t ? { x: t.x, y: t.y, z: t.z } : { x: 0, y: 0, z: 0 },
      };
    },

    // World units per CSS pixel for a camera at CAMERA_DISTANCE_2D looking at
    // z = 0: the canvas (viewport + CANVAS_OUT_MARGIN on both sides) spans the
    // full vertical field of view.
    worldPerPx() {
      return getVisibleHeight(window) / this.canvasHeight;
    },

    // Sprite size of a project in the 3d graph (mirrors setInitialView).
    size3d(node) {
      if (!node.width || !node.height) return { w: 1, h: 1 };
      const aspect = node.width / node.height;
      const base = node.importance * IMAGE_SCALE;
      return this.getIsMobile
        ? { w: base, h: base / aspect }
        : { w: base * aspect, h: base };
    },

    // Masonry placement of `projects` in `cols` columns spanning `innerPx`,
    // in px relative to the grid's top centre.
    masonry(projects, cols, innerPx) {
      const colPx = (innerPx - (cols - 1) * GRID_GAP_PX) / cols;
      const colHeights = new Array(cols).fill(0);
      const placed = projects.map((node) => {
        const aspect = node.width && node.height ? node.width / node.height : 1.5;
        const hPx = colPx / aspect;
        let col = 0;
        for (let c = 1; c < cols; c++) if (colHeights[c] < colHeights[col]) col = c;
        const xPx = -innerPx / 2 + colPx / 2 + col * (colPx + GRID_GAP_PX);
        const yPx = colHeights[col] + hPx / 2;
        colHeights[col] += hPx + GRID_GAP_PX;
        return { node, xPx, yPx, wPx: colPx, hPx };
      });
      const heightPx = Math.max(0, Math.max(...colHeights) - GRID_GAP_PX);
      return { placed, colPx, heightPx };
    },

    // Masonry layout of every project, in world units, for the current viewport.
    // Desktop/tablet: the column count and width are chosen so that every
    // project fits on screen at the largest possible size, centred vertically.
    // If that would make the thumbnails too small (short window), it falls back
    // to the default columns at full width and the page scrolls.
    computeGridLayout() {
      const wpp = this.worldPerPx();
      const small = window.innerWidth < 1200;
      const defaultCols = small ? GRID_COLS_SMALL : GRID_COLS_DESKTOP;
      const maxInnerPx = this.getIsMobile
        ? window.innerWidth - 2 * GRID_SMALL_MARGIN_PX
        : Math.min(window.innerWidth * GRID_WIDTH_RATIO, GRID_MAX_WIDTH_PX);

      // Most important first; ties keep the original order.
      const projects = this.allNodes
        .filter((n) => n.type === "project")
        .map((n, i) => ({ n, i }))
        .sort((a, b) => (b.n.importance || 1) - (a.n.importance || 1) || a.i - b.i)
        .map((e) => e.n);

      let layout = null;
      if (!this.getIsMobile) {
        const availPx = window.innerHeight - GRID_TOP_PX - GRID_BOTTOM_PX;
        for (let cols = defaultCols; cols <= defaultCols + GRID_FIT_EXTRA_COLS; cols++) {
          // Widest grid (up to maxInnerPx) whose tallest column still fits.
          let lo = 0;
          let hi = maxInnerPx;
          if (this.masonry(projects, cols, hi).heightPx <= availPx) lo = hi;
          else for (let k = 0; k < 18; k++) {
            const mid = (lo + hi) / 2;
            if (this.masonry(projects, cols, mid).heightPx <= availPx) lo = mid;
            else hi = mid;
          }
          const m = this.masonry(projects, cols, lo);
          if (m.colPx >= GRID_FIT_MIN_COL_PX && (!layout || m.colPx > layout.colPx)) layout = m;
        }
      }
      if (!layout) layout = this.masonry(projects, defaultCols, maxInnerPx);

      // Centred vertically when it fits, otherwise GRID_TOP_PX from the top.
      const topPx = Math.max(GRID_TOP_PX, (window.innerHeight - layout.heightPx) / 2);
      // World y of the grid's top edge when the camera is at y = 0.
      const gridTop = (window.innerHeight / 2 - topPx) * wpp;

      const slots = new Map();
      layout.placed.forEach(({ node, xPx, yPx, wPx, hPx }) => {
        slots.set(node.id, {
          x: xPx * wpp,
          y: gridTop - yPx * wpp,
          w: wPx * wpp,
          h: hPx * wpp,
        });
      });

      return {
        wpp,
        slots,
        // Document height: the grid plus breathing room above and below.
        scrollHeightPx: topPx + layout.heightPx + GRID_BOTTOM_PX,
      };
    },

    // Temporarily render at a lower pixel ratio (both the renderer and the
    // library's post-processing composer, which owns the actual render target).
    setMotionResolution(on) {
      if (!MOTION_PIXEL_RATIO) return;
      const full = Math.min(window.devicePixelRatio || 1, 2);
      const ratio = on ? Math.min(MOTION_PIXEL_RATIO, full) : full;
      if (this._pixelRatio === ratio) return;
      this._pixelRatio = ratio;
      this.g.renderer().setPixelRatio(ratio);
      const composer = this.g.postProcessingComposer();
      if (composer) {
        composer.setPixelRatio(ratio);
        composer.setSize(window.innerWidth, this.canvasHeight);
      }
    },

    applyControls(mode) {
      const controls = this.g.controls();
      const flat = mode === "2d";
      controls.enableRotate = !flat;
      controls.enableZoom = !flat;
      controls.enablePan = !flat;
      // OrbitControls sets touch-action: none; the grid needs touch scrolling.
      this.g.renderer().domElement.style.touchAction = flat ? "pan-y" : "none";
    },

    // Minimal rAF tween (cubic in/out). Only one morph runs at a time.
    runMorph(duration, onUpdate, onDone) {
      if (this._morphRaf) cancelAnimationFrame(this._morphRaf);
      const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
      const start = performance.now();
      const step = (now) => {
        const t = duration > 0 ? Math.min(1, (now - start) / duration) : 1;
        onUpdate(ease(t));
        if (t < 1) {
          this._morphRaf = requestAnimationFrame(step);
        } else {
          this._morphRaf = null;
          onDone();
        }
      };
      step(start);
    },

    morphTo(mode, duration = VIEW_TRANSITION_DURATION, { keepScroll = false } = {}) {
      const g = this.g;
      // An instant layout is allowed under an open project (direct load of
      // /:slug with 2d persisted); an animated one is not.
      if (!g || (this.openProject && duration > 0)) return;

      // A tag filter changes graphData asynchronously; restore the full graph
      // first and come back once its objects exist.
      if (this.currentFilter !== null) {
        this.showAllElements();
        clearTimeout(this._morphTimer);
        this._morphTimer = setTimeout(() => this.morphTo(mode, duration), 60);
        return;
      }

      const to2d = mode === "2d";
      // Nothing to go back to (the grid was never laid out): already in 3d.
      if (!to2d && !this._layout3d) return;
      const { nodes, links } = g.graphData();
      const lerp = (a, b, k) => a + (b - a) * k;

      if (to2d && !this._layout3d) {
        // Leaving 3d: remember where everything (and the camera) rests.
        this._layout3d = new Map(nodes.map((n) => [n.id, { x: n.x, y: n.y, z: n.z }]));
        // Position + the orbit target. Not cameraPosition().lookAt: the
        // library reports that as a point 1000 units down the view axis, and
        // feeding it back would make the camera orbit a centre far behind the
        // graph.
        this._camera3d = { ...this.cameraState() };
        // A snapshot taken before the first cool-down finished (2d clicked
        // while the graph was still spreading out, or the graph built
        // straight into 2d) is not a final layout; see finishMorph. Remember
        // how far the cool-down had got (alpha 1: not started).
        const resuming = this._resumeAlpha != null;
        this._layout3dSettled = !!this._settled && !resuming;
        this._layout3dAlpha = resuming ? this._resumeAlpha : this._alpha != null ? this._alpha : 1;
      }
      // Left again before a resumed cool-down released the pins: the morph
      // owns them now.
      this._resumeAlpha = null;
      const grid = to2d ? this.computeGridLayout() : null;
      this._grid = grid;

      const scrollY = to2d && keepScroll ? window.scrollY : 0;
      const camY = to2d ? -scrollY * grid.wpp : 0;

      // Node targets. Scale is tweened for project sprites only.
      const items = [];
      nodes.forEach((n) => {
        const obj = n.__threeObj;
        if (!obj) return;
        const from = { x: n.x, y: n.y, z: n.z };
        const rest = (this._layout3d && this._layout3d.get(n.id)) || from;
        let to, sFrom = null, sTo = null;
        if (n.type === "project") {
          const img = obj.children[1];
          sFrom = { w: img.scale.x, h: img.scale.y };
          if (to2d) {
            const s = grid.slots.get(n.id);
            to = { x: s.x, y: s.y, z: 0 };
            sTo = { w: s.w, h: s.h };
          } else {
            to = { x: rest.x, y: rest.y, z: rest.z };
            sTo = this.size3d(n);
          }
        } else {
          to = to2d ? { x: n.x, y: n.y, z: GRID_TAG_Z } : { x: rest.x, y: rest.y, z: rest.z };
          // label + shadow fade back in
          if (!to2d) obj.children.forEach((child) => (child.visible = true));
        }
        items.push({ n, obj, from, to, sFrom, sTo });
      });
      // Tag label and its drop shadow (children[1]) fade together.
      const tagItems = [];
      items
        .filter((it) => it.n.type !== "project")
        .forEach((it) => {
          it.obj.children.forEach((child) => {
            if (!child.material) return;
            tagItems.push({ mat: child.material, from: child.material.opacity, to: to2d ? 0 : 1 });
          });
        });
      const linkItems = links
        .filter((l) => l.__lineObj)
        .map((l) => ({ mat: l.__lineObj.material, from: l.__lineObj.material.opacity, to: to2d ? 0 : LINE_OPACITY }));

      // Camera: drive it from the same tween so it moves in lockstep.
      cancelCameraTweens();
      const cam = this.cameraState();
      const camFrom = { x: cam.x, y: cam.y, z: cam.z };
      const lookFrom = { ...cam.lookAt };
      const camTo = to2d
        ? { x: 0, y: camY, z: CAMERA_DISTANCE_2D }
        : { x: this._camera3d.x, y: this._camera3d.y, z: this._camera3d.z };
      const lookTo = to2d ? { x: 0, y: camY, z: 0 } : { ...this._camera3d.lookAt };

      // Nodes are pinned (fx/fy/fz) along the tween, and the simulation is kept
      // warm so the library moves sprites *and* link lines through its normal
      // tick, which only runs while the engine is alive (cooldownTime is 2s).
      this._morphing = true;
      this.transition = true;
      g.enablePointerInteraction(false);
      if (to2d) this.applyControls("2d");
      clearInterval(this._keepAlive);
      if (duration > 0) this.setMotionResolution(true);
      g.resumeAnimation();
      g.d3ReheatSimulation();
      this._keepAlive = setInterval(() => g.d3ReheatSimulation(), 700);
      if (to2d) {
        this.gridScrollHeight = grid.scrollHeightPx;
        if (!keepScroll) window.scrollTo(0, 0);
      }

      this.runMorph(
        duration,
        (k) => {
          items.forEach((it) => {
            const n = it.n;
            n.fx = n.x = lerp(it.from.x, it.to.x, k);
            n.fy = n.y = lerp(it.from.y, it.to.y, k);
            n.fz = n.z = lerp(it.from.z, it.to.z, k);
            n.vx = n.vy = n.vz = 0;
            it.obj.position.set(n.x, n.y, n.z);
            if (it.sTo) {
              const w = lerp(it.sFrom.w, it.sTo.w, k);
              const h = lerp(it.sFrom.h, it.sTo.h, k);
              it.obj.children[1].scale.set(w, h, 1);
              it.obj.children[2].scale.set(w, h, 1);
              // Drop shadow: stretch the current texture along the tween (a
              // new texture per frame would flood the shadow cache); it is
              // re-rendered at the final size in finishMorph.
              const shadow = it.obj.children[3];
              if (shadow) shadow.scale.set(w + SHADOW_MARGIN * 2, h + SHADOW_MARGIN * 2, 1);
            }
          });
          tagItems.forEach((t) => (t.mat.opacity = lerp(t.from, t.to, k)));
          linkItems.forEach((t) => (t.mat.opacity = lerp(t.from, t.to, k)));
          g.cameraPosition(
            { x: lerp(camFrom.x, camTo.x, k), y: lerp(camFrom.y, camTo.y, k), z: lerp(camFrom.z, camTo.z, k) },
            { x: lerp(lookFrom.x, lookTo.x, k), y: lerp(lookFrom.y, lookTo.y, k), z: lerp(lookFrom.z, lookTo.z, k) },
            0
          );
        },
        () => this.finishMorph(mode, items)
      );
    },

    finishMorph(mode, items) {
      const g = this.g;
      clearInterval(this._keepAlive);
      this._morphing = false;
      this.transition = false;
      this.setMotionResolution(false);

      // Final drop-shadow textures at the exact sprite size.
      items.forEach((it) => {
        const shadow = it.sTo && it.obj.children[3];
        if (shadow) sizeShadowSprite(shadow, it.sTo.w, it.sTo.h);
      });

      if (mode === "2d") {
        // Keep the pins: the grid must not move. Tags (label + shadow) are
        // hidden outright.
        items.forEach((it) => {
          if (it.n.type !== "project") it.obj.children.forEach((child) => (child.visible = false));
        });
        this._unpinWhenStopped = false;
      } else {
        const settled = this._layout3dSettled;
        this._layout3d = null;
        this._camera3d = null;
        this._grid = null;
        this.gridScrollHeight = 0;
        this.applyControls("3d");
        if (settled) {
          // The engine is still warm from the keep-alive; release the pins
          // only once it has stopped (see onEngineStop) so nothing drifts.
          this._unpinWhenStopped = true;
          g.d3ReheatSimulation();
        } else {
          // 3d was left before its first cool-down finished: finish it now.
          // Reheating can only reset alpha to 1, so keep the nodes pinned
          // until alpha has decayed back to where the cool-down was cut off;
          // the alpha probe then releases them and the layout carries on
          // exactly as if it had never been interrupted.
          this._unpinWhenStopped = false;
          this._resumeAlpha = this._layout3dAlpha;
          g.d3ReheatSimulation();
          this.requestRender(3000);
        }
      }
      if (!this.openProject && !this.textPageOpen) g.enablePointerInteraction(true);
      this.requestRender(2500);
    },

    // Release the pins held for a resumed cool-down (see finishMorph).
    resumeLayout() {
      this._resumeAlpha = null;
      this.g.graphData().nodes.forEach((n) => {
        n.fx = n.fy = n.fz = undefined;
      });
    },

    onGridScroll() {
      if (
        !this.g ||
        this.getViewMode !== "2d" ||
        !this._grid ||
        this._morphing ||
        this.transition ||
        this.openProject
      ) {
        return;
      }
      const y = -window.scrollY * this._grid.wpp;
      this.g.cameraPosition({ x: 0, y, z: CAMERA_DISTANCE_2D }, { x: 0, y, z: 0 }, 0);
      this.requestRender(300);
    },
    // >= 1: how much larger than designed the 3d layout box is made (and how
    // much further back the camera sits) on viewports narrower than
    // MIN_LAYOUT_ASPECT. See limitWindow().
    layoutScale() {
      const aspect = window.innerWidth / window.innerHeight;
      return aspect >= MIN_LAYOUT_ASPECT ? 1 : Math.pow(MIN_LAYOUT_ASPECT / aspect, LAYOUT_SCALE_EXP);
    },

    // Narrow viewports: a weak pull towards x = 0 so the cluster spreads
    // vertically and fills a tall screen instead of sitting in a wide band
    // across its middle. No-op (null force) at MIN_LAYOUT_ASPECT and wider.
    squeezeX() {
      const aspect = window.innerWidth / window.innerHeight;
      const k = SQUEEZE_STRENGTH * (1 - aspect / MIN_LAYOUT_ASPECT);
      if (k <= 0) return null;
      let nodes = [];
      const force = (alpha) => {
        for (let i = 0; i < nodes.length; i++) nodes[i].vx -= nodes[i].x * k * alpha;
      };
      force.initialize = (n) => (nodes = n);
      return force;
    },

    // Camera distance of the 3d overview.
    farDistance() {
      return CAMERA_DISTANCE_FAR * this.layoutScale();
    },

    // Bounds force keeping the project images inside the viewport. Captures
    // the viewport size, so it is re-registered on resize.
    limitWindow(nodes) {
      const isMobile = this.getIsMobile;
      const margins = {
        top: isMobile ? TOP_MARGIN_MOBILE : TOP_MARGIN,
        left: isMobile ? LEFT_MARGIN_MOBILE : LEFT_MARGIN,
        bottom: isMobile ? BOTTOM_MARGIN_MOBILE : BOTTOM_MARGIN,
        right: isMobile ? RIGHT_MARGIN_MOBILE : RIGHT_MARGIN,
        back: isMobile ? BACK_MARGIN_MOBILE : BACK_MARGIN,
        front: isMobile ? FRONT_MARGIN_MOBILE : FRONT_MARGIN,
      };

      // Narrow viewports: scaled up as a whole together with the camera
      // distance (see farDistance), so it still spans the screen.
      const s = this.layoutScale();
      const base_height = getVisibleHeight(window) - TOP_MARGIN - BOTTOM_MARGIN;
      const window_height = base_height * s;
      const window_width = (base_height * s * window.innerWidth) / window.innerHeight - LEFT_MARGIN - RIGHT_MARGIN;

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

          // Horizontally the whole image must stay inside, not just its
          // centre (it would be cut off at the screen edge). Never pinch the
          // range below zero for an image wider than the box.
          const half = node.bbox ? Math.min(node.bbox[1][0], bounds.xMax) : 0;
          const xMin = bounds.xMin + half;
          const xMax = bounds.xMax - half;
          if (node.x < xMin || node.x > xMax) {
            node.vx = node.x < xMin ? Math.abs(node.vx) : -Math.abs(node.vx);
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
      // Entering /bio or /cv: freeze hover/click on the graph behind the
      // page (and drop any highlight left from the pointer's last position).
      // Leaving it for the graph: hand interaction back, unless a project is
      // open or a camera tween is still running (those re-enable it themselves).
      const textPage = to_name == "bio" || to_name == "cv";
      if (textPage !== this.textPageOpen) {
        this.textPageOpen = textPage;
        if (this.g) {
          if (textPage) {
            this.g.enablePointerInteraction(false);
            this.resetNodesStyle();
            this.requestRender();
          } else if (!this.openProject && !this.transition && !this._morphing) {
            this.g.enablePointerInteraction(true);
          }
        }
      }
      if (to.name == "works-work") {
        const id = to.params.work;
        // Already opened by the click that triggered this navigation.
        if (this.openProject && this.currentNode && this.currentNode.id == id) return;
        // Graph not built / settled yet: defer to onEngineStop (direct-load path).
        if (!this.g || !this._settled) {
          this.openProject = true;
          this._pendingOpen = id;
          return;
        }
        // Navigated here from another page (e.g. a link in bio/cv): fly there.
        const node = this.g.graphData().nodes.find((n) => n.id == id);
        if (node) this.openNode(node, CAMERA_ANIMATION_DURATION);
      }
    },
    getCurrentProject(newVal, oldVal) {
      if (this.getCurrentProject) {
        this.setCurrentOpenNode();
      }
    },
    getViewMode(mode) {
      this.morphTo(mode);
    },
    getLocale() {
      this.relabelNodes();
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
  transition: opacity 0.25s ease-in-out, transform 2s ease-in-out;
  will-change: transform;

  // While still hidden (loading / direct-load snap) only the fade-in should
  // animate; the offset must already be in place when the graph appears.
  &.hidden {
    transition: opacity 0.25s ease-in-out;
  }
}

// The library repositions its tooltip on every pointermove (a forced style
// recalculation each time); it is never used.
.connections-graph .scene-tooltip {
  display: none !important;
}

.no-interaction canvas,
.no-interaction .scene-container {
  pointer-events: none;
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
  z-index: 2;
  position: fixed;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  pointer-events: all;
  padding: 2px 5px;
  transition: opacity 0.25s ease-in-out;
  opacity: 1;
  font-family: "Libre Bodoni Italic";
  font-size: 14px;
  line-height: 20px;
  color: black;
}

.grid-scroll-spacer {
  position: absolute;
  top: 0;
  left: 0;
  width: 1px;
  pointer-events: none;
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