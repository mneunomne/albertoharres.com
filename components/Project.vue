<template>
  <div>
    <div
      class="header"
      :class="{ show, mobile: getIsMobile, tablet: getIsTabletView }"
      :style="{ width: `${width}px`, top: `calc(50% - ${titleMargin}px)` }"
    >
      <div class="close">
        <button @click="closeProject">X</button>
      </div>
      <div class="title-wrapper">
        <h1 class="title">{{ project.title_en }}</h1>
        <br />
        <h2 class="subtitle" v-if="project.subtitle_en">
          {{ project.description_en }}
        </h2>
      </div>
      <!--
        <div class="tags">
          <ul>
            <li v-for="tag in project.tags" :key="tag">#{{ tag }}</li>
          </ul>
        </div>
        -->
    </div>
    <!-- project -->
    <div class="project-wrapper" :class="{ show }">
      <div class="project-bg"></div>
      <div
        class="project"
        :class="{ mobile: getIsMobile, tablet: getIsTabletView }"
        :style="{
          width: `${width}px`,
          height: `${height}px`,
          top: `calc(50% - ${contentMargin}px)`,
        }"
      >
        <div class="content">
          <div class="side-content" v-if="!(getIsMobile || getIsTabletView)">
            <div
              v-if="project.details_en"
              class="details"
              v-html="renderDetails"
            ></div>
          </div>
          <div class="image" :style="{ height: `${height}px` }">
            <img class="image-el" :src="project.thumbnail" alt="" />
          </div>
          <div class="description" v-html="renderContent"></div>
          <div
            v-if="getIsMobile || getIsTabletView"
            class="details"
            v-html="renderDetails"
          ></div>
          <img
            class="gallery_image"
            v-for="(image, imageIndex) in imageGallery"
            :key="imageIndex"
            @click="curImageIndex = imageIndex"
            :src="image"
          />
        </div>
      </div>
    </div>
    <v-gallery
      :images="allImages"
      :index="curImageIndex"
      @close="curImageIndex = null"
    ></v-gallery>
  </div>
</template>

<script>
import marked from "marked";

import { CANVAS_OUT_MARGIN, getContentMargin } from "/utils";

import { mapGetters } from "vuex";
import { mapState } from "vuex";

const title_margin = 20;

const MIN_CONTENT_WIDTH = 1200;

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
    };
  },
  methods: {
    closeProject() {
      this.$emit("closeProject");
      this.$root.$emit("closeProject");
      this.curImageIndex = null;
    },
  },
  mounted() {
    if (!process.browser) {
      return;
    }
    this.curImageIndex = null;
    this.contentMargin = getContentMargin(window);
    this.tabletView = this.getIsTabletView;
    this.mobileView = this.getIsMobile;
    console.log("this.mobileView", this.mobileView);
    // add resize listener
    window.addEventListener("resize", () => {
      this.contentMargin = getContentMargin(window);
      // this.tabletView = window.innerWidth < MIN_CONTENT_WIDTH;
    });
    console.log("mounted project", this.project);
    this.imageGallery = this.project.gallery;
    if (this.imageGallery) {
      this.allImages = this.project.gallery.concat(this.project.thumbnail);
    } else {
      this.imageGallery = [];
    }
    // get width of image from src
    const img = new Image();
    img.src = this.project.thumbnail;
    img.onload = () => {
      this.imageWidth = img.width;
      this.imageHeight = img.height;
    };
  },
  beforeDestroy() {
    window.removeEventListener("resize", () => {
      this.canvasMargin = getContentMargin(window);
    });
  },
  computed: {
    ...mapGetters({
      getIsMobile: "getIsMobile",
      getIsTabletView: "getIsTabletView",
    }),
    renderContent() {
      return marked.parse(this.project.content_en || "");
    },
    renderDetails() {
      return marked.parse(this.project.details_en || "");
    },
    titleMargin() {
      return this.height / 2 + this.contentMargin + 20;
    },
  },
  watch: {
    show() {
      console.log("show", this.show);
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
    }
  }
  .close {
    position: absolute;
    top: 50%;
    right: 0;
    a {
      text-decoration: none;
      color: black;
      font-size: 2em;
      font-weight: bold;
      font-size: 30px;
    }
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
  font-family: sans-serif;
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
    .image {
      padding: 0px 12px;
    }
  }

  .tags li {
    display: inline-block;
    margin-right: 5px;
    margin-top: 1em;
    font-style: italic;
    font-family: "Libre Bodoni Italic";
    background: white;
    padding: 2px 5px;
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
    .header,
    .details,
    .image,
    .gallery_image {
      opacity: 1;
      pointer-events: all;
    }
    .project-bg {
      opacity: 1;
      backdrop-filter: blur(10px);
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
  backdrop-filter: blur(0px);
  background: rgba(255, 255, 255, 0.85);
}

.details {
  opacity: 0;
  font-family: "Source Sans 3";
  transition: opacity 0.5s;
  border-top: 1px black solid;
  padding-top: 1em;
}

.side-content .details {
  position: absolute;
  left: calc(100% + 20px);
  font-size: 13px;
  width: 220px;
  border-top: none;
  padding-top: 0;
}

.title {
  margin: 0px;
  padding: 5px 7px 2px 7px;
  max-width: 90%;
}

.subtitle {
  margin: 0px;
  margin-top: 10px;
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