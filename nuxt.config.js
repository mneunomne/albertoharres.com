import glob from "glob";
import path from "path";
import * as SITE_INFO from "./assets/content/site/info.json";

const dynamicContentPath = "assets/content"; // ? No prepending/appending backslashes here
const dynamicRoutes = getDynamicPaths(
	{
		news: "news/*.json",
		"": "projects/*.json", // project pages are at the root: /<slug>
	},
	dynamicContentPath
);

export default {
	// ? The env Property: https://nuxtjs.org/api/configuration-env/
	env: {
		url:
			process.env.NODE_ENV === "production"
				? process.env.URL || "http://createADotEnvFileAndSetURL"
				: "http://localhost:3000",
		lang: SITE_INFO.sitelang || "en-US",
	},
	/*
	 ** Headers of the page
	 */
	head: {
		title: SITE_INFO.sitename || process.env.npm_package_name || "",
		meta: [
			{ charset: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1.0, user-scalable=no" },
			{
				hid: "description",
				name: "description",
				content: SITE_INFO.sitedescription || process.env.npm_package_description || "",
			},
			{ property: "og:title", content: "Alberto Harres" },
			{ property: "og:url", content: "https://albertoharres.com" },
			{ property: "og:image", content: "https://albertoharres.com/img/preview.jpg" },
			{
				property: "keywords",
				content:
					"Alberto Harres, Artist, Technologist, Archives, Art and Technology, Digital Media, Visual Arts, Art Exhibitions, New Materialism, Archive",
			},
			{ property: "fediverse:creator", content: "@mneunomne@mastodon.social" },
		],
		link: [
			{
				ref: "icon",
				href: "favicon.ico",
				type: "image/x-icon",
			},
		],
		script: [
			{
				src: "https://www.googletagmanager.com/gtag/js?id=G-JLSY3TWTM2",
				async: true,
			},
			{
				src: "/js/ga.js",
			},
		],
	},
	generate: {
		routes: dynamicRoutes,
		fallback: true,
		subFolders: false,
	},
	router: {
		extendRoutes(routes, resolve) {
			// Project pages live at the root (/terra-inscrita), not under /works.
			// The page file stays at pages/works/_work.vue so its route keeps
			// the name "works-work" everywhere. It is moved to the end so the
			// static pages (/bio, /cv, /works) still win over the slug.
			const i = routes.findIndex((r) => r.name === "works-work");
			if (i !== -1) {
				const [work] = routes.splice(i, 1);
				work.path = "/:work";
				routes.push(work);
			}
			// Old /works/:slug links.
			routes.push({ path: "/works/:work", redirect: "/:work" });
			// Add a catch-all route that redirects to home
			routes.push({
				path: "*",
				redirect: "/",
			});
		},
	},
	render: {
		bundleRenderer: {
			shouldPreload: (file, type) => {
				return ["script", "style", "font"].includes(type);
			},
		},
	},
	css: ["~assets/css/main.scss"],
	/*
	 ** vue plugins
	 */
	plugins: [
		{
			src: "~/plugins/vue-static.js",
			mode: "client",
		},
		{
			src: "~plugins/vue-gallery.client.js",
			mode: "client",
		},
		"~/plugins/i18n.js",
	],
	/*
	 ** Global CSS
	 */
	modules: ["@nuxtjs/sitemap"],
	buildModules: ["@nuxtjs/style-resources", "@nuxtjs/google-analytics"],
	styleResources: {
		scss: ["./assets/css/*.scss"],
	},
	/*
	 ** Build configuration
	 */
	build: {
		transpile: ["three", "three-spritetext", "3d-force-graph"],
		babel: {
			// three >= r160 uses `static {}` class blocks. Nuxt's server build
			// targets the current Node version, so preset-env skips the transform
			// and never enables the parser syntax for it.
			plugins: ["@babel/plugin-transform-class-static-block"],
		},
		extractCSS: true,
		// Enable compression
		compress: true,
		// Enable webpack optimizations
		optimization: {
			splitChunks: {
				chunks: "all",
				cacheGroups: {
					// Only what the initial render needs goes into "vendors".
					// Packages used solely by async components (three,
					// 3d-force-graph, ... via the graph components) get their own
					// async vendor chunk, which phones never download.
					vendor: {
						test: /[\\/]node_modules[\\/]/,
						name: "vendors",
						chunks: "initial",
					},
				},
			},
		},
		/*
		 ** You can extend webpack config here
		 */
		extend(config) {
			// Always use three's ES module build. webpack 4 resolves `.mjs`
			// importers (3d-force-graph, three-render-objects, ...) through the
			// `main` field, and the server build prefers `main` too, which since
			// three r16x is a deprecated CommonJS shim that calls
			// process.emitWarning() and throws in the browser.
			config.resolve.alias["three$"] = path.resolve(
				__dirname,
				"node_modules/three/build/three.module.js"
			);
			// webpack 4 ignores package.json `exports`, so the `three/webgpu`
			// subpath imported by three-render-objects cannot be resolved.
			// See utils/three-webgpu-stub.js.
			config.resolve.alias["three/webgpu"] = path.resolve(
				__dirname,
				"utils/three-webgpu-stub.js"
			);
			config.module.rules.push({
				test: /\.mjs$/,
				include: /node_modules/,
				type: "javascript/auto",
			});
		},
	},
};

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
	console.log("Going to generate dynamicRoutes for these collection types: ", urlFilepathTable);
	const dynamicPaths = [].concat(
		...Object.keys(urlFilepathTable).map((url) => {
			const filepathGlob = urlFilepathTable[url];
			return glob.sync(filepathGlob, { cwd: cwdPath }).map((filepath) => {
				return `${url ? `/${url}` : ""}/${path.basename(filepath, ".json")}`;
			});
		})
	);
	console.log("Found these dynamicPaths that will be SSR generated:", dynamicPaths);
	return dynamicPaths;
}
