import React, { useEffect, useRef } from 'react';
import {
  Linking,
  StatusBar,
  StyleSheet,
  useColorScheme,
  View,
  Platform,
  PermissionsAndroid,
  Alert,
  BackHandler,
} from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import ReactNativeBlobUtil from 'react-native-blob-util';

const WEB_URL = `https://developer.webplanetsoft.com/frontend/`;

const requestStoragePermission = async () => {
  if (Platform.OS === 'android') {
    // Android 13+ (API 33+) doesn't need WRITE_EXTERNAL_STORAGE
    if (Platform.Version >= 33) {
      return true;
    }

    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
      {
        title: 'Storage Permission',
        message: 'App needs access to your storage to download files',
        buttonPositive: 'OK',
      },
    );

    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }
  return true;
};

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <AppContent />
    </SafeAreaProvider>
  );
}

function AppContent() {
  const safeAreaInsets = useSafeAreaInsets();
  const webViewRef = useRef(null);

  useEffect(() => {
    const onBackPress = () => {
      webViewRef.current?.postMessage(JSON.stringify({ type: 'BACK_BUTTON' }));
      return true;
    };

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      onBackPress,
    );

    return () => subscription.remove();
  }, []);

  const saveBase64File = async (base64Data, fileName, mimeType) => {
    try {
      const hasPermission = await requestStoragePermission();
      if (!hasPermission) {
        Alert.alert('Permission Denied', 'Storage permission is required.');
        return;
      }

      const { fs, android } = ReactNativeBlobUtil;
      const pureBase64 = base64Data.replace(/^data:.*;base64,/, '');

      // ✅ Public Downloads folder - visible in Files/Downloads app
      const path = `/storage/emulated/0/Download/${fileName}`;

      await fs.writeFile(path, pureBase64, 'base64');
      console.log('File saved at:', path);

      Alert.alert(
        'Download Complete',
        `File saved in Downloads folder:\n${fileName}`,
        [
          { text: 'OK' },
          {
            text: 'Open',
            onPress: () => {
              android.actionViewIntent(path, mimeType).catch(() => {
                Alert.alert(
                  'No App Found',
                  'No app available to open this file.',
                );
              });
            },
          },
        ],
      );
    } catch (error) {
      console.log('Download error:', error);
      Alert.alert('Error', `File download failed: ${error.message}`);
    }
  };

  const downloadPDF = async url => {
    try {
      const hasPermission = await requestStoragePermission();
      if (!hasPermission) {
        Alert.alert(
          'Permission Denied',
          'Storage permission is required to download files.',
        );
        return;
      }

      const { config, fs, android } = ReactNativeBlobUtil;
      const fileName = `file_${Date.now()}.pdf`;
      const path = `${fs.dirs.DownloadDir}/${fileName}`;

      const res = await config({
        fileCache: true,
        path,
        addAndroidDownloads: {
          useDownloadManager: true,
          notification: true,
          path,
          title: fileName, // <-- ADD title, some devices need it
          description: 'Downloading PDF...',
          mime: 'application/pdf',
          mediaScannable: true, // <-- makes file appear in Downloads app
        },
      }).fetch('GET', url);

      console.log('Saved to:', res.path());

      Alert.alert('Download Complete', `PDF saved to Downloads folder.`, [
        { text: 'OK' },
        {
          text: 'Open',
          onPress: () => {
            // Use actionViewIntent — more reliable than Linking.openURL for local files
            android
              .actionViewIntent(res.path(), 'application/pdf')
              .catch(() => {
                Alert.alert(
                  'No App Found',
                  'No PDF viewer app found on your device.',
                );
              });
          },
        },
      ]);
    } catch (error) {
      console.error('PDF download error:', error);
      Alert.alert(
        'Download Failed',
        `Could not download the file: ${error.message}`,
      );
    }
  };

  return (
    <View style={[styles.container, { paddingTop: safeAreaInsets.top }]}>
      <WebView
        ref={webViewRef}
        source={{ uri: WEB_URL }}
        startInLoadingState
        javaScriptEnabled
        domStorageEnabled
        onFileDownload={({ nativeEvent }) => {
          downloadPDF(nativeEvent.downloadUrl);
        }}
        onMessage={event => {
          try {
            const msg = JSON.parse(event.nativeEvent.data);

            if (msg.type === 'PDF_BASE64') {
              saveBase64File(msg.data, msg.fileName, 'application/pdf');
            }

            if (msg.type === 'EXCEL_BASE64') {
              saveBase64File(
                msg.data,
                msg.fileName,
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              );
            }
          } catch (e) {
            console.error('Failed to parse WebView message:', e);
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});

export default App;
