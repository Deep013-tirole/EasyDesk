import { httpServerHandler } from 'cloudflare:node';
import bcrypt from 'bcryptjs';

// Robust random fallback for bcrypt in Cloudflare Worker & edge runtime
if (bcrypt && typeof bcrypt.setRandomFallback === 'function') {
  bcrypt.setRandomFallback((len: number) => {
    const buf = new Uint8Array(len);
    if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function') {
      globalThis.crypto.getRandomValues(buf);
    } else {
      for (let i = 0; i < len; i++) {
        buf[i] = Math.floor(Math.random() * 256);
      }
    }
    return Array.from(buf);
  });
}

// Set worker execution flag to prevent standalone server boot
process.env.IS_WORKER = 'true';

import { app } from '../server.js';

// Start Express server on virtual worker port 3000
const server = app.listen(3000);

// Export Cloudflare Workers HTTP server handler
export default httpServerHandler({ port: 3000 });

