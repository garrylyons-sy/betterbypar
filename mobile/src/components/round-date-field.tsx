import {useEffect,useState} from 'react';
import {View} from 'react-native';
import {roundDatePattern,formatRoundDate,parseRoundDate} from '../lib/round-date.mjs';
import {RoundTextInput} from './round-fields';
import {Copy} from './ui';
export function RoundDateField({value,disabled,onChange,onValidityChange}:{value:string;disabled:boolean;onChange:(iso:string)=>void;onValidityChange:(valid:boolean)=>void}){
 const [entry,setEntry]=useState({source:value,text:formatRoundDate(value)}),pattern=roundDatePattern();
 const text=entry.source===value?entry.text:formatRoundDate(value),invalid=!parseRoundDate(text);
 useEffect(()=>{onValidityChange(!invalid);},[invalid,onValidityChange]);
 return <View style={{gap:4}}><RoundTextInput label="Date played" value={text} placeholder={pattern} keyboardType="numbers-and-punctuation" maxLength={14} editable={!disabled} onChangeText={next=>{if(disabled)return;setEntry({source:value,text:next});const iso=parseRoundDate(next);onValidityChange(!!iso);if(iso)onChange(iso);}}/>{invalid&&<Copy style={{fontSize:12}}>Enter a valid date: {pattern}</Copy>}</View>;
}
