import { httpServerHandler } from 'cloudflare:node';
import { app } from '../server.js';

// Set worker execution flag to prevent standalone server boot
process.env.IS_WORKER = 'true';

// Start Express server on virtual worker port 3000
const server = app.listen(3000);

// Export Cloudflare Workers HTTP server handler
export default httpServerHandler({ port: 3000 });
