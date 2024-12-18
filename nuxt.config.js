import glob from 'glob'
import path from 'path'
import * as SITE_INFO from './assets/content/site/info.json'

const dynamicContentPath = 'assets/content' // ? No prepending/appending backslashes here
const dynamicRoutes = getDynamicPaths(
  {
    news: 'news/*.json',
    projects: 'projects/*.json'
  },
  dynamicContentPath
)

export default {
  // ? The env Property: https://nuxtjs.org/api/configuration-env/
  env: {
    url:
      process.env.NODE_ENV === 'production'
        ? process.env.URL || 'http://createADotEnvFileAndSetURL'
        : 'http://localhost:3000',
    lang: SITE_INFO.sitelang || 'en-US'
  },
  /*
   ** Headers of the page
   */
  head: {
    title: SITE_INFO.sitename || process.env.npm_package_name || '',
    meta: [
      { charset: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1, maximum-scale=1.0, user-scalable=no' },
      {
        hid: 'description',
        name: 'description',
        content: SITE_INFO.sitedescription || process.env.npm_package_description || ''
      }
    ],
    link: [
      {
        rel: 'preconnect',
        href: 'https://fonts.gstatic.com'
      },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Karla:ital,wght@0,400;0,700;1,400&display=swap'
      },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400;1,700&display=swap'
      },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Libre+Bodoni:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700&display=swap'
      },
      {
        ref: 'icon',
        href: 'favicon.ico',
        type: 'image/x-icon'
      }
    ]
  },
  generate: {
    routes: dynamicRoutes,
    fallback: true,
    subFolders: false
  },
  render: {
    bundleRenderer: {
      shouldPreload: (file, type) => {
        return ['script', 'style', 'font'].includes(type)
      }
    }
  },
  css: ['~assets/css/main.scss'],
  /*
    ** vue plugins
  */
  plugins: [
    {
      src: '~/plugins/vue-static.js',
      mode: 'client'
    },
    {
      src: '~plugins/vue-gallery.client.js',
      mode: 'client'
    }
  ],
  /*
  ** Global CSS
  */
  buildModules: ['@nuxtjs/style-resources', '@nuxtjs/google-analytics'],
  modules: [
    [
      '@nuxtjs/i18n',
      {
        locales: ['en', 'pt'],
        defaultLocale: 'en',
        vueI18n: {
          fallbackLocale: 'en',
          messages: {
            en: {
              greeting: 'Hello world!'
            },
            es: {
              greeting: '¡Hola mundo!'
            }
          }
        }
      }
    ]
  ],
  i18n: {
    locales: [
      { code: 'en', language: 'en-US' },
      { code: 'pt', language: 'pt-BR' }
    ],
    defaultLocale: 'en',
  },
  googleAnalytics: {
    id: 'G-JLSY3TWTM2'
  },
  styleResources: {
    scss: ['./assets/css/*.scss']
  },
  /*
   ** Build configuration
   */
  build: {
    transpile: [
      'three',
      'three-spritetext'
    ],
    extractCSS: true,
    /*
     ** You can extend webpack config here
     */
    extend(config) {
      config.module.rules.push({
        test: /\.mjs$/,
        include: /node_modules/,
        type: 'javascript/auto',
      })
    },
  }
}

/**
 * Create an array of URLs from a list of files
 * @param {*} urlFilepathTable - example below
 * {
 *   news: 'news/*.json',
 *   projects: 'projects/*.json'
 * }
 *
 * @return {Array} - Will return those files into urls for SSR generated .html's like
 * [
 *   /news/2019-08-27-incidunt-laborum-e ,
 *   /projects/story-test-story-1
 * ]
 */
function getDynamicPaths(urlFilepathTable, cwdPath) {
  console.log('Going to generate dynamicRoutes for these collection types: ', urlFilepathTable)
  const dynamicPaths = [].concat(
    ...Object.keys(urlFilepathTable).map(url => {
      const filepathGlob = urlFilepathTable[url]
      return glob.sync(filepathGlob, { cwd: cwdPath }).map(filepath => {
        return `/${url}/${path.basename(filepath, '.json')}`
      })
    })
  )
  console.log('Found these dynamicPaths that will be SSR generated:', dynamicPaths)
  return dynamicPaths
}
