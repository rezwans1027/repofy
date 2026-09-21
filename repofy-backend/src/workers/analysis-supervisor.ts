import { fork, type ChildProcess } from "node:child_process";
import { join } from "node:path";

// Fixed application entry only, never a repository path/command. This parent can
// enforce deadlines even when a native parser blocks the child's event loop.
const entry = join(__dirname, "analysis.js");
let child: ChildProcess | undefined; let stopping = false;
let deadline: NodeJS.Timeout | undefined; let restart: NodeJS.Timeout | undefined;
function arm(ms: number) {
  clearTimeout(deadline);
  deadline = setTimeout(() => child?.kill("SIGKILL"), ms);
}
function launch() {
  child = fork(entry, [], { execArgv: ["--max-old-space-size=384"], stdio: ["ignore", "inherit", "inherit", "ipc"] });
  arm(30000); // Startup/idle watchdog; active work has its own bounded deadline.
  child.on("message", message => {
    if (stopping) return;
    if (message === "working") arm(16 * 60 * 1000);
    if (message === "idle") arm(30000);
  });
  child.on("error", () => child?.kill("SIGKILL"));
  child.on("exit", () => {
    clearTimeout(deadline); child = undefined;
    if (!stopping) restart = setTimeout(launch, 2000);
  });
}
for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => {
  stopping = true; clearTimeout(restart); clearTimeout(deadline);
  if (child) { child.kill("SIGTERM"); arm(10000); }
});
launch();
