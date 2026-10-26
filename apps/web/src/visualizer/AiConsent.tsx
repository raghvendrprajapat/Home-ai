import {useEffect,useRef} from 'react';
import {message} from '../i18n/messages';
import type {Locale} from '../i18n/messages';
import {PrivacyLink} from '../ui/PrivacyLink';

/**
 * D86 consent before the first AI use (previews and tap-to-select): what is sent, to whom, how long it is kept, that it
 * is not used for marketing, and the privacy policy. Stored per device and account (server-surface.ts giveConsent).
 */
export function AiConsent({locale,previews,onAgree,onCancel}:{locale:Locale;previews:number;onAgree():void;onCancel():void}){
 const agree=useRef<HTMLButtonElement>(null);
 useEffect(()=>{agree.current?.focus({preventScroll:true});},[]);
 return <div className="viz-consent" role="dialog" aria-modal="true" aria-labelledby="viz-consent-title" data-testid="ai-consent">
  <div className="viz-consent-card">
   <h3 id="viz-consent-title">{message(locale,'roomAiConsentTitle')}</h3>
   <p>{message(locale,'roomAiConsentSend')}</p>
   <p>{message(locale,'roomAiConsentDelete')}</p>
   <p>{message(locale,'roomAiConsentLimits',{previews})}</p>
   <p>{message(locale,'roomAiConsentApprox')}</p>
   <p><PrivacyLink locale={locale}/></p>
   <div className="viz-row">
    <button ref={agree} className="primary-button" onClick={onAgree}>{message(locale,'roomAiConsentAgree')}</button>
    <button onClick={onCancel}>{message(locale,'roomAiConsentLater')}</button>
   </div>
  </div>
 </div>;
}
