// D86 room-ai-segment (Supabase Edge Function, Deno). The logic and its tests live in ../_shared/segment.ts.
import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import { livePorts } from '../_shared/live.ts';
import type { CreateClient } from '../_shared/live.ts';
import { segmentHandler } from '../_shared/segment.ts';

Deno.serve(segmentHandler(livePorts(createClient as unknown as CreateClient, name => Deno.env.get(name))));
