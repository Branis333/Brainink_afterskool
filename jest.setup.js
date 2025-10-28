// Jest setup file
import '@testing-library/jest-dom';

// Mock React Native if needed
jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  ScrollView: 'ScrollView',
  TouchableOpacity: 'TouchableOpacity',
  ActivityIndicator: 'ActivityIndicator',
  StyleSheet: {
    create: (styles) => styles,
  },
}));

// Suppress console warnings during tests
global.console.warn = jest.fn();
global.console.error = jest.fn();
