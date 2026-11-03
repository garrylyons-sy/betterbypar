import type {ComponentProps} from 'react';
import {Ionicons} from '@expo/vector-icons';
import {Pressable,StyleSheet,Text,View} from 'react-native';
import {designTokens as t,useTheme} from '../lib/theme';
type Props={title:string;description:string;icon:ComponentProps<typeof Ionicons>['name'];onPress:()=>void;badge?:'Website'|'Coming soon';accent?:boolean;disabled?:boolean};
/** Consistent, wrapping menu rows with one generous touch target per destination. */
export function MenuCard({title,description,icon,onPress,badge,accent=false,disabled=false}:Props){
 const theme=useTheme(),iconBackground=accent?theme.accentSoft:theme.soft,iconColor=accent?theme.accentText:theme.primaryText;
 return <Pressable accessibilityRole="button" accessibilityLabel={`${title}${badge?`, ${badge}`:''}`} accessibilityHint={description} accessibilityState={{disabled}} disabled={disabled} onPress={onPress} style={({pressed})=>[styles.card,{backgroundColor:pressed?theme.soft:theme.surface,borderColor:theme.border,borderLeftColor:accent?theme.accent:theme.primary,opacity:disabled ? 0.5 : 1}]}>
  <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.icon,{backgroundColor:iconBackground}]}><Ionicons name={icon} size={25} color={iconColor}/></View>
  <View style={styles.content}><View style={styles.heading}><Text style={[styles.title,{color:theme.text}]}>{title}</Text>{badge&&<View style={[styles.badge,{backgroundColor:badge==='Coming soon'?theme.accentSoft:theme.soft}]}><Text style={[styles.badgeText,{color:badge==='Coming soon'?theme.accentText:theme.primaryText}]}>{badge}</Text></View>}</View><Text style={[styles.description,{color:theme.muted}]}>{description}</Text></View>
  <Ionicons accessibilityElementsHidden importantForAccessibility="no-hide-descendants" name={badge==='Website'?'open-outline':'chevron-forward'} size={18} color={theme.primaryText}/>
 </Pressable>;
}
const styles=StyleSheet.create({
 card:{minHeight:88,borderWidth:1,borderLeftWidth:3,borderRadius:t.radius.card,padding:14,flexDirection:'row',alignItems:'center',gap:12},
 icon:{width:48,height:48,borderRadius:t.radius.hero,alignItems:'center',justifyContent:'center',flexShrink:0},
 content:{flex:1,minWidth:0,gap:5},heading:{flexDirection:'row',alignItems:'center',flexWrap:'wrap',gap:6},title:{fontSize:16,fontWeight:'800',flexShrink:1},description:{fontSize:13,lineHeight:19},
 badge:{borderRadius:t.radius.small,paddingHorizontal:6,paddingVertical:3},badgeText:{fontSize:10,fontWeight:'700'}
});
