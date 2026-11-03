// Site localisation (en / pt).
//
// The locale lives in the Vuex store (state.locale) and is applied on the
// client only, after hydration: the static HTML is always English, so a
// visitor who picked "pt" gets the English HTML first and the Portuguese text
// a moment later (see layouts/default.vue).
//
// Content (projects, bio, cv) carries its Portuguese text in sibling fields
// with a `_pt` suffix (`title_pt`, `content_pt`, ...). Missing or empty
// Portuguese fields fall back to the English ones, so a project can be
// translated one field at a time from the CMS.

export const LOCALES = ["en", "pt"];
export const DEFAULT_LOCALE = "en";
export const LOCALE_STORAGE_KEY = "locale";

// Value for <html lang>.
export const HTML_LANG = { en: "en", pt: "pt-BR" };

const UI = {
  en: {
    works: "works",
    loading: "loading",
  },
  pt: {
    works: "trabalhos",
    loading: "carregando",
  },
};

// Tag names as shown in the graph and in the phone project list. Tags are
// also the graph's node ids, so the ids stay English; only the label changes.
// Tags missing here are shown as they are.
const TAGS = {
  pt: {
    ai: "IA",
    archiving: "arquivamento",
    ceramics: "cerâmica",
    clay: "argila",
    electronics: "eletrônica",
    generative: "generativo",
    language: "linguagem",
    materiality: "materialidade",
    memory: "memória",
    obfuscation: "ofuscação",
    projection_mapping: "projeção mapeada",
    research: "pesquisa",
    sound: "som",
    street: "rua",
    theater: "teatro",
    voices: "vozes",
    water: "água",
  },
};

export const isLocale = (value) => LOCALES.includes(value);

// The other locale, i.e. what the language switch offers.
export const otherLocale = (locale) => (locale === "pt" ? "en" : "pt");

export const translate = (locale, key) => {
  const table = UI[locale] || UI[DEFAULT_LOCALE];
  return key in table ? table[key] : UI[DEFAULT_LOCALE][key] || key;
};

export const tagLabel = (locale, tag) => {
  const table = TAGS[locale];
  return (table && table[tag]) || tag;
};

// `obj[field]` in the given locale: `obj[field + "_pt"]` for Portuguese when
// it is set, the English field otherwise.
export const localized = (obj, field, locale) => {
  if (!obj) return undefined;
  if (locale && locale !== DEFAULT_LOCALE) {
    const value = obj[`${field}_${locale}`];
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return obj[field];
};
