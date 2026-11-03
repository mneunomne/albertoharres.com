<template>
  <div>
    <!-- Phones only (hidden by CSS on wider screens, where the graph is the works page). -->
    <MobileProjectList />
  </div>
</template>

<script>
import MobileProjectList from "~/components/MobileProjectList.vue";

export default {
  name: "Works",
  components: {
    MobileProjectList,
  },
};
</script>
