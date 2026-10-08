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
around. Space jumps. The bottom-right controls pause the experience and switch
between BRIGHTER and ORIGINAL visibility; About opens the project description.

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

## Startup Typography

The app uses a self-hosted Latin subset of Cormorant Garamond Light by the
Cormorant Project Authors, under the SIL Open Font License 1.1.
The font and license are included in `public/fonts/`.

## Local visibility comparison

BRIGHTER slightly strengthens existing filament visibility (0.12 → 0.16) and
scales the existing distant silhouettes by 1.5. Those silhouettes already cover
the forest beyond loaded detailed patches. The switch changes only render
uniforms: geometry, streaming limits, ray queries, render targets and passes stay
the same. The original palette is preserved; no surface-light overlay is added.

Compare with the bottom-right BRIGHTER / ORIGINAL control, or start at
`http://127.0.0.1:5177/?visibility=off` for the original values. Switching while
paused draws a frame without resuming the walk or audio.

Distant mushroom, root and hub contours are clipped to the existing terrain
height when their geometry is built, so buried sections do not show through
unloaded ground. `npm run test:preview` checks crossings and the entire forest.

The entrance-mushroom lighting bake was removed after local evaluation: its
extra surface geometry and startup cost did not justify a whole-forest rollout.
