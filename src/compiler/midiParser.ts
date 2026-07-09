/**
 * EvoCross MIDI to ChromaScript Parser
 * 
 * Directly parses binary Standard MIDI Files (.mid/.midi) on the client side
 * and translates tracks into compatible drum patterns and melody arrays.
 */

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function midiToName(m: number): string {
  const octave = Math.floor(m / 12) - 1; // 60 -> C4
  return NOTE_NAMES[m % 12] + octave;
}

// General MIDI percussion mapping -> EvoCross drum names
const DRUM_MAP: Record<number, string> = {
  35: 'kick', 36: 'kick', 37: 'perc', 38: 'snare', 39: 'clap', 40: 'snare',
  41: 'bass', 42: 'hat', 43: 'bass', 44: 'hat', 45: 'perc', 46: 'hat',
  47: 'perc', 48: 'perc', 49: 'perc', 50: 'perc', 51: 'perc', 52: 'perc',
  53: 'perc', 54: 'perc', 55: 'perc', 56: 'perc', 57: 'perc', 59: 'perc',
};
const drumName = (pitch: number): string => DRUM_MAP[pitch] || 'perc';

// General MIDI Program (0-127) -> EvoCross waveforms and lowpass filter cutoffs
interface WaveformMapping {
  wave: string;
  filter: number;
}
function getWaveformMapping(prog: number): WaveformMapping {
  if (prog <= 7) return { wave: 'sine', filter: 1500 };       // Pianos / Rhodes -> Sine bell
  if (prog >= 8 && prog <= 15) return { wave: 'triangle', filter: 1200 }; // Marimba / Glockenspiel
  if (prog >= 16 && prog <= 23) return { wave: 'square', filter: 800 };  // Organ
  if (prog >= 24 && prog <= 31) return { wave: 'triangle', filter: 1400 }; // Guitars
  if (prog >= 32 && prog <= 39) return { wave: 'sawtooth', filter: 400 }; // Basses
  if (prog >= 40 && prog <= 47) return { wave: 'sine', filter: 1000 };   // Strings
  if (prog >= 80 && prog <= 87) return { wave: 'square', filter: 1800 }; // Synth Lead
  if (prog >= 88 && prog <= 95) return { wave: 'sawtooth', filter: 950 }; // Synth Pad
  return { wave: 'sine', filter: 1200 }; // Default
}

interface MidiNote {
  chan: number;
  pitch: number;
  start: number;
  dur: number;
  vel: number;
}

interface ParsedMidi {
  ppq: number;
  bpm: number;
  timeSig: { num: number; den: number };
  tracks: {
    notes: MidiNote[];
    programs: Record<number, number>;
    name: string;
  }[];
}

function parseMidi(bytes: Uint8Array): ParsedMidi {
  let pos = 0;
  const u16 = () => ((bytes[pos++] << 8) | bytes[pos++]) >>> 0;
  const u32 = () => ((bytes[pos++] << 24) | (bytes[pos++] << 16) | (bytes[pos++] << 8) | bytes[pos++]) >>> 0;
  const tag = () => String.fromCharCode(bytes[pos++], bytes[pos++], bytes[pos++], bytes[pos++]);
  
  const vlq = () => {
    let v = 0, b;
    do {
      b = bytes[pos++];
      v = (v << 7) | (b & 0x7f);
    } while (b & 0x80);
    return v;
  };

  if (tag() !== 'MThd') throw new Error('Not a valid MIDI file (missing MThd header).');
  const headerLen = u32();
  u16(); // format
  const ntracks = u16();
  const division = u16();
  pos += headerLen - 6;
  const ppq = division & 0x8000 ? 480 : division;

  const tracks: ParsedMidi['tracks'] = [];
  const tempos: { tick: number; bpm: number }[] = [];
  let timeSig = { num: 4, den: 4 };

  for (let t = 0; t < ntracks && pos < bytes.length; t++) {
    if (tag() !== 'MTrk') break;
    const len = u32();
    const end = pos + len;
    let tick = 0;
    let running = 0;
    const active: Record<string, { tick: number; vel: number }> = {};
    const notes: MidiNote[] = [];
    const programs: Record<number, number> = {};
    let name = '';

    while (pos < end) {
      tick += vlq();
      let status = bytes[pos];
      if (status & 0x80) {
        pos++;
        if (status < 0xf0) running = status;
      } else {
        status = running;
      }
      const type = status & 0xf0;
      const chan = status & 0x0f;

      if (status === 0xff) {
        const metaType = bytes[pos++];
        const mlen = vlq();
        const data = bytes.slice(pos, pos + mlen);
        pos += mlen;
        if (metaType === 0x51 && mlen === 3) {
          const us = (data[0] << 16) | (data[1] << 8) | data[2];
          tempos.push({ tick, bpm: 60000000 / us });
        } else if (metaType === 0x58 && mlen >= 2) {
          timeSig = { num: data[0], den: 2 ** data[1] };
        } else if (metaType === 0x03) {
          name = String.fromCharCode(...data);
        }
      } else if (status === 0xf0 || status === 0xf7) {
        pos += vlq();
      } else if (type === 0x90) {
        const pitch = bytes[pos++];
        const vel = bytes[pos++];
        if (vel > 0) {
          active[`${chan}:${pitch}`] = { tick, vel };
        } else {
          const k = `${chan}:${pitch}`;
          if (active[k]) {
            notes.push({ chan, pitch, start: active[k].tick, dur: tick - active[k].tick, vel: active[k].vel });
            delete active[k];
          }
        }
      } else if (type === 0x80) {
        const pitch = bytes[pos++];
        pos++; // velocity
        const k = `${chan}:${pitch}`;
        if (active[k]) {
          notes.push({ chan, pitch, start: active[k].tick, dur: tick - active[k].tick, vel: active[k].vel });
          delete active[k];
        }
      } else if (type === 0xc0) {
        programs[chan] = bytes[pos++];
      } else if (type === 0xd0) {
        pos += 1;
      } else if (type === 0xa0 || type === 0xb0 || type === 0xe0) {
        pos += 2;
      } else {
        pos += 1;
      }
    }
    pos = end;
    if (notes.length) tracks.push({ notes, programs, name });
  }

  const bpm = tempos.length ? tempos[0].bpm : 120;
  return { ppq, bpm, timeSig, tracks };
}

export function midiToChromaScript(bytes: Uint8Array): string {
  const midi = parseMidi(bytes);
  const stepsPerBeat = 4; // 16th note grid quantization
  const maxBars = 16;     // cap bars to prevent infinite length code
  
  const beatsPerBar = midi.timeSig.num * (4 / midi.timeSig.den);
  const steps = Math.max(1, Math.round(beatsPerBar * stepsPerBeat));
  
  const lines: string[] = [];
  lines.push(`// EvoCross compiled from MIDI file`);
  lines.push(`draw "particles" -> glow 4`); // Default active visualizer
  lines.push(`bpm ${Math.round(midi.bpm)}`);
  lines.push(`volume 0.7`);
  lines.push(``);

  midi.tracks.forEach((track, idx) => {
    const isDrum = track.notes.some((n) => n.chan === 9); // MIDI channel 10 is percussion (index 9)
    const ticksPerStep = (midi.ppq * beatsPerBar) / steps;
    const startStepOf = (tick: number) => Math.round(tick / ticksPerStep);
    
    let lastStep = 0;
    for (const n of track.notes) lastStep = Math.max(lastStep, startStepOf(n.start));
    let totalBars = Math.floor(lastStep / steps) + 1;
    totalBars = Math.min(totalBars, maxBars);

    const label = track.name.replace(/[^a-zA-Z0-9 ]/g, '').trim() || (isDrum ? 'Drums' : `Melody ${idx + 1}`);

    if (isDrum) {
      // Drum track: Generate string pattern like: drum "kick - hat snare"
      const drumSteps = Array.from({ length: totalBars * steps }, () => '-');
      for (const n of track.notes) {
        const s = startStepOf(n.start);
        if (s >= totalBars * steps) continue;
        drumSteps[s] = drumName(n.pitch);
      }
      lines.push(`// Track: ${label} (Drums)`);
      lines.push(`drum "${drumSteps.join(' ')}"`);
    } else {
      // Melodic track: Generate note array like: melody [C4, 0, E4, 0]
      const channel = track.notes[0].chan;
      const program = track.programs[channel] ?? 0;
      const mapping = getWaveformMapping(program);

      const noteSteps = Array.from({ length: totalBars * steps }, () => '0'); // '0' is rest
      for (const n of track.notes) {
        const s = startStepOf(n.start);
        if (s >= totalBars * steps) continue;
        noteSteps[s] = midiToName(n.pitch);
      }

      lines.push(`// Track: ${label}`);
      lines.push(`melody [${noteSteps.join(', ')}]`);
      lines.push(`wave "${mapping.wave}" -> filter ${mapping.filter}`);
    }
    lines.push(``);
  });

  return lines.join('\n');
}
