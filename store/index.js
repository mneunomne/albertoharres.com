import { SET_NEWS, SET_PROJECTS, SET_CURRENT_PROJECT, SET_IS_MOBILE, SET_IS_TABLET_VIEW, SET_VIEW_MODE, SET_OPENING_FROM_GRAPH, SET_LOCALE } from './mutations.type'
import { DEFAULT_LOCALE, isLocale, LOCALE_STORAGE_KEY, HTML_LANG } from '~/utils/i18n'

const VIEW_MODES = ['3d', '2d']

export const state = () => ({
  news: [],
  projects: [],
  currentProject: null,
  isMobile: false,
  isTabletView: false,
  // '3d' = force graph (default on every load), '2d' = grid. Not persisted.
  viewMode: '3d',
  // True only between a click on a project node in the graph and the mount of
  // the project page it navigates to. Lets the page know it must wait for the
  // camera flight instead of showing at once (direct URL load / history).
  openingFromGraph: false,
  // 'en' | 'pt'. Always 'en' on the server; the visitor's choice is applied
  // after hydration (see layouts/default.vue) and kept in localStorage.
  locale: DEFAULT_LOCALE
})

export const mutations = {
  [SET_NEWS](state, list) {
    state.news = list
  },
  [SET_PROJECTS](state, list) {
    state.projects = list
  },
  [SET_CURRENT_PROJECT](state, project) {
    state.currentProject = project
  },
  [SET_IS_MOBILE](state, isMobile) {
    state.isMobile = isMobile
  },
  [SET_IS_TABLET_VIEW](state, isTabletView) {
    state.isTabletView = isTabletView
  },
  [SET_VIEW_MODE](state, mode) {
    state.viewMode = mode
  },
  [SET_OPENING_FROM_GRAPH](state, value) {
    state.openingFromGraph = value
  },
  [SET_LOCALE](state, locale) {
    state.locale = locale
  }
}

export const getters = {
  getCurrentProject(state) {
    return state.currentProject
  },
  getProjects(state) {
    return state.projects
  },
  getIsMobile(state) {
    return state.isMobile
  },
  getIsTabletView(state) {
    return state.isTabletView
  },
  getViewMode(state) {
    return state.viewMode
  },
  getOpeningFromGraph(state) {
    return state.openingFromGraph
  },
  getLocale(state) {
    return state.locale
  }
}


export const actions = {
  setCurrentProject({ commit }, project) {
    commit('setCurrentProject', project)
  },
  setIsMobile({ commit }, isMobile) {
    commit('setIsMobile', isMobile)
  },
  setIsTabletView({ commit }, isTabletView) {
    commit('setIsTabletView', isTabletView)
  },
  setOpeningFromGraph({ commit }, value) {
    commit(SET_OPENING_FROM_GRAPH, !!value)
  },
  setLocale({ commit }, locale) {
    if (!isLocale(locale)) return
    commit(SET_LOCALE, locale)
    if (!process.browser) return
    document.documentElement.lang = HTML_LANG[locale]
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, locale)
    } catch (e) {
      // Storage unavailable (private mode, blocked cookies): session only.
    }
  },
  setViewMode({ commit }, mode) {
    if (!VIEW_MODES.includes(mode)) return
    commit(SET_VIEW_MODE, mode)
  },
  getPosts(files) {
    return files.keys().map((key) => {
      let res = files(key)
      res.slug = key.slice(2, -5)
      return res
    })
  },
  async nuxtServerInit({ commit }) {
    // News collection type
    let newsFiles = await require.context('~/assets/content/news/', false, /\.json$/)
    await commit(SET_NEWS, actions.getPosts(newsFiles))

    // Project collection type
    let projectFiles = await require.context('~/assets/content/projects/', false, /\.json$/)
    await commit(SET_PROJECTS, actions.getPosts(projectFiles))

    // Set current project if it exists with regex if project name is after /works/
    /*
    const projectId = req.url.split('/').pop()
    if (projectId) {
      const project = state.projects.find(project => project.slug === projectId)
      if (project) await commit(SET_CURRENT_PROJECT, project)
    }
    */
    // ? When adding/changing NetlifyCMS collection types, make sure to:
    // ? 1. Add/rename exact slugs here
    // ? 2. Add/rename the MUTATION_TYPE names in `./mutations.type.js`
    // ? 3. Add/rename `pages/YOUR_SLUG_HERE` and use the Vuex store like the included examples
    // ? If you are adding, add a state, mutation and commit (like above) for it too
  }
}