import {
  __name,
  init_esm
} from "./chunk-TQ3WNEB5.mjs";

// src/lib/utils.ts
init_esm();
import * as fs from "fs";
function logDebug(msg, obj) {
  const text = obj ? `${msg} ${JSON.stringify(obj)}` : msg;
  console.log(text);
  try {
    fs.appendFileSync("debug_log.txt", text + "\n");
  } catch (e) {
  }
}
__name(logDebug, "logDebug");

export {
  logDebug
};
//# sourceMappingURL=chunk-JUBDIEYX.mjs.map
