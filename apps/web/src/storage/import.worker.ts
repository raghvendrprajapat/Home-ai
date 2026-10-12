import { parseProjectFile } from '@gharplan/persistence';
self.addEventListener('message', (event: MessageEvent<{ token: string; buffer: ArrayBuffer }>) => {
  const { token, buffer } = event.data;
  if (typeof token !== 'string' || !(buffer instanceof ArrayBuffer)) return;
  self.postMessage({ token, result: parseProjectFile(new Uint8Array(buffer)) });
});
