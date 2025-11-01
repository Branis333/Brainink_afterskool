// Minimal shim for @react-native-voice/voice so the app can bundle without native module
const Voice = {
  onSpeechStart: undefined,
  onSpeechEnd: undefined,
  onSpeechResults: undefined,
  onSpeechPartialResults: undefined,
  onSpeechError: undefined,
  async start(_locale) {
    // no-op; simulate quick start/stop if handlers are set
    try { typeof Voice.onSpeechStart === 'function' && Voice.onSpeechStart({}); } catch {}
    try { typeof Voice.onSpeechEnd === 'function' && Voice.onSpeechEnd({}); } catch {}
  },
  async stop() {
    // no-op
  },
  async destroy() {
    // no-op
  },
  removeAllListeners() {
    Voice.onSpeechStart = undefined;
    Voice.onSpeechEnd = undefined;
    Voice.onSpeechResults = undefined;
    Voice.onSpeechPartialResults = undefined;
    Voice.onSpeechError = undefined;
  },
};

module.exports = Voice;
