// Web Worker wrapper around runSimulation so a 10,000-game run doesn't
// freeze the UI. Post a SimOptions object in; get {t:"progress"} messages
// and finally {t:"done", res} back. Cancelling = worker.terminate().

import { runSimulation, type SimOptions } from "./sim";

self.addEventListener("message", (e: MessageEvent<SimOptions>) => {
  try {
    const res = runSimulation(e.data, (done, total) =>
      (self as unknown as Worker).postMessage({ t: "progress", done, total }),
    );
    (self as unknown as Worker).postMessage({ t: "done", res });
  } catch (err) {
    (self as unknown as Worker).postMessage({
      t: "error",
      message: err instanceof Error ? err.message : String(err),
    });
  }
});
