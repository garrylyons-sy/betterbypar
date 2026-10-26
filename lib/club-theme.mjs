const valid=(value,fallback)=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value)?value.toUpperCase():fallback;
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
const hex=values=>'#'+values.map(v=>Math.round(v).toString(16).padStart(2,'0')).join('').toUpperCase();
export function mixColour(a,b,amount){return hex(rgb(a).map((v,i)=>v*(1-amount)+rgb(b)[i]*amount));}
function luminance(colour){return rgb(colour).map(c=>{const n=c/255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;}).reduce((sum,n,i)=>sum+n*[.2126,.7152,.0722][i],0);}
export function contrastRatio(a,b){const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
export function foregroundFor(colour){const c=valid(colour,'#061F3E');return contrastRatio(c,'#FFFFFF')>=contrastRatio(c,'#000000')?'#FFFFFF':'#000000';}
function hsl(colour){let[r,g,b]=rgb(colour).map(v=>v/255);const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min,l=(max+min)/2;let h=0,s=0;if(d){s=d/(1-Math.abs(2*l-1));h=max===r?((g-b)/d)%6:max===g?(b-r)/d+2:(r-g)/d+4;h=(h*60+360)%360;}return`${h.toFixed(1)} ${(s*100).toFixed(1)}% ${(l*100).toFixed(1)}%`;}
export function buildClubTheme(primary,accent){
 const p=valid(primary,'#061F3E'),a=valid(accent,'#0878E8');
 const on=foregroundFor(p),onAccent=foregroundFor(a),text=mixColour(p,'#000000',.8),muted=mixColour(text,'#FFFFFF',.26);
 const page=mixColour(p,'#FFFFFF',.97),surface='#FFFFFF',soft=mixColour(p,'#FFFFFF',.92),border=mixColour(p,'#FFFFFF',.78);
 const hover=mixColour(p,on==='#FFFFFF'?'#000000':'#FFFFFF',.15),accentSoft=mixColour(a,'#FFFFFF',.85);
 return {
  '--club-primary':p,'--club-primary-hover':hover,'--club-on-primary':on,'--club-accent':a,'--club-on-accent':onAccent,
  '--club-page':page,'--club-surface':surface,'--club-soft':soft,'--club-accent-soft':accentSoft,'--club-border':border,'--club-text':text,'--club-muted-text':muted,
  '--club-accent-text':mixColour(a,'#000000',.6),'--club-primary-text':mixColour(p,'#000000',.5),'--club-focus':mixColour(p,'#000000',.4),
  '--pl-deep-purple':p,'--pl-dark-purple':hover,'--pl-purple-900':hover,'--pl-electric-purple':a,'--pl-magenta':p,'--pl-lime':a,'--pl-cyan':a,
  '--pl-off-white':page,'--pl-light-grey':soft,'--pl-mid-grey':border,'--pl-text':text,'--pl-muted-text':muted,
  '--gradient-primary':`linear-gradient(135deg, ${p}, ${hover})`,'--gradient-live':`linear-gradient(135deg, ${p}, ${a})`,'--gradient-dark':`linear-gradient(180deg, ${p}, ${hover})`,
  '--background':hsl(page),'--foreground':hsl(text),'--card':hsl(surface),'--card-foreground':hsl(text),
  '--primary':hsl(p),'--primary-foreground':hsl(on),'--accent':hsl(a),'--accent-foreground':hsl(onAccent),'--muted':hsl(soft),'--muted-foreground':hsl(muted),'--border':hsl(border),'--input':hsl(border),'--ring':hsl(mixColour(p,'#000000',.4))
 };
}
