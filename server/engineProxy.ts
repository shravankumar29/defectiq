import express from "express";

/**
 * Proxy to the internal Python analysis engine (FastAPI on localhost:8901).
 * All analytics (pattern mining, CUSUM, clustering, copilot, reports) live in
 * Python; the Node server simply relays JSON over this internal boundary.
 */
const ENGINE_URL = process.env.ENGINE_URL || "http://127.0.0.1:8901";
const SECRET = process.env.ENGINE_SECRET || "defectiq-internal";

export function engineRouter(): express.Router {
  const router = express.Router();

  async function relay(path: string, opts: RequestInit = {}) {
    const res = await fetch(`${ENGINE_URL}${path}`, {
      ...opts,
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) {
      const text = await res.text();
      const msg = text.includes("detail") ? text : `Engine error ${res.status}`;
      throw new Error(msg);
    }
    return res.json();
  }

  router.get("/status", async (_req, res) => {
    try {
      const data = await relay("/status");
      res.json({ ok: true, data });
    } catch (e) {
      res.json({ ok: false, data: { loaded: false } });
    }
  });

  router.post("/generate", async (_req, res) => {
    try {
      const data = await relay("/generate", {
        method: "POST",
        body: JSON.stringify({ secret: SECRET, rows: 20000 }),
      });
      res.json({ ok: true, data });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e) });
    }
  });

  router.post("/upload", async (req, res) => {
    try {
      const data = await relay("/upload", {
        method: "POST",
        body: JSON.stringify({ secret: SECRET, csv_base64: req.body.csv_base64 }),
      });
      res.json({ ok: true, data });
    } catch (e) {
      res.status(400).json({ ok: false, error: String(e) });
    }
  });

  router.get("/results", async (_req, res) => {
    try {
      const data = await relay("/results");
      res.json({ ok: true, data });
    } catch (e) {
      res.status(404).json({ ok: false, error: String(e) });
    }
  });

  router.post("/copilot", async (req, res) => {
    try {
      const data = await relay("/copilot", {
        method: "POST",
        body: JSON.stringify({ secret: SECRET, question: req.body.question || "" }),
      });
      res.json({ ok: true, data });
    } catch (e) {
      res.json({
        ok: true,
        data: {
          answer:
            "Copilot is temporarily unavailable — computed data on this page remains the source of truth. Correlation is not causation.",
          sources_used: false,
          fallback: true,
        },
      });
    }
  });

  router.get("/report/pdf", async (_req, res) => {
    try {
      const data = await relay("/report/pdf");
      res.json({ ok: true, data });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e) });
    }
  });

  router.get("/report/csv", async (_req, res) => {
    try {
      const data = await relay("/report/csv");
      res.json({ ok: true, data });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e) });
    }
  });

  return router;
}
