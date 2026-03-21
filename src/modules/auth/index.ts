/**
 * Auth module — downstream API key authentication and request context. [AC2]
 */

export { registerAuthPreHandler } from "./http/pre-handler.js";
export type { AuthPreHandlerDeps } from "./http/pre-handler.js";
export { AuthService, hashKey } from "./service/auth-service.js";
export type { AuthServiceDeps } from "./service/auth-service.js";
