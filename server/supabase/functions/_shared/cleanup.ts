import { bearer, json, sameSecret } from './http.ts';
import type { Ports } from './ports.ts';

/**
 * D86 room-ai-cleanup: deletes Room photo uploads and results older than 7 days, and those of deleted accounts.
 * Only callable with the service-role key (the owner's daily schedule). Folder entries end with '/' and are emptied
 * file by file; a job is marked purged only when all of its paths were removed.
 */
export function cleanupHandler(ports: Ports) {
  return async (request: Request): Promise<Response> => {
    const token = bearer(request);
    if (!token || !ports.serviceKey || !sameSecret(token, ports.serviceKey)) return json({ ok: false }, 401);
    const result = await ports.service('ai_expired_paths', { p_limit: 500 });
    if (result.error || !Array.isArray(result.data)) return json({ ok: false, code: 'UNEXPECTED' }, 500);
    const rows = (result.data as { job_id?: unknown; path?: unknown }[]).filter(r => typeof r.path === 'string' && r.path.length > 0);
    const failedJobs = new Set<string>(), jobs = new Set<string>();
    let removed = 0;
    for (const row of rows) {
      const job = typeof row.job_id === 'string' ? row.job_id : null, path = row.path as string;
      if (job) jobs.add(job);
      let paths: string[] = [path];
      if (path.endsWith('/')) {
        const listing = await ports.storage.list(path.slice(0, -1));
        if (!listing) { if (job) failedJobs.add(job); continue; }
        paths = listing.map(file => `${path}${file.name}`);
      }
      if (!paths.length) continue;
      if (await ports.storage.remove(paths)) removed += paths.length; else if (job) failedJobs.add(job);
    }
    const done = [...jobs].filter(job => !failedJobs.has(job));
    const marked = done.length ? !(await ports.service('mark_ai_purged', { p_job_ids: done })).error : true;
    ports.log('room-ai-cleanup', { removed, jobs: done.length, failed: failedJobs.size, marked });
    return json({ ok: true, removed, jobs: done.length, failed: failedJobs.size, marked });
  };
}
