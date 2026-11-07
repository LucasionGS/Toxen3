/**
 * Turn what `song.storage.fileUrl` returns into something `<img>` and `<audio>` can load. Cloud URLs are already
 * loadable; local storage returns a plain disk path, which needs a `file://` URL.
 */
export function toLoadableUrl(url: string): string {
  if (!url || /^(https?|file|blob|data|tx|txs):/i.test(url)) return url;
  const path = url.replace(/\\/g, "/");
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  // Windows drive paths ("C:/music") need the extra slash after "file://"
  return `file://${encoded.startsWith("/") ? "" : "/"}${encoded}`;
}
