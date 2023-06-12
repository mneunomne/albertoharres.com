<template>
  <div class="connections-graph">.</div>
</template>
  
<script>
// import d3ForceLimit from 'd3-force-limit'
import * as THREE from 'three'
import SpriteText from 'three-spritetext'

const fontSize = 6

export default {
  props: {
    data: {
      type: Array,
      default: () => [],
    },
  },
  mounted() {
    this.buildGraph()
  },
  methods: {
    buildGraph() {
      const data = this.data
      let ForceGraph3D
      if (window) {
        ForceGraph3D = require('3d-force-graph').default
        console.log('ForceGraph3D', ForceGraph3D)
      } else {
        return
      }
      const el = document.querySelector('.connections-graph')
      const g = ForceGraph3D()(el)

      const gData = {
        nodes: data.map((node) => {
          return {
            id: node.node_id,
            name: node.name_en,
            val: 1,
            content_en: node.content_en,
          }
        }),
        links: this.generateLinks(data),
      }

      console.log('gData', gData)

      g.graphData(gData)
        .backgroundColor('rgba(0,0,0,0)')
        .linkWidth(1)
        .showNavInfo(false)
        .numDimensions(3)
        .linkOpacity(1)
        .nodeLabel((node) => {
          return node.content_en.length > 0
            ? `
          <div class="tooltip-box">
            ${this.$md.render(node.content_en)}
          </div>
        `
            : false
        })
        .nodeThreeObject((node) => {
          console.log('node', node)
          const group = new THREE.Group()
          const geometry = new THREE.SphereGeometry(5, 64, 64)
          let op = 1
          const matSphere = new THREE.MeshBasicMaterial({
            color: 0x000000,
            opacity: op,
            transparent: true,
          })
          const sphere = new THREE.Mesh(geometry, matSphere)

          const clickMatSphere = new THREE.MeshBasicMaterial({
            color: 0x000000,
            opacity: 0,
            transparent: true,
          })
          const click_sphere = new THREE.Mesh(geometry, clickMatSphere)
          click_sphere.scale.set(10, 10, 10)

          sphere.scale.set(0.5, 0.5, 0.5)
          const sprite = new SpriteText(node.name)
          // sprite.fontFace = 'Space Mono'
          sprite.material.depthWrite = false // make sprite background transparent
          sprite.material.opacity = 1

          sprite.color = 'red'
          sprite.textHeight = fontSize
          sprite.padding = 2

          sprite.renderOrder = 999
          sprite.material.depthTest = false

          // this.sprites.push({ id: node.id, sprite })

          group.add(sprite)
          sprite.position.set(0, 1.6, 0)
          group.add(sphere)
          if (!node?.disabled) {
            //group.add(click_sphere)
          }

          return group
        })
    },
    generateLinks(data) {
      const links = []
      data.forEach((node) => {
        node.connections.forEach((connection) => {
          links.push({
            source: node.node_id,
            target: connection,
          })
        })
      })
      return links
    },
  },
}
</script>
  
<style global lang="postcss">
.connections-graph {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}
</style>