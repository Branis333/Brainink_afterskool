const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Alias native-only modules to shims so managed builds don't pull in unsupported native deps
config.resolver = config.resolver || {};
config.resolver.extraNodeModules = {
	...(config.resolver.extraNodeModules || {}),
	'@react-native-voice/voice': path.resolve(__dirname, 'src/shims/voice-shim.js'),
};

module.exports = config;
