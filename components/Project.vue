<template>
  <div>
    <div class="header" :class="{ show, mobile: getIsMobile, tablet: getIsTabletView }"
      :style="{ width: `${project.thumb_width}px`, top: `calc(50% - ${titleMargin}px)` }">
      <div class="close">
        <button @click="closeProject">X</button>
      </div>
      <div class="title-wrapper">
        <h1 class="title">{{ project.title }}</h1>
        <br />
        <h2 class="subtitle" v-if="project.subtitle">
          {{ project.subtitle }}
        </h2>
      </div>
    </div>
    <!-- project -->
    <div class="project-wrapper" :class="{ show }">
      <div class="project" :class="{ mobile: getIsMobile, tablet: getIsTabletView }" :style="{
        width: `${project.thumb_width}px`,
        height: `${project.thumb_height}px`,
        top: `calc(50% - ${contentMargin}px)`,
      }">
        <div class="content">
          <div class="side-content" v-if="!(getIsMobile || getIsTabletView)">
            <div v-if="project.details" class="details" v-html="renderDetails"></div>
          </div>
          <div class="image" :style="{ height: `${height}px` }">
            <img class="image-el" :src="project.thumbnail" alt="" />
          </div>
          <div class="description" v-html="renderContent"></div>
          <div class="gallery-images">
            <img class="gallery_image" v-for="(image, imageIndex) in imageGallery" :key="imageIndex"
              @click="onClickImage(imageIndex, image)" :src="image" />
          </div>
          <div v-if="getIsMobile || getIsTabletView" class="details" v-html="renderDetails"></div>
        </div>
      </div>
    </div>
    <v-gallery :images="allImages" :index="curImageIndex" @close="curImageIndex = null"></v-gallery>
  </div>
</template>

<script>
import marked from "marked";

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
      contentMargin: CANVAS_OUT_MARGIN,
      showBg: false,
      tabletView: false,
      mobileView: false,
      imageGallery: [],
      allImages: [],
      curImageIndex: null,
      reachedBottom: false,
    };
  },
  methods: {
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
    console.log("MOUNTED!");
    if (!process.browser) {
      return;
    }
    if (gtag) {
      gtag("event", "loaded", {
        event_category: "project_loaded",
        event_label: this.project.title,
      });
    }
    this.reachedBottom = false;
    //this.$ga.page(`/works/${this.project.slug}`);
    this.curImageIndex = null;
    this.contentMargin = getContentMargin(window);
    this.tabletView = this.getIsTabletView;
    this.mobileView = this.getIsMobile;
    // add resize listener
    window.addEventListener("resize", () => {
      this.contentMargin = getContentMargin(window);
      // this.tabletView = window.innerWidth < MIN_CONTENT_WIDTH;
    });
    // detect when scroll reached bottom

    window.addEventListener("scroll", () => {
      if (document.querySelector(".content")) {
        let height = document.querySelector(".content").offsetHeight;
        if (
          window.scrollY + window.innerHeight >= height &&
          !this.reachedBottom
        ) {
          this.reachedBottom = true;
          if (gtag)
            gtag("event", "scroll", {
              event_category: "scrolled_bottom",
              event_label: this.project.title,
            });
          console.log("reached bottom");
        }
      }
    });

    this.imageGallery = this.project.gallery;
    if (this.imageGallery) {
      this.allImages = this.project.gallery.concat(this.project.thumbnail);
    } else {
      this.imageGallery = [];
    }
  },
  beforeDestroy() {
    window.removeEventListener("resize", () => {
      this.canvasMargin = getContentMargin(window);
    });
    window.removeEventListener("scroll", () => {
      let height = document.querySelector(".content").offsetHeight;
      if (
        window.scrollY + window.innerHeight >= height &&
        !this.reachedBottom
      ) {
        this.reachedBottom = true;
      }
      if (gtag)
        gtag("event", "scroll", {
          event_category: "scrolled_bottom",
          event_label: this.project.title,
        });
      // this.tabletView = window.innerWidth < MIN_CONTENT_WIDTH;
    });
  },
  computed: {
    ...mapGetters({
      getIsMobile: "getIsMobile",
      getIsTabletView: "getIsTabletView",
    }),
    renderContent() {
      return marked.parse(this.project.content || "");
    },
    renderDetails() {
      console.log("renderDetails", this.project.details);
      return marked.parse(this.project.details || "");
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

  &.mobile {
    top: 12px !important;
    width: auto !important;
    transform: none;
    left: 12px;
    right: 12px;

    .close {
      top: 0;
      transform: none;
      right: 1em !important;
    }
  }

  .close {
    position: absolute;
    top: 50%;
    right: 0;
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

  &.mobile {
    width: 100% !important;
    height: auto !important;
    right: auto;
    transform: none;
    top: 100px !important;

    .image {
      height: auto !important;
    }

    .description,
    .details,
    .image,
    .gallery-images {
      padding: 0px 1em;
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
      }
    }
  }
}

.project-wrapper {
  z-index: 9999;

  &.show {

    .description,
    .side-content,
    .header,
    .details,
    .image,
    .gallery_image {
      opacity: 1;
      pointer-events: all;
    }

    .project-bg {
      opacity: 1;
    }
  }
}

.project-bg {
  opacity: 0;
  transition: backdrop-filter 1s, opacity 0.5s;
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 1;
  backdrop-filter: blur(10px);
  background: rgba(255, 255, 255, 0.85);
}

.details {
  transition: opacity 0.5s;
  border-top: 1px black solid;
  padding-top: 1em;
  opacity: 0;
}

.details li {
  margin-bottom: 0.5em;
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