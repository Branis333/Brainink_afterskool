// import React, { Component, ReactNode } from 'react';
// import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

// interface ErrorBoundaryState {
//     hasError: boolean;
//     error?: Error;
// }

// interface ErrorBoundaryProps {
//     children: ReactNode;
// }

// export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
//     constructor(props: ErrorBoundaryProps) {
//         super(props);
//         this.state = { hasError: false };
//     }

//     static getDerivedStateFromError(error: Error): ErrorBoundaryState {
//         return { hasError: true, error };
//     }

//     componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
//         console.error('Error caught by boundary:', error, errorInfo);
//     }

//     render() {
//         if (this.state.hasError) {
//             return (
//                 <View style={styles.container}>
//                     <Text style={styles.title}>Something went wrong</Text>
//                     <Text style={styles.message}>
//                         The app encountered an error. Please restart the app.
//                     </Text>
//                     <TouchableOpacity
//                         style={styles.button}
//                         onPress={() => this.setState({ hasError: false })}
//                     >
//                         <Text style={styles.buttonText}>Try Again</Text>
//                     </TouchableOpacity>
//                 </View>
//             );
//         }

//         return this.props.children;
//     }
// }

// const styles = StyleSheet.create({
//     container: {
//         flex: 1,
//         justifyContent: 'center',
//         alignItems: 'center',
//         padding: 20,
//         backgroundColor: '#f9fafb',
//     },
//     title: {
//         fontSize: 24,
//         fontWeight: 'bold',
//         color: '#1f2937',
//         marginBottom: 16,
//     },
//     message: {
//         fontSize: 16,
//         color: '#6b7280',
//         textAlign: 'center',
//         marginBottom: 24,
//         lineHeight: 24,
//     },
//     button: {
//         backgroundColor: '#3b82f6',
//         paddingHorizontal: 24,
//         paddingVertical: 12,
//         borderRadius: 8,
//     },
//     buttonText: {
//         color: '#ffffff',
//         fontSize: 16,
//         fontWeight: '600',
//     },
// });
