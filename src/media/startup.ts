import { audio, type MediaState } from "./audio";
import { platform } from "../platform/bridge";
let desired: MediaState = "PLATFORM_STARTUP",
  paused = false,
  platformAudio = true;
let introVideo: HTMLVideoElement | undefined;
const INTRO_SOURCES = [
  "/media/vyrnora-studios-logo-reveal.mp4",
  "/media/studio-intro.mp4",
] as const;
const portraitTouch = () =>
  matchMedia("(orientation: portrait) and (pointer: coarse)").matches;
function sync() {
  audio.setState(
    paused || document.hidden || !platformAudio || portraitTouch() ? "PAUSED" : desired,
  );
  if (introVideo) {
    introVideo.muted = introVideo.dataset.silent === "true" || !platformAudio;
    if (paused || document.hidden || portraitTouch()) introVideo.pause();
    else if (desired === "STUDIO_INTRO" && introVideo.dataset.started)
      void introVideo.play().catch(() => {});
  }
  document.body.dataset.mediaState =
    paused || document.hidden ? "PAUSED" : desired;
}
export function setMediaState(state: MediaState) {
  desired = state;
  sync();
  platform.gameplay(state === "GAMEPLAY");
  platform.banner(state === "MAIN_MENU");
}
export function inputPaused() {
  return paused || document.hidden || portraitTouch() || desired !== "GAMEPLAY";
}
document.addEventListener("visibilitychange", sync);
addEventListener("resize", sync);
addEventListener("orientationchange", sync);
export async function startup() {
  const layer = document.createElement("div");
  layer.id = "studioIntro";
  document.body.append(layer);
  document.body.classList.add("starting");
  try {
    await platform.initialize((value, audioEnabled) => {
      paused = value;
      platformAudio = audioEnabled;
      sync();
    });
  } catch {
    // Standalone access remains playable. No simulated platform branding or ads.
    document.body.dataset.platformUnavailable = "true";
  }
  const video = document.createElement("video");
  introVideo = video;
  video.playsInline = true;
  video.preload = "auto";
  video.setAttribute("aria-label", "Vyrnora Studios intro");
  const permission = document.createElement("button");
  permission.id = "beginIntro";
  permission.textContent = "Enter with sound";
  const silent = document.createElement("button");
  silent.id = "silentIntro";
  silent.textContent = "Enter silently";
  layer.append(permission, silent);
  await new Promise<void>((resolve) => {
    let finished = false;
    let sourceIndex = 0;
    const finish = () => {
      if (finished) return;
      finished = true;
      video.pause();
      video.onended = null;
      video.onerror = null;
      video.ontimeupdate = null;
      video.removeAttribute("src");
      video.load();
      introVideo = undefined;
      layer.remove();
      document.body.classList.remove("starting");
      resolve();
    };
    const showRetry = () => {
      delete video.dataset.started;
      layer.replaceChildren(permission, silent);
      permission.textContent = "Tap to play intro";
    };
    const tryFallbackSource = () => {
      if (finished) return;
      if (sourceIndex < INTRO_SOURCES.length - 1) {
        sourceIndex += 1;
        video.src = INTRO_SOURCES[sourceIndex];
        video.load();
        if (video.dataset.started) {
          void video.play().catch(() => {
            if (!video.error) showRetry();
          });
        }
        return;
      }
      // If neither local intro asset can be loaded, continue to the menu safely.
      finish();
    };
    const play = async (muted: boolean) => {
      video.dataset.silent = String(muted);
      video.muted = muted || !platformAudio;
      setMediaState("STUDIO_INTRO");
      // Unlock the game channel inside the gesture, still silent throughout the intro.
      void audio.unlock().catch(() => {});
      layer.replaceChildren(video);
      video.dataset.started = "true";
      try {
        await video.play();
      } catch {
        if (!video.error) showRetry();
        // A media-load failure is handled by tryFallbackSource.
      }
    };
    permission.onclick = () => void play(false);
    silent.onclick = () => void play(true);
    video.onended = finish;
    video.onerror = tryFallbackSource;
    video.ontimeupdate = () => {
      if (video.duration - video.currentTime < 0.6)
        video.classList.add("intro-fade");
    };
    // Prefer the newly supplied Vyrnora reveal. Keep the current intro as a safe
    // fallback until the replacement MP4 is added to public/media on this branch.
    video.src = INTRO_SOURCES[sourceIndex];
    video.load();
  });
  setMediaState("MAIN_MENU");
  await platform.gameReady().catch(() => {});
}
