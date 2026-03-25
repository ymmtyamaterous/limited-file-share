import type { RouterClient } from "@orpc/server";

import { protectedProcedure, publicProcedure } from "../index";
import {
  shareCreate,
  shareDelete,
  shareDownload,
  shareGetMeta,
  shareUnlock,
} from "./share";

export const appRouter = {
  healthCheck: publicProcedure.handler(() => {
    return "OK";
  }),
  privateData: protectedProcedure.handler(({ context }) => {
    return {
      message: "This is private",
      user: context.session?.user,
    };
  }),
  share: {
    create: shareCreate,
    unlock: shareUnlock,
    download: shareDownload,
    delete: shareDelete,
    getMeta: shareGetMeta,
  },
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
