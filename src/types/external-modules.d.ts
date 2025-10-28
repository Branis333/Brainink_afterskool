declare module '@react-native-voice/voice';
declare module 'react-native-tts';

declare module 'expo-camera' {
	import * as React from 'react';
	import { ViewProps } from 'react-native';

	export type CameraType = 'front' | 'back';

	export interface CameraPermission {
		granted: boolean;
		canAskAgain?: boolean;
		expires?: 'never' | number;
		status?: 'granted' | 'denied' | 'undetermined';
	}

	export interface CameraViewProps extends ViewProps {
		facing?: CameraType;
		zoom?: number;
		children?: React.ReactNode;
	}

	export const CameraView: React.ForwardRefExoticComponent<
		CameraViewProps & React.RefAttributes<{ takePictureAsync: (options?: any) => Promise<{ uri: string }> }>
	>;

	export function useCameraPermissions(): [CameraPermission | null, () => Promise<CameraPermission | null>];
}
