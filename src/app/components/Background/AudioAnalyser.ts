import { Toxen } from '../../ToxenApp';

export const DEFAULT_FFTSIZE = 1024;

/**
 * Owns the AudioContext the whole app hangs off: the analyser the visualizer reads, the gain node
 * audio output flows through, and the source node AudioEffects attaches to.
 */
export default class AudioAnalyser {
  private analyser: AnalyserNode = null;
  private audioContext: AudioContext = null;
  private sourceNode: MediaElementAudioSourceNode = null;
  private effectsGainNode: GainNode = null;

  private buffer: Uint8Array<ArrayBuffer> = null;
  /** Second half of `buffer`, reversed. This is what the styles actually read. */
  private processed: Uint8Array<ArrayBuffer> = null;

  public get initialized() {
    return this.analyser !== null;
  }

  /**
   * `createMediaElementSource` can only ever be called once per media element, so this must not
   * run twice for the same player.
   */
  public initialize(media: HTMLMediaElement) {
    const audioContext = new AudioContext();
    const source = audioContext.createMediaElementSource(media);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = DEFAULT_FFTSIZE;

    this.audioContext = audioContext;
    this.sourceNode = source;
    this.analyser = analyser;
    this.effectsGainNode = audioContext.createGain();

    source.connect(analyser);
    source.connect(this.effectsGainNode);
    this.effectsGainNode.connect(audioContext.destination);

    setTimeout(() => {
      if (Toxen.audioEffects && !Toxen.audioEffects.initialized) {
        try {
          Toxen.audioEffects.connectToSharedAudioGraph(audioContext, source, this.effectsGainNode);
        } catch (error) {
          console.warn('Audio effects failed to initialize, using direct audio path:', error);
        }
      }
    }, 100);
  }

  /**
   * Reads the current spectrum into a reused buffer and returns the upper half, reversed. The
   * returned array is owned by this instance and is overwritten on the next call.
   */
  public read(fftSize: number): Uint8Array<ArrayBuffer> {
    if (fftSize && this.analyser.fftSize !== fftSize) {
      this.analyser.fftSize = fftSize;
      this.buffer = null;
      this.processed = null;
    }

    const bufferLength = this.analyser.frequencyBinCount;
    if (!this.buffer || this.buffer.length !== bufferLength) {
      this.buffer = new Uint8Array(bufferLength);
      this.processed = new Uint8Array(bufferLength - Math.floor(bufferLength / 2));
    }

    this.analyser.getByteFrequencyData(this.buffer);

    // The original reversed in place then sliced the back half off. Written out, that is the
    // front half of the source in reverse order.
    const out = this.processed;
    const count = out.length;
    for (let i = 0; i < count; i++) {
      out[i] = this.buffer[count - 1 - i];
    }
    return out;
  }

  public dispose() {
    this.analyser = null;
    this.buffer = null;
    this.processed = null;
  }
}
