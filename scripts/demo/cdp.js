// A small Chrome DevTools Protocol client for the page of the app that
// app.js starts: commands, events, and running code in the page.

import { setTimeout as sleep } from "node:timers/promises";

/** The page's WebSocket URL, once the app is up (the first start compiles it). */
async function pageUrl(port, timeoutMs) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      const page = targets.find((t) => t.type === "page" && t.url.includes("localhost:1420"));
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      /* not listening yet */
    }
    await sleep(1000);
  }
  throw new Error(`no Heron page on port ${port}`);
}

export async function connect(port, timeoutMs = 300_000) {
  const ws = new WebSocket(await pageUrl(port, timeoutMs));
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  let nextId = 1;
  const pending = new Map();
  const listeners = new Map();
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id === undefined) {
      listeners.get(msg.method)?.forEach((fn) => fn(msg.params));
      return;
    }
    const call = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) call?.reject(new Error(`${call.method}: ${msg.error.message}`));
    else call?.resolve(msg.result);
  };

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { method, resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });

  /** Calls fn for each `method` event; returns the unsubscribe function. */
  const on = (method, fn) => {
    if (!listeners.has(method)) listeners.set(method, new Set());
    listeners.get(method).add(fn);
    return () => listeners.get(method).delete(fn);
  };

  /** The value of a page expression (awaited when it is a promise). */
  async function js(expression) {
    const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) {
      throw new Error(`${expression}: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
    }
    return r.result.value;
  }

  /** Polls a page expression until it is truthy, and returns that value. */
  async function waitFor(expression, timeoutMs = 15_000) {
    const end = Date.now() + timeoutMs;
    for (;;) {
      const value = await js(expression).catch(() => undefined);
      if (value) return value;
      if (Date.now() > end) throw new Error(`timed out waiting for ${expression}`);
      await sleep(100);
    }
  }

  return { send, on, js, waitFor, close: () => ws.close() };
}
