import {TextInput,View,type TextInputProps} from 'react-native';
import {useTheme} from '../lib/theme';
import {Copy,styles} from './ui';
export function RoundTextInput({label,...props}:TextInputProps&{label:string}){const theme=useTheme();return <View style={{gap:6}}><Copy bold>{label}</Copy><TextInput {...props} accessibilityLabel={label} placeholderTextColor={theme.muted} style={[styles.input,{borderColor:theme.border,backgroundColor:theme.surface,color:theme.text},props.multiline&&{minHeight:100,textAlignVertical:'top'},props.editable===false&&{opacity:.6}]}/></View>;}
