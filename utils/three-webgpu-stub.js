// Stub for the `three/webgpu` entry point.
//
// three-render-objects (a dependency of 3d-force-graph) does
// `import { WebGPURenderer } from 'three/webgpu'`, but only instantiates it
// when its `useWebGPU` option is true, and 3d-force-graph never exposes that
// option, so this site always renders with WebGLRenderer.
//
// `three/webgpu` only exists as a package.json `exports` subpath, which
// webpack 4 (used by Nuxt 2) does not understand, so nuxt.config.js aliases it
// here instead of pulling the ~1.3 MB WebGPU renderer into the bundle.
export const WebGPURenderer = undefined;
