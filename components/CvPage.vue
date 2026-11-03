<template>
  <div class="cv-wrapper">
    <article class="cv" :class="{ mobile: getIsMobile, show: show }" ref="cv">
      <div class="close">
        <button @click="closeProject">X</button>
      </div>

      <header class="cv-head">
        <h1 class="cv-title">{{ $l(data, "title") }}</h1>
        <p v-if="$l(data, 'intro')" class="cv-intro" v-html="inline($l(data, 'intro'))"></p>
        <dl v-if="contact.length" class="cv-contact">
          <template v-for="(c, i) in contact">
            <dt :key="'dt' + i">{{ $l(c, "label") }}</dt>
            <dd :key="'dd' + i">
              <a v-if="c.url" :href="c.url" :target="external(c.url) ? '_blank' : null"
                :rel="external(c.url) ? 'noopener' : null">{{ $l(c, "text") }}</a>
              <span v-else>{{ $l(c, "text") }}</span>
            </dd>
          </template>
        </dl>
      </header>

      <section v-for="s in sections" :key="s.id" :id="s.id" class="cv-section">
        <h2 class="cv-section-title">{{ $l(s, "title") }}</h2>
        <ol class="cv-entries">
          <li v-for="(e, i) in s.entries" :key="i" class="cv-entry" :class="{ 'cv-entry--grouped': e.grouped }">
            <span class="cv-label">{{ $l(e, "label") }}</span>
            <span class="cv-text" v-html="inline($l(e, 'text'))"></span>
          </li>
        </ol>
      </section>
    </article>
  </div>
</template>

<script>
import marked from "marked";
import { mapGetters } from "vuex";

const slug = (s) =>
  "cv-" +
  String(s || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export default {
  name: "CvPage",
  props: {
    data: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      show: false,
    };
  },
  computed: {
    ...mapGetters({
      getIsMobile: "getIsMobile",
    }),
    contact() {
      return (this.data.contact || []).filter((c) => c && c.text);
    },
    sections() {
      // A label is only printed on the first entry of a run (2024, 2024, ...),
      // like a printed CV; the following entries keep the column but stay blank.
      // Section ids (anchors) always come from the English title so links to
      // them work in both languages.
      return (this.data.sections || [])
        .filter((s) => s && s.entries && s.entries.length)
        .map((s) => {
          let prev = null;
          const entries = s.entries.map((e) => {
            const grouped = e.label === prev;
            prev = e.label;
            return { ...e, grouped };
          });
          return { ...s, id: slug(s.title), entries };
        });
    },
  },
  methods: {
    inline(md) {
      return marked.parseInline(md || "");
    },
    external(url) {
      return /^https?:\/\//.test(url || "");
    },
    closeProject() {
      this.$emit("closeProject");
    },
  },
  mounted() {
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
  },
};
</script>

<style lang="scss" scoped>
$label-col: 6.5em;
$muted: rgb(110, 110, 110);
$rule: rgba(0, 0, 0, 0.18);

.close {
  position: absolute;
  top: 0;
  right: 0;
}

.cv-wrapper {
  z-index: 9999;
}

.cv {
  z-index: 3;
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  pointer-events: all;
  width: 720px;
  max-width: calc(100vw - 4em);
  max-height: 84vh;
  overflow-y: auto;
  padding: 20px 0 4em;
  opacity: 0;
  transition: opacity 0.5s;
  transition-delay: 0.2s;
  scroll-padding-top: 1em;

  &.show {
    opacity: 1;
  }

  // Phones: a plain in-flow page under the sticky nav (which is the way back).
  &.mobile {
    position: static;
    width: auto;
    max-width: none;
    max-height: none;
    overflow: visible;
    padding: 1em 1em 3em;
    transform: none;
    opacity: 1;
    transition: none;

    .close {
      display: none;
    }
  }
}

/* ----- head ----- */
.cv-head {
  margin-bottom: 2.2em;
}

.cv-title {
  margin: 0 0 0.6em;
}

.cv-intro {
  margin: 0 0 1em;
  max-width: 60ch;
  line-height: 1.55;
}

.cv-contact {
  display: grid;
  grid-template-columns: $label-col 1fr;
  column-gap: 1em;
  row-gap: 0.15em;
  margin: 0;
  font-size: 14px;

  dt {
    color: $muted;
    font-style: italic;
  }

  dd {
    margin: 0;
  }
}

/* ----- sections ----- */
.cv-section {
  margin-bottom: 2.2em;
  scroll-margin-top: 1em;
}

.cv-section-title {
  display: block;
  margin: 0 0 0.6em;
  padding: 0 0 0.3em;
  font-size: 16px;
  background: none;
  border-bottom: 1px solid $rule;
}

.cv-entries {
  list-style: none;
  margin: 0;
  padding: 0;
}

.cv-entry {
  display: grid;
  grid-template-columns: $label-col 1fr;
  column-gap: 1em;
  align-items: baseline;
  margin: 0 0 0.55em;
  line-height: 1.45;

  // Several entries of the same year: a slightly tighter group.
  &--grouped {
    margin-top: -0.2em;

    .cv-label {
      visibility: hidden;
    }
  }
}

.cv-label {
  color: $muted;
  font-variant-numeric: tabular-nums;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cv-text {
  min-width: 0;

  ::v-deep a {
    color: var(--black);
    text-decoration: underline;
    text-decoration-thickness: 1px;
    text-underline-offset: 2px;
  }

  ::v-deep em {
    font-style: italic;
  }
}

/* ----- phones ----- */
@include mobile {
  .cv-contact,
  .cv-entry {
    grid-template-columns: 5.2em 1fr;
    column-gap: 0.75em;
  }

  .cv-label {
    font-size: 13px;
  }
}

/* ----- print ----- */
@media print {
  .cv {
    position: static;
    transform: none;
    width: auto;
    max-width: none;
    max-height: none;
    overflow: visible;
    padding: 0;
    opacity: 1;
  }

  .close {
    display: none;
  }

  .cv-section {
    break-inside: auto;
  }

  .cv-entry {
    break-inside: avoid;
  }

  .cv-text ::v-deep a {
    text-decoration: none;
  }
}
</style>
