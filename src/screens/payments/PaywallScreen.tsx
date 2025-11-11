import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigatorNew';
import { SubscriptionRequiredModal } from '../../components/SubscriptionRequiredModal';
import { useSubscription } from '../../context/SubscriptionContext';

export type PaywallProps = NativeStackScreenProps<RootStackParamList, 'Paywall'>;

export const PaywallScreen: React.FC<PaywallProps> = ({ navigation, route }) => {
  const [visible, setVisible] = React.useState(true);
  const { status } = useSubscription();

  React.useEffect(() => {
    if (status?.active) {
      // If already subscribed, go back
      navigation.goBack();
    }
  }, [status]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Unlock Afterskool</Text>
      <Text style={styles.subtitle}>$5 per month • Cancel anytime</Text>
      <SubscriptionRequiredModal visible={visible} onClose={() => setVisible(false)} onSuccess={() => navigation.goBack()} />
      <TouchableOpacity style={styles.secondary} onPress={() => navigation.goBack()}>
        <Text>Maybe later</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex:1, alignItems:'center', justifyContent:'center', padding:24 },
  title: { fontSize:24, fontWeight:'700', marginBottom:8 },
  subtitle: { color:'#555', marginBottom:16 },
  secondary: { marginTop:12 }
});
