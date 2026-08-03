# Motocross Sunset Racer

Cel-shaded arcade motocross racing game built with Three.js.

## Features

- **Infinite procedural desert terrain** with layered noise displacement
- **Full cel-shading pipeline** with quantized lighting, back-face outlines, and screen-space edge detection
- **Sunset atmosphere** with gradient sky, stylized sun disc, and sun-glitter effects
- **4-rider races** with 3 AI opponents (aggressive, clean, erratic personalities)
- **Arcade physics** with throttle, steering, suspension, and dust particles
- **Synthesized audio** - engine tone, dirt rush, landing thuds, gate drop
- **Complete HUD** with speedometer, lap counter, position, and boost meter

## Controls

- **W / Arrow Up**: Throttle
- **A / Arrow Left**: Steer left
- **D / Arrow Right**: Steer right

## Running

```bash
npm install
npm run dev
```

Open browser to the displayed local URL (typically http://localhost:3000).

## Tech Stack

- Vite + TypeScript
- Three.js r185
- Custom GLSL shaders for cel-shading, terrain, sky, and post-processing
- Web Audio API for synthesized sound

## Art Direction

Non-photorealistic rendering locked to golden hour palette:
- Deep indigo-violet zenith
- Magenta mid-sky transition  
- Burning orange horizon
- Indigo-plum outlines
- Teal accent for racing line

All assets procedurally generated - no external models, textures, or audio files.
