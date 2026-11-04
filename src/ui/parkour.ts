import { PARKOUR_COURSES } from "../../shared/parkour";

/** One lightweight menu and a single active-course HUD; no gameplay authority. */
export function createParkourUI(
  send: (type: string, value?: unknown) => void,
  toast: (text: string) => void,
) {
  const nav = document.querySelector<HTMLElement>(".menu")!;
  const button = document.createElement("button");
  button.id = "parkourButton";
  button.className = "reward-nav";
  button.textContent = "✦ SKYBOUND";
  button.setAttribute("aria-label", "Parkour challenges");
  button.hidden = true;
  nav.append(button);

  const dialog = document.createElement("dialog");
  dialog.id = "parkourMenu";
  dialog.setAttribute("aria-label", "Skybound parkour courses");
  dialog.innerHTML =
    '<div class="panel-head"><h2>SKYBOUND CHALLENGES</h2><button aria-label="Close parkour">×</button></div>' +
    '<p>Run to a glowing start marker, then complete the checkpoints in order. Your times and rewards are saved.</p>' +
    '<div id="parkourCourses"></div>';
  dialog.querySelector("button")!.addEventListener("click", () => dialog.close());
  document.body.append(dialog);

  const track = document.createElement("aside");
  track.id = "parkourTracker";
  track.hidden = true;
  track.innerHTML =
    '<b id="parkourTitle">SKYBOUND</b><span id="parkourProgress">Follow the course</span>' +
    '<small id="parkourTimer">0:00</small><button id="parkourCancel">Leave course</button>';
  document.body.append(track);
  track.querySelector("button")!.onclick = () => send("cancelParkour");

  let running: { course: string; checkpoint: number; total: number; started: number } | undefined;
  let received = 0;
  function renderCourses() {
    const list = dialog.querySelector("#parkourCourses")!;
    list.innerHTML = "";
    for (const course of PARKOUR_COURSES) {
      const article = document.createElement("article");
      article.className = "parkour-card";
      const title = document.createElement("h3");
      title.textContent = course.name;
      const description = document.createElement("p");
      description.textContent = course.description;
      const coords = document.createElement("small");
      coords.textContent =
        `Start: X ${course.start.x}, Z ${course.start.z} · ${course.gems} Gems · ${course.checkpoints.length} checkpoints`;
      const start = document.createElement("button");
      start.textContent = "Start course";
      start.disabled = !!running;
      start.onclick = () => {
        send("startParkour", course.id);
        dialog.close();
      };
      article.append(title, description, coords, start);
      list.append(article);
    }
  }
  button.onclick = () => {
    if (document.querySelector("dialog[open]")) return;
    renderCourses();
    dialog.showModal();
  };
  function updateTimer() {
    if (!running) return;
    const seconds = Math.max(0, Math.floor((Date.now() - received) / 1000));
    const counter = track.querySelector("#parkourTimer")!;
    counter.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  }
  // The timer is only presentation; the Colyseus server validates elapsed time.
  const interval = setInterval(updateTimer, 300);
  return {
    show(visible: boolean) {
      button.hidden = !visible;
      if (!visible) {
        running = undefined;
        track.hidden = true;
        if (dialog.open) dialog.close();
      }
    },
    update(message: {
      status: string; course?: string; checkpoint?: number; total?: number;
      milliseconds?: number; best?: number; gems?: number; message?: string;
    }) {
      if (message.status === "started" && message.course) {
        running = { course: message.course, checkpoint: 0,
          total: message.total || 0, started: Date.now() };
        received = Date.now();
        track.hidden = false;
        track.querySelector("#parkourTitle")!.textContent =
          PARKOUR_COURSES.find((c) => c.id === message.course)?.name || "Skybound";
        track.querySelector("#parkourProgress")!.textContent =
          `Checkpoint 0 / ${running.total}`;
      } else if (message.status === "checkpoint" && running) {
        running.checkpoint = message.checkpoint || 0;
        track.querySelector("#parkourProgress")!.textContent =
          `Checkpoint ${running.checkpoint} / ${running.total}`;
        toast("Checkpoint reached! Follow the next marker.");
      } else {
        if (message.status === "finished")
          toast(`Course finished in ${((message.milliseconds || 0) / 1000).toFixed(2)}s · +${message.gems || 0} Gems`);
        else if (message.message) toast(message.message);
        if (message.status !== "error" || !running) {
          running = undefined;
          track.hidden = true;
        }
      }
      renderCourses();
    },
    dispose() {
      clearInterval(interval);
      track.remove();
      dialog.remove();
      button.remove();
    },
  };
}
