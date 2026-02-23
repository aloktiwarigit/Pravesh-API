// This file MUST be a module (has top-level export) so that the
// `declare module 'zod'` block below is a module augmentation that
// merges with the real zod types, rather than overriding them.
export {};

declare module 'zod' {
  interface ZodOpenApiMetadata {
    description?: string;
    example?: unknown;
    examples?: Record<string, unknown>;
    deprecated?: boolean;
    title?: string;
    ref?: string;
    [key: string]: unknown;
  }

  interface ZodType<Output = unknown, Def extends ZodTypeDef = ZodTypeDef, Input = Output> {
    openapi(metadata: ZodOpenApiMetadata): this;
    openapi(refId: string, metadata?: ZodOpenApiMetadata): this;
  }
}
