<template>
  <div>
    <!-- project -->
  </div>
</template>

<script>
export default {
  name: "Project",
  props: {
    project: {
      type: Object,
      required: true,
    },
  },
  mounted() {
    console.log("mounted project", this.project);
  },
};
</script>