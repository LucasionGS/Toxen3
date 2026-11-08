/**
 * Service worker add-on (loaded through workbox `importScripts`): serves songs kept on this device.
 *
 * `GET /__device/<uid>/<path>` answers from the Origin Private File System at `library/<uid>/<path>`, the layout
 * `DeviceFs` writes. Byte ranges get a 206, so audio and video can seek.
 *
 * `POST /__share-target` receives files shared to the installed app (Android, `share_target` in the manifest), stores
 * them in `inbox/` and opens the app, which imports them (`DeviceLibrary.importInbox`).
 *
 * Keep the prefixes and folder names in sync with `src/app/toxen/storage/device/DeviceFs.ts`.
 */

const DEVICE_PREFIX = "/__device/";
const DEVICE_LIBRARY_DIR = "library";
const DEVICE_SHARE_TARGET = "/__share-target";
const DEVICE_INBOX_DIR = "inbox";
const DEVICE_TYPES = {
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".ogg": "audio/ogg",
  ".oga": "audio/ogg",
  ".opus": "audio/ogg",
  ".wav": "audio/wav",
  ".flac": "audio/flac",
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".bmp": "image/bmp",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".srt": "text/plain; charset=utf-8",
  ".vtt": "text/vtt; charset=utf-8",
  ".lrc": "text/plain; charset=utf-8",
  ".tst": "text/plain; charset=utf-8",
  ".yml": "text/yaml; charset=utf-8",
  ".yaml": "text/yaml; charset=utf-8",
};

self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === DEVICE_SHARE_TARGET && event.request.method === "POST") {
    event.respondWith(receiveShare(event.request));
    return;
  }
  if (!url.pathname.startsWith(DEVICE_PREFIX)) return;
  if (event.request.method !== "GET" && event.request.method !== "HEAD") return;
  event.respondWith(serveDeviceFile(event.request, url).catch(error => {
    console.error("Unable to serve a device file.", error);
    return new Response("Unable to read the file from this device.", { status: 500 });
  }));
});

async function serveDeviceFile(request, url) {
  let parts;
  try {
    parts = url.pathname.slice(DEVICE_PREFIX.length).split("/").map(part => decodeURIComponent(part));
  } catch {
    return new Response("Bad path.", { status: 400 });
  }
  if (parts.length < 2 || parts.some(part => part === "" || part === "." || part === ".." || part.includes("/") || part.includes("\\"))) {
    return new Response("Bad path.", { status: 400 });
  }

  const file = await readDeviceFile([DEVICE_LIBRARY_DIR, ...parts]);
  if (!file) return new Response("Not found.", { status: 404 });

  const name = parts[parts.length - 1].toLowerCase();
  const dot = name.lastIndexOf(".");
  const type = (dot >= 0 && DEVICE_TYPES[name.slice(dot)]) || file.type || "application/octet-stream";
  const headers = {
    "Content-Type": type,
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-store",
  };
  const body = blob => request.method === "HEAD" ? null : blob;

  // Example: "bytes=0-" or "bytes=1048576-2097151"
  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("Range") || "");
  if (!range || (range[1] === "" && range[2] === "")) {
    return new Response(body(file), { status: 200, headers: { ...headers, "Content-Length": String(file.size) } });
  }

  let start;
  let end;
  if (range[1] === "") { // Suffix range: the last N bytes
    start = Math.max(0, file.size - Number(range[2]));
    end = file.size - 1;
  }
  else {
    start = Number(range[1]);
    end = range[2] === "" ? file.size - 1 : Math.min(Number(range[2]), file.size - 1);
  }
  if (start >= file.size || start > end) {
    return new Response(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${file.size}` } });
  }
  return new Response(body(file.slice(start, end + 1)), {
    status: 206,
    headers: {
      ...headers,
      "Content-Length": String(end - start + 1),
      "Content-Range": `bytes ${start}-${end}/${file.size}`,
    },
  });
}

async function readDeviceFile(path) {
  try {
    let dir = await navigator.storage.getDirectory();
    for (const part of path.slice(0, -1)) dir = await dir.getDirectoryHandle(part);
    const handle = await dir.getFileHandle(path[path.length - 1]);
    return await handle.getFile();
  } catch (error) {
    if (error && (error.name === "NotFoundError" || error.name === "TypeMismatchError")) return null;
    throw error;
  }
}

async function receiveShare(request) {
  let stored = 0;
  try {
    const form = await request.formData();
    const inbox = await (await navigator.storage.getDirectory()).getDirectoryHandle(DEVICE_INBOX_DIR, { create: true });
    for (const file of form.getAll("media")) {
      if (!(file instanceof File) || !file.name) continue;
      // A prefix keeps two shares of files with the same name apart
      const name = `${Date.now()}-${stored}-${file.name.replace(/[\\/]/g, "_")}`;
      const handle = await inbox.getFileHandle(name, { create: true });
      const writable = await handle.createWritable();
      await file.stream().pipeTo(writable);
      stored++;
    }
  } catch (error) {
    console.error("Unable to store the shared files.", error);
  }
  return Response.redirect(`/?shared=${stored}`, 303);
}
