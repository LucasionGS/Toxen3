import { app, BrowserWindow, net, protocol } from 'electron';
import Path from "path";
import fs from "node:fs";
import { Readable } from "node:stream";
import { fileURLToPath, pathToFileURL } from "node:url";
// @ts-ignore - electron-squirrel-startup ships no type declarations.
import squirrelStartup from "electron-squirrel-startup";
import { updateElectronApp} from "update-electron-app";
import remote from '@electron/remote/main';
remote.initialize();

// Hue bridges (and other LAN devices) serve their HTTPS API with a self-signed
// certificate; without this switch every renderer fetch() to https://<bridge-ip>
// fails the TLS check.
app.commandLine.appendSwitch('ignore-certificate-errors');

updateElectronApp({
  repo: "LucasionGS/Toxen3"
});
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
// Static import rather than require(): forge no longer ships node_modules with
// the packaged app, so a bare require() would resolve to nothing at runtime.
if (squirrelStartup) {
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

const isDevServer = process.argv.includes('--dev');

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
      // Music (and the Hue Entertainment stream keeping pace with it) must keep
      // running at full rate while the window is hidden; rAF still pauses, so
      // this does not resurrect rendering cost.
      backgroundThrottling: false,
      additionalArguments: isDevServer ? ['--dev'] : [],
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

// MIME types for the file kinds the renderer streams with Range requests. Only
// media reaches serveFileRange in practice; everything else goes via net.fetch,
// which resolves content types itself. Chromium sniffs media containers anyway,
// so an unknown extension falling back to octet-stream still plays.
const rangeMimeTypes: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".ogg": "audio/ogg",
  ".oga": "audio/ogg",
  ".opus": "audio/ogg",
  ".wav": "audio/wav",
  ".flac": "audio/flac",
  ".weba": "audio/webm",
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".webm": "video/webm",
  ".mkv": "video/x-matroska",
  ".mov": "video/quicktime",
  ".ogv": "video/ogg",
  ".avi": "video/x-msvideo",
};

/**
 * Serve a byte range of a local file as a 206 Partial Content response,
 * the way a static file server would. Handles "bytes=a-b", "bytes=a-" and
 * "bytes=-n"; anything else, or a range past the end of the file, gets 416.
 */
async function serveFileRange(filePath: string, rangeHeader: string, headOnly: boolean): Promise<Response> {
  let size: number;
  try {
    const stat = await fs.promises.stat(filePath);
    if (!stat.isFile()) return new Response(null, { status: 404 });
    size = stat.size;
  } catch {
    return new Response(null, { status: 404 });
  }

  const contentType = rangeMimeTypes[Path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match || (match[1] === "" && match[2] === "")) {
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  }

  let start: number;
  let end: number;
  if (match[1] === "") {
    // Suffix range: the last N bytes.
    const suffix = Number(match[2]);
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === "" ? size - 1 : Math.min(Number(match[2]), size - 1);
  }

  if (size === 0 || start >= size || start > end) {
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  }

  const headers = {
    "Content-Type": contentType,
    "Content-Length": String(end - start + 1),
    "Content-Range": `bytes ${start}-${end}/${size}`,
    "Accept-Ranges": "bytes",
  };
  if (headOnly) return new Response(null, { status: 206, headers });

  const stream = fs.createReadStream(filePath, { start, end });
  // Readable.toWeb propagates cancellation (the media element aborts ranges
  // constantly while seeking) back to the file stream, so handles don't leak.
  return new Response(Readable.toWeb(stream) as ReadableStream, { status: 206, headers });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  // Serve local files. Replaces protocol.registerFileProtocol, which has been
  // deprecated since Electron 25 and mishandles Windows paths since Electron 33.
  //
  // Registered before the first window so the renderer's own assets (which are
  // loaded over file:// in packaged builds) never race the handler.
  protocol.handle('file', (request) => {
    const url = new URL(request.url);
    // Backgrounds and media carry a ?h=<hash> cache-buster that is not part of
    // the filename. fileURLToPath ignores it, but strip it so that is explicit.
    url.search = '';
    url.hash = '';
    // fileURLToPath decodes percent-escapes properly, including %23 (#) and
    // %25 (%), which the previous decodeURI() call left mangled.
    const filePath = fileURLToPath(url);

    // <audio>/<video> always request media with a Range header (initially
    // "bytes=0-", then arbitrary offsets while seeking). net.fetch has no way to
    // forward that header to the file:// backend, so it answers with a plain
    // 200 and no Content-Range, which Chromium's media pipeline rejects as
    // MEDIA_ERR_SRC_NOT_SUPPORTED (a 200 with "zero data" from the renderer's
    // point of view). Serve those straight from disk with a proper 206.
    const range = request.headers.get('range');
    if (range) {
      return serveFileRange(filePath, range, request.method === 'HEAD');
    }

    return net.fetch(pathToFileURL(filePath).toString(), {
      // Mandatory: without it net.fetch re-enters this handler and recurses.
      bypassCustomProtocolHandlers: true,
    });
  });

  createWindow();
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