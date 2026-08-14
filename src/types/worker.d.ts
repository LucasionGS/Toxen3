/**
 * Vite worker imports. `inline` embeds the bundled worker as a blob, which keeps it working
 * under the `file://` scheme the packaged Electron renderer loads from.
 */
declare module "*?worker&inline" {
  const WorkerConstructor: new () => Worker;
  export default WorkerConstructor;
}

declare module "*?worker" {
  const WorkerConstructor: new () => Worker;
  export default WorkerConstructor;
}
