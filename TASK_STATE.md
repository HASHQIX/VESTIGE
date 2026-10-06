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
