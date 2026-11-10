import { Stack } from 'expo-router';
import { Platform } from 'react-native';
import { ConversationProvider } from '@elevenlabs/react-native';
import ReactNativeForegroundService from '@supersami/rn-foreground-service';

ReactNativeForegroundService.register({ config: { alert: false, onServiceErrorCallBack: () => {} } });

export default function Layout() {
  return <ConversationProvider onDisconnect={() => { if (Platform.OS === 'android') void ReactNativeForegroundService.stopAll().catch(() => {}); }}>
    <Stack screenOptions={{headerShown:false, contentStyle:{backgroundColor:'#0C0F0E'}}}/>
  </ConversationProvider>;
}
