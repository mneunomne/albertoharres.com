<template>
  <div>
    <!-- content -->
    <div class="project-wrapper">
      <div class="project" :class="{ mobile: getIsMobile, show: show }">
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
  data() {
    return {
      show: false,
      showBackground: false
    }
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
  mounted() {
    console.log("$route", this.$route);
    setTimeout(() => {
      this.show = true;
    }, 200);
  }
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
  overflow-y: auto;

  &.mobile {
    width: 100% !important;
    height: auto !important;
    max-height: calc(100vh - 20px);
    left: 0;
    top: 0;
    padding-top: 2em;
    transform: none;

    .description {
      padding: 0px 1.5em;
    }

    .close {
      position: fixed;
      top: 1.5em;
      right: 1.5em;
    }
  }

  .content {
    padding-bottom: 4em;
    transition: all 0.5s;
    transition-delay: 0.2s;

    .description {
      opacity: 1;
      padding-bottom: 1em;
    }
  }
}

.project-wrapper {
  z-index: 9999;

  .project {
    opacity: 0;
    transition: all 0.5s;
    transition-delay: 0.2s;

    &.show {
      opacity: 1;
    }
  }

}
</style>
