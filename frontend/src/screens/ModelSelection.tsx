import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import ProgressBar from '../components/modelProgressBar';
import { useTheme } from '../contexts/ThemeContext';
import { useLocalLLM } from '../contexts/LocalLLMContext';
import { navigationRef } from '../lib/navigationRef';
import { useSubscription } from '../contexts/SubscriptionContext';

const CARD_GRADIENTS = {
  free: ['#1E293B', '#0F172A'] as const,
  pro: ['#6D28D9', '#7C3AED'] as const,
};

export default function ModelSelection() {
  const { colors } = useTheme();
  const { isProUser } = useSubscription();
  const {
    showSelection,
    isDownloading,
    downloadProgress,
    localModels,
    selectedLocalModelId,
    selectedLocalModel,
    selectLocalModel,
    activateLocalPlan,
    activateCloudPlan,
  } = useLocalLLM();

  if (!showSelection || isProUser) {
    return null;
  }

  const handleFreePlan = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await activateLocalPlan();
  };

  const handleUpgrade = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await activateCloudPlan();
    if (navigationRef.isReady() && navigationRef.current) {
      const navigate = navigationRef.current.navigate as (...args: any[]) => void;
      navigate('Subscription', { source: 'model-selection' });
    }
  };

  return (
    <Modal animationType="slide" transparent visible>
      <SafeAreaView style={[styles.backdrop, { backgroundColor: `${colors.background}EE` }]}>
        <View style={[styles.container, { backgroundColor: colors.card }]}>
          <Text style={[styles.title, { color: colors.foreground }]}>
            Choose how you want to generate MCQs
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Free plan downloads one of our local models once (~{selectedLocalModel.sizeGB}GB). Pro plan uses our cloud AI for faster
            results.
          </Text>

          <LinearGradient
            colors={CARD_GRADIENTS.free}
            style={styles.card}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.cardHeader}>
              <Ionicons name="infinite" size={24} color="#fff" />
              <Text style={styles.cardTitle}>Local LLM (Free)</Text>
            </View>
            <Text style={styles.cardHighlight}>Download once • Offline • Infinite MCQs</Text>
            <Text style={styles.cardDescription}>
              We&apos;ll store the model on your device so you can keep practicing without limits.
            </Text>
            <View style={styles.modelPicker}>
              {localModels.map((model) => {
                const isSelected = model.id === selectedLocalModelId;
                return (
                  <TouchableOpacity
                    key={model.id}
                    style={[styles.modelOption, isSelected && styles.modelOptionSelected]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      void selectLocalModel(model.id);
                    }}
                    disabled={isDownloading}
                  >
                    <View style={styles.modelOptionHeader}>
                      <Text style={styles.modelOptionLabel}>{model.label}</Text>
                      {isSelected && <Ionicons name="checkmark-circle" size={18} color="#22d3ee" />}
                    </View>
                    <Text style={styles.modelOptionMeta}>
                      {model.sizeGB.toFixed(1)} GB • {model.latencyHint}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.metricsRow}>
              <View style={styles.metric}>
                <Text style={styles.metricLabel}>Model size</Text>
                <Text style={styles.metricValue}>{selectedLocalModel.sizeGB.toFixed(1)} GB</Text>
              </View>
              <View style={styles.metric}>
                <Text style={styles.metricLabel}>Latency</Text>
                <Text style={styles.metricValue}>{selectedLocalModel.latencyHint}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.primaryButton, isDownloading && styles.buttonDisabled]}
              onPress={handleFreePlan}
              disabled={isDownloading}
            >
              <Text style={styles.primaryButtonText}>
                {isDownloading ? 'Downloading...' : 'Download & Continue'}
              </Text>
            </TouchableOpacity>
            {isDownloading && (
              <View style={styles.progressWrapper}>
                <ProgressBar progress={downloadProgress} />
                <Text style={styles.progressLabel}>{downloadProgress}%</Text>
              </View>
            )}
          </LinearGradient>

          <LinearGradient
            colors={CARD_GRADIENTS.pro}
            style={styles.card}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.cardHeader}>
              <Ionicons name="cloud" size={24} color="#fff" />
              <Text style={styles.cardTitle}>Cloud AI (Pro)</Text>
            </View>
            <Text style={styles.cardHighlight}>No download • Fastest responses</Text>
            <Text style={styles.cardDescription}>
              We run MCQ generation on our Gemini-powered infrastructure so you don&apos;t need local resources.
            </Text>
            <View style={styles.metricsRow}>
              <View style={styles.metric}>
                <Text style={styles.metricLabel}>Price</Text>
                <Text style={styles.metricValue}>$5 / month</Text>
              </View>
              <View style={styles.metric}>
                <Text style={styles.metricLabel}>Latency</Text>
                <Text style={styles.metricValue}>&lt;1s</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.secondaryButton} onPress={handleUpgrade}>
              <Text style={styles.secondaryButtonText}>Upgrade for $5 / month</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  container: {
    width: '100%',
    borderRadius: 28,
    padding: 20,
    gap: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    borderRadius: 24,
    padding: 20,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 20,
    elevation: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  cardHighlight: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cardDescription: {
    color: '#e2e8f0',
    fontSize: 14,
    lineHeight: 20,
  },
  modelPicker: {
    marginTop: 8,
    gap: 8,
  },
  modelOption: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: 'rgba(15,23,42,0.4)',
    padding: 12,
  },
  modelOptionSelected: {
    borderColor: '#22d3ee',
    backgroundColor: 'rgba(34,211,238,0.1)',
  },
  modelOptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modelOptionLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  modelOptionMeta: {
    marginTop: 4,
    color: '#cbd5f5',
    fontSize: 12,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  metric: {
    flex: 1,
  },
  metricLabel: {
    color: '#cbd5f5',
    fontSize: 12,
    marginBottom: 4,
  },
  metricValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  primaryButton: {
    marginTop: 10,
    backgroundColor: '#22d3ee',
    borderRadius: 16,
    alignItems: 'center',
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    marginTop: 10,
    borderRadius: 16,
    borderColor: '#fff',
    borderWidth: 1.5,
    alignItems: 'center',
    paddingVertical: 14,
  },
  secondaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  progressWrapper: {
    marginTop: 8,
  },
  progressLabel: {
    marginTop: 4,
    color: '#cbd5f5',
    fontSize: 12,
    textAlign: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});