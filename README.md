# VESTIGE

A message to the future, carried by sound.

An immersive world of luminous roots, towering mushrooms, and pathways woven
from light. Wander through an optimized procedural forest and listen to the
recordings held by its mushrooms.

Built with React, TypeScript, Three.js, React Three Fiber, WebGPU with a WebGL
fallback, and Web Audio API. The startup Sound On text unlocks browser audio;
the world appears once the scene and background audio are ready.

## Local Development

Use Node.js 22.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5177/.

Move with WASD or arrow keys; click the world to capture the mouse and look
around. Space jumps. The bottom-right controls toggle sound and pause the
experience; About opens the project description.

## Production Build

```sh
npm run build
```

Vite writes the standalone site to `dist/`. Source and audio assets are included
in this repository; no environment variables or backend service are required.

## Vercel

Import `HASHQIX/VESTIGE` from GitHub and use:

- Framework preset: Vite
- Root directory: repository root (`.`)
- Install command: `npm ci`
- Build command: `npm run build`
- Output directory: `dist`
- Node.js version: 22.x

The only scene is VESTIGE, available at `/`. No query parameters are needed.
