export type BrandTheme={primary:string;primaryHover:string;onPrimary:string;accent:string;onAccent:string;page:string;surface:string;soft:string;border:string;text:string;muted:string;accentSoft:string;accentText:string;primaryText:string;focus:string};
export const designTokens:Readonly<{spacing:Readonly<{xs:number;sm:number;md:number;lg:number;xl:number;xxl:number}>;radius:Readonly<{small:number;button:number;hero:number;card:number;pill:number}>;type:Readonly<{caption:number;small:number;body:number;section:number;title:number;index:number;lowIndex:number;score:number}>;minTouchTarget:number}>;
export function designCssVariables():Record<string,string>;
export function buildBrandTheme(primary?:string|null,accent?:string|null):BrandTheme;
export function mixColour(a:string,b:string,amount:number):string;
export function foregroundFor(colour:string):string;
export function contrastRatio(a:string,b:string):number;
