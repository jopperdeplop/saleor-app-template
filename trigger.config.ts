import { defineConfig } from "@trigger.dev/sdk/v3";

export default defineConfig({
    project: "proj_kowucsyntkqmyhtllwkb",
    dirs: ["./src/trigger"],
    runtime: "node",
    logLevel: "log",
    // maxDuration is required in v3 config types in some versions
    maxDuration: 300,
    retries: {
        default: {
            maxAttempts: 3,
            minTimeoutInMs: 1000,
            maxTimeoutInMs: 10000,
        },
    },
});
