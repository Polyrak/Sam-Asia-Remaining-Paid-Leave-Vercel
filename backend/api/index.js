// Vercel's zero-config convention: any file under <Root Directory>/api
// automatically becomes a serverless function. With this project's Root
// Directory set to "backend", this makes /* requests here route to the
// existing Express app — a plain `npm install` scoped to backend/ already
// gives it everything it needs, no cross-directory dependency tricks needed.
export { default } from '../src/index.js';
