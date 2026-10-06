# Forest standalone

Objective: Keep only optimized Forest in this directory, remove other scenes and
camera settings/effects, add quiet music with 10-second overlapping loops, prepare
GitHub/Vercel project and launch a local server for verification.

Acceptance: Forest opens at / with compact velocity; WebGPU and WebGL work;
after filament spiral loading, enter walking immediately with WASD/arrow keys;
only Sound On/Off and Pause/Resume remain visible. No other scenes, DOF/lens
passes or settings panel. Quiet sond1.wav bed overlaps loops by 10 seconds;
eight mushroom recordings are assigned randomly but stably across all mushrooms,
grow louder nearby, and overlap loops by 5 seconds. Build and relevant checks
pass; deployment instructions included.

Completed: Copied source into empty target; simplified App; removed DOF/lens from
both effect pipelines; native compact mode is default; copied sound.wav.
Replaced basic loader with Canvas filament spiral and scattered light packets
arriving from above. Loader waits for generation, controller and first scene
frame, finishes filling then fades out. Removed startup title, captions, FPS,
and menu. Walking starts immediately; click requests pointer lock/audio, keyboard
works before mouse capture. Kept only bottom-right Sound and Pause/Resume.
Replaced music with supplied sond1.wav and reduced gain; its 10-second overlap
remains. Copied all eight m4a recordings into public/audio/mushroom-1..8.m4a:
1: 2026-01-03 14 28 59 - AS; 2: 2026-09-25 19 49 21 - AS;
3: 2026-10-04 13 47 41 - AS; 4: 2026-10-04 13 48 45 - AS;
5: 2025-04-21 18 18 46 - AS; 6: Jiangpu Road 9;
7: Jiangpu Road 13; 8: Jiangpu Road 17.
All 71 mushrooms have stable seeded random assignments. Distance gain is smooth,
HRTF provides direction, nearest source per recording and at most two recordings
are active together. Mushroom loops overlap by 5 seconds; common mute, pause and
disposal cover both layers.

Remaining: Native WebGPU/browser mouse capture verification, Jev review, and
make dependencies self-contained before GitHub/Vercel deployment. GitHub/Vercel
publication has not been performed.

Validation: Initial build exposed an unclosed JSX fragment, corrected. `npm run
build` passes. Vite dev server is running at http://127.0.0.1:5177/; the HTML
entry point and `/sound.wav` both return HTTP 200.
Loading validation: production build passes; Playwright desktop (1440x900) and
mobile (390x844) WebGL checks passed for static startup loader, scene loader,
transition to visible scene, entry, movement, pause, and worker failure reload
state. Screenshots and pixel checks confirm nonblank Forest. Native WebGPU is
not browser-verified in this environment (Chromium selected WebGL).
Current checks: latest production build passed; all eight audio files decoded in
Chromium; proximity gain increased (0.033 at 10m to 0.417 at 2m for a 12m test
range), sources stopped out of range, all loop schedules use duration minus 5s,
common mute and pause/resume passed, quiet bed and 10-second schedule preserved.
New files exactly match originals and server returns HTTP 200. Spiral desktop
and mobile screenshots/pixel checks passed; readiness-to-fade integration passed.
Actual scene test confirmed immediate walk, no other text, all arrows and WASD
before pointer lock, pause/resume, and mute. Full route test failed at headless
pointer lock; mouse capture is not confirmed by that test.

Latest change: expanded streamed regions around mushrooms when their cell is
loaded, so tall caps are not clipped by a small vertical patch or depth fade.
Nearby mushroom focus widens the depth-fade range while the player is beside a
large mushroom. The closest mushroom to the starting camera position is fixed
to track 6 (`Jiangpu Road 9`) and has a wider approach range so it is heard on
entry; other mushrooms keep stable randomized assignments.

Latest validation: `npm run build` passes. A headless browser check clicked
`Sound On`, waited for Forest readiness, and observed the loader disappear with
`data-mode="walk"` and the two bottom-right controls present. No native WebGPU
adapter is available in headless Chromium, so that path remains unverified.

Latest UI change: the public app name is now VESTIGE in the document title,
metadata, startup accessibility label, and package name. Startup Sound On is
text-only: it blinks before activation, then carries a repeating left-to-right
gold shimmer over the letters while scene and audio readiness are awaited.
The rectangular border/fill and fixed fill-completion gate were removed.
Jev loading review attempted, but stopped with git_command_failed before any
API review or configured checks. Parent Git repository has no HEAD commit;
flagged/uncertain/deferred/static-only coverage is unavailable, not passed.
Blockers: Global npm cache permissions; using source node_modules temporarily.
Next: Verify mouse capture/native WebGPU on the user's browser; make dependencies
self-contained and prepare deployment after source checks are available.

Latest loader validation: `npm run build` passes. Desktop/mobile browser checks
confirm no border/background, pre-click blinking, post-click text shimmer,
reduced-motion behavior, and gating on both audio and scene readiness. Real
headless WebGL entered `data-mode="walk"` with the loader removed, canvas visible,
and no page errors. Jev retry still failed before checks/API review because the
parent Git repository has no `HEAD` (`git_command_failed`); review coverage is
unavailable.

Deployment preparation: initialized a standalone `main` repository for
`HASHQIX/VESTIGE`, committed Vite deployment configuration and updated project
README, pinned Node.js 22, and replaced the inherited node_modules symlink with
dependencies installed from the lockfile. Production build passes. Jev deep
review ran its production-build check successfully; it reviewed 16 fragments,
reported zero flagged findings and 16 uncertain fragments, deferred 750, and
excluded 41 static-only files. Not a complete review. First commit was pushed to
GitHub; remote main matched `d6f110a8fa7fae98e2a991890d3448e001d2c779`.

Follow-up: independent investigation of Jev's uncertain App fragments found
that keyboard movement could resume walking behind the About dialog. Controller
input and the walk action are now gated while About is open. Build passes;
browser interaction check confirmed About pauses, arrow keys leave it paused,
and Escape closes About and resumes walking. Follow-up commit `0d8adbd` was
pushed to origin/main. Git working tree clean; remote main should be verified
against that commit.
