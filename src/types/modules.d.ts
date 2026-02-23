// Ambient module declarations for packages whose types are missing or
// whose @types/* packages are not installed in node_modules.

// pino-http: @types/pino-http is listed in devDependencies but the installed
// version may not resolve automatically. Declare a minimal interface that
// satisfies the usage in server.ts (logger option + callback options).
declare module 'pino-http' {
  import { IncomingMessage, ServerResponse } from 'http';
  import { Logger } from 'pino';

  interface Options {
    logger?: Logger;
    genReqId?: (req: IncomingMessage) => string | undefined;
    customLogLevel?: (
      req: IncomingMessage,
      res: ServerResponse,
      err: Error | undefined,
    ) => string;
    customSuccessMessage?: (req: IncomingMessage, res: ServerResponse) => string;
    customErrorMessage?: (req: IncomingMessage, res: ServerResponse) => string;
    [key: string]: unknown;
  }

  function pinoHttp(options?: Options): (req: IncomingMessage, res: ServerResponse, next: () => void) => void;
  export = pinoHttp;
}

// rate-limit-redis: no @types/* package exists; declare the named export used
// in server.ts (RedisStore constructor that accepts a sendCommand option).
declare module 'rate-limit-redis' {
  interface RedisStoreOptions {
    sendCommand: (...args: string[]) => Promise<unknown> | unknown;
    [key: string]: unknown;
  }

  export class RedisStore {
    constructor(options: RedisStoreOptions);
  }
}

// ioredis: the package ships its own TypeScript declarations (built-in types).
// If @types/ioredis (v4) is installed alongside ioredis v5 the types may
// conflict. Declare a minimal shim so the import in server.ts resolves cleanly
// regardless of which type package is active.
declare module 'ioredis' {
  interface RedisOptions {
    [key: string]: unknown;
  }

  export class Redis {
    constructor(url: string, options?: RedisOptions);
    on(event: string, listener: (...args: unknown[]) => void): this;
    call(command: string, ...args: unknown[]): Promise<unknown>;
    [key: string]: unknown;
  }
}

// pino: v10 ships its own TypeScript declarations, but if the package is not
// yet installed (or its built-in types fail to resolve) this minimal shim
// satisfies all usages in logger.ts.
declare module 'pino' {
  interface LogFn {
    (msg: string, ...args: unknown[]): void;
    (obj: object, msg?: string, ...args: unknown[]): void;
  }

  interface Logger {
    trace: LogFn;
    debug: LogFn;
    info: LogFn;
    warn: LogFn;
    error: LogFn;
    fatal: LogFn;
    child(bindings: Record<string, unknown>): Logger;
    [key: string]: unknown;
  }

  interface TransportTargetOptions {
    target: string;
    options?: Record<string, unknown>;
    level?: string;
  }

  interface Options {
    level?: string;
    transport?: { target: string; options?: Record<string, unknown> } | { targets: TransportTargetOptions[] };
    formatters?: {
      level?: (label: string, number: number) => Record<string, unknown>;
      bindings?: (bindings: Record<string, unknown>) => Record<string, unknown>;
      log?: (obj: Record<string, unknown>) => Record<string, unknown>;
    };
    timestamp?: (() => string) | boolean;
    base?: Record<string, unknown> | null;
    redact?: { paths: string[]; remove?: boolean } | string[];
    [key: string]: unknown;
  }

  interface StdTimeFunctions {
    epochTime(): string;
    unixTime(): string;
    isoTime(): string;
    nullTime(): string;
  }

  function pino(options?: Options): Logger;
  namespace pino {
    export const stdTimeFunctions: StdTimeFunctions;
    export type Logger = import('pino').Logger;
  }

  export = pino;
}

// @asteasolutions/zod-to-openapi: declares the OpenAPI extension for Zod.
// This shim satisfies all imports in zod-schemas.ts and zod-schemas.example.ts
// when the package is not yet installed or its types fail to resolve.
declare module '@asteasolutions/zod-to-openapi' {
  import { ZodType, ZodTypeDef } from 'zod';

  interface ZodOpenApiMetadata {
    description?: string;
    example?: unknown;
    examples?: Record<string, unknown>;
    deprecated?: boolean;
    title?: string;
    [key: string]: unknown;
  }

  // Augments Zod types with the .openapi() method.
  function extendZodWithOpenApi(zod: { ZodType: typeof ZodType }): void;

  class OpenAPIRegistry {
    definitions: RouteConfig[];
    register<T extends ZodType<unknown, ZodTypeDef, unknown>>(
      refId: string,
      schema: T,
    ): T;
    registerPath(config: RouteConfig): void;
    registerComponent(
      type: string,
      name: string,
      component: unknown,
    ): unknown;
  }

  interface RouteConfig {
    [key: string]: unknown;
  }

  interface GeneratedComponents {
    components?: {
      schemas?: Record<string, unknown>;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  }

  class OpenApiGeneratorV3 {
    constructor(definitions: RouteConfig[]);
    generateComponents(): GeneratedComponents;
    generateDocument(config: Record<string, unknown>): Record<string, unknown>;
  }

  class OpenApiGeneratorV31 {
    constructor(definitions: RouteConfig[]);
    generateComponents(): GeneratedComponents;
    generateDocument(config: Record<string, unknown>): Record<string, unknown>;
  }
}

// applicationinsights: Azure Application Insights SDK. The package is installed
// but may not ship type declarations in all environments.
declare module 'applicationinsights' {
  interface TelemetryClient {
    context: {
      tags: Record<string, string>;
      keys: { cloudRole: string; [key: string]: string };
    };
    trackEvent(event: { name: string; properties?: Record<string, string> }): void;
    trackMetric(metric: { name: string; value: number }): void;
    trackException(exception: { exception: Error }): void;
    [key: string]: unknown;
  }

  enum DistributedTracingModes {
    AI = 0,
    AI_AND_W3C = 1,
  }

  const defaultClient: TelemetryClient;

  function setup(connectionString?: string): {
    setAutoCollectRequests(value: boolean): ReturnType<typeof setup>;
    setAutoCollectPerformance(value: boolean, ...args: boolean[]): ReturnType<typeof setup>;
    setAutoCollectExceptions(value: boolean): ReturnType<typeof setup>;
    setAutoCollectDependencies(value: boolean): ReturnType<typeof setup>;
    setAutoCollectConsole(value: boolean): ReturnType<typeof setup>;
    setAutoDependencyCorrelation(value: boolean): ReturnType<typeof setup>;
    setDistributedTracingMode(mode: DistributedTracingModes): ReturnType<typeof setup>;
    setSendLiveMetrics(value: boolean): ReturnType<typeof setup>;
    start(): void;
  };
}

// Zod augmentation is in a separate file (zod-openapi.d.ts) so it acts as
// a module augmentation rather than overriding the real zod package types.
