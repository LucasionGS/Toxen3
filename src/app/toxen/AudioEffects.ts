import Settings from "./Settings";
import { Toxen } from "../ToxenApp";

export default class AudioEffects {
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private convolverNode: ConvolverNode | null = null;
  private delayNode: DelayNode | null = null;
  private bassBoostFilter: BiquadFilterNode | null = null;
  private pannerNode: PannerNode | null = null;
  private bassWetGain: GainNode | null = null;
  private delayWetGain: GainNode | null = null;
  private reverbWetGain: GainNode | null = null;
  private pannerWetGain: GainNode | null = null;
  private effectsMix: GainNode | null = null;
  private echoFeedback: GainNode | null = null;
  private animationFrame: number | null = null;
  private isInitialized = false;

  public get initialized(): boolean {
    return this.isInitialized;
  }

  public initialize(mediaElement: HTMLMediaElement) {
    if (this.isInitialized) return;

    try {
      // The audio effects will be connected later via connectToSharedAudioGraph
      // when the Visualizer initializes its audio context
      console.log('Audio effects will be initialized via shared audio graph');
    } catch (error) {
      console.error('Failed to initialize audio effects:', error);
    }
  }

  private setupEffectChain() {
    if (!this.audioContext) return;
    
    // Create effect nodes
    this.gainNode = this.audioContext.createGain();
    this.convolverNode = this.audioContext.createConvolver();
    this.delayNode = this.audioContext.createDelay(2.0); // Max 2 seconds delay
    this.bassBoostFilter = this.audioContext.createBiquadFilter();
    this.pannerNode = this.audioContext.createPanner();
  }

  private connectToExistingAudioGraph() {
    // This will be called when we integrate with the visualizer's audio graph
    // For now, we'll skip the connection and just prepare the effects
  }

  private connectEffectChain() {
    if (!this.sourceNode || !this.gainNode) return;
    this.pannerNode = this.audioContext.createPanner();
    
    // Configure bass boost filter
    this.bassBoostFilter.type = 'lowshelf';
    this.bassBoostFilter.frequency.value = 200; // Boost frequencies below 200Hz
    
    // Configure panner for 3D audio
    this.pannerNode.panningModel = 'HRTF';
    this.pannerNode.distanceModel = 'inverse';
    this.pannerNode.maxDistance = 10000;
    
    try {
      // Create reverb impulse response
      this.createReverbImpulse();
      
      // Connect the audio graph
      this.connectNodes();
      
      this.isInitialized = true;
      console.log('Audio effects initialized');
    } catch (error) {
      console.error('Failed to initialize audio effects:', error);
      Toxen.error('Audio effects not supported in this browser', 3000);
    }
  }

  public connectToSharedAudioGraph(audioContext: AudioContext, sourceNode: MediaElementAudioSourceNode, outputNode: GainNode) {
    if (this.isInitialized) return;

    try {
      this.audioContext = audioContext;
      this.sourceNode = sourceNode;

      // Create effect nodes
      this.bassBoostFilter = audioContext.createBiquadFilter();
      this.delayNode = audioContext.createDelay(2.0);
      this.convolverNode = audioContext.createConvolver();
      this.pannerNode = audioContext.createPanner();

      // Create individual wet/dry gains for each effect
      const bassWetGain = audioContext.createGain();
      const delayWetGain = audioContext.createGain();
      const reverbWetGain = audioContext.createGain();
      const pannerWetGain = audioContext.createGain();
      const effectsMix = audioContext.createGain();

      // Configure bass boost filter
      this.bassBoostFilter.type = 'lowshelf';
      this.bassBoostFilter.frequency.value = 200;
      this.bassBoostFilter.gain.value = 0;

      // Configure delay for echo
      this.delayNode.delayTime.value = 0.3;

      // Configure panner for 3D audio - use simpler stereo panning first
      this.pannerNode.panningModel = 'equalpower'; // More reliable than HRTF
      this.pannerNode.distanceModel = 'linear';
      this.pannerNode.maxDistance = 1000;
      this.pannerNode.rolloffFactor = 1;
      this.pannerNode.refDistance = 1;
      this.pannerNode.setPosition(0, 0, 0);

      // Create reverb impulse response
      this.createReverbImpulse();

      // Create PARALLEL effect chains (not series)
      // Each effect gets its own path from source to mix
      
      // Bass boost path: source -> bassFilter -> bassWetGain -> effectsMix
      sourceNode.connect(this.bassBoostFilter);
      this.bassBoostFilter.connect(bassWetGain);
      bassWetGain.connect(effectsMix);

      // Delay/Echo path: source -> delay -> delayWetGain -> effectsMix  
      sourceNode.connect(this.delayNode);
      this.delayNode.connect(delayWetGain);
      delayWetGain.connect(effectsMix);

      // Reverb path: source -> reverb -> reverbWetGain -> effectsMix
      sourceNode.connect(this.convolverNode);
      this.convolverNode.connect(reverbWetGain);
      reverbWetGain.connect(effectsMix);

      // 3D Audio path: source -> panner -> pannerWetGain -> effectsMix
      sourceNode.connect(this.pannerNode);
      this.pannerNode.connect(pannerWetGain);
      pannerWetGain.connect(effectsMix);

      // Mix all effects to output
      effectsMix.connect(outputNode);

      // Store references for individual control
      this.bassWetGain = bassWetGain;
      this.delayWetGain = delayWetGain;
      this.reverbWetGain = reverbWetGain;
      this.pannerWetGain = pannerWetGain;
      this.effectsMix = effectsMix;

      // Initialize all effects as disabled
      bassWetGain.gain.value = 0;
      delayWetGain.gain.value = 0;
      reverbWetGain.gain.value = 0;
      pannerWetGain.gain.value = 0;

      this.isInitialized = true;
      this.updateEffects();
      this.startAnimation(); // Start the continuous animation loop
      
      console.log('Audio effects connected with parallel processing');
    } catch (error: any) {
      console.error('Failed to connect audio effects to shared graph:', error);
      this.isInitialized = true;
    }
  }

  private startAnimation() {
    // Start the animation loop for continuous 3D audio movement
    const animate = () => {
      if (this.isInitialized) {
        this.update3DAudio();
        this.animationFrame = requestAnimationFrame(animate);
      }
    };
    this.animationFrame = requestAnimationFrame(animate);
  }

  private update3DAudio() {
    const audio3DLevel = Settings.get('audio3DLevel', 0) / 100;
    const enabled = Settings.get('audioEffectsEnabled', false);
    
    if (this.pannerNode && this.pannerWetGain && enabled && audio3DLevel > 0) {
      // Continuous animation for 3D effect (slower revolution)
      const time = Date.now() * 0.001; // Reduced from 0.003 to 0.001 for slower movement
      const panPosition = Math.sin(time) * audio3DLevel;
      
      this.pannerNode.setPosition(
        panPosition * 10,  // X: Strong left-right movement
        0,                 // Y: No vertical movement
        -1                 // Z: Close to listener
      );
      
      this.pannerWetGain.gain.value = audio3DLevel;
      
      // if (Math.floor(time * 2) % 60 === 0) { // Log every ~30 seconds
      //   console.log(`3D Audio animating: pan=${panPosition.toFixed(2)}, level=${audio3DLevel.toFixed(2)}`);
      // }
    } else if (this.pannerNode && this.pannerWetGain) {
      // Reset when disabled
      this.pannerNode.setPosition(0, 0, -1);
      this.pannerWetGain.gain.value = 0;
    }
  }

  private createReverbImpulse(intensity: number = 1.0) {
    if (!this.audioContext || !this.convolverNode) return;
    
    const sampleRate = this.audioContext.sampleRate;
    const length = sampleRate * 2; // 2 seconds of reverb
    const impulse = this.audioContext.createBuffer(2, length, sampleRate);
    
    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        const decay = Math.pow(1 - i / length, 2);
        channelData[i] = (Math.random() * 2 - 1) * decay * intensity;
      }
    }
    
    this.convolverNode.buffer = impulse;
  }

  private connectNodes() {
    if (!this.sourceNode || !this.audioContext) return;
    
    // Create the audio processing chain
    this.sourceNode
      .connect(this.bassBoostFilter!)
      .connect(this.delayNode!)
      .connect(this.convolverNode!)
      .connect(this.pannerNode!)
      .connect(this.gainNode!)
      .connect(this.audioContext.destination);
  }

  public updateEffects() {
    if (!this.isInitialized) return;
    
    const enabled = Settings.get('audioEffectsEnabled', false);
    
    if (!enabled) {
      // When disabled, set all wet gains to 0
      if (this.bassWetGain) this.bassWetGain.gain.value = 0;
      if (this.delayWetGain) this.delayWetGain.gain.value = 0;
      if (this.reverbWetGain) this.reverbWetGain.gain.value = 0;
      if (this.pannerWetGain) this.pannerWetGain.gain.value = 0;
      return;
    }
    
    // Get individual effect levels
    const reverbLevel = Settings.get('audioReverbLevel', 0) / 100;
    const echoLevel = Settings.get('audioEchoLevel', 0) / 100;
    const bassLevel = Settings.get('audioBassBoostLevel', 0);
    const audio3DLevel = Settings.get('audio3DLevel', 0) / 100;
    
    // Update Bass Boost
    if (this.bassBoostFilter && this.bassWetGain) {
      this.bassBoostFilter.gain.value = bassLevel; // dB boost
      this.bassWetGain.gain.value = bassLevel > 0 ? 1 : 0; // On/Off based on level
    }
    
    // Update Echo/Delay
    if (this.delayNode && this.delayWetGain) {
      if (echoLevel > 0) {
        this.delayNode.delayTime.value = 0.3; // 300ms delay
        this.delayWetGain.gain.value = echoLevel * 0.8; // Scale the wet signal
        
        // Create feedback loop for echo if not exists
        if (!this.echoFeedback) {
          this.echoFeedback = this.audioContext!.createGain();
          this.delayNode.connect(this.echoFeedback);
          this.echoFeedback.connect(this.delayNode);
        }
        this.echoFeedback.gain.value = echoLevel * 0.4; // Feedback amount
      } else {
        this.delayWetGain.gain.value = 0;
        if (this.echoFeedback) {
          this.echoFeedback.gain.value = 0;
        }
      }
    }
    
    // Update Reverb
    if (this.convolverNode && this.reverbWetGain) {
      if (reverbLevel > 0) {
        this.createReverbImpulse(reverbLevel);
        this.reverbWetGain.gain.value = reverbLevel * 0.6; // Scale reverb intensity
      } else {
        this.reverbWetGain.gain.value = 0;
      }
    }
    
    // Update 3D Audio (static setup only - animation is handled separately)
    if (this.pannerWetGain) {
      if (audio3DLevel > 0) {
        this.pannerWetGain.gain.value = audio3DLevel;
      } else {
        this.pannerWetGain.gain.value = 0;
      }
    }
  }

  public dispose() {
    // Stop animation loop
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.sourceNode = null;
    this.gainNode = null;
    this.convolverNode = null;
    this.delayNode = null;
    this.bassBoostFilter = null;
    this.pannerNode = null;
    this.bassWetGain = null;
    this.delayWetGain = null;
    this.reverbWetGain = null;
    this.pannerWetGain = null;
    this.effectsMix = null;
    this.echoFeedback = null;
    this.isInitialized = false;
  }
}
