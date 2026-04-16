/**
 * Render/Deployment Bridge
 * This file redirects to the compiled TypeScript output.
 */
try {
  require('./dist/index.js');
} catch (error) {
  if (error.code === 'MODULE_NOT_FOUND' && (error.message.includes('./dist/index.js') || error.message.includes('Cannot find module'))) {
    console.error('❌ Error: Compiled server not found in dist/ folder.');
    console.error('👉 Make sure you ran "npm run build" (tsc) before starting the server.');
  }
  throw error;
}
