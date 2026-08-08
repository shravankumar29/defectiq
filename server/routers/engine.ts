
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";

const ENGINE = process.env.ENGINE_URL || "http://127.0.0.1:8901";

const ENGINE_SECRET = process.env.ENGINE_SECRET || "defectiq-internal";

async function relayJson(
  path: string,
  opts: { method?: "GET" | "POST"; body?: unknown } = {}
): Promise<unknown> {
  const method = opts.method ?? "GET";
  const res = await fetch(`${ENGINE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: opts.body !== undefined ? JSON.stringify({ secret: ENGINE_SECRET, ...opts.body }) : undefined,
  });
  if (!res.ok) {
    let detail = `Engine ${path} failed: ${res.status}`;
    try {
      const j = await res.json();
      if (j?.detail) detail = String(j.detail);
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  return res.json();
}

export const engineRouter = router({
  status: publicProcedure.query(() => relayJson("/status")),

  generate: publicProcedure.mutation(() => relayJson("/generate", { method: "POST", body: { rows: 20000 } })),

  upload: publicProcedure
    .input(z.object({ csv_base64: z.string().min(1) }))
    .mutation(({ input }) => relayJson("/upload", { method: "POST", body: { csv_base64: input.csv_base64 } })),

  results: publicProcedure.query(() => relayJson("/results")),

  copilot: publicProcedure
    .input(z.object({ question: z.string().min(1).max(2000) }))
    .mutation(({ input }) => relayJson("/copilot", { method: "POST", body: { question: input.question } })),

  reportPdf: publicProcedure.query(() => relayJson("/report/pdf")),

  reportCsv: publicProcedure.query(() => relayJson("/report/csv")),
});
