<template>
  <div>
    <!-- content -->
    <div class="project-wrapper" :class="{ show: show }">
      <div class="project-bg"></div>
      <div class="project" :class="{ mobile: getIsMobile }">
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
			show: false
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
		// console.log("TextPage mounted", this.data);
		this.show = true;
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
		opacity: 0;
		transition: all 0.5s;
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: 1;
    backdrop-filter: blur(10px);
    background: rgba(255, 255, 255, 0.85);	
  }
	&.show {
		opacity: 1;
		.content, .project-bg {
			opacity: 1;
		}
	}
}
</style>
