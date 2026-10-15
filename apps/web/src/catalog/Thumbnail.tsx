import {useEffect,useRef,useState} from 'react';
import type {Locale} from '../i18n/messages';
import {message} from '../i18n/messages';
import {assetName} from './catalog';
import type {CatalogAsset} from './catalog';
import type {CatalogApi,Progress} from './api';
export function Thumbnail({api,asset,locale}:{api:CatalogApi;asset:CatalogAsset;locale:Locale}){
 const host=useRef<HTMLDivElement>(null),finish=useRef<{url:string|undefined;complete(ok:boolean):void}|null>(null),[visible,setVisible]=useState(false),[attempt,setAttempt]=useState(0);
 const [image,setImage]=useState<{phase:'idle'|'loading'|'decoding'|'ready'|'error';url?:string;progress?:Progress}>({phase:'idle'});
 useEffect(()=>{if(!('IntersectionObserver' in window)){setVisible(true);return;}const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){setVisible(true);observer.disconnect();}});observer.observe(host.current!);return()=>observer.disconnect();},[]);
 useEffect(()=>{
  if(!visible)return;let active=true,url:string|undefined,settled=false,deadline:ReturnType<typeof setTimeout>|undefined;const controller=new AbortController();
  const revoke=()=>{if(url){URL.revokeObjectURL(url);url=undefined;}};
  const complete=(ok:boolean)=>{if(!active||settled)return;settled=true;clearTimeout(deadline);if(!ok){controller.abort();revoke();setImage({phase:'error'});}else setImage(old=>({...old,phase:'ready'}));};const ownership={url:undefined as string|undefined,complete};finish.current=ownership;setImage({phase:'loading'});
  void api.thumbnail(asset,controller.signal,progress=>{if(active)setImage({phase:'loading',progress});}).then(blob=>{if(!active)return;url=URL.createObjectURL(blob);ownership.url=url;deadline=setTimeout(()=>complete(false),5000);setImage({phase:'decoding',url});}).catch(()=>{if(active)complete(false);});
  return()=>{active=false;clearTimeout(deadline);controller.abort();revoke();if(finish.current===ownership)finish.current=null;};
 },[api,asset,visible,attempt]);
 const percent=image.progress?.total?Math.min(99,Math.floor(image.progress.received/image.progress.total*100)):null;
 return <div ref={host} className="catalog-thumbnail" data-testid={`catalog-thumb-${asset.id}`} data-phase={image.phase}>
  {image.url&&<img key={image.url} src={image.url} alt={assetName(asset,locale)} width={256} height={256} onLoad={e=>{const owner=finish.current;if(owner?.url===e.currentTarget.getAttribute('src'))owner.complete(e.currentTarget.naturalWidth===256&&e.currentTarget.naturalHeight===256);}} onError={e=>{const owner=finish.current;if(owner?.url===e.currentTarget.getAttribute('src'))owner.complete(false);}}/>}
  {(image.phase==='loading'||image.phase==='decoding')&&<p role="status">{percent===null?message(locale,'catalogImageLoading'):message(locale,'catalogImageProgress',{percent})}</p>}
  {image.phase==='error'&&<><p role="alert">{message(locale,'catalogImageFailed')}</p><button onClick={()=>setAttempt(n=>n+1)}>{message(locale,'catalogImageRetry')}</button></>}
 </div>;
}
