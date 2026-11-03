import Vue from "vue";
import { translate, tagLabel, localized } from "~/utils/i18n";

// Template helpers bound to the store's locale. They read `$store.state`, so
// any render that calls them re-renders when the locale changes.
//   $t("works")             UI string
//   $l(project, "title")    content field (falls back to English)
//   $tag("ceramics")        tag label
Vue.prototype.$t = function (key) {
  return translate(this.$store.state.locale, key);
};
Vue.prototype.$l = function (obj, field) {
  return localized(obj, field, this.$store.state.locale);
};
Vue.prototype.$tag = function (tag) {
  return tagLabel(this.$store.state.locale, tag);
};
