<template>
  <div>
    <!-- content -->
    <div class="project-wrapper show">
      <div class="project-bg"></div>
      <div class="project">
        <div class="close">
          <button @click="closeProject">X</button>
        </div>
        <div class="content">
          <div class="description" v-html="renderContent"></div>
        </div>
      </div>
    </div>
  </div>
</template>
<script>
import marked from "marked";

import { mapGetters } from "vuex";

export default {
  name: "TextPage",
  props: {
    data: {
      type: Object,
      required: true,
    },
  },
  computed: {
    ...mapGetters({
      getIsMobile: "getIsMobile",
    }),
    renderContent() {
      return marked.parse(this.data.content || "");
    },
    renderDetails() {
      return marked.parse(this.data.details || "");
    },
  },
  methods: {
    closeProject() {
      this.$emit("closeProject");
    },
  },
};
</script>

<style lang="scss" scoped>
.close {
  position: absolute;
  top: 0;
  right: 0;
}

.project {
  z-index: 3;
  position: absolute;
  left: 50%;
  top: 50%;
  padding-top: 20px;
  transform: translate(-50%, -50%);
  pointer-events: all;
  width: 600px;
  max-height: 80vh;
  font-family: sans-serif;
  overflow-y: auto;

  &.mobile {
    width: 100% !important;
    height: auto !important;
    max-height: calc(100vh - 120px);
    left: 0;
    top: 100px;
    transform: none;

    .description {
      padding: 0px 12px;
    }
  }

  .content {
    padding-bottom: 4em;

    .description {
      opacity: 1;
      padding-bottom: 1em;
    }
  }
}

.project-wrapper {
  z-index: 9999;

  .project-bg {
    opacity: 1;
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: 1;
    backdrop-filter: blur(10px);
    background: rgba(255, 255, 255, 0.85);
  }
}

.details {
  font-family: "Source Sans 3";
  border-top: 1px black solid;
  padding-top: 1em;
  opacity: 1;

  h3 {
    background-color: transparent;
  }
}

.side-content {
  opacity: 1;
  position: absolute;
  left: calc(100% + 20px);
  font-size: 13px;

  .details {
    width: 220px;
    border-top: none;
    padding-top: 0;
  }
}

.title {
  margin: 0px;
  padding: 0px 7px 0px 7px;
  max-width: 90%;
}

.subtitle {
  margin: 0px;
  font-weight: 400;
  padding: 3px 7px 5px 7px;
  margin-top: 0px;
  max-width: 90%;
}
</style>
