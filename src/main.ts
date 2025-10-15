import { app, BrowserWindow, nativeImage, protocol } from 'electron';
import Path from "path";
import { updateElectronApp} from "update-electron-app";
import remote from '@electron/remote/main';
remote.initialize();

// process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // Hue bullshit
app.commandLine.appendSwitch('ignore-certificate-errors');

updateElectronApp({
  repo: "LucasionGS/Toxen3"
});
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) { // eslint-disable-line global-require
  app.quit();
}

// Single instance lock - only allow one instance of the app to run at a time
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // Another instance is already running, quit this one
  app.quit();
} else {
  // This is the first instance, set up the handler for when a second instance tries to launch
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, focus our window instead
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
      const mainWindow = windows[0];
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });
}

const createWindow = (): void => {
  const loadingWindow = new BrowserWindow({
    width: 200,
    height: 200,
    frame: false,
    center: true,
    icon: "./src/icons/sizes/icon.ico",
    darkTheme: true,
    title: "Loading Toxen...",
    transparent: true,
    opacity: 0.8,
  });
  
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 768,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
    },
    autoHideMenuBar: true,
    frame: false,
    center: true,
    icon: "./src/icons/sizes/icon.ico",
    // darkTheme: true,
    show: false
  });
  remote.enable(mainWindow.webContents);

  // mainWindow.webContents.openDevTools();
  
  console.log(process.cwd());
  
  
  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    loadingWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL + "/loading.html");
  } else {
    loadingWindow.loadFile(Path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/loading.html`));
    mainWindow.loadFile(Path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  };
  
  mainWindow.once("ready-to-show", () => {
    loadingWindow.close();
    mainWindow.show();
  });
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  createWindow();

  // Register file protocol to access system files.
  protocol.registerFileProtocol('file', (request, callback) => {
    request.url = request.url.replace('tx://', 'http://');
    request.url = request.url.replace('txs://', 'https://');
    request.url = request.url.replace('file:///', '');
    callback(decodeURI(request.url));
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.