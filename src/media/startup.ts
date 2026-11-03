import { audio, type MediaState } from "./audio";
import { platform } from "../platform/bridge";
let desired: MediaState = "PLATFORM_STARTUP",
  paused = false,
  platformAudio = true;
let introVideo: HTMLVideoElement | undefined;
function sync() {
  audio.setState(
    paused || document.hidden || !platformAudio ? "PAUSED" : desired,
  );
  if (introVideo) {
    introVideo.muted = introVideo.dataset.silent === "true" || !platformAudio;
    if (paused || document.hidden) introVideo.pause();
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
  return paused || document.hidden || desired !== "GAMEPLAY";
}
document.addEventListener("visibilitychange", sync);
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
  video.src = "/media/studio-intro.mp4";
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
    const finish = () => {
      if (finished) return;
      finished = true;
      video.pause();
      video.removeAttribute("src");
      video.load();
      introVideo = undefined;
      layer.remove();
      document.body.classList.remove("starting");
      resolve();
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
        delete video.dataset.started;
        layer.replaceChildren(permission, silent);
        permission.textContent = "Tap to play intro";
      }
    };
    permission.onclick = () => void play(false);
    silent.onclick = () => void play(true);
    video.onended = finish;
    video.onerror = finish;
    video.ontimeupdate = () => {
      if (video.duration - video.currentTime < 0.6)
        video.classList.add("intro-fade");
    };
  });
  setMediaState("MAIN_MENU");
  await platform.gameReady().catch(() => {});
}
