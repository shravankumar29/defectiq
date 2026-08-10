import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  // Provide fallback dev/guest user if unauthenticated so dashboard is accessible
  if (!user) {
    user = {
      id: 1,
      openId: "dev-user-001",
      name: "Plant Engineer",
      email: "engineer@defectiq.ai",
      loginMethod: "demo",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLoginAt: new Date(),
    } as any;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}

