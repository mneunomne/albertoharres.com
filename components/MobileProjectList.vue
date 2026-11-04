<template>
  <!--
    Phone home page: the works as a plain list. On wider screens the force
    graph in the layout is the home page, so this is hidden there by CSS. The
    thumbnails are lazy so the hidden list costs nothing on desktop.
  -->
  <section class="mobile-works">
    <ul class="works-list">
      <li v-for="p in projects" :key="p.slug" class="work">
        <nuxt-link :to="`/${p.slug}`" class="work-link">
          <img class="work-thumb" :src="p.thumbnail" :alt="$l(p, 'title')" :width="p.thumb_width || null"
            :height="p.thumb_height || null" loading="lazy" decoding="async" />
          <span class="work-title">{{ $l(p, "title") }}</span>
          <span v-if="$l(p, 'subtitle')" class="work-subtitle">{{ $l(p, "subtitle") }}</span>
          <span v-if="p.tags && p.tags.length" class="work-tags">{{ p.tags.map((t) => $tag(t)).join(", ") }}</span>
        </nuxt-link>
      </li>
    </ul>
  </section>
</template>

<script>
export default {
  name: "MobileProjectList",
  computed: {
    projects() {
      return this.$store.state.projects
        .filter((p) => !p.disabled)
        .slice()
        .sort((a, b) => (b.importance || 0) - (a.importance || 0));
    },
  },
};
</script>

<style lang="scss" scoped>
.mobile-works {
  display: none;
}

@include mobile {
  .mobile-works {
    display: block;
    padding: 1.5em 1em 3em;
  }

  .works-list {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .work {
    margin: 0 0 2.5em;
  }

  .work-link {
    display: block;
    color: black;
    text-decoration: none;

    // A whole card, not a text link: no inverted hover (it blacked out the
    // card and left the white title box with white text).
    &:hover {
      background: none;
      color: black;
    }
  }

  .work-thumb {
    display: block;
    width: 100%;
    height: auto;
    background: white;
    // Same shadow the graph draws under its thumbnails.
    box-shadow: 0 0 5px rgba(0, 0, 0, 0.25);
  }

  .work-title {
    display: inline-block;
    margin-top: 0.9em;
    padding: 4px 7px 2px;
    background: white;
    font-family: "Libre Bodoni Italic";
    font-size: 16px;
    text-transform: uppercase;
    letter-spacing: 1.5px;
  }

  .work-subtitle {
    display: block;
    margin-top: 0.3em;
    font-style: italic;
  }

  .work-tags {
    display: block;
    margin-top: 0.3em;
    font-size: 12px;
    color: rgb(90, 90, 90);
  }
}
</style>
