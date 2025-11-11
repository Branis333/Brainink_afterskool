import React from 'react';
import { AuthProvider } from './src/context/AuthContext';
import { SubscriptionProvider } from './src/context/SubscriptionContext';
import { AppNavigator } from './src/navigation/AppNavigatorNew';

export default function App() {
    return (
        <AuthProvider>
            <SubscriptionProvider>
                <AppNavigator />
            </SubscriptionProvider>
        </AuthProvider>
    );
}
