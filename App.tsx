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

  useEffect(() => {
    const onBackPress = () => {
      // ✅ Send back event to Web
      webViewRef.current?.postMessage(JSON.stringify({ type: 'BACK_BUTTON' }));

      return true; // 🚨 Prevent default exit
    };

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      onBackPress,
    );

    return () => subscription.remove();
  }, []);

  // const savePdf = async (base64Data, fileName) => {
  //   console.log(base64Data,fileName,'fileName')
  //   const { fs } = ReactNativeBlobUtil;

  //   const pureBase64 = base64Data.split(",")[1];
  //   const path = ${fs.dirs.DownloadDir}/${fileName};

  //   await fs.writeFile(path, pureBase64, "base64");

  //   ReactNativeBlobUtil.android.openDocument(path);
  // };

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
  const saveExcel1 = async (base64Data, fileName) => {
    try {
      const { fs, android } = ReactNativeBlobUtil;

      // Remove base64 prefix
      const pureBase64 = base64Data.split(',')[1];

      const path = `${fs.dirs.DownloadDir}/${fileName}`;

      await fs.writeFile(path, pureBase64, 'base64');

      console.log('Excel saved at:', path);

      // Open Excel file
      try {
        android.actionViewIntent(
          path,
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        );
      } catch (err) {
        Alert.alert('Download Complete', 'Excel file downloaded successfully');
      }
    } catch (error) {
      console.log('Excel Save Error:', error);
    }
  };

  const saveExcel = async (base64Data, fileName) => {
    try {
      console.log('Excel base64 length:', base64Data.length);
      const { fs, android } = ReactNativeBlobUtil;

      const pureBase64 = base64Data.replace(/^data:.*;base64,/, '');

      const path = `${fs.dirs.DownloadDir}/${fileName}`;

      await fs.writeFile(path, pureBase64, 'base64');

      console.log('Excel saved at:', path);

      android.actionViewIntent(
        path,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
    } catch (error) {
      console.log('Excel Save Error:', error);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: safeAreaInsets.top }]}>
      <WebView
        source={{ uri: WEB_URL }}
        startInLoadingState
        javaScriptEnabled
        domStorageEnabled
        onFileDownload={({ nativeEvent }) => {
          downloadPDF(nativeEvent.downloadUrl);
        }}
        onMessage={event => {
          console.log(event, 'ddd');
          const msg = JSON.parse(event.nativeEvent.data);

          if (msg.type === 'PDF_BASE64') {
            savePdf(msg.data, msg.fileName);
          }
          if (msg.type === 'EXCEL_BASE64') {
            console.log(msg.fileName, msg.data, 'excel');
            saveExcel(msg.data, msg.fileName);
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
