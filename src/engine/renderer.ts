/**
 * EVOCROSS WebGL Visual Engine
 * 
 * Copyright (c) 2026 AnsHh9094. All rights reserved.
 * Proprietary and Confidential. Unauthorized copying or redistribution
 * of this project, via any medium, is strictly prohibited.
 */
import type { SceneState } from '../compiler/evaluator';

// Vertex shader — full screen quad
const VERTEX_SHADER = `
  attribute vec2 a_position;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

// Base fragment shader with uniforms
const FRAGMENT_HEADER = `
  precision highp float;
  uniform float u_time;
  uniform vec2 u_resolution;
  uniform float u_bass;
  uniform float u_mid;
  uniform float u_treble;
  uniform float u_energy;
  uniform float u_descriptor_x;
  uniform float u_descriptor_y;

  #define PI 3.14159265359
  #define TAU 6.28318530718

  // Signed distance functions
  float sdCircle(vec2 p, float r) {
    return length(p) - r;
  }

  float sdBox(vec2 p, vec2 b) {
    vec2 d = abs(p) - b;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
  }

  float sdStar(vec2 p, float r, int n, float m) {
    float an = PI / float(n);
    float en = PI / m;
    vec2 acs = vec2(cos(an), sin(an));
    vec2 ecs = vec2(cos(en), sin(en));
    float bn = mod(atan(p.x, p.y), 2.0 * an) - an;
    p = length(p) * vec2(cos(bn), abs(sin(bn)));
    p -= r * acs;
    p += ecs * clamp(-dot(p, ecs), 0.0, r * acs.y / ecs.y);
    return length(p) * sign(p.x);
  }

  // Rotation matrix
  mat2 rot(float a) {
    float c = cos(a), s = sin(a);
    return mat2(c, -s, s, c);
  }

  // Hash for randomness
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  // Smooth noise
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  // Fractal Brownian Motion
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    mat2 r = rot(0.5);
    for (int i = 0; i < 6; i++) {
      v += a * noise(p);
      p = r * p * 2.0;
      a *= 0.5;
    }
    return v;
  }

  // Glow function
  float glow(float d, float intensity, float radius) {
    return intensity / (abs(d) + radius);
  }
`;

// Pre-built shader effects
const SHADER_EFFECTS: Record<string, string> = {
  'nebula': `
    void main() {
      vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
      float t = u_time * 0.3;
      
      vec2 p = uv * 3.0;
      // Morph noise using descriptor values
      p.xy *= rot(u_descriptor_x * PI);
      float f1 = fbm(p + t + fbm(p + t));
      float f2 = fbm(p * 1.5 - t * 0.7 + fbm(p * 0.8 + t * 0.5));
      float f3 = fbm(p * 2.0 + t * 0.3);
      
      vec3 col = vec3(0.0);
      col += vec3(0.1, 0.4, 0.8) * f1 * (1.0 + u_bass * 2.0);
      col += vec3(0.8, 0.1, 0.5) * f2 * (1.0 + u_mid);
      col += vec3(0.0, 0.8, 0.6) * f3 * 0.5;
      
      // Stars modulated by treble and descriptor y
      float stars = pow(hash(floor(uv * (200.0 - u_descriptor_y * 100.0))), 20.0);
      col += stars * (1.0 + u_treble * 3.0);
      
      // Vignette
      col *= 1.0 - 0.4 * length(uv);
      
      gl_FragColor = vec4(col, 1.0);
    }
  `,
  
  'waveform': `
    void main() {
      vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
      float t = u_time;
      
      vec3 col = vec3(0.0);
      
      // Dynamic line count using Y descriptor
      float linesCount = 3.0 + floor(u_descriptor_y * 6.0);
      
      for (float i = 0.0; i < 9.0; i++) {
        if (i >= linesCount) break;
        vec2 p = uv;
        p.y += sin(p.x * (3.0 + i) + t * (1.0 + i * 0.3) + i * 0.5) * (0.1 + u_descriptor_x * 0.15) * (1.0 + u_bass);
        p.y += cos(p.x * (5.0 + i * 2.0) - t * 0.7) * 0.05 * (1.0 + u_mid);
        
        float d = abs(p.y);
        float g = glow(d, 0.005 * (1.0 + u_energy), 0.01);
        
        vec3 c = 0.5 + 0.5 * cos(TAU * (vec3(0.0, 0.33, 0.67) + i * 0.1 + t * 0.1));
        col += c * g;
      }
      
      col *= 1.0 - 0.3 * length(uv);
      gl_FragColor = vec4(col, 1.0);
    }
  `,
  
  'particles': `
    void main() {
      vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
      float t = u_time;
      
      vec3 col = vec3(0.0);
      
      // Number of particles controlled by Y descriptor
      float maxParticles = 10.0 + floor(u_descriptor_y * 30.0);
      
      for (float i = 0.0; i < 40.0; i++) {
        if (i >= maxParticles) break;
        vec2 seed = vec2(i * 0.17, i * 0.31);
        vec2 pos = vec2(
          sin(hash(seed) * TAU + t * (0.5 + hash(seed + 0.5) * 0.5)) * (0.3 + hash(seed + 1.0) * 0.5),
          cos(hash(seed + 0.1) * TAU + t * (0.3 + hash(seed + 0.7) * 0.7)) * (0.3 + hash(seed + 2.0) * 0.5)
        );
        
        float d = length(uv - pos);
        // Size and brightness influenced by X descriptor
        float size = 0.008 + hash(seed + 3.0) * 0.02 + u_descriptor_x * 0.015;
        size *= 1.0 + u_bass * 0.5;
        
        float g = glow(d, size, 0.005);
        
        vec3 c = 0.5 + 0.5 * cos(TAU * (vec3(0.0, 0.33, 0.67) + hash(seed + 4.0) + t * 0.05));
        col += c * g;
      }
      
      gl_FragColor = vec4(col, 1.0);
    }
  `,
  
  'mandala': `
    void main() {
      vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
      float t = u_time * 0.5;
      
      float r = length(uv);
      float a = atan(uv.y, uv.x);
      
      vec3 col = vec3(0.0);
      
      // Ring complexity controlled by Y descriptor
      float ringLimit = 4.0 + floor(u_descriptor_y * 6.0);
      
      for (float i = 1.0; i < 11.0; i++) {
        if (i >= ringLimit) break;
        float n = 4.0 + i + floor(u_descriptor_x * 6.0); // Symmetry dynamic with X
        float wave = sin(a * n + t * (1.0 + i * 0.2)) * 0.5 + 0.5;
        float ring = abs(r - 0.08 * i * (1.0 + u_bass * 0.3) - wave * 0.04);
        float g = glow(ring, 0.0018, 0.005);
        
        vec3 c = 0.5 + 0.5 * cos(TAU * (vec3(0.0, 0.33, 0.67) + i * 0.08 + t * 0.1));
        col += c * g;
      }
      
      // Center glow
      col += vec3(1.0, 0.8, 0.9) * glow(r, 0.01 * (1.0 + u_energy), 0.05);
      
      gl_FragColor = vec4(col, 1.0);
    }
  `,
  
  'tunnel': `
    void main() {
      vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
      float t = u_time * (0.8 + u_descriptor_y * 1.2); // Speed scales with Y
      
      float r = length(uv);
      float a = atan(uv.y, uv.x);
      
      // Infinite tunnel
      float tunnel = 0.5 / r;
      vec2 tp = vec2(tunnel + t * 2.0, a / PI);
      
      // Grid density using X descriptor
      float gridDensity = 6.0 + floor(u_descriptor_x * 8.0);
      float pattern = abs(sin(tp.x * gridDensity)) * abs(sin(tp.y * 8.0));
      pattern = pow(pattern, 0.5);
      
      vec3 col = vec3(0.0);
      col += vec3(0.0, 1.0, 0.85) * pattern * (1.0 / (r * 4.0 + 0.5));
      col += vec3(0.5, 0.0, 1.0) * (1.0 - pattern) * (1.0 / (r * 6.0 + 0.5));
      
      col *= 1.0 + u_bass * 0.5;
      
      float edge = smoothstep(0.0, 0.1, r);
      col *= edge;
      
      gl_FragColor = vec4(col, 1.0);
    }
  `,
  
  'fractal': `
    void main() {
      vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
      float t = u_time * 0.2;
      
      // Warp fractal coordinates based on XY descriptors
      vec2 c = uv * (1.5 + u_descriptor_y) + vec2(sin(t) * 0.3, cos(t * 0.7) * 0.3);
      c += vec2(-0.745 + (u_descriptor_x - 0.5) * 0.2, 0.186); 
      
      vec2 z = uv * 2.0;
      float iter = 0.0;
      
      for (int i = 0; i < 80; i++) {
        z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
        if (dot(z, z) > 4.0) break;
        iter += 1.0;
      }
      
      float f = iter / 80.0;
      
      vec3 col = 0.5 + 0.5 * cos(TAU * (f * 2.0 + vec3(0.0, 0.1, 0.2) + t));
      col *= smoothstep(1.0, 0.0, f);
      col += vec3(0.0, 0.5, 1.0) * glow(length(uv), 0.01, 0.3) * u_energy;
      
      gl_FragColor = vec4(col, 1.0);
    }
  `,
  
  'aurora': `
    void main() {
      vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
      float t = u_time * 0.4;
      
      vec3 col = vec3(0.0);
      
      // Dynamic vertical layers based on Y
      float layers = 2.0 + floor(u_descriptor_y * 4.0);
      
      for (float i = 0.0; i < 6.0; i++) {
        if (i >= layers) break;
        vec2 p = uv;
        p.x += sin(p.y * (2.0 + i) + t + i * 1.5) * (0.2 + u_descriptor_x * 0.2);
        p.y += i * 0.12 - 0.25;
        
        float wave = sin(p.x * 5.0 + t * 2.0 + i) * 0.1;
        wave += sin(p.x * 8.0 - t * 1.5 + i * 2.0) * 0.05;
        float d = abs(p.y + wave);
        
        float intensity = 0.005 * (1.0 + u_bass * 2.0);
        float g = intensity / (d + 0.01);
        
        vec3 c = mix(
          vec3(0.0, 1.0, 0.5),
          vec3(0.3, 0.0, 1.0),
          i / layers + sin(t * 0.3) * 0.2
        );
        col += c * g * 0.45;
      }
      
      // Stars
      float stars = pow(hash(floor(uv * 300.0)), 25.0) * 0.5;
      col += stars;
      
      gl_FragColor = vec4(col, 1.0);
    }
  `,
  
  'glitch': `
    void main() {
      vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
      float t = u_time;
      
      // Glitch displacement scaled by Y descriptor
      float glitchStrength = u_bass * (0.05 + u_descriptor_y * 0.15);
      float band = step(0.75, sin(uv.y * 30.0 + t * 10.0));
      uv.x += band * glitchStrength * sin(t * 40.0);
      
      // RGB split scaled by X descriptor
      float split = 0.008 + (u_energy + u_descriptor_x) * 0.025;
      vec3 col;
      col.r = fbm((uv + vec2(split, 0.0)) * 3.0 + t * 0.5);
      col.g = fbm(uv * 3.0 + t * 0.5);
      col.b = fbm((uv - vec2(split, 0.0)) * 3.0 + t * 0.5);
      
      // Scanlines
      col *= 0.78 + 0.22 * sin(gl_FragCoord.y * 2.5);
      
      // Random block glitching
      vec2 block = floor(uv * 7.0);
      float blockGlitch = step(0.96 - u_descriptor_y * 0.03, hash(block + floor(t * 5.0)));
      col = mix(col, 1.0 - col, blockGlitch);
      
      col *= 1.0 - 0.5 * length(uv);
      
      gl_FragColor = vec4(col, 1.0);
    }
  `,

  'grid3d': `
    void main() {
      vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
      float t = u_time * (0.6 + u_descriptor_y * 1.4); // Y controls speed
      
      // Raymarching camera setup
      vec3 rd = normalize(vec3(uv, 1.0));
      rd.yz *= rot(-0.35 + sin(t*0.15)*0.05); // slightly undulating camera
      
      vec3 ro = vec3(0.0, 1.3, t * 1.8);
      
      // Calculate intersection on ground plane (y = 0)
      float h = ro.y / (-rd.y);
      vec3 col = vec3(0.0);
      
      if (rd.y < 0.0) {
        vec3 p = ro + rd * h;
        
        // Add winding wave to the highway
        p.x += sin(p.z * 0.45 + t) * 0.28;
        
        // Dynamic grid lines (width and spacing morphs with X descriptor)
        float lineWidth = 0.012 + u_descriptor_x * 0.015;
        float gridX = abs(fract(p.x) - 0.5) / lineWidth;
        float gridZ = abs(fract(p.z) - 0.5) / lineWidth;
        float lines = min(gridX, gridZ);
        float grid = 1.0 - min(lines, 1.0);
        
        // Winding grid neon colors (cyan -> hot pink gradient)
        vec3 gridCol = mix(vec3(0.0, 1.0, 0.9), vec3(1.0, 0.0, 0.5), sin(p.z * 0.08) * 0.5 + 0.5);
        gridCol *= 1.0 + u_descriptor_x * 0.8;
        
        // Exponential fog based on depth
        float fog = exp(-0.06 * h);
        col = gridCol * grid * fog;
      } else {
        // Sky elements
        vec2 sunPos = vec2(0.0, 0.15 + sin(t*0.1)*0.03);
        float sunDist = length(uv - sunPos);
        
        // Sky backdrop (sunset purple to deep space blue)
        col = mix(vec3(0.01, 0.0, 0.04), vec3(0.18, 0.0, 0.15), uv.y + 0.4);
        
        // Raymarched Retro Neon Sun
        if (sunDist < 0.26) {
          float sunMask = 1.0;
          float line = sin((uv.y - sunPos.y) * 40.0 + t * 2.5) * 0.5 + 0.5;
          if (line < 0.38 && uv.y < sunPos.y) {
            sunMask = 0.0;
          }
          
          vec3 sunCol = mix(vec3(1.0, 0.6, 0.0), vec3(1.0, 0.0, 0.4), (uv.y - sunPos.y + 0.13) / 0.26);
          sunCol *= 1.0 + u_mid * 0.4;
          col = mix(col, sunCol, sunMask * smoothstep(0.26, 0.25, sunDist));
        }
        
        // Sun corona bloom glow
        col += vec3(1.0, 0.08, 0.45) * glow(sunDist, 0.016 * (1.0 + u_energy), 0.07);
        
        // Stars glowing to high frequencies
        float stars = pow(hash(floor(uv * 200.0)), 24.0);
        col += stars * (1.0 - smoothstep(0.12, 0.28, uv.y)) * (1.0 + u_treble * 2.5);
      }
      
      gl_FragColor = vec4(col, 1.0);
    }
  `,

  'nebula3d': `
    void main() {
      vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
      float t = u_time * (0.35 + u_descriptor_y * 1.0); // Speed scales with Y
      
      vec3 col = vec3(0.0);
      vec3 ro = vec3(0.0, 0.0, -2.4);
      vec3 rd = normalize(vec3(uv, 1.0));
      
      // Spin/Twist coordinates using X descriptor
      float angle = sin(t * 0.15) * 0.4 + u_descriptor_x * 0.7;
      rd.xy *= rot(angle + length(uv) * 0.35);
      
      // Volumetric accumulation loop (32 steps for efficiency and smooth gradients)
      float d = 0.0;
      float dMax = 6.0;
      
      for (int i = 0; i < 32; i++) {
        if (d > dMax) break;
        vec3 p = ro + rd * d;
        
        // Twisting spiral space coordinate
        p.xy *= rot(p.z * 0.25 + t * 0.2);
        
        // Noise density mapping
        float n = fbm(p.xy * 1.6 + vec2(0.0, p.z - t * 0.8));
        float radius = 0.82 + sin(p.z * 0.7 + t * 0.5) * 0.12 + u_bass * 0.22;
        float density = smoothstep(0.18, 0.0, abs(length(p.xy) - radius) - n * 0.24);
        
        if (density > 0.02) {
          // Color shift based on distance and X descriptor
          vec3 layerCol = mix(vec3(0.05, 0.75, 1.0), vec3(0.9, 0.0, 0.65), sin(p.z * 0.4 + u_descriptor_x * PI) * 0.5 + 0.5);
          layerCol *= density * (0.09 / d);
          col += layerCol * (1.0 + u_energy * 0.7);
        }
        
        d += 0.18;
      }
      
      // Glowing warp portal core
      col += vec3(0.12, 0.78, 0.95) * glow(length(uv), 0.009 * (1.0 + u_energy * 2.2), 0.055);
      
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export class WebGLRenderer {
  public lastCompiledShaderSource = '';
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext;
  private program: WebGLProgram | null = null;
  private animationId: number | null = null;
  private startTime: number = performance.now();

  
  // Audio analysis
  private analyser: AnalyserNode | null = null;
  private dataArray: Uint8Array | null = null;
  private bass = 0;
  private mid = 0;
  private treble = 0;
  private energy = 0;

  // Real-time XY parameters
  private descriptorX = 0.5;
  private descriptorY = 0.5;

  // Uniform locations
  private uniforms: Record<string, WebGLUniformLocation | null> = {};

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl', { antialias: true, alpha: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error('WebGL not supported');
    this.gl = gl;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    
    // Setup fullscreen quad
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
  }

  private resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  private compileShader(type: number, source: string): WebGLShader | null {
    const gl = this.gl;
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  private buildProgram(fragmentSource: string): WebGLProgram | null {
    this.lastCompiledShaderSource = FRAGMENT_HEADER + fragmentSource;
    const gl = this.gl;
    const vs = this.compileShader(gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = this.compileShader(gl.FRAGMENT_SHADER, FRAGMENT_HEADER + fragmentSource);
    if (!vs || !fs) return null;

    const program = gl.createProgram();
    if (!program) return null;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      return null;
    }

    return program;
  }

  connectAnalyser(analyser: AnalyserNode) {
    this.analyser = analyser;
    this.dataArray = new Uint8Array(analyser.frequencyBinCount);
  }

  setXyParams(x: number, y: number) {
    this.descriptorX = x;
    this.descriptorY = y;
  }

  private updateAudioData() {
    if (!this.analyser || !this.dataArray) {
      // Simulate subtle movement when no audio
      const t = performance.now() / 1000;
      this.bass = Math.sin(t * 0.5) * 0.2 + 0.3;
      this.mid = Math.sin(t * 0.7 + 1.0) * 0.15 + 0.25;
      this.treble = Math.sin(t * 1.1 + 2.0) * 0.1 + 0.2;
      this.energy = (this.bass + this.mid + this.treble) / 3;
      return;
    }

    this.analyser.getByteFrequencyData(this.dataArray as any);
    const len = this.dataArray.length;
    
    let bassSum = 0, midSum = 0, trebleSum = 0;
    const bassEnd = Math.floor(len * 0.1);
    const midEnd = Math.floor(len * 0.5);
    
    for (let i = 0; i < len; i++) {
      const val = this.dataArray[i] / 255;
      if (i < bassEnd) bassSum += val;
      else if (i < midEnd) midSum += val;
      else trebleSum += val;
    }
    
    this.bass = bassSum / bassEnd;
    this.mid = midSum / (midEnd - bassEnd);
    this.treble = trebleSum / (len - midEnd);
    this.energy = (this.bass + this.mid + this.treble) / 3;
  }

  update(state: SceneState) {

    // Determine which shader to use based on the scene layers
    let shaderName = 'nebula'; // default
    
    for (const layer of state.visuals) {
      if (layer.shape in SHADER_EFFECTS) {
        shaderName = layer.shape;
        break;
      }
    }

    if (!(shaderName in SHADER_EFFECTS)) {
      if (state.visuals.some(v => v.oscillateSpeed > 0)) shaderName = 'waveform';
      else if (state.visuals.some(v => v.copies > 2)) shaderName = 'mandala';
      else if (state.visuals.some(v => v.trail > 0)) shaderName = 'tunnel';
      else shaderName = 'nebula';
    }

    const newProgram = this.buildProgram(SHADER_EFFECTS[shaderName]);
    if (newProgram) {
      if (this.program) this.gl.deleteProgram(this.program);
      this.program = newProgram;
      
      const gl = this.gl;
      gl.useProgram(this.program);
      
      // Cache uniform locations
      this.uniforms = {
        time: gl.getUniformLocation(this.program, 'u_time'),
        resolution: gl.getUniformLocation(this.program, 'u_resolution'),
        bass: gl.getUniformLocation(this.program, 'u_bass'),
        mid: gl.getUniformLocation(this.program, 'u_mid'),
        treble: gl.getUniformLocation(this.program, 'u_treble'),
        energy: gl.getUniformLocation(this.program, 'u_energy'),
        descriptor_x: gl.getUniformLocation(this.program, 'u_descriptor_x'),
        descriptor_y: gl.getUniformLocation(this.program, 'u_descriptor_y'),
      };

      // Setup position attribute
      const posLoc = gl.getAttribLocation(this.program, 'a_position');
      gl.enableVertexAttribArray(posLoc);
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
    }

    if (!this.animationId) {
      this.startTime = performance.now();
      this.loop();
    }
  }

  stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    const gl = this.gl;
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  private loop = () => {
    this.animationId = requestAnimationFrame(this.loop);
    if (!this.program) return;

    const gl = this.gl;
    const time = (performance.now() - this.startTime) / 1000;

    this.updateAudioData();

    gl.uniform1f(this.uniforms.time, time);
    gl.uniform2f(this.uniforms.resolution, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.uniforms.bass, this.bass);
    gl.uniform1f(this.uniforms.mid, this.mid);
    gl.uniform1f(this.uniforms.treble, this.treble);
    gl.uniform1f(this.uniforms.energy, this.energy);
    
    // Bind XY parameters to uniforms
    gl.uniform1f(this.uniforms.descriptor_x, this.descriptorX);
    gl.uniform1f(this.uniforms.descriptor_y, this.descriptorY);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  destroy() {
    this.stop();
    if (this.program) {
      this.gl.deleteProgram(this.program);
    }
  }
}

export { SHADER_EFFECTS };
