import {buildBrandTheme,designCssVariables,mixColour,foregroundFor,contrastRatio} from '../shared/design-system.mjs';
export {mixColour,foregroundFor,contrastRatio};
function hsl(colour){let[r,g,b]=[1,3,5].map(i=>parseInt(colour.slice(i,i+2),16)/255);const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min,l=(max+min)/2;let h=0,s=0;if(d){s=d/(1-Math.abs(2*l-1));h=max===r?((g-b)/d)%6:max===g?(b-r)/d+2:(r-g)/d+4;h=(h*60+360)%360;}return`${h.toFixed(1)} ${(s*100).toFixed(1)}% ${(l*100).toFixed(1)}%`;}
export function buildClubTheme(primary,accent){
 const {primary:p,primaryLift,accent:a,onPrimary:on,onAccent,text,muted,page,surface,soft,border,primaryHover:hover,accentSoft,primaryText}=buildBrandTheme(primary,accent);
 return {
  ...designCssVariables(),
  '--club-primary':p,'--club-primary-lift':primaryLift,'--club-primary-hover':hover,'--club-on-primary':on,'--club-accent':a,'--club-on-accent':onAccent,
  '--club-page':page,'--club-surface':surface,'--club-soft':soft,'--club-accent-soft':accentSoft,'--club-border':border,'--club-text':text,'--club-muted-text':muted,
  '--club-accent-text':mixColour(a,'#000000',.6),'--club-primary-text':primaryText,'--club-focus':mixColour(p,'#000000',.4),
  '--pl-deep-purple':p,'--pl-dark-purple':hover,'--pl-purple-900':hover,'--pl-electric-purple':a,'--pl-magenta':p,'--pl-lime':a,'--pl-cyan':a,
  '--pl-off-white':page,'--pl-light-grey':soft,'--pl-mid-grey':border,'--pl-text':text,'--pl-muted-text':muted,
  '--gradient-primary':`linear-gradient(135deg, ${p}, ${hover})`,'--gradient-live':`linear-gradient(135deg, ${p}, ${a})`,'--gradient-dark':`linear-gradient(180deg, ${p}, ${hover})`,
  '--background':hsl(page),'--foreground':hsl(text),'--card':hsl(surface),'--card-foreground':hsl(text),
  '--primary':hsl(p),'--primary-foreground':hsl(on),'--accent':hsl(a),'--accent-foreground':hsl(onAccent),'--muted':hsl(soft),'--muted-foreground':hsl(muted),'--border':hsl(border),'--input':hsl(border),'--ring':hsl(mixColour(p,'#000000',.4))
 };
}
