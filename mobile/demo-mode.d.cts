export const LIVE_URL: string;
export const LIVE_PUBLIC_KEY: string;
export const BETA_CHANNEL: string;
export const BETA_RUNTIME: string;
export function resolveDemoBuild(input: { demo?: string; review?: string; url?: string; key?: string; auth?: string; booking?: string; registration?: string; channel?: string }): boolean;
export function createDemoRuntime(selectable: boolean, reviewOnly?: boolean): Readonly<{
  ready: boolean; enabled: boolean; initialize(stored: string | null | undefined): void; assertReady(): void;
}>;
