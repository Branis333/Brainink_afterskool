import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { LoginScreen } from '../screens/LoginScreenNew';
import { RoleSelectionScreen } from '../screens/RoleSelectionScreen';
import { ImageUploadScreen } from '../screens/ImageUploadScreenNew';

export type RootStackParamList = {
    Login: undefined;
    RoleSelection: undefined;
    ImageUpload: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export const AppNavigator: React.FC = () => {
    const { user, token, school, role, isLoading } = useAuth();

    if (isLoading) {
        return null; // Or a loading screen component
    }

    return (
        <NavigationContainer>
            <Stack.Navigator
                screenOptions={{
                    headerShown: false,
                    gestureEnabled: false,
                }}
                initialRouteName={getInitialRoute()}
            >
                <Stack.Screen
                    name="Login"
                    component={LoginScreen}
                    options={{ gestureEnabled: true }}
                />
                <Stack.Screen
                    name="RoleSelection"
                    component={RoleSelectionScreen}
                />
                <Stack.Screen
                    name="ImageUpload"
                    component={ImageUploadScreen}
                />
            </Stack.Navigator>
        </NavigationContainer>
    );

    function getInitialRoute(): keyof RootStackParamList {
        // If user is not logged in, go to login
        if (!user || !token) {
            return 'Login';
        }

        // If user is logged in but hasn't selected school/role, go to role selection
        if (!school || !role) {
            return 'RoleSelection';
        }

        // If everything is set up, go to image upload
        return 'ImageUpload';
    }
};
