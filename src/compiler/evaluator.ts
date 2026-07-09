import type { Program, Expression, CommandStatement } from './parser';

// ==================== VISUAL STATE ====================
export interface VisualLayer {
  id: string;
  shape: string;
  x: number;
  y: number;
  size: number;
  color: [number, number, number, number]; // RGBA
  rotation: number;
  rotationSpeed: number;
  oscillateSpeed: number;
  oscillateAmount: number;
  glow: number;
  points: number; // for polygon/star
  fill: boolean;
  lineWidth: number;
  mirror: boolean;
  copies: number;
  spread: number;
  text: string;
  fontSize: number;
  blend: string;
  trail: number;
  pixelSize: number;
}

export interface AudioCommand {
  type: 'synth' | 'drum' | 'melody' | 'effect';
  waveform: OscillatorType;
  frequency: number;
  notes: number[];
  bpm: number;
  pattern: string[];
  volume: number;
  delay: number;
  reverb: number;
  filter: number;
  attack: number;
  release: number;
  loop: boolean;
}

export interface SceneState {
  visuals: VisualLayer[];
  audio: AudioCommand[];
  background: [number, number, number];
  fps: number;
  globalTime: boolean;
}

// ==================== COLOR PALETTE ====================
const COLORS: Record<string, [number, number, number, number]> = {
  red: [1, 0.15, 0.15, 1],
  green: [0.15, 1, 0.3, 1],
  blue: [0.2, 0.4, 1, 1],
  cyan: [0, 1, 0.85, 1],
  magenta: [1, 0, 0.8, 1],
  yellow: [1, 0.95, 0.1, 1],
  orange: [1, 0.55, 0, 1],
  purple: [0.6, 0.2, 1, 1],
  pink: [1, 0.4, 0.7, 1],
  white: [1, 1, 1, 1],
  black: [0, 0, 0, 1],
  gold: [1, 0.84, 0, 1],
  neon: [0.2, 1, 0.4, 1],
  fire: [1, 0.35, 0, 1],
  ice: [0.5, 0.85, 1, 1],
  acid: [0.7, 1, 0, 1],
  sunset: [1, 0.4, 0.2, 1],
  ocean: [0, 0.5, 0.8, 1],
  forest: [0.13, 0.55, 0.13, 1],
  lava: [0.8, 0.15, 0, 1],
};

// ==================== NOTE FREQUENCIES ====================
export function noteToFrequency(note: string): number | null {
  const match = note.match(/^([A-G])(#|b)?([0-9])$/i);
  if (!match) return null;
  
  const pitchNames: Record<string, number> = {
    C: 0, 'C#': 1, DB: 1, Db: 1, D: 2, 'D#': 3, EB: 3, Eb: 3, E: 4, F: 5, 'F#': 6, GB: 6, Gb: 6, G: 7, 'G#': 8, AB: 8, Ab: 8, A: 9, 'A#': 10, BB: 10, Bb: 10, B: 11
  };
  
  const letter = match[1].toUpperCase();
  const accidental = match[2] || '';
  const octave = parseInt(match[3], 10);
  
  const key = letter + accidental;
  const semitone = pitchNames[key];
  if (semitone === undefined) return null;
  
  const midi = 12 + octave * 12 + semitone;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function defaultLayer(id: string): VisualLayer {
  return {
    id,
    shape: 'circle',
    x: 0, y: 0,
    size: 0.2,
    color: [0, 1, 0.85, 1],
    rotation: 0,
    rotationSpeed: 0,
    oscillateSpeed: 0,
    oscillateAmount: 0.5,
    glow: 0,
    points: 5,
    fill: true,
    lineWidth: 2,
    mirror: false,
    copies: 1,
    spread: 0,
    text: '',
    fontSize: 48,
    blend: 'source-over',
    trail: 0,
    pixelSize: 1,
  };
}

function defaultAudio(): AudioCommand {
  return {
    type: 'effect',
    waveform: 'sine',
    frequency: 440,
    notes: [440],
    bpm: 120,
    pattern: [],
    volume: 0.3,
    delay: 0,
    reverb: 0,
    filter: 1200, // Warmer default lowpass cutoff instead of 20000Hz (which caused piercing buzzes)
    attack: 0.05,
    release: 0.4,
    loop: true,
  };
}

function resolveColor(expr: Expression): [number, number, number, number] {
  if (expr.type === 'StringLiteral') {
    return COLORS[expr.value.toLowerCase()] || [1, 1, 1, 1];
  }
  if (expr.type === 'Identifier') {
    return COLORS[expr.name.toLowerCase()] || [1, 1, 1, 1];
  }
  if (expr.type === 'ArrayLiteral') {
    const vals = expr.elements.map(e => e.type === 'NumberLiteral' ? e.value : 0);
    return [vals[0] || 0, vals[1] || 0, vals[2] || 0, vals[3] ?? 1];
  }
  return [1, 1, 1, 1];
}

function resolveNumber(expr: Expression, fallback: number = 0): number {
  if (expr.type === 'NumberLiteral') return expr.value;
  if (expr.type === 'Identifier') {
    const freq = noteToFrequency(expr.name);
    if (freq !== null) return freq;
  }
  return fallback;
}

function resolveString(expr: Expression, fallback: string = ''): string {
  if (expr.type === 'StringLiteral') return expr.value;
  if (expr.type === 'Identifier') return expr.name;
  return fallback;
}

function resolveNotes(expr: Expression): number[] {
  if (expr.type === 'ArrayLiteral') {
    return expr.elements.map(e => {
      if (e.type === 'Identifier') {
        const freq = noteToFrequency(e.name);
        if (freq !== null) return freq;
      }
      if (e.type === 'NumberLiteral') return e.value;
      if (e.type === 'StringLiteral') {
        const freq = noteToFrequency(e.value);
        if (freq !== null) return freq;
      }
      return 0; // 0 represents a rest (silence)
    });
  }
  if (expr.type === 'Identifier') {
    const freq = noteToFrequency(expr.name);
    if (freq !== null) return [freq];
  }
  if (expr.type === 'NumberLiteral') return [expr.value];
  return [0];
}

// ==================== EVALUATE ====================
function applyCommand(cmd: CommandStatement, layer: VisualLayer, audio: AudioCommand | null): { layer: VisualLayer; audio: AudioCommand | null } {
  const args = cmd.args;

  switch (cmd.command) {
    // === VISUAL COMMANDS ===
    case 'draw':
    case 'shape':
      layer.shape = resolveString(args[0], 'circle');
      break;

    case 'color':
    case 'col':
      layer.color = resolveColor(args[0]);
      break;

    case 'pos':
    case 'move':
      layer.x = resolveNumber(args[0], 0);
      layer.y = resolveNumber(args[1], 0);
      break;

    case 'size':
    case 'scale':
      layer.size = resolveNumber(args[0], 0.2);
      break;

    case 'rotate':
    case 'spin':
      layer.rotationSpeed = resolveNumber(args[0], 1);
      break;

    case 'pulse':
    case 'osc':
      layer.oscillateSpeed = resolveNumber(args[0], 2);
      if (args[1]) layer.oscillateAmount = resolveNumber(args[1], 0.5);
      break;

    case 'glow':
    case 'bloom':
      layer.glow = resolveNumber(args[0], 2);
      break;

    case 'mirror':
      layer.mirror = true;
      layer.copies = resolveNumber(args[0], 4);
      break;

    case 'copies':
    case 'repeat':
      layer.copies = resolveNumber(args[0], 4);
      layer.spread = resolveNumber(args[1], 0.3);
      break;

    case 'points':
      layer.points = resolveNumber(args[0], 5);
      break;

    case 'fill':
      layer.fill = resolveString(args[0], 'true') !== 'false';
      break;

    case 'stroke':
      layer.fill = false;
      layer.lineWidth = resolveNumber(args[0], 2);
      break;

    case 'text':
      layer.shape = 'text';
      layer.text = resolveString(args[0], 'RAVE');
      if (args[1]) layer.fontSize = resolveNumber(args[1], 48);
      break;

    case 'trail':
      layer.trail = resolveNumber(args[0], 0.85);
      break;

    case 'blend':
      layer.blend = resolveString(args[0], 'source-over');
      break;

    case 'pixel':
      layer.pixelSize = resolveNumber(args[0], 4);
      break;

    // === AUDIO COMMANDS ===
    case 'synth':
    case 'sound':
      if (!audio) audio = defaultAudio();
      audio.type = 'synth';
      if (args[0]) audio.waveform = resolveString(args[0], 'sine') as OscillatorType;
      if (args[1]) audio.frequency = resolveNumber(args[1], 440);
      break;

    case 'drum':
    case 'beat':
      if (!audio) audio = defaultAudio();
      audio.type = 'drum';
      if (args[0]) {
        audio.pattern = resolveString(args[0], 'kick snare').split(/\s+/);
      }
      break;

    case 'melody':
    case 'notes':
      if (!audio) audio = defaultAudio();
      audio.type = 'melody';
      if (args[0]) audio.notes = resolveNotes(args[0]);
      break;

    case 'bpm':
    case 'tempo':
      if (!audio) audio = defaultAudio();
      audio.bpm = resolveNumber(args[0], 120);
      break;

    case 'volume':
    case 'vol':
      if (!audio) audio = defaultAudio();
      audio.volume = resolveNumber(args[0], 0.3);
      break;

    case 'wave':
      if (!audio) audio = defaultAudio();
      audio.waveform = resolveString(args[0], 'sine') as OscillatorType;
      break;

    case 'freq':
      if (!audio) audio = defaultAudio();
      audio.frequency = resolveNumber(args[0], 440);
      break;

    case 'filter':
      if (!audio) audio = defaultAudio();
      audio.filter = resolveNumber(args[0], 1200);
      break;

    case 'attack':
      if (!audio) audio = defaultAudio();
      audio.attack = resolveNumber(args[0], 0.05);
      break;

    case 'release':
      if (!audio) audio = defaultAudio();
      audio.release = resolveNumber(args[0], 0.4);
      break;

    default:
      break;
  }

  return { layer, audio };
}

export function evaluate(program: Program): SceneState {
  const state: SceneState = {
    visuals: [],
    audio: [],
    background: [0, 0, 0],
    fps: 60,
    globalTime: true,
  };

  let layerCount = 0;

  for (const stmt of program.body) {
    if (stmt.type === 'CommandStatement') {
      // Handle global commands
      if (stmt.command === 'bg' || stmt.command === 'background') {
        const c = resolveColor(stmt.args[0]);
        state.background = [c[0], c[1], c[2]];
        continue;
      }

      const layer = defaultLayer(`layer-${layerCount++}`);
      let audio: AudioCommand | null = null;
      const result = applyCommand(stmt, layer, audio);
      state.visuals.push(result.layer);
      if (result.audio) state.audio.push(result.audio);
    }

    if (stmt.type === 'ChainStatement') {
      const layer = defaultLayer(`layer-${layerCount++}`);
      let audio: AudioCommand | null = null;

      for (const cmd of stmt.steps) {
        const result = applyCommand(cmd, layer, audio);
        audio = result.audio;
      }

      state.visuals.push(layer);
      if (audio) state.audio.push(audio);
    }
  }

  return state;
}
