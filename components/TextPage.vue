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
      return marked.parse(this.$l(this.data, "content") || "");
    },
    renderDetails() {
      return marked.parse(this.$l(this.data, "details") || "");
    },
  },
  methods: {
    closeProject() {
      this.$emit("closeProject");
    },
  },
  mounted() {
    // Phones: no fade, show at once (also re-renders so the `.mobile` class
    // is applied right after hydration).
    if (this.getIsMobile) {
      this.show = true;
      return;
    }
    this._showTimer = setTimeout(() => {
      this.show = true;
    }, 200);
  },
  beforeDestroy() {
    clearTimeout(this._showTimer);
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

  // Phones: a plain in-flow page under the sticky nav (which is the way back).
  &.mobile {
    position: static;
    width: auto;
    height: auto;
    max-height: none;
    overflow: visible;
    padding: 1em 1em 2em;
    transform: none;

    .close {
      display: none;
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

// Tablets: centred in the space below the fixed nav bar, clear of the
// bottom edge.
@include tablet-nav-bar {
  .project:not(.mobile) {
    top: calc(50% + #{$nav-bar-height * 0.5});
    max-height: calc(100vh - #{$nav-bar-height} - 4em);
    // The max-height above is the whole box, padding included.
    box-sizing: border-box;
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

    // Phones: shown at once, no fade.
    &.mobile {
      opacity: 1;
      transition: none;
    }
  }

}
</style>
