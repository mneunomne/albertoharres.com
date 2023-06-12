import { SET_NEWS, SET_PROJECTS } from './mutations.type'

export const state = () => ({
  news: [],
  projects: [],
})

export const mutations = {
  [SET_NEWS](state, list) {
    state.news = list
  },
  [SET_PROJECTS](state, list) {
    state.projects = list
  }
}

export const actions = {
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

    // ? When adding/changing NetlifyCMS collection types, make sure to:
    // ? 1. Add/rename exact slugs here
    // ? 2. Add/rename the MUTATION_TYPE names in `./mutations.type.js`
    // ? 3. Add/rename `pages/YOUR_SLUG_HERE` and use the Vuex store like the included examples
    // ? If you are adding, add a state, mutation and commit (like above) for it too
  }
}
