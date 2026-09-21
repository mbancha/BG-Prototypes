import { runSimulation } from "./sim";
self.onmessage = (e) => {
  self.postMessage(runSimulation(e.data));
};
