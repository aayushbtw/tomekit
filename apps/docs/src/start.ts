import { createStart } from "@tanstack/react-start";
import { staticFunctionMiddleware } from "@tanstack/start-static-server-functions";

export const startInstance = createStart(() => ({
  functionMiddleware: [staticFunctionMiddleware],
}));
