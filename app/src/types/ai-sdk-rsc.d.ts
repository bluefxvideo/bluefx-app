/**
 * Minimal local type shim for '@ai-sdk/rsc', which is not installed as a dependency.
 * Only referenced by src/actions/tools/content-multiplier-orchestrator.ts
 * (currently not imported anywhere at runtime).
 */
declare module '@ai-sdk/rsc' {
  export interface StreamableValue<T = string> {
    readonly value: T;
    update(value: T): void;
    done(value?: T): void;
    error(error: unknown): void;
  }
  export function createStreamableValue<T = string>(initialValue?: T): StreamableValue<T>;
}
