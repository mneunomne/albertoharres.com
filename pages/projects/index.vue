<template>
  <main v-if="connections" class="main">
    <ConnectionsGraph :data="connections" />
  </main>
</template>
<script>
import ConnectionsGraph from '~/components/general/ConnectionsGraph.vue'

export default {
  components: {
    ConnectionsGraph,
  },
  computed: {
    connections() {
      return this.$store.state.connections
    },
  },
}
</script>
