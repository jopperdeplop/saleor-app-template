import {
  db,
  eq,
  saleorAuth
} from "./chunk-KC6DVKSX.mjs";
import {
  __commonJS,
  __name,
  __require,
  __toESM,
  init_esm
} from "./chunk-CEGEFIIW.mjs";

// node_modules/.pnpm/ms@2.1.3/node_modules/ms/index.js
var require_ms = __commonJS({
  "node_modules/.pnpm/ms@2.1.3/node_modules/ms/index.js"(exports, module) {
    init_esm();
    var s = 1e3;
    var m = s * 60;
    var h = m * 60;
    var d = h * 24;
    var w = d * 7;
    var y = d * 365.25;
    module.exports = function(val, options) {
      options = options || {};
      var type = typeof val;
      if (type === "string" && val.length > 0) {
        return parse(val);
      } else if (type === "number" && isFinite(val)) {
        return options.long ? fmtLong(val) : fmtShort(val);
      }
      throw new Error(
        "val is not a non-empty string or a valid number. val=" + JSON.stringify(val)
      );
    };
    function parse(str) {
      str = String(str);
      if (str.length > 100) {
        return;
      }
      var match = /^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(
        str
      );
      if (!match) {
        return;
      }
      var n = parseFloat(match[1]);
      var type = (match[2] || "ms").toLowerCase();
      switch (type) {
        case "years":
        case "year":
        case "yrs":
        case "yr":
        case "y":
          return n * y;
        case "weeks":
        case "week":
        case "w":
          return n * w;
        case "days":
        case "day":
        case "d":
          return n * d;
        case "hours":
        case "hour":
        case "hrs":
        case "hr":
        case "h":
          return n * h;
        case "minutes":
        case "minute":
        case "mins":
        case "min":
        case "m":
          return n * m;
        case "seconds":
        case "second":
        case "secs":
        case "sec":
        case "s":
          return n * s;
        case "milliseconds":
        case "millisecond":
        case "msecs":
        case "msec":
        case "ms":
          return n;
        default:
          return void 0;
      }
    }
    __name(parse, "parse");
    function fmtShort(ms) {
      var msAbs = Math.abs(ms);
      if (msAbs >= d) {
        return Math.round(ms / d) + "d";
      }
      if (msAbs >= h) {
        return Math.round(ms / h) + "h";
      }
      if (msAbs >= m) {
        return Math.round(ms / m) + "m";
      }
      if (msAbs >= s) {
        return Math.round(ms / s) + "s";
      }
      return ms + "ms";
    }
    __name(fmtShort, "fmtShort");
    function fmtLong(ms) {
      var msAbs = Math.abs(ms);
      if (msAbs >= d) {
        return plural(ms, msAbs, d, "day");
      }
      if (msAbs >= h) {
        return plural(ms, msAbs, h, "hour");
      }
      if (msAbs >= m) {
        return plural(ms, msAbs, m, "minute");
      }
      if (msAbs >= s) {
        return plural(ms, msAbs, s, "second");
      }
      return ms + " ms";
    }
    __name(fmtLong, "fmtLong");
    function plural(ms, msAbs, n, name) {
      var isPlural = msAbs >= n * 1.5;
      return Math.round(ms / n) + " " + name + (isPlural ? "s" : "");
    }
    __name(plural, "plural");
  }
});

// node_modules/.pnpm/debug@4.4.0/node_modules/debug/src/common.js
var require_common = __commonJS({
  "node_modules/.pnpm/debug@4.4.0/node_modules/debug/src/common.js"(exports, module) {
    init_esm();
    function setup(env) {
      createDebug2.debug = createDebug2;
      createDebug2.default = createDebug2;
      createDebug2.coerce = coerce;
      createDebug2.disable = disable;
      createDebug2.enable = enable;
      createDebug2.enabled = enabled;
      createDebug2.humanize = require_ms();
      createDebug2.destroy = destroy;
      Object.keys(env).forEach((key) => {
        createDebug2[key] = env[key];
      });
      createDebug2.names = [];
      createDebug2.skips = [];
      createDebug2.formatters = {};
      function selectColor(namespace) {
        let hash = 0;
        for (let i = 0; i < namespace.length; i++) {
          hash = (hash << 5) - hash + namespace.charCodeAt(i);
          hash |= 0;
        }
        return createDebug2.colors[Math.abs(hash) % createDebug2.colors.length];
      }
      __name(selectColor, "selectColor");
      createDebug2.selectColor = selectColor;
      function createDebug2(namespace) {
        let prevTime;
        let enableOverride = null;
        let namespacesCache;
        let enabledCache;
        function debug3(...args) {
          if (!debug3.enabled) {
            return;
          }
          const self = debug3;
          const curr = Number(/* @__PURE__ */ new Date());
          const ms = curr - (prevTime || curr);
          self.diff = ms;
          self.prev = prevTime;
          self.curr = curr;
          prevTime = curr;
          args[0] = createDebug2.coerce(args[0]);
          if (typeof args[0] !== "string") {
            args.unshift("%O");
          }
          let index = 0;
          args[0] = args[0].replace(/%([a-zA-Z%])/g, (match, format) => {
            if (match === "%%") {
              return "%";
            }
            index++;
            const formatter = createDebug2.formatters[format];
            if (typeof formatter === "function") {
              const val = args[index];
              match = formatter.call(self, val);
              args.splice(index, 1);
              index--;
            }
            return match;
          });
          createDebug2.formatArgs.call(self, args);
          const logFn = self.log || createDebug2.log;
          logFn.apply(self, args);
        }
        __name(debug3, "debug");
        debug3.namespace = namespace;
        debug3.useColors = createDebug2.useColors();
        debug3.color = createDebug2.selectColor(namespace);
        debug3.extend = extend;
        debug3.destroy = createDebug2.destroy;
        Object.defineProperty(debug3, "enabled", {
          enumerable: true,
          configurable: false,
          get: /* @__PURE__ */ __name(() => {
            if (enableOverride !== null) {
              return enableOverride;
            }
            if (namespacesCache !== createDebug2.namespaces) {
              namespacesCache = createDebug2.namespaces;
              enabledCache = createDebug2.enabled(namespace);
            }
            return enabledCache;
          }, "get"),
          set: /* @__PURE__ */ __name((v) => {
            enableOverride = v;
          }, "set")
        });
        if (typeof createDebug2.init === "function") {
          createDebug2.init(debug3);
        }
        return debug3;
      }
      __name(createDebug2, "createDebug");
      function extend(namespace, delimiter) {
        const newDebug = createDebug2(this.namespace + (typeof delimiter === "undefined" ? ":" : delimiter) + namespace);
        newDebug.log = this.log;
        return newDebug;
      }
      __name(extend, "extend");
      function enable(namespaces) {
        createDebug2.save(namespaces);
        createDebug2.namespaces = namespaces;
        createDebug2.names = [];
        createDebug2.skips = [];
        const split = (typeof namespaces === "string" ? namespaces : "").trim().replace(" ", ",").split(",").filter(Boolean);
        for (const ns of split) {
          if (ns[0] === "-") {
            createDebug2.skips.push(ns.slice(1));
          } else {
            createDebug2.names.push(ns);
          }
        }
      }
      __name(enable, "enable");
      function matchesTemplate(search, template) {
        let searchIndex = 0;
        let templateIndex = 0;
        let starIndex = -1;
        let matchIndex = 0;
        while (searchIndex < search.length) {
          if (templateIndex < template.length && (template[templateIndex] === search[searchIndex] || template[templateIndex] === "*")) {
            if (template[templateIndex] === "*") {
              starIndex = templateIndex;
              matchIndex = searchIndex;
              templateIndex++;
            } else {
              searchIndex++;
              templateIndex++;
            }
          } else if (starIndex !== -1) {
            templateIndex = starIndex + 1;
            matchIndex++;
            searchIndex = matchIndex;
          } else {
            return false;
          }
        }
        while (templateIndex < template.length && template[templateIndex] === "*") {
          templateIndex++;
        }
        return templateIndex === template.length;
      }
      __name(matchesTemplate, "matchesTemplate");
      function disable() {
        const namespaces = [
          ...createDebug2.names,
          ...createDebug2.skips.map((namespace) => "-" + namespace)
        ].join(",");
        createDebug2.enable("");
        return namespaces;
      }
      __name(disable, "disable");
      function enabled(name) {
        for (const skip of createDebug2.skips) {
          if (matchesTemplate(name, skip)) {
            return false;
          }
        }
        for (const ns of createDebug2.names) {
          if (matchesTemplate(name, ns)) {
            return true;
          }
        }
        return false;
      }
      __name(enabled, "enabled");
      function coerce(val) {
        if (val instanceof Error) {
          return val.stack || val.message;
        }
        return val;
      }
      __name(coerce, "coerce");
      function destroy() {
        console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
      }
      __name(destroy, "destroy");
      createDebug2.enable(createDebug2.load());
      return createDebug2;
    }
    __name(setup, "setup");
    module.exports = setup;
  }
});

// node_modules/.pnpm/debug@4.4.0/node_modules/debug/src/browser.js
var require_browser = __commonJS({
  "node_modules/.pnpm/debug@4.4.0/node_modules/debug/src/browser.js"(exports, module) {
    init_esm();
    exports.formatArgs = formatArgs;
    exports.save = save;
    exports.load = load;
    exports.useColors = useColors;
    exports.storage = localstorage();
    exports.destroy = /* @__PURE__ */ (() => {
      let warned = false;
      return () => {
        if (!warned) {
          warned = true;
          console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
        }
      };
    })();
    exports.colors = [
      "#0000CC",
      "#0000FF",
      "#0033CC",
      "#0033FF",
      "#0066CC",
      "#0066FF",
      "#0099CC",
      "#0099FF",
      "#00CC00",
      "#00CC33",
      "#00CC66",
      "#00CC99",
      "#00CCCC",
      "#00CCFF",
      "#3300CC",
      "#3300FF",
      "#3333CC",
      "#3333FF",
      "#3366CC",
      "#3366FF",
      "#3399CC",
      "#3399FF",
      "#33CC00",
      "#33CC33",
      "#33CC66",
      "#33CC99",
      "#33CCCC",
      "#33CCFF",
      "#6600CC",
      "#6600FF",
      "#6633CC",
      "#6633FF",
      "#66CC00",
      "#66CC33",
      "#9900CC",
      "#9900FF",
      "#9933CC",
      "#9933FF",
      "#99CC00",
      "#99CC33",
      "#CC0000",
      "#CC0033",
      "#CC0066",
      "#CC0099",
      "#CC00CC",
      "#CC00FF",
      "#CC3300",
      "#CC3333",
      "#CC3366",
      "#CC3399",
      "#CC33CC",
      "#CC33FF",
      "#CC6600",
      "#CC6633",
      "#CC9900",
      "#CC9933",
      "#CCCC00",
      "#CCCC33",
      "#FF0000",
      "#FF0033",
      "#FF0066",
      "#FF0099",
      "#FF00CC",
      "#FF00FF",
      "#FF3300",
      "#FF3333",
      "#FF3366",
      "#FF3399",
      "#FF33CC",
      "#FF33FF",
      "#FF6600",
      "#FF6633",
      "#FF9900",
      "#FF9933",
      "#FFCC00",
      "#FFCC33"
    ];
    function useColors() {
      if (typeof window !== "undefined" && window.process && (window.process.type === "renderer" || window.process.__nwjs)) {
        return true;
      }
      if (typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)) {
        return false;
      }
      let m;
      return typeof document !== "undefined" && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance || // Is firebug? http://stackoverflow.com/a/398120/376773
      typeof window !== "undefined" && window.console && (window.console.firebug || window.console.exception && window.console.table) || // Is firefox >= v31?
      // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
      typeof navigator !== "undefined" && navigator.userAgent && (m = navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/)) && parseInt(m[1], 10) >= 31 || // Double check webkit in userAgent just in case we are in a worker
      typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/);
    }
    __name(useColors, "useColors");
    function formatArgs(args) {
      args[0] = (this.useColors ? "%c" : "") + this.namespace + (this.useColors ? " %c" : " ") + args[0] + (this.useColors ? "%c " : " ") + "+" + module.exports.humanize(this.diff);
      if (!this.useColors) {
        return;
      }
      const c = "color: " + this.color;
      args.splice(1, 0, c, "color: inherit");
      let index = 0;
      let lastC = 0;
      args[0].replace(/%[a-zA-Z%]/g, (match) => {
        if (match === "%%") {
          return;
        }
        index++;
        if (match === "%c") {
          lastC = index;
        }
      });
      args.splice(lastC, 0, c);
    }
    __name(formatArgs, "formatArgs");
    exports.log = console.debug || console.log || (() => {
    });
    function save(namespaces) {
      try {
        if (namespaces) {
          exports.storage.setItem("debug", namespaces);
        } else {
          exports.storage.removeItem("debug");
        }
      } catch (error) {
      }
    }
    __name(save, "save");
    function load() {
      let r;
      try {
        r = exports.storage.getItem("debug");
      } catch (error) {
      }
      if (!r && typeof process !== "undefined" && "env" in process) {
        r = process.env.DEBUG;
      }
      return r;
    }
    __name(load, "load");
    function localstorage() {
      try {
        return localStorage;
      } catch (error) {
      }
    }
    __name(localstorage, "localstorage");
    module.exports = require_common()(exports);
    var { formatters } = module.exports;
    formatters.j = function(v) {
      try {
        return JSON.stringify(v);
      } catch (error) {
        return "[UnexpectedJSONParseError]: " + error.message;
      }
    };
  }
});

// node_modules/.pnpm/has-flag@4.0.0/node_modules/has-flag/index.js
var require_has_flag = __commonJS({
  "node_modules/.pnpm/has-flag@4.0.0/node_modules/has-flag/index.js"(exports, module) {
    "use strict";
    init_esm();
    module.exports = (flag, argv = process.argv) => {
      const prefix = flag.startsWith("-") ? "" : flag.length === 1 ? "-" : "--";
      const position = argv.indexOf(prefix + flag);
      const terminatorPosition = argv.indexOf("--");
      return position !== -1 && (terminatorPosition === -1 || position < terminatorPosition);
    };
  }
});

// node_modules/.pnpm/supports-color@7.2.0/node_modules/supports-color/index.js
var require_supports_color = __commonJS({
  "node_modules/.pnpm/supports-color@7.2.0/node_modules/supports-color/index.js"(exports, module) {
    "use strict";
    init_esm();
    var os = __require("os");
    var tty = __require("tty");
    var hasFlag = require_has_flag();
    var { env } = process;
    var forceColor;
    if (hasFlag("no-color") || hasFlag("no-colors") || hasFlag("color=false") || hasFlag("color=never")) {
      forceColor = 0;
    } else if (hasFlag("color") || hasFlag("colors") || hasFlag("color=true") || hasFlag("color=always")) {
      forceColor = 1;
    }
    if ("FORCE_COLOR" in env) {
      if (env.FORCE_COLOR === "true") {
        forceColor = 1;
      } else if (env.FORCE_COLOR === "false") {
        forceColor = 0;
      } else {
        forceColor = env.FORCE_COLOR.length === 0 ? 1 : Math.min(parseInt(env.FORCE_COLOR, 10), 3);
      }
    }
    function translateLevel(level) {
      if (level === 0) {
        return false;
      }
      return {
        level,
        hasBasic: true,
        has256: level >= 2,
        has16m: level >= 3
      };
    }
    __name(translateLevel, "translateLevel");
    function supportsColor(haveStream, streamIsTTY) {
      if (forceColor === 0) {
        return 0;
      }
      if (hasFlag("color=16m") || hasFlag("color=full") || hasFlag("color=truecolor")) {
        return 3;
      }
      if (hasFlag("color=256")) {
        return 2;
      }
      if (haveStream && !streamIsTTY && forceColor === void 0) {
        return 0;
      }
      const min = forceColor || 0;
      if (env.TERM === "dumb") {
        return min;
      }
      if (process.platform === "win32") {
        const osRelease = os.release().split(".");
        if (Number(osRelease[0]) >= 10 && Number(osRelease[2]) >= 10586) {
          return Number(osRelease[2]) >= 14931 ? 3 : 2;
        }
        return 1;
      }
      if ("CI" in env) {
        if (["TRAVIS", "CIRCLECI", "APPVEYOR", "GITLAB_CI", "GITHUB_ACTIONS", "BUILDKITE"].some((sign) => sign in env) || env.CI_NAME === "codeship") {
          return 1;
        }
        return min;
      }
      if ("TEAMCITY_VERSION" in env) {
        return /^(9\.(0*[1-9]\d*)\.|\d{2,}\.)/.test(env.TEAMCITY_VERSION) ? 1 : 0;
      }
      if (env.COLORTERM === "truecolor") {
        return 3;
      }
      if ("TERM_PROGRAM" in env) {
        const version = parseInt((env.TERM_PROGRAM_VERSION || "").split(".")[0], 10);
        switch (env.TERM_PROGRAM) {
          case "iTerm.app":
            return version >= 3 ? 3 : 2;
          case "Apple_Terminal":
            return 2;
        }
      }
      if (/-256(color)?$/i.test(env.TERM)) {
        return 2;
      }
      if (/^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(env.TERM)) {
        return 1;
      }
      if ("COLORTERM" in env) {
        return 1;
      }
      return min;
    }
    __name(supportsColor, "supportsColor");
    function getSupportLevel(stream) {
      const level = supportsColor(stream, stream && stream.isTTY);
      return translateLevel(level);
    }
    __name(getSupportLevel, "getSupportLevel");
    module.exports = {
      supportsColor: getSupportLevel,
      stdout: translateLevel(supportsColor(true, tty.isatty(1))),
      stderr: translateLevel(supportsColor(true, tty.isatty(2)))
    };
  }
});

// node_modules/.pnpm/debug@4.4.0/node_modules/debug/src/node.js
var require_node = __commonJS({
  "node_modules/.pnpm/debug@4.4.0/node_modules/debug/src/node.js"(exports, module) {
    init_esm();
    var tty = __require("tty");
    var util = __require("util");
    exports.init = init;
    exports.log = log;
    exports.formatArgs = formatArgs;
    exports.save = save;
    exports.load = load;
    exports.useColors = useColors;
    exports.destroy = util.deprecate(
      () => {
      },
      "Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`."
    );
    exports.colors = [6, 2, 3, 4, 5, 1];
    try {
      const supportsColor = require_supports_color();
      if (supportsColor && (supportsColor.stderr || supportsColor).level >= 2) {
        exports.colors = [
          20,
          21,
          26,
          27,
          32,
          33,
          38,
          39,
          40,
          41,
          42,
          43,
          44,
          45,
          56,
          57,
          62,
          63,
          68,
          69,
          74,
          75,
          76,
          77,
          78,
          79,
          80,
          81,
          92,
          93,
          98,
          99,
          112,
          113,
          128,
          129,
          134,
          135,
          148,
          149,
          160,
          161,
          162,
          163,
          164,
          165,
          166,
          167,
          168,
          169,
          170,
          171,
          172,
          173,
          178,
          179,
          184,
          185,
          196,
          197,
          198,
          199,
          200,
          201,
          202,
          203,
          204,
          205,
          206,
          207,
          208,
          209,
          214,
          215,
          220,
          221
        ];
      }
    } catch (error) {
    }
    exports.inspectOpts = Object.keys(process.env).filter((key) => {
      return /^debug_/i.test(key);
    }).reduce((obj, key) => {
      const prop = key.substring(6).toLowerCase().replace(/_([a-z])/g, (_, k) => {
        return k.toUpperCase();
      });
      let val = process.env[key];
      if (/^(yes|on|true|enabled)$/i.test(val)) {
        val = true;
      } else if (/^(no|off|false|disabled)$/i.test(val)) {
        val = false;
      } else if (val === "null") {
        val = null;
      } else {
        val = Number(val);
      }
      obj[prop] = val;
      return obj;
    }, {});
    function useColors() {
      return "colors" in exports.inspectOpts ? Boolean(exports.inspectOpts.colors) : tty.isatty(process.stderr.fd);
    }
    __name(useColors, "useColors");
    function formatArgs(args) {
      const { namespace: name, useColors: useColors2 } = this;
      if (useColors2) {
        const c = this.color;
        const colorCode = "\x1B[3" + (c < 8 ? c : "8;5;" + c);
        const prefix = `  ${colorCode};1m${name} \x1B[0m`;
        args[0] = prefix + args[0].split("\n").join("\n" + prefix);
        args.push(colorCode + "m+" + module.exports.humanize(this.diff) + "\x1B[0m");
      } else {
        args[0] = getDate() + name + " " + args[0];
      }
    }
    __name(formatArgs, "formatArgs");
    function getDate() {
      if (exports.inspectOpts.hideDate) {
        return "";
      }
      return (/* @__PURE__ */ new Date()).toISOString() + " ";
    }
    __name(getDate, "getDate");
    function log(...args) {
      return process.stderr.write(util.formatWithOptions(exports.inspectOpts, ...args) + "\n");
    }
    __name(log, "log");
    function save(namespaces) {
      if (namespaces) {
        process.env.DEBUG = namespaces;
      } else {
        delete process.env.DEBUG;
      }
    }
    __name(save, "save");
    function load() {
      return process.env.DEBUG;
    }
    __name(load, "load");
    function init(debug3) {
      debug3.inspectOpts = {};
      const keys = Object.keys(exports.inspectOpts);
      for (let i = 0; i < keys.length; i++) {
        debug3.inspectOpts[keys[i]] = exports.inspectOpts[keys[i]];
      }
    }
    __name(init, "init");
    module.exports = require_common()(exports);
    var { formatters } = module.exports;
    formatters.o = function(v) {
      this.inspectOpts.colors = this.useColors;
      return util.inspect(v, this.inspectOpts).split("\n").map((str) => str.trim()).join(" ");
    };
    formatters.O = function(v) {
      this.inspectOpts.colors = this.useColors;
      return util.inspect(v, this.inspectOpts);
    };
  }
});

// node_modules/.pnpm/debug@4.4.0/node_modules/debug/src/index.js
var require_src = __commonJS({
  "node_modules/.pnpm/debug@4.4.0/node_modules/debug/src/index.js"(exports, module) {
    init_esm();
    if (typeof process === "undefined" || process.type === "renderer" || process.browser === true || process.__nwjs) {
      module.exports = require_browser();
    } else {
      module.exports = require_node();
    }
  }
});

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
function normalizeUrl(url) {
  return url.replace(/\/$/, "").trim().toLowerCase();
}
__name(normalizeUrl, "normalizeUrl");

// src/saleor-app.ts
init_esm();

// node_modules/.pnpm/@saleor+app-sdk@1.3.0_graph_fa17c376d9ced4b227b518ffdef3809c/node_modules/@saleor/app-sdk/saleor-app.mjs
init_esm();
var SaleorApp = class {
  static {
    __name(this, "SaleorApp");
  }
  constructor(options) {
    this.apl = options.apl;
  }
};

// node_modules/.pnpm/@saleor+app-sdk@1.3.0_graph_fa17c376d9ced4b227b518ffdef3809c/node_modules/@saleor/app-sdk/APL/file/index.mjs
init_esm();

// node_modules/.pnpm/@saleor+app-sdk@1.3.0_graph_fa17c376d9ced4b227b518ffdef3809c/node_modules/@saleor/app-sdk/chunk-ORQVZRNL.mjs
init_esm();

// node_modules/.pnpm/@saleor+app-sdk@1.3.0_graph_fa17c376d9ced4b227b518ffdef3809c/node_modules/@saleor/app-sdk/chunk-CPDLIPGD.mjs
init_esm();
var import_debug = __toESM(require_src(), 1);
var createDebug = /* @__PURE__ */ __name((namespace) => import_debug.default.debug(`app-sdk:${namespace}`), "createDebug");

// node_modules/.pnpm/@saleor+app-sdk@1.3.0_graph_fa17c376d9ced4b227b518ffdef3809c/node_modules/@saleor/app-sdk/chunk-ORQVZRNL.mjs
var createAPLDebug = /* @__PURE__ */ __name((namespace) => createDebug(`APL:${namespace}`), "createAPLDebug");

// node_modules/.pnpm/@saleor+app-sdk@1.3.0_graph_fa17c376d9ced4b227b518ffdef3809c/node_modules/@saleor/app-sdk/APL/file/index.mjs
import { promises as fsPromises } from "fs";
var debug = createAPLDebug("FileAPL");
var FileAPL = class {
  static {
    __name(this, "FileAPL");
  }
  constructor(config = {}) {
    this.fileName = config?.fileName || ".saleor-app-auth.json";
  }
  /**
   * Load auth data from a file and return it as AuthData format.
   * In case of incomplete or invalid data, return `undefined`.
   */
  async loadDataFromFile() {
    debug(`Will try to load auth data from the ${this.fileName} file`);
    let parsedData = {};
    try {
      parsedData = JSON.parse(await fsPromises.readFile(this.fileName, "utf-8"));
      debug("%s read successfully", this.fileName);
    } catch (err) {
      debug(`Could not read auth data from the ${this.fileName} file`, err);
      debug(
        "Maybe apl.get() was called before app was registered. Returning empty, fallback data (undefined)"
      );
      return void 0;
    }
    const { token, saleorApiUrl, appId, jwks } = parsedData;
    if (token && saleorApiUrl && appId) {
      debug("Token found, returning values: %s", `${token[0]}***`);
      const authData = { token, saleorApiUrl, appId };
      if (jwks) {
        authData.jwks = jwks;
      }
      return authData;
    }
    return void 0;
  }
  /**
   * Save auth data to file.
   * When `authData` argument is empty, will overwrite file with empty values.
   */
  async saveDataToFile(authData) {
    debug(`Trying to save auth data to the ${this.fileName} file`);
    const newData = authData ? JSON.stringify(authData) : "{}";
    try {
      await fsPromises.writeFile(this.fileName, newData);
      debug("Successfully written file %", this.fileName);
    } catch (err) {
      debug(`Could not save auth data to the ${this.fileName} file`, err);
      throw new Error("File APL was unable to save auth data");
    }
  }
  async get(saleorApiUrl) {
    const authData = await this.loadDataFromFile();
    if (saleorApiUrl === authData?.saleorApiUrl) {
      return authData;
    }
    return void 0;
  }
  async set(authData) {
    await this.saveDataToFile(authData);
  }
  async delete(saleorApiUrl) {
    const authData = await this.loadDataFromFile();
    if (saleorApiUrl === authData?.saleorApiUrl) {
      await this.saveDataToFile();
    }
  }
  async getAll() {
    const authData = await this.loadDataFromFile();
    if (!authData) {
      return [];
    }
    return [authData];
  }
};

// node_modules/.pnpm/@saleor+app-sdk@1.3.0_graph_fa17c376d9ced4b227b518ffdef3809c/node_modules/@saleor/app-sdk/APL/upstash/index.mjs
init_esm();
var debug2 = createAPLDebug("UpstashAPL");
var UpstashAPLVariables = {
  UPSTASH_TOKEN: "UPSTASH_TOKEN",
  UPSTASH_URL: "UPSTASH_URL"
};
var UpstashAplMisconfiguredError = class extends Error {
  static {
    __name(this, "UpstashAplMisconfiguredError");
  }
  constructor(missingVars) {
    super(
      `Configuration values for: ${missingVars.map((v) => `"${v}"`).join(", ")} not found or is empty. Pass values to constructor of use env variables.`
    );
    this.missingVars = missingVars;
  }
};
var UpstashAplNotConfiguredError = class extends Error {
  static {
    __name(this, "UpstashAplNotConfiguredError");
  }
};
var UpstashAPL = class {
  static {
    __name(this, "UpstashAPL");
  }
  constructor(config) {
    const restURL = config?.restURL || process.env[UpstashAPLVariables.UPSTASH_URL];
    const restToken = config?.restToken || process.env[UpstashAPLVariables.UPSTASH_TOKEN];
    this.restURL = restURL;
    this.restToken = restToken;
  }
  async upstashRequest(request) {
    debug2("Sending request to Upstash");
    if (!this.restURL || !this.restToken) {
      throw new Error(
        "UpstashAPL is not configured. See https://docs.saleor.io/docs/3.x/developer/extending/apps/developing-apps/app-sdk/apl"
      );
    }
    let response;
    try {
      response = await fetch(this.restURL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.restToken}` },
        body: JSON.stringify(request)
      });
    } catch (error) {
      debug2("Error during sending the data:", error);
      throw new Error(`UpstashAPL was unable to perform a request ${error}`);
    }
    const parsedResponse = await response.json();
    if (!response.ok || "error" in parsedResponse) {
      debug2(`Operation unsuccessful. Upstash API has responded with ${response.status} code`);
      if ("error" in parsedResponse) {
        debug2("Error message: %s", parsedResponse.error);
        throw new Error(
          `Upstash APL was not able to perform operation. Status code: ${response.status}. Error: ${parsedResponse.error}`
        );
      }
      throw new Error(
        `Upstash APL was not able to perform operation. Status code: ${response.status}`
      );
    }
    debug2("Upstash service responded successfully");
    return parsedResponse.result;
  }
  async saveDataToUpstash(authData) {
    debug2("saveDataToUpstash() called with: %j", {
      saleorApiUrl: authData.saleorApiUrl,
      token: authData.token.substring(0, 4)
    });
    const data = JSON.stringify(authData);
    await this.upstashRequest(["SET", authData.saleorApiUrl, data]);
  }
  async deleteDataFromUpstash(saleorApiUrl) {
    await this.upstashRequest(["DEL", saleorApiUrl]);
  }
  async fetchDataFromUpstash(saleorApiUrl) {
    const result = await this.upstashRequest(["GET", saleorApiUrl]);
    if (result) {
      const authData = JSON.parse(result);
      return authData;
    }
    return void 0;
  }
  async get(saleorApiUrl) {
    return this.fetchDataFromUpstash(saleorApiUrl);
  }
  async set(authData) {
    await this.saveDataToUpstash(authData);
  }
  async delete(saleorApiUrl) {
    await this.deleteDataFromUpstash(saleorApiUrl);
  }
  async getAll() {
    throw new Error("UpstashAPL does not support getAll method");
    return [];
  }
  // eslint-disable-next-line class-methods-use-this
  async isReady() {
    const missingConf = [];
    if (!this.restToken) {
      missingConf.push("restToken");
    }
    if (!this.restURL) {
      missingConf.push("restURL");
    }
    if (missingConf.length > 0) {
      return {
        ready: false,
        error: new UpstashAplMisconfiguredError(missingConf)
      };
    }
    return {
      ready: true
    };
  }
  async isConfigured() {
    return this.restToken && this.restURL ? {
      configured: true
    } : {
      configured: false,
      error: new UpstashAplNotConfiguredError(
        "UpstashAPL not configured. Check if REST URL and token provided in constructor or env"
      )
    };
  }
};

// src/lib/db-apl.ts
init_esm();
var DrizzleAPL = class {
  static {
    __name(this, "DrizzleAPL");
  }
  async get(saleorApiUrl) {
    console.log(`🔍 [APL Query] Searching for: ${saleorApiUrl}`);
    const [result] = await db.select().from(saleorAuth).where(eq(saleorAuth.saleorApiUrl, saleorApiUrl)).limit(1);
    if (!result) {
      console.warn(`❌ [APL Query] TOKEN NOT FOUND in database for: ${saleorApiUrl}`);
      return void 0;
    }
    console.log(`✅ [APL Query] Token found for: ${saleorApiUrl}`);
    return {
      saleorApiUrl: result.saleorApiUrl,
      token: result.token,
      appId: result.appId,
      jwks: result.jwks || void 0
    };
  }
  async set(authData) {
    await db.insert(saleorAuth).values({
      saleorApiUrl: authData.saleorApiUrl,
      token: authData.token,
      appId: authData.appId,
      jwks: authData.jwks
    }).onConflictDoUpdate({
      target: saleorAuth.saleorApiUrl,
      set: {
        token: authData.token,
        appId: authData.appId,
        jwks: authData.jwks
      }
    });
  }
  async delete(saleorApiUrl) {
    await db.delete(saleorAuth).where(eq(saleorAuth.saleorApiUrl, saleorApiUrl));
  }
  async getAll() {
    const results = await db.select().from(saleorAuth);
    return results.map((r) => ({
      saleorApiUrl: r.saleorApiUrl,
      token: r.token,
      appId: r.appId,
      jwks: r.jwks || void 0
    }));
  }
  async isReady() {
    return { ready: true };
  }
  async isConfigured() {
    return { configured: true };
  }
};

// src/saleor-app.ts
var apl;
if (process.env.DATABASE_URL || process.env.POSTGRES_URL) {
  console.log("✅ DrizzleAPL (Database) selected.");
  apl = new DrizzleAPL();
} else if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
  console.log("✅ UpstashAPL selected.");
  apl = new UpstashAPL({
    restURL: process.env.KV_REST_API_URL,
    restToken: process.env.KV_REST_API_TOKEN
  });
} else {
  console.warn("⚠️ FileAPL selected (Non-persistent).");
  apl = new FileAPL();
}
var saleorApp = new SaleorApp({
  apl
});

export {
  logDebug,
  normalizeUrl,
  apl
};
//# sourceMappingURL=chunk-Y5F4RJXU.mjs.map
