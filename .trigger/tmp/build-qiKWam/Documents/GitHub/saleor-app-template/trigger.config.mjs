import {
  defineConfig
} from "../../../chunk-ONHLK5E6.mjs";
import "../../../chunk-YV5CNPDY.mjs";
import {
  init_esm
} from "../../../chunk-TQ3WNEB5.mjs";

// trigger.config.ts
init_esm();
var trigger_config_default = defineConfig({
  project: "proj_kowucsyntkqmyhtllwkb",
  dirs: ["./src/trigger"],
  runtime: "node",
  logLevel: "log",
  // maxDuration is required in v3 config types in some versions
  maxDuration: 300,
  retries: {
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1e3,
      maxTimeoutInMs: 1e4
    }
  },
  build: {}
});
var resolveEnvVars = void 0;
export {
  trigger_config_default as default,
  resolveEnvVars
};
//# sourceMappingURL=trigger.config.mjs.map
