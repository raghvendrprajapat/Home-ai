import {useEffect,useRef,useState} from 'react';
import {message} from '../i18n/messages';
import type {Locale} from '../i18n/messages';
import {MAX_CODE_LENGTH} from './test-mode';

/**
 * D92 AI test mode: asks for the owner's access code before the first AI use on this device. The code is typed in a
 * password field (not shown on screen, no autofill suggestions) and kept on this device only; `wrong` shows that the
 * server refused the last code.
 */
export function AiCodePrompt({locale,wrong,onUse,onCancel}:{locale:Locale;wrong:boolean;onUse(code:string):void;onCancel():void}){
 const input=useRef<HTMLInputElement>(null),[code,setCode]=useState(''),[empty,setEmpty]=useState(false);
 useEffect(()=>{input.current?.focus({preventScroll:true});},[]);
 const use=()=>{const value=code.trim();if(!value){setEmpty(true);return;}onUse(value);};
 return <div className="viz-consent" role="dialog" aria-modal="true" aria-labelledby="viz-code-title" data-testid="ai-code">
  <form className="viz-consent-card" onSubmit={event=>{event.preventDefault();use();}}>
   <h3 id="viz-code-title">{message(locale,'roomAiTestCodeTitle')}</h3>
   <p>{message(locale,'roomAiTestCodeHelp')}</p>
   <label>{message(locale,'roomAiTestCodeLabel')}<input ref={input} type="password" autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={MAX_CODE_LENGTH} value={code} aria-label={message(locale,'roomAiTestCodeLabel')} onChange={event=>{setCode(event.target.value);setEmpty(false);}}/></label>
   {wrong&&<p role="alert" data-testid="ai-code-wrong">{message(locale,'roomAiTestCodeWrong')}</p>}
   {empty&&<p role="alert">{message(locale,'roomAiTestCodeEmpty')}</p>}
   <div className="viz-row">
    <button type="submit" className="primary-button">{message(locale,'roomAiTestCodeUse')}</button>
    <button type="button" onClick={onCancel}>{message(locale,'roomAiTestCodeLater')}</button>
   </div>
  </form>
 </div>;
}
