/**
 * UploadThing route handler — Next.js App Router endpoint.
 * Auto-generate dari fileRouter di ./core.ts.
 */
import { createRouteHandler } from "uploadthing/next";
import { ourFileRouter } from "./core";

export const { GET, POST } = createRouteHandler({
  router: ourFileRouter,
});
