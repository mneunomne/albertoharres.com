<template>
  <div>
    <!-- On phones the header and body are plain in-flow blocks (see the
         .mobile rules below); the inline geometry only applies to the overlay. -->
    <div class="header" :class="{ show, mobile: getIsMobile, tablet: getIsTabletView }"
      :style="getIsMobile ? null : { width: `${width}px`, top: `calc(50% - ${titleMargin}px)` }">
      <div class="close">
        <button @click="closeProject">X</button>
      </div>
      <nuxt-link to="/works" class="back-link">&larr; {{ $t("works") }}</nuxt-link>
      <div class="title-wrapper">
        <h1 class="title">{{ $l(project, "title") }}</h1>
        <br />
        <h2 class="subtitle" v-if="$l(project, 'subtitle')">
          {{ $l(project, "subtitle") }}
        </h2>
      </div>
    </div>
    <!-- project -->
    <!--
      The heavy body (markdown, gallery, details) is only mounted once the
      overlay is shown, i.e. after the camera tween has finished, so building
      that DOM and fetching its images doesn't steal frames from the tween.
      `revealed` flips a couple of frames after mounting so it still fades in.
    -->
    <div class="project-wrapper" :class="{ show, revealed, mobile: getIsMobile }">
      <div class="project" :class="{ mobile: getIsMobile, tablet: getIsTabletView }" :style="getIsMobile ? null : {
        width: `${width}px`,
        height: `${height}px`,
        top: `calc(50% - ${contentMargin}px)`,
      }">
        <div class="content">
          <div class="side-content" v-if="renderBody && !(getIsMobile || getIsTabletView)">
            <div v-if="$l(project, 'details')" class="details" v-html="renderDetails"></div>
          </div>
          <div class="image" :style="getIsMobile ? null : { height: `${height}px` }">
            <img class="image-el" :src="project.thumbnail" alt="" :width="project.thumb_width || null"
              :height="project.thumb_height || null" />
          </div>
          <template v-if="renderBody">
            <div class="description" v-html="renderContent"></div>
            <div class="gallery-images">
              <img class="gallery_image" v-for="(image, imageIndex) in imageGallery" :key="imageIndex"
                loading="lazy" decoding="async" @click="onClickImage(imageIndex, image)" :src="image" />
            </div>
            <div v-if="getIsMobile || getIsTabletView" class="details" v-html="renderDetails"></div>
          </template>
        </div>
      </div>
    </div>
    <v-gallery :images="allImages" :index="curImageIndex" @close="curImageIndex = null"></v-gallery>
  </div>
</template>

<script>
import marked from "marked";
import _ from "lodash";

import { CANVAS_OUT_MARGIN, getContentMargin } from "/utils";

import { mapGetters } from "vuex";

export default {
  name: "Project",
  props: {
    project: {
      type: Object,
      required: true,
    },
    width: {
      type: Number,
      required: false,
    },
    height: {
      type: Number,
      required: false,
    },
    show: {
      type: Boolean,
      default: false,
      required: true,
    },
  },
  data() {
    return {
      imageWidth: 0,
      imageHeight: 0,
      contentMargin: CANVAS_OUT_MARGIN,
      showBg: false,
      tabletView: false,
      mobileView: false,
      imageGallery: [],
      allImages: [],
      curImageIndex: null,
      reachedBottom: false,
      renderBody: false,
      revealed: false,
    };
  },
  watch: {
    show(val) {
      if (val) this.reveal();
      else this.revealed = false;
    },
  },
  methods: {
    reveal() {
      this.renderBody = true;
      // Wait for the freshly mounted body to be painted at opacity 0 before
      // adding `revealed`, otherwise the opacity transition is skipped.
      cancelAnimationFrame(this._revealRaf);
      this._revealRaf = requestAnimationFrame(() => {
        this._revealRaf = requestAnimationFrame(() => {
          this._revealRaf = null;
          if (this.show) this.revealed = true;
        });
      });
    },
    onResize() {
      this.contentMargin = getContentMargin(window);
    },
    onScroll() {
      const contentEl = document.querySelector(".content");
      if (!contentEl) return;
      const height = contentEl.offsetHeight;
      if (window.scrollY + window.innerHeight >= height && !this.reachedBottom) {
        this.reachedBottom = true;
        if (gtag)
          gtag("event", "scroll", {
            event_category: "scrolled_bottom",
            event_label: this.project.title,
          });
      }
    },
    closeProject() {
      this.$emit("closeProject");
      this.$root.$emit("closeProject");
      this.curImageIndex = null;
      if (gtag)
        gtag("event", "click", {
          event_category: "project_close",
          event_label: this.project.title,
        });
    },
    onClickImage(index, src) {
      this.curImageIndex = index;
      if (gtag)
        gtag("event", "click", {
          event_category: "image_click",
          event_label: src,
        });
    },
  },
  mounted() {
    this.imageWidth = this.project.thumb_width;
    this.imageHeight = this.project.thumb_height;
    if (!process.browser) {
      return;
    }
    if (gtag)
      gtag("event", "loaded", {
        event_category: "project_loaded",
        event_label: this.project.title,
      });
    this.reachedBottom = false;
    //this.$ga.page(`/works/${this.project.slug}`);
    this.curImageIndex = null;
    this.contentMargin = getContentMargin(window);
    this.tabletView = this.getIsTabletView;
    this.mobileView = this.getIsMobile;
    // Named handlers stored so they can be removed in beforeDestroy (anonymous
    // handlers could never be unregistered → listener leak on every project
    // navigation). Resize drives visible layout (contentMargin), so coalesce it
    // onto requestAnimationFrame — updates once per frame for a smooth effect
    // without running multiple times within a single frame. Scroll is only
    // analytics, so a passive throttle is fine.
    this._onResize = () => {
      if (this._resizeRaf) return;
      this._resizeRaf = requestAnimationFrame(() => {
        this._resizeRaf = null;
        this.onResize();
      });
    };
    this._onScroll = _.throttle(this.onScroll, 150);
    window.addEventListener("resize", this._onResize);
    window.addEventListener("scroll", this._onScroll, { passive: true });

    this.imageGallery = this.project.gallery;
    if (this.imageGallery) {
      this.allImages = this.project.gallery.concat(this.project.thumbnail);
    } else {
      this.imageGallery = [];
    }

    // Direct navigation: the overlay is shown from the start.
    if (this.show) this.reveal();
  },
  beforeDestroy() {
    if (this._revealRaf) cancelAnimationFrame(this._revealRaf);
    if (this._resizeRaf) cancelAnimationFrame(this._resizeRaf);
    if (this._onResize) window.removeEventListener("resize", this._onResize);
    if (this._onScroll) window.removeEventListener("scroll", this._onScroll);
  },
  computed: {
    ...mapGetters({
      getIsMobile: "getIsMobile",
      getIsTabletView: "getIsTabletView",
    }),
    renderContent() {
      // Lazy-load / async-decode embedded media so it doesn't block the fade.
      return marked
        .parse(this.$l(this.project, "content") || "")
        .replace(/<img(?![^>]*\bloading=)/g, '<img loading="lazy" decoding="async"')
        .replace(/<iframe(?![^>]*\bloading=)/g, '<iframe loading="lazy"');
    },
    renderDetails() {
      return marked.parse(this.$l(this.project, "details") || "");
    },
    titleMargin() {
      return this.height / 2 + this.contentMargin + 20;
    },
  },
};
</script>

<style lang="scss">
.header {
  left: 50%;
  transform: translate(-50%, -100%);
  position: fixed;
  width: 100%;
  opacity: 0;
  top: -1em;
  z-index: 999;

  // Phones: a normal in-flow page header. The sticky nav is the way back, so
  // the X is replaced by a small text link.
  // `!important`: the static HTML is rendered desktop-first and carries the
  // overlay's inline geometry (width/top/height); Vue keeps server inline
  // styles on hydration, so the stylesheet has to win over them.
  &.mobile {
    position: static;
    width: auto !important;
    transform: none;
    opacity: 1;
    padding: 1.25em 1em 0;

    .close {
      display: none;
    }

    .back-link {
      display: inline-block;
    }
  }

  .close {
    position: absolute;
    top: 50%;
    right: 0;
  }

  .back-link {
    display: none;
    margin-bottom: 0.75em;
    font-size: 13px;
    color: black;
    text-decoration: none;
  }

  &.show {
    opacity: 1;
    pointer-events: all;
  }
}

.project {
  z-index: 3;
  position: absolute;
  right: 50%;
  transform: translate(50%, -50%);
  pointer-events: all;
  width: auto;

  // Phones: plain document flow under the header (see the note on
  // `!important` in .header.mobile).
  &.mobile {
    position: static;
    width: auto !important;
    height: auto !important;
    right: auto;
    transform: none;
    padding: 0 1em 2em;

    .image {
      height: auto !important;
    }
  }

  .content {
    padding-bottom: 4em;

    .description {
      transition: opacity 0.5s;
      opacity: 0;
      padding-bottom: 1em;
    }

    width: 100%;

    .image,
    .gallery_image {
      transition: opacity 0;
      opacity: 0;

      .image-el {
        max-width: 100%;
        width: 100%;
        height: auto;
      }
    }
  }
}

.project-wrapper {
  z-index: 9999;

  // The thumbnail must appear the instant the overlay shows (it lines up with
  // the canvas sprite underneath); the body fades in once it is mounted.
  &.show .image {
    opacity: 1;
    pointer-events: all;
  }

  &.show.revealed {

    .description,
    .side-content,
    .details,
    .gallery_image {
      opacity: 1;
      pointer-events: all;
    }
  }

  // Phones: no reveal choreography, everything is visible at once.
  &.mobile .project .content {

    .image,
    .description,
    .details,
    .gallery_image {
      opacity: 1;
      transition: none;
      pointer-events: all;
    }
  }
}

/* .project-bg lives in layouts/default.vue */

.details {
  transition: opacity 0.5s;
  border-top: 1px black solid;
  padding-top: 1em;
  opacity: 0;
}

.details ul,
.details ol {
  list-style: none;
  padding-left: 0;
  margin: 0 0 1.25em;
}

.details li {
  margin-bottom: 0.35em;
  line-height: 1.4;
}

.details h3 {
  margin-bottom: 0.4em;
}

.details a {
  text-decoration-thickness: 1px;
  text-underline-offset: 2px;
}

.side-content {
  opacity: 0;
  position: absolute;
  left: calc(100% + 20px);
  font-size: 13px;
}

.side-content .details {
  width: 220px;
  border-top: none;
  padding-top: 0;
}

/* llower than 1300 */
@media (max-width: 1300px) {
  .side-content .details {
    width: 170px;
  }
}

.title {
  margin: 0px;
  padding: 5px 7px 2px 7px;
  max-width: 90%;
}

.subtitle {
  font-style: italic;
  margin: 0px;
  margin-top: 0px;
  font-weight: 400;
  padding: 3px 7px 5px 7px;
  max-width: 90%;
}

.project .content .description p img {
  max-width: 100% !important;
  width: 100% !important;
}

.gallery_image {
  max-width: 100%;
  width: 100%;
  margin-bottom: 1em;
  cursor: pointer;
}
</style>