<template>
  <!--
    Phone header: a plain sticky bar with text links. It replaces the three.js
    menu graph below the mobile breakpoint. It is always rendered (so the static
    HTML is right before any JS runs) and hidden on wider screens by CSS.
  -->
  <nav class="mobile-nav">
    <nuxt-link to="/" class="site-name" @click.native="track('/')">alberto harres</nuxt-link>
    <ul class="nav-links">
      <li>
        <nuxt-link to="/works" :class="{ active: isWorks }" @click.native="track('/works')">{{ $t("works") }}</nuxt-link>
      </li>
      <li>
        <nuxt-link to="/bio" :class="{ active: $route.name === 'bio' }" @click.native="track('/bio')">bio</nuxt-link>
      </li>
      <li>
        <nuxt-link to="/cv" :class="{ active: $route.name === 'cv' }" @click.native="track('/cv')">cv</nuxt-link>
      </li>
      <li>
        <a href="https://github.com/mneunomne" target="_blank" rel="noopener" @click="track('git')">git</a>
      </li>
      <li>
        <!-- Language switch: shows the language it switches to. -->
        <button type="button" class="lang" :lang="nextLocale" @click="switchLocale">{{ nextLocale }}</button>
      </li>
    </ul>
  </nav>
</template>

<script>
import { otherLocale } from "~/utils/i18n";

export default {
  name: "MobileNav",
  computed: {
    nextLocale() {
      return otherLocale(this.$store.state.locale);
    },
    isWorks() {
      const name = this.$route.name || "";
      return name === "index" || name === "works" || name === "works-work";
    },
  },
  methods: {
    switchLocale() {
      const locale = this.nextLocale;
      this.track(`lang:${locale}`);
      this.$store.dispatch("setLocale", locale);
    },
    track(label) {
      if (typeof gtag === "function") {
        gtag("event", "click", {
          event_category: "mobile_nav_click",
          event_label: label,
        });
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.mobile-nav {
  display: none;
}

@include mobile {
  .mobile-nav {
    position: sticky;
    top: 0;
    z-index: 10;
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1em;
    padding: 0.9em 1em;
    background: white;
    border-bottom: 1px solid black;
  }

  .site-name {
    font-family: "Libre Bodoni Italic";
    font-size: 17px;
    color: black;
    text-decoration: none;
    white-space: nowrap;
  }

  .nav-links {
    display: flex;
    // Baseline: the language switch is a <button>, whose box sits lower than
    // the links' under the default `stretch`.
    align-items: baseline;
    gap: 1.1em;
    margin: 0;
    padding: 0;
    list-style: none;

    li {
      margin: 0;
    }

    a,
    .lang {
      color: black;
      text-decoration: none;
      // Comfortable tap target without making the bar tall.
      padding: 0.5em 0;

      &.active {
        text-decoration: underline;
        text-underline-offset: 3px;
      }
    }

    // Narrowest phones: "trabalhos" (pt) needs the room.
    @media (max-width: 350px) {
      gap: 0.75em;
    }

    .lang {
      margin: 0;
      border: 0;
      background: none;
      font: inherit;
      cursor: pointer;
    }
  }
}
</style>
