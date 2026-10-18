import { useEffect, useState, useSyncExternalStore } from 'react';
import { message } from '../i18n/messages';
import type { Locale } from '../i18n/messages';
import type { CloudProjectSummary } from './api';
import { CLOUD_OFF, cloud as defaultCloud, noSubscription } from './session';
import type { CloudSession } from './session';
const cloudOff = () => CLOUD_OFF;

/** FR-031 (D67) the signed-in person's cloud drawings on the Projects screen. Opening is handled by the shell. */
export function CloudProjects({ locale, busy, onOpen, cloud = defaultCloud }: { locale: Locale; busy: boolean; onOpen(project: CloudProjectSummary): void; cloud?: CloudSession | null }) {
  const session = useSyncExternalStore(cloud?.subscribe ?? noSubscription, cloud?.getSnapshot ?? cloudOff);
  const [projects, setProjects] = useState<CloudProjectSummary[] | null>(null), [failed, setFailed] = useState(false), [round, setRound] = useState(0);
  useEffect(() => {
    if (!cloud || session.status !== 'signed-in') { setProjects(null); return; }
    let live = true; setFailed(false);
    void cloud.ensure().then(api => api?.listProjects()).then(result => { if (!live) return; if (result?.ok) setProjects(result.projects); else setFailed(true); });
    return () => { live = false; };
  }, [cloud, session.status, round]);
  if (!cloud || session.status !== 'signed-in') return null;
  return <section className="cloud-projects" aria-label={message(locale, 'cloudProjects')}>
    <h2>{message(locale, 'cloudProjects')}</h2><p>{message(locale, 'cloudProjectsHelp')}</p>
    {failed ? <p role="alert">{message(locale, 'cloudListFailed')} <button onClick={() => setRound(n => n + 1)}>{message(locale, 'cloudRetry')}</button></p>
      : projects === null ? <p role="status">{message(locale, 'cloudLoading')}</p>
      : !projects.length ? <p>{message(locale, 'cloudNoProjects')}</p>
      : <div className="project-cards" role="list">{projects.map(project => <article className="project-card" key={project.id} role="listitem" data-cloud-project-id={project.id}>
        <div className="project-thumb" aria-hidden="true">☁</div><h3>{project.name}</h3>
        <div className="project-card-actions"><button disabled={busy} aria-label={message(locale, 'cloudOpenNamed', { name: project.name })} onClick={() => onOpen(project)}>{message(locale, 'open')}</button></div>
      </article>)}</div>}
  </section>;
}
