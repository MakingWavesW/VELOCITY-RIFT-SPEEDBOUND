/** Prevent a release whose Playgama frontend would try to connect to localhost:2567. */
const raw = process.env.VITE_SERVER_URL || "";
let url;
try {
  url = new URL(raw);
} catch {
  console.error("Playgama build blocked: set VITE_SERVER_URL to your public wss:// Colyseus endpoint.");
  process.exit(1);
}
if (url.protocol !== "wss:" || /^(localhost|127(?:\.\d+){3}|0\.0\.0\.0)$/i.test(url.hostname)) {
  console.error("Playgama build blocked: multiplayer backend must use an accessible secure wss:// endpoint.");
  process.exit(1);
}
if (url.username || url.password) {
  console.error("Do not embed backend credentials in the public VITE_SERVER_URL.");
  process.exit(1);
}
console.log("Playgama secure multiplayer endpoint supplied:", url.origin);
