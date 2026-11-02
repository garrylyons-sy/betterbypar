import {buildBrandTheme,designTokens} from '../../../shared/design-system.mjs';
import {useSession} from './session';
export {designTokens};
export function useTheme(){const {club}=useSession();return buildBrandTheme(club?.primaryColor,club?.accentColor);}
