import React, { useEffect, useRef } from 'react';
import {
  Linking,
  StatusBar,
  StyleSheet,
  useColorScheme,
  View,
  Platform,
  PermissionsAndroid,
  BackHandler,
  Alert,
} from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import ReactNativeBlobUtil from 'react-native-blob-util';

const WEB_URL = `https://admin.aryajan.in/frontend/`;

const requestStoragePermission = async () => {
  if (Platform.OS === 'android') {
    await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
      {
        title: 'Storage Permission',
        message: 'App needs access to your storage to download files',
        buttonPositive: 'OK',
      },
    );
  }
};

const downloadPDF = async (url: any) => {
  await requestStoragePermission();

  const { config, fs } = ReactNativeBlobUtil;
  const path = fs.dirs.DownloadDir + `/file_${Date.now()}.pdf`;

  config({
    fileCache: true,
    path,
    addAndroidDownloads: {
      useDownloadManager: true,
      notification: true,
      path,
      description: 'Downloading PDF...',
    },
  })
    .fetch('GET', url)
    .then(res => {
      console.log('Saved to:', res.path());
      Linking.openURL('file://' + res.path());
    })
    .catch(console.error);
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
  const webViewReady = useRef(false); // ✅ FIX 1: track when WebView is ready

  useEffect(() => {
    const onBackPress = () => {
      // ✅ FIX 2: only postMessage when WebView is ready (ref is not null)
      if (webViewReady.current && webViewRef.current) {
        webViewRef.current.postMessage(JSON.stringify({ type: 'BACK_BUTTON' }));
      }
      return true; // 🚨 Prevent default exit
    };

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      onBackPress,
    );

    return () => subscription.remove();
  }, []);

  const savePdf = async (base64Data, fileName) => {
    try {
      const { fs, android } = ReactNativeBlobUtil;

      // Remove base64 prefix
      const pureBase64 = base64Data.split(',')[1];

      const path = `${fs.dirs.DownloadDir}/${fileName}`;

      await fs.writeFile(path, pureBase64, 'base64');

      console.log('PDF saved at:', path);

      // ✅ Correct way to open PDF
      android.actionViewIntent(path, 'application/pdf');
    } catch (error) {
      console.log('PDF Save Error:', error);
    }
  };

  const requestStoragePermission = async () => {
    if (Platform.OS !== 'android') return true;

    // Android 13+ doesn't need storage permission
    if (Platform.Version >= 33) return true;

    // Android 11-12 (API 30-32)
    if (Platform.Version >= 30) {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }

    // Android 10 and below
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
      {
        title: 'Storage Permission',
        message: 'App needs storage access to download files',
        buttonPositive: 'OK',
      },
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  };

  const saveBase64File = async (base64Data, fileName, mimeType) => {
    try {
      const { fs, android } = ReactNativeBlobUtil;

      if (!base64Data) {
        Alert.alert('Error', 'No file data received');
        return;
      }

      // Remove base64 prefix
      const pureBase64 = base64Data.replace(/^data:.*;base64,/, '').trim();

      // Public downloads folder
      const downloadDir = '/storage/emulated/0/Download';

      // Ensure unique file name
      const finalFileName = `${Date.now()}_${fileName}`;

      const path = `${downloadDir}/${finalFileName}`;

      console.log('Saving file to:', path);

      // Ensure directory exists
      const dirExists = await fs.exists(downloadDir);
      if (!dirExists) {
        await fs.mkdir(downloadDir);
      }

      // Save file
      await fs.writeFile(path, pureBase64, 'base64');

      // Scan file so Android detects it
      await fs.scanFile([{ path: path, mime: mimeType }]);

      // Register with Download Manager
      await android.addCompleteDownload({
        title: finalFileName,
        description: 'File downloaded',
        mime: mimeType,
        path: path,
        showNotification: true,
        scannable: true,
      });

      console.log('File saved successfully:', path);

      Alert.alert(
        'Download Complete',
        `${finalFileName} saved to Downloads folder`,
        [
          { text: 'OK' },
          {
            text: 'Open',
            onPress: () => {
              android.actionViewIntent(path, mimeType).catch(() => {
                Alert.alert(
                  'No App Found',
                  'Install a compatible app to open this file.',
                );
              });
            },
          },
        ],
      );
    } catch (error) {
      console.log('Download error:', error);
      Alert.alert('Download Failed', error.message);
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
        allowsFullscreenVideo={false}
        onLoad={() => {
          webViewReady.current = true; // ✅ FIX 3: mark ready after page loads
        }}
        onFileDownload={({ nativeEvent }) => {
          downloadPDF(nativeEvent.downloadUrl);
        }}
        onMessage={event => {
          try {
            let raw = event.nativeEvent.data;

            // Handle double-stringified JSON
            if (typeof raw === 'string' && raw.startsWith('"')) {
              raw = JSON.parse(raw); // unwrap outer string
            }
            console.log('Raw data:', raw);
            const msg = typeof raw === 'string' ? JSON.parse(raw) : raw;

            console.log('Message type:', msg.type);
            console.log('Data length:', msg.data?.length);
            console.log('Record count:', msg.len);
            console.log('Initial Record length:', msg.length);

            if (msg.type === 'PDF_BASE64') {
              saveBase64File(msg.data, msg.fileName, 'application/pdf');
            }

            if (msg.type === 'EXCEL_BASE64') {
              if (!msg.data || msg.data.length === 0) {
                Alert.alert('Error', 'Received empty Excel data');
                return;
              }
              saveBase64File(
                msg.data,
                msg.fileName,
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              );
            }

            if (msg.type === 'EXIT_APP') {
              BackHandler.exitApp();
            }
          } catch (e) {
            console.error('Failed to parse WebView message:', e);
            console.error(
              'Raw data:',
              event.nativeEvent.data?.substring(0, 200),
            );
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
