// Vercel's zero-config convention: any file under <Root Directory>/api
// automatically becomes a serverless function, and /api/* requests route to
// it with no vercel.json needed. This just re-exports the existing Express
// app (backend/src/index.js already exports it and only calls .listen()
// when NOT running on Vercel) so none of the backend code has to change.
export { default } from '../../backend/src/index.js';
