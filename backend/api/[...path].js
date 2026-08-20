// Vercel's file-based API routing maps a file 1:1 to its own path — plain
// api/index.js would ONLY match the literal route "/api", not "/api/health"
// or any other sub-path. A catch-all filename ([...path].js) is required to
// forward every "/api/*" request to this one function, preserving the full
// original URL (e.g. "/api/health") that the Express app's own routing
// (mounted at "/api") expects to see.
export { default } from '../src/index.js';
