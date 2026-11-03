<template>
  <div class="main" :class="{ mobile: getIsMobile }">
    <!--
      Desktop / tablet: the three.js menu graph and connections graph.

      Both components are async chunks and only ever rendered on the client
      above the mobile breakpoint, so on a phone none of the WebGL code (three,
      3d-force-graph, ...) is even downloaded. The placeholder keeps the
      "loading" hint in the static HTML for desktop until the client takes over.
    -->
    <client-only>
      <div v-if="!getIsMobile" class="desktop-graph">
        <div class="project-bg" :class="{ show: showBackground, instant: instantBg }">
          <!-- Baked blur of the (paused) graph canvas, see paintBlur(). -->
          <canvas ref="blur" class="project-bg-blur" v-show="blurReady"></canvas>
        </div>
        <Header />
        <ConnectionsGraph ref="graph" :gData="gData" @clickProject="onClickProject"
          @backToInitialView="onBackToInitialView" @idle="onGraphIdle" :currentProject="currentProject" />
      </div>
      <div slot="placeholder" class="graph-placeholder">
        <span>{{ $t("loading") }}</span><span class="dot">.</span><span class="dot">.</span><span class="dot">.</span>
      </div>
    </client-only>

    <!-- Phones: a plain sticky header nav (hidden above the breakpoint by CSS). -->
    <MobileNav />

    <!-- Fediverse profile verification; must stay in the static HTML. -->
    <a v-show="false" rel="me" href="https://mastodon.social/@mneunomne">Mastodon</a>

    <nuxt />
  </div>
</template>

<script>
import MobileNav from "~/components/MobileNav.vue";
import _ from "lodash";
import { MOBILE_BREAKPOINT, CAMERA_ANIMATION_DURATION } from "~/utils";
import { HTML_LANG, isLocale, LOCALE_STORAGE_KEY } from "~/utils/i18n";
import { mapGetters } from "vuex";
import { mapActions } from "vuex";

// Overlay blur (see paintBlur): resolution of the baked copy, blur radius in
// css px (as the old `backdrop-filter: blur(10px)`) and the white veil.
const BLUR_SCALE = 0.25;
const BLUR_PX = 10;
const VEIL_ALPHA = 0.85;

// Same as the body's radial-gradient background (assets/css/_globals.scss).
function fillPageBackground(ctx, w, h) {
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.hypot(w, h) / 2);
  g.addColorStop(0, "rgb(235, 235, 235)");
  g.addColorStop(1, "rgb(255, 255, 255)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

export default {
  components: {
    MobileNav,
    // Async: keeps three.js and the graph code out of the main bundle (see
    // the `vendor` cache group in nuxt.config.js), so phones never fetch it.
    Header: () => import(/* webpackChunkName: "graph-menu" */ "~/components/Header.vue"),
    ConnectionsGraph: () =>
      import(/* webpackChunkName: "graph-connections" */ "~/components/ConnectionsGraph.vue"),
  },
  head() {
    return {
      htmlAttrs: { lang: HTML_LANG[this.$store.state.locale] },
      script: [
        {
          hid: "netlify-identity",
          src: "https://identity.netlify.com/v1/netlify-identity-widget.js",
        },
      ],
    };
  },
  data() {
    return {
      currentProject: null,
      imageWidth: 0,
      imageHeight: 0,
      showCurrentProject: false,
      showBackground: false,
      instantBg: false,
      blurReady: false,
    };
  },
  created() {
    if (!process.browser) {
      return;
    }

    // check is mobile (throttled; named handler so it can be removed)
    this.checkScreenSize();
    this._onResize = _.throttle(this.checkScreenSize, 150);
    window.addEventListener("resize", this._onResize);
    // Re-bake the overlay blur after a resize, once the graph (throttled to
    // 1s) has re-rendered at the new size.
    this._onResizeBlur = _.debounce(() => this.showBackground && this.paintBlur(), 1200);
    window.addEventListener("resize", this._onResizeBlur);
  },
  beforeDestroy() {
    if (process.browser && this._onResize) {
      window.removeEventListener("resize", this._onResize);
      window.removeEventListener("resize", this._onResizeBlur);
      this._onResizeBlur.cancel();
    }
  },
  computed: {
    ...mapGetters({
      getCurrentProject: "getCurrentProject",
      getProjects: "getProjects",
      getIsMobile: "getIsMobile",
    }),
    projects() {
      return this.$store.state.projects.filter((p) => !p.disabled);
    },
    gData() {
      const data = this.projects;
      const nodes = [];
      data.map((node) => {
        nodes.push({
          id: node.slug,
          val: 10,
          type: "project",
          thumbnail: node.thumbnail,
          width: node.thumb_width,
          height: node.thumb_height,
          importance: node.importance,
          title: node.title,
          title_pt: node.title_pt,
        });
        node.tags.forEach((tag) => {
          let found = nodes.find((node) => node.id === tag);
          if (!found) {
            nodes.push({
              id: tag,
              val: 1,
              type: "tag",
            });
          } else {
            nodes[nodes.indexOf(found)].val += 1;
          }
        });
      });
      // console.log("nodes", nodes);
      const links = this.generateLinks(data, nodes);
      const obj = {
        nodes: nodes,
        links: links,
      };
      return obj;
    },
  },
  methods: {
    ...mapActions({
      setIsMobile: "setIsMobile",
      setIsTabletView: "setIsTabletView",
      setOpeningFromGraph: "setOpeningFromGraph",
      setLocale: "setLocale",
    }),
    // The visitor's language: `?lang=pt` / `?lang=en` (shareable links),
    // else the last choice made with the language switch. Applied after
    // hydration because the static HTML is always English.
    restoreLocale() {
      let locale = this.$route.query.lang;
      if (!isLocale(locale)) {
        try {
          locale = window.localStorage.getItem(LOCALE_STORAGE_KEY);
        } catch (e) {
          locale = null;
        }
      }
      if (isLocale(locale) && locale !== this.$store.state.locale) this.setLocale(locale);
    },
    onGraphIdle() {
      if (this.showBackground) this.paintBlur();
    },
    // The overlay's blur, baked once instead of a live `backdrop-filter`.
    // The graph is paused while the overlay is up, so its canvas is static:
    // copy it at 1/4 size, blur that small image once and stretch it full
    // screen. A backdrop-filter re-blurred the whole screen (at device
    // resolution) on every composited frame, e.g. on every scroll frame.
    // Re-baked whenever the graph goes idle again (see @idle) or on resize.
    paintBlur() {
      const graph = this.$refs.graph;
      const out = this.$refs.blur;
      if (!out || !graph || !graph.drawSnapshot) return;
      const w = Math.ceil(window.innerWidth * BLUR_SCALE);
      const h = Math.ceil(window.innerHeight * BLUR_SCALE);

      // 1. The canvas over (a copy of) the page background.
      const snap = this._blurSnap || (this._blurSnap = document.createElement("canvas"));
      snap.width = w;
      snap.height = h;
      const sctx = snap.getContext("2d");
      fillPageBackground(sctx, w, h);
      if (!graph.drawSnapshot(sctx, BLUR_SCALE)) {
        this.blurReady = false;
        return;
      }

      // 2. Blur it onto the visible canvas, then the white veil on top.
      out.width = w;
      out.height = h;
      const ctx = out.getContext("2d");
      fillPageBackground(ctx, w, h);
      if (typeof ctx.filter === "string") {
        ctx.filter = `blur(${BLUR_PX * BLUR_SCALE}px)`;
        ctx.drawImage(snap, 0, 0);
        ctx.filter = "none";
      } else {
        // No canvas filter (older Safari): shrink further and let the
        // bilinear upscale soften it.
        const tiny = document.createElement("canvas");
        tiny.width = Math.ceil(w / 4);
        tiny.height = Math.ceil(h / 4);
        tiny.getContext("2d").drawImage(snap, 0, 0, tiny.width, tiny.height);
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(tiny, 0, 0, w, h);
      }
      ctx.fillStyle = `rgba(255, 255, 255, ${VEIL_ALPHA})`;
      ctx.fillRect(0, 0, w, h);
      this.blurReady = true;
    },
    checkScreenSize() {
      // Only commit when the boolean actually flips so a resize drag doesn't
      // spam mutations to every component bound to these getters.
      const mobile = window.innerWidth < MOBILE_BREAKPOINT;
      const tablet = !mobile && window.innerWidth < 1200;
      if (mobile !== this.$store.getters.getIsMobile) this.setIsMobile(mobile);
      if (tablet !== this.$store.getters.getIsTabletView) {
        this.setIsTabletView(tablet);
      }
    },
    onClickProject(data) {
      const { id } = data;
      // Tell the project page it is being opened by the graph's camera flight
      // (so it waits for it) rather than by a direct URL load.
      this.setOpeningFromGraph(true);
      this.$router.push(`/${id}`);
    },
    showProject(data) {
      // const { id } = data;
      // this.$root.$emit("showProject", id);
    },
    onCloseProject() {
      // this.currentProject = null;
      this.showCurrentProject = false;
      this.$emit("closeProject");
    },
    onBackToInitialView() {
      this.currentProject = null;
      this.$emit("closeProject");
    },
    generateLinks(data) {
      const links = [];
      data.forEach((node) => {
        node.tags.forEach((tag) => {
          links.push({
            source: node.slug,
            target: tag,
          });
        });
      });
      return links;
    },
  },
  mounted() {
    this.restoreLocale();
    if (this.$route.name == "index" || this.$route.name == "works") {
      this.currentProject = null;
      this.showCurrentProject = false;
      this.showBackground = false;
    } else {
      // Direct load of /:slug (a project), /bio or /cv: the page is shown at once,
      // so the white backdrop must be up at once too.
      this.showBackground = true;
      if (this.$route.name == "works-work") {
        const project = this.projects.find((p) => p.slug === this.$route.params.work);
        this.currentProject = project || null;
        this.showCurrentProject = !!project;
      }
    }
  },
  watch: {
    showBackground(show) {
      if (show) this.paintBlur();
    },
    $route(to, from) {
      // A pending "show background" from a previous project open must not
      // fire after we've already navigated away.
      clearTimeout(this._bgTimer);

      // Leaving a project back to the graph: the overlay image is removed at
      // once, so drop the white background at once too. Fading it would hide
      // the (aligned) canvas image underneath for a moment -> visible blink.
      const fromName = from && from.name ? from.name.split("__")[0] : "";
      if (fromName == "works-work" && (to.name == "index" || to.name == "works")) {
        this.instantBg = true;
        clearTimeout(this._instantBgTimer);
        this._instantBgTimer = setTimeout(() => (this.instantBg = false), 100);
      }

            if (to.name == "bio" || to.name == "cv") {
        this.currentProject = null;
        this.showCurrentProject = false;
        this.showBackground = true;
      }
      if (to.name == "index" || to.name == "works") {
        this.currentProject = null;
        this.showCurrentProject = false;
        this.showBackground = false;
      }
      if (to.name == "works-work") {
        const work = to.params.work;
        const project = this.projects.find((p) => p.slug === work);
        if (project) {
          this.currentProject = project;
          this.showCurrentProject = true;
          this._bgTimer = setTimeout(() => {
            this.showBackground = true;
          }, CAMERA_ANIMATION_DURATION + 200);
        } else {
          this.currentProject = null;
          this.showCurrentProject = false;
          this.showBackground = false;
        }
      }
    },
  }
};
</script>


<style lang="scss" scoped>
.main {
  .project-bg {
    opacity: 0;
    transition: opacity 0.5s;
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: 1;
    // No backdrop-filter (re-blurred every composited frame): the blur is
    // baked into .project-bg-blur. This flat white is only the fallback
    // until that canvas has been painted.
    background: rgba(255, 255, 255, 0.92);
    pointer-events: none;
    // Promote ahead of time so the fade doesn't start with a repaint.
    will-change: opacity;

    &.show {
      opacity: 1;
    }

    &.instant {
      transition: none;
    }
  }

  .project-bg-blur {
    display: block;
    width: 100%;
    height: 100%;
  }

  // Static-HTML stand-in for the graph's own "loading" indicator (which lives
  // in the async graph chunk). Same look and place, so the hand-over is seamless.
  .graph-placeholder {
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

    .dot {
      opacity: 0;
      animation: placeholder-dot 1.5s infinite;
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

    @include mobile {
      display: none;
    }
  }
}

@keyframes placeholder-dot {

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
</style>
