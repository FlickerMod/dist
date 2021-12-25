(() => {
  // src/lib/flicker/flicker.js
  var flicker = {
    modules: {},
    baked: false,
    classes: {},
    _current: null,
    _loadQueue: [],
    _waitForOnload: 0,
    copy(object) {
      if (!object || typeof object != "object" || object instanceof HTMLElement || object instanceof flicker.Class)
        return object;
      else if (object instanceof Array) {
        let c = [];
        for (let i of object) {
          c[i] = flicker.copy(i);
        }
        return c;
      } else {
        let c = {};
        for (let i in object) {
          c[i] = flicker.copy(object[i]);
        }
        return c;
      }
    },
    module(name) {
      if (flicker._current) {
        throw new Error(`Module ${flicker._current.name} defines nothing`);
      }
      if (flicker.modules[name] && flicker.modules[name].body) {
        throw new Error(`Module ${name} is already defined`);
      }
      flicker._current = { name, requires: [], loaded: false, body: null };
      flicker.modules[name] = flicker._current;
      flicker._loadQueue.push(flicker._current);
      return flicker;
    },
    requires() {
      flicker._current.requires = Array.prototype.slice.call(arguments);
      return flicker;
    },
    defines(body) {
      flicker._current.body = body;
      flicker._current = null;
      flicker._initDOMReady();
    },
    _execModules() {
      let modulesLoaded = false;
      for (let i = 0; i < flicker._loadQueue.length; i++) {
        let m = flicker._loadQueue[i];
        let dependenciesLoaded = true;
        for (let j = 0; j < m.requires.length; j++) {
          let name = m.requires[j];
          if (!flicker.modules[name]) {
          } else if (!flicker.modules[name].loaded) {
            dependenciesLoaded = false;
          }
        }
        if (dependenciesLoaded && m.body) {
          flicker._loadQueue.splice(i, 1);
          m.loaded = true;
          m.body();
          modulesLoaded = true;
          i--;
        }
      }
      if (modulesLoaded) {
        flicker._execModules();
      } else if (!flicker.baked && flicker._waitForOnload == 0 && flicker._loadQueue.length != 0) {
        let unresolved = [];
        for (let i = 0; i < flicker._loadQueue.length; i++) {
          let unloaded = [];
          let requires = flicker._loadQueue[i].requires;
          for (let j = 0; j < requires.length; j++) {
            let m = flicker.modules[requires[j]];
            if (!m || !m.loaded)
              unloaded.push(requires[j]);
          }
          unresolved.push(flicker._loadQueue[i].name + " (requires: " + unloaded.join(", ") + ")");
        }
        throw "Unresolved (or circular?) dependencies. Most likely there's a name/path mismatch for one of the listed modules or a previous syntax error prevents a module from loading:\n" + unresolved.join("\n");
      }
    },
    _DOMReady() {
      if (!flicker.modules["dom.ready"].loaded) {
        if (!document.body)
          return setTimeout(flicker._DOMReady, 13);
        flicker.modules["dom.ready"].loaded = true;
        flicker._waitForOnload--;
        flicker._execModules();
      }
      return 0;
    },
    _initDOMReady() {
      if (flicker.modules["dom.ready"]) {
        flicker._execModules();
        return;
      }
      flicker.modules["dom.ready"] = { requires: [], loaded: false, body: null };
      flicker._waitForOnload++;
      if (document.readyState === "complete") {
        flicker._DOMReady();
      } else {
        document.addEventListener("DOMContentLoaded", flicker._DOMReady, false);
        window.addEventListener("load", flicker._DOMReady, false);
      }
    }
  };
  var initializing = false;
  var fnTest = /xyz/.test(() => xyz) ? /\bparent\b/ : /.*/;
  var lastClassId = 0;
  flicker.Class = function() {
  };
  function inject(prop) {
    let proto = this.prototype;
    let parent = {};
    for (let name in prop) {
      if (typeof prop[name] == "function" && typeof proto[name] == "function" && fnTest.test(prop[name])) {
        parent[name] = proto[name];
        proto[name] = function(name2, fn) {
          return function() {
            let tmp = this.parent;
            this.parent = parent[name2];
            let ret = fn.apply(this, arguments);
            this.parent = tmp;
            return ret;
          };
        }(name, prop[name]);
      } else {
        proto[name] = prop[name];
      }
    }
  }
  flicker.Class.extend = function(prop) {
    var parent = this.prototype;
    initializing = true;
    let prototype = new this();
    initializing = false;
    for (let name in prop) {
      if (typeof prop[name] == "function" && typeof parent[name] == "function" && fnTest.test(prop[name])) {
        prototype[name] = function(name2, fn) {
          return function() {
            let tmp = this.parent;
            this.parent = parent[name2];
            var ret = fn.apply(this, arguments);
            this.parent = tmp;
            return ret;
          };
        }(name, prop[name]);
      } else {
        prototype[name] = prop[name];
      }
    }
    function Class() {
      if (!initializing) {
        if (this.staticInstantiate) {
          var obj = this.staticInstantiate.apply(this, arguments);
          if (obj)
            return obj;
        }
        for (let p in this) {
          if (typeof this[p] == "object") {
            this[p] = flicker.copy(this[p]);
          }
        }
        if (this.init) {
          this.init.apply(this, arguments);
        }
      }
      return this;
    }
    Class.prototype = prototype;
    Class.prototype.constructor = Class;
    Class.extend = flicker.Class.extend;
    Class.inject = inject;
    Class.classId = prototype.classId = ++lastClassId;
    return Class;
  };
  var flicker_default = flicker;

  // src/lib/flicker/utils/logging.js
  function log(input, color, type) {
    console[type](`%cFlicker%c`, `background-color: ${color}; color: white; border-radius: 4px; padding: 0px 6px 0px 6px; font-weight: bold`, "", ...input);
  }
  flicker_default.module("flicker.logging").requires("dom.ready").defines(() => {
    flicker_default.classes.Logger = flicker_default.Class.extend({
      log(...input) {
        log(input, "#552954", "log");
      },
      warn(...input) {
        log(input, "#c11c3e", "warn");
      },
      error(...input) {
        log(input, "red", "error");
      }
    });
  });

  // src/lib/flicker/webpack/webpackModules.js
  function getModules() {
    let modules;
    webpackChunkdiscord_app.push([
      [Symbol("Flicker")],
      {},
      (e) => {
        modules = e;
      }
    ]);
    return modules.c;
  }
  function filterModules(moduleList, filter, defaults = false) {
    let modules = [];
    for (const mod in moduleList) {
      if (moduleList.hasOwnProperty(mod)) {
        const module = moduleList[mod].exports;
        if (module) {
          if (module.default && module.__esModule && filter(module.default)) {
            modules.push(module.default);
          }
          if (filter(module))
            modules.push(module);
        }
      }
    }
    return modules;
  }
  var webpackModules = getModules();
  console.log(webpackModules);
  flicker_default.module("flicker.webpack.webpackModules").requires("dom.ready").defines(() => {
    flicker_default.classes.Webpack = flicker_default.Class.extend({
      find: (filter) => {
        return filterModules(webpackModules, filter)[0];
      },
      findAll: (filter) => {
        return filterModules(webpackModules, filter);
      },
      getModule: (module) => {
        for (const modId in webpackModules) {
          const mod = webpackModules[modId]?.exports;
          if (mod === module || mod?.default === module) {
            return mod;
          }
        }
      },
      findByProps(...propNames) {
        return this.find((module) => propNames.every((prop) => module[prop] !== void 0));
      },
      findByPropsAll(...propNames) {
        return this.findAll((module) => propNames.every((prop) => module[prop] !== void 0));
      },
      findByPrototypes(...protoNames) {
        return this.find((module) => module.prototype && protoNames.every((protoProp) => module.prototype[protoProp] !== void 0));
      },
      findByDisplayName(displayName, defaultExport = false) {
        return defaultExport ? this.find((module) => module?.default?.displayName === displayName) : this.find((module) => module.displayName === displayName);
      },
      findByDisplayNameAll(displayName) {
        return this.findAll((module) => module.displayName === displayName);
      }
    });
  });

  // src/lib/init.js
  var loadingMessages = [
    "Loading Flicker...",
    "Looking at the sky...",
    "Watching the water unfold...",
    "Making Discord feel alive...",
    "Keep going keep going keep going keep going..."
  ];
  function init() {
    let initLogger = new flicker_default.classes.Logger();
    initLogger.log(loadingMessages[Math.floor(Math.random() * loadingMessages.length)]);
    window.flicker = {
      ...flicker_default,
      modules: {
        webpackModules: new flicker_default.classes.Webpack()
      },
      utils: {
        logger: new flicker_default.classes.Logger()
      }
    };
  }

  // src/index.js
  if (window.flicker)
    throw new Error("Flicker is already injected!");
  init();
})();
//# sourceURL=Flicker