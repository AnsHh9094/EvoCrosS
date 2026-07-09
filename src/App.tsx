import { useState, useRef, useEffect, useCallback } from 'react';
import { tokenize } from './compiler/lexer';
import { parse } from './compiler/parser';
import { evaluate } from './compiler/evaluator';
import { WebGLRenderer } from './engine/renderer';
import { AudioEngine } from './engine/audio';
import { ChromaEditor } from './components/Editor';
import { midiToChromaScript } from './compiler/midiParser';
import './App.css';

const PRESETS = [
  {
    name: '3D Nebula Chillout',
    icon: '🌀',
    description: '3D volumetric nebula reacting to warm digital chimes',
    code: `// 3D Nebula Volumetric Portal
draw "nebula3d" -> glow 5
drum "kick - - - - - - -"
drum "- - hat - - - hat -"
melody [C3, E3, G3, B3, D4, B3, G3, E3] -> wave sine -> attack 0.05 -> release 0.4 -> vol 0.4
bpm 110
volume 0.7`,
  },
  {
    name: '3D Nebula Portal',
    icon: '🌀',
    description: '3D volumetric nebula portal reacting to audio',
    code: `// 3D Volumetric Nebula Portal
draw "nebula3d" -> glow 4
melody [C3, G3, C4, G4, D#4, G4, C4, G3]
wave "sawtooth" -> filter 1200
bpm 105
volume 0.6`,
  },
  {
    name: 'Nebula',
    icon: '🌌',
    description: 'Cosmic fractal noise field',
    code: `// Cosmic nebula with dark ambient pad
draw "nebula" -> glow 4
synth "sawtooth" 110 -> filter 800
bpm 90
volume 0.4`,
  },
  {
    name: 'Waveform',
    icon: '〰️',
    description: 'Audio-reactive sine waves',
    code: `// Flowing waveform with arpeggio
draw "waveform" -> glow 3
melody [C3, G3, C4, D#4, G4, C5, G4, D#4]
wave "triangle" -> filter 1500
bpm 140
volume 0.5`,
  },
  {
    name: 'Particles',
    icon: '✨',
    description: 'Floating particle field',
    code: `// Particle field with techno groove
draw "particles" -> glow 5
drum "kick hat kick hat kick hat kick hat"
drum "- - snare - - - snare -"
drum "- perc - - - perc - perc"
bpm 132`,
  },
  {
    name: 'Mandala',
    icon: '🔮',
    description: 'Sacred geometry pattern',
    code: `// Spinning mandala with FM bass
draw "mandala" -> glow 4
drum "kick - - - kick - - -"
drum "- - hat - - - hat -"
drum "bass - - bass - - bass -"
bpm 125
volume 0.6`,
  },
  {
    name: 'Tunnel',
    icon: '🕳️',
    description: 'Infinite neon tunnel',
    code: `// Cyberpunk tunnel effect
draw "tunnel" -> glow 3
drum "kick - hat - snare - hat -"
melody [C2, C2, D#2, F2, C2, C2, A#1, C2]
wave "square" -> filter 500
bpm 128`,
  },
  {
    name: 'Fractal',
    icon: '🧬',
    description: 'Julia set fractal',
    code: `// Animated Julia fractal + House beat
draw "fractal" -> glow 2
drum "kick hat snare hat"
drum "- clap - - - clap - -"
bpm 122
volume 0.5`,
  },
  {
    name: 'Aurora',
    icon: '🌊',
    description: 'Northern lights with stars',
    code: `// Aurora borealis + Ambient chords
draw "aurora" -> glow 5
melody [C4, E4, G4, B4, C5, B4, G4, E4]
wave "sine" -> filter 1200
drum "- - - - - - - perc"
bpm 95
volume 0.6`,
  },
  {
    name: 'Glitch',
    icon: '📺',
    description: 'Digital glitch art',
    code: `// Glitch art + Breakbeat
draw "glitch" -> glow 2
drum "kick - - kick snare - - -"
drum "- hat hat - - hat hat hat"
drum "- - - - - - clap -"
bpm 160`,
  },
];

const AI_PROMPTS = [
  {
    label: '🚗 3D Synthwave Grid',
    prompt: '3d synthwave grid highway terrain under glowing sunset sun',
    code: `// AI-Generated: 3D Synthwave Grid\ndraw "grid3d" -> glow 5\ndrum "kick hat snare hat"\ndrum "bass - - bass - - bass -"\nbpm 125\nvolume 0.7`,
  },
  {
    label: '🌀 3D Nebula Portal',
    prompt: '3d volumetric space nebula portal twisting and glowing',
    code: `// AI-Generated: 3D Volumetric Nebula\ndraw "nebula3d" -> glow 4\nmelody [C3, G3, C4, G4, D#4, G4, C4, G3]\nwave "sawtooth" -> filter 1200\nbpm 105\nvolume 0.6`,
  },
  {
    label: '🌌 Cosmic Space Ambient',
    prompt: 'deep space nebula with slow moving gas and a warm synth drone',
    code: `// AI-Generated: Cosmic Space Ambient\ndraw "nebula" -> glow 5\nsynth "sine" 165 -> filter 800 -> attack 0.2 -> release 1.0\nbpm 70\nvolume 0.5`,
  },
  {
    label: '🥁 Hard Industrial Techno',
    prompt: 'glitchy red visual with a heavy distorted kick and hats',
    code: `// AI-Generated: Hard Industrial Techno\ndraw "glitch" -> glow 3\ndrum "kick hat kick hat snare hat kick hat"\ndrum "- - clap - - - clap -"\ndrum "bass - bass - bass - bass -"\nbpm 138\nvolume 0.6`,
  },
  {
    label: '🔮 Sacred Zen Meditation',
    prompt: 'sacred mandala geometry with a soft triangle arpeggio melody',
    code: `// AI-Generated: Zen Meditation\ndraw "mandala" -> glow 4\nmelody [C4, E4, G4, B4, C5, B4, G4, E4]\nwave "triangle" -> filter 1000 -> attack 0.1 -> release 0.6\nbpm 85\nvolume 0.4`,
  },
  {
    label: '🕳️ Cyberpunk Grid Tunnel',
    prompt: 'neon wireframe tunnel flying forward with a rapid house beat',
    code: `// AI-Generated: Cyberpunk Tunnel\ndraw "tunnel" -> glow 4\ndrum "kick hat snare hat"\ndrum "- clap - - - clap - -"\nmelody [C2, D#2, F2, C2, D#2, F2, G2, F2]\nwave "sawtooth" -> filter 600\nbpm 128\nvolume 0.65`,
  },
];

const LAUNCHPAD_CLIPS = [
  { id: 'kick', label: '🥁 Heavy Kick', code: 'drum "kick - - - kick - - -"' },
  { id: 'tech', label: '⚡ Cyber Beats', code: 'drum "kick hat snare hat"' },
  { id: 'acid', label: '☣️ Acid Bassline', code: 'melody [C2, C2, D#2, F2, C2, A#1, C2, 0]\nwave "sawtooth" -> filter 550' },
  { id: 'zen', label: '🌸 Zen Chimes', code: 'melody [G4, C5, D5, G5, D5, C5]\nwave "sine" -> filter 1800' },
  { id: 'lead', label: 'Retrowave Lead', code: 'melody [D3, D3, F3, G3, A3, G3, F3, D3]\nwave "square" -> filter 1100' },
  { id: 'percs', label: '🔮 Glitch Hats', code: 'drum "- hat perc hat - clap perc hat"' },
  { id: 'riser', label: '🚀 SFX Riser', code: 'synth "sine" 220 -> filter 2200' },
  { id: 'sub', label: '💣 Sub Drop', code: 'drum "bass - - - bass - - -"' },
];

function App() {
  const [code, setCode] = useState(PRESETS[0].code);
  const [error, setError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [showReference, setShowReference] = useState(false);
  const [activePreset, setActivePreset] = useState(0);
  const [fps, setFps] = useState(0);
  
  // Real-time Master Controls
  const [masterVolume, setMasterVolume] = useState(0.8);
  const [masterBpm, setMasterBpm] = useState(125);

  // Vibe Themes
  const [vibeTheme, setVibeTheme] = useState<'cyberpunk' | 'zen' | 'retrowave' | 'acid'>('cyberpunk');
  const [performanceMode, setPerformanceMode] = useState(false);
  const [audioSensitivity, setAudioSensitivity] = useState(1.5);

  // Neuro-Descriptor XY Pad values
  const [xyValue, setXyValue] = useState({ x: 0.5, y: 0.45 }); // matches initial bpm ~125
  const [isAutoDriving, setIsAutoDriving] = useState(false);

  // Compilation Stats
  const [compStats, setCompStats] = useState<{ tokens: number; nodes: number; glslTime: number } | null>(null);

  // AI Prompt State
  const [customPrompt, setCustomPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Tab System
  const [activeTab, setActiveTab] = useState<'launchpad' | 'beat_builder' | 'mixer' | 'ai'>('launchpad');

  // DJ Mixer Volumes
  const [drumsVolume, setDrumsVolume] = useState(1.0);
  const [melodyVolume, setMelodyVolume] = useState(0.8);
  const [synthVolume, setSynthVolume] = useState(0.7);
  const [delayVolume, setDelayVolume] = useState(0.3);
  const [reverbVolume, setReverbVolume] = useState(0.18);

  // Shader Peek State
  const [showShaderPeek, setShowShaderPeek] = useState(false);

  // Beat Builder Grid State
  const [beatGrid, setBeatGrid] = useState<Record<string, boolean[]>>({
    kick: Array(16).fill(false),
    snare: Array(16).fill(false),
    hat: Array(16).fill(false),
    clap: Array(16).fill(false),
  });

  const syncGridFromCode = (currentCode: string) => {
    const lines = currentCode.split('\n').map(l => l.trim());
    const drumLines = lines.filter(l => l.startsWith('drum'));
    
    const newGrid: Record<string, boolean[]> = {
      kick: Array(16).fill(false),
      snare: Array(16).fill(false),
      hat: Array(16).fill(false),
      clap: Array(16).fill(false),
    };
    
    drumLines.forEach(line => {
      const match = line.match(/drum\s+"([^"]+)"/);
      if (match) {
        const hits = match[1].split(/\s+/);
        hits.forEach((hit, idx) => {
          if (idx >= 16) return;
          if (hit === 'kick' || hit === 'kd') newGrid.kick[idx] = true;
          if (hit === 'snare' || hit === 'sn') newGrid.snare[idx] = true;
          if (hit === 'hat' || hit === 'hh') newGrid.hat[idx] = true;
          if (hit === 'clap') newGrid.clap[idx] = true;
        });
      }
    });
    
    setBeatGrid(newGrid);
  };

  const toggleBeatCell = (inst: string, step: number) => {
    setBeatGrid(prev => {
      const newGrid = { ...prev, [inst]: [...prev[inst]] };
      newGrid[inst][step] = !newGrid[inst][step];
      
      const lines = code.split('\n');
      const nonDrumLines = lines.filter(l => !l.trim().startsWith('drum'));
      
      const drumLines: string[] = [];
      const instruments = ['kick', 'snare', 'hat', 'clap'];
      
      instruments.forEach(instrument => {
        const steps = newGrid[instrument];
        if (steps.some(v => v)) {
          const pattern = steps.map(active => active ? instrument : '-').join(' ');
          drumLines.push(`drum "${pattern}"`);
        }
      });
      
      const newCode = [...nonDrumLines, ...drumLines].join('\n');
      setCode(newCode);
      if (isLive) {
        handleRun(newCode);
      }
      
      return newGrid;
    });
  };

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const oscilloscopeRef = useRef<HTMLCanvasElement>(null);
  const hudCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const rendererRef = useRef<WebGLRenderer | null>(null);
  const audioRef = useRef<AudioEngine | null>(null);
  const fpsRef = useRef({ frames: 0, lastTime: performance.now() });

  useEffect(() => {
    if (canvasRef.current && !rendererRef.current) {
      rendererRef.current = new WebGLRenderer(canvasRef.current);
    }
    if (!audioRef.current) {
      audioRef.current = new AudioEngine();
    }
    syncGridFromCode(code);

    const fpsInterval = setInterval(() => {
      const now = performance.now();
      const elapsed = now - fpsRef.current.lastTime;
      setFps(Math.round((fpsRef.current.frames / elapsed) * 1000));
      fpsRef.current.frames = 0;
      fpsRef.current.lastTime = now;
    }, 1000);

    return () => {
      clearInterval(fpsInterval);
      rendererRef.current?.destroy();
      rendererRef.current = null;
      audioRef.current?.stop();
    };
  }, []);

  // Sync initial parameters to engines
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.setMasterVolume(masterVolume);
      audioRef.current.setBpm(masterBpm);
      audioRef.current.setXyParams(xyValue.x, xyValue.y);
    }
    if (rendererRef.current) {
      rendererRef.current.setXyParams(xyValue.x, xyValue.y);
    }
  }, [isLive]);

  // Update FPS counter
  useEffect(() => {
    if (!isLive) return;
    let running = true;
    const count = () => {
      if (!running) return;
      fpsRef.current.frames++;
      requestAnimationFrame(count);
    };
    requestAnimationFrame(count);
    return () => { running = false; };
  }, [isLive]);

  // Neural Auto-Drive LFO loop
  useEffect(() => {
    if (!isAutoDriving || !isLive) return;
    let angle = 0;
    const interval = setInterval(() => {
      angle += 0.015;
      const x = 0.5 + Math.sin(angle) * 0.35;
      const y = 0.5 + Math.cos(angle * 1.3) * 0.35;
      setXyValue({ x, y });
      
      audioRef.current?.setXyParams(x, y);
      rendererRef.current?.setXyParams(x, y);
      
      const mappedBpm = Math.round(80 + y * 100);
      setMasterBpm(mappedBpm);
    }, 30);
    return () => clearInterval(interval);
  }, [isAutoDriving, isLive]);

  // Live Oscilloscope drawing
  useEffect(() => {
    if (!isLive || !oscilloscopeRef.current || !audioRef.current || performanceMode) return;
    
    const analyser = audioRef.current.getAnalyserNode();
    if (!analyser) return;

    const canvas = oscilloscopeRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    let animationId: number;

    const draw = () => {
      animationId = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(dataArray);

      ctx.fillStyle = '#0a0a0f';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.lineWidth = 2;
      
      // Theme colors for oscilloscope
      if (vibeTheme === 'zen') ctx.strokeStyle = '#dfb76c';
      else if (vibeTheme === 'retrowave') ctx.strokeStyle = '#ff5e00';
      else if (vibeTheme === 'acid') ctx.strokeStyle = '#c3ff00';
      else ctx.strokeStyle = '#00ffcc';

      ctx.shadowBlur = 8;
      ctx.shadowColor = ctx.strokeStyle;
      ctx.beginPath();

      const sliceWidth = canvas.width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    };

    draw();
    return () => cancelAnimationFrame(animationId);
  }, [isLive, performanceMode, vibeTheme]);

  // Live VJ HUD telemetry drawing
  useEffect(() => {
    if (!performanceMode || !isLive || !hudCanvasRef.current || !audioRef.current) return;
    
    const analyser = audioRef.current.getAnalyserNode();
    if (!analyser) return;

    const canvas = hudCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    let animationId: number;
    let radarAngle = 0;

    const drawHud = () => {
      animationId = requestAnimationFrame(drawHud);
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const r = Math.min(cx, cy) - 18;

      let primaryColor = '#00ffcc';
      if (vibeTheme === 'zen') primaryColor = '#dfb76c';
      else if (vibeTheme === 'retrowave') primaryColor = '#ff3c00';
      else if (vibeTheme === 'acid') primaryColor = '#d0ff00';

      // Draw radar rings
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath();
        ctx.arc(cx, cy, r * (i / 3), 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw crosshairs
      ctx.beginPath();
      ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy);
      ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r);
      ctx.stroke();

      // Draw sweeping radar line
      radarAngle += 0.015;
      ctx.strokeStyle = primaryColor + '44';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(radarAngle) * r, cy + Math.sin(radarAngle) * r);
      ctx.stroke();

      // Draw audio frequency bars blooming outwards in a circle
      ctx.lineWidth = 2.5;
      ctx.shadowBlur = 5;
      ctx.shadowColor = primaryColor;
      
      const bars = 48;
      for (let i = 0; i < bars; i++) {
        const index = Math.floor((i / bars) * (bufferLength * 0.45));
        const val = (dataArray[index] / 255) * audioSensitivity;
        const barHeight = Math.min(val * 35, 45);

        const angle = (i / bars) * Math.PI * 2 - Math.PI / 2;
        const x1 = cx + Math.cos(angle) * r;
        const y1 = cy + Math.sin(angle) * r;
        const x2 = cx + Math.cos(angle) * (r + barHeight);
        const y2 = cy + Math.sin(angle) * (r + barHeight);

        ctx.strokeStyle = primaryColor;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
    };

    drawHud();
    return () => cancelAnimationFrame(animationId);
  }, [performanceMode, isLive, audioSensitivity, vibeTheme]);

  const handleLaunchpadClip = (clipCode: string, clipId: string) => {
    const currentLines = code.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const clipLines = clipCode.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    const hasClip = clipLines.every(cl => currentLines.includes(cl));

    let newCode = '';
    if (hasClip) {
      // Toggle OFF: remove the clip lines
      const filteredLines = code.split('\n').filter(line => !clipLines.includes(line.trim()));
      newCode = filteredLines.join('\n').trim();
    } else {
      // Toggle ON: append
      newCode = `${code.trim()}\n\n// Clip: ${clipId}\n${clipCode}`;
    }

    setCode(newCode);
    handleRun(newCode);
  };

  const isClipActive = (clipCode: string) => {
    const currentLines = code.split('\n').map(l => l.trim());
    const clipLines = clipCode.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    return clipLines.every(cl => currentLines.includes(cl));
  };

  const handleEvolveCombo = () => {
    const generateRandomParent = (): string => {
      const SHADERS = ['nebula', 'waveform', 'particles', 'mandala', 'tunnel', 'fractal', 'aurora', 'glitch', 'grid3d', 'nebula3d'];
      const WAVEFORMS = ['sine', 'triangle', 'sawtooth', 'square'];
      const SCALES = [
        ['C3', 'D3', 'E3', 'G3', 'A3'], // C Major Pentatonic
        ['A3', 'C4', 'D4', 'E4', 'G4'], // A Minor Pentatonic
        ['C3', 'D#3', 'F3', 'F#3', 'G3', 'A#3'], // Blues scale
        ['E3', 'F3', 'G#3', 'A3', 'B3', 'C4', 'D4'], // Phrygian Dominant (Acid/Psy)
        ['C3', 'D3', 'D#3', 'F3', 'G3', 'G#3', 'A#3', 'C4'] // Natural Minor
      ];
      
      const shader = SHADERS[Math.floor(Math.random() * SHADERS.length)];
      const glow = Math.floor(Math.random() * 8) + 2;
      const drawLine = `draw "${shader}" -> glow ${glow}`;
      
      const drumLines: string[] = [];
      const numDrums = Math.random() > 0.5 ? 1 : 2;
      for (let i = 0; i < numDrums; i++) {
        const patternLen = Math.random() > 0.5 ? 8 : 16;
        const hits: string[] = [];
        for (let j = 0; j < patternLen; j++) {
          if (j % 4 === 0) hits.push(Math.random() < 0.85 ? 'kick' : '-');
          else if (j % 4 === 2) hits.push(Math.random() < 0.75 ? 'snare' : 'clap');
          else if (j % 2 === 0) hits.push(Math.random() < 0.5 ? 'hat' : '-');
          else hits.push(Math.random() < 0.35 ? 'perc' : (Math.random() < 0.15 ? 'bass' : '-'));
        }
        drumLines.push(`drum "${hits.join(' ')}"`);
      }
      
      const melodyLines: string[] = [];
      const numMelodies = Math.random() > 0.5 ? 1 : 2;
      const scale = SCALES[Math.floor(Math.random() * SCALES.length)];
      
      for (let i = 0; i < numMelodies; i++) {
        const waveform = WAVEFORMS[Math.floor(Math.random() * WAVEFORMS.length)];
        const notesLen = [4, 6, 8, 12][Math.floor(Math.random() * 4)];
        const notes: string[] = [];
        for (let j = 0; j < notesLen; j++) {
          if (Math.random() < 0.25) notes.push('0');
          else notes.push(scale[Math.floor(Math.random() * scale.length)]);
        }
        
        const attack = (0.01 + Math.random() * 0.15).toFixed(2);
        const release = (0.05 + Math.random() * 0.4).toFixed(2);
        const volume = (0.2 + Math.random() * 0.5).toFixed(2);
        
        melodyLines.push(`melody [${notes.join(', ')}] -> wave ${waveform} -> attack ${attack} -> release ${release} -> vol ${volume}`);
      }
      
      const bpm = Math.floor(Math.random() * 80) + 90; // 90 to 170
      
      return [
        drawLine,
        ...drumLines,
        ...melodyLines,
        `bpm ${bpm}`
      ].join('\n');
    };

    const currentLines = code.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('//'));
    const randomPreset = generateRandomParent();
    const presetLines = randomPreset.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('//'));

    const parseLines = (lines: string[]) => {
      return {
        draw: lines.find(l => l.startsWith('draw')),
        drums: lines.filter(l => l.startsWith('drum')),
        melodies: lines.filter(l => l.startsWith('melody')),
        waves: lines.filter(l => l.startsWith('wave') || l.startsWith('synth')),
        bpm: lines.find(l => l.startsWith('bpm')),
        volume: lines.find(l => l.startsWith('volume') || l.startsWith('vol')),
      };
    };

    const currentParts = parseLines(currentLines);
    const presetParts = parseLines(presetLines);

    const evolvedParts = {
      draw: Math.random() > 0.5 ? (currentParts.draw || presetParts.draw) : (presetParts.draw || currentParts.draw),
      drums: Math.random() > 0.4 ? (currentParts.drums.length > 0 ? currentParts.drums : presetParts.drums) : presetParts.drums,
      melodies: Math.random() > 0.4 ? (currentParts.melodies.length > 0 ? currentParts.melodies : presetParts.melodies) : presetParts.melodies,
      waves: Math.random() > 0.5 ? currentParts.waves : presetParts.waves,
      bpm: currentParts.bpm || presetParts.bpm,
      volume: currentParts.volume || presetParts.volume,
    };

    if (!evolvedParts.draw) evolvedParts.draw = 'draw "grid3d" -> glow 4';
    if (evolvedParts.drums.length === 0 && evolvedParts.melodies.length === 0) {
      evolvedParts.drums = ['drum "kick hat snare hat"'];
    }

    const newLines: string[] = [];
    newLines.push(`// EvoCross Genetic Offspring (Infinite Mutated Combo)`);
    newLines.push(evolvedParts.draw);

    evolvedParts.drums.forEach(drumLine => {
      const match = drumLine.match(/drum\s+"([^"]+)"/);
      if (match) {
        let pattern = match[1].split(' ');
        pattern = pattern.map(hit => {
          if (Math.random() < 0.22) {
            const hits = ['kick', 'hat', 'snare', 'clap', 'perc', 'bass', '-'];
            return hits[Math.floor(Math.random() * hits.length)];
          }
          return hit;
        });
        newLines.push(`drum "${pattern.join(' ')}"`);
      } else {
        newLines.push(drumLine);
      }
    });

    evolvedParts.melodies.forEach(melLine => {
      const match = melLine.match(/melody\s+\[([^\]]+)\](.*)/);
      if (match) {
        let notes = match[1].split(',').map(n => n.trim());
        const suffix = match[2] || '';
        notes = notes.map(note => {
          if (note !== '0' && Math.random() < 0.3) {
            const pitchMatch = note.match(/^([A-G]#?)(\d)$/);
            if (pitchMatch) {
              const notesScale = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
              const name = pitchMatch[1];
              const octave = parseInt(pitchMatch[2]);
              let idx = notesScale.indexOf(name);
              const shift = Math.random() > 0.5 ? 2 : -2;
              idx = (idx + shift + 12) % 12;
              return `${notesScale[idx]}${octave}`;
            }
          }
          return note;
        });
        newLines.push(`melody [${notes.join(', ')}]${suffix}`);
      } else {
        newLines.push(melLine);
      }
    });

    evolvedParts.waves.forEach(waveLine => {
      if (Math.random() < 0.3) {
        const filterMatch = waveLine.match(/filter\s+(\d+)/);
        if (filterMatch) {
          const newFilter = Math.round(parseFloat(filterMatch[1]) * (0.7 + Math.random() * 0.6));
          waveLine = waveLine.replace(/filter\s+\d+/, `filter ${Math.max(200, Math.min(newFilter, 4500))}`);
        }
      }
      newLines.push(waveLine);
    });

    if (evolvedParts.bpm) {
      const match = evolvedParts.bpm.match(/bpm\s+(\d+)/);
      if (match) {
        let bpmVal = parseInt(match[1]);
        bpmVal = Math.round(bpmVal + (Math.random() * 24 - 12));
        bpmVal = Math.max(80, Math.min(bpmVal, 180));
        newLines.push(`bpm ${bpmVal}`);
        setMasterBpm(bpmVal);
      }
    } else {
      newLines.push(`bpm 125`);
    }

    if (evolvedParts.volume) {
      newLines.push(evolvedParts.volume);
    } else {
      newLines.push(`volume 0.65`);
    }

    const evolvedCode = newLines.join('\n');
    setCode(evolvedCode);
    syncGridFromCode(evolvedCode);
    handleRun(evolvedCode);
  };

  const handleRun = useCallback((codeToRun: string) => {
    try {
      setError(null);
      const startT = performance.now();
      
      const tokens = tokenize(codeToRun);
      const ast = parse(tokens);
      const scene = evaluate(ast);
      
      const endT = performance.now();

      setCompStats({
        tokens: tokens.length,
        nodes: ast.body.length,
        glslTime: Math.round((endT - startT) * 10) / 10,
      });

      rendererRef.current?.update(scene);

      if (scene.audio.length > 0) {
        audioRef.current?.play(scene.audio);
        
        // Sync master parameters right after playing starts
        audioRef.current?.setMasterVolume(masterVolume);
        audioRef.current?.setBpm(masterBpm);
        audioRef.current?.setXyParams(xyValue.x, xyValue.y);
        audioRef.current?.setDrumsVolume(drumsVolume);
        audioRef.current?.setMelodyVolume(melodyVolume);
        audioRef.current?.setSynthVolume(synthVolume);
        audioRef.current?.setDelayVolume(delayVolume);
        audioRef.current?.setReverbVolume(reverbVolume);

        const analyser = audioRef.current?.getAnalyserNode();
        if (analyser && rendererRef.current) {
          rendererRef.current.connectAnalyser(analyser);
        }
      } else {
        audioRef.current?.stop();
      }

      setIsLive(true);
    } catch (err: any) {
      setError(err.message);
    }
  }, [masterVolume, masterBpm, xyValue]);

  useEffect(() => {
    // Auto-compile and start visuals on initial page load
    try {
      handleRun(PRESETS[0].code);
    } catch (e) {
      console.error("Autoplay failed:", e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStop = () => {
    rendererRef.current?.stop();
    audioRef.current?.stop();
    setIsLive(false);
    setCompStats(null);
    setIsAutoDriving(false);
  };

  const handlePresetClick = (index: number) => {
    setActivePreset(index);
    setCode(PRESETS[index].code);
    syncGridFromCode(PRESETS[index].code);
    if (isLive) {
      handleRun(PRESETS[index].code);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setMasterVolume(val);
    audioRef.current?.setMasterVolume(val);
  };

  const handleBpmSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    setMasterBpm(val);
    audioRef.current?.setBpm(val);
    
    // Remap Y-axis of descriptor pad
    const newY = Math.max(0, Math.min(1, (val - 80) / 100));
    setXyValue(prev => ({ ...prev, y: newY }));
    
    // Replace BPM in code
    const cleanedCode = code.replace(/bpm\s+\d+/g, `bpm ${val}`);
    setCode(cleanedCode);
  };

  const handleDrumsVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setDrumsVolume(val);
    audioRef.current?.setDrumsVolume(val);
  };

  const handleMelodyVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setMelodyVolume(val);
    audioRef.current?.setMelodyVolume(val);
  };

  const handleSynthVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setSynthVolume(val);
    audioRef.current?.setSynthVolume(val);
  };

  const handleDelayVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setDelayVolume(val);
    audioRef.current?.setDelayVolume(val);
  };

  const handleReverbVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setReverbVolume(val);
    audioRef.current?.setReverbVolume(val);
  };

  // Dragging handlers for Neuro-Descriptor XY Pad
  const handlePadInteraction = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (isAutoDriving) return; // prevent manual dragging during LFO drift

    const rect = e.currentTarget.getBoundingClientRect();
    let clientX, clientY;
    
    if ('touches' in e) {
      if (e.touches.length === 0) return;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height)); // 1-y so bottom is 0
    
    setXyValue({ x, y });
    
    // Update engines
    audioRef.current?.setXyParams(x, y);
    rendererRef.current?.setXyParams(x, y);
    
    // Sync BPM value dynamically
    const mappedBpm = Math.round(80 + y * 100);
    setMasterBpm(mappedBpm);

    // Replace BPM in code editor
    const cleanedCode = code.replace(/bpm\s+\d+/g, `bpm ${mappedBpm}`);
    setCode(cleanedCode);
  };

  // MIDI Importer handler
  const handleMidiImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const buffer = event.target?.result as ArrayBuffer;
      if (buffer) {
        try {
          const chromaScript = midiToChromaScript(new Uint8Array(buffer));
          setCode(chromaScript);
          handleRun(chromaScript);
        } catch (err: any) {
          setError(`MIDI Import Error: ${err.message}`);
        }
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Fullscreen visualizer toggle
  const toggleFullscreen = () => {
    const container = canvasRef.current?.parentElement;
    if (!container) return;
    
    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(err => {
        console.error(`Error enabling fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  // Take Snapshot of Visualizer
  const captureSnapshot = () => {
    if (canvasRef.current) {
      try {
        const url = canvasRef.current.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `evocross-${Date.now()}.png`;
        link.href = url;
        link.click();
      } catch (err) {
        console.error('Failed to capture snapshot:', err);
      }
    }
  };

  // Simulate AI generating code
  const triggerAIGeneration = (promptText: string) => {
    setIsGenerating(true);
    setError(null);
    
    const matchedPrompt = AI_PROMPTS.find(p => 
      promptText.toLowerCase().includes(p.prompt.split(' ')[0]) || 
      p.label.toLowerCase().includes(promptText.toLowerCase())
    ) || AI_PROMPTS[Math.floor(Math.random() * AI_PROMPTS.length)];

    let currentText = '';
    let index = 0;
    const targetCode = matchedPrompt.code;
    
    const interval = setInterval(() => {
      if (index < targetCode.length) {
        currentText += targetCode[index];
        setCode(currentText);
        index += 2;
      } else {
        clearInterval(interval);
        setCode(targetCode);
        setIsGenerating(false);
        handleRun(targetCode);
      }
    }, 15);
  };

  return (
    <div className={`app theme-${vibeTheme} ${performanceMode ? 'perf-mode-active' : ''}`}>
      {/* ===== LEFT PANEL (Hidden in Performance Mode) ===== */}
      {!performanceMode && (
        <div className="panel-left">
          {/* Header */}
          <header className="app-header">
            <div className="brand">
              <div className="brand-icon">
                <div className="brand-ring" />
              </div>
              <div className="brand-text">
                <h1>EVO<span>CROSS</span></h1>
                <span className="brand-tag">evolutionary · audio · live</span>
              </div>
            </div>
            
            <div className="header-actions">
              {isLive && (
                <div className="live-indicator">
                  <div className="live-dot" />
                  <span>LIVE</span>
                  <span className="fps-counter">{fps} FPS</span>
                </div>
              )}
              <button className="btn-ref" onClick={() => setShowReference(!showReference)} title="Reference Manual">
                <span>⌘</span>
              </button>
              
              {/* MIDI Import Hidden Input & Button */}
              <input 
                type="file" 
                ref={fileInputRef} 
                style={{ display: 'none' }} 
                accept=".mid,.midi" 
                onChange={handleMidiImport} 
              />
              <button className="btn-midi" onClick={() => fileInputRef.current?.click()} title="Import MIDI File">
                <span className="btn-icon">🎹</span>
                MIDI
              </button>

              <button className="btn-primary" onClick={() => handleRun(code)} disabled={isGenerating}>
                <span className="btn-icon">▶</span>
                RUN
                <kbd>⇧↵</kbd>
              </button>
              <button className="btn-danger" onClick={handleStop}>
                <span className="btn-icon">■</span>
                STOP
              </button>
            </div>
          </header>

          {/* Preset scroll and Vibe selector */}
          <div className="presets-container">
            <div className="presets-scroll" onWheel={(e) => { e.currentTarget.scrollLeft += e.deltaY; }}>
              {PRESETS.map((p, i) => (
                <button
                  key={p.name}
                  className={`preset-chip ${i === activePreset ? 'active' : ''}`}
                  onClick={() => handlePresetClick(i)}
                  title={p.description}
                >
                  <span className="preset-icon">{p.icon}</span>
                  <span className="preset-name">{p.name}</span>
                </button>
              ))}
            </div>
            
            {/* Vibe Theme Selector */}
            <div className="vibe-selector-bar">
              <span className="vibe-label">🎨 VIBE THEME:</span>
              <div className="vibe-buttons">
                {(['cyberpunk', 'zen', 'retrowave', 'acid'] as const).map(t => (
                  <button 
                    key={t} 
                    className={`vibe-btn ${vibeTheme === t ? 'active' : ''}`}
                    onClick={() => setVibeTheme(t)}
                  >
                    {t.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Code Editor */}
          <div className="editor-wrapper">
            <ChromaEditor
              initialCode={code}
              onRun={handleRun}
              onCodeChange={setCode}
            />
          </div>

          {/* VJ Console: Slider Console + Neuro-Descriptor XY Pad */}
          <div className="vj-console-container">
            <div className="console-left">
              <div className="deck-header">
                <span>🎚️ MASTER CONTROLS</span>
              </div>
              <div className="deck-sliders">
                <div className="slider-group">
                  <label>VOLUME</label>
                  <input
                    type="range"
                    min="0"
                    max="1.5"
                    step="0.05"
                    value={masterVolume}
                    onChange={handleVolumeChange}
                  />
                  <span className="slider-val">{Math.round(masterVolume * 100)}%</span>
                </div>
                <div className="slider-group">
                  <label>TEMPO (BPM)</label>
                  <input
                    type="range"
                    min="80"
                    max="180"
                    step="1"
                    value={masterBpm}
                    onChange={handleBpmSliderChange}
                  />
                  <span className="slider-val">{masterBpm}</span>
                </div>
              </div>
              
              {/* Osc / Perf Mode Toggle */}
              <div className="console-bottom-actions">
                <div className="mini-oscilloscope">
                  <div className="deck-header"><span>🔊 MONITOR</span></div>
                  <canvas ref={oscilloscopeRef} className="oscilloscope-canvas" width="180" height="40" />
                </div>
                <button className="btn-perf-mode" onClick={() => setPerformanceMode(true)}>
                  🎥 GO LIVE (VJ HUD)
                </button>
              </div>
            </div>

            {/* Neuro-Descriptor XY Pad */}
            <div className="console-right">
              <div className="deck-header">
                <span>🧠 NEURO-DESCRIPTOR PAD</span>
                <button 
                  className={`btn-lfo ${isAutoDriving ? 'active' : ''}`}
                  onClick={() => setIsAutoDriving(!isAutoDriving)}
                  title="Neural Auto-Drive LFO mode"
                >
                  {isAutoDriving ? '● AUTO' : '○ DRIFT'}
                </button>
              </div>
              
              <div 
                className="neuro-pad-area"
                onMouseMove={(e) => e.buttons === 1 && handlePadInteraction(e)}
                onMouseDown={handlePadInteraction}
                onTouchMove={handlePadInteraction}
                onTouchStart={handlePadInteraction}
              >
                <div className="radar-grid">
                  <div className="radar-circle r1" />
                  <div className="radar-circle r2" />
                  <div className="radar-crosshair-h" />
                  <div className="radar-crosshair-v" />
                </div>
                
                {/* Glowing coordinate cursor */}
                <div 
                  className="neuro-pad-cursor"
                  style={{ 
                    left: `${xyValue.x * 100}%`, 
                    top: `${(1 - xyValue.y) * 100}%` 
                  }}
                />
                
                <div className="pad-axis-label pad-axis-x">X: TIMBRE</div>
                <div className="pad-axis-label pad-axis-y">Y: ENERGY</div>
              </div>
            </div>
          </div>

          {/* Performance Tabs Selector */}
          <div className="perf-tabs-bar">
            <button className={`tab-btn ${activeTab === 'launchpad' ? 'active' : ''}`} onClick={() => setActiveTab('launchpad')}>
              🎛️ LAUNCHPAD
            </button>
            <button className={`tab-btn ${activeTab === 'beat_builder' ? 'active' : ''}`} onClick={() => setActiveTab('beat_builder')}>
              🥁 BEAT BUILDER
            </button>
            <button className={`tab-btn ${activeTab === 'mixer' ? 'active' : ''}`} onClick={() => setActiveTab('mixer')}>
              🎚️ DJ MIXER
            </button>
            <button className={`tab-btn ${activeTab === 'ai' ? 'active' : ''}`} onClick={() => setActiveTab('ai')}>
              ✨ COMPOSER
            </button>
          </div>

          {/* Tab 1: VJ Performance Launchpad */}
          {activeTab === 'launchpad' && (
            <div className="launchpad-panel">
              <div className="launchpad-header">
                <span className="launchpad-icon">🎛️</span>
                <h3>LIVE SEQUENCER LAUNCHPAD</h3>
                <button className="btn-evolve" onClick={handleEvolveCombo} title="Cross-over and mutate code to generate unique sets">
                  🧬 EVOLVE COMBO
                </button>
              </div>
              <div className="launchpad-grid">
                {LAUNCHPAD_CLIPS.map(c => {
                  const active = isClipActive(c.code);
                  return (
                    <button
                      key={c.id}
                      className={`launch-pad ${active ? 'active' : ''}`}
                      onClick={() => handleLaunchpadClip(c.code, c.id)}
                    >
                      <div className="launch-pad-led" />
                      <span className="launch-pad-label">{c.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tab 2: Beat Builder Panel */}
          {activeTab === 'beat_builder' && (
            <div className="beat-builder-panel">
              <div className="mixer-header">
                <span>🥁 VISUAL STEP BEAT BUILDER</span>
              </div>
              <div className="beat-grid-container">
                {['kick', 'snare', 'hat', 'clap'].map(inst => (
                  <div key={inst} className="beat-row">
                    <span className="inst-label">{inst.toUpperCase()}</span>
                    <div className="step-buttons">
                      {beatGrid[inst].map((active, step) => (
                        <button
                          key={step}
                          className={`step-btn inst-${inst} ${active ? 'active' : ''} ${step % 4 === 0 ? 'beat-start' : ''}`}
                          onClick={() => toggleBeatCell(inst, step)}
                          title={`Toggle ${inst} at step ${step + 1}`}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 2: DJ Mixer Panel */}
          {activeTab === 'mixer' && (
            <div className="dj-mixer-panel">
              <div className="mixer-header">
                <span>🎛️ LIVE CHANNEL MIXER</span>
              </div>
              <div className="mixer-faders">
                <div className="fader-col">
                  <span className="fader-label">DRUMS</span>
                  <div className="fader-track">
                    <input
                      type="range"
                      min="0"
                      max="1.5"
                      step="0.05"
                      className="vertical-slider"
                      value={drumsVolume}
                      onChange={handleDrumsVolumeChange}
                    />
                  </div>
                  <span className="fader-val">{Math.round(drumsVolume * 100)}%</span>
                </div>

                <div className="fader-col">
                  <span className="fader-label">MELODY</span>
                  <div className="fader-track">
                    <input
                      type="range"
                      min="0"
                      max="1.5"
                      step="0.05"
                      className="vertical-slider"
                      value={melodyVolume}
                      onChange={handleMelodyVolumeChange}
                    />
                  </div>
                  <span className="fader-val">{Math.round(melodyVolume * 100)}%</span>
                </div>

                <div className="fader-col">
                  <span className="fader-label">SYNTH</span>
                  <div className="fader-track">
                    <input
                      type="range"
                      min="0"
                      max="1.5"
                      step="0.05"
                      className="vertical-slider"
                      value={synthVolume}
                      onChange={handleSynthVolumeChange}
                    />
                  </div>
                  <span className="fader-val">{Math.round(synthVolume * 100)}%</span>
                </div>

                <div className="fader-col">
                  <span className="fader-label">DELAY</span>
                  <div className="fader-track">
                    <input
                      type="range"
                      min="0"
                      max="0.8"
                      step="0.05"
                      className="vertical-slider"
                      value={delayVolume}
                      onChange={handleDelayVolumeChange}
                    />
                  </div>
                  <span className="fader-val">{Math.round(delayVolume * 100)}%</span>
                </div>

                <div className="fader-col">
                  <span className="fader-label">REVERB</span>
                  <div className="fader-track">
                    <input
                      type="range"
                      min="0"
                      max="0.8"
                      step="0.05"
                      className="vertical-slider"
                      value={reverbVolume}
                      onChange={handleReverbVolumeChange}
                    />
                  </div>
                  <span className="fader-val">{Math.round(reverbVolume * 100)}%</span>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: AI Composer Panel */}
          {activeTab === 'ai' && (
            <div className="ai-composer-panel">
              <div className="ai-header">
                <span className="sparkle">✨</span>
                <h3>RAVE COMPOSER</h3>
              </div>
              <div className="ai-quick-prompts">
                {AI_PROMPTS.map((p) => (
                  <button
                    key={p.label}
                    className="ai-prompt-btn"
                    onClick={() => triggerAIGeneration(p.prompt)}
                    disabled={isGenerating}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="ai-input-row">
                <input
                  type="text"
                  placeholder="e.g., 3d grid highway, ambient zen spaces, fast acid techno..."
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') triggerAIGeneration(customPrompt);
                  }}
                  disabled={isGenerating}
                />
                <button 
                  className="btn-ai-generate" 
                  onClick={() => triggerAIGeneration(customPrompt)}
                  disabled={isGenerating || !customPrompt.trim()}
                >
                  {isGenerating ? 'WRITING...' : 'GENERATE'}
                </button>
              </div>
            </div>
          )}

          {/* Compilation Stats */}
          {compStats && !error && (
            <div className="comp-stats-banner">
              <span>● COMPILE SUCCESSFUL</span>
              <span>Parsed {compStats.tokens} Tokens</span>
              <span>AST: {compStats.nodes} nodes</span>
              <span>GLSL Compiled in {compStats.glslTime}ms</span>
            </div>
          )}

          {/* Error bar */}
          {error && (
            <div className="error-strip">
              <span className="error-badge">ERROR</span>
              <span className="error-msg">{error}</span>
            </div>
          )}
        </div>
      )}

      {/* ===== RIGHT PANEL (Visualizer Canvas & Telemetry HUD) ===== */}
      <div className="panel-right">
        {/* Floating Toolbar Overlay */}
        <div className="canvas-toolbar">
          {performanceMode && (
            <button className="tb-btn exit-btn" onClick={() => setPerformanceMode(false)} title="Exit VJ Performance HUD">
              ⬅ Exit HUD
            </button>
          )}
          <button className="tb-btn" onClick={toggleFullscreen} title="Toggle Fullscreen">🖥️ Fullscreen</button>
          <button className={`tb-btn ${showShaderPeek ? 'active' : ''}`} onClick={() => setShowShaderPeek(!showShaderPeek)} title="Toggle Live GPU Shader Source Code Overlay">
            📡 Shader Code
          </button>
          <button className="tb-btn" onClick={captureSnapshot} title="Download Snapshot PNG">📷 Snapshot</button>
          {performanceMode && (
            <button className="tb-btn" onClick={() => setIsAutoDriving(!isAutoDriving)}>
              {isAutoDriving ? '● Auto-Drive' : '○ Manual'}
            </button>
          )}
        </div>

        <canvas ref={canvasRef} />

        {showShaderPeek && (
          <div className="shader-peek-panel">
            <div className="shader-peek-header">
              <span>📡 LIVE GPU SHADER (COMPILED GLSL)</span>
              <button className="shader-peek-close" onClick={() => setShowShaderPeek(false)}>×</button>
            </div>
            <pre className="shader-peek-body">
              <code>{rendererRef.current?.lastCompiledShaderSource || '// Compiling GLSL...'}</code>
            </pre>
          </div>
        )}
        
        {/* Canvas Empty State */}
        {!isLive && (
          <div className="canvas-empty">
            <div className="empty-rings">
              <div className="ring r1" />
              <div className="ring r2" />
              <div className="ring r3" />
            </div>
            <h2>EVOCROSS</h2>
            <p>Select a preset & press <kbd>Shift + Enter</kbd></p>
          </div>
        )}

        {/* Fullscreen VJ Performance Mode HUD Dashboard */}
        {performanceMode && (
          <div className="vj-hud-overlay">
            {/* Top Bar Header */}
            <div className="hud-header">
              <div className="hud-logo">
                <span className="hud-dot animate-blink" />
                <h2>EVOCROSS // LIVE DECK V1.0</h2>
              </div>
              <div className="hud-theme-info">
                <span>VIBE: {vibeTheme.toUpperCase()}</span>
                <span>FPS: {fps}</span>
                {compStats && <span>NODES: {compStats.nodes}</span>}
              </div>
              <button className="btn-exit-hud" onClick={() => setPerformanceMode(false)}>
                ✖ EXIT PERFORM MODE
              </button>
            </div>

            {/* Main Telemetry Panels */}
            <div className="hud-body">
              {/* Left Telemetry: Circular Radar Visualizer */}
              <div className="hud-panel radar-panel">
                <div className="hud-panel-header">🔊 NEURAL AUDIO SPECTROMETER</div>
                <canvas ref={hudCanvasRef} className="hud-radar-canvas" width="220" height="220" />
                <div className="hud-slider-group">
                  <label>BASS GAIN MULTIPLIER</label>
                  <input 
                    type="range" 
                    min="0.5" 
                    max="2.5" 
                    step="0.1" 
                    value={audioSensitivity} 
                    onChange={e => setAudioSensitivity(parseFloat(e.target.value))} 
                  />
                  <span>x{audioSensitivity.toFixed(1)}</span>
                </div>
              </div>

              {/* Right Telemetry: Floating XY Pad + Controls */}
              <div className="hud-panel controls-panel">
                <div className="hud-panel-header">🧠 DYNAMIC DESCRIPTOR MORPH</div>
                
                {/* Floating pad */}
                <div 
                  className="neuro-pad-area hud-pad"
                  onMouseMove={(e) => e.buttons === 1 && handlePadInteraction(e)}
                  onMouseDown={handlePadInteraction}
                  onTouchMove={handlePadInteraction}
                  onTouchStart={handlePadInteraction}
                >
                  <div className="radar-grid">
                    <div className="radar-circle r1" />
                    <div className="radar-circle r2" />
                    <div className="radar-crosshair-h" />
                    <div className="radar-crosshair-v" />
                  </div>
                  <div 
                    className="neuro-pad-cursor"
                    style={{ 
                      left: `${xyValue.x * 100}%`, 
                      top: `${(1 - xyValue.y) * 100}%` 
                    }}
                  />
                </div>

                <div className="hud-stats-grid">
                  <div className="stat-box">
                    <span className="stat-lbl">TIMBRE (X)</span>
                    <span className="stat-val">{Math.round(xyValue.x * 100)}%</span>
                  </div>
                  <div className="stat-box">
                    <span className="stat-lbl">ENERGY (Y)</span>
                    <span className="stat-val">{Math.round(xyValue.y * 100)}%</span>
                  </div>
                  <div className="stat-box">
                    <span className="stat-lbl">ACTIVE BPM</span>
                    <span className="stat-val">{masterBpm}</span>
                  </div>
                  <div className="stat-box">
                    <span className="stat-lbl">VOLUME</span>
                    <span className="stat-val">{Math.round(masterVolume * 100)}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ===== REFERENCE PANEL ===== */}
      {showReference && (
        <div className="ref-overlay" onClick={() => setShowReference(false)}>
          <div className="ref-panel" onClick={e => e.stopPropagation()}>
            <div className="ref-header">
              <h2>⌘ EvoCross Script Reference</h2>
              <button className="ref-close" onClick={() => setShowReference(false)}>✕</button>
            </div>
            <div className="ref-body">
              <section>
                <h3>🎨 Visual Effects</h3>
                <p className="ref-note">Use <code>draw "effect"</code> to select a GPU shader:</p>
                <div className="ref-grid">
                  <code>grid3d</code><span>[NEW] 3D retro-neon grid highway landscape</span>
                  <code>nebula3d</code><span>[NEW] 3D volumetric space portal tunnel</span>
                  <code>nebula</code><span>Cosmic noise field with flowing colors</span>
                  <code>waveform</code><span>Audio-reactive sine wave visualization</span>
                  <code>particles</code><span>Floating particle field with glow</span>
                  <code>mandala</code><span>Sacred geometry concentric rings</span>
                  <code>tunnel</code><span>Infinite cyberpunk grid tunnel</span>
                  <code>fractal</code><span>Animated Julia set fractal</span>
                  <code>aurora</code><span>Northern lights with starfield</span>
                  <code>glitch</code><span>Digital glitch art with scanlines</span>
                </div>
              </section>
              <section>
                <h3>🔊 Audio</h3>
                <div className="ref-grid">
                  <code>synth "sine" 440</code><span>Play synth tone (sine/square/sawtooth/triangle)</span>
                  <code>drum "kick snare hat"</code><span>Drum sequencer (kick/snare/hat/clap/bass/perc)</span>
                  <code>melody [C4, E4, G4]</code><span>Note sequencer with musical notation (0 = silence/rest)</span>
                  <code>bpm 128</code><span>Set tempo</span>
                  <code>volume 0.3</code><span>Set volume (0.0–1.0)</span>
                  <code>wave "sawtooth"</code><span>Set oscillator waveform</span>
                  <code>filter 1200</code><span>Set synth lowpass filter cutoff frequency</span>
                  <code>attack 0.05</code><span>Set volume envelope attack time (seconds)</span>
                  <code>release 0.4</code><span>Set volume envelope release time (seconds)</span>
                </div>
              </section>
              <section>
                <h3>⛓️ Chaining</h3>
                <pre>{`draw "grid3d" -> glow 4\nsynth "sawtooth" 110 -> filter 600 -> attack 0.1 -> release 0.8\nbpm 125`}</pre>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
