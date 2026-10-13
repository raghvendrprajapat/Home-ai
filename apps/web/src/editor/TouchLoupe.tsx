import type { PreviewResult, ProjectStore } from '@gharplan/core-model';
import { worldToScreen } from './view2d';
import type { Point2, Viewport } from './view2d';
import { message } from '../i18n/messages';
import type { Locale } from '../i18n/messages';
export function TouchLoupe({ point,world,view,size,snapshot,preview,locale }: {point:Point2;world:Point2;view:Viewport;size:{width:number;height:number};snapshot:ReturnType<ProjectStore['getSnapshot']>;preview:PreviewResult|null;locale:Locale}){
  const current=preview?.ok?preview:snapshot, zoom=view.scale*3;
  const loupe:Viewport={scale:zoom,x:48-world[0]*zoom,y:48-world[1]*zoom};
  const rect:[number,number,number,number]=[world[0]-48/zoom,world[1]-48/zoom,world[0]+48/zoom,world[1]+48/zoom];
  return <div className="touch-loupe" data-testid="touch-loupe" style={{left:Math.max(4,Math.min(size.width-104,point[0]-50)),top:Math.max(4,Math.min(size.height-122,point[1]-146))}}>
    <svg width="96" height="96" viewBox="0 0 96 96" role="img" aria-label={message(locale,'touchLoupe')}>
      <rect width="96" height="96" fill="#e5efe9" />
      {current.derived.footprints.filter(f=>f.rect[0]<=rect[2]&&f.rect[2]>=rect[0]&&f.rect[1]<=rect[3]&&f.rect[3]>=rect[1]).map((f,i)=>{const [x,y]=worldToScreen([f.rect[0],f.rect[1]],loupe);return <rect key={i} x={x} y={y} width={(f.rect[2]-f.rect[0])*zoom} height={(f.rect[3]-f.rect[1])*zoom} fill="#42534b" />;})}
      {current.document.junctions.filter(j=>j.x>=rect[0]&&j.x<=rect[2]&&j.y>=rect[1]&&j.y<=rect[3]).map(j=>{const [x,y]=worldToScreen([j.x,j.y],loupe);return <circle key={j.id} cx={x} cy={y} r="5" fill="white" stroke="#b6723f" strokeWidth="2" />;})}
      <path d="M 35 48 H 61 M 48 35 V 61" stroke={preview&&!preview.ok?'#b33d3d':'#b6723f'} strokeWidth="1.5" />
      <circle cx="48" cy="48" r="46" fill="none" stroke="#b6723f" strokeWidth="2" />
    </svg><span>{world[0]}, {world[1]} {message(locale,'mm')}</span>
  </div>;
}
