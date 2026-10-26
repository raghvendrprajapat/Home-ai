// D86 room-ai-submit (Supabase Edge Function, Deno). The logic and its tests live in ../_shared/submit.ts.
import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import { livePorts } from '../_shared/live.ts';
import type { CreateClient } from '../_shared/live.ts';
import { submitHandler } from '../_shared/submit.ts';

Deno.serve(submitHandler(livePorts(createClient as unknown as CreateClient, name => Deno.env.get(name))));
