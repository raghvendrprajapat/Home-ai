import {message} from '../i18n/messages';
import type {Locale} from '../i18n/messages';
import type {FurnitureAdvisory} from './furniture-advisories';
export function FurnitureWarning({advisory,locale}:{advisory:FurnitureAdvisory;locale:Locale}){
 return <p className={advisory.overlap?'furniture-warning':''} role="status" data-testid="furniture-warning" data-available={advisory.available} data-overlap={advisory.overlap}>{!advisory.available?message(locale,'furnitureAdvisoryUnavailable'):advisory.overlap?message(locale,'furnitureOverlap',{walls:advisory.wallIds.length,objects:advisory.furnitureIds.length}):message(locale,'furnitureClear')}</p>;
}
