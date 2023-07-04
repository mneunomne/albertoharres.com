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
          <a href="#" @click="closeProject">close</a>
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
        <div class="image">
          <img class="image-el" :src="project.thumbnail" alt="" />
        </div>
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
      required: true,
    },
    height: {
      type: Number,
      required: true,
    },
    show: {
      type: Boolean,
      required: true,
    },
  },
  methods: {
    closeProject() {
      this.$emit("closeProject");
    },
  },
  mounted() {
    console.log("mounted project", this.project);
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
  top: 50%;
  right: 50%;
  transform: translate(50%, -50%);
  pointer-events: all;
  padding: 1em;
  width: 500px;
  .header {
    opacity: 0;
    position: absolute;
    top: -3em;
  }
  .tags li {
    display: inline-block;
    margin-right: 5px;
    font-style: italic;
  }
  .content {
    transition: opacity 0.5s;
    opacity: 0;
    .description p {
      margin: 1em 0em;
    }
    width: 100%;
    .image img {
      max-width: 100%;
      width: 100%;
    }
  }
}

.project-wrapper {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  pointer-events: none;
  z-index: 9999;
  &.show .project-bg {
    opacity: 1;
    pointer-events: all;
  }
  &.show .content {
    opacity: 1;
    pointer-events: all;
  }
  &.show .header {
    opacity: 1;
  }
}

.project-bg {
  opacity: 0;
  transition: opacity 0.5s;
  position: absolute;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: radial-gradient(
    circle,
    rgba(217, 217, 217, 1) 0%,
    rgb(255, 255, 255) 100%
  );
  z-index: 0;
}
</style>