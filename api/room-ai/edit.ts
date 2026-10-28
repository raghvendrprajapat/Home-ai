import { deployedEdit } from '../../server/vercel/room-ai/edit.js';

/** D92 Vercel Function POST /api/room-ai/edit (AI test mode). All logic and checks: server/vercel/room-ai/edit.ts. */
const handle = deployedEdit();
export default { fetch: (request: Request): Promise<Response> => handle(request) };
