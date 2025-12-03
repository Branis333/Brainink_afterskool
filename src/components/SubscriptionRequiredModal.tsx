import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSubscription } from '../context/SubscriptionContext';
import { useAuth } from '../context/AuthContext';
import { flutterwavePaymentService } from '../services/flutterwavePaymentService';
import * as WebBrowser from 'expo-web-browser';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const SubscriptionRequiredModal: React.FC<Props> = ({ visible, onClose, onSuccess }) => {
  const { status, refresh } = useSubscription();
  const { token } = useAuth();
  const [starting, setStarting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const startPayment = async () => {
    if (!token) { setError('Not authenticated'); return; }
    setStarting(true); setError(null);
    try {
      const { checkoutUrl, paymentReference } = await flutterwavePaymentService.initiateMonthlySubscription(token);
      const result = await WebBrowser.openBrowserAsync(checkoutUrl);
      // After browser closes, attempt verification.
      if (result.type === 'cancel') {
        setError('Payment flow cancelled');
      } else {
        // optimistic verify
        try {
          await flutterwavePaymentService.verifyPayment(token, paymentReference);
          await refresh();
          onSuccess && onSuccess();
          onClose();
        } catch (e) {
          setError('Verification pending. Please pull to refresh.');
        }
      }
    } catch (e:any) {
      setError(e.message || 'Failed to start payment');
    } finally {
      setStarting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Subscription Required</Text>
          <Text style={styles.desc}>Access to courses, notes, and uploads requires an active $5/month subscription.</Text>
          {status?.active ? (
            <Text style={styles.active}>You are subscribed until {status.expiresAt?.slice(0,10)}</Text>
          ) : (
            <TouchableOpacity style={styles.payBtn} onPress={startPayment} disabled={starting}>
              {starting ? <ActivityIndicator color="#fff" /> : <Text style={styles.payText}>Pay $5 Now</Text>}
            </TouchableOpacity>
          )}
          {error && <Text style={styles.error}>{error}</Text>}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex:1, backgroundColor:'rgba(0,0,0,0.4)', justifyContent:'center', alignItems:'center' },
  card: { width:'85%', backgroundColor:'#fff', borderRadius:12, padding:20 },
  title: { fontSize:20, fontWeight:'600', marginBottom:8 },
  desc: { fontSize:14, color:'#444', marginBottom:16 },
  payBtn: { backgroundColor:'#ff7a00', paddingVertical:14, borderRadius:8, alignItems:'center', marginBottom:8 },
  payText: { color:'#fff', fontWeight:'600', fontSize:16 },
  active: { color:'#0a7', fontWeight:'600', marginBottom:12 },
  error: { color:'#c00', marginTop:4 },
  closeBtn: { marginTop:8, alignSelf:'flex-end' },
  closeText: { color:'#333', fontWeight:'500' }
});
