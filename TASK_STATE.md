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

Current local experiment: removed the supplied sky video, its two-decoder loop,
and the video asset. Replaced them with `ProceduralSkySilhouette` and a
deterministic instanced gold-particle panorama: a forest edge, layered mountain
profiles, a volcano ridge, and sparse smoke filaments. The panorama follows
camera translation, uses a native TSL material on WebGPU and a GLSL material on
WebGL, and fades in/out from the nearest mushroom distance (44m to 14m). The
effect is disabled with `?sky=off`; debug snapshot remains available with
`?debug=1`. The latest WebGL snapshot reports 11,526 particles, proximity 1,
and no page errors after 12 seconds of loading. `npm run build` and
`git diff --check` pass. No commit or push has been made for this experiment.

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

Current local optimization: replace the background WAV with a stereo 44.1 kHz
192 kbps MP3. Public asset is `public/sound.mp3` (6,777,879 bytes), down from
74,710,670 bytes by 90.93%. Original WAV moved intact to ignored
`audio-originals/sound.wav`; it matches the supplied sond1.wav. The user has
authorized committing and pushing this optimization to HASHQIX/VESTIGE main
with author email shumerhere@gmail.com. Vercel deployment remains unverified.

Validation: production build passes; dist contains MP3 and no WAV. Local server
returns MP3 with audio/mpeg and the expected size. Chromium decodes duration
282.352947845805 seconds, stereo, 44.1 kHz. Background gain remains 0.072,
spatial graph unchanged, schedule gap is duration minus 10s, and two loop sources
overlap. Mute/unmute and pause/resume checks pass. Real Forest loader dismisses
into walk, requests only /sound.mp3 for the bed, and reports no page errors.
Perceptual listening and cold-network timing comparisons remain unverified.

Jev quick review: production-build passed; 1 changed fragment reviewed,
0 flagged, 1 uncertain, 0 deferred, 3 files static-only (ignore file and audio
assets). Uncertain audio-path/task-context concerns investigated against loader,
asset presence, original comparison, decoded duration and browser playback/loop
tests; no additional confirmed issue. Classifier ledger still marks uncertain;
this is not a clean review. Local validation is complete; no further code
changes planned for this optimization. Vercel deployment status is not checked.

Current objective: Match the supplied VESTIGE startup typography and decorative
lines locally, retaining the existing plain black background. Acceptance:
centered two-line kicker, large thin gold serif name, horizontal/vertical lines
and circular contour, lower tagline, text-only blinking Sound On and post-click
shimmer. Preserve audio/scene readiness and transition into immediate walking.

Completed: Updated index.html and forest-loading.css. Self-hosted 6,344-byte
uppercase Cormorant Garamond Light subset with OFL license. Letter separation
uses layout gaps; mobile tagline wraps into two balanced lines. Background,
scene rendering, audio and loading controller remain unchanged.

Validation: Production build passes. Playwright screenshots inspected at
1440x900 and 390x844; 320x568 and 844x390 layouts also checked. Boundary widths
320 through 1920 show no offscreen text. Browser loaded the local font and all
40 CSS rules; text-only button, blinking, shimmer, reduced motion and readiness
gating passed. Real headless WebGL entered walk with the overlay removed,
1440x900 canvas visible and no JavaScript errors. Screenshot confirms visible
Forest. Native WebGPU remains unverified.

Jev: production-build passed; 1 HTML fragment reviewed, 0 flagged, 1 uncertain
(behavior/task/context). Investigated against unchanged loader selectors and
logic plus layout and real-entry browser checks; no confirmed defect found.
1 deferred CSS file due to AST parse error, manually investigated with browser
CSS rules/computed styles and screenshots. 2 static-only files (font/license).
Classifier review is incomplete, not a clean pass.

Remaining: User visual evaluation. No implementation blockers or required local
checks remain. Next action: inspect http://127.0.0.1:5177/. Current startup changes
are local only; no commit, push or deployment was requested for this change.

Follow-up layout: User requested upper kicker higher, tagline lower, and Sound On
near the bottom edge in matching serif. Loader content now spans the viewport;
the title stays centered, kicker sits at 8-9% from top, tagline at 13-14% from
bottom, Sound On at 4% with minimum/safe-area inset. Short landscape reserves
more space between tagline and button. Font subset expanded to include Sound On
lowercase (7,144 bytes); blinking and shimmer unchanged. Production build passes;
desktop/mobile/small/landscape browser checks confirm separation, visible bottom
button, matching serif, blinking, shimmer and ready-only removal. Local server
continues at port 5177. No further code changes planned before user evaluation.

Final requested typography adjustment: startup button now reads SOUND ON in
uppercase and uses the tagline color #bf9970. Existing serif, blinking and
post-click gold shimmer remain.

App controls and About typography: ABOUT, CLOSE, SOUND ON/OFF, PAUSE/RESUME now
use Vestige Serif and the same muted gold as the tagline. About body, lead and
title share the font/color family, with restrained type sizes for hierarchy.
Desktop and mobile browser checks confirm consistent computed font/color,
readable wrapping, no horizontal overflow, and no page errors. Mobile controls
are 13px after correcting a later legacy media rule that overrode their size.

Font issue investigation: initial self-hosted TTF was a tiny custom character
subset, so uncovered letters fell back to Georgia and made About look mixed.
Replaced it with the 21,908-byte full Latin Cormorant WOFF2 subset. Browser
confirmed it loads and covers the full About copy; screenshot shows consistent
letterforms. README now records the font and OFL attribution.

Tall mushroom visibility follow-up: near-mushroom focus no longer rejects the
camera for being below a mushroom's base. Its focus extent already includes the
vertical distance to the crown. Stream-region completion likewise includes an
overhead mushroom when horizontally nearby, even when its base is above the
current cell, baking region bounds through the cap. A targeted fixture with a
42m elevated stem confirms 64m focus reach from below and region extension to
65.8m. Production build and real scene entry pass after the change. Actual
in-situ view under the user's mushroom remains to be visually confirmed.

Latest Jev quick review: build check passed; 6 of 45 changed fragments reviewed,
0 flagged, 6 uncertain, 40 deferred (budget held), 4 static-only files; loader
CSS also remains a parser-deferred file from earlier pass. Sampled uncertainties
in UI styles were checked in desktop/mobile Chromium; mushroom stream/focus
functions received a focused elevated-mushroom fixture. No confirmed issue.
This review is incomplete. Local app is open at http://127.0.0.1:5177/; no
commit, push or deployment was requested.

Latest startup behavior: visual transition no longer waits for Sound On. Once the
scene is ready and the title reveal has finished, the dust sweep starts
automatically. Sound On remains visible during the reveal/particle composition,
but is no longer required to click; App attempts the entrance audio ramp after
the automatic transition and browser interaction can unlock it if autoplay is
blocked. Readiness and reduced-motion paths remain separate.

Current task: sequential startup exit. After the scene and six-second title
reveal are ready, a top-to-bottom sweep erases the DOM content into drifting
gold dust. Preserve intact lower text until the sweep reaches it. After dust
clears, start a 2.2-second audio entrance ramp and fade the black overlay into
the prepared Forest; enable walking/controls after overlay removal. Reduced
motion uses a short fade. Implementation and local verification are complete;
audio readiness does not block the automatic visual transition.

Startup reveal: VESTIGE now fades from transparent/18px blur into crisp letters
over 4.8 seconds on page open/reload. CSS animation does not gate scene generation
or audio readiness; Sound On behavior is preserved. Reduced-motion preference
shows the title immediately. Browser sampling confirms progressive opacity/blur,
clear final state and restart on reload. No animation JavaScript added.

Reveal refinement: user requested much stronger blur as the main effect. Updated
to 6 seconds: opacity reaches 1 in the first 720ms while blur remains 56px,
then blur gradually resolves through 40px, 22px and 8px to sharp letters.

Sound label refinement: matches the tagline font size (16px desktop, 13px tablet,
12px mobile/short landscape). Before click the letters use subtle varied warm
gold shades, preserving the blinking prompt. Post-click shimmer remains. Browser
checks confirm matching sizes and blink at desktop/mobile widths.

Lines/orbit reveal: horizontal and vertical lines grow from the center; SVG circle
draws its contour using normalized dashoffset. All use the same 6-second duration
as VESTIGE. User clarification: lines/orbit must have no animated blur or opacity;
only title has blur/fade. Removed these from line/orbit keyframes; endpoint glints
appear when the contour completes. Reduced motion shows full geometry instantly.

Validation: build passed; desktop/mobile samples and screenshots show growing
sharp lines and partial sharp circle (opacity 1, filter none) while title is
blurred. At six seconds transforms/dashoffset reach completion. Reduced motion
and sound/scene gating passed. Jev recheck: 0 flagged, 1 uncertain HTML fragment,
1 deferred CSS parser blocker, 4 static-only files; investigated against loader
selectors, SVG rendering and browser checks, no confirmed defect. Review remains
incomplete. Changes local only; user visual evaluation is next.

Automatic startup validation (2026-10-07): isolated normal/reduced-motion tests
confirmed no transition before scene readiness and automatic reveal/completion
without clicking Sound On. Real Chromium WebGL entered walk without a click;
screenshot confirms visible Forest, and no JavaScript errors occurred. During
dust audio stays inactive at zero entrance gain; during the background fade it
ramps from silence to full entrance gain over 2.2 seconds. Browser autoplay
policy may defer sound until the first interaction, without delaying the scene.
Escape shows centered gold serif CONTINUE; clicking it resumes walking, and it
stays hidden over About. Production build and git diff --check passed.

Final bounded Jev recheck: production-build passed; 61 changed chunks,
4 newly reviewed and 11 cached, 0 flagged, 15 uncertain, 47 deferred including
the loader CSS parser blocker, and 4 static-only files (README, this state file,
font and license). The 20-request pass budget is exhausted. Uncertain loader,
App and audio fragments were investigated against complete source/callers and
readiness, no-click, audio-ramp, pause and reduced-motion tests; no confirmed
defect. CSS was inspected manually and in browser screenshots. Classifier
coverage remains incomplete; this is not a clean review. Native WebGPU and the
exact in-situ tall-mushroom view remain unverified. Local changes are uncommitted.
Next action: user visual evaluation at http://127.0.0.1:5177/.

Current follow-up: show only the central title and drawing geometry initially.
After their six-second reveal, fade/resolve the kicker, tagline and SOUND ON
from blur over 2.4 seconds. Automatic dust exit must wait for this second phase
and scene readiness; reduced motion shows all text immediately. Implementation
updated in loader CSS and readiness event; browser validation pending.

Follow-up completed: desktop/mobile controlled animation samples confirm
kicker/tagline/SOUND ON opacity 0 and visibility hidden through the first six
seconds, then blur/opacity reveal together after the title is sharp. Dust waits
until that reveal finishes. Normal/reduced-motion no-click completion tests
passed; optional sound unlock/shimmer preserves the copy reveal. Real WebGL
entered walk automatically with no page errors. Production build and
git diff --check passed. One initial timing-dependent browser assertion missed
the animation window under load; controlled Web Animations sampling verified
the sequence without that race. A real-world test initially hit Playwright's
default 30s timeout; corrected explicit 90s timeout completed successfully.
Screenshots inspected at desktop/mobile widths. Local server remains on 5177.

Follow-up Jev quick review: production-build passed, 6 reviewed chunks,
0 flagged, 6 uncertain, 56 deferred (including CSS parser blocker), 4 static-only
files. All six uncertain App/loader locations were investigated against full
source, CSS timing, scene readiness and browser checks; no confirmed issue.
49 omitted attention entries are deferred; no extra flagged/uncertain entries
were omitted. Review remains partial; excluded font/license/documentation are
not API-reviewed. No publication performed. Next: user visual evaluation.

Current follow-up: keep all startup text fully revealed for four seconds after
the slogans' copy-reveal animation ends before allowing automatic dust exit.
Scene readiness remains required. Reduced motion also gets four seconds of
readable text before its short fade. Timer is started only once. Browser checks
passed for normal/reduced motion, repeated reveal events and late scene
readiness. Production build and git diff --check passed. An initial fake-clock
boundary check was timing-sensitive; real-timer checks confirmed the hold.

Jev reviewed the one changed source fragment: 0 flagged, 1 uncertain, 0 deferred,
1 static-only file (this state document). Build check passed. The uncertain
behavior/side-effect/context questions were investigated against the complete
loader, its animation event, scene-ready gate and browser checks; no confirmed
defect. Classifier uncertainty remains, so this is not a clean review.
User authorized commit/push of this change; author Toli <shumerhere@gmail.com>.

Current objective: local procedural sky-silhouette experiment. The supplied video
prototype and its generated `public/video/vestige-sky-muted.mp4` asset have been
removed. The replacement is a deterministic upper-hemisphere panorama of gold
instanced sprites shaped as forest, layered mountains, a volcano, and sparse
smoke filaments. Its WebGL shader and native WebGPU TSL material share the same
geometry; `sky=off` offers a local comparison. Proximity to any mushroom fades
the panorama between 44m and 14m. Do not publish this experiment before visual
approval.
About author and X credit changes remain local, awaiting their authorized push.

Latest sky revision: removed the procedural mountain particle field entirely.
The distant layer now consists of continuous circular volcanic and low-ridge
contour lines, with animated dashed glow passing along both contours. Added 144
sparse stars in three subtly pulsing sizes and five lightweight meteor trails
that move and fade. This sky is always lit during the active Forest walk instead
of fading by mushroom distance. Build passes; no commit or push requested.

Visibility fix: the distant contour, star, and meteor materials now bypass the
Forest fog, which had been fading the entire sky layer to black at its 218m
radius. Star sizes were increased slightly for reliable visibility.

Latest direction: removed both volcanic contour layers and all meteor trails
after visual review. The distant layer is now only a larger, denser star field:
190 stars in three fixed pixel sizes with restrained independent pulsing. Build
and diff checks pass; local visual review remains next.

Star visibility pass: increased the field to 306 stars, enlarged all three star
groups, raised their gold opacity, and reduced pulse variation so they remain
clearly visible. Build and diff checks pass.

Current local update: removed the in-world SOUND ON/OFF button, mute state and
mute method. Startup SOUND ON still unlocks browser audio; pause/resume and
hidden-tab audio suspension remain. Star sizes doubled from 4/7/10 to 8/14/20.
User confirmed the apparent dimness came from monitor brightness; no further
star shader changes were made. Production build and diff checks passed. Real
WebGL browser entered walk without errors, showed only PAUSE in journey controls,
and passed pause/CONTINUE/resume checks. Jev sampled 6 of 10 fragments, flagged 2
audio fragments and marked all 6 uncertain; 4 deferred, no static-only exclusions.
Flags/uncertainties inspected against full audio/App source and callers: removed
mute branches are intentionally always audible while active, with pause guarded
by active/context checks; no additional confirmed defect. Review is partial.
User authorized committing and pushing this update to origin/main as
Anatoli Shumer <shumerhere@gmail.com>. Production build and diff checks passed
again before publication. No further star visibility changes were requested.

## CPU optimization, stage 1 (local)

Objective: reduce repeated native WebGPU scene/material bookkeeping without
changing rendering settings. User requests one stage at a time, with a manual
local check before proceeding to any later stage.
Acceptance: discover graph materials only initially/on matterRevision changes;
sync current uniforms once per frame, including preview gain/resolution before
its render; preserve streamed additions/removals, pause/resume and image settings.
Completed: split graph discovery from uniform sync in ForestWebGPU. Discovery
runs at initialization/on matterRevision changes. Preview gain/resolution are
prepared before the single per-frame sync. No rendering/audio settings changed.
Validation: Jev production-build and git diff --check passed. Native WebGPU
Playwright (Metal enabled in headless Chromium, 1000x650) entered walk without
errors. Runtime-only instrumentation: baseline 1,325 discoveries/662 frames;
optimized 3/680 frames, 5,188 uniform syncs vs baseline 10,085. Existing profiler
materials block mean: 0.0292 ms baseline, 0.0088 ms optimized. This is a small
isolated CPU cost, not evidence of a large overall CPU/FPS/temperature gain;
baseline's second sync is outside that profiler block. Diagnostic JSON/screenshots
are in /tmp/vestige-stage1-{baseline,optimized}.json and stage1-native.png.
Native movement test traveled 34.6 units via W/ArrowRight, loaded 6 patches,
evicted 2, ended with 4 cached/2 visible patches and no pending builds/errors;
GPU history probe finite with 32 valid samples. Pause/CONTINUE/resume and resize
passed. Bloom remains screen/one-third scale and filament density preserved.
Jev: 4/4 eligible fragments reviewed, 0 flagged, 4 uncertain, 0 deferred;
TASK_STATE.md is the sole static-only exclusion. Investigated all four fragments
against full component, nodeMaterial initial sync, streaming refresh/add/remove
callers and runtime tests: streaming completes mutations and increments revision
in one synchronous callback; cached graphs still sync every frame; preview
uniform writes are before sync and no later source writes occur before its draw;
dispose listeners/cache cleanup remain intact. No confirmed defect; model ledger
retains uncertainty, so this is not a clean/complete Jev verdict.
Remaining: user visual/load review at http://127.0.0.1:5177/. Stop here until the
user replies; do not start stage 2 or publish stage 1. Changes are local only.

## Intro click captures camera (local)

Objective: one click anywhere on the greeting, including during loading,
prepares audio and captures the pointer; after the automatic intro, camera
control works without another click. Do not start CPU optimization stage 2
or publish these changes before the user's local check.
Completed: loader requests lock on persistent #root synchronously from click,
accepts clicks through dust/fade, and removes its listener on dismissal.
Controller uses that root and adopts an existing lock even if captured before
React/canvas initialization. Mouse rotation is gated to enabled walk mode;
App's lock callback uses the existing guarded walk action, preserving intro.
Audio activation is shared with the anywhere click; failed/unsupported lock
keeps audio/automatic entry functional. Error reload remains independent.
Validation: production build and diff check passed. Runtime browser checks
and Jev investigation are in progress.
Next action: verify early capture, transition, ESC/CONTINUE, SOUND ON,
no-click entry and rejection fallback; then user checks localhost:5177.

Intro capture update: user verified actual mouse capture and entry locally,
reported everything works, and explicitly requested no further capture tests.
Stopped browser investigation. Automated native-lock attempt was rejected by
Chromium with 'root document ... not valid for pointer lock', also reproduced
in isolated minimal pages; do not claim an automated native pointer-lock pass.
User's actual browser check confirms the requested interaction. Build/diff checks
passed. Next proposed CPU stage: reduce spatial-audio proximity/AudioParam updates
currently done every animation frame; implementation awaits agreed next-stage
scope. No stage 2 changes made; no commit/push requested.

Jev follow-up: production-build passed; 6/14 changed fragments reviewed,
0 flagged, 6 uncertain, 8 deferred, 1 static-only exclusion (TASK_STATE.md).
Both omitted attention entries are deferred. Investigated all reviewed uncertain
fragments against full App/loader/controller source, installed Three control
constructor/event behavior, cached audio prepare/load guards and stage-1 graph
sync source. Persistent root remains connected; constructor's initially false
isLocked is explicitly adopted; enabled gating and guarded App walk preserve
intro and About; document listener is removed before overlay removal/completion;
failed load exits activation early; audio loads are cached and guarded against
duplicate assignment. Stage-1 invariants were already runtime-verified. No
confirmed additional defect. Review remains partial and model uncertainties
remain; do not describe it as clean or complete. User capture check is the actual
interaction validation; automated native pointer lock remains unverified.
Ready for user's first-stage load/image check. No stage 2 implementation or
publication performed. Local server responds HTTP 200 on 5177.

## CPU optimization, stage 2 (local, active)

User authorized continuing to stage 2 after confirming intro capture. Objective:
reduce per-frame mushroom proximity/source updates without changing visuals or
listener direction responsiveness. Acceptance: cap mushroom voice calculations
at 20 Hz, preserve existing smooth gain/panner transitions and overlapping loops,
recalculate immediately after resume or mushroom reassignment. Keep listener
pose updates at frame cadence. Compare before/after CPU work and behavior; leave
local server ready and wait for user evaluation before stage 3 or publication.
Baseline source saved at /tmp/vestige-stage2-audio-before.ts. Implementation and
validation pending. Next: implement bounded proximity throttle and validate.

Stage 2 implemented in src/audio.ts only: mushroom/source calculations gated by
AudioContext.currentTime at a maximum 20 Hz. Listener pose and master ramp stay
at frame cadence; existing 0.35s gain smoothing, 0.2s source-position smoothing,
source selection, 5s mushroom/10s bed overlaps and audio settings preserved.
Reset gate on inactive-to-active start/setActive and mushroom reassignment.
Validation: build/diff passed. Deterministic 71-mushroom, 15s/120Hz moving-route
comparison performs 289 proximity updates vs 1800; voice identity/distance/level
match baseline exactly at each processed sample, at most 2 selected voices,
resume/reassignment refresh at unchanged audio clock. Listener updates equal
through the measured route (the optimized test also makes 2 reset probes).
Instant target differences during track switching can reach 0.34; real Web Audio
OfflineAudioContext test of 8 automated gain envelopes verifies smooth samples
(max step 0.0000454 at 48kHz). Max baseline/optimized envelope difference 0.0414,
mean 0.00127; not proof of perceptual equivalence, user listening required.
Native WebGPU 1000x650, same W/ArrowRight route for 12s: baseline 718 update calls,
718 proximity calculations, audio CPU 1.7148ms/s; optimized 719 calls,
209 proximity calculations, audio CPU 0.9493ms/s (about 45% lower in that isolated
block; about 0.77ms/s saved, not a claim of large overall CPU reduction).
Both loaded all recordings, had nonzero RMS, at most two audible selected voices,
and passed pause/suspended/resume/running checks with no page errors. No further
mouse capture checks were run. Artifacts: /tmp/vestige-stage2-{baseline,optimized,
behavior,envelope}.json, /tmp/vestige-stage2-native.png; temporary scripts under
/tmp only. Existing baseline/current native-renderer visual/audio settings held
constant; no visual source changes in this stage. Jev review pending.

Stage 2 Jev: initial quick page plus one bounded continuation reviewed 12/19
fragments (continuation 6 new + 6 cached), 0 flagged, 12 uncertain, 7 deferred;
TASK_STATE.md is sole static-only exclusion. Summary omissions inspected in
checkpoint, including all 4 changed WorldAudio fragments. Constant fragment
PROXIMITY_INTERVAL is deferred and inspected manually (1/20 seconds).
Investigated uncertainties against complete audio/controller/App/loader sources,
existing control event contracts and earlier stage-1 validation. Audio time is
monotonic within the graph, frozen pause clock reset by start/setActive;
setMushrooms resets assignment immediately; running/active guards remain before
listener/voice updates; listener/master remain before throttle return. Existing
gain/panner smoothing and loop scheduler continue independently of proximity
sampling (no timer/catch-up loop introduced). Real offline envelopes and native
route/reset tests substantiate partial-update behavior. Earlier controller,
App, loader and graph uncertainties remain investigated as documented above;
no new confirmed defect. Model uncertainty remains; review is partial, not clean.
Final validation: configured production-build passed; no stage-2 image settings
changed. Stage 2 ready locally; user should reload http://127.0.0.1:5177/ to create
the new audio instance, walk among mushrooms and listen to approach/retreat and
turn responsiveness. Stop now for user check before stage 3. No commit/push.

## Next optimization analysis (2026-10-07, no implementation)

User asks for discussion of substantial load reduction without visible degradation.
Read-only native WebGPU CPU sampling on localhost:5177, 1000x650, 10s stationary
then 10s KeyW route; no pointer capture tests. Profiles/snapshots saved in
/tmp/vestige-next-{idle,moving}-{cpu,snapshot}.json; temporary script
/tmp/vestige-next-cpu-profile.mjs. No page errors. Main-thread inclusive samples:
idle total10154ms, non-idle1364ms, player physics86ms, renderer559ms;
moving total10043ms, non-idle1271ms, WorldGuideAtlas260ms, player physics83ms,
renderer418ms. Sampling is approximate, includes instrumentation/debug/browser
work; not GPU timings or whole-browser CPU usage. Atlas ~20% of moving main-thread
non-idle time, ~26ms/s; not a guaranteed total load improvement.
WorldGuideAtlas.select already skips until 4m movement / .2rad view turn / pending
retry, but when triggered scans 5 samples of every guide, allocates records and
sorts entire source before radius filtering. Recommended next CPU stage: bounded
spatial candidate lookup / filtering before ranking, preserving exact selected
IDs/order, no fewer visible particles, stable slots and 3.1s lifetime guard.
Spatial acceleration exists already for collision SDF (7m grid) and support (2m
grid), so don't present those as absent. Grounded idle physics exact cache/fast
path is secondary. Larger potential render/GPU stage: auxiliary passes and flow
shader efficiency, but no valid GPU timings yet; don't promise large wins or
unchanged visuals without matched captures. Bloom already1/3 resolution;
temporal internal targets already75%. No new coding, build, Jev, commit/push.
Await explicit stage-3 implementation request; keep stage-by-stage user check.

## CPU optimization stage 3 (2026-10-07, local)

Authorized: optimize light guide selection, preserving exact selected guides/order,
particle counts, visual settings, stable GPU slots and lifetime safety. Complete
one stage only; user evaluates localhost before further optimizations/publication.
Acceptance: compare old/new selection and full slot state on deterministic routes,
turns, source replacements, retries, clock reset, empty/fallback/boundary cases;
measure selection CPU on same captured world inputs and native movement route;
production build, diff check and bounded Jev with signal investigation.
Baseline saved /tmp/vestige-stage3-atlas-before.ts. No commit/push authorization.
Next: implement bounded candidate index with identical ranking/fallback behavior.

Stage 3 implemented in WorldGuideAtlas only for runtime: lazily build a 32m-cell
3D index of the same five ranking samples per guide. Query cells intersecting the
original 65m/32m radius, deduplicate rows, rank with the unchanged visibility and
distance calculation, filter before sorting, and explicitly break ties by source
row to preserve stable source order. Empty shortlist uses a full-scan minimum
with the original ranking; source replacement invalidates index. Existing gates,
slot ownership, 3.1s lifetime protection, pending retries and clock-reset rules
unchanged. Added npm test:guides and Jev deterministic regression check.
Validation: 1096 old/new state comparisons (including full data, slots, indices,
lastUsed, pending, result) on movement/turns/clock reset/replacements, empty,
zero-capacity, ties and cutoff cases matched exactly. Persistent regression test
matches independent full-scan oracle in 97 cases and covers replacement/lifetime/
retry/reset. Production build and regression checks passed (Jev stage0 twice).
Real captured 21944-guide dataset, 80 queries, 64 actual selections, 5 alternating
runs: median old770.185ms vs new331.816ms, 56.9% reduction including lazy index
build. First query index cost15-22ms vs old11-13ms; extra one-time work amortized
across selections, not a guarantee of fewer hitches for every source update.
Native WebGPU 16s W/ArrowRight route: old960calls/37selections/397.7ms;
new953calls/32selections/260ms; no page errors, 8192 particles and64 history/render
samples preserved. Independent runs differ in source replacement timing; use
matched-input benchmark for improvement claim. Optimized screenshot inspected:
scene, glow and trails present. Files /tmp/vestige-stage3-{baseline,optimized}-
{runtime.json,native.png}, source.{bin,json}, equivalence.json, benchmark.json.

Jev deep + bounded continuation: 26/47 final eligible fragments covered (16 new,
10 cached in second pass); 0 flagged,26 uncertain,21 deferred,2 static-only files
(.jev/project.json and TASK_STATE.md). All3 changed WorldGuideAtlas chunks were
reviewed; constants/type/comparator deferred and inspected manually. Model
uncertainties independently investigated using full class, immutable guide-source
replacement caller, streaming source generation, complete regression/oracle and
1096 reference comparisons. Culling uses exact indexed samples; every eligible
sample's cell intersects query sphere; ranking still checks all5 samples;
source-order ties explicit; index changes only after replacement; slot lifetime
state demonstrated unchanged. Covered test uncertainties refer to isolated
imports/assertions lacking fixture context; investigated complete script and
passing runner. Prior loader/App/controller/audio/WebGPU uncertainties verified
against full relevant source and earlier documented runtime tests (no additional
pointer capture tests). No confirmed defect; advisory coverage remains partial.
Reports /tmp/vestige-stage3-jev{,-continued}.json; checkpoint same repository.
Additional paired native oracle/timing validation in progress. No commit/push.

Stage 3 final paired native validation: baseline and optimized atlases evaluated
side by side on identical live source replacements, positions, directions and
clocks during one WebGPU launch. 1742 calls compared (including intro), zero
result/selected/owner/lastUsed/pending mismatches; no page errors. Measured16s
route959calls/33selections: old358.8ms vs new258.5ms (28.0% reduction for this CPU
block, ~6.3ms CPU/s saved; not whole-app CPU/GPU reduction). First/build costs
included in select. Particle/history/render counts8192/64/64 unchanged.
/tmp/vestige-stage3-paired-runtime.json and paired-native.png are final matched
runtime evidence; /tmp/vestige-stage3-paired.mjs is temporary instrumentation,
not shipped. Invalid earlier test harness data-URL relative import was corrected;
no app source fix needed. Local serverHTTP200 at5177, app files contain new atlas.
Completion: stage3 implementation, equivalence, CPU measurements, regression,
production build and advisory signal investigation done. Pause further stages
for user's local walkthrough/image assessment. Next: user reloads5177 and checks
movement, particles/trails and perceived performance. No commit/push performed.

## Shader optimization stage 4 (2026-10-07, local, active)

Authorized: skip light-effect calculations that cannot affect output. One stage
only, preserve graphic settings/sample counts/density; no publication. Shader
changes must match both WebGL GLSL and native WebGPU TSL factories. Acceptance:
matched old/new GPU output on synthetic boundary/history/motion inputs and live
scene inputs, native timing on identical workload, fallback compile/runtime,
build and guide regression, bounded Jev and signal investigation. Baselines
saved /tmp/vestige-stage4-{MatterCameraPass.ts,matter0.js,matter1.js,matter2.js}.
Next: branch flow sampling on valid surfaces and feedback neighborhood on valid
history; verify actual shaders rather than animation screenshots.

Stage 4 implemented: GLSL MatterCameraPass and native generated matter0/1/2
shaderMain now guard flow sampling with the existing valid-surface condition;
flowSmear also guards with the original flowLength cutoff. Feedback keeps current
color until history passes the unchanged validity test, then executes unchanged
3x3 bounding and accumulation. Final HDR clamp/depth and motion output expression
preserved. No helper math, sample counts, resolutions, particles, settings,
bloom, physics or intro changes. Generated factories patched directly because
standalone repository has no generator; native depth/Y adaptations preserved.

GPU equivalence: temporary /tmp/vestige-stage4-gpu.mjs compiled/rendered old and
new versions on identical float textures in native WebGPU and WebGL. 54 pass/case
comparisons (9 inputs x3 passes x2 backends), all half-float output values identical
and finite. Cases: empty, dense, sparse, exact .05/near thresholds, offscreen
reprojection, guard boundary, zero history, depth reconstruction, disabled flow.
Reports /tmp/vestige-stage4-{webgpu,webgl}-gpu.json.
Native scene validation /tmp/vestige-stage4-live.mjs froze actual scene inputs
for all3 temporal passes on stationary and moving captures (1000x650 viewport;
750x488 first2 pass targets). Old/new renders per pass matched exactly in all6
comparisons, no nonfinite output or console/page errors. Measured GPU timestamps
with one draw per resolve, alternating old/new, 4warmup rounds then26 samples,
without changing shader inputs. Stationary medians (ms): flow1.890346->1.758515,
feedback.056707->.052499, motion.188705->.180623; summed2.135758->1.991637
(6.75%, .144121ms). Moving medians:1.494102->1.427186, .058707->.055208,
.217537->.199164; summed1.770346->1.681558 (5.02%, .088788ms). Sum of per-pass
medians is an isolated estimate, not total frame time/CPU reduction. Synthetic
dense flow case regressed ~2.35%; benefit depends on scene composition and GPU.
Three timestamp pool source checked: resolve returns last recorded frame sum;
our single-draw samples avoid misattribution from app-level profiler batches.
Runtime harness had two polling timeouts because its own rAF freeze prevented
Playwright's default rAF poll; corrected to50ms polling, not an app error.
Fallback WebGL full intro and3s walking completed with no errors. Native/fallback
screenshots inspected: forest/glow/trails present; fallback has existing square
point appearance (sky rendering not modified in this stage). Artifacts
/tmp/vestige-stage4-{stationary,moving,webgl}-live.{json,png}.

Jev bounded deep + continuation20 + final bounded8:36/50 final eligible fragments
covered,1 flagged,36 uncertain,14 deferred,5 static-only files (.jev config,
TASK_STATE,3generated factories). Production build and guide regression passed
in each pass; git diff --check passed. Reports /tmp/vestige-stage4-jev{,-continued,
-last}.json. Flag in preexisting ForestWebGPU cache part2 (88-105) investigated:
streaming refresh increments matterRevision after presentation/add/remove,
refreshMaterials discovers/removes graphs and velocity sources before rendering;
syncMaterials still updates every cached graph every frame. Preview gain and
resolution now set before that sync. Read full render class, forestStreaming
refresh/updateReveal, forest add/remove, NodeMaterials bindings, ForestEffects,
and earlier paired runtime evidence; no confirmed regression. Other uncertain
locations investigated against full loader/App/controller/audio/atlas/test code:
listener remains per-frame, proximity uses context clock and reset on reactivation/
mushroom replacement; sources update streaming revision; oracle and lifetime
fixtures independently verify guide selection. Prior mouse capture user-verified,
not tested again. Current GLSL constants remain deferred by API, native factories
excluded; all4 edited shader files manually inspected and GPU-tested. Advisory
review coverage is partial, not a clean/complete review. No confirmed defect.

Completion: authorized stage4 implementation, matched GPU outputs, native timing,
fallback smoke, build/regression and advisory investigation done. Local server
HTTP200 at5177. No commit/push. Stop further optimization for user's local
visual/load assessment. Next action: user reloads http://127.0.0.1:5177/ and checks
light appearance and movement before authorizing another stage.

## Additional mushroom audio (2026-10-07, local, active)

Authorized: add11 user-supplied Downloads/s001.mp3 through s009.mp3, s0010.mp3
and s0011.mp3 alongside existing8 mushroom tracks. Distribute recordings across
mushrooms in mixed random order with coverage for every track. Preserve first
mushroom Jiangpu Road9 (index5), background bed, proximity gain, two audible
voices and5second overlapping loops. No publication or next optimization stage.
Acceptance: copied assets match originals, all19 tracks decode over localhost;
world assignment covers all with first-mushroom override; approach old/new sound
mushrooms and verify playback/proximity. Production build and bounded review.
All11 sources exist, stereo48kHz MP3,12.6-18.8s; copied unchanged to public/audio.
Next: expand catalog, balanced seeded shuffle distribution, local validation.

Additional audio completed locally: catalog now19 mushroom recordings. Forest
assignment draws seeded Fisher-Yates shuffled batches of all18 non-start tracks,
refilling after each complete set; first mushroom id56 keeps Jiangpu Road9 index5.
Runtime scene71 mushrooms uses every track; counts4 for most,3 for new tracks
indices8 and10,1 reserved start. All11 copied originals match byte-for-byte and
HTTP-served bytes; total new3,710,179bytes. Existing scheduling/proximity/background
code unchanged. /tmp/vestige-audio19-check.mjs and .json: all19 decoded and played
in live native WebGPU application, near/mid/far levels.45/.225/0, far voice stops,
new MP3 loop has5s overlap with2simultaneous sources. Complete18-track batches
unique; no page errors/request failures; first override and all-track coverage
asserted. No pointer capture tests. Production build and guide regression passed
through Jev stage0; git diff check passed. No commit/push.
Jev quick bounded8:6/55 eligible covered,0 flagged,6 uncertain investigated using
full controller/App/audio/render source and prior matched runtime evidence,
49 deferred,16 static-only (.jev config,state,3generated factories,11MP3 files).
New catalog/assignment API coverage deferred; manually inspected deterministic
shuffle bounds, refill, exclusion of5, stable seed and nonempty18track pool,
plus real-world coverage/playback assertions. No confirmed defect; advisory
coverage partial, not complete. /tmp/vestige-audio19-jev.json.

User follow-up audio size audit (read-only, no compression authorized): current
20 audio assets total15,804,802bytes. Background sound.mp3 largest6,777,879bytes,
282.4s,192kbps stereo44.1kHz. Existing8mushroom AAC files total5,316,744bytes,
individual0.35-1.19MB, mostly63-66kbps mono (mushroom7 ~82kbps). New11MP3 total
3,710,179bytes,individual.27-.44MB,12.6-18.8s,stereo48kHz variable129-186kbps
(audio-stream rates; file rates include attached artwork). Recommend first
listening-test background128kbps ~4.52MB or96kbps ~3.39MB; old mushroom files
already low bitrate. Compression not performed. Local server5177 remainsready.

## Background audio 128 kbps (2026-10-07, local)

Authorized: reduce background from192 to128kbps. User additionally requested
128 for eight old mushroom recordings; these are already~64kbps AAC, so
conversion would increase size and add lossy transcoding. Asked whether to keep
these, convert anyway, or try48kbps. Pending answer; no mushroom assets changed.
Background encoded directly from ignored audio-originals/sound.wav, verified
identical to supplied Documents/sond1.wav. Prior192kbps MP3 backed up at ignored
audio-originals/sound-192kbps.mp3. New public/sound.mp3 is4,518,600bytes versus
6,777,879bytes,33.33% reduction. MP3 stereo44.1kHz128000bps, duration282.352948s
unchanged. Full ffmpeg decode passed; localhost returns identical bytes.
Production build passed with existing Three import/chunk warnings. Browser
playback check pending. Asset-only change; no new substantive code requiring
Jev. No commit/push.
Browser validation completed: /tmp/vestige-background128-check.mjs and .json.
Actual native WebGPU app entered walking automatically, bed decoded stereo
282.3529478s and played with running context, gain.072, fade10 and expected
next-loop time; no page errors. No pointer-capture test. User listening remains
the quality acceptance step at http://127.0.0.1:5177/. Await mushroom choice.
User resolved mushroom choice: keep eight original sounds unchanged. Completed
authorized scope: only background compressed to128kbps; all19 mushroom tracks
unchanged. Build, full decode, local HTTP bytes and native browser playback
verified. Stop for user listening; no commit/push or further optimization.

## Publication batch (2026-10-07)

User explicitly authorized commit and push of all current changes to origin/main
HASHQIX/VESTIGE as Anatoli Shumer <shumerhere@gmail.com>. Batch includes material
cache,20Hz audio proximity, exact guide grid + regression, shader guards on both
backends, intro pointer capture,11 added recordings + balanced assignment,
background128kbps and supporting checks/state. Old8 recordings unchanged.
Pre-publication: fetched origin/main, HEAD matched remote; production build and
97 guide-oracle cases plus lifetime/replacement/retry/reset checks passed; diff
whitespace check clean. Reviewed prior partial Jev reports and documented
investigations; no substantive code changed since those reviews. Background
and new audio browser validations available. Audio originals/backups, dist,
node_modules and temporary harnesses stay ignored/outside repo. Next operation:
commit authorized batch, normal push, verify remote commit and clean worktree.

## Bloom investigation and optimization stage5 (2026-10-07, active/local)

Authorized: compare identical scene with screen bloom enabled versus all bloom
passes skipped; optimize if measurable benefit while preserving perceived glow.
Do not change filament density, exposure, temporal settings, sound or input.
No publication authorized in this stage. Acceptance: frozen live inputs and
valid per-submission GPU timestamps, draw counts proving OFF bypass, screenshots
and numeric quality comparison for any proposed optimization, native/fallback
smoke and build/guide regression + shared Jev when substantive code changes.
Prior app-level gpu profiler sums stale timestamp entries across frame batches:
its old absolute numbers are unsuitable to estimate bloom share. Native bloom
uses scale1/3,5mips and12 effect draws plus output; blur taps already bilinear
paired upstream. Next: temporary browser-only instrumented benchmark.

Stage5 investigation completed locally; application source unchanged. Compared
stock screen bloom ON, fully bypassed OFF (only output draw), scales.25/.30,
and an experimental fused mip composite/output. All changes injected through
temporary Playwright routing, not written into application or dependencies.
Native Chromium Metal/WebGPU,1200x800; frozen stationary and walking captures,
same camera/geometry/materials/textures and temporal histories restored before
every full render. Draw assertions:13 ON,1 OFF,12 fused. No pointer-lock test.
Screenshots inspected /tmp/vestige-bloom-fused-contact.png: OFF visibly removes
soft halos; fused matches stock perceptually. Fused numeric RMSE~.000054-.000058,
zero RGB channels differ by more than1/255. No browser page/console errors.

Important timing limitation: summed timestamp entries for full frames exceeded
queue-completed wall time (e.g.90ms vs8.9ms). They are invalid absolute costs
and cannot establish bloom's percentage of GPU work; do not cite those sums or
the isolated multi-draw sums as reliable milliseconds. Resolution experiments
did not establish an acceleration with reliable full-render wall measurements.
Repeated full-render comparison WITHOUT timestamp tracking/profiler, alternating
variant order,8warmup then56samples each per captured scene; waits for device
queue completion, including final output, with history restoration flushed and
excluded. /tmp/vestige-bloom-wall-check.mjs, -stationary.json, -moving.json.
Stationary wall median ON9.4ms / OFF9.1ms / fused9.4ms; means9.5/9.030/9.4.
Walking-capture wall median ON7.1ms / OFF6.8ms / fused7.1ms; means7.166/6.768/7.104.
Full-render CPU submission means stationary.845/.557/.834ms, walking.850/.582/
.838ms. OFF wall median improvement~3-4%; fused median improvement0, mean<~1.1%.
These are controlled headless submission-to-queue-completion comparisons, not
interactive FPS, CPU utilization, energy measurements or guarantees for other
devices/backends. Live continuous movement/higher resolutions/WebGL were not
benchmarked in this stage. Bloom is not established as the main bottleneck here.

Decision: keep current stock bloom (already1/3resolution, paired blur samples).
Do not ship lower-resolution or private-internals fused helper without a useful
stable gain. No substantive application change, so new build/regression/Jev and
fallback smoke are unnecessary for this investigation; prior code validations
remain applicable. Only TASK_STATE.md changed. Server5177 HTTP200 verified.
Acceptance fulfilled: investigate and optimize conditionally; no useful variant
accepted. No commit/push/deployment. Stop this stage for user review. Further
optimization requires a separately agreed stage; next candidate is whole-frame
workload profiling, not further bloom quality reduction.

## Light workload stage6 (2026-10-07, active/local)

Authorized: measure separate filaments, moving tracer layer and temporal flow
work on frozen identical stationary/moving scenes; select one meaningful quality-
preserving optimization, validate locally, stop for user assessment. No publish.
Preserve density/exposure/sound/input and existing graphics. No pointer-lock test.
Next: isolated queue-completed native pass timing without timestamp tracking;
compare scene draws with individual layers omitted and each temporal shader.
After substantive changes run build/guides, paired GPU equivalence and shared Jev.

Stage6 completed as measurement + rejected optimization experiments. Native
Chromium/Metal at1200x800, scene frozen after stationary/5s walking capture;
camera/material/geometry/history held fixed. Timestamp tracking and app profiler
disabled. Each isolated sample submits4identical renders then awaits queue
completion;8warmup then32samples, job order alternated. Restoring color/velocity
inputs happens outside timing. Report /tmp/vestige-stage6-profile-{stationary,
moving}.json, harness /tmp/vestige-stage6-profile.mjs. Medians milliseconds:
stationary colorAll2.70, colorNoTracer1.475, colorNoFibers1.475, velocity3.35,
flow2.175, feedback.20, motion.375. Walking capture colorAll2.375,
colorNoTracer1.575, colorNoFibers.925, velocity2.20, flow1.90, feedback.20,
motion.40. Color omission is a diagnostic, not a proposed visual change. These
are queue-completed isolated workloads, not CPU-utilization/FPS or additive
whole-frame percentages. Both main color and velocity render moving trails.
Velocity stats~1.87million triangles versus2.30-2.33million source triangles.
Largest tested blocks are velocity/flow/color; ordering changes with view.

Experiment1: native flowAt neighbor Loop4 kept loading neighbors after a valid
neighbor selected. Added Break at successful selection in matter0/2 to mirror
unchanged GLSL first-neighbor return.60synthetic GPU comparisons (10cases x3passes
x2backends) and6frozen live comparisons matched every half-float output value;
no nonfinite values or errors. However isolated paired live flow wall medians
regressed1.875->2.325ms stationary,1.375->1.775ms walking. Rejected.
Experiment2: generated4fixed conditional lookup branches instead of loop;
same60synthetic/6live exact comparisons, but flow regressed1.925->2.55ms and
1.425->1.90ms. Motion remained roughly unchanged. Rejected. Reason for slowdown
not established; fewer texture fetches alone do not guarantee a GPU speedup.
Both use 1000x650 live viewport,750x488 flow/history targets;8warmup then40paired
samples,4draws per queue wait, alternate old/new. Timing has no GPU timestamps.
Artifacts /tmp/vestige-stage6-{break,unrolled}-{stationary,moving}-live.json;
synthetic /tmp/vestige-stage6-{webgpu,webgl}-gpu.json and harness -gpu.mjs.
Native stationary/moving and WebGL full-intro+3s walking smoke had no errors.
Mouse capture not retested. No audio/visual/input settings changes.

Both source files restored byte-for-byte from stage6pre-edit backups (which
matched published baseline). Final git diff contains ONLY TASK_STATE.md;
git diff --check passed. No final substantive code change, so no new Jev/API
review or redundant production build/regression is required; previous baseline
validation applies. No claim that rejected candidates improved performance.
No optimization retained, no commit/push/deployment. Completed authorized local
comparison and trials; stop before another optimization stage. User-facing
recommendation: next separately agreed experiment should address geometry work
in velocity/tracer rendering, carefully preserving partially visible tails.

## Extinguished tracer tails stage7 (2026-10-07, active/local)

Authorized next optimization: omit wholly expired tail segments in native color
and velocity draws, preserve every partially visible segment and blending order.
No publication or pointer testing. Candidate GPU binary-search per particle over
ordered history times, deterministic prefix scan and compact index + indirect
draw; existing fragment math/visible density untouched, WebGL stays original.
Acceptance: frozen old/new attachment and full-frame comparisons, measured total
render including compaction overhead, synthetic expiration/reset boundaries,
build/guides/native/fallback smoke and Jev if retained. Stop for user assessment.
Implementation and required local validation complete; awaiting user assessment.

Retained implementation: CompactTracerIndex uses native compute to find a
conservative live history prefix, scan offsets and generate ordered indices plus
indexed indirect draw arguments. Color and velocity use the same geometry and
reconstruct original inputs from vertexIndex. Only fully expired segments are
omitted; visible fade/birth/depth math and WebGL rendering remain unchanged.
No per-frame CPU readbacks. Pinned Three r186 attribute-manager INDEX allocation
is required for INDEX|STORAGE usage. Additional index/auxiliary storage is about
12.45MB on GPU and 12.45MB of CPU typed arrays: a memory-for-render-work tradeoff.
Compilation is sequential and stops after unmount; late allocations are released
after the pending compilation settles. Cleanup restores geometry only while this
helper still owns it, and does not dispose the borrowed position attribute.

Paired native Chromium Metal/WebGPU comparison at1200x800, stationary and after
5s walking; same frozen histories/camera/material inputs, timestamp profiler off.
8warmup then48alternating samples per variant, submission through queue completion,
including new culling compute; history restoration outside timing. Every half-
float value matched exactly in color, velocity, flow and final bloom/output; no
nonfinite values or errors. Retained160231/516096segments stationary (31.05%) and
167338/516096moving (32.42%); original index order and indirect args verified.
Full render wall medians old/new: stationary9.0/7.1ms (~21.1% improvement), moving
7.0/6.7ms (~4.3%). CPU submission means .767/.819ms and .779/.833ms respectively:
slightly increased, not reduced. These measurements establish GPU rendering work
reduction, not CPU utilization, energy or interactive FPS on the user's device.
Reports /tmp/vestige-stage7-{stationary,moving}.json; harness -live.mjs.

Validation: npm run test:tracers passed after final cleanup fix, exercising actual
TSL on native GPU in24cases: memory bounds, history slots/wrap, initialization,
expiration, record boundaries, paused memory, clock reset/large clock and endpoint
boundaries. Oracle uses original generated vertex life/hash/age math; checks all
potentially live segments, prefix sums, index order, indirect args and ownership.
Production build and guide regression passed after final changes in Jev stage0.
Native and forced-WebGL app smoke passed: entry, movement, pause/resume, resize;
native reduced-motion tracer hide/restore. No errors; inspected both screenshots.
Pointer capture not retested. Actual React unmount checks passed for normal and
early cleanup; delayed in-flight compilation allocated then released its buffers
with restored source geometry and no errors. /tmp/vestige-stage7-cleanup.mjs.

Shared Jev deep review + bounded continuation covered all27eligible fragments;
final recheck4new/23cached,0flagged,27uncertain,0deferred,1static-only excluded
TASK_STATE.md. Stage0 checks passed; advisory status remains needs_investigation,
not a clean classifier pass. Investigated all helper/test/caller uncertainty
locations against original vertex math, compute-history lifecycle, ordered draw
regressions, paired attachments and app/cleanup checks. Found and fixed late
async-compilation disposal risk. No further confirmed issue. Reviewed omitted
locations in checkpoint; no deferred source coverage. Reports
/tmp/vestige-stage7-jev{,-continue,-recheck}.json.

Remaining: user visual/performance assessment at http://127.0.0.1:5177/ (HTTP200).
No required local implementation/check remains. Stop this stage; do not begin
another optimization without user steering. No commit, push or deployment.

Stage7 publication authorized by user (2026-10-07): commit current optimization,
regression and investigation state to HASHQIX/VESTIGE main as Anatoli Shumer
<shumerhere@gmail.com>, then normal push. Fetched origin; HEAD matches origin/main.
Prior final build/guides/native GPU regression and cleanup checks apply unchanged;
git diff --check passes. Next: commit, push and verify remote hash/clean worktree.
Vercel deployment is outside this operation and remains unverified.


## Local lighting stage 1 (2026-10-08)

Authorized: plan incremental integration of ideas from Wavefront Tracer, implement
a small first experiment, and evaluate on the local server. No publication.
Plan: (1) entrance-mushroom surface lighting + A/B comparison; (2) evaluate and
tune intensity/shadows, then extend to other mushrooms/streamed receivers;
(3) try a sound-driven pulse through the root network. Temporal upscaling stays
a separate later experiment. Stage 1 implemented; next stage awaits visual
feedback on the current result rather than expanding the scope immediately.

Implementation: four sample emitters under mushroom 56 (same nearest rule as
entrance recording), 18 m maximum range. Approximate direct illumination with
normal-facing, falloff and blockers, baked onto nearby initial surface vertices
in the worker. Exact endpoint field samples, 0.4 m cached interior samples,
0.45 m visibility steps: thin blockers/details are approximate, not exact ray
tracing. Retained triangles only where lighting is nonzero. Three owning meshes
with standard Three materials work on WebGPU and WebGL. The fixed initial light
is outside streamed groups, preventing duplicated additive illumination while
patches overlap and preserving it when the original patch is evicted. Later
patches do not rebake/add light; extending receiver coverage is stage 2.
LIGHT ON/OFF controls and light=off startup; toggling on pause invalidates one
frame without resuming movement or audio. New resources dispose with the forest.

Validation: production build, 97 guide cases/lifetime checks, local-light
synthetic blockers/backfaces/range/finite outputs/source ties/cache/ownership
regression, and 24 native-GPU tracer boundary cases passed. Actual native WebGPU
and forced WebGL entered, moved, paused/resumed, resized and toggled without
page/console errors. Screenshots inspected; mobile control bounds inspected.
light=off startup and mouse/Space toggles while paused preserve position, paused
mode and suspended audio; About blocks movement, and resume restores playback.
Actual React unmount releases all three light meshes and removes the debug bridge
without page errors. Pointer capture was not retested. Artifacts:
/tmp/vestige-light-smoke.json, /tmp/vestige-light-controls.mjs,
/tmp/vestige-light-mobile.png, /tmp/vestige-light-final-{on,off}.png.

Cost: initial light bake improved from ~6.1 s to ~1.1–2.1 s with cached field
queries. Final source footprint: 16,691 vertices and 32,362 triangles across three
meshes. Repeated queue-completed full-render medians varied across runs (OFF/ON
8.7/9.0, 14.6/15.4, 7.2/7.2 ms); render/draw instrumentation was not consistently
stable, so this does not establish a precise whole-frame overhead, FPS or speedup.
A controlled performance comparison remains necessary before scaling the effect.
/tmp/vestige-light-bench.json and -bench.mjs include the latest local experiment
and successful unmount check. No GPU timestamp sums used.

Jev deep, recheck and bounded continuations covered all 56 eligible fragments:
1 flagged UI fragment, 56 uncertain (overlapping counts), 0 deferred, 2 static-only
exclusions (.jev/project.json and package-lock.json). Configured build, guides and
local-light checks passed. Advisory remains needs_investigation, not a clean
classifier pass. Investigated all attention locations against complete source
and callers: App/button event boundaries, pause/About/audio gates, worker initial
request ID/transfer buffers, source selection and tie behavior, generated array
contracts, approximate field sampling, material backend compatibility, geometry
ownership and cleanup. UI flag not reproduced by actual paused mouse/Space and
About tests; no further confirmed defect. Source invariants: generated bodies
have finite normals/positions and triangle indices; layout has mushrooms; cached
interior occlusion is intentionally approximate; only initial worker request
bakes light; standard material owns copied geometry, never borrowed source
attributes. All uncertain new helpers exercised by regression and actual browser
checks. Reports /tmp/vestige-light-jev-{summary,recheck,continue,source-page,final-page}.json.

Server: http://127.0.0.1:5177/ running via npm run dev. Current source local only;
no commit, push or deployment. Next: user comparison using LIGHT ON/OFF.


## Lightweight visibility revision (2026-10-08)

User feedback: added surface-light color does not improve the scene; only extend
visibility across the forest if it does not undo performance optimization.
Do not expand the baked entrance illumination to all mushrooms.

Removed the stage-1 surface bake, fixed light meshes, worker transfers, helper
modules, its regression script and added esbuild dev dependency/configured check.
The worker, forest assembler and package files now match the optimized HEAD.
Stage-1 work remains recoverable in /tmp/vestige-local-light-stage1 (patch/helpers)
and its prior validation records above are historical, not current behavior.

New local A/B comparison changes only existing render values: base filament
visibility 0.12 to 0.16; existing global mushroom/root/ground preview gain times
1.5. Original palette and preview occlusion/distance/region masks preserved.
No additional meshes, rays, targets, passes or streaming budget. BRIGHTER /
ORIGINAL toggle defaults to BRIGHTER; visibility=off selects original startup.
Both backends invalidate the paused demand loop when visibility changes.
Validation and advisory review pending below. No publication authorized.


Validation of revision: configured production build and guide selection/lifetime
checks passed. Actual Chromium native WebGPU and forced WebGL passed original
startup query, brighter/original mouse and Space toggles on pause, unchanged
camera/audio, About movement gating, resize/mobile bounds, resume/W movement,
and real React unmount removing canvas/debug bridge. No page/console errors in
these scoped runs; screenshots inspected. A separate optional pointer-capture
probe was rejected by the headless Pointer Lock API (Three console error);
pointer capture is not verified by the successful scoped runs, and its source
is unchanged. A/B resource checks temporarily freeze streaming requests to keep
resident geometry fixed; original streaming source and worker match HEAD.

Fixed-view A/B: both modes use the same 61 geometry objects and 152,156 preview
vertices; native draw calls 55/55, WebGL 56/56. Existing renderer effects, forest
group, filament manager and preview retain identity through the toggle. Three
resident patches, two presented, limit four. No entrance-light mesh remains.
This establishes unchanged resources and draw work, not an exact FPS guarantee
or GPU-time measurement. Artifacts /tmp/vestige-visibility-smoke.{mjs,json} and
/tmp/vestige-visibility-{webgpu,webgl}-{original,brighter,mobile}.png.

Jev deep plus one bounded continuation: all 22 eligible source fragments covered;
1 UI behavior flag and 22 uncertain fragments (overlap), 0 deferred; README.md
and TASK_STATE.md are the two static-only exclusions. Configured checks passed.
Advisory remains needs_investigation; not a clean classifier pass. Inspected
all attention records including omitted locations and complete App/controller,
ForestEffects, both renderer settings/lifecycle/preview ordering, TSL uniform
sync and generated preview/filament shaders. Settings memo does not recreate
effects or change their dependency arrays; paused invalidation schedules the
new values; visibility does not affect geometry/discard masks or stream limits.
Original mode restores both backend-specific preview gains and base fibers.
The UI flag was not reproduced in actual paused mouse/Space and About tests;
all resource/camera/audio checks passed. No confirmed defect remains from this
investigation. Reports /tmp/vestige-visibility-jev{,-continue}.json.

Server http://127.0.0.1:5177/ remains running. No commit, push or deployment.
Next is user visual assessment with BRIGHTER / ORIGINAL; do not expand baked
lighting or increase scene budgets without new user steering.


## Buried distant contours fix (2026-10-08)

User accepted the brighter appearance but reported buried trunks/stems still
visible in distant unloaded areas. Cause: analytic preview included whole root,
hub and mushroom segments, while depth only contains nearby streamed terrain.

Preview line construction now clips all contour segments against forestFloor
with a 0.01 m clearance. The terrain sine curvature bound skips safe above/below
segments, subdivides ambiguous curved crossings, then bisects boundary crossings
on the visible side. No per-frame terrain sampling, shader changes, new targets
or passes. Geometry/physics/layout retain their original placement; only buried
preview pieces are omitted. Existing brighter/original mode retained.

New test:preview uses Node 22.16 type stripping, dense independent floor checks
through all 71,312 emitted forest segments, clipping in both directions, input
ownership, buried/clear segments, crest crossings, exposed valley sections and
an isolated buried-base mushroom whose visible cap is retained. Configured Jev
checks now include this regression along with guides and build. Validation below.


Validation: test:preview passes independent samples (33 per emitted segment),
crest/valley/crossing and buried-base cases. Configured guides, preview regression
and production build all passed. Browser comparison replaces only the preview
position attribute at a fixed elevated camera with the original uncut geometry,
then restores the new geometry; streaming requests frozen for this A/B. Native
WebGPU and forced WebGL: 144,704 original line vertices vs 142,624 clipped;
10,054 sampled underground points (minimum -4.916 m) vs zero (minimum +0.0099998 m).
Native draws41/41, 33 geometries, 19 targets; WebGL draws42/42, 33 geometries;
three resident patches in both modes, existing limit four. Complete preview
construction measured ~37/41 ms, once at startup; not a measurement of incremental
clip cost or FPS. Brighter/original pause toggles passed; no browser errors.
Screenshots inspected for both backends. Prior UI/audio/cleanup verification
continues to apply to their unchanged source. Artifacts
/tmp/vestige-ground-smoke.{mjs,json}, /tmp/vestige-ground-{webgpu,webgl}-{before,after}.png.

Jev deep plus bounded full continuations covered all 42 eligible fragments:
1 UI behavior flag and 42 uncertain fragments (overlap), 0 deferred;
3 static-only exclusions: .jev/project.json, README.md, TASK_STATE.md.
Configured checks passed; advisory still needs_investigation, not a clean pass.
Inspected all attention locations, including omitted records. New helper context:
finite layout-generated Vector3 inputs, terrain formula and curvature constants,
recursive quartering of the error bound (terminates), visible-side boundary
bisection, 1 cm margin exceeding .0025 m approximation/Float32 error, output-only
ownership and shared backend geometry path. Dense independent segment validation
and original-vs-fixed browser attributes confirm burial removal and retained
exposed surfaces. Test missing-context records resolved against the full script,
real terrain/layout imports, crest/valley coverage and actual Node22.16 execution.
Remaining records concern unchanged accepted visibility/App code: prior complete
source/caller and pause/Space/About/audio/cleanup checks still apply; the UI flag
was not reproduced, and current toggles remain paused. No confirmed defect after
investigation. Reports /tmp/vestige-ground-jev{,-page2,-final}.json.

Server remains http://127.0.0.1:5177/. Refresh the app to rebuild preview buffers.
Local only, no commit/push/deployment. Await user assessment of buried-contour fix.


Publication authorized by user (2026-10-08): commit the accepted global visibility
comparison, buried-preview fix, regression and documentation, then normal push
to HASHQIX/VESTIGE main. Fetched origin: HEAD matches origin/main at f4653ea.
Final source matches the reviewed/validated revision above; no new code change.
Existing build/guides/preview and WebGPU/WebGL checks apply; diff check passes.
Git identity: Anatoli Shumer <shumerhere@gmail.com>. Commit/push this revision
and verify the remote hash and clean worktree; hosting deployment not checked.
