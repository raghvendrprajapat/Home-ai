// D86 room-ai-webhook (Supabase Edge Function, Deno; verify_jwt = false in ../../config.toml because fal cannot sign in
// to Supabase; every delivery's fal signature is checked instead). Logic and tests: ../_shared/webhook.ts.
import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import { fetchFalJwks, livePorts } from '../_shared/live.ts';
import type { CreateClient } from '../_shared/live.ts';
import { newJwksCache } from '../_shared/signature.ts';
import { webhookHandler } from '../_shared/webhook.ts';

// One key cache per running instance (at most 12 hours old).
Deno.serve(webhookHandler(livePorts(createClient as unknown as CreateClient, name => Deno.env.get(name)), { cache: newJwksCache(), fetchJwks: fetchFalJwks }));
