// /**
//  * Sample React Native App
//  * https://github.com/facebook/react-native
//  *
//  * @format
//  */

// import { NewAppScreen } from '@react-native/new-app-screen';
// import { StatusBar, StyleSheet, useColorScheme, View } from 'react-native';
// import {
//   SafeAreaProvider,
//   useSafeAreaInsets,
// } from 'react-native-safe-area-context';

// function App() {
//   const isDarkMode = useColorScheme() === 'dark';

//   return (
//     <SafeAreaProvider>
//       <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
//       <AppContent />
//     </SafeAreaProvider>
//   );
// }

// function AppContent() {
//   const safeAreaInsets = useSafeAreaInsets();

//   return (
//     <View style={styles.container}>
//       <NewAppScreen
//         templateFileName="App.tsx"
//         safeAreaInsets={safeAreaInsets}
//       />
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//   },
// });

// export default App;


import React from 'react';
import { Linking, StatusBar, StyleSheet, useColorScheme, View, Platform, PermissionsAndroid } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import ReactNativeBlobUtil from 'react-native-blob-util';

const WEB_URL = `https://developer.webplanetsoft.com/frontend/`

const requestStoragePermission = async () => {
  if (Platform.OS === 'android') {
    await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
      {
        title: 'Storage Permission',
        message: 'App needs access to your storage to download files',
        buttonPositive: 'OK',
      }
    );
  }
};

const downloadPDF = async (url:any) => {
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
    .then((res) => {
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
    const pureBase64 = base64Data.split(",")[1];

    const path = `${fs.dirs.DownloadDir}/${fileName}`;

    await fs.writeFile(path, pureBase64, "base64");

    console.log("PDF saved at:", path);

    // ✅ Correct way to open PDF
    android.actionViewIntent(path, "application/pdf");

  } catch (error) {
    console.log("PDF Save Error:", error);
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
          onMessage={(event) => {
    const msg = JSON.parse(event.nativeEvent.data);

    if (msg.type === "PDF_BASE64") {
      savePdf(msg.data, msg.fileName);
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