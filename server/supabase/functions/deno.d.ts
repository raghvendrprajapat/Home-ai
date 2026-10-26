// Type checking only (tsc in `pnpm typecheck`): the few Deno and npm: names the function entry points use. Supabase's
// Edge Runtime (Deno) provides the real ones; nothing here is deployed.
declare namespace Deno {
  function serve(handler: (request: Request) => Response | Promise<Response>): unknown;
  const env: { get(name: string): string | undefined };
}
declare module 'npm:@supabase/supabase-js@2.117.2' {
  export function createClient(url: string, key: string, options?: Record<string, unknown>): unknown;
}
