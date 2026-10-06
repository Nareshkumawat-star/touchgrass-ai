/**
 * Plain (non-module) CSS imports are handled by the bundler; TypeScript needs
 * to be told they exist — e.g. `import "leaflet/dist/leaflet.css"`.
 */
declare module "*.css";
