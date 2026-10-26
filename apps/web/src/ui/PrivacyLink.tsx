import {Capacitor} from '@capacitor/core';
import {message} from '../i18n/messages';
import type {Locale} from '../i18n/messages';
import {shareBase} from '../cloud/share-link';

/**
 * D86 Link to the bilingual privacy policy (public/privacy.html). The web app opens its own copy in a new tab. The
 * Android app opens the hosted copy in the system browser when VITE_PUBLIC_APP_URL is set (the same address view-only
 * links use); without it the bundled copy opens inside the app and the phone's Back button returns.
 */
export function privacyAddress(native:boolean,env:Record<string,unknown>,here:{origin:string;pathname:string;baseUrl:string}):{href:string;external:boolean}{
 const hosted=native?shareBase(true,env,here):null;
 if(hosted)return {href:new URL('privacy.html',`${hosted.origin}${hosted.pathname.endsWith('/')?hosted.pathname:`${hosted.pathname}/`}`).href,external:true};
 return {href:new URL('privacy.html',new URL(here.baseUrl,`${here.origin}${here.pathname}`)).href,external:false};
}
export function PrivacyLink({locale}:{locale:Locale}){
 const native=Capacitor.isNativePlatform(),{href,external}=privacyAddress(native,import.meta.env,{origin:location.origin,pathname:location.pathname,baseUrl:import.meta.env.BASE_URL});
 return <a className="privacy-link" href={href} {...native?{}:{target:'_blank',rel:'noopener noreferrer'}} onClick={external?event=>{event.preventDefault();void import('@capacitor/browser').then(({Browser})=>Browser.open({url:href})).catch(()=>{location.href=href;});}:undefined}>{message(locale,'privacyPolicy')}</a>;
}
