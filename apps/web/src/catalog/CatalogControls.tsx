import {useEffect,useMemo,useState} from 'react';
import {Dialog} from '../ui/Dialog';
import {message} from '../i18n/messages';
import type {Locale} from '../i18n/messages';
import {formatLength} from '../editor/measurements';
import {assetName,latestAssets,searchAssets} from './catalog';
import type {Catalog,CatalogAsset} from './catalog';
import type {RefObject} from 'react';
import {CatalogApi} from './api';
import {Thumbnail} from './Thumbnail';
const categoryKeys={tables:'catalogTables',seating:'catalogSeating',beds:'catalogBeds',storage:'catalogStorage',decor:'catalogDecor',lighting:'catalogLighting',kitchen:'catalogKitchen',bathroom:'catalogBathroom',rugs:'catalogRugs'} as const;
const categoryLabel=(category:string,locale:Locale)=>Object.hasOwn(categoryKeys,category)?message(locale,categoryKeys[category as keyof typeof categoryKeys]):category;
function CatalogDialog({locale,units,onClose,onChoose}:{locale:Locale;units:'metric'|'imperial';onClose():void;onChoose?:(asset:CatalogAsset)=>void}){
 const api=useMemo(()=>new CatalogApi(new URL('catalog/',new URL(import.meta.env.BASE_URL,window.location.href))),[]);
 const [state,setState]=useState<{phase:'loading'|'ready'|'error';catalog?:Catalog}>({phase:'loading'}),[retry,setRetry]=useState(0),[query,setQuery]=useState(''),[category,setCategory]=useState(''),[page,setPage]=useState(0);
 useEffect(()=>{let active=true;const controller=new AbortController();setState({phase:'loading'});void api.catalog(controller.signal).then(catalog=>{if(active)setState({phase:'ready',catalog});}).catch(()=>{if(active)setState({phase:'error'});});return()=>{active=false;controller.abort();};},[api,retry]);
 const latest=useMemo(()=>state.catalog?latestAssets(state.catalog):[],[state.catalog]),categories=useMemo(()=>[...new Set(latest.map(a=>a.category))].sort(),[latest]),filtered=useMemo(()=>searchAssets(latest,query,category,locale),[latest,query,category,locale]);
 const pages=Math.max(1,Math.ceil(filtered.length/24)),current=Math.min(page,pages-1);
 return <Dialog title={message(locale,'catalogTitle')} busy={false} isolateKeyboard className="catalog-dialog" onCancel={onClose}>
  <div className="catalog-filters"><label>{message(locale,'catalogSearch')}<input aria-label={message(locale,'catalogSearch')} maxLength={80} value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}}/></label>
   <label>{message(locale,'catalogCategory')}<select aria-label={message(locale,'catalogCategory')} value={category} onChange={e=>{setCategory(e.target.value);setPage(0);}}><option value="">{message(locale,'catalogAll')}</option>{categories.map(c=><option key={c} value={c}>{categoryLabel(c,locale)}</option>)}</select></label>
   <button onClick={onClose}>{message(locale,'catalogClose')}</button>
  </div>
  {state.phase==='loading'&&<p role="status">{message(locale,'catalogLoading')}</p>}
  {state.phase==='error'&&<><p role="alert">{message(locale,'catalogFailed')}</p><button onClick={()=>setRetry(n=>n+1)}>{message(locale,'catalogRetry')}</button></>}
  {state.phase==='ready'&&<><p role="status">{message(locale,'catalogResults',{count:filtered.length})}</p>{!filtered.length&&<p>{message(locale,'catalogNoResults')}</p>}
   <div className="catalog-grid">{filtered.slice(current*24,(current+1)*24).map(asset=><article className="catalog-card" key={`${asset.id}@${asset.version}`} aria-label={assetName(asset,locale)}>
    <Thumbnail api={api} asset={asset} locale={locale}/><h3>{assetName(asset,locale)}</h3><p>{message(locale,'catalogDimensions',{w:formatLength(asset.dims.w,units),d:formatLength(asset.dims.d,units),h:formatLength(asset.dims.h,units)})}</p>{onChoose&&<button onClick={()=>{onClose();onChoose(asset);}}>{message(locale,'catalogPlace')}</button>}
   </article>)}</div>
   {pages>1&&<nav className="catalog-pages" aria-label={message(locale,'catalogPages')}><button disabled={current===0} onClick={()=>setPage(current-1)}>{message(locale,'catalogPrevious')}</button><span>{message(locale,'catalogPage',{page:current+1,pages})}</span><button disabled={current===pages-1} onClick={()=>setPage(current+1)}>{message(locale,'catalogNext')}</button></nav>}
  </>}
 </Dialog>;
}
export function CatalogControls({locale,units,onChoose,onBrowse,buttonRef}:{locale:Locale;units:'metric'|'imperial';onChoose?:(asset:CatalogAsset)=>void;onBrowse?:()=>void;buttonRef?:RefObject<HTMLButtonElement|null>}){
 const [open,setOpen]=useState(false);
 return <section className="drawing-controls" aria-label={message(locale,'catalogTitle')}><button ref={buttonRef} onClick={()=>{onBrowse?.();setOpen(true);}}>{message(locale,'catalogBrowse')}</button>{open&&<CatalogDialog locale={locale} units={units} onClose={()=>setOpen(false)} {...(onChoose?{onChoose}:{})}/>}</section>;
}
