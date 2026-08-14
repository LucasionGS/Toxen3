import { FramePayload } from "../layer";

export interface InitMessage {
  type: "init";
  canvas: OffscreenCanvas;
}

export interface ResizeMessage {
  type: "resize";
  width: number;
  height: number;
}

export interface ImageMessage {
  type: "image";
  key: string;
  bitmap: ImageBitmap;
}

export interface FrameMessage {
  type: "frame";
  payload: FramePayload;
}

export interface ClearMessage {
  type: "clear";
}

export type WorkerMessage = InitMessage | ResizeMessage | ImageMessage | FrameMessage | ClearMessage;

/** Returns the spectrum buffer so the two sides can ping-pong a fixed pair without allocating. */
export interface FrameDoneMessage {
  type: "frameDone";
  spectrum: Uint8Array;
}

export type WorkerResponse = FrameDoneMessage;
