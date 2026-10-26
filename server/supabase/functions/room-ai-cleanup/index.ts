// D86 room-ai-cleanup (Supabase Edge Function, Deno), run daily by the owner's schedule with the service-role key.
// The logic and its tests live in ../_shared/cleanup.ts.
import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import { livePorts } from '../_shared/live.ts';
import type { CreateClient } from '../_shared/live.ts';
import { cleanupHandler } from '../_shared/cleanup.ts';

Deno.serve(cleanupHandler(livePorts(createClient as unknown as CreateClient, name => Deno.env.get(name))));
