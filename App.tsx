import React, { useEffect, useRef, useState } from 'react';
import {
  StatusBar,
  StyleSheet,
  useColorScheme,
  View,
  Platform,
  PermissionsAndroid,
  BackHandler,
  Alert,
  Image,
  Animated,
} from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import ReactNativeBlobUtil from 'react-native-blob-util';

const WEB_URL = `https://developer.webplanetsoft.com/frontend`;

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
  const webViewReady = useRef(false);

  const [splashDone, setSplashDone] = useState(false);
  const splashOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const onBackPress = () => {
      if (webViewReady.current && webViewRef.current) {
        webViewRef.current.postMessage(JSON.stringify({ type: 'BACK_BUTTON' }));
      }
      return true;
    };
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      onBackPress,
    );
    return () => subscription.remove();
  }, []);

  const hideLoader = () => {
    setTimeout(() => {
      Animated.timing(splashOpacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => setSplashDone(true));
    }, 500);
  };

  // ✅ Shown inside WebView during native blank gap
  const renderLoadingView = () => (
    <View style={styles.loaderContainer}>
      <Image
        source={require('./assets/images/ic_launcher-playstore.png')}
        style={styles.splashImage}
        resizeMode="contain"
      />
    </View>
  );

  // ---------------- DOWNLOAD + FILE LOGIC ----------------

  const requestStoragePermission = async () => {
    if (Platform.OS !== 'android') return true;
    if (Platform.Version >= 33) return true;
    if (Platform.Version >= 30) {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  };

  const saveBase64File = async (base64Data, fileName, mimeType) => {
    try {
      const { fs, android } = ReactNativeBlobUtil;
      const pureBase64 = base64Data.replace(/^data:.*;base64,/, '').trim();
      const downloadDir = '/storage/emulated/0/Download';
      const finalFileName = `${Date.now()}_${fileName}`;
      const path = `${downloadDir}/${finalFileName}`;

      const dirExists = await fs.exists(downloadDir);
      if (!dirExists) await fs.mkdir(downloadDir);

      await fs.writeFile(path, pureBase64, 'base64');
      await fs.scanFile([{ path: path, mime: mimeType }]);
      await android.addCompleteDownload({
        title: finalFileName,
        description: 'File downloaded',
        mime: mimeType,
        path: path,
        showNotification: true,
        scannable: true,
      });

      Alert.alert('Download Complete', `${finalFileName} saved`, [
        { text: 'OK' },
        {
          text: 'Open',
          onPress: () => {
            android.actionViewIntent(path, mimeType).catch(() => {
              Alert.alert('No App Found');
            });
          },
        },
      ]);
    } catch (error) {
      Alert.alert('Download Failed', error.message);
    }
  };

  const downloadPDF = async url => {
    try {
      const hasPermission = await requestStoragePermission();
      if (!hasPermission) return;

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
          title: fileName,
          description: 'Downloading PDF...',
          mime: 'application/pdf',
          mediaScannable: true,
        },
      }).fetch('GET', url);

      Alert.alert('Download Complete', 'PDF saved', [
        { text: 'OK' },
        {
          text: 'Open',
          onPress: () => {
            android.actionViewIntent(res.path(), 'application/pdf');
          },
        },
      ]);
    } catch (error) {
      Alert.alert('Download Failed', error.message);
    }
  };

  // ---------------- UI ----------------

  return (
    <View style={[styles.container, { paddingTop: safeAreaInsets.top }]}>
      {/* ✅ WebView always fully visible — splash sits on top */}
      <WebView
        ref={webViewRef}
        source={{ uri: WEB_URL }}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState={true} // ✅ covers native blank gap
        renderLoading={renderLoadingView} // ✅ shows your logo inside WebView
        onLoad={() => {
          webViewReady.current = true;
        }}
        onLoadEnd={hideLoader}
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
            if (msg.type === 'EXIT_APP') {
              BackHandler.exitApp();
            }
          } catch (e) {
            console.log('Message parse error:', e);
          }
        }}
      />

      {/* ✅ Outer splash — covers app launch & fades out after WebView paints */}
      {!splashDone && (
        <Animated.View
          style={[styles.loaderContainer, { opacity: splashOpacity }]}
        >
          <Image
            source={require('./assets/images/kb_jute.webp')}
            style={styles.splashImage}
            resizeMode="contain"
          />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loaderContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    zIndex: 10,
  },
  splashImage: {
    width: '70%',
    height: '70%',
  },
});

export default App;
