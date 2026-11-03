const valid=(value,fallback)=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value)?value.toUpperCase():fallback;
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
const hex=values=>'#'+values.map(v=>Math.round(v).toString(16).padStart(2,'0')).join('').toUpperCase();
export function mixColour(a,b,amount){return hex(rgb(a).map((v,i)=>v*(1-amount)+rgb(b)[i]*amount));}
function luminance(colour){return rgb(colour).map(c=>{const n=c/255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;}).reduce((sum,n,i)=>sum+n*[.2126,.7152,.0722][i],0);}
export function contrastRatio(a,b){const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
export function foregroundFor(colour){const c=valid(colour,'#061F3E');return contrastRatio(c,'#FFFFFF')>=contrastRatio(c,'#000000')?'#FFFFFF':'#000000';}
// Semantic tokens are consumed by both React DOM and React Native.
export const designTokens=Object.freeze({
 spacing:Object.freeze({xs:4,sm:8,md:12,lg:16,xl:20,xxl:24}),
 radius:Object.freeze({small:4,button:6,hero:8,card:8,pill:99}),
 type:Object.freeze({caption:10,small:12,body:15,section:16,title:28,index:60,lowIndex:26,score:27}),
 minTouchTarget:48
});
export function designCssVariables(){return {
 '--bbp-radius-small':`${designTokens.radius.small}px`,'--radius-sm':`${designTokens.radius.small}px`,'--radius-md':`${designTokens.radius.button}px`,'--radius-lg':`${designTokens.radius.card}px`,
 '--bbp-radius-card':`${designTokens.radius.card}px`,'--bbp-radius-hero':`${designTokens.radius.hero}px`,
 '--bbp-radius-button':`${designTokens.radius.button}px`,'--bbp-space-panel':`${designTokens.spacing.xl}px`,
 '--bbp-index-size':`${designTokens.type.index}px`,'--bbp-section-size':`${designTokens.type.section}px`,
 '--bbp-score-size':`${designTokens.type.score}px`,'--bbp-low-index-size':`${designTokens.type.lowIndex}px`
};}
export function buildBrandTheme(primary,accent){
 const p=valid(primary,'#061F3E'),a=valid(accent,'#0878E8');
 const on=foregroundFor(p),onAccent=foregroundFor(a),text=mixColour(p,'#000000',.8),muted=mixColour(text,'#FFFFFF',.26);
 // Lift dark club colours before tinting so navy produces blue, rather than grey, surfaces.
 const channels=rgb(p),lift=Math.max(1,Math.min(3,180/Math.max(1,...channels)));
 const primaryLift=hex(channels.map(v=>Math.min(255,v*lift)));
 const page=mixColour(primaryLift,'#FFFFFF',.95),surface='#FFFFFF',soft=mixColour(primaryLift,'#FFFFFF',.88),border=mixColour(primaryLift,'#FFFFFF',.73);
 const hover=mixColour(p,on==='#FFFFFF'?'#000000':'#FFFFFF',.15),accentSoft=mixColour(a,'#FFFFFF',.8);
 const baseText=mixColour(p,'#000000',.5),primaryText=contrastRatio(baseText,soft)>=4.5?baseText:mixColour(p,'#000000',.65);
 return {primary:p,primaryLift,primaryHover:hover,onPrimary:on,accent:a,onAccent,page,surface,soft,border,text,muted,accentSoft,
 accentText:mixColour(a,'#000000',.6),primaryText,focus:mixColour(p,'#000000',.4)};
}
