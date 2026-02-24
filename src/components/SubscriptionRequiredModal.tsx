import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { useSubscription } from '../context/SubscriptionContext';
import { useAuth } from '../context/AuthContext';
import { flutterwavePaymentService } from '../services/flutterwavePaymentService';
import * as WebBrowser from 'expo-web-browser';

const CURRENCY_OPTIONS = [
  { code: 'USD', label: '$ USD (Card)', icon: '💳' },
  { code: 'UGX', label: 'UGX (MTN/Airtel MoMo)', icon: '📱' },
  { code: 'KES', label: 'KES (M-Pesa)', icon: '📱' },
  { code: 'RWF', label: 'RWF (MTN MoMo)', icon: '📱' },
  { code: 'GHS', label: 'GHS (MoMo)', icon: '📱' },
  { code: 'NGN', label: '₦ NGN (Card/Bank/USSD)', icon: '🏦' },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const SubscriptionRequiredModal: React.FC<Props> = ({ visible, onClose, onSuccess }) => {
  const { status, refresh } = useSubscription();
  const { token, user } = useAuth();
  const [starting, setStarting] = React.useState(false);
  const [verifying, setVerifying] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedCurrency, setSelectedCurrency] = React.useState('USD');
  const paymentRefRef = React.useRef<string | null>(null);

  const startPayment = async () => {
    if (!token) { setError('Not authenticated'); return; }
    setStarting(true); setError(null);
    try {
      const { checkoutUrl, paymentReference } = await flutterwavePaymentService.initiateMonthlySubscription(
        token,
        user?.email,
        selectedCurrency
      );
      paymentRefRef.current = paymentReference;
      const result = await WebBrowser.openBrowserAsync(checkoutUrl, {
        dismissButtonStyle: 'done',
        showInRecents: true,
      });
      setStarting(false);
      if (paymentRefRef.current) {
        setVerifying(true);
        try {
          const verifyResult = await flutterwavePaymentService.verifyPayment(token, paymentRefRef.current);
          await refresh();
          if (verifyResult.active) {
            onSuccess && onSuccess();
            onClose();
          } else {
            setError('Payment not yet confirmed. Please wait a moment and pull to refresh.');
          }
        } catch (e: any) {
          setError('Payment processing. Your subscription will activate within a minute.');
          setTimeout(() => refresh(), 5000);
        } finally {
          setVerifying(false);
        }
      }
    } catch (e: any) {
      setError(e.message || 'Failed to start payment');
      setStarting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Unlock Afterskool</Text>
          <Text style={styles.desc}>
            Get full access to courses, AI tutoring, notes, and quizzes for $5/month. Cancel anytime.
          </Text>

          {status?.active ? (
            <View>
              <Text style={styles.active}>✓ Subscribed until {status.expiresAt?.slice(0, 10)}</Text>
              <TouchableOpacity style={styles.doneBtn} onPress={onClose}>
                <Text style={styles.doneText}>Done</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.sectionLabel}>Choose payment method:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.currencyRow}>
                {CURRENCY_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.code}
                    style={[styles.currencyChip, selectedCurrency === opt.code && styles.currencyChipActive]}
                    onPress={() => setSelectedCurrency(opt.code)}
                  >
                    <Text style={styles.currencyIcon}>{opt.icon}</Text>
                    <Text style={[styles.currencyLabel, selectedCurrency === opt.code && styles.currencyLabelActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TouchableOpacity style={styles.payBtn} onPress={startPayment} disabled={starting || verifying}>
                {starting ? (
                  <ActivityIndicator color="#fff" />
                ) : verifying ? (
                  <View style={styles.verifyRow}>
                    <ActivityIndicator color="#fff" size="small" />
                    <Text style={[styles.payText, { marginLeft: 8 }]}>Verifying...</Text>
                  </View>
                ) : (
                  <Text style={styles.payText}>Subscribe — $5/month</Text>
                )}
              </TouchableOpacity>
            </>
          )}

          {error && <Text style={styles.error}>{error}</Text>}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeText}>Maybe later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  card: { width: '90%', maxHeight: '80%', backgroundColor: '#fff', borderRadius: 16, padding: 24 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 8, color: '#111' },
  desc: { fontSize: 14, color: '#555', marginBottom: 16, lineHeight: 20 },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: '#333', marginBottom: 8 },
  currencyRow: { marginBottom: 16, flexGrow: 0 },
  currencyChip: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 10, borderWidth: 1.5, borderColor: '#ddd', marginRight: 8, backgroundColor: '#f9f9f9',
  },
  currencyChipActive: { borderColor: '#ff7a00', backgroundColor: '#fff7ed' },
  currencyIcon: { fontSize: 16, marginRight: 6 },
  currencyLabel: { fontSize: 13, color: '#555', fontWeight: '500' },
  currencyLabelActive: { color: '#ff7a00', fontWeight: '700' },
  payBtn: { backgroundColor: '#ff7a00', paddingVertical: 16, borderRadius: 10, alignItems: 'center', marginBottom: 8 },
  payText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  active: { color: '#059669', fontWeight: '600', marginBottom: 12, fontSize: 15 },
  error: { color: '#dc2626', marginTop: 8, fontSize: 13 },
  closeBtn: { marginTop: 12, alignSelf: 'center', paddingVertical: 8 },
  closeText: { color: '#666', fontWeight: '500', fontSize: 14 },
  doneBtn: { backgroundColor: '#059669', paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  doneText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  verifyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
