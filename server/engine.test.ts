import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

const USER: AuthenticatedUser = {
  id: 1,
  openId: "test-user",
  email: "test@example.com",
  name: "Test User",
  loginMethod: "manus",
  role: "user",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

function createContext(): TrpcContext {
  return {
    user: USER,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: () => undefined,
    } as unknown as TrpcContext["res"],
  };
}

type FetchCall = { url: string; init: RequestInit | undefined };

function withFetchMock(responses: Record<string, { body: unknown; ok?: boolean }>) {
  const calls: FetchCall[] = [];
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    const entry = responses[url];
    if (!entry) {
      return { ok: false, status: 404, json: async () => ({ detail: `No mock for ${url}` }) };
    }
    return {
      ok: entry.ok ?? true,
      status: entry.ok === false ? 500 : 200,
      json: async () => entry.body,
    } as Response;
  });
  return { fn, calls };
}

// The relay resolves paths against the ENGINE base URL (http://127.0.0.1:8901).
const ENGINE = process.env.ENGINE_URL || "http://127.0.0.1:8901";

describe("engine tRPC relay procedures", () => {
  const statusBody = { loaded: true, rows: 20000, defect_rate_pct: 4.2 };
  const generateBody = { ok: true, rows: 20000, defect_rate_pct: 4.2 };
  const copilotBody = {
    answer:
      "Pattern #3 (machine M04, shift C, high temperature) is associated with elevated surface defects. This is an association, not a proven cause.",
    sources_used: ["patterns", "contribution"],
    causal_language_ok: true,
  };

  it("status relays GET /api/engine/status and returns loaded state", async () => {
    const { fn, calls } = withFetchMock({ [`${ENGINE}/status`]: { body: statusBody } });
    vi.stubGlobal("fetch", fn);
    const caller = appRouter.createCaller(createContext());
    const data = await caller.engine.status();
    expect(data).toEqual(statusBody);
    expect(calls[0]?.url).toBe(`${ENGINE}/status`);
    expect(calls[0]?.init?.method ?? "GET").toBe("GET");
    vi.unstubAllGlobals();
  });

  it("generate relays POST /api/engine/generate with secret and rows", async () => {
    const { fn, calls } = withFetchMock({ [`${ENGINE}/generate`]: { body: generateBody } });
    vi.stubGlobal("fetch", fn);
    const caller = appRouter.createCaller(createContext());
    const data = await caller.engine.generate();
    expect(data).toEqual(generateBody);
    const body = JSON.parse(String(calls[0]?.init?.body));
    expect(body.secret).toBe("defectiq-internal");
    expect(body.rows).toBe(20000);
    vi.unstubAllGlobals();
  });

  it("copilot relays POST with question and strips bad causal language", async () => {
    const { fn } = withFetchMock({ [`${ENGINE}/copilot`]: { body: copilotBody } });
    vi.stubGlobal("fetch", fn);
    const caller = appRouter.createCaller(createContext());
    const data = (await caller.engine.copilot({ question: "Top pattern?" })) as any;
    expect(String(data.answer)).toContain("associated with");
    expect(data.sources_used).toEqual(["patterns", "contribution"]);
    vi.unstubAllGlobals();
  });

  it("upload relays POST with csv_base64", async () => {
    const { fn, calls } = withFetchMock({
      [`${ENGINE}/upload`]: { body: { ok: true, rows: 120, defect_rate_pct: 3.1 } },
    });
    vi.stubGlobal("fetch", fn);
    const caller = appRouter.createCaller(createContext());
    await caller.engine.upload({ csv_base64: "dGVzdA==" });
    const body = JSON.parse(String(calls[0]?.init?.body));
    expect(body.csv_base64).toBe("dGVzdA==");
    expect(body.secret).toBe("defectiq-internal");
    vi.unstubAllGlobals();
  });

  it("results query relays GET /api/engine/results", async () => {
    const payload = { patterns: [], recommendations: [] };
    const { fn, calls } = withFetchMock({ [`${ENGINE}/results`]: { body: payload } });
    vi.stubGlobal("fetch", fn);
    const caller = appRouter.createCaller(createContext());
    const data = await caller.engine.results();
    expect(data).toEqual(payload);
    expect(calls[0]?.url).toBe(`${ENGINE}/results`);
    vi.unstubAllGlobals();
  });

  it("engine failure surfaces a readable error", async () => {
    const { fn } = withFetchMock({ [`${ENGINE}/status`]: { body: { detail: "engine down" }, ok: false } });
    vi.stubGlobal("fetch", fn);
    const caller = appRouter.createCaller(createContext());
    await expect(caller.engine.status()).rejects.toThrow(/engine down/);
    vi.unstubAllGlobals();
  });
});

describe("engine report relays", () => {
  it("reportPdf relays GET /api/engine/report/pdf", async () => {
    const { fn, calls } = withFetchMock({ [`${ENGINE}/report/pdf`]: { body: "JVBER..." } });
    vi.stubGlobal("fetch", fn);
    const caller = appRouter.createCaller(createContext());
    await caller.engine.reportPdf();
    expect(calls[0]?.url).toBe(`${ENGINE}/report/pdf`);
    expect(calls[0]?.init?.method ?? "GET").toBe("GET");
    vi.unstubAllGlobals();
  });

  it("reportCsv relays GET /api/engine/report/csv", async () => {
    const { fn, calls } = withFetchMock({ [`${ENGINE}/report/csv`]: { body: "date,machine\n" } });
    vi.stubGlobal("fetch", fn);
    const caller = appRouter.createCaller(createContext());
    await caller.engine.reportCsv();
    expect(calls[0]?.url).toBe(`${ENGINE}/report/csv`);
    expect(calls[0]?.init?.method ?? "GET").toBe("GET");
    vi.unstubAllGlobals();
  });
});
