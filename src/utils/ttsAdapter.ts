import { Platform } from 'react-native';

let nativeTts: any = null;
try {
    // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
    nativeTts = require('react-native-tts');
} catch (error) {
    nativeTts = null;
}

let expoSpeech: typeof import('expo-speech') | null = null;
try {
    // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
    expoSpeech = require('expo-speech');
} catch (error) {
    expoSpeech = null;
}

const hasNativeTts = Boolean(nativeTts && typeof nativeTts.speak === 'function');
const hasExpoSpeech = Boolean(expoSpeech && typeof expoSpeech.speak === 'function');

export type TtsEngineName = 'react-native-tts' | 'expo-speech' | 'none';

export interface TtsOptions {
    rate?: number;
    iosVoiceId?: string;
    androidParams?: Record<string, unknown>;
    pitch?: number;
    language?: string;
}

const speakWithNative = (text: string, options?: TtsOptions) => {
    if (!hasNativeTts) return;
    const { rate = 0.5 } = options || {};
    nativeTts.setDefaultRate?.(rate, true);
    if (options?.androidParams) {
        nativeTts.speak(text, options.androidParams);
    } else {
        nativeTts.speak(text, {
            rate,
            androidParams: {
                KEY_PARAM_STREAM: 'STREAM_MUSIC',
                KEY_PARAM_PAN: 0,
                KEY_PARAM_VOLUME: 1,
            },
        });
    }
};

const speakWithExpo = (text: string, options?: TtsOptions) => {
    if (!hasExpoSpeech || !expoSpeech) return;
    expoSpeech.stop();
    expoSpeech.speak(text, {
        rate: options?.rate,
        pitch: options?.pitch,
        language: options?.language,
        voice: options?.iosVoiceId,
    });
};

export const ttsAdapter = {
    engine: ((): TtsEngineName => {
        if (hasNativeTts) return 'react-native-tts';
        if (hasExpoSpeech) return 'expo-speech';
        return 'none';
    })(),
    isAvailable(): boolean {
        return hasNativeTts || hasExpoSpeech;
    },
    supportsEvents(): boolean {
        return hasNativeTts;
    },
    speak(text: string, options?: TtsOptions) {
        if (hasNativeTts) {
            speakWithNative(text, options);
            return;
        }
        speakWithExpo(text, options);
    },
    stop() {
        if (hasNativeTts) {
            nativeTts.stop?.();
            return;
        }
        if (hasExpoSpeech) {
            expoSpeech?.stop();
        }
    },
    setDefaultRate(rate: number, skip?: boolean) {
        if (hasNativeTts) {
            nativeTts.setDefaultRate?.(rate, skip);
        }
    },
    setDucking(duck: boolean) {
        if (hasNativeTts) {
            nativeTts.setDucking?.(duck);
        }
    },
    addEventListener(event: string, handler: (...args: any[]) => void) {
        if (hasNativeTts) {
            nativeTts.addEventListener?.(event, handler);
        }
    },
    removeEventListener(event: string, handler: (...args: any[]) => void) {
        if (hasNativeTts) {
            nativeTts.removeEventListener?.(event, handler);
        }
    },
    describe(): string {
        if (hasNativeTts) {
            return 'Using react-native-tts native engine';
        }
        if (hasExpoSpeech) {
            return 'Using expo-speech fallback engine';
        }
        return 'No text-to-speech engine available';
    },
    recommendedSetup(): string {
        if (hasNativeTts) {
            return 'Native TTS ready';
        }
        if (hasExpoSpeech) {
            return Platform.select({ ios: 'Using AVSpeechSynthesizer via expo-speech', android: 'Using TextToSpeech via expo-speech', default: 'expo-speech' }) || 'expo-speech';
        }
        return 'Install expo-speech or configure react-native-tts via prebuild to enable narration.';
    },
};
