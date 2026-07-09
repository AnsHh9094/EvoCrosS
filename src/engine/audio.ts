/**
 * EVOCROSS Audio DSP Engine
 * 
 * Copyright (c) 2026 AnsHh9094. All rights reserved.
 * Proprietary and Confidential. Unauthorized copying or redistribution
 * of this project, via any medium, is strictly prohibited.
 */
import type { AudioCommand } from '../compiler/evaluator';

export class AudioEngine {
  private audioCtx: AudioContext | null = null;
  private activeNodes: AudioNode[] = [];
  private timeouts: number[] = [];
  private isPlaying = false;

  // Master Effects
  private masterGain: GainNode | null = null;
  private delayNode: DelayNode | null = null;
  private reverbNode: ConvolverNode | null = null;
  public analyser: AnalyserNode | null = null;

  // Channel Gain Nodes for Mixer
  private drumsGainNode: GainNode | null = null;
  private melodyGainNode: GainNode | null = null;
  private synthGainNode: GainNode | null = null;
  private delayFeedbackNode: GainNode | null = null;
  private reverbMixNode: GainNode | null = null;

  // Current volume values
  private drumsVol = 1.0;
  private melodyVol = 0.8;
  private synthVol = 0.7;
  private delayVol = 0.3;
  private reverbVol = 0.18;

  // Real-time parameters (Neuro-Descriptor)
  private currentX = 0.5; // X: Timbre / Luminescence (sweeps filters/detuning)
  private currentY = 0.5; // Y: Energy / Complexity (sweeps BPM/density)
  private currentBpm = 120;
  private currentVolume = 0.8;

  // Track active filters and oscillators for real-time XY modulation
  private activeFiltersList: BiquadFilterNode[] = [];
  private activeOscillatorsList: OscillatorNode[] = [];

  private getContext(): AudioContext {
    if (!this.audioCtx) {
      this.audioCtx = new AudioContext();
      this.setupMasterEffects(this.audioCtx);
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  private setupMasterEffects(ctx: AudioContext) {
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = this.currentVolume;

    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 512;
    
    this.masterGain.connect(this.analyser);
    this.analyser.connect(ctx.destination);

    // Initialize channel gain nodes
    this.drumsGainNode = ctx.createGain();
    this.melodyGainNode = ctx.createGain();
    this.synthGainNode = ctx.createGain();
    
    this.drumsGainNode.gain.value = this.drumsVol;
    this.melodyGainNode.gain.value = this.melodyVol;
    this.synthGainNode.gain.value = this.synthVol;
    
    this.drumsGainNode.connect(this.masterGain);
    this.melodyGainNode.connect(this.masterGain);
    this.synthGainNode.connect(this.masterGain);

    // Setup Ping-Pong Delay
    this.delayNode = ctx.createDelay();
    this.delayNode.delayTime.value = 0.33;
    const feedback = ctx.createGain();
    feedback.gain.value = this.delayVol;
    this.delayFeedbackNode = feedback;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1800; // slightly warmer delay filter

    this.delayNode.connect(feedback);
    feedback.connect(filter);
    filter.connect(this.delayNode);
    this.delayNode.connect(this.masterGain);

    // Setup Procedural Reverb (White noise burst with decay)
    this.reverbNode = ctx.createConvolver();
    const length = ctx.sampleRate * 2.0; // 2 seconds
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let i = 0; i < 2; i++) {
      const channel = impulse.getChannelData(i);
      for (let j = 0; j < length; j++) {
        // Exponential decay of white noise
        channel[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / length, 3.5); // smoother decay
      }
    }
    this.reverbNode.buffer = impulse;
    
    const reverbMix = ctx.createGain();
    reverbMix.gain.value = this.reverbVol;
    this.reverbMixNode = reverbMix;
    this.reverbNode.connect(reverbMix);
    reverbMix.connect(this.masterGain);
  }

  play(commands: AudioCommand[]) {
    this.stop();
    this.isPlaying = true;

    // Find and set initial global BPM
    let initialBpm = 120;
    for (const cmd of commands) {
      if (cmd.type === 'drum' || cmd.type === 'melody') {
        if (cmd.bpm) initialBpm = cmd.bpm;
      }
    }
    this.currentBpm = initialBpm;

    for (const cmd of commands) {
      switch (cmd.type) {
        case 'synth':
          this.playSynth(cmd);
          break;
        case 'drum':
          this.playDrum(cmd);
          break;
        case 'melody':
          this.playMelody(cmd);
          break;
      }
    }
  }

  stop() {
    this.isPlaying = false;
    for (const timeout of this.timeouts) {
      clearTimeout(timeout);
    }
    this.timeouts = [];
    for (const node of this.activeNodes) {
      try {
        if (node instanceof OscillatorNode) node.stop();
        node.disconnect();
      } catch { /* already stopped */ }
    }
    this.activeNodes = [];
    this.activeFiltersList = [];
    this.activeOscillatorsList = [];
  }

  setMasterVolume(vol: number) {
    this.currentVolume = vol;
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(vol, this.getContext().currentTime, 0.05);
    }
  }

  setBpm(bpm: number) {
    this.currentBpm = bpm;
  }

  // DJ MIXER CHANNELS
  setDrumsVolume(val: number) {
    this.drumsVol = val;
    if (this.drumsGainNode) {
      this.drumsGainNode.gain.setTargetAtTime(val, this.getContext().currentTime, 0.05);
    }
  }

  setMelodyVolume(val: number) {
    this.melodyVol = val;
    if (this.melodyGainNode) {
      this.melodyGainNode.gain.setTargetAtTime(val, this.getContext().currentTime, 0.05);
    }
  }

  setSynthVolume(val: number) {
    this.synthVol = val;
    if (this.synthGainNode) {
      this.synthGainNode.gain.setTargetAtTime(val, this.getContext().currentTime, 0.05);
    }
  }

  setDelayVolume(val: number) {
    this.delayVol = val;
    if (this.delayFeedbackNode) {
      this.delayFeedbackNode.gain.setTargetAtTime(val, this.getContext().currentTime, 0.05);
    }
  }

  setReverbVolume(val: number) {
    this.reverbVol = val;
    if (this.reverbMixNode) {
      this.reverbMixNode.gain.setTargetAtTime(val, this.getContext().currentTime, 0.05);
    }
  }

  // Neuro-Descriptor morphing hook
  setXyParams(x: number, y: number) {
    this.currentX = x;
    this.currentY = y;
    
    const now = this.getContext().currentTime;

    // 1. Modulate filter cutoffs in real-time (X-axis)
    // Low timbre X -> lower lowpass filter frequencies
    const lowpassCutoff = 200 + (x * 4300); // 200Hz - 4.5kHz
    for (const filter of this.activeFiltersList) {
      try {
        filter.frequency.setTargetAtTime(lowpassCutoff, now, 0.1);
      } catch { /* */ }
    }

    // 2. Modulate detune of supersaws (X-axis)
    const detuneVal = (x - 0.5) * 60; // detunes synth voices
    for (const osc of this.activeOscillatorsList) {
      try {
        osc.detune.setTargetAtTime(detuneVal, now, 0.15);
      } catch { /* */ }
    }
  }

  private connectToMaster(node: AudioNode, reverbAmt = 0.1, delayAmt = 0.0, channelGainNode: GainNode | null = null) {
    const targetGain = channelGainNode || this.masterGain;
    if (!targetGain) return;
    
    // Dry signal
    node.connect(targetGain);
    
    // Reverb send
    if (reverbAmt > 0 && this.reverbNode) {
      const revSend = this.getContext().createGain();
      revSend.gain.value = reverbAmt;
      node.connect(revSend);
      revSend.connect(this.reverbNode);
      this.activeNodes.push(revSend);
    }

    // Delay send
    if (delayAmt > 0 && this.delayNode) {
      const delSend = this.getContext().createGain();
      delSend.gain.value = delayAmt;
      node.connect(delSend);
      delSend.connect(this.delayNode);
      this.activeNodes.push(delSend);
    }
  }

  private playSynth(cmd: AudioCommand) {
    const ctx = this.getContext();
    const now = ctx.currentTime;
    
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    const initFilterFreq = 200 + (this.currentX * 4300);
    filter.frequency.setValueAtTime(initFilterFreq, now);
    this.activeFiltersList.push(filter);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(cmd.volume * 0.5, now + cmd.attack);

    const oscillators: OscillatorNode[] = [];
    const subOsc = ctx.createOscillator();

    if (cmd.waveform === 'sine') {
      // FM Digital Bell synthesizer pad (Rhodes-like)
      const carrier = ctx.createOscillator();
      const modulator = ctx.createOscillator();
      const modGain = ctx.createGain();

      carrier.type = 'sine';
      carrier.frequency.setValueAtTime(cmd.frequency, now);

      modulator.type = 'sine';
      modulator.frequency.setValueAtTime(cmd.frequency * 2.0, now); // 2nd harmonic
      modGain.gain.setValueAtTime(cmd.frequency * 0.45, now);

      modulator.connect(modGain);
      modGain.connect(carrier.frequency);
      carrier.connect(filter);
      
      oscillators.push(carrier, modulator);
      carrier.start(now);
      modulator.start(now);
    } 
    else if (cmd.waveform === 'triangle') {
      // Warm layered organ pad
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(cmd.frequency, now);

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(cmd.frequency * 1.5, now); // Perfect fifth chord
      osc2.connect(filter);
      
      osc1.connect(filter);

      oscillators.push(osc1, osc2);
      osc1.start(now);
      osc2.start(now);
    } 
    else if (cmd.waveform === 'sawtooth') {
      // EDM/Supersaw Lead (3 detuned sawtooth waves)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const osc3 = ctx.createOscillator();

      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(cmd.frequency, now);
      
      osc2.type = 'sawtooth';
      osc2.frequency.setValueAtTime(cmd.frequency * 0.995, now);
      osc2.detune.setValueAtTime((this.currentX - 0.5) * 40 - 15, now);
      
      osc3.type = 'sawtooth';
      osc3.frequency.setValueAtTime(cmd.frequency * 1.005, now);
      osc3.detune.setValueAtTime((this.currentX - 0.5) * 40 + 15, now);

      osc1.connect(filter);
      osc2.connect(filter);
      osc3.connect(filter);

      oscillators.push(osc1, osc2, osc3);
      osc1.start(now);
      osc2.start(now);
      osc3.start(now);
    } 
    else {
      // Retro Chiptune pulse pad (lowpassed square)
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(cmd.frequency, now);
      osc.connect(filter);
      oscillators.push(osc);
      osc.start(now);
    }

    // Add sub-oscillator one octave below (sine wave) for full low-end
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(cmd.frequency / 2, now);
    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(cmd.volume * 0.25, now);
    subOsc.connect(subGain).connect(filter);
    oscillators.push(subOsc);
    subOsc.start(now);

    filter.connect(gain);
    this.connectToMaster(gain, 0.35, 0.2, this.synthGainNode); // Route to synth channel

    // Register active nodes for real-time tracking
    for (const osc of oscillators) {
      this.activeOscillatorsList.push(osc);
      this.activeNodes.push(osc);
    }
    this.activeNodes.push(gain, filter, subGain);

    if (!cmd.loop) {
      gain.gain.exponentialRampToValueAtTime(0.001, now + cmd.attack + cmd.release);
      setTimeout(() => {
        try {
          for (const osc of oscillators) osc.stop();
        } catch { /* */ }
      }, (cmd.attack + cmd.release) * 1000 + 50);
    }
  }

  private playDrum(cmd: AudioCommand) {
    const pattern = cmd.pattern;
    if (pattern.length === 0) return;

    let step = 0;

    const playNextDrumStep = () => {
      if (!this.isPlaying) return;

      const ctx = this.getContext();
      const now = ctx.currentTime;
      const currentBpm = this.currentBpm;
      const stepDuration = (60 / currentBpm) / 4; // 16th note steps

      const hit = pattern[step % pattern.length];
      
      // Energy (Y-axis) modulates drum complexity:
      // Strip back minor hats and percussion when energy is low (Y < 0.3)
      let playHit = true;
      if (this.currentY < 0.35) {
        if (hit === 'hat' && step % 2 !== 0) playHit = false;
        if (hit === 'perc' || hit === 'clap') playHit = false;
      }

      if (playHit && hit !== '-') {
        this.triggerDrumHit(hit, now, cmd.volume);
      }

      step++;
      const timeoutId = window.setTimeout(playNextDrumStep, stepDuration * 1000);
      this.timeouts.push(timeoutId);
    };

    playNextDrumStep();
  }

  private triggerDrumHit(type: string, now: number, volume: number) {
    const ctx = this.getContext();

    switch (type) {
      case 'kick':
      case 'kd': {
        // Deep analog synth kick
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.exponentialRampToValueAtTime(45, now + 0.12);
        
        gain.gain.setValueAtTime(volume * 1.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        
        osc.connect(gain);
        this.connectToMaster(gain, 0.03, 0, this.drumsGainNode); // Route to drums channel
        
        osc.start(now);
        osc.stop(now + 0.25);
        this.activeNodes.push(osc, gain);
        break;
      }
      case 'snare':
      case 'sn': {
        // Bandpass filtered noise burst + 180Hz triangle punch
        const noiseBuffer = this.createNoiseBuffer(ctx, 0.16);
        const noise = ctx.createBufferSource();
        noise.buffer = noiseBuffer;
        
        const noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.value = 1100;
        noiseFilter.Q.value = 2.2;
        
        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(volume * 0.45, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        
        noise.connect(noiseFilter).connect(noiseGain);
        this.connectToMaster(noiseGain, 0.15, 0, this.drumsGainNode);

        const osc = ctx.createOscillator();
        const oscGain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(120, now + 0.07);
        oscGain.gain.setValueAtTime(volume * 0.7, now);
        oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        
        osc.connect(oscGain);
        this.connectToMaster(oscGain, 0.1, 0, this.drumsGainNode);

        noise.start(now);
        osc.start(now);
        osc.stop(now + 0.15);
        this.activeNodes.push(noise, osc, noiseGain, oscGain);
        break;
      }
      case 'hat':
      case 'hh': {
        // Highpassed short noise pluck
        const noise = ctx.createBufferSource();
        noise.buffer = this.createNoiseBuffer(ctx, 0.06);
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 8500; // cleaner hi-hats
        
        gain.gain.setValueAtTime(volume * 0.45, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
        
        noise.connect(filter).connect(gain);
        this.connectToMaster(gain, 0.02, 0, this.drumsGainNode);
        
        noise.start(now);
        this.activeNodes.push(noise, gain, filter);
        break;
      }
      case 'clap': {
        const noise = ctx.createBufferSource();
        noise.buffer = this.createNoiseBuffer(ctx, 0.22);
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 1400;
        
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(volume * 0.7, now + 0.005);
        gain.gain.linearRampToValueAtTime(0, now + 0.015);
        gain.gain.linearRampToValueAtTime(volume * 0.7, now + 0.02);
        gain.gain.linearRampToValueAtTime(0, now + 0.03);
        gain.gain.linearRampToValueAtTime(volume * 0.9, now + 0.035);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
        
        noise.connect(filter).connect(gain);
        this.connectToMaster(gain, 0.25, 0, this.drumsGainNode);
        
        noise.start(now);
        this.activeNodes.push(noise, gain, filter);
        break;
      }
      case 'bass': {
        // Warm subby FM bass pluck
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(55, now); // Low A
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(180, now);
        
        gain.gain.setValueAtTime(volume * 1.4, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
        
        osc.connect(filter).connect(gain);
        this.connectToMaster(gain, 0.02, 0, this.drumsGainNode);
        
        osc.start(now);
        osc.stop(now + 0.28);
        this.activeNodes.push(osc, gain, filter);
        break;
      }
      case 'perc': {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(900, now);
        osc.frequency.exponentialRampToValueAtTime(450, now + 0.03);
        gain.gain.setValueAtTime(volume * 0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
        
        osc.connect(gain);
        this.connectToMaster(gain, 0.15, 0.05, this.drumsGainNode);
        
        osc.start(now);
        osc.stop(now + 0.1);
        this.activeNodes.push(osc, gain);
        break;
      }
    }
  }

  private playMelody(cmd: AudioCommand) {
    const ctx = this.getContext();
    let step = 0;

    const notes = cmd.notes.length > 0 ? cmd.notes : [440, 523.25, 659.25, 783.99];

    // Self-correcting recursive timeout scheduler (reads tempo dynamically)
    const playNextMelodyStep = () => {
      if (!this.isPlaying) return;

      const currentBpm = this.currentBpm;
      const stepDuration = (60 / currentBpm) / 4; // 16th note arpeggios

      const freq = notes[step % notes.length];
      
      if (freq > 0) {
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        const initFilterFreq = 200 + (this.currentX * 4300);
        filter.frequency.setValueAtTime(initFilterFreq, ctx.currentTime);
        this.activeFiltersList.push(filter);

        const osc = ctx.createOscillator();
        const subOsc = ctx.createOscillator();
        const gain = ctx.createGain();
        const subGain = ctx.createGain();

        // Sound characteristics matching custom profiles
        if (cmd.waveform === 'sine') {
          // Soft synth Rhodes pluck (2-operator sine FM)
          const modulator = ctx.createOscillator();
          const modGain = ctx.createGain();
          
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, ctx.currentTime);
          
          modulator.type = 'sine';
          modulator.frequency.setValueAtTime(freq * 3, ctx.currentTime); // 3rd harmonic
          modGain.gain.setValueAtTime(freq * 0.3, ctx.currentTime);
          modGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);

          modulator.connect(modGain);
          modGain.connect(osc.frequency);
          osc.connect(filter);
          
          this.activeOscillatorsList.push(modulator);
          this.activeNodes.push(modulator);
          modulator.start();
          modulator.stop(ctx.currentTime + cmd.attack + cmd.release + 0.05);
        } 
        else if (cmd.waveform === 'sawtooth') {
          // Detuned supersaw lead melody
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, ctx.currentTime);
          osc.detune.setValueAtTime((this.currentX - 0.5) * 40, ctx.currentTime);
          
          const osc2 = ctx.createOscillator();
          osc2.type = 'sawtooth';
          osc2.frequency.setValueAtTime(freq * 1.006, ctx.currentTime);
          osc2.detune.setValueAtTime((this.currentX - 0.5) * 40 + 10, ctx.currentTime);
          osc2.connect(filter);
          
          this.activeOscillatorsList.push(osc2);
          this.activeNodes.push(osc2);
          osc2.start();
          osc2.stop(ctx.currentTime + cmd.attack + cmd.release + 0.05);
          
          osc.connect(filter);
        } 
        else {
          // Square or Triangle pluck
          osc.type = cmd.waveform;
          osc.frequency.setValueAtTime(freq, ctx.currentTime);
          osc.connect(filter);
        }

        // Add sub-oscillator one octave below (sine wave) for full tone
        subOsc.type = 'sine';
        subOsc.frequency.setValueAtTime(freq / 2, ctx.currentTime);
        subGain.gain.setValueAtTime(cmd.volume * 0.2, ctx.currentTime);
        subOsc.connect(subGain).connect(filter);
        subOsc.start();
        subOsc.stop(ctx.currentTime + cmd.attack + cmd.release + 0.05);

        const now = ctx.currentTime;
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(cmd.volume * 0.45, now + cmd.attack);
        gain.gain.exponentialRampToValueAtTime(0.001, now + cmd.attack + cmd.release);

        filter.connect(gain);
        
        // Melodies get full delay and reverb sends
        this.connectToMaster(gain, 0.38, 0.42, this.melodyGainNode); // Route to melody channel

        this.activeOscillatorsList.push(osc, subOsc);
        this.activeNodes.push(osc, subOsc, gain, subGain, filter);

        osc.start(now);
        osc.stop(now + cmd.attack + cmd.release + 0.05);
      }

      step++;
      const timeoutId = window.setTimeout(playNextMelodyStep, stepDuration * 1000);
      this.timeouts.push(timeoutId);
    };

    playNextMelodyStep();
  }

  // --- Utility functions for Synthesis ---

  private createNoiseBuffer(ctx: AudioContext, durationSeconds: number): AudioBuffer {
    const bufferSize = ctx.sampleRate * durationSeconds;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  getPlaying(): boolean {
    return this.isPlaying;
  }

  getAnalyserNode(): AnalyserNode | null {
    return this.analyser;
  }
}
