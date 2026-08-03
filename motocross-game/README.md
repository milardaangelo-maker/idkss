# Sunset Motocross

Cel-shaded arcade motocross racing game built with Three.js, TypeScript, and Vite.

## Features

- **Cel-Shaded Graphics**: Custom NPR rendering with quantized lighting bands, back-face extrusion outlines, and sunset-tuned color palette
- **Procedural Terrain**: Infinite desert with layered noise displacement, cel-shaded dirt colors, and sun-glitter effects
- **Arcade Physics**: Weighty bike handling with suspension, air control, slides, and landing impacts
- **AI Opponents**: 3 AI riders with distinct personalities (aggressive, clean, erratic) and rubber-banding
- **Animated Riders**: Procedurally animated characters with attack position, lean, arm pump, and jump reactions
- **Dust System**: Particle-based roost plumes, dust rings, and landing bursts
- **Synthesized Audio**: Web Audio API engine sounds, countdown beeps, and landing thuds
- **Complete Race System**: 3-lap races, gate-drop countdown, checkpoint gates, results screen

## Controls

- **W / ↑**: Throttle
- **S / ↓**: Brake
- **A / ←**: Steer Left
- **D / →**: Steer Right
- **SPACE**: Jump
- **SHIFT**: Boost

## Quick Start

```bash
npm install
npm run dev
```

Open the displayed URL in your browser.

## Tech Stack

- Three.js r185
- TypeScript
- Vite
- Web Audio API
- Custom GLSL shaders for cel-shading

## Art Direction

The game uses a stylized sunset palette:
- Magma orange (#ff6b35)
- Hot magenta (#ff356b)
- Deep indigo (#1a0a2e)
- Dust ochre (#cc8855)
- Teal accent (#00d4aa)

All assets are procedurally generated - no external models, textures, or audio files.

## Architecture

- `TerrainSystem`: Vertex shader displacement with simplex noise
- `BikePhysics`: Arcade physics with terrain following
- `BikeMesh` / `RiderMesh`: Cel-shaded meshes with outline extrusion
- `AIRider`: Spline-following AI with personality traits
- `RaceTrack`: Catmull-Rom spline circuit with glowing racing line
- `DustSystem`: GPU-accelerated particle system
- `AudioEngine`: Synthesized sound effects
