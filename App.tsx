import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { SubscriptionProvider } from './src/context/SubscriptionContext';
import { AppNavigator } from './src/navigation/AppNavigatorNew';
import { KanaProvider, useKanaAgent } from './src/agent/agent';

export default function App() {
    return (
        <SafeAreaProvider>
            <AuthProvider>
                <SubscriptionProvider>
                    <KanaProvider>
                        <AppWithKana />
                    </KanaProvider>
                </SubscriptionProvider>
            </AuthProvider>
        </SafeAreaProvider>
    );
}

const AppWithKana: React.FC = () => {
    const { setRouteInfo } = useKanaAgent();
    return <AppNavigator onRouteChange={setRouteInfo} />;
};
