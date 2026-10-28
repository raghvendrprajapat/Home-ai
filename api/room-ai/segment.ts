import { deployedSegment } from '../../server/vercel/room-ai/segment.js';

/** D92 Vercel Function POST /api/room-ai/segment (AI test mode). All logic and checks: server/vercel/room-ai/segment.ts. */
const handle = deployedSegment();
export default { fetch: (request: Request): Promise<Response> => handle(request) };
