<template>
  <!-- project -->
  <div class="project-wrapper" :class="{ show }">
    <div class="project-bg"></div>
    <div
      class="project"
      :style="{ width: `${width}px`, height: `${height}px` }"
    >
      <div class="header">
        <div class="close">
          <a href="#" @click="closeProject">X</a>
        </div>
        <div class="title">
          <h1>{{ project.title_en }}</h1>
        </div>
        <div class="tags">
          <ul>
            <li v-for="tag in project.tags" :key="tag">#{{ tag }}</li>
          </ul>
        </div>
      </div>
      <div class="content">
        <div class="image" :style="{ height: `${height}px` }">
          <img class="image-el" :src="project.thumbnail" alt="" />
        </div>
        <div class="description" v-html="renderContent"></div>
        <div class="description" v-html="renderContent"></div>
      </div>
    </div>
  </div>
</template>

<script>
import marked from "marked";

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
      required: true,
    },
  },
  data() {
    return {
      imageWidth: 0,
      imageHeight: 0,
    };
  },
  methods: {
    closeProject() {
      this.$emit("closeProject");
      this.$root.$emit("closeProject");
    },
  },
  mounted() {
    console.log("mounted project", this.project);
    // get width of image from src
    const img = new Image();
    img.src = this.project.thumbnail;
    img.onload = () => {
      this.imageWidth = img.width;
      this.imageHeight = img.height;
    };
  },
  computed: {
    renderContent() {
      return marked.parse(this.project.content_en);
    },
  },
  watch: {
    show() {
      console.log("show", this.show);
    },
  },
};
</script>
<style lang="postcss" scoped>
.project {
  position: absolute;
  top: calc(50% - 100px);
  right: 50%;
  transform: translate(50%, -50%);
  pointer-events: all;
  width: auto;
  font-family: sans-serif;
  .header {
    width: 100%;
    opacity: 0;
    position: absolute;
    top: -1em;
    transform: translateY(calc(-100%));
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
  }
  .tags li {
    display: inline-block;
    margin-right: 5px;
    margin-top: 1em;
    font-style: italic;
    font-family: "Libre Bodoni Italic";
    background: white;
    padding: 2px 5px;
    filter: drop-shadow(0px 0px 6px rgba(0, 0, 0, 0.2));
  }
  .content {
    padding-bottom: 4em;
    .description {
      transition: opacity 0.5s;
      opacity: 0;
    }
    width: 100%;
    .image {
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
    .image {
      opacity: 1;
      pointer-events: all;
    }
    .project-bg {
      opacity: 0.85;
    }
  }
}

.project-bg {
  opacity: 0;
  transition: opacity 0.5s;
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 0;
  background: radial-gradient(
    circle,
    rgba(217, 217, 217, 1) 0%,
    rgb(255, 255, 255) 100%
  );
}
</style>