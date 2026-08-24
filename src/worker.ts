import bcrypt from 'bcryptjs';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';

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

import { app, ensureDatabaseReady } from '../server.js';

/**
 * Bridges a standard Web Request to Express without opening any TCP sockets or calling app.listen().
 */
async function handleExpressRequest(expressApp: any, webReq: Request): Promise<Response> {
  const urlObj = new URL(webReq.url);
  const path = urlObj.pathname + urlObj.search;

  let bodyBuffer: Buffer = Buffer.alloc(0);
  if (webReq.body && webReq.method !== 'GET' && webReq.method !== 'HEAD') {
    try {
      const arrayBuf = await webReq.arrayBuffer();
      bodyBuffer = Buffer.from(arrayBuf);
    } catch {
      bodyBuffer = Buffer.alloc(0);
    }
  }

  // Extract client IP safely from Cloudflare edge headers or standard proxy headers
  const cfIp = webReq.headers.get('cf-connecting-ip');
  const xForwardedFor = webReq.headers.get('x-forwarded-for');
  const clientIp = cfIp || (xForwardedFor ? xForwardedFor.split(',')[0].trim() : '127.0.0.1');

  const socket = new Socket();
  // Safe socket address definitions for any Express middleware expecting TCP metadata
  Object.defineProperty(socket, 'remoteAddress', {
    value: clientIp,
    writable: true,
    configurable: true,
    enumerable: true
  });
  Object.defineProperty(socket, 'remotePort', {
    value: 443,
    writable: true,
    configurable: true,
    enumerable: true
  });

  const req = new IncomingMessage(socket);
  req.method = webReq.method;
  req.url = path;
  req.headers = {};

  for (const [k, v] of webReq.headers.entries()) {
    req.headers[k.toLowerCase()] = v;
  }

  if (cfIp && !req.headers['cf-connecting-ip']) {
    req.headers['cf-connecting-ip'] = cfIp;
  }
  if (xForwardedFor && !req.headers['x-forwarded-for']) {
    req.headers['x-forwarded-for'] = xForwardedFor;
  }

  try {
    if (!(req as any).socket) {
      Object.defineProperty(req, 'socket', { value: socket, configurable: true, writable: true });
    }
  } catch {}
  try {
    if (!(req as any).connection) {
      Object.defineProperty(req, 'connection', { value: socket, configurable: true, writable: true });
    }
  } catch {}
  try {
    Object.defineProperty(req, 'ip', { value: clientIp, configurable: true, writable: true });
  } catch {
    (req as any).ip = clientIp;
  }

  if (!req.headers['content-length'] && bodyBuffer.length > 0) {
    req.headers['content-length'] = String(bodyBuffer.length);
  }
  if (!req.headers.host) {
    req.headers.host = urlObj.host;
  }

  return new Promise<Response>((resolve, reject) => {
    const res = new ServerResponse(req);
    const bodyChunks: Buffer[] = [];

    // Intercept response write and end to collect buffers
    res.write = function(chunk: any, encoding?: any, cb?: any): boolean {
      if (chunk) {
        bodyChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, (typeof encoding === 'string' ? encoding : 'utf8') as BufferEncoding));
      }
      if (typeof encoding === 'function') encoding();
      else if (typeof cb === 'function') cb();
      return true;
    };

    res.end = function(chunk?: any, encoding?: any, cb?: any): any {
      if (chunk) {
        bodyChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, (typeof encoding === 'string' ? encoding : 'utf8') as BufferEncoding));
      }

      const status = res.statusCode || 200;
      const headers = new Headers();
      const rawHeaders = res.getHeaders();

      for (const [name, val] of Object.entries(rawHeaders)) {
        if (Array.isArray(val)) {
          for (const item of val) {
            headers.append(name, String(item));
          }
        } else if (val !== undefined && val !== null) {
          headers.set(name, String(val));
        }
      }

      const body = Buffer.concat(bodyChunks);
      if (typeof encoding === 'function') encoding();
      else if (typeof cb === 'function') cb();

      resolve(new Response(body.length > 0 ? body : null, {
        status,
        statusText: res.statusMessage || undefined,
        headers
      }));
      return this;
    };

    if (bodyBuffer.length > 0) {
      req.push(bodyBuffer);
    }
    req.push(null);

    expressApp(req, res, (err: any) => {
      if (err) {
        console.error('Express handler error:', err);
        resolve(new Response(JSON.stringify({ error: 'Internal Server Error', message: String(err?.message || err) }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }));
      } else {
        resolve(new Response(JSON.stringify({ error: 'Not Found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }));
      }
    });
  });
}

export interface Env {
  ASSETS?: {
    fetch: (request: Request) => Promise<Response>;
  };
}

export default {
  async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
    const url = new URL(request.url);

    // Route API requests directly to the Express backend
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/')) {
      if (typeof ensureDatabaseReady === 'function') {
        try {
          await ensureDatabaseReady();
        } catch (e) {
          console.error('[WORKER] Error awaiting database hydration:', e);
        }
      }
      return handleExpressRequest(app, request);
    }

    // Serve static assets and SPA fallback
    if (env && env.ASSETS && typeof env.ASSETS.fetch === 'function') {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not Found', { status: 404 });
  }
};
