(async () => {
  var e = Object.create, t = Object.defineProperty, n = Object.getOwnPropertyDescriptor, r = Object.getOwnPropertyNames, i = Object.getPrototypeOf, a = Object.prototype.hasOwnProperty, o = (e2, t2) => () => (t2 || (e2((t2 = {
    exports: {}
  }).exports, t2), e2 = null), t2.exports), s = (e2, i2, o2, s2) => {
    if (i2 && typeof i2 == `object` || typeof i2 == `function`) for (var c2 = r(i2), l2 = 0, u2 = c2.length, d2; l2 < u2; l2++) d2 = c2[l2], !a.call(e2, d2) && d2 !== o2 && t(e2, d2, {
      get: ((e3) => i2[e3]).bind(null, d2),
      enumerable: !(s2 = n(i2, d2)) || s2.enumerable
    });
    return e2;
  }, c = (n2, r2, a2) => (a2 = n2 == null ? {} : e(i(n2)), s(r2 || !n2 || !n2.__esModule ? t(a2, `default`, {
    value: n2,
    enumerable: true
  }) : a2, n2));
  (function() {
    let e2 = document.createElement(`link`).relList;
    if (e2 && e2.supports && e2.supports(`modulepreload`)) return;
    for (let e3 of document.querySelectorAll(`link[rel="modulepreload"]`)) n2(e3);
    new MutationObserver((e3) => {
      for (let t3 of e3) if (t3.type === `childList`) for (let e4 of t3.addedNodes) e4.tagName === `LINK` && e4.rel === `modulepreload` && n2(e4);
    }).observe(document, {
      childList: true,
      subtree: true
    });
    function t2(e3) {
      let t3 = {};
      return e3.integrity && (t3.integrity = e3.integrity), e3.referrerPolicy && (t3.referrerPolicy = e3.referrerPolicy), e3.crossOrigin === `use-credentials` ? t3.credentials = `include` : e3.crossOrigin === `anonymous` ? t3.credentials = `omit` : t3.credentials = `same-origin`, t3;
    }
    function n2(e3) {
      if (e3.ep) return;
      e3.ep = true;
      let n3 = t2(e3);
      fetch(e3.href, n3);
    }
  })();
  var l = o(((e2) => {
    var t2 = /* @__PURE__ */ Symbol.for(`react.transitional.element`), n2 = /* @__PURE__ */ Symbol.for(`react.portal`), r2 = /* @__PURE__ */ Symbol.for(`react.fragment`), i2 = /* @__PURE__ */ Symbol.for(`react.strict_mode`), a2 = /* @__PURE__ */ Symbol.for(`react.profiler`), o2 = /* @__PURE__ */ Symbol.for(`react.consumer`), s2 = /* @__PURE__ */ Symbol.for(`react.context`), c2 = /* @__PURE__ */ Symbol.for(`react.forward_ref`), l2 = /* @__PURE__ */ Symbol.for(`react.suspense`), u2 = /* @__PURE__ */ Symbol.for(`react.memo`), d2 = /* @__PURE__ */ Symbol.for(`react.lazy`), f2 = /* @__PURE__ */ Symbol.for(`react.activity`), p2 = Symbol.iterator;
    function m2(e3) {
      return typeof e3 != `object` || !e3 ? null : (e3 = p2 && e3[p2] || e3[`@@iterator`], typeof e3 == `function` ? e3 : null);
    }
    var h2 = {
      isMounted: function() {
        return false;
      },
      enqueueForceUpdate: function() {
      },
      enqueueReplaceState: function() {
      },
      enqueueSetState: function() {
      }
    }, g2 = Object.assign, _2 = {};
    function v2(e3, t3, n3) {
      this.props = e3, this.context = t3, this.refs = _2, this.updater = n3 || h2;
    }
    v2.prototype.isReactComponent = {}, v2.prototype.setState = function(e3, t3) {
      if (typeof e3 != `object` && typeof e3 != `function` && e3 != null) throw Error(`takes an object of state variables to update or a function which returns an object of state variables.`);
      this.updater.enqueueSetState(this, e3, t3, `setState`);
    }, v2.prototype.forceUpdate = function(e3) {
      this.updater.enqueueForceUpdate(this, e3, `forceUpdate`);
    };
    function y2() {
    }
    y2.prototype = v2.prototype;
    function b2(e3, t3, n3) {
      this.props = e3, this.context = t3, this.refs = _2, this.updater = n3 || h2;
    }
    var x2 = b2.prototype = new y2();
    x2.constructor = b2, g2(x2, v2.prototype), x2.isPureReactComponent = true;
    var S2 = Array.isArray;
    function C2() {
    }
    var w2 = {
      H: null,
      A: null,
      T: null,
      S: null
    }, ee2 = Object.prototype.hasOwnProperty;
    function T2(e3, n3, r3) {
      var i3 = r3.ref;
      return {
        $$typeof: t2,
        type: e3,
        key: n3,
        ref: i3 === void 0 ? null : i3,
        props: r3
      };
    }
    function te2(e3, t3) {
      return T2(e3.type, t3, e3.props);
    }
    function ne2(e3) {
      return typeof e3 == `object` && !!e3 && e3.$$typeof === t2;
    }
    function re2(e3) {
      var t3 = {
        "=": `=0`,
        ":": `=2`
      };
      return `$` + e3.replace(/[=:]/g, function(e4) {
        return t3[e4];
      });
    }
    var E2 = /\/+/g;
    function D2(e3, t3) {
      return typeof e3 == `object` && e3 && e3.key != null ? re2(`` + e3.key) : t3.toString(36);
    }
    function O2(e3) {
      switch (e3.status) {
        case `fulfilled`:
          return e3.value;
        case `rejected`:
          throw e3.reason;
        default:
          switch (typeof e3.status == `string` ? e3.then(C2, C2) : (e3.status = `pending`, e3.then(function(t3) {
            e3.status === `pending` && (e3.status = `fulfilled`, e3.value = t3);
          }, function(t3) {
            e3.status === `pending` && (e3.status = `rejected`, e3.reason = t3);
          })), e3.status) {
            case `fulfilled`:
              return e3.value;
            case `rejected`:
              throw e3.reason;
          }
      }
      throw e3;
    }
    function k2(e3, r3, i3, a3, o3) {
      var s3 = typeof e3;
      (s3 === `undefined` || s3 === `boolean`) && (e3 = null);
      var c3 = false;
      if (e3 === null) c3 = true;
      else switch (s3) {
        case `bigint`:
        case `string`:
        case `number`:
          c3 = true;
          break;
        case `object`:
          switch (e3.$$typeof) {
            case t2:
            case n2:
              c3 = true;
              break;
            case d2:
              return c3 = e3._init, k2(c3(e3._payload), r3, i3, a3, o3);
          }
      }
      if (c3) return o3 = o3(e3), c3 = a3 === `` ? `.` + D2(e3, 0) : a3, S2(o3) ? (i3 = ``, c3 != null && (i3 = c3.replace(E2, `$&/`) + `/`), k2(o3, r3, i3, ``, function(e4) {
        return e4;
      })) : o3 != null && (ne2(o3) && (o3 = te2(o3, i3 + (o3.key == null || e3 && e3.key === o3.key ? `` : (`` + o3.key).replace(E2, `$&/`) + `/`) + c3)), r3.push(o3)), 1;
      c3 = 0;
      var l3 = a3 === `` ? `.` : a3 + `:`;
      if (S2(e3)) for (var u3 = 0; u3 < e3.length; u3++) a3 = e3[u3], s3 = l3 + D2(a3, u3), c3 += k2(a3, r3, i3, s3, o3);
      else if (u3 = m2(e3), typeof u3 == `function`) for (e3 = u3.call(e3), u3 = 0; !(a3 = e3.next()).done; ) a3 = a3.value, s3 = l3 + D2(a3, u3++), c3 += k2(a3, r3, i3, s3, o3);
      else if (s3 === `object`) {
        if (typeof e3.then == `function`) return k2(O2(e3), r3, i3, a3, o3);
        throw r3 = String(e3), Error(`Objects are not valid as a React child (found: ` + (r3 === `[object Object]` ? `object with keys {` + Object.keys(e3).join(`, `) + `}` : r3) + `). If you meant to render a collection of children, use an array instead.`);
      }
      return c3;
    }
    function A2(e3, t3, n3) {
      if (e3 == null) return e3;
      var r3 = [], i3 = 0;
      return k2(e3, r3, ``, ``, function(e4) {
        return t3.call(n3, e4, i3++);
      }), r3;
    }
    function j2(e3) {
      if (e3._status === -1) {
        var t3 = e3._result;
        t3 = t3(), t3.then(function(t4) {
          (e3._status === 0 || e3._status === -1) && (e3._status = 1, e3._result = t4);
        }, function(t4) {
          (e3._status === 0 || e3._status === -1) && (e3._status = 2, e3._result = t4);
        }), e3._status === -1 && (e3._status = 0, e3._result = t3);
      }
      if (e3._status === 1) return e3._result.default;
      throw e3._result;
    }
    var M2 = typeof reportError == `function` ? reportError : function(e3) {
      if (typeof window == `object` && typeof window.ErrorEvent == `function`) {
        var t3 = new window.ErrorEvent(`error`, {
          bubbles: true,
          cancelable: true,
          message: typeof e3 == `object` && e3 && typeof e3.message == `string` ? String(e3.message) : String(e3),
          error: e3
        });
        if (!window.dispatchEvent(t3)) return;
      } else if (typeof process == `object` && typeof process.emit == `function`) {
        process.emit(`uncaughtException`, e3);
        return;
      }
      console.error(e3);
    }, N2 = {
      map: A2,
      forEach: function(e3, t3, n3) {
        A2(e3, function() {
          t3.apply(this, arguments);
        }, n3);
      },
      count: function(e3) {
        var t3 = 0;
        return A2(e3, function() {
          t3++;
        }), t3;
      },
      toArray: function(e3) {
        return A2(e3, function(e4) {
          return e4;
        }) || [];
      },
      only: function(e3) {
        if (!ne2(e3)) throw Error(`React.Children.only expected to receive a single React element child.`);
        return e3;
      }
    };
    e2.Activity = f2, e2.Children = N2, e2.Component = v2, e2.Fragment = r2, e2.Profiler = a2, e2.PureComponent = b2, e2.StrictMode = i2, e2.Suspense = l2, e2.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = w2, e2.__COMPILER_RUNTIME = {
      __proto__: null,
      c: function(e3) {
        return w2.H.useMemoCache(e3);
      }
    }, e2.cache = function(e3) {
      return function() {
        return e3.apply(null, arguments);
      };
    }, e2.cacheSignal = function() {
      return null;
    }, e2.cloneElement = function(e3, t3, n3) {
      if (e3 == null) throw Error(`The argument must be a React element, but you passed ` + e3 + `.`);
      var r3 = g2({}, e3.props), i3 = e3.key;
      if (t3 != null) for (a3 in t3.key !== void 0 && (i3 = `` + t3.key), t3) !ee2.call(t3, a3) || a3 === `key` || a3 === `__self` || a3 === `__source` || a3 === `ref` && t3.ref === void 0 || (r3[a3] = t3[a3]);
      var a3 = arguments.length - 2;
      if (a3 === 1) r3.children = n3;
      else if (1 < a3) {
        for (var o3 = Array(a3), s3 = 0; s3 < a3; s3++) o3[s3] = arguments[s3 + 2];
        r3.children = o3;
      }
      return T2(e3.type, i3, r3);
    }, e2.createContext = function(e3) {
      return e3 = {
        $$typeof: s2,
        _currentValue: e3,
        _currentValue2: e3,
        _threadCount: 0,
        Provider: null,
        Consumer: null
      }, e3.Provider = e3, e3.Consumer = {
        $$typeof: o2,
        _context: e3
      }, e3;
    }, e2.createElement = function(e3, t3, n3) {
      var r3, i3 = {}, a3 = null;
      if (t3 != null) for (r3 in t3.key !== void 0 && (a3 = `` + t3.key), t3) ee2.call(t3, r3) && r3 !== `key` && r3 !== `__self` && r3 !== `__source` && (i3[r3] = t3[r3]);
      var o3 = arguments.length - 2;
      if (o3 === 1) i3.children = n3;
      else if (1 < o3) {
        for (var s3 = Array(o3), c3 = 0; c3 < o3; c3++) s3[c3] = arguments[c3 + 2];
        i3.children = s3;
      }
      if (e3 && e3.defaultProps) for (r3 in o3 = e3.defaultProps, o3) i3[r3] === void 0 && (i3[r3] = o3[r3]);
      return T2(e3, a3, i3);
    }, e2.createRef = function() {
      return {
        current: null
      };
    }, e2.forwardRef = function(e3) {
      return {
        $$typeof: c2,
        render: e3
      };
    }, e2.isValidElement = ne2, e2.lazy = function(e3) {
      return {
        $$typeof: d2,
        _payload: {
          _status: -1,
          _result: e3
        },
        _init: j2
      };
    }, e2.memo = function(e3, t3) {
      return {
        $$typeof: u2,
        type: e3,
        compare: t3 === void 0 ? null : t3
      };
    }, e2.startTransition = function(e3) {
      var t3 = w2.T, n3 = {};
      w2.T = n3;
      try {
        var r3 = e3(), i3 = w2.S;
        i3 !== null && i3(n3, r3), typeof r3 == `object` && r3 && typeof r3.then == `function` && r3.then(C2, M2);
      } catch (e4) {
        M2(e4);
      } finally {
        t3 !== null && n3.types !== null && (t3.types = n3.types), w2.T = t3;
      }
    }, e2.unstable_useCacheRefresh = function() {
      return w2.H.useCacheRefresh();
    }, e2.use = function(e3) {
      return w2.H.use(e3);
    }, e2.useActionState = function(e3, t3, n3) {
      return w2.H.useActionState(e3, t3, n3);
    }, e2.useCallback = function(e3, t3) {
      return w2.H.useCallback(e3, t3);
    }, e2.useContext = function(e3) {
      return w2.H.useContext(e3);
    }, e2.useDebugValue = function() {
    }, e2.useDeferredValue = function(e3, t3) {
      return w2.H.useDeferredValue(e3, t3);
    }, e2.useEffect = function(e3, t3) {
      return w2.H.useEffect(e3, t3);
    }, e2.useEffectEvent = function(e3) {
      return w2.H.useEffectEvent(e3);
    }, e2.useId = function() {
      return w2.H.useId();
    }, e2.useImperativeHandle = function(e3, t3, n3) {
      return w2.H.useImperativeHandle(e3, t3, n3);
    }, e2.useInsertionEffect = function(e3, t3) {
      return w2.H.useInsertionEffect(e3, t3);
    }, e2.useLayoutEffect = function(e3, t3) {
      return w2.H.useLayoutEffect(e3, t3);
    }, e2.useMemo = function(e3, t3) {
      return w2.H.useMemo(e3, t3);
    }, e2.useOptimistic = function(e3, t3) {
      return w2.H.useOptimistic(e3, t3);
    }, e2.useReducer = function(e3, t3, n3) {
      return w2.H.useReducer(e3, t3, n3);
    }, e2.useRef = function(e3) {
      return w2.H.useRef(e3);
    }, e2.useState = function(e3) {
      return w2.H.useState(e3);
    }, e2.useSyncExternalStore = function(e3, t3, n3) {
      return w2.H.useSyncExternalStore(e3, t3, n3);
    }, e2.useTransition = function() {
      return w2.H.useTransition();
    }, e2.version = `19.2.7`;
  })), u = o(((e2, t2) => {
    t2.exports = l();
  })), d = o(((e2) => {
    function t2(e3, t3) {
      var n3 = e3.length;
      e3.push(t3);
      a: for (; 0 < n3; ) {
        var r3 = n3 - 1 >>> 1, a3 = e3[r3];
        if (0 < i2(a3, t3)) e3[r3] = t3, e3[n3] = a3, n3 = r3;
        else break a;
      }
    }
    function n2(e3) {
      return e3.length === 0 ? null : e3[0];
    }
    function r2(e3) {
      if (e3.length === 0) return null;
      var t3 = e3[0], n3 = e3.pop();
      if (n3 !== t3) {
        e3[0] = n3;
        a: for (var r3 = 0, a3 = e3.length, o3 = a3 >>> 1; r3 < o3; ) {
          var s3 = 2 * (r3 + 1) - 1, c3 = e3[s3], l3 = s3 + 1, u3 = e3[l3];
          if (0 > i2(c3, n3)) l3 < a3 && 0 > i2(u3, c3) ? (e3[r3] = u3, e3[l3] = n3, r3 = l3) : (e3[r3] = c3, e3[s3] = n3, r3 = s3);
          else if (l3 < a3 && 0 > i2(u3, n3)) e3[r3] = u3, e3[l3] = n3, r3 = l3;
          else break a;
        }
      }
      return t3;
    }
    function i2(e3, t3) {
      var n3 = e3.sortIndex - t3.sortIndex;
      return n3 === 0 ? e3.id - t3.id : n3;
    }
    if (e2.unstable_now = void 0, typeof performance == `object` && typeof performance.now == `function`) {
      var a2 = performance;
      e2.unstable_now = function() {
        return a2.now();
      };
    } else {
      var o2 = Date, s2 = o2.now();
      e2.unstable_now = function() {
        return o2.now() - s2;
      };
    }
    var c2 = [], l2 = [], u2 = 1, d2 = null, f2 = 3, p2 = false, m2 = false, h2 = false, g2 = false, _2 = typeof setTimeout == `function` ? setTimeout : null, v2 = typeof clearTimeout == `function` ? clearTimeout : null, y2 = typeof setImmediate < `u` ? setImmediate : null;
    function b2(e3) {
      for (var i3 = n2(l2); i3 !== null; ) {
        if (i3.callback === null) r2(l2);
        else if (i3.startTime <= e3) r2(l2), i3.sortIndex = i3.expirationTime, t2(c2, i3);
        else break;
        i3 = n2(l2);
      }
    }
    function x2(e3) {
      if (h2 = false, b2(e3), !m2) if (n2(c2) !== null) m2 = true, S2 || (S2 = true, ne2());
      else {
        var t3 = n2(l2);
        t3 !== null && D2(x2, t3.startTime - e3);
      }
    }
    var S2 = false, C2 = -1, w2 = 5, ee2 = -1;
    function T2() {
      return g2 ? true : !(e2.unstable_now() - ee2 < w2);
    }
    function te2() {
      if (g2 = false, S2) {
        var t3 = e2.unstable_now();
        ee2 = t3;
        var i3 = true;
        try {
          a: {
            m2 = false, h2 && (h2 = false, v2(C2), C2 = -1), p2 = true;
            var a3 = f2;
            try {
              b: {
                for (b2(t3), d2 = n2(c2); d2 !== null && !(d2.expirationTime > t3 && T2()); ) {
                  var o3 = d2.callback;
                  if (typeof o3 == `function`) {
                    d2.callback = null, f2 = d2.priorityLevel;
                    var s3 = o3(d2.expirationTime <= t3);
                    if (t3 = e2.unstable_now(), typeof s3 == `function`) {
                      d2.callback = s3, b2(t3), i3 = true;
                      break b;
                    }
                    d2 === n2(c2) && r2(c2), b2(t3);
                  } else r2(c2);
                  d2 = n2(c2);
                }
                if (d2 !== null) i3 = true;
                else {
                  var u3 = n2(l2);
                  u3 !== null && D2(x2, u3.startTime - t3), i3 = false;
                }
              }
              break a;
            } finally {
              d2 = null, f2 = a3, p2 = false;
            }
            i3 = void 0;
          }
        } finally {
          i3 ? ne2() : S2 = false;
        }
      }
    }
    var ne2;
    if (typeof y2 == `function`) ne2 = function() {
      y2(te2);
    };
    else if (typeof MessageChannel < `u`) {
      var re2 = new MessageChannel(), E2 = re2.port2;
      re2.port1.onmessage = te2, ne2 = function() {
        E2.postMessage(null);
      };
    } else ne2 = function() {
      _2(te2, 0);
    };
    function D2(t3, n3) {
      C2 = _2(function() {
        t3(e2.unstable_now());
      }, n3);
    }
    e2.unstable_IdlePriority = 5, e2.unstable_ImmediatePriority = 1, e2.unstable_LowPriority = 4, e2.unstable_NormalPriority = 3, e2.unstable_Profiling = null, e2.unstable_UserBlockingPriority = 2, e2.unstable_cancelCallback = function(e3) {
      e3.callback = null;
    }, e2.unstable_forceFrameRate = function(e3) {
      0 > e3 || 125 < e3 ? console.error(`forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported`) : w2 = 0 < e3 ? Math.floor(1e3 / e3) : 5;
    }, e2.unstable_getCurrentPriorityLevel = function() {
      return f2;
    }, e2.unstable_next = function(e3) {
      switch (f2) {
        case 1:
        case 2:
        case 3:
          var t3 = 3;
          break;
        default:
          t3 = f2;
      }
      var n3 = f2;
      f2 = t3;
      try {
        return e3();
      } finally {
        f2 = n3;
      }
    }, e2.unstable_requestPaint = function() {
      g2 = true;
    }, e2.unstable_runWithPriority = function(e3, t3) {
      switch (e3) {
        case 1:
        case 2:
        case 3:
        case 4:
        case 5:
          break;
        default:
          e3 = 3;
      }
      var n3 = f2;
      f2 = e3;
      try {
        return t3();
      } finally {
        f2 = n3;
      }
    }, e2.unstable_scheduleCallback = function(r3, i3, a3) {
      var o3 = e2.unstable_now();
      switch (typeof a3 == `object` && a3 ? (a3 = a3.delay, a3 = typeof a3 == `number` && 0 < a3 ? o3 + a3 : o3) : a3 = o3, r3) {
        case 1:
          var s3 = -1;
          break;
        case 2:
          s3 = 250;
          break;
        case 5:
          s3 = 1073741823;
          break;
        case 4:
          s3 = 1e4;
          break;
        default:
          s3 = 5e3;
      }
      return s3 = a3 + s3, r3 = {
        id: u2++,
        callback: i3,
        priorityLevel: r3,
        startTime: a3,
        expirationTime: s3,
        sortIndex: -1
      }, a3 > o3 ? (r3.sortIndex = a3, t2(l2, r3), n2(c2) === null && r3 === n2(l2) && (h2 ? (v2(C2), C2 = -1) : h2 = true, D2(x2, a3 - o3))) : (r3.sortIndex = s3, t2(c2, r3), m2 || p2 || (m2 = true, S2 || (S2 = true, ne2()))), r3;
    }, e2.unstable_shouldYield = T2, e2.unstable_wrapCallback = function(e3) {
      var t3 = f2;
      return function() {
        var n3 = f2;
        f2 = t3;
        try {
          return e3.apply(this, arguments);
        } finally {
          f2 = n3;
        }
      };
    };
  })), f = o(((e2, t2) => {
    t2.exports = d();
  })), p = o(((e2) => {
    var t2 = u();
    function n2(e3) {
      var t3 = `https://react.dev/errors/` + e3;
      if (1 < arguments.length) {
        t3 += `?args[]=` + encodeURIComponent(arguments[1]);
        for (var n3 = 2; n3 < arguments.length; n3++) t3 += `&args[]=` + encodeURIComponent(arguments[n3]);
      }
      return `Minified React error #` + e3 + `; visit ` + t3 + ` for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`;
    }
    function r2() {
    }
    var i2 = {
      d: {
        f: r2,
        r: function() {
          throw Error(n2(522));
        },
        D: r2,
        C: r2,
        L: r2,
        m: r2,
        X: r2,
        S: r2,
        M: r2
      },
      p: 0,
      findDOMNode: null
    }, a2 = /* @__PURE__ */ Symbol.for(`react.portal`);
    function o2(e3, t3, n3) {
      var r3 = 3 < arguments.length && arguments[3] !== void 0 ? arguments[3] : null;
      return {
        $$typeof: a2,
        key: r3 == null ? null : `` + r3,
        children: e3,
        containerInfo: t3,
        implementation: n3
      };
    }
    var s2 = t2.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
    function c2(e3, t3) {
      if (e3 === `font`) return ``;
      if (typeof t3 == `string`) return t3 === `use-credentials` ? t3 : ``;
    }
    e2.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = i2, e2.createPortal = function(e3, t3) {
      var r3 = 2 < arguments.length && arguments[2] !== void 0 ? arguments[2] : null;
      if (!t3 || t3.nodeType !== 1 && t3.nodeType !== 9 && t3.nodeType !== 11) throw Error(n2(299));
      return o2(e3, t3, null, r3);
    }, e2.flushSync = function(e3) {
      var t3 = s2.T, n3 = i2.p;
      try {
        if (s2.T = null, i2.p = 2, e3) return e3();
      } finally {
        s2.T = t3, i2.p = n3, i2.d.f();
      }
    }, e2.preconnect = function(e3, t3) {
      typeof e3 == `string` && (t3 ? (t3 = t3.crossOrigin, t3 = typeof t3 == `string` ? t3 === `use-credentials` ? t3 : `` : void 0) : t3 = null, i2.d.C(e3, t3));
    }, e2.prefetchDNS = function(e3) {
      typeof e3 == `string` && i2.d.D(e3);
    }, e2.preinit = function(e3, t3) {
      if (typeof e3 == `string` && t3 && typeof t3.as == `string`) {
        var n3 = t3.as, r3 = c2(n3, t3.crossOrigin), a3 = typeof t3.integrity == `string` ? t3.integrity : void 0, o3 = typeof t3.fetchPriority == `string` ? t3.fetchPriority : void 0;
        n3 === `style` ? i2.d.S(e3, typeof t3.precedence == `string` ? t3.precedence : void 0, {
          crossOrigin: r3,
          integrity: a3,
          fetchPriority: o3
        }) : n3 === `script` && i2.d.X(e3, {
          crossOrigin: r3,
          integrity: a3,
          fetchPriority: o3,
          nonce: typeof t3.nonce == `string` ? t3.nonce : void 0
        });
      }
    }, e2.preinitModule = function(e3, t3) {
      if (typeof e3 == `string`) if (typeof t3 == `object` && t3) {
        if (t3.as == null || t3.as === `script`) {
          var n3 = c2(t3.as, t3.crossOrigin);
          i2.d.M(e3, {
            crossOrigin: n3,
            integrity: typeof t3.integrity == `string` ? t3.integrity : void 0,
            nonce: typeof t3.nonce == `string` ? t3.nonce : void 0
          });
        }
      } else t3 ?? i2.d.M(e3);
    }, e2.preload = function(e3, t3) {
      if (typeof e3 == `string` && typeof t3 == `object` && t3 && typeof t3.as == `string`) {
        var n3 = t3.as, r3 = c2(n3, t3.crossOrigin);
        i2.d.L(e3, n3, {
          crossOrigin: r3,
          integrity: typeof t3.integrity == `string` ? t3.integrity : void 0,
          nonce: typeof t3.nonce == `string` ? t3.nonce : void 0,
          type: typeof t3.type == `string` ? t3.type : void 0,
          fetchPriority: typeof t3.fetchPriority == `string` ? t3.fetchPriority : void 0,
          referrerPolicy: typeof t3.referrerPolicy == `string` ? t3.referrerPolicy : void 0,
          imageSrcSet: typeof t3.imageSrcSet == `string` ? t3.imageSrcSet : void 0,
          imageSizes: typeof t3.imageSizes == `string` ? t3.imageSizes : void 0,
          media: typeof t3.media == `string` ? t3.media : void 0
        });
      }
    }, e2.preloadModule = function(e3, t3) {
      if (typeof e3 == `string`) if (t3) {
        var n3 = c2(t3.as, t3.crossOrigin);
        i2.d.m(e3, {
          as: typeof t3.as == `string` && t3.as !== `script` ? t3.as : void 0,
          crossOrigin: n3,
          integrity: typeof t3.integrity == `string` ? t3.integrity : void 0
        });
      } else i2.d.m(e3);
    }, e2.requestFormReset = function(e3) {
      i2.d.r(e3);
    }, e2.unstable_batchedUpdates = function(e3, t3) {
      return e3(t3);
    }, e2.useFormState = function(e3, t3, n3) {
      return s2.H.useFormState(e3, t3, n3);
    }, e2.useFormStatus = function() {
      return s2.H.useHostTransitionStatus();
    }, e2.version = `19.2.7`;
  })), m = o(((e2, t2) => {
    function n2() {
      if (!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > `u` || typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE != `function`)) try {
        __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(n2);
      } catch (e3) {
        console.error(e3);
      }
    }
    n2(), t2.exports = p();
  })), h = o(((e2) => {
    var t2 = f(), n2 = u(), r2 = m();
    function i2(e3) {
      var t3 = `https://react.dev/errors/` + e3;
      if (1 < arguments.length) {
        t3 += `?args[]=` + encodeURIComponent(arguments[1]);
        for (var n3 = 2; n3 < arguments.length; n3++) t3 += `&args[]=` + encodeURIComponent(arguments[n3]);
      }
      return `Minified React error #` + e3 + `; visit ` + t3 + ` for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`;
    }
    function a2(e3) {
      return !(!e3 || e3.nodeType !== 1 && e3.nodeType !== 9 && e3.nodeType !== 11);
    }
    function o2(e3) {
      var t3 = e3, n3 = e3;
      if (e3.alternate) for (; t3.return; ) t3 = t3.return;
      else {
        e3 = t3;
        do
          t3 = e3, t3.flags & 4098 && (n3 = t3.return), e3 = t3.return;
        while (e3);
      }
      return t3.tag === 3 ? n3 : null;
    }
    function s2(e3) {
      if (e3.tag === 13) {
        var t3 = e3.memoizedState;
        if (t3 === null && (e3 = e3.alternate, e3 !== null && (t3 = e3.memoizedState)), t3 !== null) return t3.dehydrated;
      }
      return null;
    }
    function c2(e3) {
      if (e3.tag === 31) {
        var t3 = e3.memoizedState;
        if (t3 === null && (e3 = e3.alternate, e3 !== null && (t3 = e3.memoizedState)), t3 !== null) return t3.dehydrated;
      }
      return null;
    }
    function l2(e3) {
      if (o2(e3) !== e3) throw Error(i2(188));
    }
    function d2(e3) {
      var t3 = e3.alternate;
      if (!t3) {
        if (t3 = o2(e3), t3 === null) throw Error(i2(188));
        return t3 === e3 ? e3 : null;
      }
      for (var n3 = e3, r3 = t3; ; ) {
        var a3 = n3.return;
        if (a3 === null) break;
        var s3 = a3.alternate;
        if (s3 === null) {
          if (r3 = a3.return, r3 !== null) {
            n3 = r3;
            continue;
          }
          break;
        }
        if (a3.child === s3.child) {
          for (s3 = a3.child; s3; ) {
            if (s3 === n3) return l2(a3), e3;
            if (s3 === r3) return l2(a3), t3;
            s3 = s3.sibling;
          }
          throw Error(i2(188));
        }
        if (n3.return !== r3.return) n3 = a3, r3 = s3;
        else {
          for (var c3 = false, u2 = a3.child; u2; ) {
            if (u2 === n3) {
              c3 = true, n3 = a3, r3 = s3;
              break;
            }
            if (u2 === r3) {
              c3 = true, r3 = a3, n3 = s3;
              break;
            }
            u2 = u2.sibling;
          }
          if (!c3) {
            for (u2 = s3.child; u2; ) {
              if (u2 === n3) {
                c3 = true, n3 = s3, r3 = a3;
                break;
              }
              if (u2 === r3) {
                c3 = true, r3 = s3, n3 = a3;
                break;
              }
              u2 = u2.sibling;
            }
            if (!c3) throw Error(i2(189));
          }
        }
        if (n3.alternate !== r3) throw Error(i2(190));
      }
      if (n3.tag !== 3) throw Error(i2(188));
      return n3.stateNode.current === n3 ? e3 : t3;
    }
    function p2(e3) {
      var t3 = e3.tag;
      if (t3 === 5 || t3 === 26 || t3 === 27 || t3 === 6) return e3;
      for (e3 = e3.child; e3 !== null; ) {
        if (t3 = p2(e3), t3 !== null) return t3;
        e3 = e3.sibling;
      }
      return null;
    }
    var h2 = Object.assign, g2 = /* @__PURE__ */ Symbol.for(`react.element`), _2 = /* @__PURE__ */ Symbol.for(`react.transitional.element`), v2 = /* @__PURE__ */ Symbol.for(`react.portal`), y2 = /* @__PURE__ */ Symbol.for(`react.fragment`), b2 = /* @__PURE__ */ Symbol.for(`react.strict_mode`), x2 = /* @__PURE__ */ Symbol.for(`react.profiler`), S2 = /* @__PURE__ */ Symbol.for(`react.consumer`), C2 = /* @__PURE__ */ Symbol.for(`react.context`), w2 = /* @__PURE__ */ Symbol.for(`react.forward_ref`), ee2 = /* @__PURE__ */ Symbol.for(`react.suspense`), T2 = /* @__PURE__ */ Symbol.for(`react.suspense_list`), te2 = /* @__PURE__ */ Symbol.for(`react.memo`), ne2 = /* @__PURE__ */ Symbol.for(`react.lazy`), re2 = /* @__PURE__ */ Symbol.for(`react.activity`), E2 = /* @__PURE__ */ Symbol.for(`react.memo_cache_sentinel`), D2 = Symbol.iterator;
    function O2(e3) {
      return typeof e3 != `object` || !e3 ? null : (e3 = D2 && e3[D2] || e3[`@@iterator`], typeof e3 == `function` ? e3 : null);
    }
    var k2 = /* @__PURE__ */ Symbol.for(`react.client.reference`);
    function A2(e3) {
      if (e3 == null) return null;
      if (typeof e3 == `function`) return e3.$$typeof === k2 ? null : e3.displayName || e3.name || null;
      if (typeof e3 == `string`) return e3;
      switch (e3) {
        case y2:
          return `Fragment`;
        case x2:
          return `Profiler`;
        case b2:
          return `StrictMode`;
        case ee2:
          return `Suspense`;
        case T2:
          return `SuspenseList`;
        case re2:
          return `Activity`;
      }
      if (typeof e3 == `object`) switch (e3.$$typeof) {
        case v2:
          return `Portal`;
        case C2:
          return e3.displayName || `Context`;
        case S2:
          return (e3._context.displayName || `Context`) + `.Consumer`;
        case w2:
          var t3 = e3.render;
          return e3 = e3.displayName, e3 ||= (e3 = t3.displayName || t3.name || ``, e3 === `` ? `ForwardRef` : `ForwardRef(` + e3 + `)`), e3;
        case te2:
          return t3 = e3.displayName || null, t3 === null ? A2(e3.type) || `Memo` : t3;
        case ne2:
          t3 = e3._payload, e3 = e3._init;
          try {
            return A2(e3(t3));
          } catch {
          }
      }
      return null;
    }
    var j2 = Array.isArray, M2 = n2.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, N2 = r2.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, ie2 = {
      pending: false,
      data: null,
      method: null,
      action: null
    }, P2 = [], F2 = -1;
    function ae2(e3) {
      return {
        current: e3
      };
    }
    function oe2(e3) {
      0 > F2 || (e3.current = P2[F2], P2[F2] = null, F2--);
    }
    function se2(e3, t3) {
      F2++, P2[F2] = e3.current, e3.current = t3;
    }
    var ce2 = ae2(null), le2 = ae2(null), ue2 = ae2(null), de2 = ae2(null);
    function fe2(e3, t3) {
      switch (se2(ue2, t3), se2(le2, e3), se2(ce2, null), t3.nodeType) {
        case 9:
        case 11:
          e3 = (e3 = t3.documentElement) && (e3 = e3.namespaceURI) ? Hd(e3) : 0;
          break;
        default:
          if (e3 = t3.tagName, t3 = t3.namespaceURI) t3 = Hd(t3), e3 = Ud(t3, e3);
          else switch (e3) {
            case `svg`:
              e3 = 1;
              break;
            case `math`:
              e3 = 2;
              break;
            default:
              e3 = 0;
          }
      }
      oe2(ce2), se2(ce2, e3);
    }
    function pe2() {
      oe2(ce2), oe2(le2), oe2(ue2);
    }
    function me2(e3) {
      e3.memoizedState !== null && se2(de2, e3);
      var t3 = ce2.current, n3 = Ud(t3, e3.type);
      t3 !== n3 && (se2(le2, e3), se2(ce2, n3));
    }
    function he2(e3) {
      le2.current === e3 && (oe2(ce2), oe2(le2)), de2.current === e3 && (oe2(de2), $f._currentValue = ie2);
    }
    var ge2, _e2;
    function ve2(e3) {
      if (ge2 === void 0) try {
        throw Error();
      } catch (e4) {
        var t3 = e4.stack.trim().match(/\n( *(at )?)/);
        ge2 = t3 && t3[1] || ``, _e2 = -1 < e4.stack.indexOf(`
    at`) ? ` (<anonymous>)` : -1 < e4.stack.indexOf(`@`) ? `@unknown:0:0` : ``;
      }
      return `
` + ge2 + e3 + _e2;
    }
    var ye2 = false;
    function be2(e3, t3) {
      if (!e3 || ye2) return ``;
      ye2 = true;
      var n3 = Error.prepareStackTrace;
      Error.prepareStackTrace = void 0;
      try {
        var r3 = {
          DetermineComponentFrameRoot: function() {
            try {
              if (t3) {
                var n4 = function() {
                  throw Error();
                };
                if (Object.defineProperty(n4.prototype, "props", {
                  set: function() {
                    throw Error();
                  }
                }), typeof Reflect == `object` && Reflect.construct) {
                  try {
                    Reflect.construct(n4, []);
                  } catch (e4) {
                    var r4 = e4;
                  }
                  Reflect.construct(e3, [], n4);
                } else {
                  try {
                    n4.call();
                  } catch (e4) {
                    r4 = e4;
                  }
                  e3.call(n4.prototype);
                }
              } else {
                try {
                  throw Error();
                } catch (e4) {
                  r4 = e4;
                }
                (n4 = e3()) && typeof n4.catch == `function` && n4.catch(function() {
                });
              }
            } catch (e4) {
              if (e4 && r4 && typeof e4.stack == `string`) return [
                e4.stack,
                r4.stack
              ];
            }
            return [
              null,
              null
            ];
          }
        };
        r3.DetermineComponentFrameRoot.displayName = `DetermineComponentFrameRoot`;
        var i3 = Object.getOwnPropertyDescriptor(r3.DetermineComponentFrameRoot, `name`);
        i3 && i3.configurable && Object.defineProperty(r3.DetermineComponentFrameRoot, "name", {
          value: `DetermineComponentFrameRoot`
        });
        var a3 = r3.DetermineComponentFrameRoot(), o3 = a3[0], s3 = a3[1];
        if (o3 && s3) {
          var c3 = o3.split(`
`), l3 = s3.split(`
`);
          for (i3 = r3 = 0; r3 < c3.length && !c3[r3].includes(`DetermineComponentFrameRoot`); ) r3++;
          for (; i3 < l3.length && !l3[i3].includes(`DetermineComponentFrameRoot`); ) i3++;
          if (r3 === c3.length || i3 === l3.length) for (r3 = c3.length - 1, i3 = l3.length - 1; 1 <= r3 && 0 <= i3 && c3[r3] !== l3[i3]; ) i3--;
          for (; 1 <= r3 && 0 <= i3; r3--, i3--) if (c3[r3] !== l3[i3]) {
            if (r3 !== 1 || i3 !== 1) do
              if (r3--, i3--, 0 > i3 || c3[r3] !== l3[i3]) {
                var u2 = `
` + c3[r3].replace(` at new `, ` at `);
                return e3.displayName && u2.includes(`<anonymous>`) && (u2 = u2.replace(`<anonymous>`, e3.displayName)), u2;
              }
            while (1 <= r3 && 0 <= i3);
            break;
          }
        }
      } finally {
        ye2 = false, Error.prepareStackTrace = n3;
      }
      return (n3 = e3 ? e3.displayName || e3.name : ``) ? ve2(n3) : ``;
    }
    function xe2(e3, t3) {
      switch (e3.tag) {
        case 26:
        case 27:
        case 5:
          return ve2(e3.type);
        case 16:
          return ve2(`Lazy`);
        case 13:
          return e3.child !== t3 && t3 !== null ? ve2(`Suspense Fallback`) : ve2(`Suspense`);
        case 19:
          return ve2(`SuspenseList`);
        case 0:
        case 15:
          return be2(e3.type, false);
        case 11:
          return be2(e3.type.render, false);
        case 1:
          return be2(e3.type, true);
        case 31:
          return ve2(`Activity`);
        default:
          return ``;
      }
    }
    function Se2(e3) {
      try {
        var t3 = ``, n3 = null;
        do
          t3 += xe2(e3, n3), n3 = e3, e3 = e3.return;
        while (e3);
        return t3;
      } catch (e4) {
        return `
Error generating stack: ` + e4.message + `
` + e4.stack;
      }
    }
    var Ce2 = Object.prototype.hasOwnProperty, we2 = t2.unstable_scheduleCallback, Te2 = t2.unstable_cancelCallback, Ee2 = t2.unstable_shouldYield, De2 = t2.unstable_requestPaint, Oe2 = t2.unstable_now, ke2 = t2.unstable_getCurrentPriorityLevel, Ae2 = t2.unstable_ImmediatePriority, je2 = t2.unstable_UserBlockingPriority, Me2 = t2.unstable_NormalPriority, Ne2 = t2.unstable_LowPriority, Pe2 = t2.unstable_IdlePriority, Fe2 = t2.log, Ie2 = t2.unstable_setDisableYieldValue, I2 = null, Le2 = null;
    function Re2(e3) {
      if (typeof Fe2 == `function` && Ie2(e3), Le2 && typeof Le2.setStrictMode == `function`) try {
        Le2.setStrictMode(I2, e3);
      } catch {
      }
    }
    var ze2 = Math.clz32 ? Math.clz32 : Ve2, Be2 = Math.log, R2 = Math.LN2;
    function Ve2(e3) {
      return e3 >>>= 0, e3 === 0 ? 32 : 31 - (Be2(e3) / R2 | 0) | 0;
    }
    var He2 = 256, Ue2 = 262144, We2 = 4194304;
    function Ge2(e3) {
      var t3 = e3 & 42;
      if (t3 !== 0) return t3;
      switch (e3 & -e3) {
        case 1:
          return 1;
        case 2:
          return 2;
        case 4:
          return 4;
        case 8:
          return 8;
        case 16:
          return 16;
        case 32:
          return 32;
        case 64:
          return 64;
        case 128:
          return 128;
        case 256:
        case 512:
        case 1024:
        case 2048:
        case 4096:
        case 8192:
        case 16384:
        case 32768:
        case 65536:
        case 131072:
          return e3 & 261888;
        case 262144:
        case 524288:
        case 1048576:
        case 2097152:
          return e3 & 3932160;
        case 4194304:
        case 8388608:
        case 16777216:
        case 33554432:
          return e3 & 62914560;
        case 67108864:
          return 67108864;
        case 134217728:
          return 134217728;
        case 268435456:
          return 268435456;
        case 536870912:
          return 536870912;
        case 1073741824:
          return 0;
        default:
          return e3;
      }
    }
    function Ke2(e3, t3, n3) {
      var r3 = e3.pendingLanes;
      if (r3 === 0) return 0;
      var i3 = 0, a3 = e3.suspendedLanes, o3 = e3.pingedLanes;
      e3 = e3.warmLanes;
      var s3 = r3 & 134217727;
      return s3 === 0 ? (s3 = r3 & ~a3, s3 === 0 ? o3 === 0 ? n3 || (n3 = r3 & ~e3, n3 !== 0 && (i3 = Ge2(n3))) : i3 = Ge2(o3) : i3 = Ge2(s3)) : (r3 = s3 & ~a3, r3 === 0 ? (o3 &= s3, o3 === 0 ? n3 || (n3 = s3 & ~e3, n3 !== 0 && (i3 = Ge2(n3))) : i3 = Ge2(o3)) : i3 = Ge2(r3)), i3 === 0 ? 0 : t3 !== 0 && t3 !== i3 && (t3 & a3) === 0 && (a3 = i3 & -i3, n3 = t3 & -t3, a3 >= n3 || a3 === 32 && n3 & 4194048) ? t3 : i3;
    }
    function qe2(e3, t3) {
      return (e3.pendingLanes & ~(e3.suspendedLanes & ~e3.pingedLanes) & t3) === 0;
    }
    function Je2(e3, t3) {
      switch (e3) {
        case 1:
        case 2:
        case 4:
        case 8:
        case 64:
          return t3 + 250;
        case 16:
        case 32:
        case 128:
        case 256:
        case 512:
        case 1024:
        case 2048:
        case 4096:
        case 8192:
        case 16384:
        case 32768:
        case 65536:
        case 131072:
        case 262144:
        case 524288:
        case 1048576:
        case 2097152:
          return t3 + 5e3;
        case 4194304:
        case 8388608:
        case 16777216:
        case 33554432:
          return -1;
        case 67108864:
        case 134217728:
        case 268435456:
        case 536870912:
        case 1073741824:
          return -1;
        default:
          return -1;
      }
    }
    function Ye2() {
      var e3 = We2;
      return We2 <<= 1, !(We2 & 62914560) && (We2 = 4194304), e3;
    }
    function Xe2(e3) {
      for (var t3 = [], n3 = 0; 31 > n3; n3++) t3.push(e3);
      return t3;
    }
    function z2(e3, t3) {
      e3.pendingLanes |= t3, t3 !== 268435456 && (e3.suspendedLanes = 0, e3.pingedLanes = 0, e3.warmLanes = 0);
    }
    function Ze2(e3, t3, n3, r3, i3, a3) {
      var o3 = e3.pendingLanes;
      e3.pendingLanes = n3, e3.suspendedLanes = 0, e3.pingedLanes = 0, e3.warmLanes = 0, e3.expiredLanes &= n3, e3.entangledLanes &= n3, e3.errorRecoveryDisabledLanes &= n3, e3.shellSuspendCounter = 0;
      var s3 = e3.entanglements, c3 = e3.expirationTimes, l3 = e3.hiddenUpdates;
      for (n3 = o3 & ~n3; 0 < n3; ) {
        var u2 = 31 - ze2(n3), d3 = 1 << u2;
        s3[u2] = 0, c3[u2] = -1;
        var f2 = l3[u2];
        if (f2 !== null) for (l3[u2] = null, u2 = 0; u2 < f2.length; u2++) {
          var p3 = f2[u2];
          p3 !== null && (p3.lane &= -536870913);
        }
        n3 &= ~d3;
      }
      r3 !== 0 && Qe2(e3, r3, 0), a3 !== 0 && i3 === 0 && e3.tag !== 0 && (e3.suspendedLanes |= a3 & ~(o3 & ~t3));
    }
    function Qe2(e3, t3, n3) {
      e3.pendingLanes |= t3, e3.suspendedLanes &= ~t3;
      var r3 = 31 - ze2(t3);
      e3.entangledLanes |= t3, e3.entanglements[r3] = e3.entanglements[r3] | 1073741824 | n3 & 261930;
    }
    function $e2(e3, t3) {
      var n3 = e3.entangledLanes |= t3;
      for (e3 = e3.entanglements; n3; ) {
        var r3 = 31 - ze2(n3), i3 = 1 << r3;
        i3 & t3 | e3[r3] & t3 && (e3[r3] |= t3), n3 &= ~i3;
      }
    }
    function et2(e3, t3) {
      var n3 = t3 & -t3;
      return n3 = n3 & 42 ? 1 : tt2(n3), (n3 & (e3.suspendedLanes | t3)) === 0 ? n3 : 0;
    }
    function tt2(e3) {
      switch (e3) {
        case 2:
          e3 = 1;
          break;
        case 8:
          e3 = 4;
          break;
        case 32:
          e3 = 16;
          break;
        case 256:
        case 512:
        case 1024:
        case 2048:
        case 4096:
        case 8192:
        case 16384:
        case 32768:
        case 65536:
        case 131072:
        case 262144:
        case 524288:
        case 1048576:
        case 2097152:
        case 4194304:
        case 8388608:
        case 16777216:
        case 33554432:
          e3 = 128;
          break;
        case 268435456:
          e3 = 134217728;
          break;
        default:
          e3 = 0;
      }
      return e3;
    }
    function nt2(e3) {
      return e3 &= -e3, 2 < e3 ? 8 < e3 ? e3 & 134217727 ? 32 : 268435456 : 8 : 2;
    }
    function rt2() {
      var e3 = N2.p;
      return e3 === 0 ? (e3 = window.event, e3 === void 0 ? 32 : hp(e3.type)) : e3;
    }
    function it2(e3, t3) {
      var n3 = N2.p;
      try {
        return N2.p = e3, t3();
      } finally {
        N2.p = n3;
      }
    }
    var at2 = Math.random().toString(36).slice(2), ot2 = `__reactFiber$` + at2, st2 = `__reactProps$` + at2, ct2 = `__reactContainer$` + at2, lt2 = `__reactEvents$` + at2, ut2 = `__reactListeners$` + at2, dt2 = `__reactHandles$` + at2, ft2 = `__reactResources$` + at2, pt2 = `__reactMarker$` + at2;
    function mt2(e3) {
      delete e3[ot2], delete e3[st2], delete e3[lt2], delete e3[ut2], delete e3[dt2];
    }
    function ht2(e3) {
      var t3 = e3[ot2];
      if (t3) return t3;
      for (var n3 = e3.parentNode; n3; ) {
        if (t3 = n3[ct2] || n3[ot2]) {
          if (n3 = t3.alternate, t3.child !== null || n3 !== null && n3.child !== null) for (e3 = ff(e3); e3 !== null; ) {
            if (n3 = e3[ot2]) return n3;
            e3 = ff(e3);
          }
          return t3;
        }
        e3 = n3, n3 = e3.parentNode;
      }
      return null;
    }
    function gt2(e3) {
      if (e3 = e3[ot2] || e3[ct2]) {
        var t3 = e3.tag;
        if (t3 === 5 || t3 === 6 || t3 === 13 || t3 === 31 || t3 === 26 || t3 === 27 || t3 === 3) return e3;
      }
      return null;
    }
    function _t2(e3) {
      var t3 = e3.tag;
      if (t3 === 5 || t3 === 26 || t3 === 27 || t3 === 6) return e3.stateNode;
      throw Error(i2(33));
    }
    function vt2(e3) {
      var t3 = e3[ft2];
      return t3 ||= e3[ft2] = {
        hoistableStyles: /* @__PURE__ */ new Map(),
        hoistableScripts: /* @__PURE__ */ new Map()
      }, t3;
    }
    function B2(e3) {
      e3[pt2] = true;
    }
    var yt2 = /* @__PURE__ */ new Set(), V2 = {};
    function H2(e3, t3) {
      U2(e3, t3), U2(e3 + `Capture`, t3);
    }
    function U2(e3, t3) {
      for (V2[e3] = t3, e3 = 0; e3 < t3.length; e3++) yt2.add(t3[e3]);
    }
    var bt2 = RegExp(`^[:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD][:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\-.0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040]*$`), xt2 = {}, St2 = {};
    function Ct2(e3) {
      return Ce2.call(St2, e3) ? true : Ce2.call(xt2, e3) ? false : bt2.test(e3) ? St2[e3] = true : (xt2[e3] = true, false);
    }
    function W2(e3, t3, n3) {
      if (Ct2(t3)) if (n3 === null) e3.removeAttribute(t3);
      else {
        switch (typeof n3) {
          case `undefined`:
          case `function`:
          case `symbol`:
            e3.removeAttribute(t3);
            return;
          case `boolean`:
            var r3 = t3.toLowerCase().slice(0, 5);
            if (r3 !== `data-` && r3 !== `aria-`) {
              e3.removeAttribute(t3);
              return;
            }
        }
        e3.setAttribute(t3, `` + n3);
      }
    }
    function wt2(e3, t3, n3) {
      if (n3 === null) e3.removeAttribute(t3);
      else {
        switch (typeof n3) {
          case `undefined`:
          case `function`:
          case `symbol`:
          case `boolean`:
            e3.removeAttribute(t3);
            return;
        }
        e3.setAttribute(t3, `` + n3);
      }
    }
    function Tt2(e3, t3, n3, r3) {
      if (r3 === null) e3.removeAttribute(n3);
      else {
        switch (typeof r3) {
          case `undefined`:
          case `function`:
          case `symbol`:
          case `boolean`:
            e3.removeAttribute(n3);
            return;
        }
        e3.setAttributeNS(t3, n3, `` + r3);
      }
    }
    function Et2(e3) {
      switch (typeof e3) {
        case `bigint`:
        case `boolean`:
        case `number`:
        case `string`:
        case `undefined`:
          return e3;
        case `object`:
          return e3;
        default:
          return ``;
      }
    }
    function Dt2(e3) {
      var t3 = e3.type;
      return (e3 = e3.nodeName) && e3.toLowerCase() === `input` && (t3 === `checkbox` || t3 === `radio`);
    }
    function Ot2(e3, t3, n3) {
      var r3 = Object.getOwnPropertyDescriptor(e3.constructor.prototype, t3);
      if (!e3.hasOwnProperty(t3) && r3 !== void 0 && typeof r3.get == `function` && typeof r3.set == `function`) {
        var i3 = r3.get, a3 = r3.set;
        return Object.defineProperty(e3, t3, {
          configurable: true,
          get: function() {
            return i3.call(this);
          },
          set: function(e4) {
            n3 = `` + e4, a3.call(this, e4);
          }
        }), Object.defineProperty(e3, t3, {
          enumerable: r3.enumerable
        }), {
          getValue: function() {
            return n3;
          },
          setValue: function(e4) {
            n3 = `` + e4;
          },
          stopTracking: function() {
            e3._valueTracker = null, delete e3[t3];
          }
        };
      }
    }
    function kt2(e3) {
      if (!e3._valueTracker) {
        var t3 = Dt2(e3) ? `checked` : `value`;
        e3._valueTracker = Ot2(e3, t3, `` + e3[t3]);
      }
    }
    function At2(e3) {
      if (!e3) return false;
      var t3 = e3._valueTracker;
      if (!t3) return true;
      var n3 = t3.getValue(), r3 = ``;
      return e3 && (r3 = Dt2(e3) ? e3.checked ? `true` : `false` : e3.value), e3 = r3, e3 === n3 ? false : (t3.setValue(e3), true);
    }
    function jt2(e3) {
      if (e3 ||= typeof document < `u` ? document : void 0, e3 === void 0) return null;
      try {
        return e3.activeElement || e3.body;
      } catch {
        return e3.body;
      }
    }
    var Mt2 = /[\n"\\]/g;
    function Nt2(e3) {
      return e3.replace(Mt2, function(e4) {
        return `\\` + e4.charCodeAt(0).toString(16) + ` `;
      });
    }
    function Pt2(e3, t3, n3, r3, i3, a3, o3, s3) {
      e3.name = ``, o3 != null && typeof o3 != `function` && typeof o3 != `symbol` && typeof o3 != `boolean` ? e3.type = o3 : e3.removeAttribute(`type`), t3 == null ? o3 !== `submit` && o3 !== `reset` || e3.removeAttribute(`value`) : o3 === `number` ? (t3 === 0 && e3.value === `` || e3.value != t3) && (e3.value = `` + Et2(t3)) : e3.value !== `` + Et2(t3) && (e3.value = `` + Et2(t3)), t3 == null ? n3 == null ? r3 != null && e3.removeAttribute(`value`) : It2(e3, o3, Et2(n3)) : It2(e3, o3, Et2(t3)), i3 == null && a3 != null && (e3.defaultChecked = !!a3), i3 != null && (e3.checked = i3 && typeof i3 != `function` && typeof i3 != `symbol`), s3 != null && typeof s3 != `function` && typeof s3 != `symbol` && typeof s3 != `boolean` ? e3.name = `` + Et2(s3) : e3.removeAttribute(`name`);
    }
    function Ft2(e3, t3, n3, r3, i3, a3, o3, s3) {
      if (a3 != null && typeof a3 != `function` && typeof a3 != `symbol` && typeof a3 != `boolean` && (e3.type = a3), t3 != null || n3 != null) {
        if (!(a3 !== `submit` && a3 !== `reset` || t3 != null)) {
          kt2(e3);
          return;
        }
        n3 = n3 == null ? `` : `` + Et2(n3), t3 = t3 == null ? n3 : `` + Et2(t3), s3 || t3 === e3.value || (e3.value = t3), e3.defaultValue = t3;
      }
      r3 ??= i3, r3 = typeof r3 != `function` && typeof r3 != `symbol` && !!r3, e3.checked = s3 ? e3.checked : !!r3, e3.defaultChecked = !!r3, o3 != null && typeof o3 != `function` && typeof o3 != `symbol` && typeof o3 != `boolean` && (e3.name = o3), kt2(e3);
    }
    function It2(e3, t3, n3) {
      t3 === `number` && jt2(e3.ownerDocument) === e3 || e3.defaultValue === `` + n3 || (e3.defaultValue = `` + n3);
    }
    function Lt2(e3, t3, n3, r3) {
      if (e3 = e3.options, t3) {
        t3 = {};
        for (var i3 = 0; i3 < n3.length; i3++) t3[`$` + n3[i3]] = true;
        for (n3 = 0; n3 < e3.length; n3++) i3 = t3.hasOwnProperty(`$` + e3[n3].value), e3[n3].selected !== i3 && (e3[n3].selected = i3), i3 && r3 && (e3[n3].defaultSelected = true);
      } else {
        for (n3 = `` + Et2(n3), t3 = null, i3 = 0; i3 < e3.length; i3++) {
          if (e3[i3].value === n3) {
            e3[i3].selected = true, r3 && (e3[i3].defaultSelected = true);
            return;
          }
          t3 !== null || e3[i3].disabled || (t3 = e3[i3]);
        }
        t3 !== null && (t3.selected = true);
      }
    }
    function Rt2(e3, t3, n3) {
      if (t3 != null && (t3 = `` + Et2(t3), t3 !== e3.value && (e3.value = t3), n3 == null)) {
        e3.defaultValue !== t3 && (e3.defaultValue = t3);
        return;
      }
      e3.defaultValue = n3 == null ? `` : `` + Et2(n3);
    }
    function zt2(e3, t3, n3, r3) {
      if (t3 == null) {
        if (r3 != null) {
          if (n3 != null) throw Error(i2(92));
          if (j2(r3)) {
            if (1 < r3.length) throw Error(i2(93));
            r3 = r3[0];
          }
          n3 = r3;
        }
        n3 ??= ``, t3 = n3;
      }
      n3 = Et2(t3), e3.defaultValue = n3, r3 = e3.textContent, r3 === n3 && r3 !== `` && r3 !== null && (e3.value = r3), kt2(e3);
    }
    function Bt2(e3, t3) {
      if (t3) {
        var n3 = e3.firstChild;
        if (n3 && n3 === e3.lastChild && n3.nodeType === 3) {
          n3.nodeValue = t3;
          return;
        }
      }
      e3.textContent = t3;
    }
    var Vt2 = new Set(`animationIterationCount aspectRatio borderImageOutset borderImageSlice borderImageWidth boxFlex boxFlexGroup boxOrdinalGroup columnCount columns flex flexGrow flexPositive flexShrink flexNegative flexOrder gridArea gridRow gridRowEnd gridRowSpan gridRowStart gridColumn gridColumnEnd gridColumnSpan gridColumnStart fontWeight lineClamp lineHeight opacity order orphans scale tabSize widows zIndex zoom fillOpacity floodOpacity stopOpacity strokeDasharray strokeDashoffset strokeMiterlimit strokeOpacity strokeWidth MozAnimationIterationCount MozBoxFlex MozBoxFlexGroup MozLineClamp msAnimationIterationCount msFlex msZoom msFlexGrow msFlexNegative msFlexOrder msFlexPositive msFlexShrink msGridColumn msGridColumnSpan msGridRow msGridRowSpan WebkitAnimationIterationCount WebkitBoxFlex WebKitBoxFlexGroup WebkitBoxOrdinalGroup WebkitColumnCount WebkitColumns WebkitFlex WebkitFlexGrow WebkitFlexPositive WebkitFlexShrink WebkitLineClamp`.split(` `));
    function Ht2(e3, t3, n3) {
      var r3 = t3.indexOf(`--`) === 0;
      n3 == null || typeof n3 == `boolean` || n3 === `` ? r3 ? e3.setProperty(t3, ``) : t3 === `float` ? e3.cssFloat = `` : e3[t3] = `` : r3 ? e3.setProperty(t3, n3) : typeof n3 != `number` || n3 === 0 || Vt2.has(t3) ? t3 === `float` ? e3.cssFloat = n3 : e3[t3] = (`` + n3).trim() : e3[t3] = n3 + `px`;
    }
    function Ut2(e3, t3, n3) {
      if (t3 != null && typeof t3 != `object`) throw Error(i2(62));
      if (e3 = e3.style, n3 != null) {
        for (var r3 in n3) !n3.hasOwnProperty(r3) || t3 != null && t3.hasOwnProperty(r3) || (r3.indexOf(`--`) === 0 ? e3.setProperty(r3, ``) : r3 === `float` ? e3.cssFloat = `` : e3[r3] = ``);
        for (var a3 in t3) r3 = t3[a3], t3.hasOwnProperty(a3) && n3[a3] !== r3 && Ht2(e3, a3, r3);
      } else for (var o3 in t3) t3.hasOwnProperty(o3) && Ht2(e3, o3, t3[o3]);
    }
    function Wt2(e3) {
      if (e3.indexOf(`-`) === -1) return false;
      switch (e3) {
        case `annotation-xml`:
        case `color-profile`:
        case `font-face`:
        case `font-face-src`:
        case `font-face-uri`:
        case `font-face-format`:
        case `font-face-name`:
        case `missing-glyph`:
          return false;
        default:
          return true;
      }
    }
    var Gt2 = /* @__PURE__ */ new Map([
      [
        `acceptCharset`,
        `accept-charset`
      ],
      [
        `htmlFor`,
        `for`
      ],
      [
        `httpEquiv`,
        `http-equiv`
      ],
      [
        `crossOrigin`,
        `crossorigin`
      ],
      [
        `accentHeight`,
        `accent-height`
      ],
      [
        `alignmentBaseline`,
        `alignment-baseline`
      ],
      [
        `arabicForm`,
        `arabic-form`
      ],
      [
        `baselineShift`,
        `baseline-shift`
      ],
      [
        `capHeight`,
        `cap-height`
      ],
      [
        `clipPath`,
        `clip-path`
      ],
      [
        `clipRule`,
        `clip-rule`
      ],
      [
        `colorInterpolation`,
        `color-interpolation`
      ],
      [
        `colorInterpolationFilters`,
        `color-interpolation-filters`
      ],
      [
        `colorProfile`,
        `color-profile`
      ],
      [
        `colorRendering`,
        `color-rendering`
      ],
      [
        `dominantBaseline`,
        `dominant-baseline`
      ],
      [
        `enableBackground`,
        `enable-background`
      ],
      [
        `fillOpacity`,
        `fill-opacity`
      ],
      [
        `fillRule`,
        `fill-rule`
      ],
      [
        `floodColor`,
        `flood-color`
      ],
      [
        `floodOpacity`,
        `flood-opacity`
      ],
      [
        `fontFamily`,
        `font-family`
      ],
      [
        `fontSize`,
        `font-size`
      ],
      [
        `fontSizeAdjust`,
        `font-size-adjust`
      ],
      [
        `fontStretch`,
        `font-stretch`
      ],
      [
        `fontStyle`,
        `font-style`
      ],
      [
        `fontVariant`,
        `font-variant`
      ],
      [
        `fontWeight`,
        `font-weight`
      ],
      [
        `glyphName`,
        `glyph-name`
      ],
      [
        `glyphOrientationHorizontal`,
        `glyph-orientation-horizontal`
      ],
      [
        `glyphOrientationVertical`,
        `glyph-orientation-vertical`
      ],
      [
        `horizAdvX`,
        `horiz-adv-x`
      ],
      [
        `horizOriginX`,
        `horiz-origin-x`
      ],
      [
        `imageRendering`,
        `image-rendering`
      ],
      [
        `letterSpacing`,
        `letter-spacing`
      ],
      [
        `lightingColor`,
        `lighting-color`
      ],
      [
        `markerEnd`,
        `marker-end`
      ],
      [
        `markerMid`,
        `marker-mid`
      ],
      [
        `markerStart`,
        `marker-start`
      ],
      [
        `overlinePosition`,
        `overline-position`
      ],
      [
        `overlineThickness`,
        `overline-thickness`
      ],
      [
        `paintOrder`,
        `paint-order`
      ],
      [
        `panose-1`,
        `panose-1`
      ],
      [
        `pointerEvents`,
        `pointer-events`
      ],
      [
        `renderingIntent`,
        `rendering-intent`
      ],
      [
        `shapeRendering`,
        `shape-rendering`
      ],
      [
        `stopColor`,
        `stop-color`
      ],
      [
        `stopOpacity`,
        `stop-opacity`
      ],
      [
        `strikethroughPosition`,
        `strikethrough-position`
      ],
      [
        `strikethroughThickness`,
        `strikethrough-thickness`
      ],
      [
        `strokeDasharray`,
        `stroke-dasharray`
      ],
      [
        `strokeDashoffset`,
        `stroke-dashoffset`
      ],
      [
        `strokeLinecap`,
        `stroke-linecap`
      ],
      [
        `strokeLinejoin`,
        `stroke-linejoin`
      ],
      [
        `strokeMiterlimit`,
        `stroke-miterlimit`
      ],
      [
        `strokeOpacity`,
        `stroke-opacity`
      ],
      [
        `strokeWidth`,
        `stroke-width`
      ],
      [
        `textAnchor`,
        `text-anchor`
      ],
      [
        `textDecoration`,
        `text-decoration`
      ],
      [
        `textRendering`,
        `text-rendering`
      ],
      [
        `transformOrigin`,
        `transform-origin`
      ],
      [
        `underlinePosition`,
        `underline-position`
      ],
      [
        `underlineThickness`,
        `underline-thickness`
      ],
      [
        `unicodeBidi`,
        `unicode-bidi`
      ],
      [
        `unicodeRange`,
        `unicode-range`
      ],
      [
        `unitsPerEm`,
        `units-per-em`
      ],
      [
        `vAlphabetic`,
        `v-alphabetic`
      ],
      [
        `vHanging`,
        `v-hanging`
      ],
      [
        `vIdeographic`,
        `v-ideographic`
      ],
      [
        `vMathematical`,
        `v-mathematical`
      ],
      [
        `vectorEffect`,
        `vector-effect`
      ],
      [
        `vertAdvY`,
        `vert-adv-y`
      ],
      [
        `vertOriginX`,
        `vert-origin-x`
      ],
      [
        `vertOriginY`,
        `vert-origin-y`
      ],
      [
        `wordSpacing`,
        `word-spacing`
      ],
      [
        `writingMode`,
        `writing-mode`
      ],
      [
        `xmlnsXlink`,
        `xmlns:xlink`
      ],
      [
        `xHeight`,
        `x-height`
      ]
    ]), G2 = /^[\u0000-\u001F ]*j[\r\n\t]*a[\r\n\t]*v[\r\n\t]*a[\r\n\t]*s[\r\n\t]*c[\r\n\t]*r[\r\n\t]*i[\r\n\t]*p[\r\n\t]*t[\r\n\t]*:/i;
    function Kt2(e3) {
      return G2.test(`` + e3) ? `javascript:throw new Error('React has blocked a javascript: URL as a security precaution.')` : e3;
    }
    function K2() {
    }
    var qt2 = null;
    function Jt2(e3) {
      return e3 = e3.target || e3.srcElement || window, e3.correspondingUseElement && (e3 = e3.correspondingUseElement), e3.nodeType === 3 ? e3.parentNode : e3;
    }
    var Yt2 = null, Xt2 = null;
    function Zt2(e3) {
      var t3 = gt2(e3);
      if (t3 && (e3 = t3.stateNode)) {
        var n3 = e3[st2] || null;
        a: switch (e3 = t3.stateNode, t3.type) {
          case `input`:
            if (Pt2(e3, n3.value, n3.defaultValue, n3.defaultValue, n3.checked, n3.defaultChecked, n3.type, n3.name), t3 = n3.name, n3.type === `radio` && t3 != null) {
              for (n3 = e3; n3.parentNode; ) n3 = n3.parentNode;
              for (n3 = n3.querySelectorAll(`input[name="` + Nt2(`` + t3) + `"][type="radio"]`), t3 = 0; t3 < n3.length; t3++) {
                var r3 = n3[t3];
                if (r3 !== e3 && r3.form === e3.form) {
                  var a3 = r3[st2] || null;
                  if (!a3) throw Error(i2(90));
                  Pt2(r3, a3.value, a3.defaultValue, a3.defaultValue, a3.checked, a3.defaultChecked, a3.type, a3.name);
                }
              }
              for (t3 = 0; t3 < n3.length; t3++) r3 = n3[t3], r3.form === e3.form && At2(r3);
            }
            break a;
          case `textarea`:
            Rt2(e3, n3.value, n3.defaultValue);
            break a;
          case `select`:
            t3 = n3.value, t3 != null && Lt2(e3, !!n3.multiple, t3, false);
        }
      }
    }
    var Qt2 = false;
    function $t2(e3, t3, n3) {
      if (Qt2) return e3(t3, n3);
      Qt2 = true;
      try {
        return e3(t3);
      } finally {
        if (Qt2 = false, (Yt2 !== null || Xt2 !== null) && (yu(), Yt2 && (t3 = Yt2, e3 = Xt2, Xt2 = Yt2 = null, Zt2(t3), e3))) for (t3 = 0; t3 < e3.length; t3++) Zt2(e3[t3]);
      }
    }
    function en2(e3, t3) {
      var n3 = e3.stateNode;
      if (n3 === null) return null;
      var r3 = n3[st2] || null;
      if (r3 === null) return null;
      n3 = r3[t3];
      a: switch (t3) {
        case `onClick`:
        case `onClickCapture`:
        case `onDoubleClick`:
        case `onDoubleClickCapture`:
        case `onMouseDown`:
        case `onMouseDownCapture`:
        case `onMouseMove`:
        case `onMouseMoveCapture`:
        case `onMouseUp`:
        case `onMouseUpCapture`:
        case `onMouseEnter`:
          (r3 = !r3.disabled) || (e3 = e3.type, r3 = !(e3 === `button` || e3 === `input` || e3 === `select` || e3 === `textarea`)), e3 = !r3;
          break a;
        default:
          e3 = false;
      }
      if (e3) return null;
      if (n3 && typeof n3 != `function`) throw Error(i2(231, t3, typeof n3));
      return n3;
    }
    var tn2 = !(typeof window > `u` || window.document === void 0 || window.document.createElement === void 0), nn2 = false;
    if (tn2) try {
      var rn2 = {};
      Object.defineProperty(rn2, "passive", {
        get: function() {
          nn2 = true;
        }
      }), window.addEventListener(`test`, rn2, rn2), window.removeEventListener(`test`, rn2, rn2);
    } catch {
      nn2 = false;
    }
    var an2 = null, on2 = null, sn2 = null;
    function cn2() {
      if (sn2) return sn2;
      var e3, t3 = on2, n3 = t3.length, r3, i3 = `value` in an2 ? an2.value : an2.textContent, a3 = i3.length;
      for (e3 = 0; e3 < n3 && t3[e3] === i3[e3]; e3++) ;
      var o3 = n3 - e3;
      for (r3 = 1; r3 <= o3 && t3[n3 - r3] === i3[a3 - r3]; r3++) ;
      return sn2 = i3.slice(e3, 1 < r3 ? 1 - r3 : void 0);
    }
    function ln2(e3) {
      var t3 = e3.keyCode;
      return `charCode` in e3 ? (e3 = e3.charCode, e3 === 0 && t3 === 13 && (e3 = 13)) : e3 = t3, e3 === 10 && (e3 = 13), 32 <= e3 || e3 === 13 ? e3 : 0;
    }
    function q2() {
      return true;
    }
    function un2() {
      return false;
    }
    function dn2(e3) {
      function t3(t4, n3, r3, i3, a3) {
        for (var o3 in this._reactName = t4, this._targetInst = r3, this.type = n3, this.nativeEvent = i3, this.target = a3, this.currentTarget = null, e3) e3.hasOwnProperty(o3) && (t4 = e3[o3], this[o3] = t4 ? t4(i3) : i3[o3]);
        return this.isDefaultPrevented = (i3.defaultPrevented == null ? false === i3.returnValue : i3.defaultPrevented) ? q2 : un2, this.isPropagationStopped = un2, this;
      }
      return h2(t3.prototype, {
        preventDefault: function() {
          this.defaultPrevented = true;
          var e4 = this.nativeEvent;
          e4 && (e4.preventDefault ? e4.preventDefault() : typeof e4.returnValue != `unknown` && (e4.returnValue = false), this.isDefaultPrevented = q2);
        },
        stopPropagation: function() {
          var e4 = this.nativeEvent;
          e4 && (e4.stopPropagation ? e4.stopPropagation() : typeof e4.cancelBubble != `unknown` && (e4.cancelBubble = true), this.isPropagationStopped = q2);
        },
        persist: function() {
        },
        isPersistent: q2
      }), t3;
    }
    var fn2 = {
      eventPhase: 0,
      bubbles: 0,
      cancelable: 0,
      timeStamp: function(e3) {
        return e3.timeStamp || Date.now();
      },
      defaultPrevented: 0,
      isTrusted: 0
    }, pn2 = dn2(fn2), mn2 = h2({}, fn2, {
      view: 0,
      detail: 0
    }), hn2 = dn2(mn2), gn2, _n2, vn2, yn2 = h2({}, mn2, {
      screenX: 0,
      screenY: 0,
      clientX: 0,
      clientY: 0,
      pageX: 0,
      pageY: 0,
      ctrlKey: 0,
      shiftKey: 0,
      altKey: 0,
      metaKey: 0,
      getModifierState: An2,
      button: 0,
      buttons: 0,
      relatedTarget: function(e3) {
        return e3.relatedTarget === void 0 ? e3.fromElement === e3.srcElement ? e3.toElement : e3.fromElement : e3.relatedTarget;
      },
      movementX: function(e3) {
        return `movementX` in e3 ? e3.movementX : (e3 !== vn2 && (vn2 && e3.type === `mousemove` ? (gn2 = e3.screenX - vn2.screenX, _n2 = e3.screenY - vn2.screenY) : _n2 = gn2 = 0, vn2 = e3), gn2);
      },
      movementY: function(e3) {
        return `movementY` in e3 ? e3.movementY : _n2;
      }
    }), bn2 = dn2(yn2), xn2 = dn2(h2({}, yn2, {
      dataTransfer: 0
    })), Sn2 = dn2(h2({}, mn2, {
      relatedTarget: 0
    })), Cn2 = dn2(h2({}, fn2, {
      animationName: 0,
      elapsedTime: 0,
      pseudoElement: 0
    })), wn2 = dn2(h2({}, fn2, {
      clipboardData: function(e3) {
        return `clipboardData` in e3 ? e3.clipboardData : window.clipboardData;
      }
    })), Tn2 = dn2(h2({}, fn2, {
      data: 0
    })), En2 = {
      Esc: `Escape`,
      Spacebar: ` `,
      Left: `ArrowLeft`,
      Up: `ArrowUp`,
      Right: `ArrowRight`,
      Down: `ArrowDown`,
      Del: `Delete`,
      Win: `OS`,
      Menu: `ContextMenu`,
      Apps: `ContextMenu`,
      Scroll: `ScrollLock`,
      MozPrintableKey: `Unidentified`
    }, Dn2 = {
      8: `Backspace`,
      9: `Tab`,
      12: `Clear`,
      13: `Enter`,
      16: `Shift`,
      17: `Control`,
      18: `Alt`,
      19: `Pause`,
      20: `CapsLock`,
      27: `Escape`,
      32: ` `,
      33: `PageUp`,
      34: `PageDown`,
      35: `End`,
      36: `Home`,
      37: `ArrowLeft`,
      38: `ArrowUp`,
      39: `ArrowRight`,
      40: `ArrowDown`,
      45: `Insert`,
      46: `Delete`,
      112: `F1`,
      113: `F2`,
      114: `F3`,
      115: `F4`,
      116: `F5`,
      117: `F6`,
      118: `F7`,
      119: `F8`,
      120: `F9`,
      121: `F10`,
      122: `F11`,
      123: `F12`,
      144: `NumLock`,
      145: `ScrollLock`,
      224: `Meta`
    }, On2 = {
      Alt: `altKey`,
      Control: `ctrlKey`,
      Meta: `metaKey`,
      Shift: `shiftKey`
    };
    function kn2(e3) {
      var t3 = this.nativeEvent;
      return t3.getModifierState ? t3.getModifierState(e3) : (e3 = On2[e3]) ? !!t3[e3] : false;
    }
    function An2() {
      return kn2;
    }
    var jn2 = dn2(h2({}, mn2, {
      key: function(e3) {
        if (e3.key) {
          var t3 = En2[e3.key] || e3.key;
          if (t3 !== `Unidentified`) return t3;
        }
        return e3.type === `keypress` ? (e3 = ln2(e3), e3 === 13 ? `Enter` : String.fromCharCode(e3)) : e3.type === `keydown` || e3.type === `keyup` ? Dn2[e3.keyCode] || `Unidentified` : ``;
      },
      code: 0,
      location: 0,
      ctrlKey: 0,
      shiftKey: 0,
      altKey: 0,
      metaKey: 0,
      repeat: 0,
      locale: 0,
      getModifierState: An2,
      charCode: function(e3) {
        return e3.type === `keypress` ? ln2(e3) : 0;
      },
      keyCode: function(e3) {
        return e3.type === `keydown` || e3.type === `keyup` ? e3.keyCode : 0;
      },
      which: function(e3) {
        return e3.type === `keypress` ? ln2(e3) : e3.type === `keydown` || e3.type === `keyup` ? e3.keyCode : 0;
      }
    })), Mn2 = dn2(h2({}, yn2, {
      pointerId: 0,
      width: 0,
      height: 0,
      pressure: 0,
      tangentialPressure: 0,
      tiltX: 0,
      tiltY: 0,
      twist: 0,
      pointerType: 0,
      isPrimary: 0
    })), Nn2 = dn2(h2({}, mn2, {
      touches: 0,
      targetTouches: 0,
      changedTouches: 0,
      altKey: 0,
      metaKey: 0,
      ctrlKey: 0,
      shiftKey: 0,
      getModifierState: An2
    })), Pn2 = dn2(h2({}, fn2, {
      propertyName: 0,
      elapsedTime: 0,
      pseudoElement: 0
    })), Fn2 = dn2(h2({}, yn2, {
      deltaX: function(e3) {
        return `deltaX` in e3 ? e3.deltaX : `wheelDeltaX` in e3 ? -e3.wheelDeltaX : 0;
      },
      deltaY: function(e3) {
        return `deltaY` in e3 ? e3.deltaY : `wheelDeltaY` in e3 ? -e3.wheelDeltaY : `wheelDelta` in e3 ? -e3.wheelDelta : 0;
      },
      deltaZ: 0,
      deltaMode: 0
    })), In2 = dn2(h2({}, fn2, {
      newState: 0,
      oldState: 0
    })), Ln2 = [
      9,
      13,
      27,
      32
    ], Rn2 = tn2 && `CompositionEvent` in window, zn = null;
    tn2 && `documentMode` in document && (zn = document.documentMode);
    var Bn = tn2 && `TextEvent` in window && !zn, Vn = tn2 && (!Rn2 || zn && 8 < zn && 11 >= zn), Hn = ` `, Un = false;
    function Wn(e3, t3) {
      switch (e3) {
        case `keyup`:
          return Ln2.indexOf(t3.keyCode) !== -1;
        case `keydown`:
          return t3.keyCode !== 229;
        case `keypress`:
        case `mousedown`:
        case `focusout`:
          return true;
        default:
          return false;
      }
    }
    function Gn(e3) {
      return e3 = e3.detail, typeof e3 == `object` && `data` in e3 ? e3.data : null;
    }
    var Kn = false;
    function qn(e3, t3) {
      switch (e3) {
        case `compositionend`:
          return Gn(t3);
        case `keypress`:
          return t3.which === 32 ? (Un = true, Hn) : null;
        case `textInput`:
          return e3 = t3.data, e3 === Hn && Un ? null : e3;
        default:
          return null;
      }
    }
    function Jn(e3, t3) {
      if (Kn) return e3 === `compositionend` || !Rn2 && Wn(e3, t3) ? (e3 = cn2(), sn2 = on2 = an2 = null, Kn = false, e3) : null;
      switch (e3) {
        case `paste`:
          return null;
        case `keypress`:
          if (!(t3.ctrlKey || t3.altKey || t3.metaKey) || t3.ctrlKey && t3.altKey) {
            if (t3.char && 1 < t3.char.length) return t3.char;
            if (t3.which) return String.fromCharCode(t3.which);
          }
          return null;
        case `compositionend`:
          return Vn && t3.locale !== `ko` ? null : t3.data;
        default:
          return null;
      }
    }
    var Yn = {
      color: true,
      date: true,
      datetime: true,
      "datetime-local": true,
      email: true,
      month: true,
      number: true,
      password: true,
      range: true,
      search: true,
      tel: true,
      text: true,
      time: true,
      url: true,
      week: true
    };
    function Xn(e3) {
      var t3 = e3 && e3.nodeName && e3.nodeName.toLowerCase();
      return t3 === `input` ? !!Yn[e3.type] : t3 === `textarea`;
    }
    function Zn(e3, t3, n3, r3) {
      Yt2 ? Xt2 ? Xt2.push(r3) : Xt2 = [
        r3
      ] : Yt2 = r3, t3 = Ed(t3, `onChange`), 0 < t3.length && (n3 = new pn2(`onChange`, `change`, null, n3, r3), e3.push({
        event: n3,
        listeners: t3
      }));
    }
    var Qn = null, $n = null;
    function er(e3) {
      yd(e3, 0);
    }
    function tr(e3) {
      if (At2(_t2(e3))) return e3;
    }
    function nr(e3, t3) {
      if (e3 === `change`) return t3;
    }
    var rr = false;
    if (tn2) {
      var ir;
      if (tn2) {
        var ar = `oninput` in document;
        if (!ar) {
          var or = document.createElement(`div`);
          or.setAttribute(`oninput`, `return;`), ar = typeof or.oninput == `function`;
        }
        ir = ar;
      } else ir = false;
      rr = ir && (!document.documentMode || 9 < document.documentMode);
    }
    function sr() {
      Qn && (Qn.detachEvent(`onpropertychange`, cr), $n = Qn = null);
    }
    function cr(e3) {
      if (e3.propertyName === `value` && tr($n)) {
        var t3 = [];
        Zn(t3, $n, e3, Jt2(e3)), $t2(er, t3);
      }
    }
    function lr(e3, t3, n3) {
      e3 === `focusin` ? (sr(), Qn = t3, $n = n3, Qn.attachEvent(`onpropertychange`, cr)) : e3 === `focusout` && sr();
    }
    function ur(e3) {
      if (e3 === `selectionchange` || e3 === `keyup` || e3 === `keydown`) return tr($n);
    }
    function dr(e3, t3) {
      if (e3 === `click`) return tr(t3);
    }
    function fr(e3, t3) {
      if (e3 === `input` || e3 === `change`) return tr(t3);
    }
    function pr(e3, t3) {
      return e3 === t3 && (e3 !== 0 || 1 / e3 == 1 / t3) || e3 !== e3 && t3 !== t3;
    }
    var mr = typeof Object.is == `function` ? Object.is : pr;
    function hr(e3, t3) {
      if (mr(e3, t3)) return true;
      if (typeof e3 != `object` || !e3 || typeof t3 != `object` || !t3) return false;
      var n3 = Object.keys(e3), r3 = Object.keys(t3);
      if (n3.length !== r3.length) return false;
      for (r3 = 0; r3 < n3.length; r3++) {
        var i3 = n3[r3];
        if (!Ce2.call(t3, i3) || !mr(e3[i3], t3[i3])) return false;
      }
      return true;
    }
    function gr(e3) {
      for (; e3 && e3.firstChild; ) e3 = e3.firstChild;
      return e3;
    }
    function _r(e3, t3) {
      var n3 = gr(e3);
      e3 = 0;
      for (var r3; n3; ) {
        if (n3.nodeType === 3) {
          if (r3 = e3 + n3.textContent.length, e3 <= t3 && r3 >= t3) return {
            node: n3,
            offset: t3 - e3
          };
          e3 = r3;
        }
        a: {
          for (; n3; ) {
            if (n3.nextSibling) {
              n3 = n3.nextSibling;
              break a;
            }
            n3 = n3.parentNode;
          }
          n3 = void 0;
        }
        n3 = gr(n3);
      }
    }
    function vr(e3, t3) {
      return e3 && t3 ? e3 === t3 ? true : e3 && e3.nodeType === 3 ? false : t3 && t3.nodeType === 3 ? vr(e3, t3.parentNode) : `contains` in e3 ? e3.contains(t3) : e3.compareDocumentPosition ? !!(e3.compareDocumentPosition(t3) & 16) : false : false;
    }
    function yr(e3) {
      e3 = e3 != null && e3.ownerDocument != null && e3.ownerDocument.defaultView != null ? e3.ownerDocument.defaultView : window;
      for (var t3 = jt2(e3.document); t3 instanceof e3.HTMLIFrameElement; ) {
        try {
          var n3 = typeof t3.contentWindow.location.href == `string`;
        } catch {
          n3 = false;
        }
        if (n3) e3 = t3.contentWindow;
        else break;
        t3 = jt2(e3.document);
      }
      return t3;
    }
    function br(e3) {
      var t3 = e3 && e3.nodeName && e3.nodeName.toLowerCase();
      return t3 && (t3 === `input` && (e3.type === `text` || e3.type === `search` || e3.type === `tel` || e3.type === `url` || e3.type === `password`) || t3 === `textarea` || e3.contentEditable === `true`);
    }
    var xr = tn2 && `documentMode` in document && 11 >= document.documentMode, Sr = null, Cr = null, wr = null, Tr = false;
    function Er(e3, t3, n3) {
      var r3 = n3.window === n3 ? n3.document : n3.nodeType === 9 ? n3 : n3.ownerDocument;
      Tr || Sr == null || Sr !== jt2(r3) || (r3 = Sr, `selectionStart` in r3 && br(r3) ? r3 = {
        start: r3.selectionStart,
        end: r3.selectionEnd
      } : (r3 = (r3.ownerDocument && r3.ownerDocument.defaultView || window).getSelection(), r3 = {
        anchorNode: r3.anchorNode,
        anchorOffset: r3.anchorOffset,
        focusNode: r3.focusNode,
        focusOffset: r3.focusOffset
      }), wr && hr(wr, r3) || (wr = r3, r3 = Ed(Cr, `onSelect`), 0 < r3.length && (t3 = new pn2(`onSelect`, `select`, null, t3, n3), e3.push({
        event: t3,
        listeners: r3
      }), t3.target = Sr)));
    }
    function Dr(e3, t3) {
      var n3 = {};
      return n3[e3.toLowerCase()] = t3.toLowerCase(), n3[`Webkit` + e3] = `webkit` + t3, n3[`Moz` + e3] = `moz` + t3, n3;
    }
    var Or = {
      animationend: Dr(`Animation`, `AnimationEnd`),
      animationiteration: Dr(`Animation`, `AnimationIteration`),
      animationstart: Dr(`Animation`, `AnimationStart`),
      transitionrun: Dr(`Transition`, `TransitionRun`),
      transitionstart: Dr(`Transition`, `TransitionStart`),
      transitioncancel: Dr(`Transition`, `TransitionCancel`),
      transitionend: Dr(`Transition`, `TransitionEnd`)
    }, kr = {}, Ar = {};
    tn2 && (Ar = document.createElement(`div`).style, `AnimationEvent` in window || (delete Or.animationend.animation, delete Or.animationiteration.animation, delete Or.animationstart.animation), `TransitionEvent` in window || delete Or.transitionend.transition);
    function jr(e3) {
      if (kr[e3]) return kr[e3];
      if (!Or[e3]) return e3;
      var t3 = Or[e3], n3;
      for (n3 in t3) if (t3.hasOwnProperty(n3) && n3 in Ar) return kr[e3] = t3[n3];
      return e3;
    }
    var Mr = jr(`animationend`), Nr = jr(`animationiteration`), Pr = jr(`animationstart`), Fr = jr(`transitionrun`), Ir = jr(`transitionstart`), Lr = jr(`transitioncancel`), Rr = jr(`transitionend`), zr = /* @__PURE__ */ new Map(), Br = `abort auxClick beforeToggle cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel`.split(` `);
    Br.push(`scrollEnd`);
    function Vr(e3, t3) {
      zr.set(e3, t3), H2(t3, [
        e3
      ]);
    }
    var Hr = typeof reportError == `function` ? reportError : function(e3) {
      if (typeof window == `object` && typeof window.ErrorEvent == `function`) {
        var t3 = new window.ErrorEvent(`error`, {
          bubbles: true,
          cancelable: true,
          message: typeof e3 == `object` && e3 && typeof e3.message == `string` ? String(e3.message) : String(e3),
          error: e3
        });
        if (!window.dispatchEvent(t3)) return;
      } else if (typeof process == `object` && typeof process.emit == `function`) {
        process.emit(`uncaughtException`, e3);
        return;
      }
      console.error(e3);
    }, Ur = [], Wr = 0, Gr = 0;
    function Kr() {
      for (var e3 = Wr, t3 = Gr = Wr = 0; t3 < e3; ) {
        var n3 = Ur[t3];
        Ur[t3++] = null;
        var r3 = Ur[t3];
        Ur[t3++] = null;
        var i3 = Ur[t3];
        Ur[t3++] = null;
        var a3 = Ur[t3];
        if (Ur[t3++] = null, r3 !== null && i3 !== null) {
          var o3 = r3.pending;
          o3 === null ? i3.next = i3 : (i3.next = o3.next, o3.next = i3), r3.pending = i3;
        }
        a3 !== 0 && Xr(n3, i3, a3);
      }
    }
    function qr(e3, t3, n3, r3) {
      Ur[Wr++] = e3, Ur[Wr++] = t3, Ur[Wr++] = n3, Ur[Wr++] = r3, Gr |= r3, e3.lanes |= r3, e3 = e3.alternate, e3 !== null && (e3.lanes |= r3);
    }
    function Jr(e3, t3, n3, r3) {
      return qr(e3, t3, n3, r3), Zr(e3);
    }
    function Yr(e3, t3) {
      return qr(e3, null, null, t3), Zr(e3);
    }
    function Xr(e3, t3, n3) {
      e3.lanes |= n3;
      var r3 = e3.alternate;
      r3 !== null && (r3.lanes |= n3);
      for (var i3 = false, a3 = e3.return; a3 !== null; ) a3.childLanes |= n3, r3 = a3.alternate, r3 !== null && (r3.childLanes |= n3), a3.tag === 22 && (e3 = a3.stateNode, e3 === null || e3._visibility & 1 || (i3 = true)), e3 = a3, a3 = a3.return;
      return e3.tag === 3 ? (a3 = e3.stateNode, i3 && t3 !== null && (i3 = 31 - ze2(n3), e3 = a3.hiddenUpdates, r3 = e3[i3], r3 === null ? e3[i3] = [
        t3
      ] : r3.push(t3), t3.lane = n3 | 536870912), a3) : null;
    }
    function Zr(e3) {
      if (50 < uu) throw uu = 0, du = null, Error(i2(185));
      for (var t3 = e3.return; t3 !== null; ) e3 = t3, t3 = e3.return;
      return e3.tag === 3 ? e3.stateNode : null;
    }
    var Qr = {};
    function $r(e3, t3, n3, r3) {
      this.tag = e3, this.key = n3, this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null, this.index = 0, this.refCleanup = this.ref = null, this.pendingProps = t3, this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null, this.mode = r3, this.subtreeFlags = this.flags = 0, this.deletions = null, this.childLanes = this.lanes = 0, this.alternate = null;
    }
    function ei(e3, t3, n3, r3) {
      return new $r(e3, t3, n3, r3);
    }
    function ti(e3) {
      return e3 = e3.prototype, !(!e3 || !e3.isReactComponent);
    }
    function ni(e3, t3) {
      var n3 = e3.alternate;
      return n3 === null ? (n3 = ei(e3.tag, t3, e3.key, e3.mode), n3.elementType = e3.elementType, n3.type = e3.type, n3.stateNode = e3.stateNode, n3.alternate = e3, e3.alternate = n3) : (n3.pendingProps = t3, n3.type = e3.type, n3.flags = 0, n3.subtreeFlags = 0, n3.deletions = null), n3.flags = e3.flags & 65011712, n3.childLanes = e3.childLanes, n3.lanes = e3.lanes, n3.child = e3.child, n3.memoizedProps = e3.memoizedProps, n3.memoizedState = e3.memoizedState, n3.updateQueue = e3.updateQueue, t3 = e3.dependencies, n3.dependencies = t3 === null ? null : {
        lanes: t3.lanes,
        firstContext: t3.firstContext
      }, n3.sibling = e3.sibling, n3.index = e3.index, n3.ref = e3.ref, n3.refCleanup = e3.refCleanup, n3;
    }
    function ri(e3, t3) {
      e3.flags &= 65011714;
      var n3 = e3.alternate;
      return n3 === null ? (e3.childLanes = 0, e3.lanes = t3, e3.child = null, e3.subtreeFlags = 0, e3.memoizedProps = null, e3.memoizedState = null, e3.updateQueue = null, e3.dependencies = null, e3.stateNode = null) : (e3.childLanes = n3.childLanes, e3.lanes = n3.lanes, e3.child = n3.child, e3.subtreeFlags = 0, e3.deletions = null, e3.memoizedProps = n3.memoizedProps, e3.memoizedState = n3.memoizedState, e3.updateQueue = n3.updateQueue, e3.type = n3.type, t3 = n3.dependencies, e3.dependencies = t3 === null ? null : {
        lanes: t3.lanes,
        firstContext: t3.firstContext
      }), e3;
    }
    function ii(e3, t3, n3, r3, a3, o3) {
      var s3 = 0;
      if (r3 = e3, typeof e3 == `function`) ti(e3) && (s3 = 1);
      else if (typeof e3 == `string`) s3 = Wf(e3, n3, ce2.current) ? 26 : e3 === `html` || e3 === `head` || e3 === `body` ? 27 : 5;
      else a: switch (e3) {
        case re2:
          return e3 = ei(31, n3, t3, a3), e3.elementType = re2, e3.lanes = o3, e3;
        case y2:
          return ai(n3.children, a3, o3, t3);
        case b2:
          s3 = 8, a3 |= 24;
          break;
        case x2:
          return e3 = ei(12, n3, t3, a3 | 2), e3.elementType = x2, e3.lanes = o3, e3;
        case ee2:
          return e3 = ei(13, n3, t3, a3), e3.elementType = ee2, e3.lanes = o3, e3;
        case T2:
          return e3 = ei(19, n3, t3, a3), e3.elementType = T2, e3.lanes = o3, e3;
        default:
          if (typeof e3 == `object` && e3) switch (e3.$$typeof) {
            case C2:
              s3 = 10;
              break a;
            case S2:
              s3 = 9;
              break a;
            case w2:
              s3 = 11;
              break a;
            case te2:
              s3 = 14;
              break a;
            case ne2:
              s3 = 16, r3 = null;
              break a;
          }
          s3 = 29, n3 = Error(i2(130, e3 === null ? `null` : typeof e3, ``)), r3 = null;
      }
      return t3 = ei(s3, n3, t3, a3), t3.elementType = e3, t3.type = r3, t3.lanes = o3, t3;
    }
    function ai(e3, t3, n3, r3) {
      return e3 = ei(7, e3, r3, t3), e3.lanes = n3, e3;
    }
    function oi(e3, t3, n3) {
      return e3 = ei(6, e3, null, t3), e3.lanes = n3, e3;
    }
    function si(e3) {
      var t3 = ei(18, null, null, 0);
      return t3.stateNode = e3, t3;
    }
    function ci(e3, t3, n3) {
      return t3 = ei(4, e3.children === null ? [] : e3.children, e3.key, t3), t3.lanes = n3, t3.stateNode = {
        containerInfo: e3.containerInfo,
        pendingChildren: null,
        implementation: e3.implementation
      }, t3;
    }
    var li = /* @__PURE__ */ new WeakMap();
    function ui(e3, t3) {
      if (typeof e3 == `object` && e3) {
        var n3 = li.get(e3);
        return n3 === void 0 ? (t3 = {
          value: e3,
          source: t3,
          stack: Se2(t3)
        }, li.set(e3, t3), t3) : n3;
      }
      return {
        value: e3,
        source: t3,
        stack: Se2(t3)
      };
    }
    var di = [], fi = 0, pi = null, mi = 0, hi = [], gi = 0, _i = null, vi = 1, yi = ``;
    function bi(e3, t3) {
      di[fi++] = mi, di[fi++] = pi, pi = e3, mi = t3;
    }
    function xi(e3, t3, n3) {
      hi[gi++] = vi, hi[gi++] = yi, hi[gi++] = _i, _i = e3;
      var r3 = vi;
      e3 = yi;
      var i3 = 32 - ze2(r3) - 1;
      r3 &= ~(1 << i3), n3 += 1;
      var a3 = 32 - ze2(t3) + i3;
      if (30 < a3) {
        var o3 = i3 - i3 % 5;
        a3 = (r3 & (1 << o3) - 1).toString(32), r3 >>= o3, i3 -= o3, vi = 1 << 32 - ze2(t3) + i3 | n3 << i3 | r3, yi = a3 + e3;
      } else vi = 1 << a3 | n3 << i3 | r3, yi = e3;
    }
    function Si(e3) {
      e3.return !== null && (bi(e3, 1), xi(e3, 1, 0));
    }
    function Ci(e3) {
      for (; e3 === pi; ) pi = di[--fi], di[fi] = null, mi = di[--fi], di[fi] = null;
      for (; e3 === _i; ) _i = hi[--gi], hi[gi] = null, yi = hi[--gi], hi[gi] = null, vi = hi[--gi], hi[gi] = null;
    }
    function wi(e3, t3) {
      hi[gi++] = vi, hi[gi++] = yi, hi[gi++] = _i, vi = t3.id, yi = t3.overflow, _i = e3;
    }
    var Ti = null, Ei = null, J = false, Di = null, Oi = false, ki = Error(i2(519));
    function Ai(e3) {
      throw Ii(ui(Error(i2(418, 1 < arguments.length && arguments[1] !== void 0 && arguments[1] ? `text` : `HTML`, ``)), e3)), ki;
    }
    function ji(e3) {
      var t3 = e3.stateNode, n3 = e3.type, r3 = e3.memoizedProps;
      switch (t3[ot2] = e3, t3[st2] = r3, n3) {
        case `dialog`:
          $(`cancel`, t3), $(`close`, t3);
          break;
        case `iframe`:
        case `object`:
        case `embed`:
          $(`load`, t3);
          break;
        case `video`:
        case `audio`:
          for (n3 = 0; n3 < _d.length; n3++) $(_d[n3], t3);
          break;
        case `source`:
          $(`error`, t3);
          break;
        case `img`:
        case `image`:
        case `link`:
          $(`error`, t3), $(`load`, t3);
          break;
        case `details`:
          $(`toggle`, t3);
          break;
        case `input`:
          $(`invalid`, t3), Ft2(t3, r3.value, r3.defaultValue, r3.checked, r3.defaultChecked, r3.type, r3.name, true);
          break;
        case `select`:
          $(`invalid`, t3);
          break;
        case `textarea`:
          $(`invalid`, t3), zt2(t3, r3.value, r3.defaultValue, r3.children);
      }
      n3 = r3.children, typeof n3 != `string` && typeof n3 != `number` && typeof n3 != `bigint` || t3.textContent === `` + n3 || true === r3.suppressHydrationWarning || Md(t3.textContent, n3) ? (r3.popover != null && ($(`beforetoggle`, t3), $(`toggle`, t3)), r3.onScroll != null && $(`scroll`, t3), r3.onScrollEnd != null && $(`scrollend`, t3), r3.onClick != null && (t3.onclick = K2), t3 = true) : t3 = false, t3 || Ai(e3, true);
    }
    function Mi(e3) {
      for (Ti = e3.return; Ti; ) switch (Ti.tag) {
        case 5:
        case 31:
        case 13:
          Oi = false;
          return;
        case 27:
        case 3:
          Oi = true;
          return;
        default:
          Ti = Ti.return;
      }
    }
    function Ni(e3) {
      if (e3 !== Ti) return false;
      if (!J) return Mi(e3), J = true, false;
      var t3 = e3.tag, n3;
      if ((n3 = t3 !== 3 && t3 !== 27) && ((n3 = t3 === 5) && (n3 = e3.type, n3 = !(n3 !== `form` && n3 !== `button`) || Wd(e3.type, e3.memoizedProps)), n3 = !n3), n3 && Ei && Ai(e3), Mi(e3), t3 === 13) {
        if (e3 = e3.memoizedState, e3 = e3 === null ? null : e3.dehydrated, !e3) throw Error(i2(317));
        Ei = df(e3);
      } else if (t3 === 31) {
        if (e3 = e3.memoizedState, e3 = e3 === null ? null : e3.dehydrated, !e3) throw Error(i2(317));
        Ei = df(e3);
      } else t3 === 27 ? (t3 = Ei, Qd(e3.type) ? (e3 = uf, uf = null, Ei = e3) : Ei = t3) : Ei = Ti ? lf(e3.stateNode.nextSibling) : null;
      return true;
    }
    function Pi() {
      Ei = Ti = null, J = false;
    }
    function Fi() {
      var e3 = Di;
      return e3 !== null && (Xl === null ? Xl = e3 : Xl.push.apply(Xl, e3), Di = null), e3;
    }
    function Ii(e3) {
      Di === null ? Di = [
        e3
      ] : Di.push(e3);
    }
    var Li = ae2(null), Ri = null, zi = null;
    function Bi(e3, t3, n3) {
      se2(Li, t3._currentValue), t3._currentValue = n3;
    }
    function Vi(e3) {
      e3._currentValue = Li.current, oe2(Li);
    }
    function Hi(e3, t3, n3) {
      for (; e3 !== null; ) {
        var r3 = e3.alternate;
        if ((e3.childLanes & t3) === t3 ? r3 !== null && (r3.childLanes & t3) !== t3 && (r3.childLanes |= t3) : (e3.childLanes |= t3, r3 !== null && (r3.childLanes |= t3)), e3 === n3) break;
        e3 = e3.return;
      }
    }
    function Ui(e3, t3, n3, r3) {
      var a3 = e3.child;
      for (a3 !== null && (a3.return = e3); a3 !== null; ) {
        var o3 = a3.dependencies;
        if (o3 !== null) {
          var s3 = a3.child;
          o3 = o3.firstContext;
          a: for (; o3 !== null; ) {
            var c3 = o3;
            o3 = a3;
            for (var l3 = 0; l3 < t3.length; l3++) if (c3.context === t3[l3]) {
              o3.lanes |= n3, c3 = o3.alternate, c3 !== null && (c3.lanes |= n3), Hi(o3.return, n3, e3), r3 || (s3 = null);
              break a;
            }
            o3 = c3.next;
          }
        } else if (a3.tag === 18) {
          if (s3 = a3.return, s3 === null) throw Error(i2(341));
          s3.lanes |= n3, o3 = s3.alternate, o3 !== null && (o3.lanes |= n3), Hi(s3, n3, e3), s3 = null;
        } else s3 = a3.child;
        if (s3 !== null) s3.return = a3;
        else for (s3 = a3; s3 !== null; ) {
          if (s3 === e3) {
            s3 = null;
            break;
          }
          if (a3 = s3.sibling, a3 !== null) {
            a3.return = s3.return, s3 = a3;
            break;
          }
          s3 = s3.return;
        }
        a3 = s3;
      }
    }
    function Wi(e3, t3, n3, r3) {
      e3 = null;
      for (var a3 = t3, o3 = false; a3 !== null; ) {
        if (!o3) {
          if (a3.flags & 524288) o3 = true;
          else if (a3.flags & 262144) break;
        }
        if (a3.tag === 10) {
          var s3 = a3.alternate;
          if (s3 === null) throw Error(i2(387));
          if (s3 = s3.memoizedProps, s3 !== null) {
            var c3 = a3.type;
            mr(a3.pendingProps.value, s3.value) || (e3 === null ? e3 = [
              c3
            ] : e3.push(c3));
          }
        } else if (a3 === de2.current) {
          if (s3 = a3.alternate, s3 === null) throw Error(i2(387));
          s3.memoizedState.memoizedState !== a3.memoizedState.memoizedState && (e3 === null ? e3 = [
            $f
          ] : e3.push($f));
        }
        a3 = a3.return;
      }
      e3 !== null && Ui(t3, e3, n3, r3), t3.flags |= 262144;
    }
    function Gi(e3) {
      for (e3 = e3.firstContext; e3 !== null; ) {
        if (!mr(e3.context._currentValue, e3.memoizedValue)) return true;
        e3 = e3.next;
      }
      return false;
    }
    function Ki(e3) {
      Ri = e3, zi = null, e3 = e3.dependencies, e3 !== null && (e3.firstContext = null);
    }
    function qi(e3) {
      return Yi(Ri, e3);
    }
    function Ji(e3, t3) {
      return Ri === null && Ki(e3), Yi(e3, t3);
    }
    function Yi(e3, t3) {
      var n3 = t3._currentValue;
      if (t3 = {
        context: t3,
        memoizedValue: n3,
        next: null
      }, zi === null) {
        if (e3 === null) throw Error(i2(308));
        zi = t3, e3.dependencies = {
          lanes: 0,
          firstContext: t3
        }, e3.flags |= 524288;
      } else zi = zi.next = t3;
      return n3;
    }
    var Xi = typeof AbortController < `u` ? AbortController : function() {
      var e3 = [], t3 = this.signal = {
        aborted: false,
        addEventListener: function(t4, n3) {
          e3.push(n3);
        }
      };
      this.abort = function() {
        t3.aborted = true, e3.forEach(function(e4) {
          return e4();
        });
      };
    }, Zi = t2.unstable_scheduleCallback, Qi = t2.unstable_NormalPriority, $i = {
      $$typeof: C2,
      Consumer: null,
      Provider: null,
      _currentValue: null,
      _currentValue2: null,
      _threadCount: 0
    };
    function ea() {
      return {
        controller: new Xi(),
        data: /* @__PURE__ */ new Map(),
        refCount: 0
      };
    }
    function ta(e3) {
      e3.refCount--, e3.refCount === 0 && Zi(Qi, function() {
        e3.controller.abort();
      });
    }
    var na = null, ra = 0, ia = 0, aa = null;
    function oa(e3, t3) {
      if (na === null) {
        var n3 = na = [];
        ra = 0, ia = dd(), aa = {
          status: `pending`,
          value: void 0,
          then: function(e4) {
            n3.push(e4);
          }
        };
      }
      return ra++, t3.then(sa, sa), t3;
    }
    function sa() {
      if (--ra === 0 && na !== null) {
        aa !== null && (aa.status = `fulfilled`);
        var e3 = na;
        na = null, ia = 0, aa = null;
        for (var t3 = 0; t3 < e3.length; t3++) (0, e3[t3])();
      }
    }
    function ca(e3, t3) {
      var n3 = [], r3 = {
        status: `pending`,
        value: null,
        reason: null,
        then: function(e4) {
          n3.push(e4);
        }
      };
      return e3.then(function() {
        r3.status = `fulfilled`, r3.value = t3;
        for (var e4 = 0; e4 < n3.length; e4++) (0, n3[e4])(t3);
      }, function(e4) {
        for (r3.status = `rejected`, r3.reason = e4, e4 = 0; e4 < n3.length; e4++) (0, n3[e4])(void 0);
      }), r3;
    }
    var la = M2.S;
    M2.S = function(e3, t3) {
      $l = Oe2(), typeof t3 == `object` && t3 && typeof t3.then == `function` && oa(e3, t3), la !== null && la(e3, t3);
    };
    var ua = ae2(null);
    function da() {
      var e3 = ua.current;
      return e3 === null ? Il.pooledCache : e3;
    }
    function fa(e3, t3) {
      t3 === null ? se2(ua, ua.current) : se2(ua, t3.pool);
    }
    function pa() {
      var e3 = da();
      return e3 === null ? null : {
        parent: $i._currentValue,
        pool: e3
      };
    }
    var ma = Error(i2(460)), ha = Error(i2(474)), ga = Error(i2(542)), _a = {
      then: function() {
      }
    };
    function va(e3) {
      return e3 = e3.status, e3 === `fulfilled` || e3 === `rejected`;
    }
    function ya(e3, t3, n3) {
      switch (n3 = e3[n3], n3 === void 0 ? e3.push(t3) : n3 !== t3 && (t3.then(K2, K2), t3 = n3), t3.status) {
        case `fulfilled`:
          return t3.value;
        case `rejected`:
          throw e3 = t3.reason, Ca(e3), e3;
        default:
          if (typeof t3.status == `string`) t3.then(K2, K2);
          else {
            if (e3 = Il, e3 !== null && 100 < e3.shellSuspendCounter) throw Error(i2(482));
            e3 = t3, e3.status = `pending`, e3.then(function(e4) {
              if (t3.status === `pending`) {
                var n4 = t3;
                n4.status = `fulfilled`, n4.value = e4;
              }
            }, function(e4) {
              if (t3.status === `pending`) {
                var n4 = t3;
                n4.status = `rejected`, n4.reason = e4;
              }
            });
          }
          switch (t3.status) {
            case `fulfilled`:
              return t3.value;
            case `rejected`:
              throw e3 = t3.reason, Ca(e3), e3;
          }
          throw xa = t3, ma;
      }
    }
    function ba(e3) {
      try {
        var t3 = e3._init;
        return t3(e3._payload);
      } catch (e4) {
        throw typeof e4 == `object` && e4 && typeof e4.then == `function` ? (xa = e4, ma) : e4;
      }
    }
    var xa = null;
    function Sa() {
      if (xa === null) throw Error(i2(459));
      var e3 = xa;
      return xa = null, e3;
    }
    function Ca(e3) {
      if (e3 === ma || e3 === ga) throw Error(i2(483));
    }
    var wa = null, Ta = 0;
    function Ea(e3) {
      var t3 = Ta;
      return Ta += 1, wa === null && (wa = []), ya(wa, e3, t3);
    }
    function Da(e3, t3) {
      t3 = t3.props.ref, e3.ref = t3 === void 0 ? null : t3;
    }
    function Oa(e3, t3) {
      throw t3.$$typeof === g2 ? Error(i2(525)) : (e3 = Object.prototype.toString.call(t3), Error(i2(31, e3 === `[object Object]` ? `object with keys {` + Object.keys(t3).join(`, `) + `}` : e3)));
    }
    function ka(e3) {
      function t3(t4, n4) {
        if (e3) {
          var r4 = t4.deletions;
          r4 === null ? (t4.deletions = [
            n4
          ], t4.flags |= 16) : r4.push(n4);
        }
      }
      function n3(n4, r4) {
        if (!e3) return null;
        for (; r4 !== null; ) t3(n4, r4), r4 = r4.sibling;
        return null;
      }
      function r3(e4) {
        for (var t4 = /* @__PURE__ */ new Map(); e4 !== null; ) e4.key === null ? t4.set(e4.index, e4) : t4.set(e4.key, e4), e4 = e4.sibling;
        return t4;
      }
      function a3(e4, t4) {
        return e4 = ni(e4, t4), e4.index = 0, e4.sibling = null, e4;
      }
      function o3(t4, n4, r4) {
        return t4.index = r4, e3 ? (r4 = t4.alternate, r4 === null ? (t4.flags |= 67108866, n4) : (r4 = r4.index, r4 < n4 ? (t4.flags |= 67108866, n4) : r4)) : (t4.flags |= 1048576, n4);
      }
      function s3(t4) {
        return e3 && t4.alternate === null && (t4.flags |= 67108866), t4;
      }
      function c3(e4, t4, n4, r4) {
        return t4 === null || t4.tag !== 6 ? (t4 = oi(n4, e4.mode, r4), t4.return = e4, t4) : (t4 = a3(t4, n4), t4.return = e4, t4);
      }
      function l3(e4, t4, n4, r4) {
        var i3 = n4.type;
        return i3 === y2 ? d3(e4, t4, n4.props.children, r4, n4.key) : t4 !== null && (t4.elementType === i3 || typeof i3 == `object` && i3 && i3.$$typeof === ne2 && ba(i3) === t4.type) ? (t4 = a3(t4, n4.props), Da(t4, n4), t4.return = e4, t4) : (t4 = ii(n4.type, n4.key, n4.props, null, e4.mode, r4), Da(t4, n4), t4.return = e4, t4);
      }
      function u2(e4, t4, n4, r4) {
        return t4 === null || t4.tag !== 4 || t4.stateNode.containerInfo !== n4.containerInfo || t4.stateNode.implementation !== n4.implementation ? (t4 = ci(n4, e4.mode, r4), t4.return = e4, t4) : (t4 = a3(t4, n4.children || []), t4.return = e4, t4);
      }
      function d3(e4, t4, n4, r4, i3) {
        return t4 === null || t4.tag !== 7 ? (t4 = ai(n4, e4.mode, r4, i3), t4.return = e4, t4) : (t4 = a3(t4, n4), t4.return = e4, t4);
      }
      function f2(e4, t4, n4) {
        if (typeof t4 == `string` && t4 !== `` || typeof t4 == `number` || typeof t4 == `bigint`) return t4 = oi(`` + t4, e4.mode, n4), t4.return = e4, t4;
        if (typeof t4 == `object` && t4) {
          switch (t4.$$typeof) {
            case _2:
              return n4 = ii(t4.type, t4.key, t4.props, null, e4.mode, n4), Da(n4, t4), n4.return = e4, n4;
            case v2:
              return t4 = ci(t4, e4.mode, n4), t4.return = e4, t4;
            case ne2:
              return t4 = ba(t4), f2(e4, t4, n4);
          }
          if (j2(t4) || O2(t4)) return t4 = ai(t4, e4.mode, n4, null), t4.return = e4, t4;
          if (typeof t4.then == `function`) return f2(e4, Ea(t4), n4);
          if (t4.$$typeof === C2) return f2(e4, Ji(e4, t4), n4);
          Oa(e4, t4);
        }
        return null;
      }
      function p3(e4, t4, n4, r4) {
        var i3 = t4 === null ? null : t4.key;
        if (typeof n4 == `string` && n4 !== `` || typeof n4 == `number` || typeof n4 == `bigint`) return i3 === null ? c3(e4, t4, `` + n4, r4) : null;
        if (typeof n4 == `object` && n4) {
          switch (n4.$$typeof) {
            case _2:
              return n4.key === i3 ? l3(e4, t4, n4, r4) : null;
            case v2:
              return n4.key === i3 ? u2(e4, t4, n4, r4) : null;
            case ne2:
              return n4 = ba(n4), p3(e4, t4, n4, r4);
          }
          if (j2(n4) || O2(n4)) return i3 === null ? d3(e4, t4, n4, r4, null) : null;
          if (typeof n4.then == `function`) return p3(e4, t4, Ea(n4), r4);
          if (n4.$$typeof === C2) return p3(e4, t4, Ji(e4, n4), r4);
          Oa(e4, n4);
        }
        return null;
      }
      function m2(e4, t4, n4, r4, i3) {
        if (typeof r4 == `string` && r4 !== `` || typeof r4 == `number` || typeof r4 == `bigint`) return e4 = e4.get(n4) || null, c3(t4, e4, `` + r4, i3);
        if (typeof r4 == `object` && r4) {
          switch (r4.$$typeof) {
            case _2:
              return e4 = e4.get(r4.key === null ? n4 : r4.key) || null, l3(t4, e4, r4, i3);
            case v2:
              return e4 = e4.get(r4.key === null ? n4 : r4.key) || null, u2(t4, e4, r4, i3);
            case ne2:
              return r4 = ba(r4), m2(e4, t4, n4, r4, i3);
          }
          if (j2(r4) || O2(r4)) return e4 = e4.get(n4) || null, d3(t4, e4, r4, i3, null);
          if (typeof r4.then == `function`) return m2(e4, t4, n4, Ea(r4), i3);
          if (r4.$$typeof === C2) return m2(e4, t4, n4, Ji(t4, r4), i3);
          Oa(t4, r4);
        }
        return null;
      }
      function h3(i3, a4, s4, c4) {
        for (var l4 = null, u3 = null, d4 = a4, h4 = a4 = 0, g4 = null; d4 !== null && h4 < s4.length; h4++) {
          d4.index > h4 ? (g4 = d4, d4 = null) : g4 = d4.sibling;
          var _3 = p3(i3, d4, s4[h4], c4);
          if (_3 === null) {
            d4 === null && (d4 = g4);
            break;
          }
          e3 && d4 && _3.alternate === null && t3(i3, d4), a4 = o3(_3, a4, h4), u3 === null ? l4 = _3 : u3.sibling = _3, u3 = _3, d4 = g4;
        }
        if (h4 === s4.length) return n3(i3, d4), J && bi(i3, h4), l4;
        if (d4 === null) {
          for (; h4 < s4.length; h4++) d4 = f2(i3, s4[h4], c4), d4 !== null && (a4 = o3(d4, a4, h4), u3 === null ? l4 = d4 : u3.sibling = d4, u3 = d4);
          return J && bi(i3, h4), l4;
        }
        for (d4 = r3(d4); h4 < s4.length; h4++) g4 = m2(d4, i3, h4, s4[h4], c4), g4 !== null && (e3 && g4.alternate !== null && d4.delete(g4.key === null ? h4 : g4.key), a4 = o3(g4, a4, h4), u3 === null ? l4 = g4 : u3.sibling = g4, u3 = g4);
        return e3 && d4.forEach(function(e4) {
          return t3(i3, e4);
        }), J && bi(i3, h4), l4;
      }
      function g3(a4, s4, c4, l4) {
        if (c4 == null) throw Error(i2(151));
        for (var u3 = null, d4 = null, h4 = s4, g4 = s4 = 0, _3 = null, v3 = c4.next(); h4 !== null && !v3.done; g4++, v3 = c4.next()) {
          h4.index > g4 ? (_3 = h4, h4 = null) : _3 = h4.sibling;
          var y3 = p3(a4, h4, v3.value, l4);
          if (y3 === null) {
            h4 === null && (h4 = _3);
            break;
          }
          e3 && h4 && y3.alternate === null && t3(a4, h4), s4 = o3(y3, s4, g4), d4 === null ? u3 = y3 : d4.sibling = y3, d4 = y3, h4 = _3;
        }
        if (v3.done) return n3(a4, h4), J && bi(a4, g4), u3;
        if (h4 === null) {
          for (; !v3.done; g4++, v3 = c4.next()) v3 = f2(a4, v3.value, l4), v3 !== null && (s4 = o3(v3, s4, g4), d4 === null ? u3 = v3 : d4.sibling = v3, d4 = v3);
          return J && bi(a4, g4), u3;
        }
        for (h4 = r3(h4); !v3.done; g4++, v3 = c4.next()) v3 = m2(h4, a4, g4, v3.value, l4), v3 !== null && (e3 && v3.alternate !== null && h4.delete(v3.key === null ? g4 : v3.key), s4 = o3(v3, s4, g4), d4 === null ? u3 = v3 : d4.sibling = v3, d4 = v3);
        return e3 && h4.forEach(function(e4) {
          return t3(a4, e4);
        }), J && bi(a4, g4), u3;
      }
      function b3(e4, r4, o4, c4) {
        if (typeof o4 == `object` && o4 && o4.type === y2 && o4.key === null && (o4 = o4.props.children), typeof o4 == `object` && o4) {
          switch (o4.$$typeof) {
            case _2:
              a: {
                for (var l4 = o4.key; r4 !== null; ) {
                  if (r4.key === l4) {
                    if (l4 = o4.type, l4 === y2) {
                      if (r4.tag === 7) {
                        n3(e4, r4.sibling), c4 = a3(r4, o4.props.children), c4.return = e4, e4 = c4;
                        break a;
                      }
                    } else if (r4.elementType === l4 || typeof l4 == `object` && l4 && l4.$$typeof === ne2 && ba(l4) === r4.type) {
                      n3(e4, r4.sibling), c4 = a3(r4, o4.props), Da(c4, o4), c4.return = e4, e4 = c4;
                      break a;
                    }
                    n3(e4, r4);
                    break;
                  } else t3(e4, r4);
                  r4 = r4.sibling;
                }
                o4.type === y2 ? (c4 = ai(o4.props.children, e4.mode, c4, o4.key), c4.return = e4, e4 = c4) : (c4 = ii(o4.type, o4.key, o4.props, null, e4.mode, c4), Da(c4, o4), c4.return = e4, e4 = c4);
              }
              return s3(e4);
            case v2:
              a: {
                for (l4 = o4.key; r4 !== null; ) {
                  if (r4.key === l4) if (r4.tag === 4 && r4.stateNode.containerInfo === o4.containerInfo && r4.stateNode.implementation === o4.implementation) {
                    n3(e4, r4.sibling), c4 = a3(r4, o4.children || []), c4.return = e4, e4 = c4;
                    break a;
                  } else {
                    n3(e4, r4);
                    break;
                  }
                  else t3(e4, r4);
                  r4 = r4.sibling;
                }
                c4 = ci(o4, e4.mode, c4), c4.return = e4, e4 = c4;
              }
              return s3(e4);
            case ne2:
              return o4 = ba(o4), b3(e4, r4, o4, c4);
          }
          if (j2(o4)) return h3(e4, r4, o4, c4);
          if (O2(o4)) {
            if (l4 = O2(o4), typeof l4 != `function`) throw Error(i2(150));
            return o4 = l4.call(o4), g3(e4, r4, o4, c4);
          }
          if (typeof o4.then == `function`) return b3(e4, r4, Ea(o4), c4);
          if (o4.$$typeof === C2) return b3(e4, r4, Ji(e4, o4), c4);
          Oa(e4, o4);
        }
        return typeof o4 == `string` && o4 !== `` || typeof o4 == `number` || typeof o4 == `bigint` ? (o4 = `` + o4, r4 !== null && r4.tag === 6 ? (n3(e4, r4.sibling), c4 = a3(r4, o4), c4.return = e4, e4 = c4) : (n3(e4, r4), c4 = oi(o4, e4.mode, c4), c4.return = e4, e4 = c4), s3(e4)) : n3(e4, r4);
      }
      return function(e4, t4, n4, r4) {
        try {
          Ta = 0;
          var i3 = b3(e4, t4, n4, r4);
          return wa = null, i3;
        } catch (t5) {
          if (t5 === ma || t5 === ga) throw t5;
          var a4 = ei(29, t5, null, e4.mode);
          return a4.lanes = r4, a4.return = e4, a4;
        }
      };
    }
    var Aa = ka(true), ja = ka(false), Ma = false;
    function Na(e3) {
      e3.updateQueue = {
        baseState: e3.memoizedState,
        firstBaseUpdate: null,
        lastBaseUpdate: null,
        shared: {
          pending: null,
          lanes: 0,
          hiddenCallbacks: null
        },
        callbacks: null
      };
    }
    function Pa(e3, t3) {
      e3 = e3.updateQueue, t3.updateQueue === e3 && (t3.updateQueue = {
        baseState: e3.baseState,
        firstBaseUpdate: e3.firstBaseUpdate,
        lastBaseUpdate: e3.lastBaseUpdate,
        shared: e3.shared,
        callbacks: null
      });
    }
    function Fa(e3) {
      return {
        lane: e3,
        tag: 0,
        payload: null,
        callback: null,
        next: null
      };
    }
    function Ia(e3, t3, n3) {
      var r3 = e3.updateQueue;
      if (r3 === null) return null;
      if (r3 = r3.shared, X & 2) {
        var i3 = r3.pending;
        return i3 === null ? t3.next = t3 : (t3.next = i3.next, i3.next = t3), r3.pending = t3, t3 = Zr(e3), Xr(e3, null, n3), t3;
      }
      return qr(e3, r3, t3, n3), Zr(e3);
    }
    function La(e3, t3, n3) {
      if (t3 = t3.updateQueue, t3 !== null && (t3 = t3.shared, n3 & 4194048)) {
        var r3 = t3.lanes;
        r3 &= e3.pendingLanes, n3 |= r3, t3.lanes = n3, $e2(e3, n3);
      }
    }
    function Ra(e3, t3) {
      var n3 = e3.updateQueue, r3 = e3.alternate;
      if (r3 !== null && (r3 = r3.updateQueue, n3 === r3)) {
        var i3 = null, a3 = null;
        if (n3 = n3.firstBaseUpdate, n3 !== null) {
          do {
            var o3 = {
              lane: n3.lane,
              tag: n3.tag,
              payload: n3.payload,
              callback: null,
              next: null
            };
            a3 === null ? i3 = a3 = o3 : a3 = a3.next = o3, n3 = n3.next;
          } while (n3 !== null);
          a3 === null ? i3 = a3 = t3 : a3 = a3.next = t3;
        } else i3 = a3 = t3;
        n3 = {
          baseState: r3.baseState,
          firstBaseUpdate: i3,
          lastBaseUpdate: a3,
          shared: r3.shared,
          callbacks: r3.callbacks
        }, e3.updateQueue = n3;
        return;
      }
      e3 = n3.lastBaseUpdate, e3 === null ? n3.firstBaseUpdate = t3 : e3.next = t3, n3.lastBaseUpdate = t3;
    }
    var za = false;
    function Ba() {
      if (za) {
        var e3 = aa;
        if (e3 !== null) throw e3;
      }
    }
    function Va(e3, t3, n3, r3) {
      za = false;
      var i3 = e3.updateQueue;
      Ma = false;
      var a3 = i3.firstBaseUpdate, o3 = i3.lastBaseUpdate, s3 = i3.shared.pending;
      if (s3 !== null) {
        i3.shared.pending = null;
        var c3 = s3, l3 = c3.next;
        c3.next = null, o3 === null ? a3 = l3 : o3.next = l3, o3 = c3;
        var u2 = e3.alternate;
        u2 !== null && (u2 = u2.updateQueue, s3 = u2.lastBaseUpdate, s3 !== o3 && (s3 === null ? u2.firstBaseUpdate = l3 : s3.next = l3, u2.lastBaseUpdate = c3));
      }
      if (a3 !== null) {
        var d3 = i3.baseState;
        o3 = 0, u2 = l3 = c3 = null, s3 = a3;
        do {
          var f2 = s3.lane & -536870913, p3 = f2 !== s3.lane;
          if (p3 ? (Q & f2) === f2 : (r3 & f2) === f2) {
            f2 !== 0 && f2 === ia && (za = true), u2 !== null && (u2 = u2.next = {
              lane: 0,
              tag: s3.tag,
              payload: s3.payload,
              callback: null,
              next: null
            });
            a: {
              var m2 = e3, g3 = s3;
              f2 = t3;
              var _3 = n3;
              switch (g3.tag) {
                case 1:
                  if (m2 = g3.payload, typeof m2 == `function`) {
                    d3 = m2.call(_3, d3, f2);
                    break a;
                  }
                  d3 = m2;
                  break a;
                case 3:
                  m2.flags = m2.flags & -65537 | 128;
                case 0:
                  if (m2 = g3.payload, f2 = typeof m2 == `function` ? m2.call(_3, d3, f2) : m2, f2 == null) break a;
                  d3 = h2({}, d3, f2);
                  break a;
                case 2:
                  Ma = true;
              }
            }
            f2 = s3.callback, f2 !== null && (e3.flags |= 64, p3 && (e3.flags |= 8192), p3 = i3.callbacks, p3 === null ? i3.callbacks = [
              f2
            ] : p3.push(f2));
          } else p3 = {
            lane: f2,
            tag: s3.tag,
            payload: s3.payload,
            callback: s3.callback,
            next: null
          }, u2 === null ? (l3 = u2 = p3, c3 = d3) : u2 = u2.next = p3, o3 |= f2;
          if (s3 = s3.next, s3 === null) {
            if (s3 = i3.shared.pending, s3 === null) break;
            p3 = s3, s3 = p3.next, p3.next = null, i3.lastBaseUpdate = p3, i3.shared.pending = null;
          }
        } while (1);
        u2 === null && (c3 = d3), i3.baseState = c3, i3.firstBaseUpdate = l3, i3.lastBaseUpdate = u2, a3 === null && (i3.shared.lanes = 0), Wl |= o3, e3.lanes = o3, e3.memoizedState = d3;
      }
    }
    function Ha(e3, t3) {
      if (typeof e3 != `function`) throw Error(i2(191, e3));
      e3.call(t3);
    }
    function Ua(e3, t3) {
      var n3 = e3.callbacks;
      if (n3 !== null) for (e3.callbacks = null, e3 = 0; e3 < n3.length; e3++) Ha(n3[e3], t3);
    }
    var Wa = ae2(null), Ga = ae2(0);
    function Ka(e3, t3) {
      e3 = Hl, se2(Ga, e3), se2(Wa, t3), Hl = e3 | t3.baseLanes;
    }
    function qa() {
      se2(Ga, Hl), se2(Wa, Wa.current);
    }
    function Ja() {
      Hl = Ga.current, oe2(Wa), oe2(Ga);
    }
    var Ya = ae2(null), Xa = null;
    function Za(e3) {
      var t3 = e3.alternate;
      se2(no, no.current & 1), se2(Ya, e3), Xa === null && (t3 === null || Wa.current !== null || t3.memoizedState !== null) && (Xa = e3);
    }
    function Qa(e3) {
      se2(no, no.current), se2(Ya, e3), Xa === null && (Xa = e3);
    }
    function $a(e3) {
      e3.tag === 22 ? (se2(no, no.current), se2(Ya, e3), Xa === null && (Xa = e3)) : eo(e3);
    }
    function eo() {
      se2(no, no.current), se2(Ya, Ya.current);
    }
    function to(e3) {
      oe2(Ya), Xa === e3 && (Xa = null), oe2(no);
    }
    var no = ae2(0);
    function ro(e3) {
      for (var t3 = e3; t3 !== null; ) {
        if (t3.tag === 13) {
          var n3 = t3.memoizedState;
          if (n3 !== null && (n3 = n3.dehydrated, n3 === null || of(n3) || sf(n3))) return t3;
        } else if (t3.tag === 19 && (t3.memoizedProps.revealOrder === `forwards` || t3.memoizedProps.revealOrder === `backwards` || t3.memoizedProps.revealOrder === `unstable_legacy-backwards` || t3.memoizedProps.revealOrder === `together`)) {
          if (t3.flags & 128) return t3;
        } else if (t3.child !== null) {
          t3.child.return = t3, t3 = t3.child;
          continue;
        }
        if (t3 === e3) break;
        for (; t3.sibling === null; ) {
          if (t3.return === null || t3.return === e3) return null;
          t3 = t3.return;
        }
        t3.sibling.return = t3.return, t3 = t3.sibling;
      }
      return null;
    }
    var io = 0, Y = null, ao = null, oo = null, so = false, co = false, lo = false, uo = 0, fo = 0, po = null, mo = 0;
    function ho() {
      throw Error(i2(321));
    }
    function go(e3, t3) {
      if (t3 === null) return false;
      for (var n3 = 0; n3 < t3.length && n3 < e3.length; n3++) if (!mr(e3[n3], t3[n3])) return false;
      return true;
    }
    function _o(e3, t3, n3, r3, i3, a3) {
      return io = a3, Y = t3, t3.memoizedState = null, t3.updateQueue = null, t3.lanes = 0, M2.H = e3 === null || e3.memoizedState === null ? Ps : Fs, lo = false, a3 = n3(r3, i3), lo = false, co && (a3 = yo(t3, n3, r3, i3)), vo(e3), a3;
    }
    function vo(e3) {
      M2.H = Ns;
      var t3 = ao !== null && ao.next !== null;
      if (io = 0, oo = ao = Y = null, so = false, fo = 0, po = null, t3) throw Error(i2(300));
      e3 === null || Qs || (e3 = e3.dependencies, e3 !== null && Gi(e3) && (Qs = true));
    }
    function yo(e3, t3, n3, r3) {
      Y = e3;
      var a3 = 0;
      do {
        if (co && (po = null), fo = 0, co = false, 25 <= a3) throw Error(i2(301));
        if (a3 += 1, oo = ao = null, e3.updateQueue != null) {
          var o3 = e3.updateQueue;
          o3.lastEffect = null, o3.events = null, o3.stores = null, o3.memoCache != null && (o3.memoCache.index = 0);
        }
        M2.H = Is, o3 = t3(n3, r3);
      } while (co);
      return o3;
    }
    function bo() {
      var e3 = M2.H, t3 = e3.useState()[0];
      return t3 = typeof t3.then == `function` ? Do(t3) : t3, e3 = e3.useState()[0], (ao === null ? null : ao.memoizedState) !== e3 && (Y.flags |= 1024), t3;
    }
    function xo() {
      var e3 = uo !== 0;
      return uo = 0, e3;
    }
    function So(e3, t3, n3) {
      t3.updateQueue = e3.updateQueue, t3.flags &= -2053, e3.lanes &= ~n3;
    }
    function Co(e3) {
      if (so) {
        for (e3 = e3.memoizedState; e3 !== null; ) {
          var t3 = e3.queue;
          t3 !== null && (t3.pending = null), e3 = e3.next;
        }
        so = false;
      }
      io = 0, oo = ao = Y = null, co = false, fo = uo = 0, po = null;
    }
    function wo() {
      var e3 = {
        memoizedState: null,
        baseState: null,
        baseQueue: null,
        queue: null,
        next: null
      };
      return oo === null ? Y.memoizedState = oo = e3 : oo = oo.next = e3, oo;
    }
    function To() {
      if (ao === null) {
        var e3 = Y.alternate;
        e3 = e3 === null ? null : e3.memoizedState;
      } else e3 = ao.next;
      var t3 = oo === null ? Y.memoizedState : oo.next;
      if (t3 !== null) oo = t3, ao = e3;
      else {
        if (e3 === null) throw Y.alternate === null ? Error(i2(467)) : Error(i2(310));
        ao = e3, e3 = {
          memoizedState: ao.memoizedState,
          baseState: ao.baseState,
          baseQueue: ao.baseQueue,
          queue: ao.queue,
          next: null
        }, oo === null ? Y.memoizedState = oo = e3 : oo = oo.next = e3;
      }
      return oo;
    }
    function Eo() {
      return {
        lastEffect: null,
        events: null,
        stores: null,
        memoCache: null
      };
    }
    function Do(e3) {
      var t3 = fo;
      return fo += 1, po === null && (po = []), e3 = ya(po, e3, t3), t3 = Y, (oo === null ? t3.memoizedState : oo.next) === null && (t3 = t3.alternate, M2.H = t3 === null || t3.memoizedState === null ? Ps : Fs), e3;
    }
    function Oo(e3) {
      if (typeof e3 == `object` && e3) {
        if (typeof e3.then == `function`) return Do(e3);
        if (e3.$$typeof === C2) return qi(e3);
      }
      throw Error(i2(438, String(e3)));
    }
    function ko(e3) {
      var t3 = null, n3 = Y.updateQueue;
      if (n3 !== null && (t3 = n3.memoCache), t3 == null) {
        var r3 = Y.alternate;
        r3 !== null && (r3 = r3.updateQueue, r3 !== null && (r3 = r3.memoCache, r3 != null && (t3 = {
          data: r3.data.map(function(e4) {
            return e4.slice();
          }),
          index: 0
        })));
      }
      if (t3 ??= {
        data: [],
        index: 0
      }, n3 === null && (n3 = Eo(), Y.updateQueue = n3), n3.memoCache = t3, n3 = t3.data[t3.index], n3 === void 0) for (n3 = t3.data[t3.index] = Array(e3), r3 = 0; r3 < e3; r3++) n3[r3] = E2;
      return t3.index++, n3;
    }
    function Ao(e3, t3) {
      return typeof t3 == `function` ? t3(e3) : t3;
    }
    function jo(e3) {
      return Mo(To(), ao, e3);
    }
    function Mo(e3, t3, n3) {
      var r3 = e3.queue;
      if (r3 === null) throw Error(i2(311));
      r3.lastRenderedReducer = n3;
      var a3 = e3.baseQueue, o3 = r3.pending;
      if (o3 !== null) {
        if (a3 !== null) {
          var s3 = a3.next;
          a3.next = o3.next, o3.next = s3;
        }
        t3.baseQueue = a3 = o3, r3.pending = null;
      }
      if (o3 = e3.baseState, a3 === null) e3.memoizedState = o3;
      else {
        t3 = a3.next;
        var c3 = s3 = null, l3 = null, u2 = t3, d3 = false;
        do {
          var f2 = u2.lane & -536870913;
          if (f2 === u2.lane ? (io & f2) === f2 : (Q & f2) === f2) {
            var p3 = u2.revertLane;
            if (p3 === 0) l3 !== null && (l3 = l3.next = {
              lane: 0,
              revertLane: 0,
              gesture: null,
              action: u2.action,
              hasEagerState: u2.hasEagerState,
              eagerState: u2.eagerState,
              next: null
            }), f2 === ia && (d3 = true);
            else if ((io & p3) === p3) {
              u2 = u2.next, p3 === ia && (d3 = true);
              continue;
            } else f2 = {
              lane: 0,
              revertLane: u2.revertLane,
              gesture: null,
              action: u2.action,
              hasEagerState: u2.hasEagerState,
              eagerState: u2.eagerState,
              next: null
            }, l3 === null ? (c3 = l3 = f2, s3 = o3) : l3 = l3.next = f2, Y.lanes |= p3, Wl |= p3;
            f2 = u2.action, lo && n3(o3, f2), o3 = u2.hasEagerState ? u2.eagerState : n3(o3, f2);
          } else p3 = {
            lane: f2,
            revertLane: u2.revertLane,
            gesture: u2.gesture,
            action: u2.action,
            hasEagerState: u2.hasEagerState,
            eagerState: u2.eagerState,
            next: null
          }, l3 === null ? (c3 = l3 = p3, s3 = o3) : l3 = l3.next = p3, Y.lanes |= f2, Wl |= f2;
          u2 = u2.next;
        } while (u2 !== null && u2 !== t3);
        if (l3 === null ? s3 = o3 : l3.next = c3, !mr(o3, e3.memoizedState) && (Qs = true, d3 && (n3 = aa, n3 !== null))) throw n3;
        e3.memoizedState = o3, e3.baseState = s3, e3.baseQueue = l3, r3.lastRenderedState = o3;
      }
      return a3 === null && (r3.lanes = 0), [
        e3.memoizedState,
        r3.dispatch
      ];
    }
    function No(e3) {
      var t3 = To(), n3 = t3.queue;
      if (n3 === null) throw Error(i2(311));
      n3.lastRenderedReducer = e3;
      var r3 = n3.dispatch, a3 = n3.pending, o3 = t3.memoizedState;
      if (a3 !== null) {
        n3.pending = null;
        var s3 = a3 = a3.next;
        do
          o3 = e3(o3, s3.action), s3 = s3.next;
        while (s3 !== a3);
        mr(o3, t3.memoizedState) || (Qs = true), t3.memoizedState = o3, t3.baseQueue === null && (t3.baseState = o3), n3.lastRenderedState = o3;
      }
      return [
        o3,
        r3
      ];
    }
    function Po(e3, t3, n3) {
      var r3 = Y, a3 = To(), o3 = J;
      if (o3) {
        if (n3 === void 0) throw Error(i2(407));
        n3 = n3();
      } else n3 = t3();
      var s3 = !mr((ao || a3).memoizedState, n3);
      if (s3 && (a3.memoizedState = n3, Qs = true), a3 = a3.queue, as(Lo.bind(null, r3, a3, e3), [
        e3
      ]), a3.getSnapshot !== t3 || s3 || oo !== null && oo.memoizedState.tag & 1) {
        if (r3.flags |= 2048, es(9, {
          destroy: void 0
        }, Io.bind(null, r3, a3, n3, t3), null), Il === null) throw Error(i2(349));
        o3 || io & 127 || Fo(r3, t3, n3);
      }
      return n3;
    }
    function Fo(e3, t3, n3) {
      e3.flags |= 16384, e3 = {
        getSnapshot: t3,
        value: n3
      }, t3 = Y.updateQueue, t3 === null ? (t3 = Eo(), Y.updateQueue = t3, t3.stores = [
        e3
      ]) : (n3 = t3.stores, n3 === null ? t3.stores = [
        e3
      ] : n3.push(e3));
    }
    function Io(e3, t3, n3, r3) {
      t3.value = n3, t3.getSnapshot = r3, Ro(t3) && zo(e3);
    }
    function Lo(e3, t3, n3) {
      return n3(function() {
        Ro(t3) && zo(e3);
      });
    }
    function Ro(e3) {
      var t3 = e3.getSnapshot;
      e3 = e3.value;
      try {
        var n3 = t3();
        return !mr(e3, n3);
      } catch {
        return true;
      }
    }
    function zo(e3) {
      var t3 = Yr(e3, 2);
      t3 !== null && mu(t3, e3, 2);
    }
    function Bo(e3) {
      var t3 = wo();
      if (typeof e3 == `function`) {
        var n3 = e3;
        if (e3 = n3(), lo) {
          Re2(true);
          try {
            n3();
          } finally {
            Re2(false);
          }
        }
      }
      return t3.memoizedState = t3.baseState = e3, t3.queue = {
        pending: null,
        lanes: 0,
        dispatch: null,
        lastRenderedReducer: Ao,
        lastRenderedState: e3
      }, t3;
    }
    function Vo(e3, t3, n3, r3) {
      return e3.baseState = n3, Mo(e3, ao, typeof r3 == `function` ? r3 : Ao);
    }
    function Ho(e3, t3, n3, r3, a3) {
      if (As(e3)) throw Error(i2(485));
      if (e3 = t3.action, e3 !== null) {
        var o3 = {
          payload: a3,
          action: e3,
          next: null,
          isTransition: true,
          status: `pending`,
          value: null,
          reason: null,
          listeners: [],
          then: function(e4) {
            o3.listeners.push(e4);
          }
        };
        M2.T === null ? o3.isTransition = false : n3(true), r3(o3), n3 = t3.pending, n3 === null ? (o3.next = t3.pending = o3, Uo(t3, o3)) : (o3.next = n3.next, t3.pending = n3.next = o3);
      }
    }
    function Uo(e3, t3) {
      var n3 = t3.action, r3 = t3.payload, i3 = e3.state;
      if (t3.isTransition) {
        var a3 = M2.T, o3 = {};
        M2.T = o3;
        try {
          var s3 = n3(i3, r3), c3 = M2.S;
          c3 !== null && c3(o3, s3), Wo(e3, t3, s3);
        } catch (n4) {
          Ko(e3, t3, n4);
        } finally {
          a3 !== null && o3.types !== null && (a3.types = o3.types), M2.T = a3;
        }
      } else try {
        a3 = n3(i3, r3), Wo(e3, t3, a3);
      } catch (n4) {
        Ko(e3, t3, n4);
      }
    }
    function Wo(e3, t3, n3) {
      typeof n3 == `object` && n3 && typeof n3.then == `function` ? n3.then(function(n4) {
        Go(e3, t3, n4);
      }, function(n4) {
        return Ko(e3, t3, n4);
      }) : Go(e3, t3, n3);
    }
    function Go(e3, t3, n3) {
      t3.status = `fulfilled`, t3.value = n3, qo(t3), e3.state = n3, t3 = e3.pending, t3 !== null && (n3 = t3.next, n3 === t3 ? e3.pending = null : (n3 = n3.next, t3.next = n3, Uo(e3, n3)));
    }
    function Ko(e3, t3, n3) {
      var r3 = e3.pending;
      if (e3.pending = null, r3 !== null) {
        r3 = r3.next;
        do
          t3.status = `rejected`, t3.reason = n3, qo(t3), t3 = t3.next;
        while (t3 !== r3);
      }
      e3.action = null;
    }
    function qo(e3) {
      e3 = e3.listeners;
      for (var t3 = 0; t3 < e3.length; t3++) (0, e3[t3])();
    }
    function Jo(e3, t3) {
      return t3;
    }
    function Yo(e3, t3) {
      if (J) {
        var n3 = Il.formState;
        if (n3 !== null) {
          a: {
            var r3 = Y;
            if (J) {
              if (Ei) {
                b: {
                  for (var i3 = Ei, a3 = Oi; i3.nodeType !== 8; ) {
                    if (!a3) {
                      i3 = null;
                      break b;
                    }
                    if (i3 = lf(i3.nextSibling), i3 === null) {
                      i3 = null;
                      break b;
                    }
                  }
                  a3 = i3.data, i3 = a3 === `F!` || a3 === `F` ? i3 : null;
                }
                if (i3) {
                  Ei = lf(i3.nextSibling), r3 = i3.data === `F!`;
                  break a;
                }
              }
              Ai(r3);
            }
            r3 = false;
          }
          r3 && (t3 = n3[0]);
        }
      }
      return n3 = wo(), n3.memoizedState = n3.baseState = t3, r3 = {
        pending: null,
        lanes: 0,
        dispatch: null,
        lastRenderedReducer: Jo,
        lastRenderedState: t3
      }, n3.queue = r3, n3 = Ds.bind(null, Y, r3), r3.dispatch = n3, r3 = Bo(false), a3 = ks.bind(null, Y, false, r3.queue), r3 = wo(), i3 = {
        state: t3,
        dispatch: null,
        action: e3,
        pending: null
      }, r3.queue = i3, n3 = Ho.bind(null, Y, i3, a3, n3), i3.dispatch = n3, r3.memoizedState = e3, [
        t3,
        n3,
        false
      ];
    }
    function Xo(e3) {
      return Zo(To(), ao, e3);
    }
    function Zo(e3, t3, n3) {
      if (t3 = Mo(e3, t3, Jo)[0], e3 = jo(Ao)[0], typeof t3 == `object` && t3 && typeof t3.then == `function`) try {
        var r3 = Do(t3);
      } catch (e4) {
        throw e4 === ma ? ga : e4;
      }
      else r3 = t3;
      t3 = To();
      var i3 = t3.queue, a3 = i3.dispatch;
      return n3 !== t3.memoizedState && (Y.flags |= 2048, es(9, {
        destroy: void 0
      }, Qo.bind(null, i3, n3), null)), [
        r3,
        a3,
        e3
      ];
    }
    function Qo(e3, t3) {
      e3.action = t3;
    }
    function $o(e3) {
      var t3 = To(), n3 = ao;
      if (n3 !== null) return Zo(t3, n3, e3);
      To(), t3 = t3.memoizedState, n3 = To();
      var r3 = n3.queue.dispatch;
      return n3.memoizedState = e3, [
        t3,
        r3,
        false
      ];
    }
    function es(e3, t3, n3, r3) {
      return e3 = {
        tag: e3,
        create: n3,
        deps: r3,
        inst: t3,
        next: null
      }, t3 = Y.updateQueue, t3 === null && (t3 = Eo(), Y.updateQueue = t3), n3 = t3.lastEffect, n3 === null ? t3.lastEffect = e3.next = e3 : (r3 = n3.next, n3.next = e3, e3.next = r3, t3.lastEffect = e3), e3;
    }
    function ts() {
      return To().memoizedState;
    }
    function ns(e3, t3, n3, r3) {
      var i3 = wo();
      Y.flags |= e3, i3.memoizedState = es(1 | t3, {
        destroy: void 0
      }, n3, r3 === void 0 ? null : r3);
    }
    function rs(e3, t3, n3, r3) {
      var i3 = To();
      r3 = r3 === void 0 ? null : r3;
      var a3 = i3.memoizedState.inst;
      ao !== null && r3 !== null && go(r3, ao.memoizedState.deps) ? i3.memoizedState = es(t3, a3, n3, r3) : (Y.flags |= e3, i3.memoizedState = es(1 | t3, a3, n3, r3));
    }
    function is(e3, t3) {
      ns(8390656, 8, e3, t3);
    }
    function as(e3, t3) {
      rs(2048, 8, e3, t3);
    }
    function os(e3) {
      Y.flags |= 4;
      var t3 = Y.updateQueue;
      if (t3 === null) t3 = Eo(), Y.updateQueue = t3, t3.events = [
        e3
      ];
      else {
        var n3 = t3.events;
        n3 === null ? t3.events = [
          e3
        ] : n3.push(e3);
      }
    }
    function ss(e3) {
      var t3 = To().memoizedState;
      return os({
        ref: t3,
        nextImpl: e3
      }), function() {
        if (X & 2) throw Error(i2(440));
        return t3.impl.apply(void 0, arguments);
      };
    }
    function cs(e3, t3) {
      return rs(4, 2, e3, t3);
    }
    function ls(e3, t3) {
      return rs(4, 4, e3, t3);
    }
    function us(e3, t3) {
      if (typeof t3 == `function`) {
        e3 = e3();
        var n3 = t3(e3);
        return function() {
          typeof n3 == `function` ? n3() : t3(null);
        };
      }
      if (t3 != null) return e3 = e3(), t3.current = e3, function() {
        t3.current = null;
      };
    }
    function ds(e3, t3, n3) {
      n3 = n3 == null ? null : n3.concat([
        e3
      ]), rs(4, 4, us.bind(null, t3, e3), n3);
    }
    function fs() {
    }
    function ps(e3, t3) {
      var n3 = To();
      t3 = t3 === void 0 ? null : t3;
      var r3 = n3.memoizedState;
      return t3 !== null && go(t3, r3[1]) ? r3[0] : (n3.memoizedState = [
        e3,
        t3
      ], e3);
    }
    function ms(e3, t3) {
      var n3 = To();
      t3 = t3 === void 0 ? null : t3;
      var r3 = n3.memoizedState;
      if (t3 !== null && go(t3, r3[1])) return r3[0];
      if (r3 = e3(), lo) {
        Re2(true);
        try {
          e3();
        } finally {
          Re2(false);
        }
      }
      return n3.memoizedState = [
        r3,
        t3
      ], r3;
    }
    function hs(e3, t3, n3) {
      return n3 === void 0 || io & 1073741824 && !(Q & 261930) ? e3.memoizedState = t3 : (e3.memoizedState = n3, e3 = pu(), Y.lanes |= e3, Wl |= e3, n3);
    }
    function gs(e3, t3, n3, r3) {
      return mr(n3, t3) ? n3 : Wa.current === null ? !(io & 42) || io & 1073741824 && !(Q & 261930) ? (Qs = true, e3.memoizedState = n3) : (e3 = pu(), Y.lanes |= e3, Wl |= e3, t3) : (e3 = hs(e3, n3, r3), mr(e3, t3) || (Qs = true), e3);
    }
    function _s(e3, t3, n3, r3, i3) {
      var a3 = N2.p;
      N2.p = a3 !== 0 && 8 > a3 ? a3 : 8;
      var o3 = M2.T, s3 = {};
      M2.T = s3, ks(e3, false, t3, n3);
      try {
        var c3 = i3(), l3 = M2.S;
        l3 !== null && l3(s3, c3), typeof c3 == `object` && c3 && typeof c3.then == `function` ? Os(e3, t3, ca(c3, r3), fu(e3)) : Os(e3, t3, r3, fu(e3));
      } catch (n4) {
        Os(e3, t3, {
          then: function() {
          },
          status: `rejected`,
          reason: n4
        }, fu());
      } finally {
        N2.p = a3, o3 !== null && s3.types !== null && (o3.types = s3.types), M2.T = o3;
      }
    }
    function vs() {
    }
    function ys(e3, t3, n3, r3) {
      if (e3.tag !== 5) throw Error(i2(476));
      var a3 = bs(e3).queue;
      _s(e3, a3, t3, ie2, n3 === null ? vs : function() {
        return xs(e3), n3(r3);
      });
    }
    function bs(e3) {
      var t3 = e3.memoizedState;
      if (t3 !== null) return t3;
      t3 = {
        memoizedState: ie2,
        baseState: ie2,
        baseQueue: null,
        queue: {
          pending: null,
          lanes: 0,
          dispatch: null,
          lastRenderedReducer: Ao,
          lastRenderedState: ie2
        },
        next: null
      };
      var n3 = {};
      return t3.next = {
        memoizedState: n3,
        baseState: n3,
        baseQueue: null,
        queue: {
          pending: null,
          lanes: 0,
          dispatch: null,
          lastRenderedReducer: Ao,
          lastRenderedState: n3
        },
        next: null
      }, e3.memoizedState = t3, e3 = e3.alternate, e3 !== null && (e3.memoizedState = t3), t3;
    }
    function xs(e3) {
      var t3 = bs(e3);
      t3.next === null && (t3 = e3.alternate.memoizedState), Os(e3, t3.next.queue, {}, fu());
    }
    function Ss() {
      return qi($f);
    }
    function Cs() {
      return To().memoizedState;
    }
    function ws() {
      return To().memoizedState;
    }
    function Ts(e3) {
      for (var t3 = e3.return; t3 !== null; ) {
        switch (t3.tag) {
          case 24:
          case 3:
            var n3 = fu();
            e3 = Fa(n3);
            var r3 = Ia(t3, e3, n3);
            r3 !== null && (mu(r3, t3, n3), La(r3, t3, n3)), t3 = {
              cache: ea()
            }, e3.payload = t3;
            return;
        }
        t3 = t3.return;
      }
    }
    function Es(e3, t3, n3) {
      var r3 = fu();
      n3 = {
        lane: r3,
        revertLane: 0,
        gesture: null,
        action: n3,
        hasEagerState: false,
        eagerState: null,
        next: null
      }, As(e3) ? js(t3, n3) : (n3 = Jr(e3, t3, n3, r3), n3 !== null && (mu(n3, e3, r3), Ms(n3, t3, r3)));
    }
    function Ds(e3, t3, n3) {
      Os(e3, t3, n3, fu());
    }
    function Os(e3, t3, n3, r3) {
      var i3 = {
        lane: r3,
        revertLane: 0,
        gesture: null,
        action: n3,
        hasEagerState: false,
        eagerState: null,
        next: null
      };
      if (As(e3)) js(t3, i3);
      else {
        var a3 = e3.alternate;
        if (e3.lanes === 0 && (a3 === null || a3.lanes === 0) && (a3 = t3.lastRenderedReducer, a3 !== null)) try {
          var o3 = t3.lastRenderedState, s3 = a3(o3, n3);
          if (i3.hasEagerState = true, i3.eagerState = s3, mr(s3, o3)) return qr(e3, t3, i3, 0), Il === null && Kr(), false;
        } catch {
        }
        if (n3 = Jr(e3, t3, i3, r3), n3 !== null) return mu(n3, e3, r3), Ms(n3, t3, r3), true;
      }
      return false;
    }
    function ks(e3, t3, n3, r3) {
      if (r3 = {
        lane: 2,
        revertLane: dd(),
        gesture: null,
        action: r3,
        hasEagerState: false,
        eagerState: null,
        next: null
      }, As(e3)) {
        if (t3) throw Error(i2(479));
      } else t3 = Jr(e3, n3, r3, 2), t3 !== null && mu(t3, e3, 2);
    }
    function As(e3) {
      var t3 = e3.alternate;
      return e3 === Y || t3 !== null && t3 === Y;
    }
    function js(e3, t3) {
      co = so = true;
      var n3 = e3.pending;
      n3 === null ? t3.next = t3 : (t3.next = n3.next, n3.next = t3), e3.pending = t3;
    }
    function Ms(e3, t3, n3) {
      if (n3 & 4194048) {
        var r3 = t3.lanes;
        r3 &= e3.pendingLanes, n3 |= r3, t3.lanes = n3, $e2(e3, n3);
      }
    }
    var Ns = {
      readContext: qi,
      use: Oo,
      useCallback: ho,
      useContext: ho,
      useEffect: ho,
      useImperativeHandle: ho,
      useLayoutEffect: ho,
      useInsertionEffect: ho,
      useMemo: ho,
      useReducer: ho,
      useRef: ho,
      useState: ho,
      useDebugValue: ho,
      useDeferredValue: ho,
      useTransition: ho,
      useSyncExternalStore: ho,
      useId: ho,
      useHostTransitionStatus: ho,
      useFormState: ho,
      useActionState: ho,
      useOptimistic: ho,
      useMemoCache: ho,
      useCacheRefresh: ho
    };
    Ns.useEffectEvent = ho;
    var Ps = {
      readContext: qi,
      use: Oo,
      useCallback: function(e3, t3) {
        return wo().memoizedState = [
          e3,
          t3 === void 0 ? null : t3
        ], e3;
      },
      useContext: qi,
      useEffect: is,
      useImperativeHandle: function(e3, t3, n3) {
        n3 = n3 == null ? null : n3.concat([
          e3
        ]), ns(4194308, 4, us.bind(null, t3, e3), n3);
      },
      useLayoutEffect: function(e3, t3) {
        return ns(4194308, 4, e3, t3);
      },
      useInsertionEffect: function(e3, t3) {
        ns(4, 2, e3, t3);
      },
      useMemo: function(e3, t3) {
        var n3 = wo();
        t3 = t3 === void 0 ? null : t3;
        var r3 = e3();
        if (lo) {
          Re2(true);
          try {
            e3();
          } finally {
            Re2(false);
          }
        }
        return n3.memoizedState = [
          r3,
          t3
        ], r3;
      },
      useReducer: function(e3, t3, n3) {
        var r3 = wo();
        if (n3 !== void 0) {
          var i3 = n3(t3);
          if (lo) {
            Re2(true);
            try {
              n3(t3);
            } finally {
              Re2(false);
            }
          }
        } else i3 = t3;
        return r3.memoizedState = r3.baseState = i3, e3 = {
          pending: null,
          lanes: 0,
          dispatch: null,
          lastRenderedReducer: e3,
          lastRenderedState: i3
        }, r3.queue = e3, e3 = e3.dispatch = Es.bind(null, Y, e3), [
          r3.memoizedState,
          e3
        ];
      },
      useRef: function(e3) {
        var t3 = wo();
        return e3 = {
          current: e3
        }, t3.memoizedState = e3;
      },
      useState: function(e3) {
        e3 = Bo(e3);
        var t3 = e3.queue, n3 = Ds.bind(null, Y, t3);
        return t3.dispatch = n3, [
          e3.memoizedState,
          n3
        ];
      },
      useDebugValue: fs,
      useDeferredValue: function(e3, t3) {
        return hs(wo(), e3, t3);
      },
      useTransition: function() {
        var e3 = Bo(false);
        return e3 = _s.bind(null, Y, e3.queue, true, false), wo().memoizedState = e3, [
          false,
          e3
        ];
      },
      useSyncExternalStore: function(e3, t3, n3) {
        var r3 = Y, a3 = wo();
        if (J) {
          if (n3 === void 0) throw Error(i2(407));
          n3 = n3();
        } else {
          if (n3 = t3(), Il === null) throw Error(i2(349));
          Q & 127 || Fo(r3, t3, n3);
        }
        a3.memoizedState = n3;
        var o3 = {
          value: n3,
          getSnapshot: t3
        };
        return a3.queue = o3, is(Lo.bind(null, r3, o3, e3), [
          e3
        ]), r3.flags |= 2048, es(9, {
          destroy: void 0
        }, Io.bind(null, r3, o3, n3, t3), null), n3;
      },
      useId: function() {
        var e3 = wo(), t3 = Il.identifierPrefix;
        if (J) {
          var n3 = yi, r3 = vi;
          n3 = (r3 & ~(1 << 32 - ze2(r3) - 1)).toString(32) + n3, t3 = `_` + t3 + `R_` + n3, n3 = uo++, 0 < n3 && (t3 += `H` + n3.toString(32)), t3 += `_`;
        } else n3 = mo++, t3 = `_` + t3 + `r_` + n3.toString(32) + `_`;
        return e3.memoizedState = t3;
      },
      useHostTransitionStatus: Ss,
      useFormState: Yo,
      useActionState: Yo,
      useOptimistic: function(e3) {
        var t3 = wo();
        t3.memoizedState = t3.baseState = e3;
        var n3 = {
          pending: null,
          lanes: 0,
          dispatch: null,
          lastRenderedReducer: null,
          lastRenderedState: null
        };
        return t3.queue = n3, t3 = ks.bind(null, Y, true, n3), n3.dispatch = t3, [
          e3,
          t3
        ];
      },
      useMemoCache: ko,
      useCacheRefresh: function() {
        return wo().memoizedState = Ts.bind(null, Y);
      },
      useEffectEvent: function(e3) {
        var t3 = wo(), n3 = {
          impl: e3
        };
        return t3.memoizedState = n3, function() {
          if (X & 2) throw Error(i2(440));
          return n3.impl.apply(void 0, arguments);
        };
      }
    }, Fs = {
      readContext: qi,
      use: Oo,
      useCallback: ps,
      useContext: qi,
      useEffect: as,
      useImperativeHandle: ds,
      useInsertionEffect: cs,
      useLayoutEffect: ls,
      useMemo: ms,
      useReducer: jo,
      useRef: ts,
      useState: function() {
        return jo(Ao);
      },
      useDebugValue: fs,
      useDeferredValue: function(e3, t3) {
        return gs(To(), ao.memoizedState, e3, t3);
      },
      useTransition: function() {
        var e3 = jo(Ao)[0], t3 = To().memoizedState;
        return [
          typeof e3 == `boolean` ? e3 : Do(e3),
          t3
        ];
      },
      useSyncExternalStore: Po,
      useId: Cs,
      useHostTransitionStatus: Ss,
      useFormState: Xo,
      useActionState: Xo,
      useOptimistic: function(e3, t3) {
        return Vo(To(), ao, e3, t3);
      },
      useMemoCache: ko,
      useCacheRefresh: ws
    };
    Fs.useEffectEvent = ss;
    var Is = {
      readContext: qi,
      use: Oo,
      useCallback: ps,
      useContext: qi,
      useEffect: as,
      useImperativeHandle: ds,
      useInsertionEffect: cs,
      useLayoutEffect: ls,
      useMemo: ms,
      useReducer: No,
      useRef: ts,
      useState: function() {
        return No(Ao);
      },
      useDebugValue: fs,
      useDeferredValue: function(e3, t3) {
        var n3 = To();
        return ao === null ? hs(n3, e3, t3) : gs(n3, ao.memoizedState, e3, t3);
      },
      useTransition: function() {
        var e3 = No(Ao)[0], t3 = To().memoizedState;
        return [
          typeof e3 == `boolean` ? e3 : Do(e3),
          t3
        ];
      },
      useSyncExternalStore: Po,
      useId: Cs,
      useHostTransitionStatus: Ss,
      useFormState: $o,
      useActionState: $o,
      useOptimistic: function(e3, t3) {
        var n3 = To();
        return ao === null ? (n3.baseState = e3, [
          e3,
          n3.queue.dispatch
        ]) : Vo(n3, ao, e3, t3);
      },
      useMemoCache: ko,
      useCacheRefresh: ws
    };
    Is.useEffectEvent = ss;
    function Ls(e3, t3, n3, r3) {
      t3 = e3.memoizedState, n3 = n3(r3, t3), n3 = n3 == null ? t3 : h2({}, t3, n3), e3.memoizedState = n3, e3.lanes === 0 && (e3.updateQueue.baseState = n3);
    }
    var Rs = {
      enqueueSetState: function(e3, t3, n3) {
        e3 = e3._reactInternals;
        var r3 = fu(), i3 = Fa(r3);
        i3.payload = t3, n3 != null && (i3.callback = n3), t3 = Ia(e3, i3, r3), t3 !== null && (mu(t3, e3, r3), La(t3, e3, r3));
      },
      enqueueReplaceState: function(e3, t3, n3) {
        e3 = e3._reactInternals;
        var r3 = fu(), i3 = Fa(r3);
        i3.tag = 1, i3.payload = t3, n3 != null && (i3.callback = n3), t3 = Ia(e3, i3, r3), t3 !== null && (mu(t3, e3, r3), La(t3, e3, r3));
      },
      enqueueForceUpdate: function(e3, t3) {
        e3 = e3._reactInternals;
        var n3 = fu(), r3 = Fa(n3);
        r3.tag = 2, t3 != null && (r3.callback = t3), t3 = Ia(e3, r3, n3), t3 !== null && (mu(t3, e3, n3), La(t3, e3, n3));
      }
    };
    function zs(e3, t3, n3, r3, i3, a3, o3) {
      return e3 = e3.stateNode, typeof e3.shouldComponentUpdate == `function` ? e3.shouldComponentUpdate(r3, a3, o3) : t3.prototype && t3.prototype.isPureReactComponent ? !hr(n3, r3) || !hr(i3, a3) : true;
    }
    function Bs(e3, t3, n3, r3) {
      e3 = t3.state, typeof t3.componentWillReceiveProps == `function` && t3.componentWillReceiveProps(n3, r3), typeof t3.UNSAFE_componentWillReceiveProps == `function` && t3.UNSAFE_componentWillReceiveProps(n3, r3), t3.state !== e3 && Rs.enqueueReplaceState(t3, t3.state, null);
    }
    function Vs(e3, t3) {
      var n3 = t3;
      if (`ref` in t3) for (var r3 in n3 = {}, t3) r3 !== `ref` && (n3[r3] = t3[r3]);
      if (e3 = e3.defaultProps) for (var i3 in n3 === t3 && (n3 = h2({}, n3)), e3) n3[i3] === void 0 && (n3[i3] = e3[i3]);
      return n3;
    }
    function Hs(e3) {
      Hr(e3);
    }
    function Us(e3) {
      console.error(e3);
    }
    function Ws(e3) {
      Hr(e3);
    }
    function Gs(e3, t3) {
      try {
        var n3 = e3.onUncaughtError;
        n3(t3.value, {
          componentStack: t3.stack
        });
      } catch (e4) {
        setTimeout(function() {
          throw e4;
        });
      }
    }
    function Ks(e3, t3, n3) {
      try {
        var r3 = e3.onCaughtError;
        r3(n3.value, {
          componentStack: n3.stack,
          errorBoundary: t3.tag === 1 ? t3.stateNode : null
        });
      } catch (e4) {
        setTimeout(function() {
          throw e4;
        });
      }
    }
    function qs(e3, t3, n3) {
      return n3 = Fa(n3), n3.tag = 3, n3.payload = {
        element: null
      }, n3.callback = function() {
        Gs(e3, t3);
      }, n3;
    }
    function Js(e3) {
      return e3 = Fa(e3), e3.tag = 3, e3;
    }
    function Ys(e3, t3, n3, r3) {
      var i3 = n3.type.getDerivedStateFromError;
      if (typeof i3 == `function`) {
        var a3 = r3.value;
        e3.payload = function() {
          return i3(a3);
        }, e3.callback = function() {
          Ks(t3, n3, r3);
        };
      }
      var o3 = n3.stateNode;
      o3 !== null && typeof o3.componentDidCatch == `function` && (e3.callback = function() {
        Ks(t3, n3, r3), typeof i3 != `function` && (nu === null ? nu = /* @__PURE__ */ new Set([
          this
        ]) : nu.add(this));
        var e4 = r3.stack;
        this.componentDidCatch(r3.value, {
          componentStack: e4 === null ? `` : e4
        });
      });
    }
    function Xs(e3, t3, n3, r3, a3) {
      if (n3.flags |= 32768, typeof r3 == `object` && r3 && typeof r3.then == `function`) {
        if (t3 = n3.alternate, t3 !== null && Wi(t3, n3, a3, true), n3 = Ya.current, n3 !== null) {
          switch (n3.tag) {
            case 31:
            case 13:
              return Xa === null ? Eu() : n3.alternate === null && Ul === 0 && (Ul = 3), n3.flags &= -257, n3.flags |= 65536, n3.lanes = a3, r3 === _a ? n3.flags |= 16384 : (t3 = n3.updateQueue, t3 === null ? n3.updateQueue = /* @__PURE__ */ new Set([
                r3
              ]) : t3.add(r3), Gu(e3, r3, a3)), false;
            case 22:
              return n3.flags |= 65536, r3 === _a ? n3.flags |= 16384 : (t3 = n3.updateQueue, t3 === null ? (t3 = {
                transitions: null,
                markerInstances: null,
                retryQueue: /* @__PURE__ */ new Set([
                  r3
                ])
              }, n3.updateQueue = t3) : (n3 = t3.retryQueue, n3 === null ? t3.retryQueue = /* @__PURE__ */ new Set([
                r3
              ]) : n3.add(r3)), Gu(e3, r3, a3)), false;
          }
          throw Error(i2(435, n3.tag));
        }
        return Gu(e3, r3, a3), Eu(), false;
      }
      if (J) return t3 = Ya.current, t3 === null ? (r3 !== ki && (t3 = Error(i2(423), {
        cause: r3
      }), Ii(ui(t3, n3))), e3 = e3.current.alternate, e3.flags |= 65536, a3 &= -a3, e3.lanes |= a3, r3 = ui(r3, n3), a3 = qs(e3.stateNode, r3, a3), Ra(e3, a3), Ul !== 4 && (Ul = 2)) : (!(t3.flags & 65536) && (t3.flags |= 256), t3.flags |= 65536, t3.lanes = a3, r3 !== ki && (e3 = Error(i2(422), {
        cause: r3
      }), Ii(ui(e3, n3)))), false;
      var o3 = Error(i2(520), {
        cause: r3
      });
      if (o3 = ui(o3, n3), Yl === null ? Yl = [
        o3
      ] : Yl.push(o3), Ul !== 4 && (Ul = 2), t3 === null) return true;
      r3 = ui(r3, n3), n3 = t3;
      do {
        switch (n3.tag) {
          case 3:
            return n3.flags |= 65536, e3 = a3 & -a3, n3.lanes |= e3, e3 = qs(n3.stateNode, r3, e3), Ra(n3, e3), false;
          case 1:
            if (t3 = n3.type, o3 = n3.stateNode, !(n3.flags & 128) && (typeof t3.getDerivedStateFromError == `function` || o3 !== null && typeof o3.componentDidCatch == `function` && (nu === null || !nu.has(o3)))) return n3.flags |= 65536, a3 &= -a3, n3.lanes |= a3, a3 = Js(a3), Ys(a3, e3, n3, r3), Ra(n3, a3), false;
        }
        n3 = n3.return;
      } while (n3 !== null);
      return false;
    }
    var Zs = Error(i2(461)), Qs = false;
    function $s(e3, t3, n3, r3) {
      t3.child = e3 === null ? ja(t3, null, n3, r3) : Aa(t3, e3.child, n3, r3);
    }
    function ec(e3, t3, n3, r3, i3) {
      n3 = n3.render;
      var a3 = t3.ref;
      if (`ref` in r3) {
        var o3 = {};
        for (var s3 in r3) s3 !== `ref` && (o3[s3] = r3[s3]);
      } else o3 = r3;
      return Ki(t3), r3 = _o(e3, t3, n3, o3, a3, i3), s3 = xo(), e3 !== null && !Qs ? (So(e3, t3, i3), wc(e3, t3, i3)) : (J && s3 && Si(t3), t3.flags |= 1, $s(e3, t3, r3, i3), t3.child);
    }
    function tc(e3, t3, n3, r3, i3) {
      if (e3 === null) {
        var a3 = n3.type;
        return typeof a3 == `function` && !ti(a3) && a3.defaultProps === void 0 && n3.compare === null ? (t3.tag = 15, t3.type = a3, nc(e3, t3, a3, r3, i3)) : (e3 = ii(n3.type, null, r3, t3, t3.mode, i3), e3.ref = t3.ref, e3.return = t3, t3.child = e3);
      }
      if (a3 = e3.child, !Tc(e3, i3)) {
        var o3 = a3.memoizedProps;
        if (n3 = n3.compare, n3 = n3 === null ? hr : n3, n3(o3, r3) && e3.ref === t3.ref) return wc(e3, t3, i3);
      }
      return t3.flags |= 1, e3 = ni(a3, r3), e3.ref = t3.ref, e3.return = t3, t3.child = e3;
    }
    function nc(e3, t3, n3, r3, i3) {
      if (e3 !== null) {
        var a3 = e3.memoizedProps;
        if (hr(a3, r3) && e3.ref === t3.ref) if (Qs = false, t3.pendingProps = r3 = a3, Tc(e3, i3)) e3.flags & 131072 && (Qs = true);
        else return t3.lanes = e3.lanes, wc(e3, t3, i3);
      }
      return uc(e3, t3, n3, r3, i3);
    }
    function rc(e3, t3, n3, r3) {
      var i3 = r3.children, a3 = e3 === null ? null : e3.memoizedState;
      if (e3 === null && t3.stateNode === null && (t3.stateNode = {
        _visibility: 1,
        _pendingMarkers: null,
        _retryCache: null,
        _transitions: null
      }), r3.mode === `hidden`) {
        if (t3.flags & 128) {
          if (a3 = a3 === null ? n3 : a3.baseLanes | n3, e3 !== null) {
            for (r3 = t3.child = e3.child, i3 = 0; r3 !== null; ) i3 = i3 | r3.lanes | r3.childLanes, r3 = r3.sibling;
            r3 = i3 & ~a3;
          } else r3 = 0, t3.child = null;
          return ac(e3, t3, a3, n3, r3);
        }
        if (n3 & 536870912) t3.memoizedState = {
          baseLanes: 0,
          cachePool: null
        }, e3 !== null && fa(t3, a3 === null ? null : a3.cachePool), a3 === null ? qa() : Ka(t3, a3), $a(t3);
        else return r3 = t3.lanes = 536870912, ac(e3, t3, a3 === null ? n3 : a3.baseLanes | n3, n3, r3);
      } else a3 === null ? (e3 !== null && fa(t3, null), qa(), eo(t3)) : (fa(t3, a3.cachePool), Ka(t3, a3), eo(t3), t3.memoizedState = null);
      return $s(e3, t3, i3, n3), t3.child;
    }
    function ic(e3, t3) {
      return e3 !== null && e3.tag === 22 || t3.stateNode !== null || (t3.stateNode = {
        _visibility: 1,
        _pendingMarkers: null,
        _retryCache: null,
        _transitions: null
      }), t3.sibling;
    }
    function ac(e3, t3, n3, r3, i3) {
      var a3 = da();
      return a3 = a3 === null ? null : {
        parent: $i._currentValue,
        pool: a3
      }, t3.memoizedState = {
        baseLanes: n3,
        cachePool: a3
      }, e3 !== null && fa(t3, null), qa(), $a(t3), e3 !== null && Wi(e3, t3, r3, true), t3.childLanes = i3, null;
    }
    function oc(e3, t3) {
      return t3 = yc({
        mode: t3.mode,
        children: t3.children
      }, e3.mode), t3.ref = e3.ref, e3.child = t3, t3.return = e3, t3;
    }
    function sc(e3, t3, n3) {
      return Aa(t3, e3.child, null, n3), e3 = oc(t3, t3.pendingProps), e3.flags |= 2, to(t3), t3.memoizedState = null, e3;
    }
    function cc(e3, t3, n3) {
      var r3 = t3.pendingProps, a3 = (t3.flags & 128) != 0;
      if (t3.flags &= -129, e3 === null) {
        if (J) {
          if (r3.mode === `hidden`) return e3 = oc(t3, r3), t3.lanes = 536870912, ic(null, e3);
          if (Qa(t3), (e3 = Ei) ? (e3 = af(e3, Oi), e3 = e3 !== null && e3.data === `&` ? e3 : null, e3 !== null && (t3.memoizedState = {
            dehydrated: e3,
            treeContext: _i === null ? null : {
              id: vi,
              overflow: yi
            },
            retryLane: 536870912,
            hydrationErrors: null
          }, n3 = si(e3), n3.return = t3, t3.child = n3, Ti = t3, Ei = null)) : e3 = null, e3 === null) throw Ai(t3);
          return t3.lanes = 536870912, null;
        }
        return oc(t3, r3);
      }
      var o3 = e3.memoizedState;
      if (o3 !== null) {
        var s3 = o3.dehydrated;
        if (Qa(t3), a3) if (t3.flags & 256) t3.flags &= -257, t3 = sc(e3, t3, n3);
        else if (t3.memoizedState !== null) t3.child = e3.child, t3.flags |= 128, t3 = null;
        else throw Error(i2(558));
        else if (Qs || Wi(e3, t3, n3, false), a3 = (n3 & e3.childLanes) !== 0, Qs || a3) {
          if (r3 = Il, r3 !== null && (s3 = et2(r3, n3), s3 !== 0 && s3 !== o3.retryLane)) throw o3.retryLane = s3, Yr(e3, s3), mu(r3, e3, s3), Zs;
          Eu(), t3 = sc(e3, t3, n3);
        } else e3 = o3.treeContext, Ei = lf(s3.nextSibling), Ti = t3, J = true, Di = null, Oi = false, e3 !== null && wi(t3, e3), t3 = oc(t3, r3), t3.flags |= 4096;
        return t3;
      }
      return e3 = ni(e3.child, {
        mode: r3.mode,
        children: r3.children
      }), e3.ref = t3.ref, t3.child = e3, e3.return = t3, e3;
    }
    function lc(e3, t3) {
      var n3 = t3.ref;
      if (n3 === null) e3 !== null && e3.ref !== null && (t3.flags |= 4194816);
      else {
        if (typeof n3 != `function` && typeof n3 != `object`) throw Error(i2(284));
        (e3 === null || e3.ref !== n3) && (t3.flags |= 4194816);
      }
    }
    function uc(e3, t3, n3, r3, i3) {
      return Ki(t3), n3 = _o(e3, t3, n3, r3, void 0, i3), r3 = xo(), e3 !== null && !Qs ? (So(e3, t3, i3), wc(e3, t3, i3)) : (J && r3 && Si(t3), t3.flags |= 1, $s(e3, t3, n3, i3), t3.child);
    }
    function dc(e3, t3, n3, r3, i3, a3) {
      return Ki(t3), t3.updateQueue = null, n3 = yo(t3, r3, n3, i3), vo(e3), r3 = xo(), e3 !== null && !Qs ? (So(e3, t3, a3), wc(e3, t3, a3)) : (J && r3 && Si(t3), t3.flags |= 1, $s(e3, t3, n3, a3), t3.child);
    }
    function fc(e3, t3, n3, r3, i3) {
      if (Ki(t3), t3.stateNode === null) {
        var a3 = Qr, o3 = n3.contextType;
        typeof o3 == `object` && o3 && (a3 = qi(o3)), a3 = new n3(r3, a3), t3.memoizedState = a3.state !== null && a3.state !== void 0 ? a3.state : null, a3.updater = Rs, t3.stateNode = a3, a3._reactInternals = t3, a3 = t3.stateNode, a3.props = r3, a3.state = t3.memoizedState, a3.refs = {}, Na(t3), o3 = n3.contextType, a3.context = typeof o3 == `object` && o3 ? qi(o3) : Qr, a3.state = t3.memoizedState, o3 = n3.getDerivedStateFromProps, typeof o3 == `function` && (Ls(t3, n3, o3, r3), a3.state = t3.memoizedState), typeof n3.getDerivedStateFromProps == `function` || typeof a3.getSnapshotBeforeUpdate == `function` || typeof a3.UNSAFE_componentWillMount != `function` && typeof a3.componentWillMount != `function` || (o3 = a3.state, typeof a3.componentWillMount == `function` && a3.componentWillMount(), typeof a3.UNSAFE_componentWillMount == `function` && a3.UNSAFE_componentWillMount(), o3 !== a3.state && Rs.enqueueReplaceState(a3, a3.state, null), Va(t3, r3, a3, i3), Ba(), a3.state = t3.memoizedState), typeof a3.componentDidMount == `function` && (t3.flags |= 4194308), r3 = true;
      } else if (e3 === null) {
        a3 = t3.stateNode;
        var s3 = t3.memoizedProps, c3 = Vs(n3, s3);
        a3.props = c3;
        var l3 = a3.context, u2 = n3.contextType;
        o3 = Qr, typeof u2 == `object` && u2 && (o3 = qi(u2));
        var d3 = n3.getDerivedStateFromProps;
        u2 = typeof d3 == `function` || typeof a3.getSnapshotBeforeUpdate == `function`, s3 = t3.pendingProps !== s3, u2 || typeof a3.UNSAFE_componentWillReceiveProps != `function` && typeof a3.componentWillReceiveProps != `function` || (s3 || l3 !== o3) && Bs(t3, a3, r3, o3), Ma = false;
        var f2 = t3.memoizedState;
        a3.state = f2, Va(t3, r3, a3, i3), Ba(), l3 = t3.memoizedState, s3 || f2 !== l3 || Ma ? (typeof d3 == `function` && (Ls(t3, n3, d3, r3), l3 = t3.memoizedState), (c3 = Ma || zs(t3, n3, c3, r3, f2, l3, o3)) ? (u2 || typeof a3.UNSAFE_componentWillMount != `function` && typeof a3.componentWillMount != `function` || (typeof a3.componentWillMount == `function` && a3.componentWillMount(), typeof a3.UNSAFE_componentWillMount == `function` && a3.UNSAFE_componentWillMount()), typeof a3.componentDidMount == `function` && (t3.flags |= 4194308)) : (typeof a3.componentDidMount == `function` && (t3.flags |= 4194308), t3.memoizedProps = r3, t3.memoizedState = l3), a3.props = r3, a3.state = l3, a3.context = o3, r3 = c3) : (typeof a3.componentDidMount == `function` && (t3.flags |= 4194308), r3 = false);
      } else {
        a3 = t3.stateNode, Pa(e3, t3), o3 = t3.memoizedProps, u2 = Vs(n3, o3), a3.props = u2, d3 = t3.pendingProps, f2 = a3.context, l3 = n3.contextType, c3 = Qr, typeof l3 == `object` && l3 && (c3 = qi(l3)), s3 = n3.getDerivedStateFromProps, (l3 = typeof s3 == `function` || typeof a3.getSnapshotBeforeUpdate == `function`) || typeof a3.UNSAFE_componentWillReceiveProps != `function` && typeof a3.componentWillReceiveProps != `function` || (o3 !== d3 || f2 !== c3) && Bs(t3, a3, r3, c3), Ma = false, f2 = t3.memoizedState, a3.state = f2, Va(t3, r3, a3, i3), Ba();
        var p3 = t3.memoizedState;
        o3 !== d3 || f2 !== p3 || Ma || e3 !== null && e3.dependencies !== null && Gi(e3.dependencies) ? (typeof s3 == `function` && (Ls(t3, n3, s3, r3), p3 = t3.memoizedState), (u2 = Ma || zs(t3, n3, u2, r3, f2, p3, c3) || e3 !== null && e3.dependencies !== null && Gi(e3.dependencies)) ? (l3 || typeof a3.UNSAFE_componentWillUpdate != `function` && typeof a3.componentWillUpdate != `function` || (typeof a3.componentWillUpdate == `function` && a3.componentWillUpdate(r3, p3, c3), typeof a3.UNSAFE_componentWillUpdate == `function` && a3.UNSAFE_componentWillUpdate(r3, p3, c3)), typeof a3.componentDidUpdate == `function` && (t3.flags |= 4), typeof a3.getSnapshotBeforeUpdate == `function` && (t3.flags |= 1024)) : (typeof a3.componentDidUpdate != `function` || o3 === e3.memoizedProps && f2 === e3.memoizedState || (t3.flags |= 4), typeof a3.getSnapshotBeforeUpdate != `function` || o3 === e3.memoizedProps && f2 === e3.memoizedState || (t3.flags |= 1024), t3.memoizedProps = r3, t3.memoizedState = p3), a3.props = r3, a3.state = p3, a3.context = c3, r3 = u2) : (typeof a3.componentDidUpdate != `function` || o3 === e3.memoizedProps && f2 === e3.memoizedState || (t3.flags |= 4), typeof a3.getSnapshotBeforeUpdate != `function` || o3 === e3.memoizedProps && f2 === e3.memoizedState || (t3.flags |= 1024), r3 = false);
      }
      return a3 = r3, lc(e3, t3), r3 = (t3.flags & 128) != 0, a3 || r3 ? (a3 = t3.stateNode, n3 = r3 && typeof n3.getDerivedStateFromError != `function` ? null : a3.render(), t3.flags |= 1, e3 !== null && r3 ? (t3.child = Aa(t3, e3.child, null, i3), t3.child = Aa(t3, null, n3, i3)) : $s(e3, t3, n3, i3), t3.memoizedState = a3.state, e3 = t3.child) : e3 = wc(e3, t3, i3), e3;
    }
    function pc(e3, t3, n3, r3) {
      return Pi(), t3.flags |= 256, $s(e3, t3, n3, r3), t3.child;
    }
    var mc = {
      dehydrated: null,
      treeContext: null,
      retryLane: 0,
      hydrationErrors: null
    };
    function hc(e3) {
      return {
        baseLanes: e3,
        cachePool: pa()
      };
    }
    function gc(e3, t3, n3) {
      return e3 = e3 === null ? 0 : e3.childLanes & ~n3, t3 && (e3 |= ql), e3;
    }
    function _c(e3, t3, n3) {
      var r3 = t3.pendingProps, a3 = false, o3 = (t3.flags & 128) != 0, s3;
      if ((s3 = o3) || (s3 = e3 !== null && e3.memoizedState === null ? false : (no.current & 2) != 0), s3 && (a3 = true, t3.flags &= -129), s3 = (t3.flags & 32) != 0, t3.flags &= -33, e3 === null) {
        if (J) {
          if (a3 ? Za(t3) : eo(t3), (e3 = Ei) ? (e3 = af(e3, Oi), e3 = e3 !== null && e3.data !== `&` ? e3 : null, e3 !== null && (t3.memoizedState = {
            dehydrated: e3,
            treeContext: _i === null ? null : {
              id: vi,
              overflow: yi
            },
            retryLane: 536870912,
            hydrationErrors: null
          }, n3 = si(e3), n3.return = t3, t3.child = n3, Ti = t3, Ei = null)) : e3 = null, e3 === null) throw Ai(t3);
          return sf(e3) ? t3.lanes = 32 : t3.lanes = 536870912, null;
        }
        var c3 = r3.children;
        return r3 = r3.fallback, a3 ? (eo(t3), a3 = t3.mode, c3 = yc({
          mode: `hidden`,
          children: c3
        }, a3), r3 = ai(r3, a3, n3, null), c3.return = t3, r3.return = t3, c3.sibling = r3, t3.child = c3, r3 = t3.child, r3.memoizedState = hc(n3), r3.childLanes = gc(e3, s3, n3), t3.memoizedState = mc, ic(null, r3)) : (Za(t3), vc(t3, c3));
      }
      var l3 = e3.memoizedState;
      if (l3 !== null && (c3 = l3.dehydrated, c3 !== null)) {
        if (o3) t3.flags & 256 ? (Za(t3), t3.flags &= -257, t3 = bc(e3, t3, n3)) : t3.memoizedState === null ? (eo(t3), c3 = r3.fallback, a3 = t3.mode, r3 = yc({
          mode: `visible`,
          children: r3.children
        }, a3), c3 = ai(c3, a3, n3, null), c3.flags |= 2, r3.return = t3, c3.return = t3, r3.sibling = c3, t3.child = r3, Aa(t3, e3.child, null, n3), r3 = t3.child, r3.memoizedState = hc(n3), r3.childLanes = gc(e3, s3, n3), t3.memoizedState = mc, t3 = ic(null, r3)) : (eo(t3), t3.child = e3.child, t3.flags |= 128, t3 = null);
        else if (Za(t3), sf(c3)) {
          if (s3 = c3.nextSibling && c3.nextSibling.dataset, s3) var u2 = s3.dgst;
          s3 = u2, r3 = Error(i2(419)), r3.stack = ``, r3.digest = s3, Ii({
            value: r3,
            source: null,
            stack: null
          }), t3 = bc(e3, t3, n3);
        } else if (Qs || Wi(e3, t3, n3, false), s3 = (n3 & e3.childLanes) !== 0, Qs || s3) {
          if (s3 = Il, s3 !== null && (r3 = et2(s3, n3), r3 !== 0 && r3 !== l3.retryLane)) throw l3.retryLane = r3, Yr(e3, r3), mu(s3, e3, r3), Zs;
          of(c3) || Eu(), t3 = bc(e3, t3, n3);
        } else of(c3) ? (t3.flags |= 192, t3.child = e3.child, t3 = null) : (e3 = l3.treeContext, Ei = lf(c3.nextSibling), Ti = t3, J = true, Di = null, Oi = false, e3 !== null && wi(t3, e3), t3 = vc(t3, r3.children), t3.flags |= 4096);
        return t3;
      }
      return a3 ? (eo(t3), c3 = r3.fallback, a3 = t3.mode, l3 = e3.child, u2 = l3.sibling, r3 = ni(l3, {
        mode: `hidden`,
        children: r3.children
      }), r3.subtreeFlags = l3.subtreeFlags & 65011712, u2 === null ? (c3 = ai(c3, a3, n3, null), c3.flags |= 2) : c3 = ni(u2, c3), c3.return = t3, r3.return = t3, r3.sibling = c3, t3.child = r3, ic(null, r3), r3 = t3.child, c3 = e3.child.memoizedState, c3 === null ? c3 = hc(n3) : (a3 = c3.cachePool, a3 === null ? a3 = pa() : (l3 = $i._currentValue, a3 = a3.parent === l3 ? a3 : {
        parent: l3,
        pool: l3
      }), c3 = {
        baseLanes: c3.baseLanes | n3,
        cachePool: a3
      }), r3.memoizedState = c3, r3.childLanes = gc(e3, s3, n3), t3.memoizedState = mc, ic(e3.child, r3)) : (Za(t3), n3 = e3.child, e3 = n3.sibling, n3 = ni(n3, {
        mode: `visible`,
        children: r3.children
      }), n3.return = t3, n3.sibling = null, e3 !== null && (s3 = t3.deletions, s3 === null ? (t3.deletions = [
        e3
      ], t3.flags |= 16) : s3.push(e3)), t3.child = n3, t3.memoizedState = null, n3);
    }
    function vc(e3, t3) {
      return t3 = yc({
        mode: `visible`,
        children: t3
      }, e3.mode), t3.return = e3, e3.child = t3;
    }
    function yc(e3, t3) {
      return e3 = ei(22, e3, null, t3), e3.lanes = 0, e3;
    }
    function bc(e3, t3, n3) {
      return Aa(t3, e3.child, null, n3), e3 = vc(t3, t3.pendingProps.children), e3.flags |= 2, t3.memoizedState = null, e3;
    }
    function xc(e3, t3, n3) {
      e3.lanes |= t3;
      var r3 = e3.alternate;
      r3 !== null && (r3.lanes |= t3), Hi(e3.return, t3, n3);
    }
    function Sc(e3, t3, n3, r3, i3, a3) {
      var o3 = e3.memoizedState;
      o3 === null ? e3.memoizedState = {
        isBackwards: t3,
        rendering: null,
        renderingStartTime: 0,
        last: r3,
        tail: n3,
        tailMode: i3,
        treeForkCount: a3
      } : (o3.isBackwards = t3, o3.rendering = null, o3.renderingStartTime = 0, o3.last = r3, o3.tail = n3, o3.tailMode = i3, o3.treeForkCount = a3);
    }
    function Cc(e3, t3, n3) {
      var r3 = t3.pendingProps, i3 = r3.revealOrder, a3 = r3.tail;
      r3 = r3.children;
      var o3 = no.current, s3 = (o3 & 2) != 0;
      if (s3 ? (o3 = o3 & 1 | 2, t3.flags |= 128) : o3 &= 1, se2(no, o3), $s(e3, t3, r3, n3), r3 = J ? mi : 0, !s3 && e3 !== null && e3.flags & 128) a: for (e3 = t3.child; e3 !== null; ) {
        if (e3.tag === 13) e3.memoizedState !== null && xc(e3, n3, t3);
        else if (e3.tag === 19) xc(e3, n3, t3);
        else if (e3.child !== null) {
          e3.child.return = e3, e3 = e3.child;
          continue;
        }
        if (e3 === t3) break a;
        for (; e3.sibling === null; ) {
          if (e3.return === null || e3.return === t3) break a;
          e3 = e3.return;
        }
        e3.sibling.return = e3.return, e3 = e3.sibling;
      }
      switch (i3) {
        case `forwards`:
          for (n3 = t3.child, i3 = null; n3 !== null; ) e3 = n3.alternate, e3 !== null && ro(e3) === null && (i3 = n3), n3 = n3.sibling;
          n3 = i3, n3 === null ? (i3 = t3.child, t3.child = null) : (i3 = n3.sibling, n3.sibling = null), Sc(t3, false, i3, n3, a3, r3);
          break;
        case `backwards`:
        case `unstable_legacy-backwards`:
          for (n3 = null, i3 = t3.child, t3.child = null; i3 !== null; ) {
            if (e3 = i3.alternate, e3 !== null && ro(e3) === null) {
              t3.child = i3;
              break;
            }
            e3 = i3.sibling, i3.sibling = n3, n3 = i3, i3 = e3;
          }
          Sc(t3, true, n3, null, a3, r3);
          break;
        case `together`:
          Sc(t3, false, null, null, void 0, r3);
          break;
        default:
          t3.memoizedState = null;
      }
      return t3.child;
    }
    function wc(e3, t3, n3) {
      if (e3 !== null && (t3.dependencies = e3.dependencies), Wl |= t3.lanes, (n3 & t3.childLanes) === 0) if (e3 !== null) {
        if (Wi(e3, t3, n3, false), (n3 & t3.childLanes) === 0) return null;
      } else return null;
      if (e3 !== null && t3.child !== e3.child) throw Error(i2(153));
      if (t3.child !== null) {
        for (e3 = t3.child, n3 = ni(e3, e3.pendingProps), t3.child = n3, n3.return = t3; e3.sibling !== null; ) e3 = e3.sibling, n3 = n3.sibling = ni(e3, e3.pendingProps), n3.return = t3;
        n3.sibling = null;
      }
      return t3.child;
    }
    function Tc(e3, t3) {
      return (e3.lanes & t3) === 0 ? (e3 = e3.dependencies, !!(e3 !== null && Gi(e3))) : true;
    }
    function Ec(e3, t3, n3) {
      switch (t3.tag) {
        case 3:
          fe2(t3, t3.stateNode.containerInfo), Bi(t3, $i, e3.memoizedState.cache), Pi();
          break;
        case 27:
        case 5:
          me2(t3);
          break;
        case 4:
          fe2(t3, t3.stateNode.containerInfo);
          break;
        case 10:
          Bi(t3, t3.type, t3.memoizedProps.value);
          break;
        case 31:
          if (t3.memoizedState !== null) return t3.flags |= 128, Qa(t3), null;
          break;
        case 13:
          var r3 = t3.memoizedState;
          if (r3 !== null) return r3.dehydrated === null ? (n3 & t3.child.childLanes) === 0 ? (Za(t3), e3 = wc(e3, t3, n3), e3 === null ? null : e3.sibling) : _c(e3, t3, n3) : (Za(t3), t3.flags |= 128, null);
          Za(t3);
          break;
        case 19:
          var i3 = (e3.flags & 128) != 0;
          if (r3 = (n3 & t3.childLanes) !== 0, r3 ||= (Wi(e3, t3, n3, false), (n3 & t3.childLanes) !== 0), i3) {
            if (r3) return Cc(e3, t3, n3);
            t3.flags |= 128;
          }
          if (i3 = t3.memoizedState, i3 !== null && (i3.rendering = null, i3.tail = null, i3.lastEffect = null), se2(no, no.current), r3) break;
          return null;
        case 22:
          return t3.lanes = 0, rc(e3, t3, n3, t3.pendingProps);
        case 24:
          Bi(t3, $i, e3.memoizedState.cache);
      }
      return wc(e3, t3, n3);
    }
    function Dc(e3, t3, n3) {
      if (e3 !== null) if (e3.memoizedProps !== t3.pendingProps) Qs = true;
      else {
        if (!Tc(e3, n3) && !(t3.flags & 128)) return Qs = false, Ec(e3, t3, n3);
        Qs = !!(e3.flags & 131072);
      }
      else Qs = false, J && t3.flags & 1048576 && xi(t3, mi, t3.index);
      switch (t3.lanes = 0, t3.tag) {
        case 16:
          a: {
            var r3 = t3.pendingProps;
            if (e3 = ba(t3.elementType), t3.type = e3, typeof e3 == `function`) ti(e3) ? (r3 = Vs(e3, r3), t3.tag = 1, t3 = fc(null, t3, e3, r3, n3)) : (t3.tag = 0, t3 = uc(null, t3, e3, r3, n3));
            else {
              if (e3 != null) {
                var a3 = e3.$$typeof;
                if (a3 === w2) {
                  t3.tag = 11, t3 = ec(null, t3, e3, r3, n3);
                  break a;
                } else if (a3 === te2) {
                  t3.tag = 14, t3 = tc(null, t3, e3, r3, n3);
                  break a;
                }
              }
              throw t3 = A2(e3) || e3, Error(i2(306, t3, ``));
            }
          }
          return t3;
        case 0:
          return uc(e3, t3, t3.type, t3.pendingProps, n3);
        case 1:
          return r3 = t3.type, a3 = Vs(r3, t3.pendingProps), fc(e3, t3, r3, a3, n3);
        case 3:
          a: {
            if (fe2(t3, t3.stateNode.containerInfo), e3 === null) throw Error(i2(387));
            r3 = t3.pendingProps;
            var o3 = t3.memoizedState;
            a3 = o3.element, Pa(e3, t3), Va(t3, r3, null, n3);
            var s3 = t3.memoizedState;
            if (r3 = s3.cache, Bi(t3, $i, r3), r3 !== o3.cache && Ui(t3, [
              $i
            ], n3, true), Ba(), r3 = s3.element, o3.isDehydrated) if (o3 = {
              element: r3,
              isDehydrated: false,
              cache: s3.cache
            }, t3.updateQueue.baseState = o3, t3.memoizedState = o3, t3.flags & 256) {
              t3 = pc(e3, t3, r3, n3);
              break a;
            } else if (r3 !== a3) {
              a3 = ui(Error(i2(424)), t3), Ii(a3), t3 = pc(e3, t3, r3, n3);
              break a;
            } else {
              switch (e3 = t3.stateNode.containerInfo, e3.nodeType) {
                case 9:
                  e3 = e3.body;
                  break;
                default:
                  e3 = e3.nodeName === `HTML` ? e3.ownerDocument.body : e3;
              }
              for (Ei = lf(e3.firstChild), Ti = t3, J = true, Di = null, Oi = true, n3 = ja(t3, null, r3, n3), t3.child = n3; n3; ) n3.flags = n3.flags & -3 | 4096, n3 = n3.sibling;
            }
            else {
              if (Pi(), r3 === a3) {
                t3 = wc(e3, t3, n3);
                break a;
              }
              $s(e3, t3, r3, n3);
            }
            t3 = t3.child;
          }
          return t3;
        case 26:
          return lc(e3, t3), e3 === null ? (n3 = Af(t3.type, null, t3.pendingProps, null)) ? t3.memoizedState = n3 : J || (n3 = t3.type, e3 = t3.pendingProps, r3 = Vd(ue2.current).createElement(n3), r3[ot2] = t3, r3[st2] = e3, Fd(r3, n3, e3), B2(r3), t3.stateNode = r3) : t3.memoizedState = Af(t3.type, e3.memoizedProps, t3.pendingProps, e3.memoizedState), null;
        case 27:
          return me2(t3), e3 === null && J && (r3 = t3.stateNode = pf(t3.type, t3.pendingProps, ue2.current), Ti = t3, Oi = true, a3 = Ei, Qd(t3.type) ? (uf = a3, Ei = lf(r3.firstChild)) : Ei = a3), $s(e3, t3, t3.pendingProps.children, n3), lc(e3, t3), e3 === null && (t3.flags |= 4194304), t3.child;
        case 5:
          return e3 === null && J && ((a3 = r3 = Ei) && (r3 = nf(r3, t3.type, t3.pendingProps, Oi), r3 === null ? a3 = false : (t3.stateNode = r3, Ti = t3, Ei = lf(r3.firstChild), Oi = false, a3 = true)), a3 || Ai(t3)), me2(t3), a3 = t3.type, o3 = t3.pendingProps, s3 = e3 === null ? null : e3.memoizedProps, r3 = o3.children, Wd(a3, o3) ? r3 = null : s3 !== null && Wd(a3, s3) && (t3.flags |= 32), t3.memoizedState !== null && (a3 = _o(e3, t3, bo, null, null, n3), $f._currentValue = a3), lc(e3, t3), $s(e3, t3, r3, n3), t3.child;
        case 6:
          return e3 === null && J && ((e3 = n3 = Ei) && (n3 = rf(n3, t3.pendingProps, Oi), n3 === null ? e3 = false : (t3.stateNode = n3, Ti = t3, Ei = null, e3 = true)), e3 || Ai(t3)), null;
        case 13:
          return _c(e3, t3, n3);
        case 4:
          return fe2(t3, t3.stateNode.containerInfo), r3 = t3.pendingProps, e3 === null ? t3.child = Aa(t3, null, r3, n3) : $s(e3, t3, r3, n3), t3.child;
        case 11:
          return ec(e3, t3, t3.type, t3.pendingProps, n3);
        case 7:
          return $s(e3, t3, t3.pendingProps, n3), t3.child;
        case 8:
          return $s(e3, t3, t3.pendingProps.children, n3), t3.child;
        case 12:
          return $s(e3, t3, t3.pendingProps.children, n3), t3.child;
        case 10:
          return r3 = t3.pendingProps, Bi(t3, t3.type, r3.value), $s(e3, t3, r3.children, n3), t3.child;
        case 9:
          return a3 = t3.type._context, r3 = t3.pendingProps.children, Ki(t3), a3 = qi(a3), r3 = r3(a3), t3.flags |= 1, $s(e3, t3, r3, n3), t3.child;
        case 14:
          return tc(e3, t3, t3.type, t3.pendingProps, n3);
        case 15:
          return nc(e3, t3, t3.type, t3.pendingProps, n3);
        case 19:
          return Cc(e3, t3, n3);
        case 31:
          return cc(e3, t3, n3);
        case 22:
          return rc(e3, t3, n3, t3.pendingProps);
        case 24:
          return Ki(t3), r3 = qi($i), e3 === null ? (a3 = da(), a3 === null && (a3 = Il, o3 = ea(), a3.pooledCache = o3, o3.refCount++, o3 !== null && (a3.pooledCacheLanes |= n3), a3 = o3), t3.memoizedState = {
            parent: r3,
            cache: a3
          }, Na(t3), Bi(t3, $i, a3)) : ((e3.lanes & n3) !== 0 && (Pa(e3, t3), Va(t3, null, null, n3), Ba()), a3 = e3.memoizedState, o3 = t3.memoizedState, a3.parent === r3 ? (r3 = o3.cache, Bi(t3, $i, r3), r3 !== a3.cache && Ui(t3, [
            $i
          ], n3, true)) : (a3 = {
            parent: r3,
            cache: r3
          }, t3.memoizedState = a3, t3.lanes === 0 && (t3.memoizedState = t3.updateQueue.baseState = a3), Bi(t3, $i, r3))), $s(e3, t3, t3.pendingProps.children, n3), t3.child;
        case 29:
          throw t3.pendingProps;
      }
      throw Error(i2(156, t3.tag));
    }
    function Oc(e3) {
      e3.flags |= 4;
    }
    function kc(e3, t3, n3, r3, i3) {
      if ((t3 = (e3.mode & 32) != 0) && (t3 = false), t3) {
        if (e3.flags |= 16777216, (i3 & 335544128) === i3) if (e3.stateNode.complete) e3.flags |= 8192;
        else if (Cu()) e3.flags |= 8192;
        else throw xa = _a, ha;
      } else e3.flags &= -16777217;
    }
    function Ac(e3, t3) {
      if (t3.type !== `stylesheet` || t3.state.loading & 4) e3.flags &= -16777217;
      else if (e3.flags |= 16777216, !Gf(t3)) if (Cu()) e3.flags |= 8192;
      else throw xa = _a, ha;
    }
    function jc(e3, t3) {
      t3 !== null && (e3.flags |= 4), e3.flags & 16384 && (t3 = e3.tag === 22 ? 536870912 : Ye2(), e3.lanes |= t3, Jl |= t3);
    }
    function Mc(e3, t3) {
      if (!J) switch (e3.tailMode) {
        case `hidden`:
          t3 = e3.tail;
          for (var n3 = null; t3 !== null; ) t3.alternate !== null && (n3 = t3), t3 = t3.sibling;
          n3 === null ? e3.tail = null : n3.sibling = null;
          break;
        case `collapsed`:
          n3 = e3.tail;
          for (var r3 = null; n3 !== null; ) n3.alternate !== null && (r3 = n3), n3 = n3.sibling;
          r3 === null ? t3 || e3.tail === null ? e3.tail = null : e3.tail.sibling = null : r3.sibling = null;
      }
    }
    function Nc(e3) {
      var t3 = e3.alternate !== null && e3.alternate.child === e3.child, n3 = 0, r3 = 0;
      if (t3) for (var i3 = e3.child; i3 !== null; ) n3 |= i3.lanes | i3.childLanes, r3 |= i3.subtreeFlags & 65011712, r3 |= i3.flags & 65011712, i3.return = e3, i3 = i3.sibling;
      else for (i3 = e3.child; i3 !== null; ) n3 |= i3.lanes | i3.childLanes, r3 |= i3.subtreeFlags, r3 |= i3.flags, i3.return = e3, i3 = i3.sibling;
      return e3.subtreeFlags |= r3, e3.childLanes = n3, t3;
    }
    function Pc(e3, t3, n3) {
      var r3 = t3.pendingProps;
      switch (Ci(t3), t3.tag) {
        case 16:
        case 15:
        case 0:
        case 11:
        case 7:
        case 8:
        case 12:
        case 9:
        case 14:
          return Nc(t3), null;
        case 1:
          return Nc(t3), null;
        case 3:
          return n3 = t3.stateNode, r3 = null, e3 !== null && (r3 = e3.memoizedState.cache), t3.memoizedState.cache !== r3 && (t3.flags |= 2048), Vi($i), pe2(), n3.pendingContext && (n3.context = n3.pendingContext, n3.pendingContext = null), (e3 === null || e3.child === null) && (Ni(t3) ? Oc(t3) : e3 === null || e3.memoizedState.isDehydrated && !(t3.flags & 256) || (t3.flags |= 1024, Fi())), Nc(t3), null;
        case 26:
          var a3 = t3.type, o3 = t3.memoizedState;
          return e3 === null ? (Oc(t3), o3 === null ? (Nc(t3), kc(t3, a3, null, r3, n3)) : (Nc(t3), Ac(t3, o3))) : o3 ? o3 === e3.memoizedState ? (Nc(t3), t3.flags &= -16777217) : (Oc(t3), Nc(t3), Ac(t3, o3)) : (e3 = e3.memoizedProps, e3 !== r3 && Oc(t3), Nc(t3), kc(t3, a3, e3, r3, n3)), null;
        case 27:
          if (he2(t3), n3 = ue2.current, a3 = t3.type, e3 !== null && t3.stateNode != null) e3.memoizedProps !== r3 && Oc(t3);
          else {
            if (!r3) {
              if (t3.stateNode === null) throw Error(i2(166));
              return Nc(t3), null;
            }
            e3 = ce2.current, Ni(t3) ? ji(t3, e3) : (e3 = pf(a3, r3, n3), t3.stateNode = e3, Oc(t3));
          }
          return Nc(t3), null;
        case 5:
          if (he2(t3), a3 = t3.type, e3 !== null && t3.stateNode != null) e3.memoizedProps !== r3 && Oc(t3);
          else {
            if (!r3) {
              if (t3.stateNode === null) throw Error(i2(166));
              return Nc(t3), null;
            }
            if (o3 = ce2.current, Ni(t3)) ji(t3, o3);
            else {
              var s3 = Vd(ue2.current);
              switch (o3) {
                case 1:
                  o3 = s3.createElementNS(`http://www.w3.org/2000/svg`, a3);
                  break;
                case 2:
                  o3 = s3.createElementNS(`http://www.w3.org/1998/Math/MathML`, a3);
                  break;
                default:
                  switch (a3) {
                    case `svg`:
                      o3 = s3.createElementNS(`http://www.w3.org/2000/svg`, a3);
                      break;
                    case `math`:
                      o3 = s3.createElementNS(`http://www.w3.org/1998/Math/MathML`, a3);
                      break;
                    case `script`:
                      o3 = s3.createElement(`div`), o3.innerHTML = `<script><\/script>`, o3 = o3.removeChild(o3.firstChild);
                      break;
                    case `select`:
                      o3 = typeof r3.is == `string` ? s3.createElement(`select`, {
                        is: r3.is
                      }) : s3.createElement(`select`), r3.multiple ? o3.multiple = true : r3.size && (o3.size = r3.size);
                      break;
                    default:
                      o3 = typeof r3.is == `string` ? s3.createElement(a3, {
                        is: r3.is
                      }) : s3.createElement(a3);
                  }
              }
              o3[ot2] = t3, o3[st2] = r3;
              a: for (s3 = t3.child; s3 !== null; ) {
                if (s3.tag === 5 || s3.tag === 6) o3.appendChild(s3.stateNode);
                else if (s3.tag !== 4 && s3.tag !== 27 && s3.child !== null) {
                  s3.child.return = s3, s3 = s3.child;
                  continue;
                }
                if (s3 === t3) break a;
                for (; s3.sibling === null; ) {
                  if (s3.return === null || s3.return === t3) break a;
                  s3 = s3.return;
                }
                s3.sibling.return = s3.return, s3 = s3.sibling;
              }
              t3.stateNode = o3;
              a: switch (Fd(o3, a3, r3), a3) {
                case `button`:
                case `input`:
                case `select`:
                case `textarea`:
                  r3 = !!r3.autoFocus;
                  break a;
                case `img`:
                  r3 = true;
                  break a;
                default:
                  r3 = false;
              }
              r3 && Oc(t3);
            }
          }
          return Nc(t3), kc(t3, t3.type, e3 === null ? null : e3.memoizedProps, t3.pendingProps, n3), null;
        case 6:
          if (e3 && t3.stateNode != null) e3.memoizedProps !== r3 && Oc(t3);
          else {
            if (typeof r3 != `string` && t3.stateNode === null) throw Error(i2(166));
            if (e3 = ue2.current, Ni(t3)) {
              if (e3 = t3.stateNode, n3 = t3.memoizedProps, r3 = null, a3 = Ti, a3 !== null) switch (a3.tag) {
                case 27:
                case 5:
                  r3 = a3.memoizedProps;
              }
              e3[ot2] = t3, e3 = !!(e3.nodeValue === n3 || r3 !== null && true === r3.suppressHydrationWarning || Md(e3.nodeValue, n3)), e3 || Ai(t3, true);
            } else e3 = Vd(e3).createTextNode(r3), e3[ot2] = t3, t3.stateNode = e3;
          }
          return Nc(t3), null;
        case 31:
          if (n3 = t3.memoizedState, e3 === null || e3.memoizedState !== null) {
            if (r3 = Ni(t3), n3 !== null) {
              if (e3 === null) {
                if (!r3) throw Error(i2(318));
                if (e3 = t3.memoizedState, e3 = e3 === null ? null : e3.dehydrated, !e3) throw Error(i2(557));
                e3[ot2] = t3;
              } else Pi(), !(t3.flags & 128) && (t3.memoizedState = null), t3.flags |= 4;
              Nc(t3), e3 = false;
            } else n3 = Fi(), e3 !== null && e3.memoizedState !== null && (e3.memoizedState.hydrationErrors = n3), e3 = true;
            if (!e3) return t3.flags & 256 ? (to(t3), t3) : (to(t3), null);
            if (t3.flags & 128) throw Error(i2(558));
          }
          return Nc(t3), null;
        case 13:
          if (r3 = t3.memoizedState, e3 === null || e3.memoizedState !== null && e3.memoizedState.dehydrated !== null) {
            if (a3 = Ni(t3), r3 !== null && r3.dehydrated !== null) {
              if (e3 === null) {
                if (!a3) throw Error(i2(318));
                if (a3 = t3.memoizedState, a3 = a3 === null ? null : a3.dehydrated, !a3) throw Error(i2(317));
                a3[ot2] = t3;
              } else Pi(), !(t3.flags & 128) && (t3.memoizedState = null), t3.flags |= 4;
              Nc(t3), a3 = false;
            } else a3 = Fi(), e3 !== null && e3.memoizedState !== null && (e3.memoizedState.hydrationErrors = a3), a3 = true;
            if (!a3) return t3.flags & 256 ? (to(t3), t3) : (to(t3), null);
          }
          return to(t3), t3.flags & 128 ? (t3.lanes = n3, t3) : (n3 = r3 !== null, e3 = e3 !== null && e3.memoizedState !== null, n3 && (r3 = t3.child, a3 = null, r3.alternate !== null && r3.alternate.memoizedState !== null && r3.alternate.memoizedState.cachePool !== null && (a3 = r3.alternate.memoizedState.cachePool.pool), o3 = null, r3.memoizedState !== null && r3.memoizedState.cachePool !== null && (o3 = r3.memoizedState.cachePool.pool), o3 !== a3 && (r3.flags |= 2048)), n3 !== e3 && n3 && (t3.child.flags |= 8192), jc(t3, t3.updateQueue), Nc(t3), null);
        case 4:
          return pe2(), e3 === null && Sd(t3.stateNode.containerInfo), Nc(t3), null;
        case 10:
          return Vi(t3.type), Nc(t3), null;
        case 19:
          if (oe2(no), r3 = t3.memoizedState, r3 === null) return Nc(t3), null;
          if (a3 = (t3.flags & 128) != 0, o3 = r3.rendering, o3 === null) if (a3) Mc(r3, false);
          else {
            if (Ul !== 0 || e3 !== null && e3.flags & 128) for (e3 = t3.child; e3 !== null; ) {
              if (o3 = ro(e3), o3 !== null) {
                for (t3.flags |= 128, Mc(r3, false), e3 = o3.updateQueue, t3.updateQueue = e3, jc(t3, e3), t3.subtreeFlags = 0, e3 = n3, n3 = t3.child; n3 !== null; ) ri(n3, e3), n3 = n3.sibling;
                return se2(no, no.current & 1 | 2), J && bi(t3, r3.treeForkCount), t3.child;
              }
              e3 = e3.sibling;
            }
            r3.tail !== null && Oe2() > eu && (t3.flags |= 128, a3 = true, Mc(r3, false), t3.lanes = 4194304);
          }
          else {
            if (!a3) if (e3 = ro(o3), e3 !== null) {
              if (t3.flags |= 128, a3 = true, e3 = e3.updateQueue, t3.updateQueue = e3, jc(t3, e3), Mc(r3, true), r3.tail === null && r3.tailMode === `hidden` && !o3.alternate && !J) return Nc(t3), null;
            } else 2 * Oe2() - r3.renderingStartTime > eu && n3 !== 536870912 && (t3.flags |= 128, a3 = true, Mc(r3, false), t3.lanes = 4194304);
            r3.isBackwards ? (o3.sibling = t3.child, t3.child = o3) : (e3 = r3.last, e3 === null ? t3.child = o3 : e3.sibling = o3, r3.last = o3);
          }
          return r3.tail === null ? (Nc(t3), null) : (e3 = r3.tail, r3.rendering = e3, r3.tail = e3.sibling, r3.renderingStartTime = Oe2(), e3.sibling = null, n3 = no.current, se2(no, a3 ? n3 & 1 | 2 : n3 & 1), J && bi(t3, r3.treeForkCount), e3);
        case 22:
        case 23:
          return to(t3), Ja(), r3 = t3.memoizedState !== null, e3 === null ? r3 && (t3.flags |= 8192) : e3.memoizedState !== null !== r3 && (t3.flags |= 8192), r3 ? n3 & 536870912 && !(t3.flags & 128) && (Nc(t3), t3.subtreeFlags & 6 && (t3.flags |= 8192)) : Nc(t3), n3 = t3.updateQueue, n3 !== null && jc(t3, n3.retryQueue), n3 = null, e3 !== null && e3.memoizedState !== null && e3.memoizedState.cachePool !== null && (n3 = e3.memoizedState.cachePool.pool), r3 = null, t3.memoizedState !== null && t3.memoizedState.cachePool !== null && (r3 = t3.memoizedState.cachePool.pool), r3 !== n3 && (t3.flags |= 2048), e3 !== null && oe2(ua), null;
        case 24:
          return n3 = null, e3 !== null && (n3 = e3.memoizedState.cache), t3.memoizedState.cache !== n3 && (t3.flags |= 2048), Vi($i), Nc(t3), null;
        case 25:
          return null;
        case 30:
          return null;
      }
      throw Error(i2(156, t3.tag));
    }
    function Fc(e3, t3) {
      switch (Ci(t3), t3.tag) {
        case 1:
          return e3 = t3.flags, e3 & 65536 ? (t3.flags = e3 & -65537 | 128, t3) : null;
        case 3:
          return Vi($i), pe2(), e3 = t3.flags, e3 & 65536 && !(e3 & 128) ? (t3.flags = e3 & -65537 | 128, t3) : null;
        case 26:
        case 27:
        case 5:
          return he2(t3), null;
        case 31:
          if (t3.memoizedState !== null) {
            if (to(t3), t3.alternate === null) throw Error(i2(340));
            Pi();
          }
          return e3 = t3.flags, e3 & 65536 ? (t3.flags = e3 & -65537 | 128, t3) : null;
        case 13:
          if (to(t3), e3 = t3.memoizedState, e3 !== null && e3.dehydrated !== null) {
            if (t3.alternate === null) throw Error(i2(340));
            Pi();
          }
          return e3 = t3.flags, e3 & 65536 ? (t3.flags = e3 & -65537 | 128, t3) : null;
        case 19:
          return oe2(no), null;
        case 4:
          return pe2(), null;
        case 10:
          return Vi(t3.type), null;
        case 22:
        case 23:
          return to(t3), Ja(), e3 !== null && oe2(ua), e3 = t3.flags, e3 & 65536 ? (t3.flags = e3 & -65537 | 128, t3) : null;
        case 24:
          return Vi($i), null;
        case 25:
          return null;
        default:
          return null;
      }
    }
    function Ic(e3, t3) {
      switch (Ci(t3), t3.tag) {
        case 3:
          Vi($i), pe2();
          break;
        case 26:
        case 27:
        case 5:
          he2(t3);
          break;
        case 4:
          pe2();
          break;
        case 31:
          t3.memoizedState !== null && to(t3);
          break;
        case 13:
          to(t3);
          break;
        case 19:
          oe2(no);
          break;
        case 10:
          Vi(t3.type);
          break;
        case 22:
        case 23:
          to(t3), Ja(), e3 !== null && oe2(ua);
          break;
        case 24:
          Vi($i);
      }
    }
    function Lc(e3, t3) {
      try {
        var n3 = t3.updateQueue, r3 = n3 === null ? null : n3.lastEffect;
        if (r3 !== null) {
          var i3 = r3.next;
          n3 = i3;
          do {
            if ((n3.tag & e3) === e3) {
              r3 = void 0;
              var a3 = n3.create, o3 = n3.inst;
              r3 = a3(), o3.destroy = r3;
            }
            n3 = n3.next;
          } while (n3 !== i3);
        }
      } catch (e4) {
        Wu(t3, t3.return, e4);
      }
    }
    function Rc(e3, t3, n3) {
      try {
        var r3 = t3.updateQueue, i3 = r3 === null ? null : r3.lastEffect;
        if (i3 !== null) {
          var a3 = i3.next;
          r3 = a3;
          do {
            if ((r3.tag & e3) === e3) {
              var o3 = r3.inst, s3 = o3.destroy;
              if (s3 !== void 0) {
                o3.destroy = void 0, i3 = t3;
                var c3 = n3, l3 = s3;
                try {
                  l3();
                } catch (e4) {
                  Wu(i3, c3, e4);
                }
              }
            }
            r3 = r3.next;
          } while (r3 !== a3);
        }
      } catch (e4) {
        Wu(t3, t3.return, e4);
      }
    }
    function zc(e3) {
      var t3 = e3.updateQueue;
      if (t3 !== null) {
        var n3 = e3.stateNode;
        try {
          Ua(t3, n3);
        } catch (t4) {
          Wu(e3, e3.return, t4);
        }
      }
    }
    function Bc(e3, t3, n3) {
      n3.props = Vs(e3.type, e3.memoizedProps), n3.state = e3.memoizedState;
      try {
        n3.componentWillUnmount();
      } catch (n4) {
        Wu(e3, t3, n4);
      }
    }
    function Vc(e3, t3) {
      try {
        var n3 = e3.ref;
        if (n3 !== null) {
          switch (e3.tag) {
            case 26:
            case 27:
            case 5:
              var r3 = e3.stateNode;
              break;
            case 30:
              r3 = e3.stateNode;
              break;
            default:
              r3 = e3.stateNode;
          }
          typeof n3 == `function` ? e3.refCleanup = n3(r3) : n3.current = r3;
        }
      } catch (n4) {
        Wu(e3, t3, n4);
      }
    }
    function Hc(e3, t3) {
      var n3 = e3.ref, r3 = e3.refCleanup;
      if (n3 !== null) if (typeof r3 == `function`) try {
        r3();
      } catch (n4) {
        Wu(e3, t3, n4);
      } finally {
        e3.refCleanup = null, e3 = e3.alternate, e3 != null && (e3.refCleanup = null);
      }
      else if (typeof n3 == `function`) try {
        n3(null);
      } catch (n4) {
        Wu(e3, t3, n4);
      }
      else n3.current = null;
    }
    function Uc(e3) {
      var t3 = e3.type, n3 = e3.memoizedProps, r3 = e3.stateNode;
      try {
        a: switch (t3) {
          case `button`:
          case `input`:
          case `select`:
          case `textarea`:
            n3.autoFocus && r3.focus();
            break a;
          case `img`:
            n3.src ? r3.src = n3.src : n3.srcSet && (r3.srcset = n3.srcSet);
        }
      } catch (t4) {
        Wu(e3, e3.return, t4);
      }
    }
    function Wc(e3, t3, n3) {
      try {
        var r3 = e3.stateNode;
        Id(r3, e3.type, n3, t3), r3[st2] = t3;
      } catch (t4) {
        Wu(e3, e3.return, t4);
      }
    }
    function Gc(e3) {
      return e3.tag === 5 || e3.tag === 3 || e3.tag === 26 || e3.tag === 27 && Qd(e3.type) || e3.tag === 4;
    }
    function Kc(e3) {
      a: for (; ; ) {
        for (; e3.sibling === null; ) {
          if (e3.return === null || Gc(e3.return)) return null;
          e3 = e3.return;
        }
        for (e3.sibling.return = e3.return, e3 = e3.sibling; e3.tag !== 5 && e3.tag !== 6 && e3.tag !== 18; ) {
          if (e3.tag === 27 && Qd(e3.type) || e3.flags & 2 || e3.child === null || e3.tag === 4) continue a;
          e3.child.return = e3, e3 = e3.child;
        }
        if (!(e3.flags & 2)) return e3.stateNode;
      }
    }
    function qc(e3, t3, n3) {
      var r3 = e3.tag;
      if (r3 === 5 || r3 === 6) e3 = e3.stateNode, t3 ? (n3.nodeType === 9 ? n3.body : n3.nodeName === `HTML` ? n3.ownerDocument.body : n3).insertBefore(e3, t3) : (t3 = n3.nodeType === 9 ? n3.body : n3.nodeName === `HTML` ? n3.ownerDocument.body : n3, t3.appendChild(e3), n3 = n3._reactRootContainer, n3 != null || t3.onclick !== null || (t3.onclick = K2));
      else if (r3 !== 4 && (r3 === 27 && Qd(e3.type) && (n3 = e3.stateNode, t3 = null), e3 = e3.child, e3 !== null)) for (qc(e3, t3, n3), e3 = e3.sibling; e3 !== null; ) qc(e3, t3, n3), e3 = e3.sibling;
    }
    function Jc(e3, t3, n3) {
      var r3 = e3.tag;
      if (r3 === 5 || r3 === 6) e3 = e3.stateNode, t3 ? n3.insertBefore(e3, t3) : n3.appendChild(e3);
      else if (r3 !== 4 && (r3 === 27 && Qd(e3.type) && (n3 = e3.stateNode), e3 = e3.child, e3 !== null)) for (Jc(e3, t3, n3), e3 = e3.sibling; e3 !== null; ) Jc(e3, t3, n3), e3 = e3.sibling;
    }
    function Yc(e3) {
      var t3 = e3.stateNode, n3 = e3.memoizedProps;
      try {
        for (var r3 = e3.type, i3 = t3.attributes; i3.length; ) t3.removeAttributeNode(i3[0]);
        Fd(t3, r3, n3), t3[ot2] = e3, t3[st2] = n3;
      } catch (t4) {
        Wu(e3, e3.return, t4);
      }
    }
    var Xc = false, Zc = false, Qc = false, $c = typeof WeakSet == `function` ? WeakSet : Set, el = null;
    function tl(e3, t3) {
      if (e3 = e3.containerInfo, zd = cp, e3 = yr(e3), br(e3)) {
        if (`selectionStart` in e3) var n3 = {
          start: e3.selectionStart,
          end: e3.selectionEnd
        };
        else a: {
          n3 = (n3 = e3.ownerDocument) && n3.defaultView || window;
          var r3 = n3.getSelection && n3.getSelection();
          if (r3 && r3.rangeCount !== 0) {
            n3 = r3.anchorNode;
            var a3 = r3.anchorOffset, o3 = r3.focusNode;
            r3 = r3.focusOffset;
            try {
              n3.nodeType, o3.nodeType;
            } catch {
              n3 = null;
              break a;
            }
            var s3 = 0, c3 = -1, l3 = -1, u2 = 0, d3 = 0, f2 = e3, p3 = null;
            b: for (; ; ) {
              for (var m2; f2 !== n3 || a3 !== 0 && f2.nodeType !== 3 || (c3 = s3 + a3), f2 !== o3 || r3 !== 0 && f2.nodeType !== 3 || (l3 = s3 + r3), f2.nodeType === 3 && (s3 += f2.nodeValue.length), (m2 = f2.firstChild) !== null; ) p3 = f2, f2 = m2;
              for (; ; ) {
                if (f2 === e3) break b;
                if (p3 === n3 && ++u2 === a3 && (c3 = s3), p3 === o3 && ++d3 === r3 && (l3 = s3), (m2 = f2.nextSibling) !== null) break;
                f2 = p3, p3 = f2.parentNode;
              }
              f2 = m2;
            }
            n3 = c3 === -1 || l3 === -1 ? null : {
              start: c3,
              end: l3
            };
          } else n3 = null;
        }
        n3 ||= {
          start: 0,
          end: 0
        };
      } else n3 = null;
      for (Bd = {
        focusedElem: e3,
        selectionRange: n3
      }, cp = false, el = t3; el !== null; ) if (t3 = el, e3 = t3.child, t3.subtreeFlags & 1028 && e3 !== null) e3.return = t3, el = e3;
      else for (; el !== null; ) {
        switch (t3 = el, o3 = t3.alternate, e3 = t3.flags, t3.tag) {
          case 0:
            if (e3 & 4 && (e3 = t3.updateQueue, e3 = e3 === null ? null : e3.events, e3 !== null)) for (n3 = 0; n3 < e3.length; n3++) a3 = e3[n3], a3.ref.impl = a3.nextImpl;
            break;
          case 11:
          case 15:
            break;
          case 1:
            if (e3 & 1024 && o3 !== null) {
              e3 = void 0, n3 = t3, a3 = o3.memoizedProps, o3 = o3.memoizedState, r3 = n3.stateNode;
              try {
                var h3 = Vs(n3.type, a3);
                e3 = r3.getSnapshotBeforeUpdate(h3, o3), r3.__reactInternalSnapshotBeforeUpdate = e3;
              } catch (e4) {
                Wu(n3, n3.return, e4);
              }
            }
            break;
          case 3:
            if (e3 & 1024) {
              if (e3 = t3.stateNode.containerInfo, n3 = e3.nodeType, n3 === 9) tf(e3);
              else if (n3 === 1) switch (e3.nodeName) {
                case `HEAD`:
                case `HTML`:
                case `BODY`:
                  tf(e3);
                  break;
                default:
                  e3.textContent = ``;
              }
            }
            break;
          case 5:
          case 26:
          case 27:
          case 6:
          case 4:
          case 17:
            break;
          default:
            if (e3 & 1024) throw Error(i2(163));
        }
        if (e3 = t3.sibling, e3 !== null) {
          e3.return = t3.return, el = e3;
          break;
        }
        el = t3.return;
      }
    }
    function nl(e3, t3, n3) {
      var r3 = n3.flags;
      switch (n3.tag) {
        case 0:
        case 11:
        case 15:
          _l(e3, n3), r3 & 4 && Lc(5, n3);
          break;
        case 1:
          if (_l(e3, n3), r3 & 4) if (e3 = n3.stateNode, t3 === null) try {
            e3.componentDidMount();
          } catch (e4) {
            Wu(n3, n3.return, e4);
          }
          else {
            var i3 = Vs(n3.type, t3.memoizedProps);
            t3 = t3.memoizedState;
            try {
              e3.componentDidUpdate(i3, t3, e3.__reactInternalSnapshotBeforeUpdate);
            } catch (e4) {
              Wu(n3, n3.return, e4);
            }
          }
          r3 & 64 && zc(n3), r3 & 512 && Vc(n3, n3.return);
          break;
        case 3:
          if (_l(e3, n3), r3 & 64 && (e3 = n3.updateQueue, e3 !== null)) {
            if (t3 = null, n3.child !== null) switch (n3.child.tag) {
              case 27:
              case 5:
                t3 = n3.child.stateNode;
                break;
              case 1:
                t3 = n3.child.stateNode;
            }
            try {
              Ua(e3, t3);
            } catch (e4) {
              Wu(n3, n3.return, e4);
            }
          }
          break;
        case 27:
          t3 === null && r3 & 4 && Yc(n3);
        case 26:
        case 5:
          _l(e3, n3), t3 === null && r3 & 4 && Uc(n3), r3 & 512 && Vc(n3, n3.return);
          break;
        case 12:
          _l(e3, n3);
          break;
        case 31:
          _l(e3, n3), r3 & 4 && cl(e3, n3);
          break;
        case 13:
          _l(e3, n3), r3 & 4 && ll(e3, n3), r3 & 64 && (e3 = n3.memoizedState, e3 !== null && (e3 = e3.dehydrated, e3 !== null && (n3 = Ju.bind(null, n3), cf(e3, n3))));
          break;
        case 22:
          if (r3 = n3.memoizedState !== null || Xc, !r3) {
            t3 = t3 !== null && t3.memoizedState !== null || Zc, i3 = Xc;
            var a3 = Zc;
            Xc = r3, (Zc = t3) && !a3 ? yl(e3, n3, (n3.subtreeFlags & 8772) != 0) : _l(e3, n3), Xc = i3, Zc = a3;
          }
          break;
        case 30:
          break;
        default:
          _l(e3, n3);
      }
    }
    function rl(e3) {
      var t3 = e3.alternate;
      t3 !== null && (e3.alternate = null, rl(t3)), e3.child = null, e3.deletions = null, e3.sibling = null, e3.tag === 5 && (t3 = e3.stateNode, t3 !== null && mt2(t3)), e3.stateNode = null, e3.return = null, e3.dependencies = null, e3.memoizedProps = null, e3.memoizedState = null, e3.pendingProps = null, e3.stateNode = null, e3.updateQueue = null;
    }
    var il = null, al = false;
    function ol(e3, t3, n3) {
      for (n3 = n3.child; n3 !== null; ) sl(e3, t3, n3), n3 = n3.sibling;
    }
    function sl(e3, t3, n3) {
      if (Le2 && typeof Le2.onCommitFiberUnmount == `function`) try {
        Le2.onCommitFiberUnmount(I2, n3);
      } catch {
      }
      switch (n3.tag) {
        case 26:
          Zc || Hc(n3, t3), ol(e3, t3, n3), n3.memoizedState ? n3.memoizedState.count-- : n3.stateNode && (n3 = n3.stateNode, n3.parentNode.removeChild(n3));
          break;
        case 27:
          Zc || Hc(n3, t3);
          var r3 = il, i3 = al;
          Qd(n3.type) && (il = n3.stateNode, al = false), ol(e3, t3, n3), mf(n3.stateNode), il = r3, al = i3;
          break;
        case 5:
          Zc || Hc(n3, t3);
        case 6:
          if (r3 = il, i3 = al, il = null, ol(e3, t3, n3), il = r3, al = i3, il !== null) if (al) try {
            (il.nodeType === 9 ? il.body : il.nodeName === `HTML` ? il.ownerDocument.body : il).removeChild(n3.stateNode);
          } catch (e4) {
            Wu(n3, t3, e4);
          }
          else try {
            il.removeChild(n3.stateNode);
          } catch (e4) {
            Wu(n3, t3, e4);
          }
          break;
        case 18:
          il !== null && (al ? (e3 = il, $d(e3.nodeType === 9 ? e3.body : e3.nodeName === `HTML` ? e3.ownerDocument.body : e3, n3.stateNode), Pp(e3)) : $d(il, n3.stateNode));
          break;
        case 4:
          r3 = il, i3 = al, il = n3.stateNode.containerInfo, al = true, ol(e3, t3, n3), il = r3, al = i3;
          break;
        case 0:
        case 11:
        case 14:
        case 15:
          Rc(2, n3, t3), Zc || Rc(4, n3, t3), ol(e3, t3, n3);
          break;
        case 1:
          Zc || (Hc(n3, t3), r3 = n3.stateNode, typeof r3.componentWillUnmount == `function` && Bc(n3, t3, r3)), ol(e3, t3, n3);
          break;
        case 21:
          ol(e3, t3, n3);
          break;
        case 22:
          Zc = (r3 = Zc) || n3.memoizedState !== null, ol(e3, t3, n3), Zc = r3;
          break;
        default:
          ol(e3, t3, n3);
      }
    }
    function cl(e3, t3) {
      if (t3.memoizedState === null && (e3 = t3.alternate, e3 !== null && (e3 = e3.memoizedState, e3 !== null))) {
        e3 = e3.dehydrated;
        try {
          Pp(e3);
        } catch (e4) {
          Wu(t3, t3.return, e4);
        }
      }
    }
    function ll(e3, t3) {
      if (t3.memoizedState === null && (e3 = t3.alternate, e3 !== null && (e3 = e3.memoizedState, e3 !== null && (e3 = e3.dehydrated, e3 !== null)))) try {
        Pp(e3);
      } catch (e4) {
        Wu(t3, t3.return, e4);
      }
    }
    function ul(e3) {
      switch (e3.tag) {
        case 31:
        case 13:
        case 19:
          var t3 = e3.stateNode;
          return t3 === null && (t3 = e3.stateNode = new $c()), t3;
        case 22:
          return e3 = e3.stateNode, t3 = e3._retryCache, t3 === null && (t3 = e3._retryCache = new $c()), t3;
        default:
          throw Error(i2(435, e3.tag));
      }
    }
    function dl(e3, t3) {
      var n3 = ul(e3);
      t3.forEach(function(t4) {
        if (!n3.has(t4)) {
          n3.add(t4);
          var r3 = Yu.bind(null, e3, t4);
          t4.then(r3, r3);
        }
      });
    }
    function fl(e3, t3) {
      var n3 = t3.deletions;
      if (n3 !== null) for (var r3 = 0; r3 < n3.length; r3++) {
        var a3 = n3[r3], o3 = e3, s3 = t3, c3 = s3;
        a: for (; c3 !== null; ) {
          switch (c3.tag) {
            case 27:
              if (Qd(c3.type)) {
                il = c3.stateNode, al = false;
                break a;
              }
              break;
            case 5:
              il = c3.stateNode, al = false;
              break a;
            case 3:
            case 4:
              il = c3.stateNode.containerInfo, al = true;
              break a;
          }
          c3 = c3.return;
        }
        if (il === null) throw Error(i2(160));
        sl(o3, s3, a3), il = null, al = false, o3 = a3.alternate, o3 !== null && (o3.return = null), a3.return = null;
      }
      if (t3.subtreeFlags & 13886) for (t3 = t3.child; t3 !== null; ) ml(t3, e3), t3 = t3.sibling;
    }
    var pl = null;
    function ml(e3, t3) {
      var n3 = e3.alternate, r3 = e3.flags;
      switch (e3.tag) {
        case 0:
        case 11:
        case 14:
        case 15:
          fl(t3, e3), hl(e3), r3 & 4 && (Rc(3, e3, e3.return), Lc(3, e3), Rc(5, e3, e3.return));
          break;
        case 1:
          fl(t3, e3), hl(e3), r3 & 512 && (Zc || n3 === null || Hc(n3, n3.return)), r3 & 64 && Xc && (e3 = e3.updateQueue, e3 !== null && (r3 = e3.callbacks, r3 !== null && (n3 = e3.shared.hiddenCallbacks, e3.shared.hiddenCallbacks = n3 === null ? r3 : n3.concat(r3))));
          break;
        case 26:
          var a3 = pl;
          if (fl(t3, e3), hl(e3), r3 & 512 && (Zc || n3 === null || Hc(n3, n3.return)), r3 & 4) {
            var o3 = n3 === null ? null : n3.memoizedState;
            if (r3 = e3.memoizedState, n3 === null) if (r3 === null) if (e3.stateNode === null) {
              a: {
                r3 = e3.type, n3 = e3.memoizedProps, a3 = a3.ownerDocument || a3;
                b: switch (r3) {
                  case `title`:
                    o3 = a3.getElementsByTagName(`title`)[0], (!o3 || o3[pt2] || o3[ot2] || o3.namespaceURI === `http://www.w3.org/2000/svg` || o3.hasAttribute(`itemprop`)) && (o3 = a3.createElement(r3), a3.head.insertBefore(o3, a3.querySelector(`head > title`))), Fd(o3, r3, n3), o3[ot2] = e3, B2(o3), r3 = o3;
                    break a;
                  case `link`:
                    var s3 = Hf(`link`, `href`, a3).get(r3 + (n3.href || ``));
                    if (s3) {
                      for (var c3 = 0; c3 < s3.length; c3++) if (o3 = s3[c3], o3.getAttribute(`href`) === (n3.href == null || n3.href === `` ? null : n3.href) && o3.getAttribute(`rel`) === (n3.rel == null ? null : n3.rel) && o3.getAttribute(`title`) === (n3.title == null ? null : n3.title) && o3.getAttribute(`crossorigin`) === (n3.crossOrigin == null ? null : n3.crossOrigin)) {
                        s3.splice(c3, 1);
                        break b;
                      }
                    }
                    o3 = a3.createElement(r3), Fd(o3, r3, n3), a3.head.appendChild(o3);
                    break;
                  case `meta`:
                    if (s3 = Hf(`meta`, `content`, a3).get(r3 + (n3.content || ``))) {
                      for (c3 = 0; c3 < s3.length; c3++) if (o3 = s3[c3], o3.getAttribute(`content`) === (n3.content == null ? null : `` + n3.content) && o3.getAttribute(`name`) === (n3.name == null ? null : n3.name) && o3.getAttribute(`property`) === (n3.property == null ? null : n3.property) && o3.getAttribute(`http-equiv`) === (n3.httpEquiv == null ? null : n3.httpEquiv) && o3.getAttribute(`charset`) === (n3.charSet == null ? null : n3.charSet)) {
                        s3.splice(c3, 1);
                        break b;
                      }
                    }
                    o3 = a3.createElement(r3), Fd(o3, r3, n3), a3.head.appendChild(o3);
                    break;
                  default:
                    throw Error(i2(468, r3));
                }
                o3[ot2] = e3, B2(o3), r3 = o3;
              }
              e3.stateNode = r3;
            } else Uf(a3, e3.type, e3.stateNode);
            else e3.stateNode = Lf(a3, r3, e3.memoizedProps);
            else o3 === r3 ? r3 === null && e3.stateNode !== null && Wc(e3, e3.memoizedProps, n3.memoizedProps) : (o3 === null ? n3.stateNode !== null && (n3 = n3.stateNode, n3.parentNode.removeChild(n3)) : o3.count--, r3 === null ? Uf(a3, e3.type, e3.stateNode) : Lf(a3, r3, e3.memoizedProps));
          }
          break;
        case 27:
          fl(t3, e3), hl(e3), r3 & 512 && (Zc || n3 === null || Hc(n3, n3.return)), n3 !== null && r3 & 4 && Wc(e3, e3.memoizedProps, n3.memoizedProps);
          break;
        case 5:
          if (fl(t3, e3), hl(e3), r3 & 512 && (Zc || n3 === null || Hc(n3, n3.return)), e3.flags & 32) {
            a3 = e3.stateNode;
            try {
              Bt2(a3, ``);
            } catch (t4) {
              Wu(e3, e3.return, t4);
            }
          }
          r3 & 4 && e3.stateNode != null && (a3 = e3.memoizedProps, Wc(e3, a3, n3 === null ? a3 : n3.memoizedProps)), r3 & 1024 && (Qc = true);
          break;
        case 6:
          if (fl(t3, e3), hl(e3), r3 & 4) {
            if (e3.stateNode === null) throw Error(i2(162));
            r3 = e3.memoizedProps, n3 = e3.stateNode;
            try {
              n3.nodeValue = r3;
            } catch (t4) {
              Wu(e3, e3.return, t4);
            }
          }
          break;
        case 3:
          if (Vf = null, a3 = pl, pl = _f(t3.containerInfo), fl(t3, e3), pl = a3, hl(e3), r3 & 4 && n3 !== null && n3.memoizedState.isDehydrated) try {
            Pp(t3.containerInfo);
          } catch (t4) {
            Wu(e3, e3.return, t4);
          }
          Qc && (Qc = false, gl(e3));
          break;
        case 4:
          r3 = pl, pl = _f(e3.stateNode.containerInfo), fl(t3, e3), hl(e3), pl = r3;
          break;
        case 12:
          fl(t3, e3), hl(e3);
          break;
        case 31:
          fl(t3, e3), hl(e3), r3 & 4 && (r3 = e3.updateQueue, r3 !== null && (e3.updateQueue = null, dl(e3, r3)));
          break;
        case 13:
          fl(t3, e3), hl(e3), e3.child.flags & 8192 && e3.memoizedState !== null != (n3 !== null && n3.memoizedState !== null) && (Ql = Oe2()), r3 & 4 && (r3 = e3.updateQueue, r3 !== null && (e3.updateQueue = null, dl(e3, r3)));
          break;
        case 22:
          a3 = e3.memoizedState !== null;
          var l3 = n3 !== null && n3.memoizedState !== null, u2 = Xc, d3 = Zc;
          if (Xc = u2 || a3, Zc = d3 || l3, fl(t3, e3), Zc = d3, Xc = u2, hl(e3), r3 & 8192) a: for (t3 = e3.stateNode, t3._visibility = a3 ? t3._visibility & -2 : t3._visibility | 1, a3 && (n3 === null || l3 || Xc || Zc || vl(e3)), n3 = null, t3 = e3; ; ) {
            if (t3.tag === 5 || t3.tag === 26) {
              if (n3 === null) {
                l3 = n3 = t3;
                try {
                  if (o3 = l3.stateNode, a3) s3 = o3.style, typeof s3.setProperty == `function` ? s3.setProperty(`display`, `none`, `important`) : s3.display = `none`;
                  else {
                    c3 = l3.stateNode;
                    var f2 = l3.memoizedProps.style, p3 = f2 != null && f2.hasOwnProperty(`display`) ? f2.display : null;
                    c3.style.display = p3 == null || typeof p3 == `boolean` ? `` : (`` + p3).trim();
                  }
                } catch (e4) {
                  Wu(l3, l3.return, e4);
                }
              }
            } else if (t3.tag === 6) {
              if (n3 === null) {
                l3 = t3;
                try {
                  l3.stateNode.nodeValue = a3 ? `` : l3.memoizedProps;
                } catch (e4) {
                  Wu(l3, l3.return, e4);
                }
              }
            } else if (t3.tag === 18) {
              if (n3 === null) {
                l3 = t3;
                try {
                  var m2 = l3.stateNode;
                  a3 ? ef(m2, true) : ef(l3.stateNode, false);
                } catch (e4) {
                  Wu(l3, l3.return, e4);
                }
              }
            } else if ((t3.tag !== 22 && t3.tag !== 23 || t3.memoizedState === null || t3 === e3) && t3.child !== null) {
              t3.child.return = t3, t3 = t3.child;
              continue;
            }
            if (t3 === e3) break a;
            for (; t3.sibling === null; ) {
              if (t3.return === null || t3.return === e3) break a;
              n3 === t3 && (n3 = null), t3 = t3.return;
            }
            n3 === t3 && (n3 = null), t3.sibling.return = t3.return, t3 = t3.sibling;
          }
          r3 & 4 && (r3 = e3.updateQueue, r3 !== null && (n3 = r3.retryQueue, n3 !== null && (r3.retryQueue = null, dl(e3, n3))));
          break;
        case 19:
          fl(t3, e3), hl(e3), r3 & 4 && (r3 = e3.updateQueue, r3 !== null && (e3.updateQueue = null, dl(e3, r3)));
          break;
        case 30:
          break;
        case 21:
          break;
        default:
          fl(t3, e3), hl(e3);
      }
    }
    function hl(e3) {
      var t3 = e3.flags;
      if (t3 & 2) {
        try {
          for (var n3, r3 = e3.return; r3 !== null; ) {
            if (Gc(r3)) {
              n3 = r3;
              break;
            }
            r3 = r3.return;
          }
          if (n3 == null) throw Error(i2(160));
          switch (n3.tag) {
            case 27:
              var a3 = n3.stateNode;
              Jc(e3, Kc(e3), a3);
              break;
            case 5:
              var o3 = n3.stateNode;
              n3.flags & 32 && (Bt2(o3, ``), n3.flags &= -33), Jc(e3, Kc(e3), o3);
              break;
            case 3:
            case 4:
              var s3 = n3.stateNode.containerInfo;
              qc(e3, Kc(e3), s3);
              break;
            default:
              throw Error(i2(161));
          }
        } catch (t4) {
          Wu(e3, e3.return, t4);
        }
        e3.flags &= -3;
      }
      t3 & 4096 && (e3.flags &= -4097);
    }
    function gl(e3) {
      if (e3.subtreeFlags & 1024) for (e3 = e3.child; e3 !== null; ) {
        var t3 = e3;
        gl(t3), t3.tag === 5 && t3.flags & 1024 && t3.stateNode.reset(), e3 = e3.sibling;
      }
    }
    function _l(e3, t3) {
      if (t3.subtreeFlags & 8772) for (t3 = t3.child; t3 !== null; ) nl(e3, t3.alternate, t3), t3 = t3.sibling;
    }
    function vl(e3) {
      for (e3 = e3.child; e3 !== null; ) {
        var t3 = e3;
        switch (t3.tag) {
          case 0:
          case 11:
          case 14:
          case 15:
            Rc(4, t3, t3.return), vl(t3);
            break;
          case 1:
            Hc(t3, t3.return);
            var n3 = t3.stateNode;
            typeof n3.componentWillUnmount == `function` && Bc(t3, t3.return, n3), vl(t3);
            break;
          case 27:
            mf(t3.stateNode);
          case 26:
          case 5:
            Hc(t3, t3.return), vl(t3);
            break;
          case 22:
            t3.memoizedState === null && vl(t3);
            break;
          case 30:
            vl(t3);
            break;
          default:
            vl(t3);
        }
        e3 = e3.sibling;
      }
    }
    function yl(e3, t3, n3) {
      for (n3 &&= (t3.subtreeFlags & 8772) != 0, t3 = t3.child; t3 !== null; ) {
        var r3 = t3.alternate, i3 = e3, a3 = t3, o3 = a3.flags;
        switch (a3.tag) {
          case 0:
          case 11:
          case 15:
            yl(i3, a3, n3), Lc(4, a3);
            break;
          case 1:
            if (yl(i3, a3, n3), r3 = a3, i3 = r3.stateNode, typeof i3.componentDidMount == `function`) try {
              i3.componentDidMount();
            } catch (e4) {
              Wu(r3, r3.return, e4);
            }
            if (r3 = a3, i3 = r3.updateQueue, i3 !== null) {
              var s3 = r3.stateNode;
              try {
                var c3 = i3.shared.hiddenCallbacks;
                if (c3 !== null) for (i3.shared.hiddenCallbacks = null, i3 = 0; i3 < c3.length; i3++) Ha(c3[i3], s3);
              } catch (e4) {
                Wu(r3, r3.return, e4);
              }
            }
            n3 && o3 & 64 && zc(a3), Vc(a3, a3.return);
            break;
          case 27:
            Yc(a3);
          case 26:
          case 5:
            yl(i3, a3, n3), n3 && r3 === null && o3 & 4 && Uc(a3), Vc(a3, a3.return);
            break;
          case 12:
            yl(i3, a3, n3);
            break;
          case 31:
            yl(i3, a3, n3), n3 && o3 & 4 && cl(i3, a3);
            break;
          case 13:
            yl(i3, a3, n3), n3 && o3 & 4 && ll(i3, a3);
            break;
          case 22:
            a3.memoizedState === null && yl(i3, a3, n3), Vc(a3, a3.return);
            break;
          case 30:
            break;
          default:
            yl(i3, a3, n3);
        }
        t3 = t3.sibling;
      }
    }
    function bl(e3, t3) {
      var n3 = null;
      e3 !== null && e3.memoizedState !== null && e3.memoizedState.cachePool !== null && (n3 = e3.memoizedState.cachePool.pool), e3 = null, t3.memoizedState !== null && t3.memoizedState.cachePool !== null && (e3 = t3.memoizedState.cachePool.pool), e3 !== n3 && (e3 != null && e3.refCount++, n3 != null && ta(n3));
    }
    function xl(e3, t3) {
      e3 = null, t3.alternate !== null && (e3 = t3.alternate.memoizedState.cache), t3 = t3.memoizedState.cache, t3 !== e3 && (t3.refCount++, e3 != null && ta(e3));
    }
    function Sl(e3, t3, n3, r3) {
      if (t3.subtreeFlags & 10256) for (t3 = t3.child; t3 !== null; ) Cl(e3, t3, n3, r3), t3 = t3.sibling;
    }
    function Cl(e3, t3, n3, r3) {
      var i3 = t3.flags;
      switch (t3.tag) {
        case 0:
        case 11:
        case 15:
          Sl(e3, t3, n3, r3), i3 & 2048 && Lc(9, t3);
          break;
        case 1:
          Sl(e3, t3, n3, r3);
          break;
        case 3:
          Sl(e3, t3, n3, r3), i3 & 2048 && (e3 = null, t3.alternate !== null && (e3 = t3.alternate.memoizedState.cache), t3 = t3.memoizedState.cache, t3 !== e3 && (t3.refCount++, e3 != null && ta(e3)));
          break;
        case 12:
          if (i3 & 2048) {
            Sl(e3, t3, n3, r3), e3 = t3.stateNode;
            try {
              var a3 = t3.memoizedProps, o3 = a3.id, s3 = a3.onPostCommit;
              typeof s3 == `function` && s3(o3, t3.alternate === null ? `mount` : `update`, e3.passiveEffectDuration, -0);
            } catch (e4) {
              Wu(t3, t3.return, e4);
            }
          } else Sl(e3, t3, n3, r3);
          break;
        case 31:
          Sl(e3, t3, n3, r3);
          break;
        case 13:
          Sl(e3, t3, n3, r3);
          break;
        case 23:
          break;
        case 22:
          a3 = t3.stateNode, o3 = t3.alternate, t3.memoizedState === null ? a3._visibility & 2 ? Sl(e3, t3, n3, r3) : (a3._visibility |= 2, wl(e3, t3, n3, r3, (t3.subtreeFlags & 10256) != 0 || false)) : a3._visibility & 2 ? Sl(e3, t3, n3, r3) : Tl(e3, t3), i3 & 2048 && bl(o3, t3);
          break;
        case 24:
          Sl(e3, t3, n3, r3), i3 & 2048 && xl(t3.alternate, t3);
          break;
        default:
          Sl(e3, t3, n3, r3);
      }
    }
    function wl(e3, t3, n3, r3, i3) {
      for (i3 &&= (t3.subtreeFlags & 10256) != 0 || false, t3 = t3.child; t3 !== null; ) {
        var a3 = e3, o3 = t3, s3 = n3, c3 = r3, l3 = o3.flags;
        switch (o3.tag) {
          case 0:
          case 11:
          case 15:
            wl(a3, o3, s3, c3, i3), Lc(8, o3);
            break;
          case 23:
            break;
          case 22:
            var u2 = o3.stateNode;
            o3.memoizedState === null ? (u2._visibility |= 2, wl(a3, o3, s3, c3, i3)) : u2._visibility & 2 ? wl(a3, o3, s3, c3, i3) : Tl(a3, o3), i3 && l3 & 2048 && bl(o3.alternate, o3);
            break;
          case 24:
            wl(a3, o3, s3, c3, i3), i3 && l3 & 2048 && xl(o3.alternate, o3);
            break;
          default:
            wl(a3, o3, s3, c3, i3);
        }
        t3 = t3.sibling;
      }
    }
    function Tl(e3, t3) {
      if (t3.subtreeFlags & 10256) for (t3 = t3.child; t3 !== null; ) {
        var n3 = e3, r3 = t3, i3 = r3.flags;
        switch (r3.tag) {
          case 22:
            Tl(n3, r3), i3 & 2048 && bl(r3.alternate, r3);
            break;
          case 24:
            Tl(n3, r3), i3 & 2048 && xl(r3.alternate, r3);
            break;
          default:
            Tl(n3, r3);
        }
        t3 = t3.sibling;
      }
    }
    var El = 8192;
    function Dl(e3, t3, n3) {
      if (e3.subtreeFlags & El) for (e3 = e3.child; e3 !== null; ) Ol(e3, t3, n3), e3 = e3.sibling;
    }
    function Ol(e3, t3, n3) {
      switch (e3.tag) {
        case 26:
          Dl(e3, t3, n3), e3.flags & El && e3.memoizedState !== null && Kf(n3, pl, e3.memoizedState, e3.memoizedProps);
          break;
        case 5:
          Dl(e3, t3, n3);
          break;
        case 3:
        case 4:
          var r3 = pl;
          pl = _f(e3.stateNode.containerInfo), Dl(e3, t3, n3), pl = r3;
          break;
        case 22:
          e3.memoizedState === null && (r3 = e3.alternate, r3 !== null && r3.memoizedState !== null ? (r3 = El, El = 16777216, Dl(e3, t3, n3), El = r3) : Dl(e3, t3, n3));
          break;
        default:
          Dl(e3, t3, n3);
      }
    }
    function kl(e3) {
      var t3 = e3.alternate;
      if (t3 !== null && (e3 = t3.child, e3 !== null)) {
        t3.child = null;
        do
          t3 = e3.sibling, e3.sibling = null, e3 = t3;
        while (e3 !== null);
      }
    }
    function Al(e3) {
      var t3 = e3.deletions;
      if (e3.flags & 16) {
        if (t3 !== null) for (var n3 = 0; n3 < t3.length; n3++) {
          var r3 = t3[n3];
          el = r3, Nl(r3, e3);
        }
        kl(e3);
      }
      if (e3.subtreeFlags & 10256) for (e3 = e3.child; e3 !== null; ) jl(e3), e3 = e3.sibling;
    }
    function jl(e3) {
      switch (e3.tag) {
        case 0:
        case 11:
        case 15:
          Al(e3), e3.flags & 2048 && Rc(9, e3, e3.return);
          break;
        case 3:
          Al(e3);
          break;
        case 12:
          Al(e3);
          break;
        case 22:
          var t3 = e3.stateNode;
          e3.memoizedState !== null && t3._visibility & 2 && (e3.return === null || e3.return.tag !== 13) ? (t3._visibility &= -3, Ml(e3)) : Al(e3);
          break;
        default:
          Al(e3);
      }
    }
    function Ml(e3) {
      var t3 = e3.deletions;
      if (e3.flags & 16) {
        if (t3 !== null) for (var n3 = 0; n3 < t3.length; n3++) {
          var r3 = t3[n3];
          el = r3, Nl(r3, e3);
        }
        kl(e3);
      }
      for (e3 = e3.child; e3 !== null; ) {
        switch (t3 = e3, t3.tag) {
          case 0:
          case 11:
          case 15:
            Rc(8, t3, t3.return), Ml(t3);
            break;
          case 22:
            n3 = t3.stateNode, n3._visibility & 2 && (n3._visibility &= -3, Ml(t3));
            break;
          default:
            Ml(t3);
        }
        e3 = e3.sibling;
      }
    }
    function Nl(e3, t3) {
      for (; el !== null; ) {
        var n3 = el;
        switch (n3.tag) {
          case 0:
          case 11:
          case 15:
            Rc(8, n3, t3);
            break;
          case 23:
          case 22:
            if (n3.memoizedState !== null && n3.memoizedState.cachePool !== null) {
              var r3 = n3.memoizedState.cachePool.pool;
              r3 != null && r3.refCount++;
            }
            break;
          case 24:
            ta(n3.memoizedState.cache);
        }
        if (r3 = n3.child, r3 !== null) r3.return = n3, el = r3;
        else a: for (n3 = e3; el !== null; ) {
          r3 = el;
          var i3 = r3.sibling, a3 = r3.return;
          if (rl(r3), r3 === n3) {
            el = null;
            break a;
          }
          if (i3 !== null) {
            i3.return = a3, el = i3;
            break a;
          }
          el = a3;
        }
      }
    }
    var Pl = {
      getCacheForType: function(e3) {
        var t3 = qi($i), n3 = t3.data.get(e3);
        return n3 === void 0 && (n3 = e3(), t3.data.set(e3, n3)), n3;
      },
      cacheSignal: function() {
        return qi($i).controller.signal;
      }
    }, Fl = typeof WeakMap == `function` ? WeakMap : Map, X = 0, Il = null, Z = null, Q = 0, Ll = 0, Rl = null, zl = false, Bl = false, Vl = false, Hl = 0, Ul = 0, Wl = 0, Gl = 0, Kl = 0, ql = 0, Jl = 0, Yl = null, Xl = null, Zl = false, Ql = 0, $l = 0, eu = 1 / 0, tu = null, nu = null, ru = 0, iu = null, au = null, ou = 0, su = 0, cu = null, lu = null, uu = 0, du = null;
    function fu() {
      return X & 2 && Q !== 0 ? Q & -Q : M2.T === null ? rt2() : dd();
    }
    function pu() {
      if (ql === 0) if (!(Q & 536870912) || J) {
        var e3 = Ue2;
        Ue2 <<= 1, !(Ue2 & 3932160) && (Ue2 = 262144), ql = e3;
      } else ql = 536870912;
      return e3 = Ya.current, e3 !== null && (e3.flags |= 32), ql;
    }
    function mu(e3, t3, n3) {
      (e3 === Il && (Ll === 2 || Ll === 9) || e3.cancelPendingCommit !== null) && (xu(e3, 0), vu(e3, Q, ql, false)), z2(e3, n3), (!(X & 2) || e3 !== Il) && (e3 === Il && (!(X & 2) && (Gl |= n3), Ul === 4 && vu(e3, Q, ql, false)), rd(e3));
    }
    function hu(e3, t3, n3) {
      if (X & 6) throw Error(i2(327));
      var r3 = !n3 && (t3 & 127) == 0 && (t3 & e3.expiredLanes) === 0 || qe2(e3, t3), a3 = r3 ? ku(e3, t3) : Du(e3, t3, true), o3 = r3;
      do {
        if (a3 === 0) {
          Bl && !r3 && vu(e3, t3, 0, false);
          break;
        } else {
          if (n3 = e3.current.alternate, o3 && !_u(n3)) {
            a3 = Du(e3, t3, false), o3 = false;
            continue;
          }
          if (a3 === 2) {
            if (o3 = t3, e3.errorRecoveryDisabledLanes & o3) var s3 = 0;
            else s3 = e3.pendingLanes & -536870913, s3 = s3 === 0 ? s3 & 536870912 ? 536870912 : 0 : s3;
            if (s3 !== 0) {
              t3 = s3;
              a: {
                var c3 = e3;
                a3 = Yl;
                var l3 = c3.current.memoizedState.isDehydrated;
                if (l3 && (xu(c3, s3).flags |= 256), s3 = Du(c3, s3, false), s3 !== 2) {
                  if (Vl && !l3) {
                    c3.errorRecoveryDisabledLanes |= o3, Gl |= o3, a3 = 4;
                    break a;
                  }
                  o3 = Xl, Xl = a3, o3 !== null && (Xl === null ? Xl = o3 : Xl.push.apply(Xl, o3));
                }
                a3 = s3;
              }
              if (o3 = false, a3 !== 2) continue;
            }
          }
          if (a3 === 1) {
            xu(e3, 0), vu(e3, t3, 0, true);
            break;
          }
          a: {
            switch (r3 = e3, o3 = a3, o3) {
              case 0:
              case 1:
                throw Error(i2(345));
              case 4:
                if ((t3 & 4194048) !== t3) break;
              case 6:
                vu(r3, t3, ql, !zl);
                break a;
              case 2:
                Xl = null;
                break;
              case 3:
              case 5:
                break;
              default:
                throw Error(i2(329));
            }
            if ((t3 & 62914560) === t3 && (a3 = Ql + 300 - Oe2(), 10 < a3)) {
              if (vu(r3, t3, ql, !zl), Ke2(r3, 0, true) !== 0) break a;
              ou = t3, r3.timeoutHandle = qd(gu.bind(null, r3, n3, Xl, tu, Zl, t3, ql, Gl, Jl, zl, o3, `Throttled`, -0, 0), a3);
              break a;
            }
            gu(r3, n3, Xl, tu, Zl, t3, ql, Gl, Jl, zl, o3, null, -0, 0);
          }
        }
        break;
      } while (1);
      rd(e3);
    }
    function gu(e3, t3, n3, r3, i3, a3, o3, s3, c3, l3, u2, d3, f2, p3) {
      if (e3.timeoutHandle = -1, d3 = t3.subtreeFlags, d3 & 8192 || (d3 & 16785408) == 16785408) {
        d3 = {
          stylesheets: null,
          count: 0,
          imgCount: 0,
          imgBytes: 0,
          suspenseyImages: [],
          waitingForImages: true,
          waitingForViewTransition: false,
          unsuspend: K2
        }, Ol(t3, a3, d3);
        var m2 = (a3 & 62914560) === a3 ? Ql - Oe2() : (a3 & 4194048) === a3 ? $l - Oe2() : 0;
        if (m2 = Jf(d3, m2), m2 !== null) {
          ou = a3, e3.cancelPendingCommit = m2(Iu.bind(null, e3, t3, a3, n3, r3, i3, o3, s3, c3, u2, d3, null, f2, p3)), vu(e3, a3, o3, !l3);
          return;
        }
      }
      Iu(e3, t3, a3, n3, r3, i3, o3, s3, c3);
    }
    function _u(e3) {
      for (var t3 = e3; ; ) {
        var n3 = t3.tag;
        if ((n3 === 0 || n3 === 11 || n3 === 15) && t3.flags & 16384 && (n3 = t3.updateQueue, n3 !== null && (n3 = n3.stores, n3 !== null))) for (var r3 = 0; r3 < n3.length; r3++) {
          var i3 = n3[r3], a3 = i3.getSnapshot;
          i3 = i3.value;
          try {
            if (!mr(a3(), i3)) return false;
          } catch {
            return false;
          }
        }
        if (n3 = t3.child, t3.subtreeFlags & 16384 && n3 !== null) n3.return = t3, t3 = n3;
        else {
          if (t3 === e3) break;
          for (; t3.sibling === null; ) {
            if (t3.return === null || t3.return === e3) return true;
            t3 = t3.return;
          }
          t3.sibling.return = t3.return, t3 = t3.sibling;
        }
      }
      return true;
    }
    function vu(e3, t3, n3, r3) {
      t3 &= ~Kl, t3 &= ~Gl, e3.suspendedLanes |= t3, e3.pingedLanes &= ~t3, r3 && (e3.warmLanes |= t3), r3 = e3.expirationTimes;
      for (var i3 = t3; 0 < i3; ) {
        var a3 = 31 - ze2(i3), o3 = 1 << a3;
        r3[a3] = -1, i3 &= ~o3;
      }
      n3 !== 0 && Qe2(e3, n3, t3);
    }
    function yu() {
      return X & 6 ? true : (id(0, false), false);
    }
    function bu() {
      if (Z !== null) {
        if (Ll === 0) var e3 = Z.return;
        else e3 = Z, zi = Ri = null, Co(e3), wa = null, Ta = 0, e3 = Z;
        for (; e3 !== null; ) Ic(e3.alternate, e3), e3 = e3.return;
        Z = null;
      }
    }
    function xu(e3, t3) {
      var n3 = e3.timeoutHandle;
      n3 !== -1 && (e3.timeoutHandle = -1, Jd(n3)), n3 = e3.cancelPendingCommit, n3 !== null && (e3.cancelPendingCommit = null, n3()), ou = 0, bu(), Il = e3, Z = n3 = ni(e3.current, null), Q = t3, Ll = 0, Rl = null, zl = false, Bl = qe2(e3, t3), Vl = false, Jl = ql = Kl = Gl = Wl = Ul = 0, Xl = Yl = null, Zl = false, t3 & 8 && (t3 |= t3 & 32);
      var r3 = e3.entangledLanes;
      if (r3 !== 0) for (e3 = e3.entanglements, r3 &= t3; 0 < r3; ) {
        var i3 = 31 - ze2(r3), a3 = 1 << i3;
        t3 |= e3[i3], r3 &= ~a3;
      }
      return Hl = t3, Kr(), n3;
    }
    function Su(e3, t3) {
      Y = null, M2.H = Ns, t3 === ma || t3 === ga ? (t3 = Sa(), Ll = 3) : t3 === ha ? (t3 = Sa(), Ll = 4) : Ll = t3 === Zs ? 8 : typeof t3 == `object` && t3 && typeof t3.then == `function` ? 6 : 1, Rl = t3, Z === null && (Ul = 1, Gs(e3, ui(t3, e3.current)));
    }
    function Cu() {
      var e3 = Ya.current;
      return e3 === null ? true : (Q & 4194048) === Q ? Xa === null : (Q & 62914560) === Q || Q & 536870912 ? e3 === Xa : false;
    }
    function wu() {
      var e3 = M2.H;
      return M2.H = Ns, e3 === null ? Ns : e3;
    }
    function Tu() {
      var e3 = M2.A;
      return M2.A = Pl, e3;
    }
    function Eu() {
      Ul = 4, zl || (Q & 4194048) !== Q && Ya.current !== null || (Bl = true), !(Wl & 134217727) && !(Gl & 134217727) || Il === null || vu(Il, Q, ql, false);
    }
    function Du(e3, t3, n3) {
      var r3 = X;
      X |= 2;
      var i3 = wu(), a3 = Tu();
      (Il !== e3 || Q !== t3) && (tu = null, xu(e3, t3)), t3 = false;
      var o3 = Ul;
      a: do
        try {
          if (Ll !== 0 && Z !== null) {
            var s3 = Z, c3 = Rl;
            switch (Ll) {
              case 8:
                bu(), o3 = 6;
                break a;
              case 3:
              case 2:
              case 9:
              case 6:
                Ya.current === null && (t3 = true);
                var l3 = Ll;
                if (Ll = 0, Rl = null, Nu(e3, s3, c3, l3), n3 && Bl) {
                  o3 = 0;
                  break a;
                }
                break;
              default:
                l3 = Ll, Ll = 0, Rl = null, Nu(e3, s3, c3, l3);
            }
          }
          Ou(), o3 = Ul;
          break;
        } catch (t4) {
          Su(e3, t4);
        }
      while (1);
      return t3 && e3.shellSuspendCounter++, zi = Ri = null, X = r3, M2.H = i3, M2.A = a3, Z === null && (Il = null, Q = 0, Kr()), o3;
    }
    function Ou() {
      for (; Z !== null; ) ju(Z);
    }
    function ku(e3, t3) {
      var n3 = X;
      X |= 2;
      var r3 = wu(), a3 = Tu();
      Il !== e3 || Q !== t3 ? (tu = null, eu = Oe2() + 500, xu(e3, t3)) : Bl = qe2(e3, t3);
      a: do
        try {
          if (Ll !== 0 && Z !== null) {
            t3 = Z;
            var o3 = Rl;
            b: switch (Ll) {
              case 1:
                Ll = 0, Rl = null, Nu(e3, t3, o3, 1);
                break;
              case 2:
              case 9:
                if (va(o3)) {
                  Ll = 0, Rl = null, Mu(t3);
                  break;
                }
                t3 = function() {
                  Ll !== 2 && Ll !== 9 || Il !== e3 || (Ll = 7), rd(e3);
                }, o3.then(t3, t3);
                break a;
              case 3:
                Ll = 7;
                break a;
              case 4:
                Ll = 5;
                break a;
              case 7:
                va(o3) ? (Ll = 0, Rl = null, Mu(t3)) : (Ll = 0, Rl = null, Nu(e3, t3, o3, 7));
                break;
              case 5:
                var s3 = null;
                switch (Z.tag) {
                  case 26:
                    s3 = Z.memoizedState;
                  case 5:
                  case 27:
                    var c3 = Z;
                    if (s3 ? Gf(s3) : c3.stateNode.complete) {
                      Ll = 0, Rl = null;
                      var l3 = c3.sibling;
                      if (l3 !== null) Z = l3;
                      else {
                        var u2 = c3.return;
                        u2 === null ? Z = null : (Z = u2, Pu(u2));
                      }
                      break b;
                    }
                }
                Ll = 0, Rl = null, Nu(e3, t3, o3, 5);
                break;
              case 6:
                Ll = 0, Rl = null, Nu(e3, t3, o3, 6);
                break;
              case 8:
                bu(), Ul = 6;
                break a;
              default:
                throw Error(i2(462));
            }
          }
          Au();
          break;
        } catch (t4) {
          Su(e3, t4);
        }
      while (1);
      return zi = Ri = null, M2.H = r3, M2.A = a3, X = n3, Z === null ? (Il = null, Q = 0, Kr(), Ul) : 0;
    }
    function Au() {
      for (; Z !== null && !Ee2(); ) ju(Z);
    }
    function ju(e3) {
      var t3 = Dc(e3.alternate, e3, Hl);
      e3.memoizedProps = e3.pendingProps, t3 === null ? Pu(e3) : Z = t3;
    }
    function Mu(e3) {
      var t3 = e3, n3 = t3.alternate;
      switch (t3.tag) {
        case 15:
        case 0:
          t3 = dc(n3, t3, t3.pendingProps, t3.type, void 0, Q);
          break;
        case 11:
          t3 = dc(n3, t3, t3.pendingProps, t3.type.render, t3.ref, Q);
          break;
        case 5:
          Co(t3);
        default:
          Ic(n3, t3), t3 = Z = ri(t3, Hl), t3 = Dc(n3, t3, Hl);
      }
      e3.memoizedProps = e3.pendingProps, t3 === null ? Pu(e3) : Z = t3;
    }
    function Nu(e3, t3, n3, r3) {
      zi = Ri = null, Co(t3), wa = null, Ta = 0;
      var i3 = t3.return;
      try {
        if (Xs(e3, i3, t3, n3, Q)) {
          Ul = 1, Gs(e3, ui(n3, e3.current)), Z = null;
          return;
        }
      } catch (t4) {
        if (i3 !== null) throw Z = i3, t4;
        Ul = 1, Gs(e3, ui(n3, e3.current)), Z = null;
        return;
      }
      t3.flags & 32768 ? (J || r3 === 1 ? e3 = true : Bl || Q & 536870912 ? e3 = false : (zl = e3 = true, (r3 === 2 || r3 === 9 || r3 === 3 || r3 === 6) && (r3 = Ya.current, r3 !== null && r3.tag === 13 && (r3.flags |= 16384))), Fu(t3, e3)) : Pu(t3);
    }
    function Pu(e3) {
      var t3 = e3;
      do {
        if (t3.flags & 32768) {
          Fu(t3, zl);
          return;
        }
        e3 = t3.return;
        var n3 = Pc(t3.alternate, t3, Hl);
        if (n3 !== null) {
          Z = n3;
          return;
        }
        if (t3 = t3.sibling, t3 !== null) {
          Z = t3;
          return;
        }
        Z = t3 = e3;
      } while (t3 !== null);
      Ul === 0 && (Ul = 5);
    }
    function Fu(e3, t3) {
      do {
        var n3 = Fc(e3.alternate, e3);
        if (n3 !== null) {
          n3.flags &= 32767, Z = n3;
          return;
        }
        if (n3 = e3.return, n3 !== null && (n3.flags |= 32768, n3.subtreeFlags = 0, n3.deletions = null), !t3 && (e3 = e3.sibling, e3 !== null)) {
          Z = e3;
          return;
        }
        Z = e3 = n3;
      } while (e3 !== null);
      Ul = 6, Z = null;
    }
    function Iu(e3, t3, n3, r3, a3, o3, s3, c3, l3) {
      e3.cancelPendingCommit = null;
      do
        Vu();
      while (ru !== 0);
      if (X & 6) throw Error(i2(327));
      if (t3 !== null) {
        if (t3 === e3.current) throw Error(i2(177));
        if (o3 = t3.lanes | t3.childLanes, o3 |= Gr, Ze2(e3, n3, o3, s3, c3, l3), e3 === Il && (Z = Il = null, Q = 0), au = t3, iu = e3, ou = n3, su = o3, cu = a3, lu = r3, t3.subtreeFlags & 10256 || t3.flags & 10256 ? (e3.callbackNode = null, e3.callbackPriority = 0, Xu(Me2, function() {
          return Hu(), null;
        })) : (e3.callbackNode = null, e3.callbackPriority = 0), r3 = (t3.flags & 13878) != 0, t3.subtreeFlags & 13878 || r3) {
          r3 = M2.T, M2.T = null, a3 = N2.p, N2.p = 2, s3 = X, X |= 4;
          try {
            tl(e3, t3, n3);
          } finally {
            X = s3, N2.p = a3, M2.T = r3;
          }
        }
        ru = 1, Lu(), Ru(), zu();
      }
    }
    function Lu() {
      if (ru === 1) {
        ru = 0;
        var e3 = iu, t3 = au, n3 = (t3.flags & 13878) != 0;
        if (t3.subtreeFlags & 13878 || n3) {
          n3 = M2.T, M2.T = null;
          var r3 = N2.p;
          N2.p = 2;
          var i3 = X;
          X |= 4;
          try {
            ml(t3, e3);
            var a3 = Bd, o3 = yr(e3.containerInfo), s3 = a3.focusedElem, c3 = a3.selectionRange;
            if (o3 !== s3 && s3 && s3.ownerDocument && vr(s3.ownerDocument.documentElement, s3)) {
              if (c3 !== null && br(s3)) {
                var l3 = c3.start, u2 = c3.end;
                if (u2 === void 0 && (u2 = l3), `selectionStart` in s3) s3.selectionStart = l3, s3.selectionEnd = Math.min(u2, s3.value.length);
                else {
                  var d3 = s3.ownerDocument || document, f2 = d3 && d3.defaultView || window;
                  if (f2.getSelection) {
                    var p3 = f2.getSelection(), m2 = s3.textContent.length, h3 = Math.min(c3.start, m2), g3 = c3.end === void 0 ? h3 : Math.min(c3.end, m2);
                    !p3.extend && h3 > g3 && (o3 = g3, g3 = h3, h3 = o3);
                    var _3 = _r(s3, h3), v3 = _r(s3, g3);
                    if (_3 && v3 && (p3.rangeCount !== 1 || p3.anchorNode !== _3.node || p3.anchorOffset !== _3.offset || p3.focusNode !== v3.node || p3.focusOffset !== v3.offset)) {
                      var y3 = d3.createRange();
                      y3.setStart(_3.node, _3.offset), p3.removeAllRanges(), h3 > g3 ? (p3.addRange(y3), p3.extend(v3.node, v3.offset)) : (y3.setEnd(v3.node, v3.offset), p3.addRange(y3));
                    }
                  }
                }
              }
              for (d3 = [], p3 = s3; p3 = p3.parentNode; ) p3.nodeType === 1 && d3.push({
                element: p3,
                left: p3.scrollLeft,
                top: p3.scrollTop
              });
              for (typeof s3.focus == `function` && s3.focus(), s3 = 0; s3 < d3.length; s3++) {
                var b3 = d3[s3];
                b3.element.scrollLeft = b3.left, b3.element.scrollTop = b3.top;
              }
            }
            cp = !!zd, Bd = zd = null;
          } finally {
            X = i3, N2.p = r3, M2.T = n3;
          }
        }
        e3.current = t3, ru = 2;
      }
    }
    function Ru() {
      if (ru === 2) {
        ru = 0;
        var e3 = iu, t3 = au, n3 = (t3.flags & 8772) != 0;
        if (t3.subtreeFlags & 8772 || n3) {
          n3 = M2.T, M2.T = null;
          var r3 = N2.p;
          N2.p = 2;
          var i3 = X;
          X |= 4;
          try {
            nl(e3, t3.alternate, t3);
          } finally {
            X = i3, N2.p = r3, M2.T = n3;
          }
        }
        ru = 3;
      }
    }
    function zu() {
      if (ru === 4 || ru === 3) {
        ru = 0, De2();
        var e3 = iu, t3 = au, n3 = ou, r3 = lu;
        t3.subtreeFlags & 10256 || t3.flags & 10256 ? ru = 5 : (ru = 0, au = iu = null, Bu(e3, e3.pendingLanes));
        var i3 = e3.pendingLanes;
        if (i3 === 0 && (nu = null), nt2(n3), t3 = t3.stateNode, Le2 && typeof Le2.onCommitFiberRoot == `function`) try {
          Le2.onCommitFiberRoot(I2, t3, void 0, (t3.current.flags & 128) == 128);
        } catch {
        }
        if (r3 !== null) {
          t3 = M2.T, i3 = N2.p, N2.p = 2, M2.T = null;
          try {
            for (var a3 = e3.onRecoverableError, o3 = 0; o3 < r3.length; o3++) {
              var s3 = r3[o3];
              a3(s3.value, {
                componentStack: s3.stack
              });
            }
          } finally {
            M2.T = t3, N2.p = i3;
          }
        }
        ou & 3 && Vu(), rd(e3), i3 = e3.pendingLanes, n3 & 261930 && i3 & 42 ? e3 === du ? uu++ : (uu = 0, du = e3) : uu = 0, id(0, false);
      }
    }
    function Bu(e3, t3) {
      (e3.pooledCacheLanes &= t3) === 0 && (t3 = e3.pooledCache, t3 != null && (e3.pooledCache = null, ta(t3)));
    }
    function Vu() {
      return Lu(), Ru(), zu(), Hu();
    }
    function Hu() {
      if (ru !== 5) return false;
      var e3 = iu, t3 = su;
      su = 0;
      var n3 = nt2(ou), r3 = M2.T, a3 = N2.p;
      try {
        N2.p = 32 > n3 ? 32 : n3, M2.T = null, n3 = cu, cu = null;
        var o3 = iu, s3 = ou;
        if (ru = 0, au = iu = null, ou = 0, X & 6) throw Error(i2(331));
        var c3 = X;
        if (X |= 4, jl(o3.current), Cl(o3, o3.current, s3, n3), X = c3, id(0, false), Le2 && typeof Le2.onPostCommitFiberRoot == `function`) try {
          Le2.onPostCommitFiberRoot(I2, o3);
        } catch {
        }
        return true;
      } finally {
        N2.p = a3, M2.T = r3, Bu(e3, t3);
      }
    }
    function Uu(e3, t3, n3) {
      t3 = ui(n3, t3), t3 = qs(e3.stateNode, t3, 2), e3 = Ia(e3, t3, 2), e3 !== null && (z2(e3, 2), rd(e3));
    }
    function Wu(e3, t3, n3) {
      if (e3.tag === 3) Uu(e3, e3, n3);
      else for (; t3 !== null; ) {
        if (t3.tag === 3) {
          Uu(t3, e3, n3);
          break;
        } else if (t3.tag === 1) {
          var r3 = t3.stateNode;
          if (typeof t3.type.getDerivedStateFromError == `function` || typeof r3.componentDidCatch == `function` && (nu === null || !nu.has(r3))) {
            e3 = ui(n3, e3), n3 = Js(2), r3 = Ia(t3, n3, 2), r3 !== null && (Ys(n3, r3, t3, e3), z2(r3, 2), rd(r3));
            break;
          }
        }
        t3 = t3.return;
      }
    }
    function Gu(e3, t3, n3) {
      var r3 = e3.pingCache;
      if (r3 === null) {
        r3 = e3.pingCache = new Fl();
        var i3 = /* @__PURE__ */ new Set();
        r3.set(t3, i3);
      } else i3 = r3.get(t3), i3 === void 0 && (i3 = /* @__PURE__ */ new Set(), r3.set(t3, i3));
      i3.has(n3) || (Vl = true, i3.add(n3), e3 = Ku.bind(null, e3, t3, n3), t3.then(e3, e3));
    }
    function Ku(e3, t3, n3) {
      var r3 = e3.pingCache;
      r3 !== null && r3.delete(t3), e3.pingedLanes |= e3.suspendedLanes & n3, e3.warmLanes &= ~n3, Il === e3 && (Q & n3) === n3 && (Ul === 4 || Ul === 3 && (Q & 62914560) === Q && 300 > Oe2() - Ql ? !(X & 2) && xu(e3, 0) : Kl |= n3, Jl === Q && (Jl = 0)), rd(e3);
    }
    function qu(e3, t3) {
      t3 === 0 && (t3 = Ye2()), e3 = Yr(e3, t3), e3 !== null && (z2(e3, t3), rd(e3));
    }
    function Ju(e3) {
      var t3 = e3.memoizedState, n3 = 0;
      t3 !== null && (n3 = t3.retryLane), qu(e3, n3);
    }
    function Yu(e3, t3) {
      var n3 = 0;
      switch (e3.tag) {
        case 31:
        case 13:
          var r3 = e3.stateNode, a3 = e3.memoizedState;
          a3 !== null && (n3 = a3.retryLane);
          break;
        case 19:
          r3 = e3.stateNode;
          break;
        case 22:
          r3 = e3.stateNode._retryCache;
          break;
        default:
          throw Error(i2(314));
      }
      r3 !== null && r3.delete(t3), qu(e3, n3);
    }
    function Xu(e3, t3) {
      return we2(e3, t3);
    }
    var Zu = null, Qu = null, $u = false, ed = false, td = false, nd = 0;
    function rd(e3) {
      e3 !== Qu && e3.next === null && (Qu === null ? Zu = Qu = e3 : Qu = Qu.next = e3), ed = true, $u || ($u = true, ud());
    }
    function id(e3, t3) {
      if (!td && ed) {
        td = true;
        do
          for (var n3 = false, r3 = Zu; r3 !== null; ) {
            if (!t3) if (e3 !== 0) {
              var i3 = r3.pendingLanes;
              if (i3 === 0) var a3 = 0;
              else {
                var o3 = r3.suspendedLanes, s3 = r3.pingedLanes;
                a3 = (1 << 31 - ze2(42 | e3) + 1) - 1, a3 &= i3 & ~(o3 & ~s3), a3 = a3 & 201326741 ? a3 & 201326741 | 1 : a3 ? a3 | 2 : 0;
              }
              a3 !== 0 && (n3 = true, ld(r3, a3));
            } else a3 = Q, a3 = Ke2(r3, r3 === Il ? a3 : 0, r3.cancelPendingCommit !== null || r3.timeoutHandle !== -1), !(a3 & 3) || qe2(r3, a3) || (n3 = true, ld(r3, a3));
            r3 = r3.next;
          }
        while (n3);
        td = false;
      }
    }
    function ad() {
      od();
    }
    function od() {
      ed = $u = false;
      var e3 = 0;
      nd !== 0 && Kd() && (e3 = nd);
      for (var t3 = Oe2(), n3 = null, r3 = Zu; r3 !== null; ) {
        var i3 = r3.next, a3 = sd(r3, t3);
        a3 === 0 ? (r3.next = null, n3 === null ? Zu = i3 : n3.next = i3, i3 === null && (Qu = n3)) : (n3 = r3, (e3 !== 0 || a3 & 3) && (ed = true)), r3 = i3;
      }
      ru !== 0 && ru !== 5 || id(e3, false), nd !== 0 && (nd = 0);
    }
    function sd(e3, t3) {
      for (var n3 = e3.suspendedLanes, r3 = e3.pingedLanes, i3 = e3.expirationTimes, a3 = e3.pendingLanes & -62914561; 0 < a3; ) {
        var o3 = 31 - ze2(a3), s3 = 1 << o3, c3 = i3[o3];
        c3 === -1 ? ((s3 & n3) === 0 || (s3 & r3) !== 0) && (i3[o3] = Je2(s3, t3)) : c3 <= t3 && (e3.expiredLanes |= s3), a3 &= ~s3;
      }
      if (t3 = Il, n3 = Q, n3 = Ke2(e3, e3 === t3 ? n3 : 0, e3.cancelPendingCommit !== null || e3.timeoutHandle !== -1), r3 = e3.callbackNode, n3 === 0 || e3 === t3 && (Ll === 2 || Ll === 9) || e3.cancelPendingCommit !== null) return r3 !== null && r3 !== null && Te2(r3), e3.callbackNode = null, e3.callbackPriority = 0;
      if (!(n3 & 3) || qe2(e3, n3)) {
        if (t3 = n3 & -n3, t3 === e3.callbackPriority) return t3;
        switch (r3 !== null && Te2(r3), nt2(n3)) {
          case 2:
          case 8:
            n3 = je2;
            break;
          case 32:
            n3 = Me2;
            break;
          case 268435456:
            n3 = Pe2;
            break;
          default:
            n3 = Me2;
        }
        return r3 = cd.bind(null, e3), n3 = we2(n3, r3), e3.callbackPriority = t3, e3.callbackNode = n3, t3;
      }
      return r3 !== null && r3 !== null && Te2(r3), e3.callbackPriority = 2, e3.callbackNode = null, 2;
    }
    function cd(e3, t3) {
      if (ru !== 0 && ru !== 5) return e3.callbackNode = null, e3.callbackPriority = 0, null;
      var n3 = e3.callbackNode;
      if (Vu() && e3.callbackNode !== n3) return null;
      var r3 = Q;
      return r3 = Ke2(e3, e3 === Il ? r3 : 0, e3.cancelPendingCommit !== null || e3.timeoutHandle !== -1), r3 === 0 ? null : (hu(e3, r3, t3), sd(e3, Oe2()), e3.callbackNode != null && e3.callbackNode === n3 ? cd.bind(null, e3) : null);
    }
    function ld(e3, t3) {
      if (Vu()) return null;
      hu(e3, t3, true);
    }
    function ud() {
      Xd(function() {
        X & 6 ? we2(Ae2, ad) : od();
      });
    }
    function dd() {
      if (nd === 0) {
        var e3 = ia;
        e3 === 0 && (e3 = He2, He2 <<= 1, !(He2 & 261888) && (He2 = 256)), nd = e3;
      }
      return nd;
    }
    function fd(e3) {
      return e3 == null || typeof e3 == `symbol` || typeof e3 == `boolean` ? null : typeof e3 == `function` ? e3 : Kt2(`` + e3);
    }
    function pd(e3, t3) {
      var n3 = t3.ownerDocument.createElement(`input`);
      return n3.name = t3.name, n3.value = t3.value, e3.id && n3.setAttribute(`form`, e3.id), t3.parentNode.insertBefore(n3, t3), e3 = new FormData(e3), n3.parentNode.removeChild(n3), e3;
    }
    function md(e3, t3, n3, r3, i3) {
      if (t3 === `submit` && n3 && n3.stateNode === i3) {
        var a3 = fd((i3[st2] || null).action), o3 = r3.submitter;
        o3 && (t3 = (t3 = o3[st2] || null) ? fd(t3.formAction) : o3.getAttribute(`formAction`), t3 !== null && (a3 = t3, o3 = null));
        var s3 = new pn2(`action`, `action`, null, r3, i3);
        e3.push({
          event: s3,
          listeners: [
            {
              instance: null,
              listener: function() {
                if (r3.defaultPrevented) {
                  if (nd !== 0) {
                    var e4 = o3 ? pd(i3, o3) : new FormData(i3);
                    ys(n3, {
                      pending: true,
                      data: e4,
                      method: i3.method,
                      action: a3
                    }, null, e4);
                  }
                } else typeof a3 == `function` && (s3.preventDefault(), e4 = o3 ? pd(i3, o3) : new FormData(i3), ys(n3, {
                  pending: true,
                  data: e4,
                  method: i3.method,
                  action: a3
                }, a3, e4));
              },
              currentTarget: i3
            }
          ]
        });
      }
    }
    for (var hd = 0; hd < Br.length; hd++) {
      var gd = Br[hd];
      Vr(gd.toLowerCase(), `on` + (gd[0].toUpperCase() + gd.slice(1)));
    }
    Vr(Mr, `onAnimationEnd`), Vr(Nr, `onAnimationIteration`), Vr(Pr, `onAnimationStart`), Vr(`dblclick`, `onDoubleClick`), Vr(`focusin`, `onFocus`), Vr(`focusout`, `onBlur`), Vr(Fr, `onTransitionRun`), Vr(Ir, `onTransitionStart`), Vr(Lr, `onTransitionCancel`), Vr(Rr, `onTransitionEnd`), U2(`onMouseEnter`, [
      `mouseout`,
      `mouseover`
    ]), U2(`onMouseLeave`, [
      `mouseout`,
      `mouseover`
    ]), U2(`onPointerEnter`, [
      `pointerout`,
      `pointerover`
    ]), U2(`onPointerLeave`, [
      `pointerout`,
      `pointerover`
    ]), H2(`onChange`, `change click focusin focusout input keydown keyup selectionchange`.split(` `)), H2(`onSelect`, `focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange`.split(` `)), H2(`onBeforeInput`, [
      `compositionend`,
      `keypress`,
      `textInput`,
      `paste`
    ]), H2(`onCompositionEnd`, `compositionend focusout keydown keypress keyup mousedown`.split(` `)), H2(`onCompositionStart`, `compositionstart focusout keydown keypress keyup mousedown`.split(` `)), H2(`onCompositionUpdate`, `compositionupdate focusout keydown keypress keyup mousedown`.split(` `));
    var _d = `abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting`.split(` `), vd = new Set(`beforetoggle cancel close invalid load scroll scrollend toggle`.split(` `).concat(_d));
    function yd(e3, t3) {
      t3 = (t3 & 4) != 0;
      for (var n3 = 0; n3 < e3.length; n3++) {
        var r3 = e3[n3], i3 = r3.event;
        r3 = r3.listeners;
        a: {
          var a3 = void 0;
          if (t3) for (var o3 = r3.length - 1; 0 <= o3; o3--) {
            var s3 = r3[o3], c3 = s3.instance, l3 = s3.currentTarget;
            if (s3 = s3.listener, c3 !== a3 && i3.isPropagationStopped()) break a;
            a3 = s3, i3.currentTarget = l3;
            try {
              a3(i3);
            } catch (e4) {
              Hr(e4);
            }
            i3.currentTarget = null, a3 = c3;
          }
          else for (o3 = 0; o3 < r3.length; o3++) {
            if (s3 = r3[o3], c3 = s3.instance, l3 = s3.currentTarget, s3 = s3.listener, c3 !== a3 && i3.isPropagationStopped()) break a;
            a3 = s3, i3.currentTarget = l3;
            try {
              a3(i3);
            } catch (e4) {
              Hr(e4);
            }
            i3.currentTarget = null, a3 = c3;
          }
        }
      }
    }
    function $(e3, t3) {
      var n3 = t3[lt2];
      n3 === void 0 && (n3 = t3[lt2] = /* @__PURE__ */ new Set());
      var r3 = e3 + `__bubble`;
      n3.has(r3) || (Cd(t3, e3, 2, false), n3.add(r3));
    }
    function bd(e3, t3, n3) {
      var r3 = 0;
      t3 && (r3 |= 4), Cd(n3, e3, r3, t3);
    }
    var xd = `_reactListening` + Math.random().toString(36).slice(2);
    function Sd(e3) {
      if (!e3[xd]) {
        e3[xd] = true, yt2.forEach(function(t4) {
          t4 !== `selectionchange` && (vd.has(t4) || bd(t4, false, e3), bd(t4, true, e3));
        });
        var t3 = e3.nodeType === 9 ? e3 : e3.ownerDocument;
        t3 === null || t3[xd] || (t3[xd] = true, bd(`selectionchange`, false, t3));
      }
    }
    function Cd(e3, t3, n3, r3) {
      switch (hp(t3)) {
        case 2:
          var i3 = lp;
          break;
        case 8:
          i3 = up;
          break;
        default:
          i3 = dp;
      }
      n3 = i3.bind(null, t3, n3, e3), i3 = void 0, !nn2 || t3 !== `touchstart` && t3 !== `touchmove` && t3 !== `wheel` || (i3 = true), r3 ? i3 === void 0 ? e3.addEventListener(t3, n3, true) : e3.addEventListener(t3, n3, {
        capture: true,
        passive: i3
      }) : i3 === void 0 ? e3.addEventListener(t3, n3, false) : e3.addEventListener(t3, n3, {
        passive: i3
      });
    }
    function wd(e3, t3, n3, r3, i3) {
      var a3 = r3;
      if (!(t3 & 1) && !(t3 & 2) && r3 !== null) a: for (; ; ) {
        if (r3 === null) return;
        var s3 = r3.tag;
        if (s3 === 3 || s3 === 4) {
          var c3 = r3.stateNode.containerInfo;
          if (c3 === i3) break;
          if (s3 === 4) for (s3 = r3.return; s3 !== null; ) {
            var l3 = s3.tag;
            if ((l3 === 3 || l3 === 4) && s3.stateNode.containerInfo === i3) return;
            s3 = s3.return;
          }
          for (; c3 !== null; ) {
            if (s3 = ht2(c3), s3 === null) return;
            if (l3 = s3.tag, l3 === 5 || l3 === 6 || l3 === 26 || l3 === 27) {
              r3 = a3 = s3;
              continue a;
            }
            c3 = c3.parentNode;
          }
        }
        r3 = r3.return;
      }
      $t2(function() {
        var r4 = a3, i4 = Jt2(n3), s4 = [];
        a: {
          var c4 = zr.get(e3);
          if (c4 !== void 0) {
            var l4 = pn2, u2 = e3;
            switch (e3) {
              case `keypress`:
                if (ln2(n3) === 0) break a;
              case `keydown`:
              case `keyup`:
                l4 = jn2;
                break;
              case `focusin`:
                u2 = `focus`, l4 = Sn2;
                break;
              case `focusout`:
                u2 = `blur`, l4 = Sn2;
                break;
              case `beforeblur`:
              case `afterblur`:
                l4 = Sn2;
                break;
              case `click`:
                if (n3.button === 2) break a;
              case `auxclick`:
              case `dblclick`:
              case `mousedown`:
              case `mousemove`:
              case `mouseup`:
              case `mouseout`:
              case `mouseover`:
              case `contextmenu`:
                l4 = bn2;
                break;
              case `drag`:
              case `dragend`:
              case `dragenter`:
              case `dragexit`:
              case `dragleave`:
              case `dragover`:
              case `dragstart`:
              case `drop`:
                l4 = xn2;
                break;
              case `touchcancel`:
              case `touchend`:
              case `touchmove`:
              case `touchstart`:
                l4 = Nn2;
                break;
              case Mr:
              case Nr:
              case Pr:
                l4 = Cn2;
                break;
              case Rr:
                l4 = Pn2;
                break;
              case `scroll`:
              case `scrollend`:
                l4 = hn2;
                break;
              case `wheel`:
                l4 = Fn2;
                break;
              case `copy`:
              case `cut`:
              case `paste`:
                l4 = wn2;
                break;
              case `gotpointercapture`:
              case `lostpointercapture`:
              case `pointercancel`:
              case `pointerdown`:
              case `pointermove`:
              case `pointerout`:
              case `pointerover`:
              case `pointerup`:
                l4 = Mn2;
                break;
              case `toggle`:
              case `beforetoggle`:
                l4 = In2;
            }
            var d3 = (t3 & 4) != 0, f2 = !d3 && (e3 === `scroll` || e3 === `scrollend`), p3 = d3 ? c4 === null ? null : c4 + `Capture` : c4;
            d3 = [];
            for (var m2 = r4, h3; m2 !== null; ) {
              var g3 = m2;
              if (h3 = g3.stateNode, g3 = g3.tag, g3 !== 5 && g3 !== 26 && g3 !== 27 || h3 === null || p3 === null || (g3 = en2(m2, p3), g3 != null && d3.push(Td(m2, g3, h3))), f2) break;
              m2 = m2.return;
            }
            0 < d3.length && (c4 = new l4(c4, u2, null, n3, i4), s4.push({
              event: c4,
              listeners: d3
            }));
          }
        }
        if (!(t3 & 7)) {
          a: {
            if (c4 = e3 === `mouseover` || e3 === `pointerover`, l4 = e3 === `mouseout` || e3 === `pointerout`, c4 && n3 !== qt2 && (u2 = n3.relatedTarget || n3.fromElement) && (ht2(u2) || u2[ct2])) break a;
            if ((l4 || c4) && (c4 = i4.window === i4 ? i4 : (c4 = i4.ownerDocument) ? c4.defaultView || c4.parentWindow : window, l4 ? (u2 = n3.relatedTarget || n3.toElement, l4 = r4, u2 = u2 ? ht2(u2) : null, u2 !== null && (f2 = o2(u2), d3 = u2.tag, u2 !== f2 || d3 !== 5 && d3 !== 27 && d3 !== 6) && (u2 = null)) : (l4 = null, u2 = r4), l4 !== u2)) {
              if (d3 = bn2, g3 = `onMouseLeave`, p3 = `onMouseEnter`, m2 = `mouse`, (e3 === `pointerout` || e3 === `pointerover`) && (d3 = Mn2, g3 = `onPointerLeave`, p3 = `onPointerEnter`, m2 = `pointer`), f2 = l4 == null ? c4 : _t2(l4), h3 = u2 == null ? c4 : _t2(u2), c4 = new d3(g3, m2 + `leave`, l4, n3, i4), c4.target = f2, c4.relatedTarget = h3, g3 = null, ht2(i4) === r4 && (d3 = new d3(p3, m2 + `enter`, u2, n3, i4), d3.target = h3, d3.relatedTarget = f2, g3 = d3), f2 = g3, l4 && u2) b: {
                for (d3 = Dd, p3 = l4, m2 = u2, h3 = 0, g3 = p3; g3; g3 = d3(g3)) h3++;
                g3 = 0;
                for (var _3 = m2; _3; _3 = d3(_3)) g3++;
                for (; 0 < h3 - g3; ) p3 = d3(p3), h3--;
                for (; 0 < g3 - h3; ) m2 = d3(m2), g3--;
                for (; h3--; ) {
                  if (p3 === m2 || m2 !== null && p3 === m2.alternate) {
                    d3 = p3;
                    break b;
                  }
                  p3 = d3(p3), m2 = d3(m2);
                }
                d3 = null;
              }
              else d3 = null;
              l4 !== null && Od(s4, c4, l4, d3, false), u2 !== null && f2 !== null && Od(s4, f2, u2, d3, true);
            }
          }
          a: {
            if (c4 = r4 ? _t2(r4) : window, l4 = c4.nodeName && c4.nodeName.toLowerCase(), l4 === `select` || l4 === `input` && c4.type === `file`) var v3 = nr;
            else if (Xn(c4)) if (rr) v3 = fr;
            else {
              v3 = ur;
              var y3 = lr;
            }
            else l4 = c4.nodeName, !l4 || l4.toLowerCase() !== `input` || c4.type !== `checkbox` && c4.type !== `radio` ? r4 && Wt2(r4.elementType) && (v3 = nr) : v3 = dr;
            if (v3 &&= v3(e3, r4)) {
              Zn(s4, v3, n3, i4);
              break a;
            }
            y3 && y3(e3, c4, r4), e3 === `focusout` && r4 && c4.type === `number` && r4.memoizedProps.value != null && It2(c4, `number`, c4.value);
          }
          switch (y3 = r4 ? _t2(r4) : window, e3) {
            case `focusin`:
              (Xn(y3) || y3.contentEditable === `true`) && (Sr = y3, Cr = r4, wr = null);
              break;
            case `focusout`:
              wr = Cr = Sr = null;
              break;
            case `mousedown`:
              Tr = true;
              break;
            case `contextmenu`:
            case `mouseup`:
            case `dragend`:
              Tr = false, Er(s4, n3, i4);
              break;
            case `selectionchange`:
              if (xr) break;
            case `keydown`:
            case `keyup`:
              Er(s4, n3, i4);
          }
          var b3;
          if (Rn2) b: {
            switch (e3) {
              case `compositionstart`:
                var x3 = `onCompositionStart`;
                break b;
              case `compositionend`:
                x3 = `onCompositionEnd`;
                break b;
              case `compositionupdate`:
                x3 = `onCompositionUpdate`;
                break b;
            }
            x3 = void 0;
          }
          else Kn ? Wn(e3, n3) && (x3 = `onCompositionEnd`) : e3 === `keydown` && n3.keyCode === 229 && (x3 = `onCompositionStart`);
          x3 && (Vn && n3.locale !== `ko` && (Kn || x3 !== `onCompositionStart` ? x3 === `onCompositionEnd` && Kn && (b3 = cn2()) : (an2 = i4, on2 = `value` in an2 ? an2.value : an2.textContent, Kn = true)), y3 = Ed(r4, x3), 0 < y3.length && (x3 = new Tn2(x3, e3, null, n3, i4), s4.push({
            event: x3,
            listeners: y3
          }), b3 ? x3.data = b3 : (b3 = Gn(n3), b3 !== null && (x3.data = b3)))), (b3 = Bn ? qn(e3, n3) : Jn(e3, n3)) && (x3 = Ed(r4, `onBeforeInput`), 0 < x3.length && (y3 = new Tn2(`onBeforeInput`, `beforeinput`, null, n3, i4), s4.push({
            event: y3,
            listeners: x3
          }), y3.data = b3)), md(s4, e3, r4, n3, i4);
        }
        yd(s4, t3);
      });
    }
    function Td(e3, t3, n3) {
      return {
        instance: e3,
        listener: t3,
        currentTarget: n3
      };
    }
    function Ed(e3, t3) {
      for (var n3 = t3 + `Capture`, r3 = []; e3 !== null; ) {
        var i3 = e3, a3 = i3.stateNode;
        if (i3 = i3.tag, i3 !== 5 && i3 !== 26 && i3 !== 27 || a3 === null || (i3 = en2(e3, n3), i3 != null && r3.unshift(Td(e3, i3, a3)), i3 = en2(e3, t3), i3 != null && r3.push(Td(e3, i3, a3))), e3.tag === 3) return r3;
        e3 = e3.return;
      }
      return [];
    }
    function Dd(e3) {
      if (e3 === null) return null;
      do
        e3 = e3.return;
      while (e3 && e3.tag !== 5 && e3.tag !== 27);
      return e3 || null;
    }
    function Od(e3, t3, n3, r3, i3) {
      for (var a3 = t3._reactName, o3 = []; n3 !== null && n3 !== r3; ) {
        var s3 = n3, c3 = s3.alternate, l3 = s3.stateNode;
        if (s3 = s3.tag, c3 !== null && c3 === r3) break;
        s3 !== 5 && s3 !== 26 && s3 !== 27 || l3 === null || (c3 = l3, i3 ? (l3 = en2(n3, a3), l3 != null && o3.unshift(Td(n3, l3, c3))) : i3 || (l3 = en2(n3, a3), l3 != null && o3.push(Td(n3, l3, c3)))), n3 = n3.return;
      }
      o3.length !== 0 && e3.push({
        event: t3,
        listeners: o3
      });
    }
    var kd = /\r\n?/g, Ad = /\u0000|\uFFFD/g;
    function jd(e3) {
      return (typeof e3 == `string` ? e3 : `` + e3).replace(kd, `
`).replace(Ad, ``);
    }
    function Md(e3, t3) {
      return t3 = jd(t3), jd(e3) === t3;
    }
    function Nd(e3, t3, n3, r3, a3, o3) {
      switch (n3) {
        case `children`:
          typeof r3 == `string` ? t3 === `body` || t3 === `textarea` && r3 === `` || Bt2(e3, r3) : (typeof r3 == `number` || typeof r3 == `bigint`) && t3 !== `body` && Bt2(e3, `` + r3);
          break;
        case `className`:
          wt2(e3, `class`, r3);
          break;
        case `tabIndex`:
          wt2(e3, `tabindex`, r3);
          break;
        case `dir`:
        case `role`:
        case `viewBox`:
        case `width`:
        case `height`:
          wt2(e3, n3, r3);
          break;
        case `style`:
          Ut2(e3, r3, o3);
          break;
        case `data`:
          if (t3 !== `object`) {
            wt2(e3, `data`, r3);
            break;
          }
        case `src`:
        case `href`:
          if (r3 === `` && (t3 !== `a` || n3 !== `href`)) {
            e3.removeAttribute(n3);
            break;
          }
          if (r3 == null || typeof r3 == `function` || typeof r3 == `symbol` || typeof r3 == `boolean`) {
            e3.removeAttribute(n3);
            break;
          }
          r3 = Kt2(`` + r3), e3.setAttribute(n3, r3);
          break;
        case `action`:
        case `formAction`:
          if (typeof r3 == `function`) {
            e3.setAttribute(n3, `javascript:throw new Error('A React form was unexpectedly submitted. If you called form.submit() manually, consider using form.requestSubmit() instead. If you\\'re trying to use event.stopPropagation() in a submit event handler, consider also calling event.preventDefault().')`);
            break;
          } else typeof o3 == `function` && (n3 === `formAction` ? (t3 !== `input` && Nd(e3, t3, `name`, a3.name, a3, null), Nd(e3, t3, `formEncType`, a3.formEncType, a3, null), Nd(e3, t3, `formMethod`, a3.formMethod, a3, null), Nd(e3, t3, `formTarget`, a3.formTarget, a3, null)) : (Nd(e3, t3, `encType`, a3.encType, a3, null), Nd(e3, t3, `method`, a3.method, a3, null), Nd(e3, t3, `target`, a3.target, a3, null)));
          if (r3 == null || typeof r3 == `symbol` || typeof r3 == `boolean`) {
            e3.removeAttribute(n3);
            break;
          }
          r3 = Kt2(`` + r3), e3.setAttribute(n3, r3);
          break;
        case `onClick`:
          r3 != null && (e3.onclick = K2);
          break;
        case `onScroll`:
          r3 != null && $(`scroll`, e3);
          break;
        case `onScrollEnd`:
          r3 != null && $(`scrollend`, e3);
          break;
        case `dangerouslySetInnerHTML`:
          if (r3 != null) {
            if (typeof r3 != `object` || !(`__html` in r3)) throw Error(i2(61));
            if (n3 = r3.__html, n3 != null) {
              if (a3.children != null) throw Error(i2(60));
              e3.innerHTML = n3;
            }
          }
          break;
        case `multiple`:
          e3.multiple = r3 && typeof r3 != `function` && typeof r3 != `symbol`;
          break;
        case `muted`:
          e3.muted = r3 && typeof r3 != `function` && typeof r3 != `symbol`;
          break;
        case `suppressContentEditableWarning`:
        case `suppressHydrationWarning`:
        case `defaultValue`:
        case `defaultChecked`:
        case `innerHTML`:
        case `ref`:
          break;
        case `autoFocus`:
          break;
        case `xlinkHref`:
          if (r3 == null || typeof r3 == `function` || typeof r3 == `boolean` || typeof r3 == `symbol`) {
            e3.removeAttribute(`xlink:href`);
            break;
          }
          n3 = Kt2(`` + r3), e3.setAttributeNS(`http://www.w3.org/1999/xlink`, `xlink:href`, n3);
          break;
        case `contentEditable`:
        case `spellCheck`:
        case `draggable`:
        case `value`:
        case `autoReverse`:
        case `externalResourcesRequired`:
        case `focusable`:
        case `preserveAlpha`:
          r3 != null && typeof r3 != `function` && typeof r3 != `symbol` ? e3.setAttribute(n3, `` + r3) : e3.removeAttribute(n3);
          break;
        case `inert`:
        case `allowFullScreen`:
        case `async`:
        case `autoPlay`:
        case `controls`:
        case `default`:
        case `defer`:
        case `disabled`:
        case `disablePictureInPicture`:
        case `disableRemotePlayback`:
        case `formNoValidate`:
        case `hidden`:
        case `loop`:
        case `noModule`:
        case `noValidate`:
        case `open`:
        case `playsInline`:
        case `readOnly`:
        case `required`:
        case `reversed`:
        case `scoped`:
        case `seamless`:
        case `itemScope`:
          r3 && typeof r3 != `function` && typeof r3 != `symbol` ? e3.setAttribute(n3, ``) : e3.removeAttribute(n3);
          break;
        case `capture`:
        case `download`:
          true === r3 ? e3.setAttribute(n3, ``) : false !== r3 && r3 != null && typeof r3 != `function` && typeof r3 != `symbol` ? e3.setAttribute(n3, r3) : e3.removeAttribute(n3);
          break;
        case `cols`:
        case `rows`:
        case `size`:
        case `span`:
          r3 != null && typeof r3 != `function` && typeof r3 != `symbol` && !isNaN(r3) && 1 <= r3 ? e3.setAttribute(n3, r3) : e3.removeAttribute(n3);
          break;
        case `rowSpan`:
        case `start`:
          r3 == null || typeof r3 == `function` || typeof r3 == `symbol` || isNaN(r3) ? e3.removeAttribute(n3) : e3.setAttribute(n3, r3);
          break;
        case `popover`:
          $(`beforetoggle`, e3), $(`toggle`, e3), W2(e3, `popover`, r3);
          break;
        case `xlinkActuate`:
          Tt2(e3, `http://www.w3.org/1999/xlink`, `xlink:actuate`, r3);
          break;
        case `xlinkArcrole`:
          Tt2(e3, `http://www.w3.org/1999/xlink`, `xlink:arcrole`, r3);
          break;
        case `xlinkRole`:
          Tt2(e3, `http://www.w3.org/1999/xlink`, `xlink:role`, r3);
          break;
        case `xlinkShow`:
          Tt2(e3, `http://www.w3.org/1999/xlink`, `xlink:show`, r3);
          break;
        case `xlinkTitle`:
          Tt2(e3, `http://www.w3.org/1999/xlink`, `xlink:title`, r3);
          break;
        case `xlinkType`:
          Tt2(e3, `http://www.w3.org/1999/xlink`, `xlink:type`, r3);
          break;
        case `xmlBase`:
          Tt2(e3, `http://www.w3.org/XML/1998/namespace`, `xml:base`, r3);
          break;
        case `xmlLang`:
          Tt2(e3, `http://www.w3.org/XML/1998/namespace`, `xml:lang`, r3);
          break;
        case `xmlSpace`:
          Tt2(e3, `http://www.w3.org/XML/1998/namespace`, `xml:space`, r3);
          break;
        case `is`:
          W2(e3, `is`, r3);
          break;
        case `innerText`:
        case `textContent`:
          break;
        default:
          (!(2 < n3.length) || n3[0] !== `o` && n3[0] !== `O` || n3[1] !== `n` && n3[1] !== `N`) && (n3 = Gt2.get(n3) || n3, W2(e3, n3, r3));
      }
    }
    function Pd(e3, t3, n3, r3, a3, o3) {
      switch (n3) {
        case `style`:
          Ut2(e3, r3, o3);
          break;
        case `dangerouslySetInnerHTML`:
          if (r3 != null) {
            if (typeof r3 != `object` || !(`__html` in r3)) throw Error(i2(61));
            if (n3 = r3.__html, n3 != null) {
              if (a3.children != null) throw Error(i2(60));
              e3.innerHTML = n3;
            }
          }
          break;
        case `children`:
          typeof r3 == `string` ? Bt2(e3, r3) : (typeof r3 == `number` || typeof r3 == `bigint`) && Bt2(e3, `` + r3);
          break;
        case `onScroll`:
          r3 != null && $(`scroll`, e3);
          break;
        case `onScrollEnd`:
          r3 != null && $(`scrollend`, e3);
          break;
        case `onClick`:
          r3 != null && (e3.onclick = K2);
          break;
        case `suppressContentEditableWarning`:
        case `suppressHydrationWarning`:
        case `innerHTML`:
        case `ref`:
          break;
        case `innerText`:
        case `textContent`:
          break;
        default:
          if (!V2.hasOwnProperty(n3)) a: {
            if (n3[0] === `o` && n3[1] === `n` && (a3 = n3.endsWith(`Capture`), t3 = n3.slice(2, a3 ? n3.length - 7 : void 0), o3 = e3[st2] || null, o3 = o3 == null ? null : o3[n3], typeof o3 == `function` && e3.removeEventListener(t3, o3, a3), typeof r3 == `function`)) {
              typeof o3 != `function` && o3 !== null && (n3 in e3 ? e3[n3] = null : e3.hasAttribute(n3) && e3.removeAttribute(n3)), e3.addEventListener(t3, r3, a3);
              break a;
            }
            n3 in e3 ? e3[n3] = r3 : true === r3 ? e3.setAttribute(n3, ``) : W2(e3, n3, r3);
          }
      }
    }
    function Fd(e3, t3, n3) {
      switch (t3) {
        case `div`:
        case `span`:
        case `svg`:
        case `path`:
        case `a`:
        case `g`:
        case `p`:
        case `li`:
          break;
        case `img`:
          $(`error`, e3), $(`load`, e3);
          var r3 = false, a3 = false, o3;
          for (o3 in n3) if (n3.hasOwnProperty(o3)) {
            var s3 = n3[o3];
            if (s3 != null) switch (o3) {
              case `src`:
                r3 = true;
                break;
              case `srcSet`:
                a3 = true;
                break;
              case `children`:
              case `dangerouslySetInnerHTML`:
                throw Error(i2(137, t3));
              default:
                Nd(e3, t3, o3, s3, n3, null);
            }
          }
          a3 && Nd(e3, t3, `srcSet`, n3.srcSet, n3, null), r3 && Nd(e3, t3, `src`, n3.src, n3, null);
          return;
        case `input`:
          $(`invalid`, e3);
          var c3 = o3 = s3 = a3 = null, l3 = null, u2 = null;
          for (r3 in n3) if (n3.hasOwnProperty(r3)) {
            var d3 = n3[r3];
            if (d3 != null) switch (r3) {
              case `name`:
                a3 = d3;
                break;
              case `type`:
                s3 = d3;
                break;
              case `checked`:
                l3 = d3;
                break;
              case `defaultChecked`:
                u2 = d3;
                break;
              case `value`:
                o3 = d3;
                break;
              case `defaultValue`:
                c3 = d3;
                break;
              case `children`:
              case `dangerouslySetInnerHTML`:
                if (d3 != null) throw Error(i2(137, t3));
                break;
              default:
                Nd(e3, t3, r3, d3, n3, null);
            }
          }
          Ft2(e3, o3, c3, l3, u2, s3, a3, false);
          return;
        case `select`:
          for (a3 in $(`invalid`, e3), r3 = s3 = o3 = null, n3) if (n3.hasOwnProperty(a3) && (c3 = n3[a3], c3 != null)) switch (a3) {
            case `value`:
              o3 = c3;
              break;
            case `defaultValue`:
              s3 = c3;
              break;
            case `multiple`:
              r3 = c3;
            default:
              Nd(e3, t3, a3, c3, n3, null);
          }
          t3 = o3, n3 = s3, e3.multiple = !!r3, t3 == null ? n3 != null && Lt2(e3, !!r3, n3, true) : Lt2(e3, !!r3, t3, false);
          return;
        case `textarea`:
          for (s3 in $(`invalid`, e3), o3 = a3 = r3 = null, n3) if (n3.hasOwnProperty(s3) && (c3 = n3[s3], c3 != null)) switch (s3) {
            case `value`:
              r3 = c3;
              break;
            case `defaultValue`:
              a3 = c3;
              break;
            case `children`:
              o3 = c3;
              break;
            case `dangerouslySetInnerHTML`:
              if (c3 != null) throw Error(i2(91));
              break;
            default:
              Nd(e3, t3, s3, c3, n3, null);
          }
          zt2(e3, r3, a3, o3);
          return;
        case `option`:
          for (l3 in n3) if (n3.hasOwnProperty(l3) && (r3 = n3[l3], r3 != null)) switch (l3) {
            case `selected`:
              e3.selected = r3 && typeof r3 != `function` && typeof r3 != `symbol`;
              break;
            default:
              Nd(e3, t3, l3, r3, n3, null);
          }
          return;
        case `dialog`:
          $(`beforetoggle`, e3), $(`toggle`, e3), $(`cancel`, e3), $(`close`, e3);
          break;
        case `iframe`:
        case `object`:
          $(`load`, e3);
          break;
        case `video`:
        case `audio`:
          for (r3 = 0; r3 < _d.length; r3++) $(_d[r3], e3);
          break;
        case `image`:
          $(`error`, e3), $(`load`, e3);
          break;
        case `details`:
          $(`toggle`, e3);
          break;
        case `embed`:
        case `source`:
        case `link`:
          $(`error`, e3), $(`load`, e3);
        case `area`:
        case `base`:
        case `br`:
        case `col`:
        case `hr`:
        case `keygen`:
        case `meta`:
        case `param`:
        case `track`:
        case `wbr`:
        case `menuitem`:
          for (u2 in n3) if (n3.hasOwnProperty(u2) && (r3 = n3[u2], r3 != null)) switch (u2) {
            case `children`:
            case `dangerouslySetInnerHTML`:
              throw Error(i2(137, t3));
            default:
              Nd(e3, t3, u2, r3, n3, null);
          }
          return;
        default:
          if (Wt2(t3)) {
            for (d3 in n3) n3.hasOwnProperty(d3) && (r3 = n3[d3], r3 !== void 0 && Pd(e3, t3, d3, r3, n3, void 0));
            return;
          }
      }
      for (c3 in n3) n3.hasOwnProperty(c3) && (r3 = n3[c3], r3 != null && Nd(e3, t3, c3, r3, n3, null));
    }
    function Id(e3, t3, n3, r3) {
      switch (t3) {
        case `div`:
        case `span`:
        case `svg`:
        case `path`:
        case `a`:
        case `g`:
        case `p`:
        case `li`:
          break;
        case `input`:
          var a3 = null, o3 = null, s3 = null, c3 = null, l3 = null, u2 = null, d3 = null;
          for (m2 in n3) {
            var f2 = n3[m2];
            if (n3.hasOwnProperty(m2) && f2 != null) switch (m2) {
              case `checked`:
                break;
              case `value`:
                break;
              case `defaultValue`:
                l3 = f2;
              default:
                r3.hasOwnProperty(m2) || Nd(e3, t3, m2, null, r3, f2);
            }
          }
          for (var p3 in r3) {
            var m2 = r3[p3];
            if (f2 = n3[p3], r3.hasOwnProperty(p3) && (m2 != null || f2 != null)) switch (p3) {
              case `type`:
                o3 = m2;
                break;
              case `name`:
                a3 = m2;
                break;
              case `checked`:
                u2 = m2;
                break;
              case `defaultChecked`:
                d3 = m2;
                break;
              case `value`:
                s3 = m2;
                break;
              case `defaultValue`:
                c3 = m2;
                break;
              case `children`:
              case `dangerouslySetInnerHTML`:
                if (m2 != null) throw Error(i2(137, t3));
                break;
              default:
                m2 !== f2 && Nd(e3, t3, p3, m2, r3, f2);
            }
          }
          Pt2(e3, s3, c3, l3, u2, d3, o3, a3);
          return;
        case `select`:
          for (o3 in m2 = s3 = c3 = p3 = null, n3) if (l3 = n3[o3], n3.hasOwnProperty(o3) && l3 != null) switch (o3) {
            case `value`:
              break;
            case `multiple`:
              m2 = l3;
            default:
              r3.hasOwnProperty(o3) || Nd(e3, t3, o3, null, r3, l3);
          }
          for (a3 in r3) if (o3 = r3[a3], l3 = n3[a3], r3.hasOwnProperty(a3) && (o3 != null || l3 != null)) switch (a3) {
            case `value`:
              p3 = o3;
              break;
            case `defaultValue`:
              c3 = o3;
              break;
            case `multiple`:
              s3 = o3;
            default:
              o3 !== l3 && Nd(e3, t3, a3, o3, r3, l3);
          }
          t3 = c3, n3 = s3, r3 = m2, p3 == null ? !!r3 != !!n3 && (t3 == null ? Lt2(e3, !!n3, n3 ? [] : ``, false) : Lt2(e3, !!n3, t3, true)) : Lt2(e3, !!n3, p3, false);
          return;
        case `textarea`:
          for (c3 in m2 = p3 = null, n3) if (a3 = n3[c3], n3.hasOwnProperty(c3) && a3 != null && !r3.hasOwnProperty(c3)) switch (c3) {
            case `value`:
              break;
            case `children`:
              break;
            default:
              Nd(e3, t3, c3, null, r3, a3);
          }
          for (s3 in r3) if (a3 = r3[s3], o3 = n3[s3], r3.hasOwnProperty(s3) && (a3 != null || o3 != null)) switch (s3) {
            case `value`:
              p3 = a3;
              break;
            case `defaultValue`:
              m2 = a3;
              break;
            case `children`:
              break;
            case `dangerouslySetInnerHTML`:
              if (a3 != null) throw Error(i2(91));
              break;
            default:
              a3 !== o3 && Nd(e3, t3, s3, a3, r3, o3);
          }
          Rt2(e3, p3, m2);
          return;
        case `option`:
          for (var h3 in n3) if (p3 = n3[h3], n3.hasOwnProperty(h3) && p3 != null && !r3.hasOwnProperty(h3)) switch (h3) {
            case `selected`:
              e3.selected = false;
              break;
            default:
              Nd(e3, t3, h3, null, r3, p3);
          }
          for (l3 in r3) if (p3 = r3[l3], m2 = n3[l3], r3.hasOwnProperty(l3) && p3 !== m2 && (p3 != null || m2 != null)) switch (l3) {
            case `selected`:
              e3.selected = p3 && typeof p3 != `function` && typeof p3 != `symbol`;
              break;
            default:
              Nd(e3, t3, l3, p3, r3, m2);
          }
          return;
        case `img`:
        case `link`:
        case `area`:
        case `base`:
        case `br`:
        case `col`:
        case `embed`:
        case `hr`:
        case `keygen`:
        case `meta`:
        case `param`:
        case `source`:
        case `track`:
        case `wbr`:
        case `menuitem`:
          for (var g3 in n3) p3 = n3[g3], n3.hasOwnProperty(g3) && p3 != null && !r3.hasOwnProperty(g3) && Nd(e3, t3, g3, null, r3, p3);
          for (u2 in r3) if (p3 = r3[u2], m2 = n3[u2], r3.hasOwnProperty(u2) && p3 !== m2 && (p3 != null || m2 != null)) switch (u2) {
            case `children`:
            case `dangerouslySetInnerHTML`:
              if (p3 != null) throw Error(i2(137, t3));
              break;
            default:
              Nd(e3, t3, u2, p3, r3, m2);
          }
          return;
        default:
          if (Wt2(t3)) {
            for (var _3 in n3) p3 = n3[_3], n3.hasOwnProperty(_3) && p3 !== void 0 && !r3.hasOwnProperty(_3) && Pd(e3, t3, _3, void 0, r3, p3);
            for (d3 in r3) p3 = r3[d3], m2 = n3[d3], !r3.hasOwnProperty(d3) || p3 === m2 || p3 === void 0 && m2 === void 0 || Pd(e3, t3, d3, p3, r3, m2);
            return;
          }
      }
      for (var v3 in n3) p3 = n3[v3], n3.hasOwnProperty(v3) && p3 != null && !r3.hasOwnProperty(v3) && Nd(e3, t3, v3, null, r3, p3);
      for (f2 in r3) p3 = r3[f2], m2 = n3[f2], !r3.hasOwnProperty(f2) || p3 === m2 || p3 == null && m2 == null || Nd(e3, t3, f2, p3, r3, m2);
    }
    function Ld(e3) {
      switch (e3) {
        case `css`:
        case `script`:
        case `font`:
        case `img`:
        case `image`:
        case `input`:
        case `link`:
          return true;
        default:
          return false;
      }
    }
    function Rd() {
      if (typeof performance.getEntriesByType == `function`) {
        for (var e3 = 0, t3 = 0, n3 = performance.getEntriesByType(`resource`), r3 = 0; r3 < n3.length; r3++) {
          var i3 = n3[r3], a3 = i3.transferSize, o3 = i3.initiatorType, s3 = i3.duration;
          if (a3 && s3 && Ld(o3)) {
            for (o3 = 0, s3 = i3.responseEnd, r3 += 1; r3 < n3.length; r3++) {
              var c3 = n3[r3], l3 = c3.startTime;
              if (l3 > s3) break;
              var u2 = c3.transferSize, d3 = c3.initiatorType;
              u2 && Ld(d3) && (c3 = c3.responseEnd, o3 += u2 * (c3 < s3 ? 1 : (s3 - l3) / (c3 - l3)));
            }
            if (--r3, t3 += 8 * (a3 + o3) / (i3.duration / 1e3), e3++, 10 < e3) break;
          }
        }
        if (0 < e3) return t3 / e3 / 1e6;
      }
      return navigator.connection && (e3 = navigator.connection.downlink, typeof e3 == `number`) ? e3 : 5;
    }
    var zd = null, Bd = null;
    function Vd(e3) {
      return e3.nodeType === 9 ? e3 : e3.ownerDocument;
    }
    function Hd(e3) {
      switch (e3) {
        case `http://www.w3.org/2000/svg`:
          return 1;
        case `http://www.w3.org/1998/Math/MathML`:
          return 2;
        default:
          return 0;
      }
    }
    function Ud(e3, t3) {
      if (e3 === 0) switch (t3) {
        case `svg`:
          return 1;
        case `math`:
          return 2;
        default:
          return 0;
      }
      return e3 === 1 && t3 === `foreignObject` ? 0 : e3;
    }
    function Wd(e3, t3) {
      return e3 === `textarea` || e3 === `noscript` || typeof t3.children == `string` || typeof t3.children == `number` || typeof t3.children == `bigint` || typeof t3.dangerouslySetInnerHTML == `object` && t3.dangerouslySetInnerHTML !== null && t3.dangerouslySetInnerHTML.__html != null;
    }
    var Gd = null;
    function Kd() {
      var e3 = window.event;
      return e3 && e3.type === `popstate` ? e3 === Gd ? false : (Gd = e3, true) : (Gd = null, false);
    }
    var qd = typeof setTimeout == `function` ? setTimeout : void 0, Jd = typeof clearTimeout == `function` ? clearTimeout : void 0, Yd = typeof Promise == `function` ? Promise : void 0, Xd = typeof queueMicrotask == `function` ? queueMicrotask : Yd === void 0 ? qd : function(e3) {
      return Yd.resolve(null).then(e3).catch(Zd);
    };
    function Zd(e3) {
      setTimeout(function() {
        throw e3;
      });
    }
    function Qd(e3) {
      return e3 === `head`;
    }
    function $d(e3, t3) {
      var n3 = t3, r3 = 0;
      do {
        var i3 = n3.nextSibling;
        if (e3.removeChild(n3), i3 && i3.nodeType === 8) if (n3 = i3.data, n3 === `/$` || n3 === `/&`) {
          if (r3 === 0) {
            e3.removeChild(i3), Pp(t3);
            return;
          }
          r3--;
        } else if (n3 === `$` || n3 === `$?` || n3 === `$~` || n3 === `$!` || n3 === `&`) r3++;
        else if (n3 === `html`) mf(e3.ownerDocument.documentElement);
        else if (n3 === `head`) {
          n3 = e3.ownerDocument.head, mf(n3);
          for (var a3 = n3.firstChild; a3; ) {
            var o3 = a3.nextSibling, s3 = a3.nodeName;
            a3[pt2] || s3 === `SCRIPT` || s3 === `STYLE` || s3 === `LINK` && a3.rel.toLowerCase() === `stylesheet` || n3.removeChild(a3), a3 = o3;
          }
        } else n3 === `body` && mf(e3.ownerDocument.body);
        n3 = i3;
      } while (n3);
      Pp(t3);
    }
    function ef(e3, t3) {
      var n3 = e3;
      e3 = 0;
      do {
        var r3 = n3.nextSibling;
        if (n3.nodeType === 1 ? t3 ? (n3._stashedDisplay = n3.style.display, n3.style.display = `none`) : (n3.style.display = n3._stashedDisplay || ``, n3.getAttribute(`style`) === `` && n3.removeAttribute(`style`)) : n3.nodeType === 3 && (t3 ? (n3._stashedText = n3.nodeValue, n3.nodeValue = ``) : n3.nodeValue = n3._stashedText || ``), r3 && r3.nodeType === 8) if (n3 = r3.data, n3 === `/$`) {
          if (e3 === 0) break;
          e3--;
        } else n3 !== `$` && n3 !== `$?` && n3 !== `$~` && n3 !== `$!` || e3++;
        n3 = r3;
      } while (n3);
    }
    function tf(e3) {
      var t3 = e3.firstChild;
      for (t3 && t3.nodeType === 10 && (t3 = t3.nextSibling); t3; ) {
        var n3 = t3;
        switch (t3 = t3.nextSibling, n3.nodeName) {
          case `HTML`:
          case `HEAD`:
          case `BODY`:
            tf(n3), mt2(n3);
            continue;
          case `SCRIPT`:
          case `STYLE`:
            continue;
          case `LINK`:
            if (n3.rel.toLowerCase() === `stylesheet`) continue;
        }
        e3.removeChild(n3);
      }
    }
    function nf(e3, t3, n3, r3) {
      for (; e3.nodeType === 1; ) {
        var i3 = n3;
        if (e3.nodeName.toLowerCase() !== t3.toLowerCase()) {
          if (!r3 && (e3.nodeName !== `INPUT` || e3.type !== `hidden`)) break;
        } else if (!r3) if (t3 === `input` && e3.type === `hidden`) {
          var a3 = i3.name == null ? null : `` + i3.name;
          if (i3.type === `hidden` && e3.getAttribute(`name`) === a3) return e3;
        } else return e3;
        else if (!e3[pt2]) switch (t3) {
          case `meta`:
            if (!e3.hasAttribute(`itemprop`)) break;
            return e3;
          case `link`:
            if (a3 = e3.getAttribute(`rel`), a3 === `stylesheet` && e3.hasAttribute(`data-precedence`) || a3 !== i3.rel || e3.getAttribute(`href`) !== (i3.href == null || i3.href === `` ? null : i3.href) || e3.getAttribute(`crossorigin`) !== (i3.crossOrigin == null ? null : i3.crossOrigin) || e3.getAttribute(`title`) !== (i3.title == null ? null : i3.title)) break;
            return e3;
          case `style`:
            if (e3.hasAttribute(`data-precedence`)) break;
            return e3;
          case `script`:
            if (a3 = e3.getAttribute(`src`), (a3 !== (i3.src == null ? null : i3.src) || e3.getAttribute(`type`) !== (i3.type == null ? null : i3.type) || e3.getAttribute(`crossorigin`) !== (i3.crossOrigin == null ? null : i3.crossOrigin)) && a3 && e3.hasAttribute(`async`) && !e3.hasAttribute(`itemprop`)) break;
            return e3;
          default:
            return e3;
        }
        if (e3 = lf(e3.nextSibling), e3 === null) break;
      }
      return null;
    }
    function rf(e3, t3, n3) {
      if (t3 === ``) return null;
      for (; e3.nodeType !== 3; ) if ((e3.nodeType !== 1 || e3.nodeName !== `INPUT` || e3.type !== `hidden`) && !n3 || (e3 = lf(e3.nextSibling), e3 === null)) return null;
      return e3;
    }
    function af(e3, t3) {
      for (; e3.nodeType !== 8; ) if ((e3.nodeType !== 1 || e3.nodeName !== `INPUT` || e3.type !== `hidden`) && !t3 || (e3 = lf(e3.nextSibling), e3 === null)) return null;
      return e3;
    }
    function of(e3) {
      return e3.data === `$?` || e3.data === `$~`;
    }
    function sf(e3) {
      return e3.data === `$!` || e3.data === `$?` && e3.ownerDocument.readyState !== `loading`;
    }
    function cf(e3, t3) {
      var n3 = e3.ownerDocument;
      if (e3.data === `$~`) e3._reactRetry = t3;
      else if (e3.data !== `$?` || n3.readyState !== `loading`) t3();
      else {
        var r3 = function() {
          t3(), n3.removeEventListener(`DOMContentLoaded`, r3);
        };
        n3.addEventListener(`DOMContentLoaded`, r3), e3._reactRetry = r3;
      }
    }
    function lf(e3) {
      for (; e3 != null; e3 = e3.nextSibling) {
        var t3 = e3.nodeType;
        if (t3 === 1 || t3 === 3) break;
        if (t3 === 8) {
          if (t3 = e3.data, t3 === `$` || t3 === `$!` || t3 === `$?` || t3 === `$~` || t3 === `&` || t3 === `F!` || t3 === `F`) break;
          if (t3 === `/$` || t3 === `/&`) return null;
        }
      }
      return e3;
    }
    var uf = null;
    function df(e3) {
      e3 = e3.nextSibling;
      for (var t3 = 0; e3; ) {
        if (e3.nodeType === 8) {
          var n3 = e3.data;
          if (n3 === `/$` || n3 === `/&`) {
            if (t3 === 0) return lf(e3.nextSibling);
            t3--;
          } else n3 !== `$` && n3 !== `$!` && n3 !== `$?` && n3 !== `$~` && n3 !== `&` || t3++;
        }
        e3 = e3.nextSibling;
      }
      return null;
    }
    function ff(e3) {
      e3 = e3.previousSibling;
      for (var t3 = 0; e3; ) {
        if (e3.nodeType === 8) {
          var n3 = e3.data;
          if (n3 === `$` || n3 === `$!` || n3 === `$?` || n3 === `$~` || n3 === `&`) {
            if (t3 === 0) return e3;
            t3--;
          } else n3 !== `/$` && n3 !== `/&` || t3++;
        }
        e3 = e3.previousSibling;
      }
      return null;
    }
    function pf(e3, t3, n3) {
      switch (t3 = Vd(n3), e3) {
        case `html`:
          if (e3 = t3.documentElement, !e3) throw Error(i2(452));
          return e3;
        case `head`:
          if (e3 = t3.head, !e3) throw Error(i2(453));
          return e3;
        case `body`:
          if (e3 = t3.body, !e3) throw Error(i2(454));
          return e3;
        default:
          throw Error(i2(451));
      }
    }
    function mf(e3) {
      for (var t3 = e3.attributes; t3.length; ) e3.removeAttributeNode(t3[0]);
      mt2(e3);
    }
    var hf = /* @__PURE__ */ new Map(), gf = /* @__PURE__ */ new Set();
    function _f(e3) {
      return typeof e3.getRootNode == `function` ? e3.getRootNode() : e3.nodeType === 9 ? e3 : e3.ownerDocument;
    }
    var vf = N2.d;
    N2.d = {
      f: yf,
      r: bf,
      D: Cf,
      C: wf,
      L: Tf,
      m: Ef,
      X: Of,
      S: Df,
      M: kf
    };
    function yf() {
      var e3 = vf.f(), t3 = yu();
      return e3 || t3;
    }
    function bf(e3) {
      var t3 = gt2(e3);
      t3 !== null && t3.tag === 5 && t3.type === `form` ? xs(t3) : vf.r(e3);
    }
    var xf = typeof document > `u` ? null : document;
    function Sf(e3, t3, n3) {
      var r3 = xf;
      if (r3 && typeof t3 == `string` && t3) {
        var i3 = Nt2(t3);
        i3 = `link[rel="` + e3 + `"][href="` + i3 + `"]`, typeof n3 == `string` && (i3 += `[crossorigin="` + n3 + `"]`), gf.has(i3) || (gf.add(i3), e3 = {
          rel: e3,
          crossOrigin: n3,
          href: t3
        }, r3.querySelector(i3) === null && (t3 = r3.createElement(`link`), Fd(t3, `link`, e3), B2(t3), r3.head.appendChild(t3)));
      }
    }
    function Cf(e3) {
      vf.D(e3), Sf(`dns-prefetch`, e3, null);
    }
    function wf(e3, t3) {
      vf.C(e3, t3), Sf(`preconnect`, e3, t3);
    }
    function Tf(e3, t3, n3) {
      vf.L(e3, t3, n3);
      var r3 = xf;
      if (r3 && e3 && t3) {
        var i3 = `link[rel="preload"][as="` + Nt2(t3) + `"]`;
        t3 === `image` && n3 && n3.imageSrcSet ? (i3 += `[imagesrcset="` + Nt2(n3.imageSrcSet) + `"]`, typeof n3.imageSizes == `string` && (i3 += `[imagesizes="` + Nt2(n3.imageSizes) + `"]`)) : i3 += `[href="` + Nt2(e3) + `"]`;
        var a3 = i3;
        switch (t3) {
          case `style`:
            a3 = jf(e3);
            break;
          case `script`:
            a3 = Ff(e3);
        }
        hf.has(a3) || (e3 = h2({
          rel: `preload`,
          href: t3 === `image` && n3 && n3.imageSrcSet ? void 0 : e3,
          as: t3
        }, n3), hf.set(a3, e3), r3.querySelector(i3) !== null || t3 === `style` && r3.querySelector(Mf(a3)) || t3 === `script` && r3.querySelector(If(a3)) || (t3 = r3.createElement(`link`), Fd(t3, `link`, e3), B2(t3), r3.head.appendChild(t3)));
      }
    }
    function Ef(e3, t3) {
      vf.m(e3, t3);
      var n3 = xf;
      if (n3 && e3) {
        var r3 = t3 && typeof t3.as == `string` ? t3.as : `script`, i3 = `link[rel="modulepreload"][as="` + Nt2(r3) + `"][href="` + Nt2(e3) + `"]`, a3 = i3;
        switch (r3) {
          case `audioworklet`:
          case `paintworklet`:
          case `serviceworker`:
          case `sharedworker`:
          case `worker`:
          case `script`:
            a3 = Ff(e3);
        }
        if (!hf.has(a3) && (e3 = h2({
          rel: `modulepreload`,
          href: e3
        }, t3), hf.set(a3, e3), n3.querySelector(i3) === null)) {
          switch (r3) {
            case `audioworklet`:
            case `paintworklet`:
            case `serviceworker`:
            case `sharedworker`:
            case `worker`:
            case `script`:
              if (n3.querySelector(If(a3))) return;
          }
          r3 = n3.createElement(`link`), Fd(r3, `link`, e3), B2(r3), n3.head.appendChild(r3);
        }
      }
    }
    function Df(e3, t3, n3) {
      vf.S(e3, t3, n3);
      var r3 = xf;
      if (r3 && e3) {
        var i3 = vt2(r3).hoistableStyles, a3 = jf(e3);
        t3 ||= `default`;
        var o3 = i3.get(a3);
        if (!o3) {
          var s3 = {
            loading: 0,
            preload: null
          };
          if (o3 = r3.querySelector(Mf(a3))) s3.loading = 5;
          else {
            e3 = h2({
              rel: `stylesheet`,
              href: e3,
              "data-precedence": t3
            }, n3), (n3 = hf.get(a3)) && zf(e3, n3);
            var c3 = o3 = r3.createElement(`link`);
            B2(c3), Fd(c3, `link`, e3), c3._p = new Promise(function(e4, t4) {
              c3.onload = e4, c3.onerror = t4;
            }), c3.addEventListener(`load`, function() {
              s3.loading |= 1;
            }), c3.addEventListener(`error`, function() {
              s3.loading |= 2;
            }), s3.loading |= 4, Rf(o3, t3, r3);
          }
          o3 = {
            type: `stylesheet`,
            instance: o3,
            count: 1,
            state: s3
          }, i3.set(a3, o3);
        }
      }
    }
    function Of(e3, t3) {
      vf.X(e3, t3);
      var n3 = xf;
      if (n3 && e3) {
        var r3 = vt2(n3).hoistableScripts, i3 = Ff(e3), a3 = r3.get(i3);
        a3 || (a3 = n3.querySelector(If(i3)), a3 || (e3 = h2({
          src: e3,
          async: true
        }, t3), (t3 = hf.get(i3)) && Bf(e3, t3), a3 = n3.createElement(`script`), B2(a3), Fd(a3, `link`, e3), n3.head.appendChild(a3)), a3 = {
          type: `script`,
          instance: a3,
          count: 1,
          state: null
        }, r3.set(i3, a3));
      }
    }
    function kf(e3, t3) {
      vf.M(e3, t3);
      var n3 = xf;
      if (n3 && e3) {
        var r3 = vt2(n3).hoistableScripts, i3 = Ff(e3), a3 = r3.get(i3);
        a3 || (a3 = n3.querySelector(If(i3)), a3 || (e3 = h2({
          src: e3,
          async: true,
          type: `module`
        }, t3), (t3 = hf.get(i3)) && Bf(e3, t3), a3 = n3.createElement(`script`), B2(a3), Fd(a3, `link`, e3), n3.head.appendChild(a3)), a3 = {
          type: `script`,
          instance: a3,
          count: 1,
          state: null
        }, r3.set(i3, a3));
      }
    }
    function Af(e3, t3, n3, r3) {
      var a3 = (a3 = ue2.current) ? _f(a3) : null;
      if (!a3) throw Error(i2(446));
      switch (e3) {
        case `meta`:
        case `title`:
          return null;
        case `style`:
          return typeof n3.precedence == `string` && typeof n3.href == `string` ? (t3 = jf(n3.href), n3 = vt2(a3).hoistableStyles, r3 = n3.get(t3), r3 || (r3 = {
            type: `style`,
            instance: null,
            count: 0,
            state: null
          }, n3.set(t3, r3)), r3) : {
            type: `void`,
            instance: null,
            count: 0,
            state: null
          };
        case `link`:
          if (n3.rel === `stylesheet` && typeof n3.href == `string` && typeof n3.precedence == `string`) {
            e3 = jf(n3.href);
            var o3 = vt2(a3).hoistableStyles, s3 = o3.get(e3);
            if (s3 || (a3 = a3.ownerDocument || a3, s3 = {
              type: `stylesheet`,
              instance: null,
              count: 0,
              state: {
                loading: 0,
                preload: null
              }
            }, o3.set(e3, s3), (o3 = a3.querySelector(Mf(e3))) && !o3._p && (s3.instance = o3, s3.state.loading = 5), hf.has(e3) || (n3 = {
              rel: `preload`,
              as: `style`,
              href: n3.href,
              crossOrigin: n3.crossOrigin,
              integrity: n3.integrity,
              media: n3.media,
              hrefLang: n3.hrefLang,
              referrerPolicy: n3.referrerPolicy
            }, hf.set(e3, n3), o3 || Pf(a3, e3, n3, s3.state))), t3 && r3 === null) throw Error(i2(528, ``));
            return s3;
          }
          if (t3 && r3 !== null) throw Error(i2(529, ``));
          return null;
        case `script`:
          return t3 = n3.async, n3 = n3.src, typeof n3 == `string` && t3 && typeof t3 != `function` && typeof t3 != `symbol` ? (t3 = Ff(n3), n3 = vt2(a3).hoistableScripts, r3 = n3.get(t3), r3 || (r3 = {
            type: `script`,
            instance: null,
            count: 0,
            state: null
          }, n3.set(t3, r3)), r3) : {
            type: `void`,
            instance: null,
            count: 0,
            state: null
          };
        default:
          throw Error(i2(444, e3));
      }
    }
    function jf(e3) {
      return `href="` + Nt2(e3) + `"`;
    }
    function Mf(e3) {
      return `link[rel="stylesheet"][` + e3 + `]`;
    }
    function Nf(e3) {
      return h2({}, e3, {
        "data-precedence": e3.precedence,
        precedence: null
      });
    }
    function Pf(e3, t3, n3, r3) {
      e3.querySelector(`link[rel="preload"][as="style"][` + t3 + `]`) ? r3.loading = 1 : (t3 = e3.createElement(`link`), r3.preload = t3, t3.addEventListener(`load`, function() {
        return r3.loading |= 1;
      }), t3.addEventListener(`error`, function() {
        return r3.loading |= 2;
      }), Fd(t3, `link`, n3), B2(t3), e3.head.appendChild(t3));
    }
    function Ff(e3) {
      return `[src="` + Nt2(e3) + `"]`;
    }
    function If(e3) {
      return `script[async]` + e3;
    }
    function Lf(e3, t3, n3) {
      if (t3.count++, t3.instance === null) switch (t3.type) {
        case `style`:
          var r3 = e3.querySelector(`style[data-href~="` + Nt2(n3.href) + `"]`);
          if (r3) return t3.instance = r3, B2(r3), r3;
          var a3 = h2({}, n3, {
            "data-href": n3.href,
            "data-precedence": n3.precedence,
            href: null,
            precedence: null
          });
          return r3 = (e3.ownerDocument || e3).createElement(`style`), B2(r3), Fd(r3, `style`, a3), Rf(r3, n3.precedence, e3), t3.instance = r3;
        case `stylesheet`:
          a3 = jf(n3.href);
          var o3 = e3.querySelector(Mf(a3));
          if (o3) return t3.state.loading |= 4, t3.instance = o3, B2(o3), o3;
          r3 = Nf(n3), (a3 = hf.get(a3)) && zf(r3, a3), o3 = (e3.ownerDocument || e3).createElement(`link`), B2(o3);
          var s3 = o3;
          return s3._p = new Promise(function(e4, t4) {
            s3.onload = e4, s3.onerror = t4;
          }), Fd(o3, `link`, r3), t3.state.loading |= 4, Rf(o3, n3.precedence, e3), t3.instance = o3;
        case `script`:
          return o3 = Ff(n3.src), (a3 = e3.querySelector(If(o3))) ? (t3.instance = a3, B2(a3), a3) : (r3 = n3, (a3 = hf.get(o3)) && (r3 = h2({}, n3), Bf(r3, a3)), e3 = e3.ownerDocument || e3, a3 = e3.createElement(`script`), B2(a3), Fd(a3, `link`, r3), e3.head.appendChild(a3), t3.instance = a3);
        case `void`:
          return null;
        default:
          throw Error(i2(443, t3.type));
      }
      else t3.type === `stylesheet` && !(t3.state.loading & 4) && (r3 = t3.instance, t3.state.loading |= 4, Rf(r3, n3.precedence, e3));
      return t3.instance;
    }
    function Rf(e3, t3, n3) {
      for (var r3 = n3.querySelectorAll(`link[rel="stylesheet"][data-precedence],style[data-precedence]`), i3 = r3.length ? r3[r3.length - 1] : null, a3 = i3, o3 = 0; o3 < r3.length; o3++) {
        var s3 = r3[o3];
        if (s3.dataset.precedence === t3) a3 = s3;
        else if (a3 !== i3) break;
      }
      a3 ? a3.parentNode.insertBefore(e3, a3.nextSibling) : (t3 = n3.nodeType === 9 ? n3.head : n3, t3.insertBefore(e3, t3.firstChild));
    }
    function zf(e3, t3) {
      e3.crossOrigin ??= t3.crossOrigin, e3.referrerPolicy ??= t3.referrerPolicy, e3.title ??= t3.title;
    }
    function Bf(e3, t3) {
      e3.crossOrigin ??= t3.crossOrigin, e3.referrerPolicy ??= t3.referrerPolicy, e3.integrity ??= t3.integrity;
    }
    var Vf = null;
    function Hf(e3, t3, n3) {
      if (Vf === null) {
        var r3 = /* @__PURE__ */ new Map(), i3 = Vf = /* @__PURE__ */ new Map();
        i3.set(n3, r3);
      } else i3 = Vf, r3 = i3.get(n3), r3 || (r3 = /* @__PURE__ */ new Map(), i3.set(n3, r3));
      if (r3.has(e3)) return r3;
      for (r3.set(e3, null), n3 = n3.getElementsByTagName(e3), i3 = 0; i3 < n3.length; i3++) {
        var a3 = n3[i3];
        if (!(a3[pt2] || a3[ot2] || e3 === `link` && a3.getAttribute(`rel`) === `stylesheet`) && a3.namespaceURI !== `http://www.w3.org/2000/svg`) {
          var o3 = a3.getAttribute(t3) || ``;
          o3 = e3 + o3;
          var s3 = r3.get(o3);
          s3 ? s3.push(a3) : r3.set(o3, [
            a3
          ]);
        }
      }
      return r3;
    }
    function Uf(e3, t3, n3) {
      e3 = e3.ownerDocument || e3, e3.head.insertBefore(n3, t3 === `title` ? e3.querySelector(`head > title`) : null);
    }
    function Wf(e3, t3, n3) {
      if (n3 === 1 || t3.itemProp != null) return false;
      switch (e3) {
        case `meta`:
        case `title`:
          return true;
        case `style`:
          if (typeof t3.precedence != `string` || typeof t3.href != `string` || t3.href === ``) break;
          return true;
        case `link`:
          if (typeof t3.rel != `string` || typeof t3.href != `string` || t3.href === `` || t3.onLoad || t3.onError) break;
          switch (t3.rel) {
            case `stylesheet`:
              return e3 = t3.disabled, typeof t3.precedence == `string` && e3 == null;
            default:
              return true;
          }
        case `script`:
          if (t3.async && typeof t3.async != `function` && typeof t3.async != `symbol` && !t3.onLoad && !t3.onError && t3.src && typeof t3.src == `string`) return true;
      }
      return false;
    }
    function Gf(e3) {
      return !(e3.type === `stylesheet` && !(e3.state.loading & 3));
    }
    function Kf(e3, t3, n3, r3) {
      if (n3.type === `stylesheet` && (typeof r3.media != `string` || false !== matchMedia(r3.media).matches) && !(n3.state.loading & 4)) {
        if (n3.instance === null) {
          var i3 = jf(r3.href), a3 = t3.querySelector(Mf(i3));
          if (a3) {
            t3 = a3._p, typeof t3 == `object` && t3 && typeof t3.then == `function` && (e3.count++, e3 = Yf.bind(e3), t3.then(e3, e3)), n3.state.loading |= 4, n3.instance = a3, B2(a3);
            return;
          }
          a3 = t3.ownerDocument || t3, r3 = Nf(r3), (i3 = hf.get(i3)) && zf(r3, i3), a3 = a3.createElement(`link`), B2(a3);
          var o3 = a3;
          o3._p = new Promise(function(e4, t4) {
            o3.onload = e4, o3.onerror = t4;
          }), Fd(a3, `link`, r3), n3.instance = a3;
        }
        e3.stylesheets === null && (e3.stylesheets = /* @__PURE__ */ new Map()), e3.stylesheets.set(n3, t3), (t3 = n3.state.preload) && !(n3.state.loading & 3) && (e3.count++, n3 = Yf.bind(e3), t3.addEventListener(`load`, n3), t3.addEventListener(`error`, n3));
      }
    }
    var qf = 0;
    function Jf(e3, t3) {
      return e3.stylesheets && e3.count === 0 && Zf(e3, e3.stylesheets), 0 < e3.count || 0 < e3.imgCount ? function(n3) {
        var r3 = setTimeout(function() {
          if (e3.stylesheets && Zf(e3, e3.stylesheets), e3.unsuspend) {
            var t4 = e3.unsuspend;
            e3.unsuspend = null, t4();
          }
        }, 6e4 + t3);
        0 < e3.imgBytes && qf === 0 && (qf = 62500 * Rd());
        var i3 = setTimeout(function() {
          if (e3.waitingForImages = false, e3.count === 0 && (e3.stylesheets && Zf(e3, e3.stylesheets), e3.unsuspend)) {
            var t4 = e3.unsuspend;
            e3.unsuspend = null, t4();
          }
        }, (e3.imgBytes > qf ? 50 : 800) + t3);
        return e3.unsuspend = n3, function() {
          e3.unsuspend = null, clearTimeout(r3), clearTimeout(i3);
        };
      } : null;
    }
    function Yf() {
      if (this.count--, this.count === 0 && (this.imgCount === 0 || !this.waitingForImages)) {
        if (this.stylesheets) Zf(this, this.stylesheets);
        else if (this.unsuspend) {
          var e3 = this.unsuspend;
          this.unsuspend = null, e3();
        }
      }
    }
    var Xf = null;
    function Zf(e3, t3) {
      e3.stylesheets = null, e3.unsuspend !== null && (e3.count++, Xf = /* @__PURE__ */ new Map(), t3.forEach(Qf, e3), Xf = null, Yf.call(e3));
    }
    function Qf(e3, t3) {
      if (!(t3.state.loading & 4)) {
        var n3 = Xf.get(e3);
        if (n3) var r3 = n3.get(null);
        else {
          n3 = /* @__PURE__ */ new Map(), Xf.set(e3, n3);
          for (var i3 = e3.querySelectorAll(`link[data-precedence],style[data-precedence]`), a3 = 0; a3 < i3.length; a3++) {
            var o3 = i3[a3];
            (o3.nodeName === `LINK` || o3.getAttribute(`media`) !== `not all`) && (n3.set(o3.dataset.precedence, o3), r3 = o3);
          }
          r3 && n3.set(null, r3);
        }
        i3 = t3.instance, o3 = i3.getAttribute(`data-precedence`), a3 = n3.get(o3) || r3, a3 === r3 && n3.set(null, i3), n3.set(o3, i3), this.count++, r3 = Yf.bind(this), i3.addEventListener(`load`, r3), i3.addEventListener(`error`, r3), a3 ? a3.parentNode.insertBefore(i3, a3.nextSibling) : (e3 = e3.nodeType === 9 ? e3.head : e3, e3.insertBefore(i3, e3.firstChild)), t3.state.loading |= 4;
      }
    }
    var $f = {
      $$typeof: C2,
      Provider: null,
      Consumer: null,
      _currentValue: ie2,
      _currentValue2: ie2,
      _threadCount: 0
    };
    function ep(e3, t3, n3, r3, i3, a3, o3, s3, c3) {
      this.tag = 1, this.containerInfo = e3, this.pingCache = this.current = this.pendingChildren = null, this.timeoutHandle = -1, this.callbackNode = this.next = this.pendingContext = this.context = this.cancelPendingCommit = null, this.callbackPriority = 0, this.expirationTimes = Xe2(-1), this.entangledLanes = this.shellSuspendCounter = this.errorRecoveryDisabledLanes = this.expiredLanes = this.warmLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0, this.entanglements = Xe2(0), this.hiddenUpdates = Xe2(null), this.identifierPrefix = r3, this.onUncaughtError = i3, this.onCaughtError = a3, this.onRecoverableError = o3, this.pooledCache = null, this.pooledCacheLanes = 0, this.formState = c3, this.incompleteTransitions = /* @__PURE__ */ new Map();
    }
    function tp(e3, t3, n3, r3, i3, a3, o3, s3, c3, l3, u2, d3) {
      return e3 = new ep(e3, t3, n3, o3, c3, l3, u2, d3, s3), t3 = 1, true === a3 && (t3 |= 24), a3 = ei(3, null, null, t3), e3.current = a3, a3.stateNode = e3, t3 = ea(), t3.refCount++, e3.pooledCache = t3, t3.refCount++, a3.memoizedState = {
        element: r3,
        isDehydrated: n3,
        cache: t3
      }, Na(a3), e3;
    }
    function np(e3) {
      return e3 ? (e3 = Qr, e3) : Qr;
    }
    function rp(e3, t3, n3, r3, i3, a3) {
      i3 = np(i3), r3.context === null ? r3.context = i3 : r3.pendingContext = i3, r3 = Fa(t3), r3.payload = {
        element: n3
      }, a3 = a3 === void 0 ? null : a3, a3 !== null && (r3.callback = a3), n3 = Ia(e3, r3, t3), n3 !== null && (mu(n3, e3, t3), La(n3, e3, t3));
    }
    function ip(e3, t3) {
      if (e3 = e3.memoizedState, e3 !== null && e3.dehydrated !== null) {
        var n3 = e3.retryLane;
        e3.retryLane = n3 !== 0 && n3 < t3 ? n3 : t3;
      }
    }
    function ap(e3, t3) {
      ip(e3, t3), (e3 = e3.alternate) && ip(e3, t3);
    }
    function op(e3) {
      if (e3.tag === 13 || e3.tag === 31) {
        var t3 = Yr(e3, 67108864);
        t3 !== null && mu(t3, e3, 67108864), ap(e3, 67108864);
      }
    }
    function sp(e3) {
      if (e3.tag === 13 || e3.tag === 31) {
        var t3 = fu();
        t3 = tt2(t3);
        var n3 = Yr(e3, t3);
        n3 !== null && mu(n3, e3, t3), ap(e3, t3);
      }
    }
    var cp = true;
    function lp(e3, t3, n3, r3) {
      var i3 = M2.T;
      M2.T = null;
      var a3 = N2.p;
      try {
        N2.p = 2, dp(e3, t3, n3, r3);
      } finally {
        N2.p = a3, M2.T = i3;
      }
    }
    function up(e3, t3, n3, r3) {
      var i3 = M2.T;
      M2.T = null;
      var a3 = N2.p;
      try {
        N2.p = 8, dp(e3, t3, n3, r3);
      } finally {
        N2.p = a3, M2.T = i3;
      }
    }
    function dp(e3, t3, n3, r3) {
      if (cp) {
        var i3 = fp(r3);
        if (i3 === null) wd(e3, t3, r3, pp, n3), wp(e3, r3);
        else if (Ep(i3, e3, t3, n3, r3)) r3.stopPropagation();
        else if (wp(e3, r3), t3 & 4 && -1 < Cp.indexOf(e3)) {
          for (; i3 !== null; ) {
            var a3 = gt2(i3);
            if (a3 !== null) switch (a3.tag) {
              case 3:
                if (a3 = a3.stateNode, a3.current.memoizedState.isDehydrated) {
                  var o3 = Ge2(a3.pendingLanes);
                  if (o3 !== 0) {
                    var s3 = a3;
                    for (s3.pendingLanes |= 2, s3.entangledLanes |= 2; o3; ) {
                      var c3 = 1 << 31 - ze2(o3);
                      s3.entanglements[1] |= c3, o3 &= ~c3;
                    }
                    rd(a3), !(X & 6) && (eu = Oe2() + 500, id(0, false));
                  }
                }
                break;
              case 31:
              case 13:
                s3 = Yr(a3, 2), s3 !== null && mu(s3, a3, 2), yu(), ap(a3, 2);
            }
            if (a3 = fp(r3), a3 === null && wd(e3, t3, r3, pp, n3), a3 === i3) break;
            i3 = a3;
          }
          i3 !== null && r3.stopPropagation();
        } else wd(e3, t3, r3, null, n3);
      }
    }
    function fp(e3) {
      return e3 = Jt2(e3), mp(e3);
    }
    var pp = null;
    function mp(e3) {
      if (pp = null, e3 = ht2(e3), e3 !== null) {
        var t3 = o2(e3);
        if (t3 === null) e3 = null;
        else {
          var n3 = t3.tag;
          if (n3 === 13) {
            if (e3 = s2(t3), e3 !== null) return e3;
            e3 = null;
          } else if (n3 === 31) {
            if (e3 = c2(t3), e3 !== null) return e3;
            e3 = null;
          } else if (n3 === 3) {
            if (t3.stateNode.current.memoizedState.isDehydrated) return t3.tag === 3 ? t3.stateNode.containerInfo : null;
            e3 = null;
          } else t3 !== e3 && (e3 = null);
        }
      }
      return pp = e3, null;
    }
    function hp(e3) {
      switch (e3) {
        case `beforetoggle`:
        case `cancel`:
        case `click`:
        case `close`:
        case `contextmenu`:
        case `copy`:
        case `cut`:
        case `auxclick`:
        case `dblclick`:
        case `dragend`:
        case `dragstart`:
        case `drop`:
        case `focusin`:
        case `focusout`:
        case `input`:
        case `invalid`:
        case `keydown`:
        case `keypress`:
        case `keyup`:
        case `mousedown`:
        case `mouseup`:
        case `paste`:
        case `pause`:
        case `play`:
        case `pointercancel`:
        case `pointerdown`:
        case `pointerup`:
        case `ratechange`:
        case `reset`:
        case `resize`:
        case `seeked`:
        case `submit`:
        case `toggle`:
        case `touchcancel`:
        case `touchend`:
        case `touchstart`:
        case `volumechange`:
        case `change`:
        case `selectionchange`:
        case `textInput`:
        case `compositionstart`:
        case `compositionend`:
        case `compositionupdate`:
        case `beforeblur`:
        case `afterblur`:
        case `beforeinput`:
        case `blur`:
        case `fullscreenchange`:
        case `focus`:
        case `hashchange`:
        case `popstate`:
        case `select`:
        case `selectstart`:
          return 2;
        case `drag`:
        case `dragenter`:
        case `dragexit`:
        case `dragleave`:
        case `dragover`:
        case `mousemove`:
        case `mouseout`:
        case `mouseover`:
        case `pointermove`:
        case `pointerout`:
        case `pointerover`:
        case `scroll`:
        case `touchmove`:
        case `wheel`:
        case `mouseenter`:
        case `mouseleave`:
        case `pointerenter`:
        case `pointerleave`:
          return 8;
        case `message`:
          switch (ke2()) {
            case Ae2:
              return 2;
            case je2:
              return 8;
            case Me2:
            case Ne2:
              return 32;
            case Pe2:
              return 268435456;
            default:
              return 32;
          }
        default:
          return 32;
      }
    }
    var gp = false, _p = null, vp = null, yp = null, bp = /* @__PURE__ */ new Map(), xp = /* @__PURE__ */ new Map(), Sp = [], Cp = `mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset`.split(` `);
    function wp(e3, t3) {
      switch (e3) {
        case `focusin`:
        case `focusout`:
          _p = null;
          break;
        case `dragenter`:
        case `dragleave`:
          vp = null;
          break;
        case `mouseover`:
        case `mouseout`:
          yp = null;
          break;
        case `pointerover`:
        case `pointerout`:
          bp.delete(t3.pointerId);
          break;
        case `gotpointercapture`:
        case `lostpointercapture`:
          xp.delete(t3.pointerId);
      }
    }
    function Tp(e3, t3, n3, r3, i3, a3) {
      return e3 === null || e3.nativeEvent !== a3 ? (e3 = {
        blockedOn: t3,
        domEventName: n3,
        eventSystemFlags: r3,
        nativeEvent: a3,
        targetContainers: [
          i3
        ]
      }, t3 !== null && (t3 = gt2(t3), t3 !== null && op(t3)), e3) : (e3.eventSystemFlags |= r3, t3 = e3.targetContainers, i3 !== null && t3.indexOf(i3) === -1 && t3.push(i3), e3);
    }
    function Ep(e3, t3, n3, r3, i3) {
      switch (t3) {
        case `focusin`:
          return _p = Tp(_p, e3, t3, n3, r3, i3), true;
        case `dragenter`:
          return vp = Tp(vp, e3, t3, n3, r3, i3), true;
        case `mouseover`:
          return yp = Tp(yp, e3, t3, n3, r3, i3), true;
        case `pointerover`:
          var a3 = i3.pointerId;
          return bp.set(a3, Tp(bp.get(a3) || null, e3, t3, n3, r3, i3)), true;
        case `gotpointercapture`:
          return a3 = i3.pointerId, xp.set(a3, Tp(xp.get(a3) || null, e3, t3, n3, r3, i3)), true;
      }
      return false;
    }
    function Dp(e3) {
      var t3 = ht2(e3.target);
      if (t3 !== null) {
        var n3 = o2(t3);
        if (n3 !== null) {
          if (t3 = n3.tag, t3 === 13) {
            if (t3 = s2(n3), t3 !== null) {
              e3.blockedOn = t3, it2(e3.priority, function() {
                sp(n3);
              });
              return;
            }
          } else if (t3 === 31) {
            if (t3 = c2(n3), t3 !== null) {
              e3.blockedOn = t3, it2(e3.priority, function() {
                sp(n3);
              });
              return;
            }
          } else if (t3 === 3 && n3.stateNode.current.memoizedState.isDehydrated) {
            e3.blockedOn = n3.tag === 3 ? n3.stateNode.containerInfo : null;
            return;
          }
        }
      }
      e3.blockedOn = null;
    }
    function Op(e3) {
      if (e3.blockedOn !== null) return false;
      for (var t3 = e3.targetContainers; 0 < t3.length; ) {
        var n3 = fp(e3.nativeEvent);
        if (n3 === null) {
          n3 = e3.nativeEvent;
          var r3 = new n3.constructor(n3.type, n3);
          qt2 = r3, n3.target.dispatchEvent(r3), qt2 = null;
        } else return t3 = gt2(n3), t3 !== null && op(t3), e3.blockedOn = n3, false;
        t3.shift();
      }
      return true;
    }
    function kp(e3, t3, n3) {
      Op(e3) && n3.delete(t3);
    }
    function Ap() {
      gp = false, _p !== null && Op(_p) && (_p = null), vp !== null && Op(vp) && (vp = null), yp !== null && Op(yp) && (yp = null), bp.forEach(kp), xp.forEach(kp);
    }
    function jp(e3, n3) {
      e3.blockedOn === n3 && (e3.blockedOn = null, gp || (gp = true, t2.unstable_scheduleCallback(t2.unstable_NormalPriority, Ap)));
    }
    var Mp = null;
    function Np(e3) {
      Mp !== e3 && (Mp = e3, t2.unstable_scheduleCallback(t2.unstable_NormalPriority, function() {
        Mp === e3 && (Mp = null);
        for (var t3 = 0; t3 < e3.length; t3 += 3) {
          var n3 = e3[t3], r3 = e3[t3 + 1], i3 = e3[t3 + 2];
          if (typeof r3 != `function`) {
            if (mp(r3 || n3) === null) continue;
            break;
          }
          var a3 = gt2(n3);
          a3 !== null && (e3.splice(t3, 3), t3 -= 3, ys(a3, {
            pending: true,
            data: i3,
            method: n3.method,
            action: r3
          }, r3, i3));
        }
      }));
    }
    function Pp(e3) {
      function t3(t4) {
        return jp(t4, e3);
      }
      _p !== null && jp(_p, e3), vp !== null && jp(vp, e3), yp !== null && jp(yp, e3), bp.forEach(t3), xp.forEach(t3);
      for (var n3 = 0; n3 < Sp.length; n3++) {
        var r3 = Sp[n3];
        r3.blockedOn === e3 && (r3.blockedOn = null);
      }
      for (; 0 < Sp.length && (n3 = Sp[0], n3.blockedOn === null); ) Dp(n3), n3.blockedOn === null && Sp.shift();
      if (n3 = (e3.ownerDocument || e3).$$reactFormReplay, n3 != null) for (r3 = 0; r3 < n3.length; r3 += 3) {
        var i3 = n3[r3], a3 = n3[r3 + 1], o3 = i3[st2] || null;
        if (typeof a3 == `function`) o3 || Np(n3);
        else if (o3) {
          var s3 = null;
          if (a3 && a3.hasAttribute(`formAction`)) {
            if (i3 = a3, o3 = a3[st2] || null) s3 = o3.formAction;
            else if (mp(i3) !== null) continue;
          } else s3 = o3.action;
          typeof s3 == `function` ? n3[r3 + 1] = s3 : (n3.splice(r3, 3), r3 -= 3), Np(n3);
        }
      }
    }
    function Fp() {
      function e3(e4) {
        e4.canIntercept && e4.info === `react-transition` && e4.intercept({
          handler: function() {
            return new Promise(function(e5) {
              return i3 = e5;
            });
          },
          focusReset: `manual`,
          scroll: `manual`
        });
      }
      function t3() {
        i3 !== null && (i3(), i3 = null), r3 || setTimeout(n3, 20);
      }
      function n3() {
        if (!r3 && !navigation.transition) {
          var e4 = navigation.currentEntry;
          e4 && e4.url != null && navigation.navigate(e4.url, {
            state: e4.getState(),
            info: `react-transition`,
            history: `replace`
          });
        }
      }
      if (typeof navigation == `object`) {
        var r3 = false, i3 = null;
        return navigation.addEventListener(`navigate`, e3), navigation.addEventListener(`navigatesuccess`, t3), navigation.addEventListener(`navigateerror`, t3), setTimeout(n3, 100), function() {
          r3 = true, navigation.removeEventListener(`navigate`, e3), navigation.removeEventListener(`navigatesuccess`, t3), navigation.removeEventListener(`navigateerror`, t3), i3 !== null && (i3(), i3 = null);
        };
      }
    }
    function Ip(e3) {
      this._internalRoot = e3;
    }
    Lp.prototype.render = Ip.prototype.render = function(e3) {
      var t3 = this._internalRoot;
      if (t3 === null) throw Error(i2(409));
      var n3 = t3.current;
      rp(n3, fu(), e3, t3, null, null);
    }, Lp.prototype.unmount = Ip.prototype.unmount = function() {
      var e3 = this._internalRoot;
      if (e3 !== null) {
        this._internalRoot = null;
        var t3 = e3.containerInfo;
        rp(e3.current, 2, null, e3, null, null), yu(), t3[ct2] = null;
      }
    };
    function Lp(e3) {
      this._internalRoot = e3;
    }
    Lp.prototype.unstable_scheduleHydration = function(e3) {
      if (e3) {
        var t3 = rt2();
        e3 = {
          blockedOn: null,
          target: e3,
          priority: t3
        };
        for (var n3 = 0; n3 < Sp.length && t3 !== 0 && t3 < Sp[n3].priority; n3++) ;
        Sp.splice(n3, 0, e3), n3 === 0 && Dp(e3);
      }
    };
    var Rp = n2.version;
    if (Rp !== `19.2.7`) throw Error(i2(527, Rp, `19.2.7`));
    N2.findDOMNode = function(e3) {
      var t3 = e3._reactInternals;
      if (t3 === void 0) throw typeof e3.render == `function` ? Error(i2(188)) : (e3 = Object.keys(e3).join(`,`), Error(i2(268, e3)));
      return e3 = d2(t3), e3 = e3 === null ? null : p2(e3), e3 = e3 === null ? null : e3.stateNode, e3;
    };
    var zp = {
      bundleType: 0,
      version: `19.2.7`,
      rendererPackageName: `react-dom`,
      currentDispatcherRef: M2,
      reconcilerVersion: `19.2.7`
    };
    if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ < `u`) {
      var Bp = __REACT_DEVTOOLS_GLOBAL_HOOK__;
      if (!Bp.isDisabled && Bp.supportsFiber) try {
        I2 = Bp.inject(zp), Le2 = Bp;
      } catch {
      }
    }
    e2.createRoot = function(e3, t3) {
      if (!a2(e3)) throw Error(i2(299));
      var n3 = false, r3 = ``, o3 = Hs, s3 = Us, c3 = Ws;
      return t3 != null && (true === t3.unstable_strictMode && (n3 = true), t3.identifierPrefix !== void 0 && (r3 = t3.identifierPrefix), t3.onUncaughtError !== void 0 && (o3 = t3.onUncaughtError), t3.onCaughtError !== void 0 && (s3 = t3.onCaughtError), t3.onRecoverableError !== void 0 && (c3 = t3.onRecoverableError)), t3 = tp(e3, 1, false, null, null, n3, r3, null, o3, s3, c3, Fp), e3[ct2] = t3.current, Sd(e3), new Ip(t3);
    };
  })), g = o(((e2, t2) => {
    function n2() {
      if (!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > `u` || typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE != `function`)) try {
        __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(n2);
      } catch (e3) {
        console.error(e3);
      }
    }
    n2(), t2.exports = h();
  })), _ = c(u(), 1), v = g(), y = (e2) => {
    let t2, n2 = /* @__PURE__ */ new Set(), r2 = (e3, r3) => {
      let i3 = typeof e3 == `function` ? e3(t2) : e3;
      if (!Object.is(i3, t2)) {
        let e4 = t2;
        t2 = r3 ?? (typeof i3 != `object` || !i3) ? i3 : Object.assign({}, t2, i3), n2.forEach((n3) => n3(t2, e4));
      }
    }, i2 = () => t2, a2 = {
      setState: r2,
      getState: i2,
      getInitialState: () => o2,
      subscribe: (e3) => (n2.add(e3), () => n2.delete(e3))
    }, o2 = t2 = e2(r2, i2, a2);
    return a2;
  }, b = ((e2) => e2 ? y(e2) : y), x = (e2) => e2;
  function S(e2, t2 = x) {
    let n2 = _.useSyncExternalStore(e2.subscribe, _.useCallback(() => t2(e2.getState()), [
      e2,
      t2
    ]), _.useCallback(() => t2(e2.getInitialState()), [
      e2,
      t2
    ]));
    return _.useDebugValue(n2), n2;
  }
  var C = (e2) => {
    let t2 = b(e2), n2 = (e3) => S(t2, e3);
    return Object.assign(n2, t2), n2;
  }, w = ((e2) => e2 ? C(e2) : C);
  function ee(e2, t2) {
    let n2;
    try {
      n2 = e2();
    } catch {
      return;
    }
    return {
      getItem: (e3) => {
        let r2 = (e4) => e4 === null ? null : JSON.parse(e4, t2?.reviver), i2 = n2.getItem(e3) ?? null;
        return i2 instanceof Promise ? i2.then(r2) : r2(i2);
      },
      setItem: (e3, r2) => n2.setItem(e3, JSON.stringify(r2, t2?.replacer)),
      removeItem: (e3) => n2.removeItem(e3)
    };
  }
  var T = (e2) => (t2) => {
    try {
      let n2 = e2(t2);
      return n2 instanceof Promise ? n2 : {
        then(e3) {
          return T(e3)(n2);
        },
        catch(e3) {
          return this;
        }
      };
    } catch (e3) {
      return {
        then(e4) {
          return this;
        },
        catch(t3) {
          return T(t3)(e3);
        }
      };
    }
  }, te = (e2, t2) => (n2, r2, i2) => {
    let a2 = {
      storage: ee(() => window.localStorage),
      partialize: (e3) => e3,
      version: 0,
      merge: (e3, t3) => ({
        ...t3,
        ...e3
      }),
      ...t2
    }, o2 = false, s2 = 0, c2 = /* @__PURE__ */ new Set(), l2 = /* @__PURE__ */ new Set(), u2 = a2.storage;
    if (!u2) return e2((...e3) => {
      console.warn(`[zustand persist middleware] Unable to update item '${a2.name}', the given storage is currently unavailable.`), n2(...e3);
    }, r2, i2);
    let d2 = () => {
      let e3 = a2.partialize({
        ...r2()
      });
      return u2.setItem(a2.name, {
        state: e3,
        version: a2.version
      });
    }, f2 = i2.setState;
    i2.setState = (e3, t3) => (f2(e3, t3), d2());
    let p2 = e2((...e3) => (n2(...e3), d2()), r2, i2);
    i2.getInitialState = () => p2;
    let m2, h2 = () => {
      if (!u2) return;
      let e3 = ++s2;
      o2 = false, c2.forEach((e4) => e4(r2() ?? p2));
      let t3 = a2.onRehydrateStorage?.call(a2, r2() ?? p2) || void 0;
      return T(u2.getItem.bind(u2))(a2.name).then((e4) => {
        if (e4) if (typeof e4.version == `number` && e4.version !== a2.version) {
          if (a2.migrate) {
            let t4 = a2.migrate(e4.state, e4.version);
            return t4 instanceof Promise ? t4.then((e5) => [
              true,
              e5
            ]) : [
              true,
              t4
            ];
          }
          console.error(`State loaded from storage couldn't be migrated since no migrate function was provided`);
        } else return [
          false,
          e4.state
        ];
        return [
          false,
          void 0
        ];
      }).then((t4) => {
        if (e3 !== s2) return;
        let [i3, o3] = t4;
        if (m2 = a2.merge(o3, r2() ?? p2), n2(m2, true), i3) return d2();
      }).then(() => {
        e3 === s2 && (t3?.(r2(), void 0), m2 = r2(), o2 = true, l2.forEach((e4) => e4(m2)));
      }).catch((n3) => {
        e3 === s2 && t3?.(void 0, n3);
      });
    };
    return i2.persist = {
      setOptions: (e3) => {
        a2 = {
          ...a2,
          ...e3
        }, e3.storage && (u2 = e3.storage);
      },
      clearStorage: () => {
        u2?.removeItem(a2.name);
      },
      getOptions: () => a2,
      rehydrate: () => h2(),
      hasHydrated: () => o2,
      onHydrate: (e3) => (c2.add(e3), () => {
        c2.delete(e3);
      }),
      onFinishHydration: (e3) => (l2.add(e3), () => {
        l2.delete(e3);
      })
    }, a2.skipHydration || h2(), m2 || p2;
  }, ne = `https://router.project-osrm.org/table/v1/driving`, re = `https://router.project-osrm.org/route/v1/driving`, E = 9999999, D = 1e4, O = 1100, k = 300, A = (e2) => new Promise((t2) => setTimeout(t2, e2));
  async function j(e2, t2 = 3e4) {
    let n2 = new AbortController(), r2 = setTimeout(() => n2.abort(), t2);
    try {
      return await fetch(e2, {
        signal: n2.signal
      });
    } catch (e3) {
      throw e3.name === `AbortError` ? Error(`The OSRM server did not respond within ${t2 / 1e3}s. The free demo server may be busy \u2014 please try again.`) : Error(`Could not reach the OSRM service: ${e3.message}`);
    } finally {
      clearTimeout(r2);
    }
  }
  async function M(e2, t2, n2) {
    let r2 = e2.length;
    if (r2 < 2) throw Error(`Need at least two points to build a route.`);
    if (r2 > k) throw Error(`Too many points (${r2}). This client supports up to ${k}.`);
    let i2 = e2.map((e3) => `${e3.lng},${e3.lat}`).join(`;`), a2 = Math.max(1, Math.floor(D / r2)), o2 = Math.ceil(r2 / a2), s2 = [];
    for (let e3 = 0; e3 < o2; e3++) {
      let c2 = e3 * a2, l2 = Math.min(r2, c2 + a2), u2 = Array.from({
        length: l2 - c2
      }, (e4, t3) => c2 + t3).join(`;`), d2 = await j(`${ne}/${i2}?annotations=${t2}` + (o2 > 1 ? `&sources=${u2}` : ``));
      if (!d2.ok) throw Error(`OSRM table request failed: ${d2.status} ${d2.statusText}`);
      let f2 = await d2.json(), p2 = t2 === `distance` ? f2.distances : f2.durations;
      if (f2.code !== `Ok` || !p2) throw Error(`OSRM could not build a ${t2} matrix (${f2.message ?? f2.code}).`);
      for (let e4 of p2) s2.push(e4);
      n2?.(e3 + 1, o2), e3 < o2 - 1 && await A(O);
    }
    return s2.map((e3) => e3.map((e4) => e4 == null ? E : Math.round(e4)));
  }
  async function N(e2) {
    if (e2.length < 2) throw Error(`A route needs at least two points.`);
    let t2 = await j(`${re}/${e2.map((e3) => `${e3.lng},${e3.lat}`).join(`;`)}?overview=full&geometries=geojson`);
    if (!t2.ok) throw Error(`OSRM route request failed: ${t2.status} ${t2.statusText}`);
    let n2 = await t2.json();
    if (n2.code !== `Ok` || !n2.routes?.length) throw Error(`OSRM could not build a route (${n2.message ?? n2.code}).`);
    let r2 = n2.routes[0];
    return {
      geometry: r2.geometry,
      distanceMeters: r2.distance,
      durationSeconds: r2.duration
    };
  }
  function ie() {
    return typeof globalThis.WebAssembly?.promising == `function`;
  }
  function P() {
    let e2 = globalThis;
    return typeof e2.Bun < `u` ? `bun` : typeof e2.Deno < `u` ? `deno` : typeof e2.window < `u` && typeof e2.document < `u` ? `browser-main` : typeof WorkerGlobalScope < `u` && globalThis instanceof WorkerGlobalScope ? `browser-worker` : typeof process < `u` && typeof process.versions?.node == `string` ? `node` : `other`;
  }
  function F(e2 = P()) {
    return e2 === `browser-main` || e2 === `bun` || e2 === `deno` ? `asyncify` : ie() ? `jspi` : `asyncify`;
  }
  function ae(e2) {
    let t2 = {}, n2 = null;
    function r2() {
      return n2 || (n2 = F(), e2.logFlavorSelection && console.log(n2 === `jspi` ? `JSPI is supported. Using JSPI runtime.` : `Using Asyncify runtime.`), n2);
    }
    async function i2(n3, i3 = r2()) {
      let a3 = `${n3}:${i3}`;
      return t2[a3] ?? (t2[a3] = (async () => {
        let t3 = await e2.resolveAsset(n3, i3), r3 = await e2.loadFactory(t3.jsUrl), a4 = {
          locateFile: t3.locateFile
        };
        t3.wasmBinary && (a4.wasmBinary = t3.wasmBinary), t3.mainScriptUrlOrBlob && (a4.mainScriptUrlOrBlob = t3.mainScriptUrlOrBlob);
        try {
          return await r3(a4);
        } finally {
          t3.cleanupGlobalState?.();
        }
      })()), t2[a3];
    }
    async function a2() {
      let e3 = await Promise.allSettled(Object.values(t2));
      for (let t3 of e3) {
        if (t3.status !== `fulfilled`) continue;
        let e4 = t3.value;
        try {
          Object.prototype.hasOwnProperty.call(e4, `PThread`) && e4.PThread?.terminateAllThreads?.();
        } catch (e5) {
          if (!String(e5).includes(`PThread`)) throw e5;
        }
      }
    }
    return {
      terminateLoadedRuntimeThreads: a2,
      loadRuntime: () => i2(`cp_sat_runtime`),
      loadRuntimeAsyncify: () => i2(`cp_sat_runtime`, `asyncify`),
      loadRoutingRuntime: () => i2(`routing_runtime`),
      loadRoutingRuntimeAsyncify: () => i2(`routing_runtime`, `asyncify`),
      loadMPSolverRuntime: () => i2(`mp_solver_runtime`),
      loadMPSolverRuntimeAsyncify: () => i2(`mp_solver_runtime`, `asyncify`),
      loadMathOptRuntime: () => i2(`mathopt_runtime`),
      loadMathOptRuntimeAsyncify: () => i2(`mathopt_runtime`, `asyncify`),
      loadPdlpRuntime: () => i2(`pdlp_runtime`),
      loadPdlpRuntimeAsyncify: () => i2(`pdlp_runtime`, `asyncify`),
      loadGraphRuntime: () => i2(`graph_runtime`),
      loadGraphRuntimeAsyncify: () => i2(`graph_runtime`, `asyncify`),
      loadSetCoverRuntime: () => i2(`set_cover_runtime`),
      loadSetCoverRuntimeAsyncify: () => i2(`set_cover_runtime`, `asyncify`)
    };
  }
  var oe = `modulepreload`, se = function(e2) {
    return `/optimiser/` + e2;
  }, ce = {}, le = function(e2, t2, n2) {
    let r2 = Promise.resolve();
    if (t2 && t2.length > 0) {
      let o2 = function(e4) {
        return Promise.all(e4.map((e5) => Promise.resolve(e5).then((e6) => ({
          status: `fulfilled`,
          value: e6
        }), (e6) => ({
          status: `rejected`,
          reason: e6
        }))));
      }, s2 = function(e4) {
        return import.meta.resolve ? import.meta.resolve(e4) : new URL(e4, import.meta.url).href;
      };
      let e3 = document.getElementsByTagName(`link`), i3 = document.querySelector(`meta[property=csp-nonce]`), a2 = i3?.nonce || i3?.getAttribute(`nonce`);
      r2 = o2(t2.map((t3) => {
        if (t3 = se(t3, n2), t3 = s2(t3), t3 in ce) return;
        ce[t3] = true;
        let r3 = t3.endsWith(`.css`);
        for (let n3 = e3.length - 1; n3 >= 0; n3--) {
          let i5 = e3[n3];
          if (i5.href === t3 && (!r3 || i5.rel === `stylesheet`)) return;
        }
        let i4 = document.createElement(`link`);
        if (i4.rel = r3 ? `stylesheet` : oe, r3 || (i4.as = `script`), i4.crossOrigin = ``, i4.href = t3, a2 && i4.setAttribute(`nonce`, a2), document.head.appendChild(i4), r3) return new Promise((e4, n3) => {
          i4.addEventListener(`load`, e4), i4.addEventListener(`error`, () => n3(Error(`Unable to preload CSS for ${t3}`)));
        });
      }));
    }
    function i2(e3) {
      let t3 = new Event(`vite:preloadError`, {
        cancelable: true
      });
      if (t3.payload = e3, window.dispatchEvent(t3), !t3.defaultPrevented) throw e3;
    }
    return r2.then((t3) => {
      for (let e3 of t3 || []) e3.status === `rejected` && i2(e3.reason);
      return e2().catch(i2);
    });
  }, ue = {
    cp_sat_runtime: {
      jspi: {
        jsUrl: new URL(`/optimiser/assets/cp_sat_runtime-LLKA6C_f.js`, `` + import.meta.url).href,
        wasmUrl: new URL(`/optimiser/assets/cp_sat_runtime-DmgZoLlA.wasm`, `` + import.meta.url).href
      },
      asyncify: {
        jsUrl: new URL(`/optimiser/assets/cp_sat_runtime_asyncify-BbV8Er7C.js`, `` + import.meta.url).href,
        wasmUrl: new URL(`/optimiser/assets/cp_sat_runtime_asyncify-Bx945IH-.wasm`, `` + import.meta.url).href
      }
    },
    routing_runtime: {
      jspi: {
        jsUrl: new URL(`/optimiser/assets/routing_runtime-dowHRyyE.js`, `` + import.meta.url).href,
        wasmUrl: new URL(`/optimiser/assets/routing_runtime-CuCOktG3.wasm`, `` + import.meta.url).href
      },
      asyncify: {
        jsUrl: new URL(`/optimiser/assets/routing_runtime_asyncify-WhvUlcLF.js`, `` + import.meta.url).href,
        wasmUrl: new URL(`/optimiser/assets/routing_runtime_asyncify-B2vDrhEQ.wasm`, `` + import.meta.url).href
      }
    },
    mp_solver_runtime: {
      jspi: {
        jsUrl: new URL(`/optimiser/assets/mp_solver_runtime-DBc0s1ic.js`, `` + import.meta.url).href,
        wasmUrl: new URL(`/optimiser/assets/mp_solver_runtime-BGUwlTjT.wasm`, `` + import.meta.url).href
      },
      asyncify: {
        jsUrl: new URL(`/optimiser/assets/mp_solver_runtime_asyncify-rdfID_HP.js`, `` + import.meta.url).href,
        wasmUrl: new URL(`/optimiser/assets/mp_solver_runtime_asyncify-CIOfNmBj.wasm`, `` + import.meta.url).href
      }
    },
    mathopt_runtime: {
      jspi: {
        jsUrl: new URL(`/optimiser/assets/mathopt_runtime-C6cULZ0m.js`, `` + import.meta.url).href,
        wasmUrl: new URL(`/optimiser/assets/mathopt_runtime-BJ_7PuYT.wasm`, `` + import.meta.url).href
      },
      asyncify: {
        jsUrl: new URL(`/optimiser/assets/mathopt_runtime_asyncify-CnF-XChe.js`, `` + import.meta.url).href,
        wasmUrl: new URL(`/optimiser/assets/mathopt_runtime_asyncify-BgdfPFV_.wasm`, `` + import.meta.url).href
      }
    },
    pdlp_runtime: {
      jspi: {
        jsUrl: new URL(`/optimiser/assets/pdlp_runtime-LpmEy9PC.js`, `` + import.meta.url).href,
        wasmUrl: new URL(`/optimiser/assets/pdlp_runtime-DkKYXz3a.wasm`, `` + import.meta.url).href
      },
      asyncify: {
        jsUrl: new URL(`/optimiser/assets/pdlp_runtime_asyncify-NOlmf_lA.js`, `` + import.meta.url).href,
        wasmUrl: new URL(`/optimiser/assets/pdlp_runtime_asyncify-DmO51HmM.wasm`, `` + import.meta.url).href
      }
    },
    graph_runtime: {
      jspi: {
        jsUrl: new URL(`/optimiser/assets/graph_runtime-B0dyUFXY.js`, `` + import.meta.url).href,
        wasmUrl: new URL(`/optimiser/assets/graph_runtime-CQE3Zlzd.wasm`, `` + import.meta.url).href
      },
      asyncify: {
        jsUrl: new URL(`/optimiser/assets/graph_runtime_asyncify-BtgzpJad.js`, `` + import.meta.url).href,
        wasmUrl: new URL(`/optimiser/assets/graph_runtime_asyncify-Ct0sseev.wasm`, `` + import.meta.url).href
      }
    },
    set_cover_runtime: {
      jspi: {
        jsUrl: new URL(`/optimiser/assets/set_cover_runtime-CDaD4grS.js`, `` + import.meta.url).href,
        wasmUrl: new URL(`/optimiser/assets/set_cover_runtime-Dp6age5s.wasm`, `` + import.meta.url).href
      },
      asyncify: {
        jsUrl: new URL(`/optimiser/assets/set_cover_runtime_asyncify-BAJ85vaG.js`, `` + import.meta.url).href,
        wasmUrl: new URL(`/optimiser/assets/set_cover_runtime_asyncify-BSR25Zkv.wasm`, `` + import.meta.url).href
      }
    }
  };
  async function de(e2) {
    let { default: t2 } = await le(async () => {
      let { default: t3 } = await import(e2).then(async (m2) => {
        await m2.__tla;
        return m2;
      });
      return {
        default: t3
      };
    }, []);
    return t2;
  }
  function fe(e2) {
    return (new URL(e2).pathname.split(`/`).pop() ?? ``).replace(/-[A-Za-z0-9_-]+(?=\.(?:js|wasm)$)/, ``);
  }
  function pe(e2) {
    for (let t2 of Object.values(ue)) for (let n2 of Object.values(t2)) {
      if (e2 === fe(n2.jsUrl)) return n2.jsUrl;
      if (e2 === fe(n2.wasmUrl)) return n2.wasmUrl;
    }
    return e2;
  }
  var me = ae({
    logFlavorSelection: true,
    loadFactory: de,
    async resolveAsset(e2, t2) {
      let n2 = ue[e2][t2], r2 = new Uint8Array(await (await fetch(n2.wasmUrl)).arrayBuffer());
      return {
        jsUrl: n2.jsUrl,
        locateFile: pe,
        wasmBinary: r2,
        mainScriptUrlOrBlob: n2.jsUrl
      };
    }
  });
  me.terminateLoadedRuntimeThreads, me.loadRuntime, me.loadRuntimeAsyncify;
  var he = me.loadRoutingRuntime;
  me.loadRoutingRuntimeAsyncify, me.loadMPSolverRuntime, me.loadMPSolverRuntimeAsyncify, me.loadMathOptRuntime, me.loadMathOptRuntimeAsyncify, me.loadPdlpRuntime, me.loadPdlpRuntimeAsyncify, me.loadGraphRuntime, me.loadGraphRuntimeAsyncify, me.loadSetCoverRuntime, me.loadSetCoverRuntimeAsyncify;
  var ge = typeof window < `u` && typeof document < `u`, _e = `Deno` in globalThis, ve = `Bun` in globalThis, ye = typeof process < `u` && typeof process.versions?.node == `string` && !_e && !ve, be = (ge || _e || ve) && typeof Worker < `u` || ye, xe = null, Se = null, Ce = ge && be, we = 1, Te = /* @__PURE__ */ new Map();
  function Ee() {
    return Ce && be;
  }
  function De() {
    return Ee();
  }
  function Oe(e2) {
    if (Ce = !!e2, Ce && !be) throw Ce = false, Error(`Worker bridge requested but no worker is available in this environment.`);
    Ce || Ae(`OR-Tools worker bridge disabled.`);
  }
  function ke() {
    return we++;
  }
  function Ae(e2) {
    if (!xe) return;
    xe.terminate(), xe = null, Se = null;
    let t2 = Error(e2 ?? `OR-Tools worker terminated.`);
    for (let e3 of Te.values()) e3.reject(t2);
    Te.clear();
  }
  async function je() {
    return new Worker(new URL(`/optimiser/assets/ortools_worker-BcV7qVqH.js`, `` + import.meta.url), {
      type: `module`
    });
  }
  async function Me() {
    if (!be) throw Error(`Worker bridge is not available.`);
    if (xe) return xe;
    let e2 = await je();
    return e2.unref?.(), xe = e2, Se = new Promise((t2, n2) => {
      let r2 = (e3) => {
        if (e3.type === `ready`) {
          t2();
          return;
        }
        let r3 = Te.get(e3.id);
        if (e3.type === `solveCallback`) {
          if (r3?.onEvent) try {
            r3.onEvent(e3);
          } catch (t3) {
            Te.delete(e3.id), r3.reject(t3);
          }
          return;
        }
        if (e3.type === `error`) {
          let t3 = Error(e3.error);
          r3 ? (r3.reject(t3), Te.delete(e3.id)) : n2(t3);
          return;
        }
        r3 && (Te.delete(e3.id), r3.resolve(e3));
      }, i2 = (e3) => {
        let t3 = e3 instanceof Error ? e3.message : e3.error instanceof Error ? e3.error.message : e3.message || `The runtime blocked or failed to load the worker module.`, r3 = Error(`OR-Tools worker failed to load: ${t3}`);
        n2(r3), Ae(r3.message);
      };
      typeof e2.on == `function` ? (e2.on(`message`, r2), e2.on(`error`, i2)) : (e2.onmessage = (e3) => r2(e3.data), e2.onerror = i2);
    }), e2;
  }
  async function Ne() {
    if (!be) throw Error(`Worker bridge is not available.`);
    if (await Me(), !Se) throw Error(`Worker ready state unavailable.`);
    await Se;
  }
  async function Pe(e2, t2) {
    if (!be) throw Error(`Worker bridge is not available.`);
    let n2 = await Me();
    return await Ne(), new Promise((r2, i2) => {
      Te.set(e2.id, {
        resolve: (e3) => r2(e3),
        reject: i2,
        onEvent: t2
      }), n2.postMessage(e2);
    });
  }
  var Fe = Object.defineProperty, Ie = (e2, t2, n2) => t2 in e2 ? Fe(e2, t2, {
    enumerable: true,
    configurable: true,
    writable: true,
    value: n2
  }) : e2[t2] = n2, I = (e2, t2, n2) => Ie(e2, typeof t2 == `symbol` ? t2 : t2 + ``, n2), Le = 1, Re = null, ze = null;
  function Be(e2) {
    return typeof e2 == `bigint` ? Number(e2) : e2;
  }
  function R(e2) {
    return globalThis.BigInt(e2);
  }
  function Ve(e2) {
    return new Uint8Array(new Int32Array(e2).buffer);
  }
  function He(e2) {
    return new BigInt64Array(e2.map((e3) => R(e3)));
  }
  function Ue(e2) {
    return new TextEncoder().encode(`${e2}\0`);
  }
  function We() {
    return typeof globalThis.Deno < `u`;
  }
  function Ge() {
    return typeof window < `u` && typeof document < `u`;
  }
  function Ke() {
    return !We() && !Ge();
  }
  function qe() {
    return !Ee();
  }
  async function Je() {
    return Re ??= he(), ze = await Re, ze;
  }
  function Ye() {
    if (!ze) throw Error(`Routing API is not initialized. Call await initRouting() before constructing routing objects.`);
    return ze;
  }
  async function Xe() {
    qe() && await Je();
  }
  var z = ((e2) => (e2[e2.UNSET = 0] = `UNSET`, e2[e2.AUTOMATIC = 15] = `AUTOMATIC`, e2[e2.PATH_CHEAPEST_ARC = 3] = `PATH_CHEAPEST_ARC`, e2[e2.PATH_MOST_CONSTRAINED_ARC = 4] = `PATH_MOST_CONSTRAINED_ARC`, e2[e2.EVALUATOR_STRATEGY = 5] = `EVALUATOR_STRATEGY`, e2[e2.SAVINGS = 10] = `SAVINGS`, e2[e2.SWEEP = 11] = `SWEEP`, e2[e2.CHRISTOFIDES = 13] = `CHRISTOFIDES`, e2[e2.ALL_UNPERFORMED = 6] = `ALL_UNPERFORMED`, e2[e2.BEST_INSERTION = 7] = `BEST_INSERTION`, e2[e2.PARALLEL_CHEAPEST_INSERTION = 8] = `PARALLEL_CHEAPEST_INSERTION`, e2[e2.SEQUENTIAL_CHEAPEST_INSERTION = 14] = `SEQUENTIAL_CHEAPEST_INSERTION`, e2[e2.LOCAL_CHEAPEST_INSERTION = 9] = `LOCAL_CHEAPEST_INSERTION`, e2[e2.LOCAL_CHEAPEST_COST_INSERTION = 16] = `LOCAL_CHEAPEST_COST_INSERTION`, e2[e2.GLOBAL_CHEAPEST_ARC = 1] = `GLOBAL_CHEAPEST_ARC`, e2[e2.LOCAL_CHEAPEST_ARC = 2] = `LOCAL_CHEAPEST_ARC`, e2[e2.FIRST_UNBOUND_MIN_VALUE = 12] = `FIRST_UNBOUND_MIN_VALUE`, e2))(z || {});
  function Ze() {
    return {};
  }
  var Qe = class {
    constructor(e2 = 0, t2 = 0) {
      I(this, `bound`, e2), I(this, `cost`, t2);
    }
  };
  function $e(e2) {
    return typeof e2 == `object` && !!e2 && e2.kind === `routingVehicleVar` && typeof e2.index == `number`;
  }
  function et(e2) {
    return typeof e2 == `object` && !!e2 && e2.kind === `routingCumulVar` && typeof e2.dimensionName == `string` && typeof e2.index == `number`;
  }
  function tt(e2) {
    return typeof e2 == `object` && !!e2 && e2.type === `routingVehicleEquality` && $e(e2.left) && $e(e2.right);
  }
  function nt(e2) {
    return typeof e2 == `object` && !!e2 && e2.type === `routingCumulLessOrEqual` && et(e2.left) && et(e2.right);
  }
  var rt = class {
    constructor(e2, t2, n2, r2) {
      if (I(this, `ready`, Promise.resolve()), I(this, `module`, null), I(this, `handle`, 0), I(this, `indexToNodeMap`, []), I(this, `nodeToIndexMap`, /* @__PURE__ */ new Map()), I(this, `startIndices`, []), I(this, `endIndices`, []), I(this, `numLocations`), I(this, `numVehicles`), I(this, `starts`), I(this, `ends`), this.numLocations = e2, this.numVehicles = t2, Array.isArray(n2)) {
        if (!Array.isArray(r2)) throw Error(`RoutingIndexManager: starts and ends arrays must both be provided.`);
        if (n2.length !== t2 || r2.length !== t2) throw Error(`RoutingIndexManager: starts and ends arrays must match numVehicles.`);
        this.starts = [
          ...n2
        ], this.ends = [
          ...r2
        ];
      } else this.starts = Array.from({
        length: t2
      }, () => n2), this.ends = Array.from({
        length: t2
      }, () => n2);
      if (this.createSyntheticIndexMapping(), qe() && (this.module = Ye(), this.handle = Array.isArray(n2) ? this.createStartsEndsManager(this.starts, this.ends) : this.module._routing_create_index_manager(this.numLocations, this.numVehicles, n2), this.handle === 0)) throw Error(`RoutingIndexManager: failed to create native manager.`);
    }
    get depot() {
      return this.starts[0];
    }
    get nativeHandle() {
      if (this.handle === 0) throw Error(`RoutingIndexManager: native manager is not ready or was deleted.`);
      return this.handle;
    }
    async indexToNode(e2) {
      return await this.ready, this.indexToNodeSync(e2);
    }
    indexToNodeSync(e2) {
      if (!this.module) {
        let t2 = this.indexToNodeMap[e2];
        if (t2 === void 0) throw Error(`RoutingIndexManager.IndexToNode: index ${e2} is out of range.`);
        return t2;
      }
      return Be(this.module._routing_manager_index_to_node(this.nativeHandle, R(e2)));
    }
    IndexToNode(e2) {
      return this.indexToNodeSync(e2);
    }
    async nodeToIndex(e2) {
      return await this.ready, this.nodeToIndexSync(e2);
    }
    nodeToIndexSync(e2) {
      return this.module ? Be(this.module._routing_manager_node_to_index(this.nativeHandle, e2)) : this.nodeToIndexMap.get(e2) ?? -1;
    }
    NodeToIndex(e2) {
      return this.nodeToIndexSync(e2);
    }
    GetNumberOfNodes() {
      return this.module ? this.module._routing_manager_num_nodes(this.nativeHandle) : this.numLocations;
    }
    GetNumberOfVehicles() {
      return this.module ? this.module._routing_manager_num_vehicles(this.nativeHandle) : this.numVehicles;
    }
    GetNumberOfIndices() {
      return this.module ? this.module._routing_manager_num_indices(this.nativeHandle) : this.indexToNodeMap.length;
    }
    GetStartIndex(e2) {
      return this.module ? Be(this.module._routing_manager_start_index(this.nativeHandle, e2)) : this.startIndices[e2];
    }
    GetEndIndex(e2) {
      return this.module ? Be(this.module._routing_manager_end_index(this.nativeHandle, e2)) : this.endIndices[e2];
    }
    delete() {
      this.module && this.handle !== 0 && (this.module._routing_delete_index_manager(this.handle), this.handle = 0);
    }
    createStartsEndsManager(e2, t2) {
      if (!this.module) throw Error(`RoutingIndexManager: native module is not available.`);
      let n2 = Int32Array.BYTES_PER_ELEMENT * this.numVehicles, r2 = this.module._malloc(n2), i2 = this.module._malloc(n2);
      try {
        return this.module.HEAPU8.set(Ve(e2), r2), this.module.HEAPU8.set(Ve(t2), i2), this.module._routing_create_index_manager_starts_ends(this.numLocations, this.numVehicles, r2, i2);
      } finally {
        this.module._free(r2), this.module._free(i2);
      }
    }
    createSyntheticIndexMapping() {
      for (let e3 = 0; e3 < this.numLocations; e3++) this.nodeToIndexMap.set(e3, e3), this.indexToNodeMap[e3] = e3;
      let e2 = /* @__PURE__ */ new Set(), t2 = (t3) => {
        if (!e2.has(t3)) return e2.add(t3), t3;
        let n2 = this.indexToNodeMap.length;
        return this.indexToNodeMap.push(t3), n2;
      };
      for (let e3 of this.starts) this.startIndices.push(t2(e3));
      for (let e3 of this.ends) this.endIndices.push(t2(e3));
    }
  }, it = class {
    constructor(e2, t2) {
      I(this, `routing`, e2), I(this, `name`, t2), I(this, `softSpanUpperBounds`, /* @__PURE__ */ new Map()), I(this, `quadraticCostSoftSpanUpperBounds`, /* @__PURE__ */ new Map());
    }
    CumulVar(e2) {
      return {
        kind: `routingCumulVar`,
        dimensionName: this.name,
        index: e2
      };
    }
    HasSoftSpanUpperBounds() {
      return this.routing.hasNativeModule() ? this.routing.withCString(this.name, (e2) => this.routing.moduleRef._routing_dimension_has_soft_span_upper_bounds(this.routing.nativeHandle, e2) === 1) : this.softSpanUpperBounds.size > 0;
    }
    SetSoftSpanUpperBoundForVehicle(e2, t2) {
      if (!this.routing.hasNativeModule()) {
        this.softSpanUpperBounds.set(t2, new Qe(e2.bound, e2.cost));
        return;
      }
      this.routing.withCString(this.name, (n2) => {
        this.routing.moduleRef._routing_dimension_set_soft_span_upper_bound(this.routing.nativeHandle, n2, R(e2.bound), R(e2.cost), t2);
      });
    }
    GetSoftSpanUpperBoundForVehicle(e2) {
      return this.routing.hasNativeModule() ? this.routing.withCString(this.name, (t2) => new Qe(Be(this.routing.moduleRef._routing_dimension_get_soft_span_upper_bound_bound(this.routing.nativeHandle, t2, e2)), Be(this.routing.moduleRef._routing_dimension_get_soft_span_upper_bound_cost(this.routing.nativeHandle, t2, e2)))) : this.softSpanUpperBounds.get(e2) ?? new Qe(0, 0);
    }
    HasQuadraticCostSoftSpanUpperBounds() {
      return this.routing.hasNativeModule() ? this.routing.withCString(this.name, (e2) => this.routing.moduleRef._routing_dimension_has_quadratic_cost_soft_span_upper_bounds(this.routing.nativeHandle, e2) === 1) : this.quadraticCostSoftSpanUpperBounds.size > 0;
    }
    SetQuadraticCostSoftSpanUpperBoundForVehicle(e2, t2) {
      if (!this.routing.hasNativeModule()) {
        this.quadraticCostSoftSpanUpperBounds.set(t2, new Qe(e2.bound, e2.cost));
        return;
      }
      this.routing.withCString(this.name, (n2) => {
        this.routing.moduleRef._routing_dimension_set_quadratic_cost_soft_span_upper_bound(this.routing.nativeHandle, n2, R(e2.bound), R(e2.cost), t2);
      });
    }
    GetQuadraticCostSoftSpanUpperBoundForVehicle(e2) {
      return this.routing.hasNativeModule() ? this.routing.withCString(this.name, (t2) => new Qe(Be(this.routing.moduleRef._routing_dimension_get_quadratic_cost_soft_span_upper_bound_bound(this.routing.nativeHandle, t2, e2)), Be(this.routing.moduleRef._routing_dimension_get_quadratic_cost_soft_span_upper_bound_cost(this.routing.nativeHandle, t2, e2)))) : this.quadraticCostSoftSpanUpperBounds.get(e2) ?? new Qe(0, 0);
    }
  }, at = class {
    constructor(e2, t2 = null) {
      I(this, `routing`, e2), I(this, `workerResult`, t2);
    }
    ObjectiveValue() {
      return this.workerResult?.objectiveValue ?? this.routing.assignmentObjectiveValue();
    }
    Value(e2) {
      return typeof e2 == `object` ? this.workerResult ? this.workerResult.dimensionCumulValues[e2.dimensionName]?.[e2.index] ?? 0 : this.routing.dimensionCumulValue(e2.dimensionName, e2.index) : this.workerResult?.nextValues[e2] ?? this.routing.nextValue(e2);
    }
    Min(e2) {
      return this.Value(e2);
    }
  }, ot = class {
    constructor(e2, t2) {
      if (I(this, `manager`, e2), I(this, `ready`, Promise.resolve()), I(this, `module`, null), I(this, `handle`, 0), I(this, `callbackIds`, /* @__PURE__ */ new Set()), I(this, `transitCallbacks`, /* @__PURE__ */ new Map()), I(this, `arcCostEvaluatorIndex`, null), I(this, `lastWorkerResult`, null), I(this, `evaluatorCallbacks`, /* @__PURE__ */ new Map()), I(this, `nextWorkerEvaluatorIndex`, 1), I(this, `operations`, []), I(this, `dimensionNames`, /* @__PURE__ */ new Set()), I(this, `atSolutionCallbacks`, []), I(this, `lastObjectiveValue`, 0), I(this, `lastWorkerStatus`, null), I(this, `parameters`), this.parameters = t2, qe() && (this.module = Ye(), this.handle = this.module._routing_create_model(this.manager.nativeHandle), this.handle === 0)) throw Error(`RoutingModel: failed to create native model.`);
    }
    static setWorkerBridgeEnabled(e2) {
      Oe(e2);
    }
    static isWorkerBridgeEnabled() {
      return De();
    }
    RegisterTransitCallback(e2) {
      var t2;
      if (!this.module) {
        let t3 = this.nextWorkerEvaluatorIndex++;
        return this.transitCallbacks.set(t3, e2), this.callbackIds.add(t3), this.evaluatorCallbacks.set(t3, e2), t3;
      }
      (t2 = this.module).__routingTransitCallbacks ?? (t2.__routingTransitCallbacks = /* @__PURE__ */ new Map());
      let n2 = Le++;
      this.module.__routingTransitCallbacks.set(n2, e2), this.transitCallbacks.set(n2, e2), this.callbackIds.add(n2);
      let r2 = this.module._routing_register_transit_callback(this.handle, n2);
      if (r2 < 0) throw this.module.__routingTransitCallbacks.delete(n2), this.transitCallbacks.delete(n2), this.callbackIds.delete(n2), Error(`RoutingModel.RegisterTransitCallback: failed to register callback.`);
      return this.evaluatorCallbacks.set(r2, e2), r2;
    }
    SetArcCostEvaluatorOfAllVehicles(e2) {
      this.arcCostEvaluatorIndex = e2, this.module && this.module._routing_set_arc_cost_evaluator_of_all_vehicles(this.handle, e2);
    }
    async solveWithWorkerRequest(e2) {
      let t2 = await Pe({
        type: `routingSolve`,
        id: ke(),
        numLocations: this.manager.numLocations,
        numVehicles: this.manager.numVehicles,
        starts: this.manager.starts,
        ends: this.manager.ends,
        firstSolutionStrategy: e2.firstSolutionStrategy ?? 0,
        solutionLimit: e2.solution_limit ?? 0,
        transitMatrix: this.buildTransitMatrix(),
        transitMatrixDimension: this.manager.GetNumberOfIndices(),
        operations: this.operations,
        dimensionNames: [
          ...this.dimensionNames
        ]
      });
      if (this.lastWorkerResult = t2.result, this.lastWorkerStatus = t2.result?.status ?? null, !t2.result) return null;
      let n2 = new at(this, t2.result);
      return this.lastObjectiveValue = n2.ObjectiveValue(), this.runAtSolutionCallbacks(), n2;
    }
    async SolveWithParameters(e2 = Ze()) {
      if (Ee()) return this.solveWithWorkerRequest(e2);
      if (!this.module) throw Error(`RoutingModel.SolveWithParameters: native routing module is not available.`);
      if (this.installMatrixEvaluator(), this.lastWorkerResult = null, this.lastWorkerStatus = null, await this.module.ccall(`routing_solve_with_parameters_ext`, `number`, [
        `number`,
        `number`,
        `number`
      ], [
        this.handle,
        e2.firstSolutionStrategy ?? 0,
        e2.solution_limit ?? 0
      ], {
        async: true
      }) !== 1) return null;
      let t2 = new at(this);
      return this.lastObjectiveValue = t2.ObjectiveValue(), this.runAtSolutionCallbacks(), t2;
    }
    async Solve() {
      return this.SolveWithParameters(Ze());
    }
    solveWithParametersSync(e2 = Ze()) {
      if (!this.module) throw Error(`RoutingModel.solveWithParametersSync is not available in worker bridge mode.`);
      if (this.installMatrixEvaluator(), this.lastWorkerResult = null, this.lastWorkerStatus = null, this.module._routing_solve_with_parameters_ext(this.handle, e2.firstSolutionStrategy ?? 0, e2.solution_limit ?? 0) !== 1) return null;
      let t2 = new at(this);
      return this.lastObjectiveValue = t2.ObjectiveValue(), this.runAtSolutionCallbacks(), t2;
    }
    status() {
      return this.lastWorkerStatus === null ? this.module ? this.module._routing_status(this.handle) : 0 : this.lastWorkerStatus;
    }
    vehicles() {
      return this.manager.GetNumberOfVehicles();
    }
    Start(e2) {
      return this.lastWorkerResult?.starts[e2] === void 0 ? this.module ? Be(this.module._routing_start(this.handle, e2)) : this.manager.GetStartIndex(e2) : this.lastWorkerResult.starts[e2];
    }
    End(e2) {
      return this.lastWorkerResult?.ends[e2] === void 0 ? this.module ? Be(this.module._routing_end(this.handle, e2)) : this.manager.GetEndIndex(e2) : this.lastWorkerResult.ends[e2];
    }
    IsEnd(e2) {
      return this.lastWorkerResult ? this.lastWorkerResult.ends.includes(e2) : this.module ? this.module._routing_is_end(this.handle, R(e2)) === 1 : this.manager.ends.some((t2, n2) => this.manager.GetEndIndex(n2) === e2);
    }
    RegisterTransitMatrix(e2) {
      return this.RegisterTransitCallback((t2, n2) => {
        let r2 = this.manager.IndexToNode(t2), i2 = this.manager.IndexToNode(n2);
        return e2[r2][i2];
      });
    }
    RegisterUnaryTransitCallback(e2) {
      return this.RegisterTransitCallback((t2) => e2(t2));
    }
    RegisterUnaryTransitVector(e2) {
      return this.RegisterUnaryTransitCallback((t2) => e2[this.manager.IndexToNode(t2)]);
    }
    AddDimension(e2, t2, n2, r2, i2) {
      if (!this.module) return this.dimensionNames.add(i2), this.operations.push({
        type: `addDimension`,
        transitMatrix: this.buildTransitMatrixForEvaluator(e2),
        slackMax: t2,
        capacity: n2,
        fixStartCumulToZero: r2,
        name: i2
      }), true;
      let a2 = this.withCString(i2, (i3) => this.moduleRef._routing_add_dimension(this.handle, e2, R(t2), R(n2), +!!r2, i3) === 1);
      return a2 && (this.dimensionNames.add(i2), this.operations.push({
        type: `addDimension`,
        transitMatrix: this.buildTransitMatrixForEvaluator(e2),
        slackMax: t2,
        capacity: n2,
        fixStartCumulToZero: r2,
        name: i2
      })), a2;
    }
    AddDimensionWithVehicleCapacity(e2, t2, n2, r2, i2) {
      if (!this.module) return this.dimensionNames.add(i2), this.operations.push({
        type: `addDimensionWithVehicleCapacity`,
        transitMatrix: this.buildTransitMatrixForEvaluator(e2),
        slackMax: t2,
        capacities: n2,
        fixStartCumulToZero: r2,
        name: i2
      }), true;
      let a2 = He(n2), o2 = new Uint8Array(a2.buffer, a2.byteOffset, a2.byteLength), s2 = this.module._malloc(o2.byteLength);
      this.module.HEAPU8.set(o2, s2);
      try {
        let o3 = this.withCString(i2, (n3) => this.moduleRef._routing_add_dimension_with_vehicle_capacity(this.handle, e2, R(t2), s2, a2.length, +!!r2, n3) === 1);
        return o3 && (this.dimensionNames.add(i2), this.operations.push({
          type: `addDimensionWithVehicleCapacity`,
          transitMatrix: this.buildTransitMatrixForEvaluator(e2),
          slackMax: t2,
          capacities: n2,
          fixStartCumulToZero: r2,
          name: i2
        })), o3;
      } finally {
        this.module._free(s2);
      }
    }
    AddDimensionWithVehicleTransits(e2, t2, n2, r2, i2) {
      if (!this.module) {
        let a3 = Array.isArray(e2) ? e2 : [
          e2
        ];
        return this.dimensionNames.add(i2), this.operations.push({
          type: `addDimensionWithVehicleTransits`,
          transitMatrices: a3.map((e3) => this.buildTransitMatrixForEvaluator(e3)),
          slackMax: t2,
          capacity: n2,
          fixStartCumulToZero: r2,
          name: i2
        }), true;
      }
      let a2 = Ve(e2), o2 = this.module._malloc(a2.byteLength);
      this.module.HEAPU8.set(a2, o2);
      try {
        let a3 = this.withCString(i2, (i3) => this.moduleRef._routing_add_dimension_with_vehicle_transits(this.handle, o2, e2.length, R(t2), R(n2), +!!r2, i3) === 1);
        return a3 && (this.dimensionNames.add(i2), this.operations.push({
          type: `addDimensionWithVehicleTransits`,
          transitMatrices: e2.map((e3) => this.buildTransitMatrixForEvaluator(e3)),
          slackMax: t2,
          capacity: n2,
          fixStartCumulToZero: r2,
          name: i2
        })), a3;
      } finally {
        this.module._free(o2);
      }
    }
    AddConstantDimension(e2, t2, n2, r2) {
      if (!this.module) return this.dimensionNames.add(r2), this.operations.push({
        type: `addConstantDimension`,
        value: e2,
        capacity: t2,
        fixStartCumulToZero: n2,
        name: r2
      }), [
        this.nextWorkerEvaluatorIndex++,
        true
      ];
      let i2 = this.withCString(r2, (r3) => this.moduleRef._routing_add_constant_dimension(this.handle, R(e2), R(t2), +!!n2, r3)), a2 = i2 >= 0;
      return a2 && (this.dimensionNames.add(r2), this.operations.push({
        type: `addConstantDimension`,
        value: e2,
        capacity: t2,
        fixStartCumulToZero: n2,
        name: r2
      })), [
        i2,
        a2
      ];
    }
    AddVectorDimension(e2, t2, n2, r2) {
      if (!this.module) return this.dimensionNames.add(r2), this.operations.push({
        type: `addVectorDimension`,
        values: e2,
        capacity: t2,
        fixStartCumulToZero: n2,
        name: r2
      }), [
        this.nextWorkerEvaluatorIndex++,
        true
      ];
      let i2 = He(e2), a2 = new Uint8Array(i2.buffer, i2.byteOffset, i2.byteLength), o2 = this.module._malloc(a2.byteLength);
      this.module.HEAPU8.set(a2, o2);
      try {
        let a3 = this.withCString(r2, (e3) => this.moduleRef._routing_add_vector_dimension(this.handle, o2, i2.length, R(t2), +!!n2, e3)), s2 = a3 >= 0;
        return s2 && (this.dimensionNames.add(r2), this.operations.push({
          type: `addVectorDimension`,
          values: e2,
          capacity: t2,
          fixStartCumulToZero: n2,
          name: r2
        })), [
          a3,
          s2
        ];
      } finally {
        this.module._free(o2);
      }
    }
    AddMatrixDimension(e2, t2, n2, r2) {
      if (!this.module) return this.dimensionNames.add(r2), this.operations.push({
        type: `addMatrixDimension`,
        matrix: e2,
        capacity: t2,
        fixStartCumulToZero: n2,
        name: r2
      }), [
        this.nextWorkerEvaluatorIndex++,
        true
      ];
      let i2 = He(e2.flat()), a2 = new Uint8Array(i2.buffer, i2.byteOffset, i2.byteLength), o2 = this.module._malloc(a2.byteLength);
      this.module.HEAPU8.set(a2, o2);
      try {
        let a3 = this.withCString(r2, (r3) => this.moduleRef._routing_add_matrix_dimension(this.handle, o2, i2.length, e2.length, R(t2), +!!n2, r3)), s2 = a3 >= 0;
        return s2 && (this.dimensionNames.add(r2), this.operations.push({
          type: `addMatrixDimension`,
          matrix: e2,
          capacity: t2,
          fixStartCumulToZero: n2,
          name: r2
        })), [
          a3,
          s2
        ];
      } finally {
        this.module._free(o2);
      }
    }
    GetDimensionOrDie(e2) {
      if (!this.module) {
        if (!this.dimensionNames.has(e2)) throw Error(`RoutingModel.GetDimensionOrDie: unknown dimension '${e2}'.`);
        return new it(this, e2);
      }
      if (!this.withCString(e2, (e3) => this.moduleRef._routing_has_dimension(this.handle, e3) === 1)) throw Error(`RoutingModel.GetDimensionOrDie: unknown dimension '${e2}'.`);
      return new it(this, e2);
    }
    AddDisjunction(e2, t2) {
      if (!this.module) return this.operations.push({
        type: `addDisjunction`,
        indices: e2,
        penalty: t2
      }), this.operations.length - 1;
      let n2 = He(e2), r2 = new Uint8Array(n2.buffer, n2.byteOffset, n2.byteLength), i2 = this.module._malloc(r2.byteLength);
      this.module.HEAPU8.set(r2, i2);
      try {
        let r3 = this.module._routing_add_disjunction(this.handle, i2, n2.length, R(t2 ?? 0), t2 === void 0 ? 0 : 1);
        return this.operations.push({
          type: `addDisjunction`,
          indices: e2,
          penalty: t2
        }), r3;
      } finally {
        this.module._free(i2);
      }
    }
    CloseModelWithParameters(e2) {
      this.module && this.module._routing_close_model_with_parameters(this.handle, e2.firstSolutionStrategy ?? 0, e2.solution_limit ?? 0);
    }
    GetNumberOfDecisionsInFirstSolution(e2) {
      if (!this.module) return e2.firstSolutionStrategy === 10 ? this.manager.GetNumberOfIndices() : 0;
      let t2 = Be(this.module._routing_get_number_of_decisions_in_first_solution(this.handle, e2.firstSolutionStrategy ?? 0, e2.solution_limit ?? 0));
      return t2 === 0 && e2.firstSolutionStrategy === 10 ? this.manager.GetNumberOfIndices() : t2;
    }
    GetNumberOfRejectsInFirstSolution(e2) {
      return this.module ? Be(this.module._routing_get_number_of_rejects_in_first_solution(this.handle, e2.firstSolutionStrategy ?? 0, e2.solution_limit ?? 0)) : 0;
    }
    async SolveFromAssignmentWithParameters(e2, t2) {
      if (!this.module) return this.lastObjectiveValue = e2.ObjectiveValue(), this.runAtSolutionCallbacks(), e2;
      if (await this.module.ccall(`routing_solve_from_assignment_with_parameters`, `number`, [
        `number`,
        `number`,
        `number`
      ], [
        this.handle,
        t2.firstSolutionStrategy ?? 0,
        t2.solution_limit ?? 0
      ], {
        async: true
      }) !== 1) return e2;
      let n2 = new at(this);
      return this.lastObjectiveValue = n2.ObjectiveValue(), this.runAtSolutionCallbacks(), n2;
    }
    ReadAssignmentFromRoutes(e2, t2) {
      if (!this.module) {
        let n3 = this.workerResultFromRoutes(e2, t2);
        return this.lastWorkerResult = n3, this.lastWorkerStatus = 1, this.lastObjectiveValue = n3.objectiveValue, new at(this, n3);
      }
      let n2 = e2.map((e3) => e3.length), r2 = He(e2.flat()), i2 = new Uint8Array(r2.buffer, r2.byteOffset, r2.byteLength), a2 = Ve(n2), o2 = this.module._malloc(i2.byteLength), s2 = this.module._malloc(a2.byteLength);
      this.module.HEAPU8.set(i2, o2), this.module.HEAPU8.set(a2, s2);
      try {
        if (this.module._routing_read_assignment_from_routes(this.handle, o2, s2, e2.length, +!!t2) !== 1) throw Error(`RoutingModel.ReadAssignmentFromRoutes: failed to read assignment.`);
        return new at(this);
      } finally {
        this.module._free(o2), this.module._free(s2);
      }
    }
    GetAutomaticFirstSolutionStrategy() {
      if (!this.module) return this.operations.some((e3) => e3.type === `addPickupAndDelivery`) ? 8 : 3;
      let e2 = this.module._routing_get_automatic_first_solution_strategy(this.handle);
      return e2 === 0 ? this.operations.some((e3) => e3.type === `addPickupAndDelivery`) ? 8 : 3 : e2;
    }
    AddPickupAndDelivery(e2, t2) {
      if (!this.module) {
        this.operations.push({
          type: `addPickupAndDelivery`,
          pickup: e2,
          delivery: t2
        });
        return;
      }
      this.module._routing_add_pickup_and_delivery(this.handle, R(e2), R(t2)), this.operations.push({
        type: `addPickupAndDelivery`,
        pickup: e2,
        delivery: t2
      });
    }
    AddAtSolutionCallback(e2) {
      this.atSolutionCallbacks.push(typeof e2 == `function` ? e2 : () => e2.__call__());
    }
    CostVar() {
      return {
        Max: () => this.lastObjectiveValue
      };
    }
    solver() {
      return {
        Parameters: () => ({
          trace_propagation: this.parameters?.solver_parameters.trace_propagation ?? false
        }),
        LocalSearchProfile: () => `Local search profile is not exposed by the wasm bridge.`,
        Add: (...e2) => {
          for (let t2 of e2) this.addSolverConstraint(t2);
        }
      };
    }
    NextVar(e2) {
      return e2;
    }
    VehicleVar(e2) {
      return {
        kind: `routingVehicleVar`,
        index: e2
      };
    }
    addSolverConstraint(e2) {
      if (this.module) {
        if (tt(e2)) {
          if (this.module._routing_add_vehicle_equality_constraint(this.handle, R(e2.left.index), R(e2.right.index)) !== 1) throw Error(`RoutingModel.solver().Add: failed to add vehicle equality constraint.`);
          return;
        }
        if (nt(e2)) {
          if (e2.left.dimensionName !== e2.right.dimensionName) throw Error(`RoutingModel.solver().Add: cumul precedence constraints require the same dimension.`);
          if (this.withCString(e2.left.dimensionName, (t2) => this.moduleRef._routing_add_dimension_cumul_less_or_equal_constraint(this.handle, t2, R(e2.left.index), R(e2.right.index))) !== 1) throw Error(`RoutingModel.solver().Add: failed to add cumul precedence constraint.`);
        }
      }
    }
    GetArcCostForVehicle(e2, t2, n2) {
      if (this.lastWorkerResult) {
        let n3 = this.manager.GetNumberOfIndices(), r2 = this.buildTransitMatrix();
        return Number(r2[e2 * n3 + t2]);
      }
      if (!this.module) {
        let n3 = this.manager.GetNumberOfIndices(), r2 = this.buildTransitMatrix();
        return Number(r2[e2 * n3 + t2]);
      }
      return Be(this.module._routing_get_arc_cost_for_vehicle(this.handle, R(e2), R(t2), n2));
    }
    assignmentObjectiveValue() {
      return this.module ? Be(this.module._routing_assignment_objective_value(this.handle)) : this.lastObjectiveValue;
    }
    nextValue(e2) {
      return this.lastWorkerResult ? this.lastWorkerResult.nextValues[e2] : this.module ? Be(this.module._routing_next_value(this.handle, R(e2))) : e2;
    }
    dimensionCumulValue(e2, t2) {
      return this.module ? this.withCString(e2, (e3) => Be(this.moduleRef._routing_assignment_dimension_cumul_value(this.handle, e3, R(t2)))) : this.lastWorkerResult?.dimensionCumulValues[e2]?.[t2] ?? 0;
    }
    delete() {
      for (let e2 of this.callbackIds) this.module?.__routingTransitCallbacks?.delete(e2);
      this.transitCallbacks.clear(), this.callbackIds.clear(), this.handle !== 0 && (this.module && Ke() && this.module._routing_delete_model(this.handle), this.handle = 0);
    }
    callbackForEvaluator() {
      return this.arcCostEvaluatorIndex === null ? () => 0 : this.callbackForEvaluatorIndex(this.arcCostEvaluatorIndex);
    }
    callbackForEvaluatorIndex(e2) {
      let t2 = this.evaluatorCallbacks.get(e2);
      if (!t2) throw Error(`RoutingModel: evaluator ${e2} is unavailable.`);
      return t2;
    }
    buildTransitMatrix() {
      let e2 = this.callbackForEvaluator();
      return this.buildTransitMatrixFromCallback(e2);
    }
    buildTransitMatrixForEvaluator(e2) {
      return this.buildTransitMatrixFromCallback(this.callbackForEvaluatorIndex(e2));
    }
    buildTransitMatrixFromCallback(e2) {
      let t2 = this.manager.GetNumberOfIndices(), n2 = new BigInt64Array(t2 * t2);
      for (let r2 = 0; r2 < t2; r2++) for (let i2 = 0; i2 < t2; i2++) n2[r2 * t2 + i2] = R(e2(r2, i2));
      return n2;
    }
    workerResultFromRoutes(e2, t2) {
      let n2 = this.manager.GetNumberOfIndices(), r2 = Array.from({
        length: n2
      }, (e3, t3) => t3), i2 = Array.from({
        length: this.manager.numVehicles
      }, (e3, t3) => this.manager.GetStartIndex(t3)), a2 = Array.from({
        length: this.manager.numVehicles
      }, (e3, t3) => this.manager.GetEndIndex(t3)), o2 = this.buildTransitMatrix(), s2 = /* @__PURE__ */ new Set(), c2 = 0, l2 = (e3, t3) => Number(o2[e3 * n2 + t3]), u2 = (e3, t3) => {
        if (!Number.isInteger(e3) || e3 < 0 || e3 >= n2) throw Error(`RoutingModel.ReadAssignmentFromRoutes: ${t3} index ${e3} is out of range.`);
        if (a2.includes(e3)) throw Error(`RoutingModel.ReadAssignmentFromRoutes: ${t3} index ${e3} is an end index.`);
        if (s2.has(e3)) throw Error(`RoutingModel.ReadAssignmentFromRoutes: ${t3} index ${e3} is duplicated.`);
        s2.add(e3);
      };
      for (let t3 = 0; t3 < i2.length; t3++) {
        let n3 = e2[t3] ?? [], o3 = i2[t3];
        for (let [e3, i3] of n3.entries()) u2(i3, `vehicle ${t3} route position ${e3}`), r2[o3] = i3, c2 += l2(o3, i3), o3 = i3;
        r2[o3] = a2[t3], c2 += l2(o3, a2[t3]);
      }
      if (!t2) for (let e3 = 0; e3 < n2; e3++) {
        if (i2.includes(e3) || a2.includes(e3) || s2.has(e3)) continue;
        let t3 = this.manager.IndexToNode(e3);
        if (this.manager.NodeToIndex(t3) === e3) throw Error(`RoutingModel.ReadAssignmentFromRoutes: node ${t3} is not assigned to any route.`);
      }
      return {
        status: 1,
        objectiveValue: c2,
        nextValues: r2,
        starts: i2,
        ends: a2,
        dimensionCumulValues: {}
      };
    }
    get moduleRef() {
      if (!this.module) throw Error(`RoutingModel: native routing module is not available in worker bridge mode.`);
      return this.module;
    }
    get nativeHandle() {
      return this.handle;
    }
    hasNativeModule() {
      return this.module !== null;
    }
    withCString(e2, t2) {
      if (!this.module) throw Error(`RoutingModel: native routing module is not available in worker bridge mode.`);
      let n2 = Ue(e2), r2 = this.module._malloc(n2.byteLength);
      this.module.HEAPU8.set(n2, r2);
      try {
        return t2(r2);
      } finally {
        this.module._free(r2);
      }
    }
    installMatrixEvaluator() {
      if (!this.module) return;
      let e2 = this.buildTransitMatrix(), t2 = new Uint8Array(e2.buffer, e2.byteOffset, e2.byteLength), n2 = this.module._malloc(t2.byteLength);
      this.module.HEAPU8.set(t2, n2);
      try {
        let t3 = this.module._routing_register_matrix_transit_callback(this.handle, n2, e2.length, this.manager.GetNumberOfIndices());
        if (t3 < 0) throw Error(`RoutingModel.SolveWithParameters: failed to register transit matrix.`);
        this.module._routing_set_arc_cost_evaluator_of_all_vehicles(this.handle, t3);
      } finally {
        this.module._free(n2);
      }
    }
    runAtSolutionCallbacks() {
      for (let e2 of this.atSolutionCallbacks) e2();
    }
  }, st = 1e7, ct = 1e9, lt = null;
  function ut() {
    return lt ||= (async () => {
      if (typeof window < `u` && window.crossOriginIsolated === false) throw Error(`This browser could not enable the isolation the optimizer needs. Please use the latest Chrome or Edge (or reload once).`);
      Oe(false), await Xe();
    })().catch((e2) => {
      throw lt = null, e2;
    }), lt;
  }
  async function dt(e2, { startNode: t2, endNode: n2, k: r2 }) {
    let i2 = e2.length;
    if (i2 < 2) throw Error(`Need at least two points to build a route.`);
    let a2 = i2, o2 = i2 + 1, s2 = i2 + 2, c2 = Math.max(0, Math.floor(r2)), l2 = (e3) => e3 === t2 || e3 === n2, u2 = (r3, s3) => r3 < i2 && s3 < i2 ? e2[r3][s3] : r3 === a2 ? s3 < i2 && (t2 === null || s3 === t2) ? 0 : ct : s3 === o2 && r3 < i2 && (n2 === null || r3 === n2) ? 0 : ct;
    await ut(), await new Promise((e3) => setTimeout(e3, 0));
    let d2 = new rt(s2, 1, [
      a2
    ], [
      o2
    ]), f2 = new ot(d2);
    try {
      let e3 = f2.RegisterTransitCallback((e4, t4) => u2(d2.IndexToNode(e4), d2.IndexToNode(t4)));
      f2.SetArcCostEvaluatorOfAllVehicles(e3);
      for (let e4 = 0; e4 < i2; e4++) l2(e4) || f2.AddDisjunction([
        d2.NodeToIndex(e4)
      ], st);
      let t3 = f2.RegisterUnaryTransitCallback((e4) => {
        let t4 = d2.IndexToNode(e4);
        return t4 >= i2 ? 0 : +!l2(t4);
      });
      f2.AddDimensionWithVehicleCapacity(t3, 0, [
        c2
      ], true, `StopCounter`);
      let n3 = Ze();
      n3.firstSolutionStrategy = z.PATH_CHEAPEST_ARC;
      let r3 = await f2.SolveWithParameters(n3);
      if (!r3) throw Error(`OR-Tools could not find a feasible route.`);
      let a3 = [], o3 = f2.Start(0);
      for (; !f2.IsEnd(o3); ) {
        let e4 = d2.IndexToNode(o3);
        e4 < i2 && a3.push(e4), o3 = r3.Value(f2.NextVar(o3));
      }
      return a3;
    } finally {
      f2.delete(), d2.delete();
    }
  }
  var ft = 6371e3;
  function pt(e2) {
    return e2 * Math.PI / 180;
  }
  function mt(e2, t2) {
    let n2 = pt(t2.lat - e2.lat), r2 = pt(t2.lng - e2.lng), i2 = Math.sin(n2 / 2) ** 2 + Math.cos(pt(e2.lat)) * Math.cos(pt(t2.lat)) * Math.sin(r2 / 2) ** 2;
    return 2 * ft * Math.asin(Math.sqrt(i2));
  }
  var ht = (e2, t2) => e2.lat === t2.lat && e2.lng === t2.lng;
  async function gt({ startLocation: e2, endLocation: t2, waypoints: n2, targetK: r2, objective: i2, onStatus: a2 }) {
    let o2 = n2.filter((n3) => !(e2 && ht(n3, e2)) && !(t2 && ht(n3, t2))), s2 = [
      ...e2 ? [
        e2
      ] : [],
      ...o2,
      ...t2 ? [
        t2
      ] : []
    ];
    if (s2.length < 2) throw Error(`Add at least two points (upload a file, or set start/end).`);
    let c2 = e2 ? 0 : null, l2 = t2 ? s2.length - 1 : null, u2 = r2 ?? o2.length, d2 = (c2 === null ? 0 : 1) + (l2 === null ? 0 : 1);
    a2?.(`Fetching cost matrix\u2026`);
    let f2 = await M(s2, i2, (e3, t3) => {
      a2?.(t3 > 1 ? `Fetching cost matrix\u2026 ${e3}/${t3}` : `Fetching cost matrix\u2026`);
    });
    a2?.(`Optimizing route\u2026`);
    let p2 = await dt(f2, {
      startNode: c2,
      endNode: l2,
      k: u2
    }), m2 = p2.map((e3) => s2[e3]), h2 = 0;
    for (let e3 = 0; e3 < p2.length - 1; e3++) h2 += f2[p2[e3]][p2[e3 + 1]];
    a2?.(`Building road route\u2026`);
    try {
      let e3 = await N(m2);
      return {
        orderedWaypoints: m2,
        geometry: e3.geometry,
        distanceMeters: e3.distanceMeters,
        durationSeconds: e3.durationSeconds,
        candidatesVisited: m2.length - d2,
        candidatesTotal: o2.length,
        estimated: false
      };
    } catch {
      let e3 = 0;
      for (let t3 = 0; t3 < m2.length - 1; t3++) e3 += mt(m2[t3], m2[t3 + 1]);
      return {
        orderedWaypoints: m2,
        geometry: {
          type: `LineString`,
          coordinates: m2.map((e4) => [
            e4.lng,
            e4.lat
          ])
        },
        distanceMeters: i2 === `distance` ? h2 : e3,
        durationSeconds: i2 === `duration` ? h2 : e3 / 8,
        candidatesVisited: m2.length - d2,
        candidatesTotal: o2.length,
        estimated: true
      };
    }
  }
  var _t = () => typeof crypto < `u` && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2), vt = (e2) => e2.map((e3) => ({
    id: _t(),
    lat: e3.lat,
    lng: e3.lng,
    delivered: false
  })), B = w()(te((e2, t2) => ({
    startLocation: null,
    endLocation: null,
    waypoints: [],
    targetK: null,
    objective: `duration`,
    optimizedRoute: null,
    favorites: [],
    isCalculating: false,
    calcStatus: null,
    routeError: null,
    solverReady: false,
    solverWarning: null,
    setStart: (t3) => e2({
      startLocation: t3
    }),
    setEnd: (t3) => e2({
      endLocation: t3
    }),
    addWaypoints: (t3) => e2((e3) => ({
      waypoints: [
        ...e3.waypoints,
        ...vt(t3)
      ]
    })),
    removeWaypoint: (t3) => e2((e3) => ({
      waypoints: e3.waypoints.filter((e4) => e4.id !== t3)
    })),
    clearWaypoints: () => e2({
      waypoints: []
    }),
    markDelivered: (t3) => e2((e3) => ({
      waypoints: e3.waypoints.map((e4) => e4.id === t3 ? {
        ...e4,
        delivered: true
      } : e4)
    })),
    markDeliveredByCoord: (t3, n2) => e2((e3) => ({
      waypoints: e3.waypoints.map((e4) => e4.lat === t3 && e4.lng === n2 ? {
        ...e4,
        delivered: true
      } : e4)
    })),
    restoreStop: (t3) => e2((e3) => ({
      waypoints: e3.waypoints.map((e4) => e4.id === t3 ? {
        ...e4,
        delivered: false
      } : e4)
    })),
    restoreAll: () => e2((e3) => ({
      waypoints: e3.waypoints.map((e4) => e4.delivered ? {
        ...e4,
        delivered: false
      } : e4)
    })),
    setTargetK: (t3) => e2({
      targetK: t3
    }),
    setObjective: (t3) => e2({
      objective: t3
    }),
    resetAll: () => e2({
      startLocation: null,
      endLocation: null,
      waypoints: [],
      targetK: null,
      optimizedRoute: null,
      routeError: null
    }),
    warmUp: () => {
      typeof window < `u` && window.crossOriginIsolated ? ut().then(() => e2({
        solverReady: true
      })).catch((t3) => e2({
        solverWarning: t3.message
      })) : e2({
        solverWarning: `This browser did not enable the isolation the optimizer needs (SharedArrayBuffer). Please use the latest Chrome or Edge.`
      });
    },
    calculateRoute: async () => {
      let { startLocation: n2, endLocation: r2, waypoints: i2, targetK: a2, objective: o2 } = t2();
      e2({
        isCalculating: true,
        routeError: null,
        calcStatus: null
      });
      try {
        e2({
          optimizedRoute: await gt({
            startLocation: n2,
            endLocation: r2,
            waypoints: i2.filter((e3) => !e3.delivered),
            targetK: a2,
            objective: o2,
            onStatus: (t3) => e2({
              calcStatus: t3
            })
          }),
          solverReady: true
        });
      } catch (t3) {
        e2({
          optimizedRoute: null,
          routeError: t3.message
        });
      } finally {
        e2({
          isCalculating: false,
          calcStatus: null
        });
      }
    },
    saveFavorite: (t3) => e2((e3) => ({
      favorites: [
        ...e3.favorites,
        {
          id: _t(),
          name: t3.trim() || `Route ${e3.favorites.length + 1}`,
          startLocation: e3.startLocation,
          endLocation: e3.endLocation,
          waypoints: e3.waypoints.map((e4) => ({
            lat: e4.lat,
            lng: e4.lng
          }))
        }
      ]
    })),
    loadFavorite: (t3) => e2((e3) => {
      let n2 = e3.favorites.find((e4) => e4.id === t3);
      return n2 ? {
        startLocation: n2.startLocation,
        endLocation: n2.endLocation,
        waypoints: vt(n2.waypoints),
        optimizedRoute: null,
        routeError: null
      } : {};
    }),
    deleteFavorite: (t3) => e2((e3) => ({
      favorites: e3.favorites.filter((e4) => e4.id !== t3)
    }))
  }), {
    name: `route-optimiser:v2`,
    version: 1,
    migrate: (e2, t2) => {
      let n2 = e2;
      return t2 < 1 && Array.isArray(n2.waypoints) && (n2.waypoints = n2.waypoints.map((e3) => `id` in e3 && `delivered` in e3 ? e3 : {
        id: _t(),
        lat: e3.lat,
        lng: e3.lng,
        delivered: false
      })), e2;
    },
    partialize: (e2) => ({
      startLocation: e2.startLocation,
      endLocation: e2.endLocation,
      waypoints: e2.waypoints,
      targetK: e2.targetK,
      objective: e2.objective,
      optimizedRoute: e2.optimizedRoute,
      favorites: e2.favorites
    })
  })), yt = o(((e2) => {
    var t2 = /* @__PURE__ */ Symbol.for(`react.transitional.element`), n2 = /* @__PURE__ */ Symbol.for(`react.fragment`);
    function r2(e3, n3, r3) {
      var i2 = null;
      if (r3 !== void 0 && (i2 = `` + r3), n3.key !== void 0 && (i2 = `` + n3.key), `key` in n3) for (var a2 in r3 = {}, n3) a2 !== `key` && (r3[a2] = n3[a2]);
      else r3 = n3;
      return n3 = r3.ref, {
        $$typeof: t2,
        type: e3,
        key: i2,
        ref: n3 === void 0 ? null : n3,
        props: r3
      };
    }
    e2.Fragment = n2, e2.jsx = r2, e2.jsxs = r2;
  })), V = o(((e2, t2) => {
    t2.exports = yt();
  }))();
  function H() {
    let e2 = B((e3) => !!(e3.startLocation || e3.endLocation || e3.waypoints.length > 0 || e3.optimizedRoute)), t2 = B((e3) => e3.resetAll), n2 = B((e3) => e3.solverWarning);
    return (0, V.jsxs)(V.Fragment, {
      children: [
        (0, V.jsxs)(`header`, {
          children: [
            (0, V.jsxs)(`div`, {
              className: `flex items-start justify-between`,
              children: [
                (0, V.jsx)(`h1`, {
                  className: `text-xl font-bold text-slate-800`,
                  children: `Route Optimiser`
                }),
                e2 && (0, V.jsx)(`button`, {
                  onClick: t2,
                  className: `mt-1 text-xs text-slate-400 hover:text-red-500`,
                  children: `Start over`
                })
              ]
            }),
            (0, V.jsx)(`p`, {
              className: `text-sm text-slate-500`,
              children: `Set a start & end, then add intermediate stops.`
            }),
            (0, V.jsx)(`p`, {
              className: `mt-1 text-xs text-slate-400`,
              children: `Auto-saved on this device \u2014 safe to close & reopen.`
            })
          ]
        }),
        n2 && (0, V.jsxs)(`div`, {
          className: `rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-700`,
          children: [
            `\u26A0\uFE0F `,
            n2
          ]
        })
      ]
    });
  }
  function U({ title: e2, badge: t2, defaultOpen: n2 = false, children: r2 }) {
    return (0, V.jsxs)(`details`, {
      open: n2,
      className: `group rounded-md border border-slate-200 bg-white`,
      children: [
        (0, V.jsxs)(`summary`, {
          className: `flex cursor-pointer list-none items-center justify-between gap-2 rounded-md px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 [&::-webkit-details-marker]:hidden`,
          children: [
            (0, V.jsxs)(`span`, {
              className: `flex items-center gap-2`,
              children: [
                e2,
                t2 != null && (0, V.jsx)(`span`, {
                  className: `rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500`,
                  children: t2
                })
              ]
            }),
            (0, V.jsx)(`svg`, {
              viewBox: `0 0 20 20`,
              fill: `currentColor`,
              "aria-hidden": `true`,
              className: `h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180`,
              children: (0, V.jsx)(`path`, {
                fillRule: `evenodd`,
                d: `M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z`,
                clipRule: `evenodd`
              })
            })
          ]
        }),
        (0, V.jsx)(`div`, {
          className: `space-y-3 border-t border-slate-100 p-3`,
          children: r2
        })
      ]
    });
  }
  var bt = c(o(((e2, t2) => {
    ((n2, r2) => {
      typeof define == `function` && define.amd ? define([], r2) : typeof t2 == `object` && e2 !== void 0 ? t2.exports = r2() : n2.Papa = r2();
    })(e2, function e3() {
      var t3 = typeof self < `u` ? self : typeof window < `u` ? window : t3 === void 0 ? {} : t3, n2, r2 = !t3.document && !!t3.postMessage, i2 = t3.IS_PAPA_WORKER || false, a2 = {}, o2 = 0, s2 = {};
      function c2(e4) {
        return e4.charCodeAt(0) === 65279 ? e4.slice(1) : e4;
      }
      function l2(e4) {
        this._handle = null, this._finished = false, this._completed = false, this._halted = false, this._input = null, this._baseIndex = 0, this._partialLine = ``, this._rowCount = 0, this._start = 0, this._nextChunk = null, this.isFirstChunk = true, this._completeResults = {
          data: [],
          errors: [],
          meta: {}
        }, function(e5) {
          var t4 = b2(e5);
          t4.chunkSize = parseInt(t4.chunkSize), e5.step || e5.chunk || (t4.chunkSize = null), this._handle = new m2(t4), (this._handle.streamer = this)._config = t4;
        }.call(this, e4), this.parseChunk = function(e5, n3) {
          var r3 = parseInt(this._config.skipFirstNLines) || 0;
          if (this.isFirstChunk && 0 < r3) {
            let t4 = this._config.newline;
            t4 ||= (a3 = this._config.quoteChar || `"`, this._handle.guessLineEndings(e5, a3)), e5 = [
              ...e5.split(t4).slice(r3)
            ].join(t4);
          }
          this.isFirstChunk && S2(this._config.beforeFirstChunk) && (a3 = this._config.beforeFirstChunk(e5)) !== void 0 && (e5 = a3), this.isFirstChunk = false, this._halted = false;
          var r3 = this._partialLine + e5, a3 = (this._partialLine = ``, this._handle.parse(r3, this._baseIndex, !this._finished));
          if (!this._handle.paused() && !this._handle.aborted()) {
            if (e5 = a3.meta.cursor, r3 = (this._finished || (this._partialLine = r3.substring(e5 - this._baseIndex), this._baseIndex = e5), a3 && a3.data && (this._rowCount += a3.data.length), this._finished || this._config.preview && this._rowCount >= this._config.preview), i2) t3.postMessage({
              results: a3,
              workerId: s2.WORKER_ID,
              finished: r3
            });
            else if (S2(this._config.chunk) && !n3) {
              if (this._config.chunk(a3, this._handle), this._handle.paused() || this._handle.aborted()) return void (this._halted = true);
              this._completeResults = a3 = void 0;
            }
            return this._config.step || this._config.chunk || (this._completeResults.data = this._completeResults.data.concat(a3.data), this._completeResults.errors = this._completeResults.errors.concat(a3.errors), this._completeResults.meta = a3.meta), this._completed || !r3 || !S2(this._config.complete) || a3 && a3.meta.aborted || (this._config.complete(this._completeResults, this._input), this._completed = true), r3 || a3 && a3.meta.paused || this._nextChunk(), a3;
          }
          this._halted = true;
        }, this._sendError = function(e5) {
          S2(this._config.error) ? this._config.error(e5) : i2 && this._config.error && t3.postMessage({
            workerId: s2.WORKER_ID,
            error: e5,
            finished: false
          });
        };
      }
      function u2(e4) {
        var t4;
        (e4 ||= {}).chunkSize || (e4.chunkSize = s2.RemoteChunkSize), l2.call(this, e4), this._nextChunk = r2 ? function() {
          this._readChunk(), this._chunkLoaded();
        } : function() {
          this._readChunk();
        }, this.stream = function(e5) {
          this._input = e5, this._nextChunk();
        }, this._readChunk = function() {
          if (this._finished) this._chunkLoaded();
          else {
            if (t4 = new XMLHttpRequest(), this._config.withCredentials && (t4.withCredentials = this._config.withCredentials), r2 || (t4.onload = x2(this._chunkLoaded, this), t4.onerror = x2(this._chunkError, this)), t4.open(this._config.downloadRequestBody ? `POST` : `GET`, this._input, !r2), this._config.downloadRequestHeaders) {
              var e5, n3 = this._config.downloadRequestHeaders;
              for (e5 in n3) t4.setRequestHeader(e5, n3[e5]);
            }
            var i3;
            this._config.chunkSize && (i3 = this._start + this._config.chunkSize - 1, t4.setRequestHeader(`Range`, `bytes=` + this._start + `-` + i3));
            try {
              t4.send(this._config.downloadRequestBody);
            } catch (e6) {
              this._chunkError(e6.message);
            }
            r2 && t4.status === 0 && this._chunkError();
          }
        }, this._chunkLoaded = function() {
          t4.readyState === 4 && (t4.status < 200 || 400 <= t4.status ? this._chunkError() : (this._start += this._config.chunkSize || t4.responseText.length, this._finished = !this._config.chunkSize || this._start >= ((e5) => (e5 = e5.getResponseHeader(`Content-Range`)) === null ? -1 : parseInt(e5.substring(e5.lastIndexOf(`/`) + 1)))(t4), this.parseChunk(t4.responseText)));
        }, this._chunkError = function(e5) {
          e5 = t4.statusText || e5, this._sendError(Error(e5));
        };
      }
      function d2(e4) {
        (e4 ||= {}).chunkSize || (e4.chunkSize = s2.LocalChunkSize), l2.call(this, e4);
        var t4, n3, r3 = typeof FileReader < `u`;
        this.stream = function(e5) {
          this._input = e5, n3 = e5.slice || e5.webkitSlice || e5.mozSlice, r3 ? ((t4 = new FileReader()).onload = x2(this._chunkLoaded, this), t4.onerror = x2(this._chunkError, this)) : t4 = new FileReaderSync(), this._nextChunk();
        }, this._nextChunk = function() {
          this._finished || this._config.preview && !(this._rowCount < this._config.preview) || this._readChunk();
        }, this._readChunk = function() {
          var e5 = this._input, i3 = (this._config.chunkSize && (i3 = Math.min(this._start + this._config.chunkSize, this._input.size), e5 = n3.call(e5, this._start, i3)), t4.readAsText(e5, this._config.encoding));
          r3 || this._chunkLoaded({
            target: {
              result: i3
            }
          });
        }, this._chunkLoaded = function(e5) {
          this._start += this._config.chunkSize, this._finished = !this._config.chunkSize || this._start >= this._input.size, this.parseChunk(e5.target.result);
        }, this._chunkError = function() {
          this._sendError(t4.error);
        };
      }
      function f2(e4) {
        var t4;
        l2.call(this, e4 ||= {}), this.stream = function(e5) {
          return t4 = e5, this._nextChunk();
        }, this._nextChunk = function() {
          var e5, n3;
          if (!this._finished) return e5 = this._config.chunkSize, t4 = e5 ? (n3 = t4.substring(0, e5), t4.substring(e5)) : (n3 = t4, ``), this._finished = !t4, this.parseChunk(n3);
        };
      }
      function p2(e4) {
        l2.call(this, e4 ||= {});
        var t4 = [], n3 = true, r3 = false;
        this.pause = function() {
          l2.prototype.pause.apply(this, arguments), this._input.pause();
        }, this.resume = function() {
          l2.prototype.resume.apply(this, arguments), this._input.resume();
        }, this.stream = function(e5) {
          this._input = e5, this._input.on(`data`, this._streamData), this._input.on(`end`, this._streamEnd), this._input.on(`error`, this._streamError);
        }, this._checkIsFinished = function() {
          r3 && t4.length === 1 && (this._finished = true);
        }, this._nextChunk = function() {
          this._checkIsFinished(), t4.length ? this.parseChunk(t4.shift()) : n3 = true;
        }, this._streamData = x2(function(e5) {
          try {
            t4.push(typeof e5 == `string` ? e5 : e5.toString(this._config.encoding)), n3 && (n3 = false, this._checkIsFinished(), this.parseChunk(t4.shift()));
          } catch (e6) {
            this._streamError(e6);
          }
        }, this), this._streamError = x2(function(e5) {
          this._streamCleanUp(), this._sendError(e5);
        }, this), this._streamEnd = x2(function() {
          this._streamCleanUp(), r3 = true, this._streamData(``);
        }, this), this._streamCleanUp = x2(function() {
          this._input.removeListener(`data`, this._streamData), this._input.removeListener(`end`, this._streamEnd), this._input.removeListener(`error`, this._streamError);
        }, this);
      }
      function m2(e4) {
        var t4, n3, r3, i3, a3 = 2 ** 53, o3 = -a3, l3 = /^\s*-?(\d+\.?|\.\d+|\d+\.\d+)([eE][-+]?\d+)?\s*$/, u3 = /^((\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z)))$/, d3 = this, f3 = 0, p3 = 0, m3 = false, _3 = false, v3 = [], y3 = {
          data: [],
          errors: [],
          meta: {}
        };
        function x3(t5) {
          return e4.skipEmptyLines === `greedy` ? t5.join(``).trim() === `` : t5.length === 1 && t5[0].length === 0;
        }
        function C2() {
          if (y3 && r3 && (ee2(`Delimiter`, `UndetectableDelimiter`, `Unable to auto-detect delimiting character; defaulted to '` + s2.DefaultDelimiter + `'`), r3 = false), e4.skipEmptyLines && (y3.data = y3.data.filter(function(e5) {
            return !x3(e5);
          })), w2()) {
            let n5 = function(t6, n6) {
              t6 = c2(t6), S2(e4.transformHeader) && (t6 = e4.transformHeader(t6, n6)), v3.push(t6);
            };
            if (y3) if (Array.isArray(y3.data[0])) {
              for (var t5 = 0; w2() && t5 < y3.data.length; t5++) y3.data[t5].forEach(n5);
              y3.data.splice(0, 1);
            } else y3.data.forEach(n5);
          }
          function n4(t6, n5) {
            for (var r4 = e4.header ? {} : [], i5 = 0; i5 < t6.length; i5++) {
              var s3 = i5, c3 = t6[i5], c3 = ((t7, n6) => ((t8) => (e4.dynamicTypingFunction && e4.dynamicTyping[t8] === void 0 && (e4.dynamicTyping[t8] = e4.dynamicTypingFunction(t8)), true === (e4.dynamicTyping[t8] || e4.dynamicTyping)))(t7) ? n6 === `true` || n6 === `TRUE` || n6 !== `false` && n6 !== `FALSE` && (((e5) => {
                if (l3.test(e5) && (e5 = parseFloat(e5), o3 < e5 && e5 < a3)) return 1;
              })(n6) ? parseFloat(n6) : u3.test(n6) ? new Date(n6) : n6 === `` ? null : n6) : n6)(s3 = e4.header ? i5 >= v3.length ? `__parsed_extra` : v3[i5] : s3, c3 = e4.transform ? e4.transform(c3, s3) : c3);
              s3 === `__parsed_extra` ? (r4[s3] = r4[s3] || [], r4[s3].push(c3)) : r4[s3] = c3;
            }
            return e4.header && (i5 > v3.length ? ee2(`FieldMismatch`, `TooManyFields`, `Too many fields: expected ` + v3.length + ` fields but parsed ` + i5, p3 + n5) : i5 < v3.length && ee2(`FieldMismatch`, `TooFewFields`, `Too few fields: expected ` + v3.length + ` fields but parsed ` + i5, p3 + n5)), r4;
          }
          var i4;
          y3 && (e4.header || e4.dynamicTyping || e4.transform) && (i4 = 1, !y3.data.length || Array.isArray(y3.data[0]) ? (y3.data = y3.data.map(n4), i4 = y3.data.length) : y3.data = n4(y3.data, 0), e4.header && y3.meta && (y3.meta.fields = v3), p3 += i4);
        }
        function w2() {
          return e4.header && v3.length === 0;
        }
        function ee2(e5, t5, n4, r4) {
          e5 = {
            type: e5,
            code: t5,
            message: n4
          }, r4 !== void 0 && (e5.row = r4), y3.errors.push(e5);
        }
        S2(e4.step) && (i3 = e4.step, e4.step = function(t5) {
          y3 = t5, w2() ? C2() : (C2(), y3.data.length !== 0 && (f3 += t5.data.length, e4.preview && f3 > e4.preview ? n3.abort() : (y3.data = y3.data[0], i3(y3, d3))));
        }), this.parse = function(i4, a4, o4) {
          var c3 = e4.quoteChar || `"`, c3 = (e4.newline ||= this.guessLineEndings(i4, c3), r3 = false, e4.delimiter ? S2(e4.delimiter) && (e4.delimiter = e4.delimiter(i4), y3.meta.delimiter = e4.delimiter) : ((c3 = ((t5, n4, r4, i5, a5) => {
            var o5, c4, l4, u4;
            a5 ||= [
              `,`,
              `	`,
              `|`,
              `;`,
              s2.RECORD_SEP,
              s2.UNIT_SEP
            ];
            for (var d4 = 0; d4 < a5.length; d4++) {
              for (var f4, p4 = a5[d4], m4 = 0, h3 = 0, _4 = 0, v4 = (l4 = void 0, new g2({
                comments: i5,
                delimiter: p4,
                newline: n4,
                preview: 10
              }).parse(t5)), y4 = 0; y4 < v4.data.length; y4++) r4 && x3(v4.data[y4]) ? _4++ : (f4 = v4.data[y4].length, h3 += f4, l4 === void 0 ? l4 = f4 : 0 < f4 && (m4 += Math.abs(f4 - l4), l4 = f4));
              0 < v4.data.length && (h3 /= v4.data.length - _4), (c4 === void 0 || m4 <= c4) && (u4 === void 0 || u4 < h3) && 1.99 < h3 && (c4 = m4, o5 = p4, u4 = h3);
            }
            return {
              successful: !!(e4.delimiter = o5),
              bestDelimiter: o5
            };
          })(i4, e4.newline, e4.skipEmptyLines, e4.comments, e4.delimitersToGuess)).successful ? e4.delimiter = c3.bestDelimiter : (r3 = true, e4.delimiter = s2.DefaultDelimiter), y3.meta.delimiter = e4.delimiter), b2(e4));
          return e4.preview && e4.header && c3.preview++, t4 = i4, n3 = new g2(c3), y3 = n3.parse(t4, a4, o4), C2(), m3 ? {
            meta: {
              paused: true
            }
          } : y3 || {
            meta: {
              paused: false
            }
          };
        }, this.paused = function() {
          return m3;
        }, this.pause = function() {
          m3 = true, n3.abort(), t4 = S2(e4.chunk) ? `` : t4.substring(n3.getCharIndex());
        }, this.resume = function() {
          d3.streamer._halted ? (m3 = false, d3.streamer.parseChunk(t4, true)) : setTimeout(d3.resume, 3);
        }, this.aborted = function() {
          return _3;
        }, this.abort = function() {
          _3 = true, n3.abort(), y3.meta.aborted = true, S2(e4.complete) && e4.complete(y3), t4 = ``;
        }, this.guessLineEndings = function(e5, t5) {
          e5 = e5.substring(0, 1048576);
          var t5 = RegExp(h2(t5) + `([^]*?)` + h2(t5), `gm`), n4 = (e5 = e5.replace(t5, ``)).split(`\r`), t5 = e5.split(`
`), e5 = 1 < t5.length && t5[0].length < n4[0].length;
          if (n4.length === 1 || e5) return `
`;
          for (var r4 = 0, i4 = 0; i4 < n4.length; i4++) n4[i4][0] === `
` && r4++;
          return r4 >= n4.length / 2 ? `\r
` : `\r`;
        };
      }
      function h2(e4) {
        return e4.replace(/[.*+?^${}()|[\]\\]/g, `\\$&`);
      }
      function g2(e4) {
        var t4 = (e4 ||= {}).delimiter, n3 = e4.newline, r3 = e4.comments, i3 = e4.step, a3 = e4.preview, o3 = e4.fastMode, l3 = null, u3 = false, d3 = e4.quoteChar == null ? `"` : e4.quoteChar, f3 = d3;
        if (e4.escapeChar !== void 0 && (f3 = e4.escapeChar), (typeof t4 != `string` || -1 < s2.BAD_DELIMITERS.indexOf(t4)) && (t4 = `,`), r3 === t4) throw Error(`Comment character same as delimiter`);
        true === r3 ? r3 = `#` : (typeof r3 != `string` || -1 < s2.BAD_DELIMITERS.indexOf(r3)) && (r3 = false), n3 !== `
` && n3 !== `\r` && n3 !== `\r
` && (n3 = `
`);
        var p3 = 0, m3 = false;
        this.parse = function(s3, g3, _3) {
          if (typeof s3 != `string`) throw Error(`Input must be a string`);
          var v3 = s3.length, y3 = t4.length, b3 = n3.length, x3 = r3.length, C2 = S2(i3), w2 = [], ee2 = [], T2 = [], te2 = p3 = 0;
          if (!s3) return P2();
          if (o3 || false !== o3 && s3.indexOf(d3) === -1) {
            for (var ne2 = s3.split(n3), re2 = 0; re2 < ne2.length; re2++) {
              if (T2 = ne2[re2], p3 += T2.length, re2 !== ne2.length - 1) p3 += n3.length;
              else if (_3) return P2();
              if (!r3 || T2.substring(0, x3) !== r3) {
                if (C2) {
                  if (w2 = [], j2(T2.split(t4)), F2(), m3) return P2();
                } else j2(T2.split(t4));
                if (a3 && a3 <= re2) return w2 = w2.slice(0, a3), P2(true);
              }
            }
            return P2();
          }
          for (var E2 = s3.indexOf(t4, p3), D2 = s3.indexOf(n3, p3), O2 = new RegExp(h2(f3) + h2(d3), `g`), k2 = s3.indexOf(d3, p3); ; ) if (s3[p3] === d3) for (k2 = p3, p3++; ; ) {
            if ((k2 = s3.indexOf(d3, k2 + 1)) === -1) return _3 || ee2.push({
              type: `Quotes`,
              code: `MissingQuotes`,
              message: `Quoted field unterminated`,
              row: w2.length,
              index: p3
            }), N2();
            if (k2 === v3 - 1) return N2(s3.substring(p3, k2).replace(O2, d3));
            if (d3 === f3 && s3[k2 + 1] === f3) k2++;
            else if (d3 === f3 || k2 === 0 || s3[k2 - 1] !== f3) {
              E2 !== -1 && E2 < k2 + 1 && (E2 = s3.indexOf(t4, k2 + 1));
              var A2 = M2((D2 = D2 !== -1 && D2 < k2 + 1 ? s3.indexOf(n3, k2 + 1) : D2) === -1 ? E2 : Math.min(E2, D2));
              if (s3.substr(k2 + 1 + A2, y3) === t4) {
                T2.push(s3.substring(p3, k2).replace(O2, d3)), s3[p3 = k2 + 1 + A2 + y3] !== d3 && (k2 = s3.indexOf(d3, p3)), E2 = s3.indexOf(t4, p3), D2 = s3.indexOf(n3, p3);
                break;
              }
              if (A2 = M2(D2), s3.substring(k2 + 1 + A2, k2 + 1 + A2 + b3) === n3) {
                if (T2.push(s3.substring(p3, k2).replace(O2, d3)), ie2(k2 + 1 + A2 + b3), E2 = s3.indexOf(t4, p3), k2 = s3.indexOf(d3, p3), C2 && (F2(), m3)) return P2();
                if (a3 && w2.length >= a3) return P2(true);
                break;
              }
              ee2.push({
                type: `Quotes`,
                code: `InvalidQuotes`,
                message: `Trailing quote on quoted field is malformed`,
                row: w2.length,
                index: p3
              }), k2++;
            }
          }
          else if (r3 && T2.length === 0 && s3.substring(p3, p3 + x3) === r3) {
            if (D2 === -1) return P2();
            p3 = D2 + b3, D2 = s3.indexOf(n3, p3), E2 = s3.indexOf(t4, p3);
          } else if (E2 !== -1 && (E2 < D2 || D2 === -1)) T2.push(s3.substring(p3, E2)), p3 = E2 + y3, E2 = s3.indexOf(t4, p3);
          else {
            if (D2 === -1) break;
            if (T2.push(s3.substring(p3, D2)), ie2(D2 + b3), C2 && (F2(), m3)) return P2();
            if (a3 && w2.length >= a3) return P2(true);
          }
          return N2();
          function j2(e5) {
            w2.push(e5), te2 = p3;
          }
          function M2(e5) {
            var t5 = 0;
            return t5 = e5 !== -1 && (e5 = s3.substring(k2 + 1, e5)) && e5.trim() === `` ? e5.length : t5;
          }
          function N2(e5) {
            return _3 || (e5 === void 0 && (e5 = s3.substring(p3)), T2.push(e5), p3 = v3, j2(T2), C2 && F2()), P2();
          }
          function ie2(e5) {
            p3 = e5, j2(T2), T2 = [], D2 = s3.indexOf(n3, p3);
          }
          function P2(r4) {
            if (e4.header && !g3 && w2.length && !u3) {
              var i4 = w2[0], a4 = /* @__PURE__ */ Object.create(null), o4 = new Set(i4);
              let t5 = false;
              for (let n4 = 0; n4 < i4.length; n4++) {
                let r5 = c2(i4[n4]);
                if (a4[r5 = S2(e4.transformHeader) ? e4.transformHeader(r5, n4) : r5]) {
                  let e5, s4 = a4[r5];
                  for (; e5 = r5 + `_` + s4, s4++, o4.has(e5); ) ;
                  o4.add(e5), i4[n4] = e5, a4[r5]++, t5 = true, (l3 = l3 === null ? {} : l3)[e5] = r5;
                } else a4[r5] = 1, i4[n4] = r5;
                o4.add(r5);
              }
              t5 && console.warn(`Duplicate headers found and renamed.`), u3 = true;
            }
            return {
              data: w2,
              errors: ee2,
              meta: {
                delimiter: t4,
                linebreak: n3,
                aborted: m3,
                truncated: !!r4,
                cursor: te2 + (g3 || 0),
                renamedHeaders: l3
              }
            };
          }
          function F2() {
            i3(P2()), w2 = [], ee2 = [];
          }
        }, this.abort = function() {
          m3 = true;
        }, this.getCharIndex = function() {
          return p3;
        };
      }
      function _2(e4) {
        var t4 = e4.data, n3 = a2[t4.workerId], r3 = false;
        if (t4.error) n3.userError(t4.error, t4.file);
        else if (t4.results && t4.results.data) {
          var i3 = {
            abort: function() {
              r3 = true, v2(t4.workerId, {
                data: [],
                errors: [],
                meta: {
                  aborted: true
                }
              });
            },
            pause: y2,
            resume: y2
          };
          if (S2(n3.userStep)) {
            for (var o3 = 0; o3 < t4.results.data.length && (n3.userStep({
              data: t4.results.data[o3],
              errors: t4.results.errors,
              meta: t4.results.meta
            }, i3), !r3); o3++) ;
            delete t4.results;
          } else S2(n3.userChunk) && (n3.userChunk(t4.results, i3, t4.file), delete t4.results);
        }
        t4.finished && !r3 && v2(t4.workerId, t4.results);
      }
      function v2(e4, t4) {
        var n3 = a2[e4];
        S2(n3.userComplete) && n3.userComplete(t4), n3.terminate(), delete a2[e4];
      }
      function y2() {
        throw Error(`Not implemented.`);
      }
      function b2(e4) {
        if (typeof e4 != `object` || !e4) return e4;
        var t4, n3 = Array.isArray(e4) ? [] : {};
        for (t4 in e4) n3[t4] = b2(e4[t4]);
        return n3;
      }
      function x2(e4, t4) {
        return function() {
          e4.apply(t4, arguments);
        };
      }
      function S2(e4) {
        return typeof e4 == `function`;
      }
      return s2.parse = function(n3, r3) {
        var i3 = (r3 ||= {}).dynamicTyping || false;
        if (S2(i3) && (r3.dynamicTypingFunction = i3, i3 = {}), r3.dynamicTyping = i3, r3.transform = !!S2(r3.transform) && r3.transform, !r3.worker || !s2.WORKERS_SUPPORTED) return i3 = null, s2.NODE_STREAM_INPUT, typeof n3 == `string` ? (n3 = c2(n3), i3 = new (r3.download ? u2 : f2)(r3)) : true === n3.readable && S2(n3.read) && S2(n3.on) ? i3 = new p2(r3) : (t3.File && n3 instanceof File || n3 instanceof Object) && (i3 = new d2(r3)), i3.stream(n3);
        (i3 = (() => {
          var n4;
          return !!s2.WORKERS_SUPPORTED && (n4 = (() => {
            var n5 = t3.URL || t3.webkitURL || null, r4 = e3.toString();
            return s2.BLOB_URL ||= n5.createObjectURL(new Blob([
              `var global = (function() { if (typeof self !== 'undefined') { return self; } if (typeof window !== 'undefined') { return window; } if (typeof global !== 'undefined') { return global; } return {}; })(); global.IS_PAPA_WORKER=true; `,
              `(`,
              r4,
              `)();`
            ], {
              type: `text/javascript`
            }));
          })(), (n4 = new t3.Worker(n4)).onmessage = _2, n4.id = o2++, a2[n4.id] = n4);
        })()).userStep = r3.step, i3.userChunk = r3.chunk, i3.userComplete = r3.complete, i3.userError = r3.error, r3.step = S2(r3.step), r3.chunk = S2(r3.chunk), r3.complete = S2(r3.complete), r3.error = S2(r3.error), delete r3.worker, i3.postMessage({
          input: n3,
          config: r3,
          workerId: i3.id
        });
      }, s2.unparse = function(e4, t4) {
        var n3 = false, r3 = true, i3 = `,`, a3 = `\r
`, o3 = `"`, c3 = o3 + o3, l3 = false, u3 = null, d3 = false, f3 = ((() => {
          if (typeof t4 == `object`) {
            if (typeof t4.delimiter != `string` || s2.BAD_DELIMITERS.filter(function(e5) {
              return t4.delimiter.indexOf(e5) !== -1;
            }).length || (i3 = t4.delimiter), typeof t4.quotes != `boolean` && typeof t4.quotes != `function` && !Array.isArray(t4.quotes) || (n3 = t4.quotes), typeof t4.skipEmptyLines != `boolean` && typeof t4.skipEmptyLines != `string` || (l3 = t4.skipEmptyLines), typeof t4.newline == `string` && (a3 = t4.newline), typeof t4.quoteChar == `string` && (o3 = t4.quoteChar, c3 = o3 + o3), typeof t4.header == `boolean` && (r3 = t4.header), Array.isArray(t4.columns)) {
              if (t4.columns.length === 0) throw Error(`Option columns is empty`);
              u3 = t4.columns;
            }
            t4.escapeChar !== void 0 && (c3 = t4.escapeChar + o3), t4.escapeFormulae instanceof RegExp ? d3 = t4.escapeFormulae : typeof t4.escapeFormulae == `boolean` && t4.escapeFormulae && (d3 = /^[=+\-@\t\r].*$/);
          }
        })(), new RegExp(h2(o3), `g`));
        if (typeof e4 == `string` && (e4 = JSON.parse(e4)), Array.isArray(e4)) {
          if (!e4.length || Array.isArray(e4[0])) return p3(null, e4, l3);
          if (typeof e4[0] == `object`) return p3(u3 || Object.keys(e4[0]), e4, l3);
        } else if (typeof e4 == `object`) return typeof e4.data == `string` && (e4.data = JSON.parse(e4.data)), Array.isArray(e4.data) && (e4.fields ||= e4.meta && e4.meta.fields || u3, e4.fields ||= Array.isArray(e4.data[0]) ? e4.fields : typeof e4.data[0] == `object` ? Object.keys(e4.data[0]) : [], Array.isArray(e4.data[0]) || typeof e4.data[0] == `object` || (e4.data = [
          e4.data
        ])), p3(e4.fields || [], e4.data || [], l3);
        throw Error(`Unable to serialize unrecognized input`);
        function p3(e5, t5, n4) {
          var o4 = ``, s3 = (typeof e5 == `string` && (e5 = JSON.parse(e5)), typeof t5 == `string` && (t5 = JSON.parse(t5)), Array.isArray(e5) && 0 < e5.length), c4 = !Array.isArray(t5[0]);
          if (s3 && r3) {
            for (var l4 = 0; l4 < e5.length; l4++) 0 < l4 && (o4 += i3), o4 += m3(e5[l4], l4);
            0 < t5.length && (o4 += a3);
          }
          for (var u4 = 0; u4 < t5.length; u4++) {
            var d4 = (s3 ? e5 : t5[u4]).length, f4 = false, p4 = s3 ? Object.keys(t5[u4]).length === 0 : t5[u4].length === 0;
            if (n4 && !s3 && (f4 = n4 === `greedy` ? t5[u4].join(``).trim() === `` : t5[u4].length === 1 && t5[u4][0].length === 0), n4 === `greedy` && s3) {
              for (var h3 = [], g3 = 0; g3 < d4; g3++) {
                var _3 = c4 ? e5[g3] : g3;
                h3.push(t5[u4][_3]);
              }
              f4 = h3.join(``).trim() === ``;
            }
            if (!f4) {
              for (var v3 = 0; v3 < d4; v3++) {
                0 < v3 && !p4 && (o4 += i3);
                var y3 = s3 && c4 ? e5[v3] : v3;
                o4 += m3(t5[u4][y3], v3);
              }
              u4 < t5.length - 1 && (!n4 || 0 < d4 && !p4) && (o4 += a3);
            }
          }
          return o4;
        }
        function m3(e5, t5) {
          var r4, a4, l4;
          return e5 == null ? `` : e5.constructor === Date ? JSON.stringify(e5).slice(1, 25) : (l4 = false, d3 && typeof e5 == `string` && d3.test(e5) && (e5 = `'` + e5, l4 = true), a4 = (r4 = e5.toString()).replace(f3, c3), (l4 = l4 || true === n3 || typeof n3 == `function` && n3(e5, t5) || Array.isArray(n3) && n3[t5] || ((e6, t6) => {
            for (var n4 = 0; n4 < t6.length; n4++) if (-1 < e6.indexOf(t6[n4])) return true;
            return false;
          })(a4, s2.BAD_DELIMITERS) || -1 < a4.indexOf(i3) || -1 < r4.indexOf(o3) || a4.charAt(0) === ` ` || a4.charAt(a4.length - 1) === ` `) ? o3 + a4 + o3 : a4);
        }
      }, s2.RECORD_SEP = ``, s2.UNIT_SEP = ``, s2.BYTE_ORDER_MARK = `\uFEFF`, s2.BAD_DELIMITERS = [
        `\r`,
        `
`,
        `"`,
        s2.BYTE_ORDER_MARK
      ], s2.WORKERS_SUPPORTED = !r2 && !!t3.Worker, s2.NODE_STREAM_INPUT = 1, s2.LocalChunkSize = 10485760, s2.RemoteChunkSize = 5242880, s2.DefaultDelimiter = `,`, s2.Parser = g2, s2.ParserHandle = m2, s2.NetworkStreamer = u2, s2.FileStreamer = d2, s2.StringStreamer = f2, s2.ReadableStreamStreamer = p2, t3.jQuery && ((n2 = t3.jQuery).fn.parse = function(e4) {
        var r3 = e4.config || {}, i3 = [];
        return this.each(function(e5) {
          if (!(n2(this).prop(`tagName`).toUpperCase() === `INPUT` && n2(this).attr(`type`).toLowerCase() === `file` && t3.FileReader) || !this.files || this.files.length === 0) return true;
          for (var a4 = 0; a4 < this.files.length; a4++) i3.push({
            file: this.files[a4],
            inputElem: this,
            instanceConfig: n2.extend({}, r3)
          });
        }), a3(), this;
        function a3() {
          if (i3.length === 0) S2(e4.complete) && e4.complete();
          else {
            var t4, r4, a4, c3, l3 = i3[0];
            if (S2(e4.before)) {
              var u3 = e4.before(l3.file, l3.inputElem);
              if (typeof u3 == `object`) {
                if (u3.action === `abort`) return t4 = `AbortError`, r4 = l3.file, a4 = l3.inputElem, c3 = u3.reason, void (S2(e4.error) && e4.error({
                  name: t4
                }, r4, a4, c3));
                if (u3.action === `skip`) return void o3();
                typeof u3.config == `object` && (l3.instanceConfig = n2.extend(l3.instanceConfig, u3.config));
              } else if (u3 === `skip`) return void o3();
            }
            var d3 = l3.instanceConfig.complete;
            l3.instanceConfig.complete = function(e5) {
              S2(d3) && d3(e5, l3.file, l3.inputElem), o3();
            }, s2.parse(l3.file, l3.instanceConfig);
          }
        }
        function o3() {
          i3.splice(0, 1), a3();
        }
      }), i2 && (t3.onmessage = function(e4) {
        e4 = e4.data, s2.WORKER_ID === void 0 && e4 && (s2.WORKER_ID = e4.workerId), typeof e4.input == `string` ? t3.postMessage({
          workerId: s2.WORKER_ID,
          results: s2.parse(e4.input, e4.config),
          finished: true
        }) : (t3.File && e4.input instanceof File || e4.input instanceof Object) && (e4 = s2.parse(e4.input, e4.config)) && t3.postMessage({
          workerId: s2.WORKER_ID,
          results: e4,
          finished: true
        });
      }), (u2.prototype = Object.create(l2.prototype)).constructor = u2, (d2.prototype = Object.create(l2.prototype)).constructor = d2, (f2.prototype = Object.create(f2.prototype)).constructor = f2, (p2.prototype = Object.create(l2.prototype)).constructor = p2, s2;
    });
  }))(), 1);
  function xt(e2) {
    if (e2 == null) return null;
    if (typeof e2 == `number`) return Number.isFinite(e2) ? e2 : null;
    if (typeof e2 == `string`) {
      let t2 = e2.trim();
      if (t2 === ``) return null;
      let n2 = parseFloat(t2);
      return Number.isFinite(n2) ? n2 : null;
    }
    return null;
  }
  function St(e2, t2) {
    let n2 = xt(e2), r2 = xt(t2);
    return n2 === null || r2 === null || n2 < -90 || n2 > 90 || r2 < -180 || r2 > 180 ? null : {
      lat: n2,
      lng: r2
    };
  }
  function Ct(e2) {
    return `${e2.lat.toFixed(5)}, ${e2.lng.toFixed(5)}`;
  }
  var W = [
    `lat`,
    `latitude`
  ], wt = [
    `lng`,
    `lon`,
    `long`,
    `longitude`
  ];
  function Tt(e2, t2) {
    let n2 = {};
    for (let t3 of Object.keys(e2)) n2[t3.trim().toLowerCase()] = e2[t3];
    for (let e3 of t2) if (e3 in n2) return n2[e3];
  }
  function Et(e2) {
    return new Promise((t2) => {
      bt.default.parse(e2, {
        header: true,
        skipEmptyLines: true,
        complete: (e3) => {
          let n2 = [], r2 = [];
          e3.data.forEach((e4, t3) => {
            let i2 = St(Tt(e4, W), Tt(e4, wt));
            i2 ? n2.push(i2) : r2.push(`Row ${t3 + 1}: missing or invalid lat/lng`);
          }), n2.length === 0 && e3.data.length > 0 && r2.unshift(`No valid coordinates found. Expected columns named "lat" and "lng".`), t2({
            waypoints: n2,
            errors: r2
          });
        },
        error: (e3) => t2({
          waypoints: [],
          errors: [
            e3.message
          ]
        })
      });
    });
  }
  function Dt(e2) {
    return new Promise((t2) => {
      let n2 = new FileReader();
      n2.onload = () => {
        let e3 = [], r2 = [];
        try {
          let i2 = JSON.parse(String(n2.result));
          if (!Array.isArray(i2)) {
            t2({
              waypoints: [],
              errors: [
                `JSON root must be an array of { lat, lng } objects.`
              ]
            });
            return;
          }
          i2.forEach((t3, n3) => {
            let i3 = t3 && typeof t3 == `object` ? St(t3.lat, t3.lng) : null;
            i3 ? e3.push(i3) : r2.push(`Item ${n3 + 1}: missing or invalid lat/lng`);
          });
        } catch (e4) {
          r2.push(`Invalid JSON: ${e4.message}`);
        }
        t2({
          waypoints: e3,
          errors: r2
        });
      }, n2.onerror = () => t2({
        waypoints: [],
        errors: [
          `Could not read file.`
        ]
      }), n2.readAsText(e2);
    });
  }
  function Ot(e2) {
    let t2 = e2.name.toLowerCase();
    return t2.endsWith(`.json`) ? Dt(e2) : t2.endsWith(`.csv`) ? Et(e2) : e2.type.includes(`json`) ? Dt(e2) : Et(e2);
  }
  function kt() {
    let e2 = B((e3) => e3.addWaypoints), t2 = (0, _.useRef)(null), [n2, r2] = (0, _.useState)(null), [i2, a2] = (0, _.useState)([]), [o2, s2] = (0, _.useState)(false), [c2, l2] = (0, _.useState)(false);
    async function u2(t3) {
      s2(true), r2(null), a2([]);
      let n3 = await Ot(t3);
      if (s2(false), n3.waypoints.length > 0) {
        e2(n3.waypoints);
        let i3 = n3.waypoints.length;
        r2(`Added ${i3} waypoint${i3 === 1 ? `` : `s`} from ${t3.name}.`);
      } else r2(`No valid waypoints found in ${t3.name}.`);
      a2(n3.errors);
    }
    function d2(e3) {
      let t3 = e3.target.files?.[0];
      t3 && u2(t3), e3.target.value = ``;
    }
    function f2(e3) {
      e3.preventDefault(), l2(false);
      let t3 = e3.dataTransfer.files?.[0];
      t3 && u2(t3);
    }
    return (0, V.jsxs)(`div`, {
      className: `space-y-2`,
      children: [
        (0, V.jsx)(`div`, {
          onClick: () => t2.current?.click(),
          onDragOver: (e3) => {
            e3.preventDefault(), l2(true);
          },
          onDragLeave: () => l2(false),
          onDrop: f2,
          className: `cursor-pointer rounded-md border-2 border-dashed px-3 py-6 text-center text-sm transition-colors ${c2 ? `border-blue-500 bg-blue-50 text-blue-600` : `border-slate-300 text-slate-500 hover:border-slate-400`}`,
          children: o2 ? `Parsing\u2026` : `Click to browse or drop a .csv / .json file`
        }),
        (0, V.jsx)(`input`, {
          ref: t2,
          type: `file`,
          accept: `.csv,.json,application/json,text/csv`,
          onChange: d2,
          className: `hidden`
        }),
        n2 && (0, V.jsx)(`p`, {
          className: `text-xs text-slate-600`,
          children: n2
        }),
        i2.length > 0 && (0, V.jsxs)(`details`, {
          className: `text-xs text-amber-600`,
          children: [
            (0, V.jsxs)(`summary`, {
              className: `cursor-pointer`,
              children: [
                i2.length,
                ` issue`,
                i2.length === 1 ? `` : `s`,
                ` skipped`
              ]
            }),
            (0, V.jsxs)(`ul`, {
              className: `mt-1 list-inside list-disc space-y-0.5`,
              children: [
                i2.slice(0, 10).map((e3, t3) => (0, V.jsx)(`li`, {
                  children: e3
                }, t3)),
                i2.length > 10 && (0, V.jsxs)(`li`, {
                  children: [
                    `\u2026and `,
                    i2.length - 10,
                    ` more`
                  ]
                })
              ]
            })
          ]
        })
      ]
    });
  }
  var At = (e2) => Symbol.iterator in e2, jt = (e2) => `entries` in e2, Mt = (e2, t2) => {
    let n2 = e2 instanceof Map ? e2 : new Map(e2.entries()), r2 = t2 instanceof Map ? t2 : new Map(t2.entries());
    if (n2.size !== r2.size) return false;
    for (let [e3, t3] of n2) if (!r2.has(e3) || !Object.is(t3, r2.get(e3))) return false;
    return true;
  }, Nt = (e2, t2) => {
    let n2 = e2[Symbol.iterator](), r2 = t2[Symbol.iterator](), i2 = n2.next(), a2 = r2.next();
    for (; !i2.done && !a2.done; ) {
      if (!Object.is(i2.value, a2.value)) return false;
      i2 = n2.next(), a2 = r2.next();
    }
    return !!i2.done && !!a2.done;
  };
  function Pt(e2, t2) {
    return Object.is(e2, t2) ? true : typeof e2 != `object` || !e2 || typeof t2 != `object` || !t2 || Object.getPrototypeOf(e2) !== Object.getPrototypeOf(t2) ? false : At(e2) && At(t2) ? jt(e2) && jt(t2) ? Mt(e2, t2) : Nt(e2, t2) : Mt({
      entries: () => Object.entries(e2)
    }, {
      entries: () => Object.entries(t2)
    });
  }
  function Ft(e2) {
    let t2 = _.useRef(void 0);
    return (n2) => {
      let r2 = e2(n2);
      return Pt(t2.current, r2) ? t2.current : t2.current = r2;
    };
  }
  var It = (e2, t2) => !!e2 && e2.lat === t2.lat && e2.lng === t2.lng;
  function Lt({ onClick: e2, danger: t2, children: n2 }) {
    return (0, V.jsx)(`button`, {
      onClick: e2,
      className: `rounded-md border px-2 py-1 text-xs font-medium transition-colors ${t2 ? `border-red-200 text-red-600 hover:bg-red-50` : `border-slate-300 text-slate-600 hover:bg-slate-100`}`,
      children: n2
    });
  }
  function Rt({ stop: e2, index: t2 }) {
    let [n2, r2] = (0, _.useState)(false), i2 = B((e3) => e3.startLocation), a2 = B((e3) => e3.endLocation), o2 = B((e3) => e3.setStart), s2 = B((e3) => e3.setEnd), c2 = B((e3) => e3.markDelivered), l2 = B((e3) => e3.removeWaypoint), u2 = It(i2, e2), d2 = It(a2, e2), f2 = {
      lat: e2.lat,
      lng: e2.lng
    }, p2 = () => r2(false);
    return (0, V.jsxs)(`li`, {
      className: `text-sm`,
      children: [
        (0, V.jsxs)(`div`, {
          className: `flex items-center gap-2 px-2 py-2`,
          children: [
            (0, V.jsxs)(`span`, {
              className: `min-w-0 flex-1 truncate text-slate-600`,
              children: [
                (0, V.jsxs)(`span`, {
                  className: `mr-1 text-slate-400`,
                  children: [
                    t2 + 1,
                    `.`
                  ]
                }),
                Ct(e2)
              ]
            }),
            u2 && (0, V.jsx)(`span`, {
              className: `rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700`,
              children: `START`
            }),
            d2 && (0, V.jsx)(`span`, {
              className: `rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700`,
              children: `END`
            }),
            (0, V.jsx)(`button`, {
              onClick: () => r2((e3) => !e3),
              "aria-label": `Stop actions`,
              "aria-expanded": n2,
              className: `shrink-0 rounded px-1.5 text-base leading-none ${n2 ? `bg-slate-200 text-slate-700` : `text-slate-400 hover:bg-slate-100`}`,
              children: `\u22EE`
            })
          ]
        }),
        n2 && (0, V.jsxs)(`div`, {
          className: `flex flex-wrap gap-1.5 border-t border-slate-100 bg-slate-50 px-2 py-2`,
          children: [
            u2 ? (0, V.jsx)(Lt, {
              onClick: () => (o2(null), p2()),
              children: `Unset start`
            }) : (0, V.jsx)(Lt, {
              onClick: () => (o2(f2), p2()),
              children: `Set as start`
            }),
            d2 ? (0, V.jsx)(Lt, {
              onClick: () => (s2(null), p2()),
              children: `Unset end`
            }) : (0, V.jsx)(Lt, {
              onClick: () => (s2(f2), p2()),
              children: `Set as end`
            }),
            (0, V.jsx)(Lt, {
              onClick: () => (c2(e2.id), p2()),
              children: `\u2713 Mark delivered`
            }),
            (0, V.jsx)(Lt, {
              danger: true,
              onClick: () => l2(e2.id),
              children: `Remove`
            })
          ]
        })
      ]
    });
  }
  function zt() {
    let e2 = B(Ft((e3) => e3.waypoints)), t2 = (0, _.useMemo)(() => e2.filter((e3) => !e3.delivered), [
      e2
    ]);
    return t2.length === 0 ? (0, V.jsx)(`p`, {
      className: `text-xs text-slate-400`,
      children: `No active stops. Upload a CSV/JSON file above.`
    }) : (0, V.jsx)(`ul`, {
      className: `max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-md border border-slate-200`,
      children: t2.map((e3, t3) => (0, V.jsx)(Rt, {
        stop: e3,
        index: t3
      }, e3.id))
    });
  }
  function Bt() {
    let e2 = B((e3) => e3.waypoints.filter((e4) => !e4.delivered).length), t2 = B((e3) => e3.clearWaypoints);
    return (0, V.jsxs)(U, {
      title: `Stops`,
      badge: e2,
      defaultOpen: true,
      children: [
        (0, V.jsx)(kt, {}),
        (0, V.jsxs)(`div`, {
          className: `flex items-center justify-between`,
          children: [
            (0, V.jsx)(`span`, {
              className: `text-xs font-medium text-slate-500`,
              children: `Active stops`
            }),
            e2 > 0 && (0, V.jsx)(`button`, {
              onClick: t2,
              className: `text-xs text-slate-400 hover:text-red-500`,
              children: `clear all`
            })
          ]
        }),
        (0, V.jsx)(zt, {})
      ]
    });
  }
  function Vt() {
    let e2 = B((e3) => e3.waypoints), t2 = B((e3) => e3.restoreStop), n2 = B((e3) => e3.restoreAll), r2 = (0, _.useMemo)(() => e2.filter((e3) => e3.delivered), [
      e2
    ]);
    return r2.length === 0 ? null : (0, V.jsxs)(U, {
      title: `Delivered`,
      badge: r2.length,
      children: [
        (0, V.jsxs)(`div`, {
          className: `flex items-center justify-between`,
          children: [
            (0, V.jsx)(`span`, {
              className: `text-xs text-slate-400`,
              children: `Done stops \u2014 excluded from routing.`
            }),
            (0, V.jsx)(`button`, {
              onClick: n2,
              className: `text-xs font-medium text-blue-600 hover:text-blue-700`,
              children: `\u21A9 Restore all`
            })
          ]
        }),
        (0, V.jsx)(`ul`, {
          className: `divide-y divide-slate-100 rounded-md border border-slate-200`,
          children: r2.map((e3) => (0, V.jsxs)(`li`, {
            className: `flex items-center gap-2 px-3 py-2 text-sm`,
            children: [
              (0, V.jsx)(`span`, {
                className: `min-w-0 flex-1 truncate text-slate-400 line-through`,
                children: Ct(e3)
              }),
              (0, V.jsx)(`button`, {
                onClick: () => t2(e3.id),
                title: `Put back on the active list`,
                className: `shrink-0 rounded-md border border-slate-300 px-2 py-0.5 text-xs text-slate-600 hover:border-blue-400 hover:text-blue-600`,
                children: `\u21A9 Restore`
              })
            ]
          }, e3.id))
        })
      ]
    });
  }
  function Ht({ field: e2, label: t2, accentClass: n2 = `bg-blue-600` }) {
    let r2 = B((t3) => e2 === `start` ? t3.startLocation : t3.endLocation), i2 = B((t3) => e2 === `start` ? t3.setStart : t3.setEnd), [a2, o2] = (0, _.useState)(``), [s2, c2] = (0, _.useState)(``), [l2, u2] = (0, _.useState)(null);
    function d2(e3) {
      e3.preventDefault();
      let t3 = St(a2, s2);
      if (!t3) {
        u2(`Enter valid coordinates (lat \u221290..90, lng \u2212180..180).`);
        return;
      }
      u2(null), i2(t3);
    }
    function f2() {
      i2(null), o2(``), c2(``), u2(null);
    }
    return (0, V.jsxs)(`form`, {
      onSubmit: d2,
      className: `space-y-2`,
      children: [
        (0, V.jsxs)(`div`, {
          className: `flex items-center justify-between`,
          children: [
            (0, V.jsx)(`label`, {
              className: `text-sm font-semibold text-slate-700`,
              children: t2
            }),
            r2 && (0, V.jsx)(`button`, {
              type: `button`,
              onClick: f2,
              className: `text-xs text-slate-400 hover:text-red-500`,
              children: `clear`
            })
          ]
        }),
        (0, V.jsxs)(`div`, {
          className: `flex gap-2`,
          children: [
            (0, V.jsx)(`input`, {
              value: a2,
              onChange: (e3) => o2(e3.target.value),
              placeholder: `Latitude`,
              inputMode: `decimal`,
              className: `w-1/2 rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none`
            }),
            (0, V.jsx)(`input`, {
              value: s2,
              onChange: (e3) => c2(e3.target.value),
              placeholder: `Longitude`,
              inputMode: `decimal`,
              className: `w-1/2 rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none`
            })
          ]
        }),
        (0, V.jsxs)(`button`, {
          type: `submit`,
          className: `w-full rounded-md ${n2} px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90`,
          children: [
            `Set `,
            t2
          ]
        }),
        r2 && (0, V.jsxs)(`p`, {
          className: `text-xs text-slate-500`,
          children: [
            `Set to `,
            Ct(r2)
          ]
        }),
        l2 && (0, V.jsx)(`p`, {
          className: `text-xs text-red-500`,
          children: l2
        })
      ]
    });
  }
  function Ut() {
    let e2 = B((e3) => e3.targetK), t2 = B((e3) => e3.waypoints.filter((e4) => !e4.delivered).length), n2 = B((e3) => e3.setTargetK), r2 = e2 !== null && t2 > 0 && e2 > t2;
    function i2(e3) {
      if (e3 === ``) {
        n2(null);
        return;
      }
      let t3 = parseInt(e3, 10);
      n2(Number.isFinite(t3) ? t3 : null);
    }
    return (0, V.jsxs)(`div`, {
      className: `space-y-1`,
      children: [
        (0, V.jsx)(`label`, {
          htmlFor: `target-k`,
          className: `text-sm font-semibold text-slate-700`,
          children: `Stops to visit (K)`
        }),
        (0, V.jsx)(`input`, {
          id: `target-k`,
          type: `number`,
          min: 1,
          max: t2 || void 0,
          value: e2 ?? ``,
          disabled: t2 === 0,
          onChange: (e3) => i2(e3.target.value),
          placeholder: t2 === 0 ? `Upload waypoints first` : `1 \u2013 ${t2}`,
          className: `w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100`
        }),
        (0, V.jsx)(`p`, {
          className: `text-xs ${r2 ? `text-red-500` : `text-slate-400`}`,
          children: t2 === 0 ? `Add waypoints, then choose how many to visit.` : r2 ? `Only ${t2} waypoints available.` : `Choose the best K of ${t2} uploaded stops (used when calculating).`
        })
      ]
    });
  }
  function Wt() {
    let e2 = B((e3) => e3.objective), t2 = B((e3) => e3.setObjective);
    return (0, V.jsxs)(`div`, {
      className: `space-y-1`,
      children: [
        (0, V.jsx)(`span`, {
          className: `text-sm font-semibold text-slate-700`,
          children: `Optimize for`
        }),
        (0, V.jsx)(`div`, {
          className: `flex rounded-md border border-slate-300 p-0.5`,
          children: [
            {
              key: `duration`,
              label: `Time`
            },
            {
              key: `distance`,
              label: `Distance`
            }
          ].map((n2) => (0, V.jsx)(`button`, {
            onClick: () => t2(n2.key),
            className: `flex-1 rounded px-3 py-1 text-sm font-medium transition-colors ${e2 === n2.key ? `bg-blue-600 text-white` : `text-slate-600 hover:bg-slate-100`}`,
            children: n2.label
          }, n2.key))
        })
      ]
    });
  }
  function Gt() {
    return (0, V.jsxs)(U, {
      title: `Route options`,
      children: [
        (0, V.jsx)(`p`, {
          className: `text-xs text-slate-400`,
          children: `Start & end are optional \u2014 leave blank for an open route, type coordinates, or pick a stop from the list.`
        }),
        (0, V.jsx)(Ht, {
          field: `start`,
          label: `Start`,
          accentClass: `bg-emerald-600`
        }),
        (0, V.jsx)(Ht, {
          field: `end`,
          label: `End`,
          accentClass: `bg-rose-600`
        }),
        (0, V.jsx)(Ut, {}),
        (0, V.jsx)(Wt, {})
      ]
    });
  }
  function G() {
    let e2 = B((e3) => e3.isCalculating), t2 = B((e3) => e3.calcStatus), n2 = B((e3) => e3.routeError), r2 = B((e3) => e3.solverReady), i2 = B((e3) => e3.waypoints.filter((e4) => !e4.delivered).length + +!!e3.startLocation + +!!e3.endLocation), a2 = B((e3) => e3.calculateRoute), o2 = i2 >= 2;
    return (0, V.jsxs)(`section`, {
      className: `space-y-2`,
      children: [
        (0, V.jsx)(`button`, {
          onClick: a2,
          disabled: !(o2 && !e2),
          className: `w-full rounded-md px-3 py-2 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed ${e2 ? `animate-pulse bg-blue-500` : `bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300`}`,
          children: e2 ? t2 ?? `Calculating\u2026` : `Calculate Route`
        }),
        o2 ? !e2 && !r2 ? (0, V.jsx)(`p`, {
          className: `text-xs text-slate-400`,
          children: `Preparing optimizer (one-time download)\u2026`
        }) : null : (0, V.jsx)(`p`, {
          className: `text-xs text-slate-400`,
          children: `Add at least 2 points \u2014 upload a file, or set a start/end. Start & end are optional.`
        }),
        n2 && (0, V.jsx)(`p`, {
          className: `text-xs text-red-500`,
          children: n2
        })
      ]
    });
  }
  function Kt(e2) {
    return e2 >= 1e3 ? `${(e2 / 1e3).toFixed(1)} km` : `${Math.round(e2)} m`;
  }
  function K(e2) {
    let t2 = Math.round(e2 / 60);
    return t2 < 60 ? `${t2} min` : `${Math.floor(t2 / 60)} h ${t2 % 60} min`;
  }
  function qt({ route: e2 }) {
    return (0, V.jsxs)(`div`, {
      className: `space-y-2 rounded-md border border-blue-200 bg-blue-50 p-3`,
      children: [
        (0, V.jsxs)(`div`, {
          className: `flex gap-4 text-sm`,
          children: [
            (0, V.jsxs)(`div`, {
              children: [
                (0, V.jsx)(`span`, {
                  className: `block text-xs text-slate-500`,
                  children: `Distance`
                }),
                (0, V.jsxs)(`span`, {
                  className: `font-semibold text-slate-800`,
                  children: [
                    e2.estimated ? `~` : ``,
                    Kt(e2.distanceMeters)
                  ]
                })
              ]
            }),
            (0, V.jsxs)(`div`, {
              children: [
                (0, V.jsx)(`span`, {
                  className: `block text-xs text-slate-500`,
                  children: `Duration`
                }),
                (0, V.jsxs)(`span`, {
                  className: `font-semibold text-slate-800`,
                  children: [
                    e2.estimated ? `~` : ``,
                    K(e2.durationSeconds)
                  ]
                })
              ]
            }),
            (0, V.jsxs)(`div`, {
              children: [
                (0, V.jsx)(`span`, {
                  className: `block text-xs text-slate-500`,
                  children: `Stops`
                }),
                (0, V.jsx)(`span`, {
                  className: `font-semibold text-slate-800`,
                  children: e2.orderedWaypoints.length
                })
              ]
            })
          ]
        }),
        e2.estimated && (0, V.jsx)(`p`, {
          className: `text-xs text-slate-500`,
          children: `Straight-line estimate. Real driving distance & turn-by-turn come from the Google Maps links below.`
        })
      ]
    });
  }
  var Jt = `https://www.google.com/maps`;
  function Yt(e2) {
    return `${e2.lat},${e2.lng}`;
  }
  function Xt(e2) {
    return `${Jt}/search/?${new URLSearchParams({
      api: `1`,
      query: Yt(e2)
    }).toString()}`;
  }
  function Zt(e2) {
    if (e2.length < 2) return [];
    let t2 = [];
    for (let n2 = 0; n2 < e2.length - 1; n2 += 10) {
      let r2 = e2.slice(n2, n2 + 10 + 1), i2 = r2[0], a2 = r2[r2.length - 1], o2 = r2.slice(1, -1), s2 = new URLSearchParams({
        api: `1`,
        origin: Yt(i2),
        destination: Yt(a2),
        travelmode: `driving`
      });
      o2.length > 0 && s2.set(`waypoints`, o2.map(Yt).join(`|`)), t2.push({
        url: `${Jt}/dir/?${s2.toString()}`,
        fromIndex: n2,
        toIndex: n2 + r2.length - 1
      });
    }
    return t2;
  }
  var Qt = (e2) => `${e2.lat},${e2.lng}`;
  function $t({ n: e2, color: t2 }) {
    return (0, V.jsx)(`span`, {
      className: `flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white`,
      style: {
        background: t2
      },
      children: e2
    });
  }
  function en({ route: e2 }) {
    let t2 = e2.orderedWaypoints, n2 = Zt(t2), r2 = B((e3) => e3.waypoints), i2 = B((e3) => e3.markDeliveredByCoord), a2 = (0, _.useMemo)(() => new Set(r2.filter((e3) => e3.delivered).map(Qt)), [
      r2
    ]), o2 = `block rounded-md bg-emerald-600 px-3 py-2 text-center text-sm font-semibold text-white transition-colors hover:bg-emerald-700`;
    return (0, V.jsxs)(`div`, {
      className: `space-y-3`,
      children: [
        (0, V.jsx)(`div`, {
          className: `space-y-1.5`,
          children: n2.length === 1 ? (0, V.jsx)(`a`, {
            href: n2[0].url,
            target: `_blank`,
            rel: `noopener noreferrer`,
            className: o2,
            children: `Navigate Entire Route in Google Maps`
          }) : (0, V.jsxs)(V.Fragment, {
            children: [
              (0, V.jsxs)(`p`, {
                className: `text-xs text-amber-600`,
                children: [
                  t2.length - 2,
                  ` waypoints exceed Google Maps\u2019 limit \u2014 split into`,
                  ` `,
                  n2.length,
                  ` legs:`
                ]
              }),
              n2.map((e3, t3) => (0, V.jsxs)(`a`, {
                href: e3.url,
                target: `_blank`,
                rel: `noopener noreferrer`,
                className: o2,
                children: [
                  `Navigate Part `,
                  t3 + 1,
                  ` of `,
                  n2.length,
                  ` (stops `,
                  e3.fromIndex + 1,
                  `\u2013`,
                  e3.toIndex + 1,
                  `)`
                ]
              }, t3))
            ]
          })
        }),
        (0, V.jsx)(`ol`, {
          className: `divide-y divide-slate-100 overflow-hidden rounded-md border border-slate-200`,
          children: t2.map((e3, n3) => {
            let r3 = n3 === 0, o3 = n3 === t2.length - 1, s2 = r3 ? `#059669` : o3 ? `#e11d48` : `#2563eb`, c2 = r3 ? `Start` : o3 ? `End` : `Stop ${n3 + 1}`, l2 = a2.has(Qt(e3));
            return (0, V.jsxs)(`li`, {
              className: `flex items-center gap-2 px-2 py-2 text-sm`,
              children: [
                (0, V.jsx)(`button`, {
                  onClick: () => i2(e3.lat, e3.lng),
                  disabled: l2,
                  title: l2 ? `Delivered` : `Mark delivered`,
                  className: `flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] ${l2 ? `border-emerald-500 bg-emerald-500 text-white` : `border-slate-300 text-transparent hover:border-emerald-500 hover:text-emerald-500`}`,
                  children: `\u2713`
                }),
                (0, V.jsx)($t, {
                  n: n3 + 1,
                  color: l2 ? `#94a3b8` : s2
                }),
                (0, V.jsxs)(`span`, {
                  className: `min-w-0 flex-1`,
                  children: [
                    (0, V.jsx)(`span`, {
                      className: `font-medium ${l2 ? `text-slate-400 line-through` : `text-slate-700`}`,
                      children: c2
                    }),
                    (0, V.jsx)(`span`, {
                      className: `block truncate text-xs text-slate-500`,
                      children: Ct(e3)
                    })
                  ]
                }),
                (0, V.jsx)(`a`, {
                  href: Xt(e3),
                  target: `_blank`,
                  rel: `noopener noreferrer`,
                  className: `shrink-0 rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:border-blue-400 hover:text-blue-600`,
                  children: `Maps \u2197`
                })
              ]
            }, `${e3.lat},${e3.lng},${n3}`);
          })
        })
      ]
    });
  }
  function tn() {
    let e2 = B((e3) => e3.optimizedRoute);
    return e2 ? (0, V.jsxs)(`section`, {
      className: `space-y-2`,
      children: [
        (0, V.jsxs)(`p`, {
          className: `text-xs text-slate-500`,
          children: [
            `Visiting `,
            e2.candidatesVisited,
            ` of `,
            e2.candidatesTotal,
            ` candidate stop`,
            e2.candidatesTotal === 1 ? `` : `s`,
            `.`
          ]
        }),
        (0, V.jsx)(qt, {
          route: e2
        }),
        (0, V.jsx)(en, {
          route: e2
        })
      ]
    }) : null;
  }
  function nn() {
    let e2 = B(Ft((e3) => e3.favorites)), t2 = B((e3) => !!(e3.startLocation || e3.endLocation || e3.waypoints.length > 0)), n2 = B((e3) => e3.saveFavorite), r2 = B((e3) => e3.loadFavorite), i2 = B((e3) => e3.deleteFavorite), [a2, o2] = (0, _.useState)(``);
    function s2() {
      n2(a2), o2(``);
    }
    return (0, V.jsxs)(U, {
      title: `Favorites`,
      badge: e2.length || void 0,
      children: [
        (0, V.jsxs)(`div`, {
          className: `flex gap-2`,
          children: [
            (0, V.jsx)(`input`, {
              value: a2,
              onChange: (e3) => o2(e3.target.value),
              onKeyDown: (e3) => e3.key === `Enter` && t2 && s2(),
              placeholder: `Name this list\u2026`,
              className: `min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none`
            }),
            (0, V.jsx)(`button`, {
              onClick: s2,
              disabled: !t2,
              className: `shrink-0 rounded-md bg-slate-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300`,
              children: `Save`
            })
          ]
        }),
        e2.length === 0 ? (0, V.jsx)(`p`, {
          className: `text-xs text-slate-400`,
          children: `Save the current start, end & stops to reuse later.`
        }) : (0, V.jsx)(`ul`, {
          className: `divide-y divide-slate-100 rounded-md border border-slate-200`,
          children: e2.map((e3) => (0, V.jsxs)(`li`, {
            className: `flex items-center gap-2 px-3 py-2 text-sm`,
            children: [
              (0, V.jsxs)(`button`, {
                onClick: () => r2(e3.id),
                className: `min-w-0 flex-1 truncate text-left text-slate-700 hover:text-blue-600`,
                title: `Load this favorite`,
                children: [
                  e3.name,
                  (0, V.jsxs)(`span`, {
                    className: `ml-2 text-xs text-slate-400`,
                    children: [
                      e3.waypoints.length,
                      ` stop`,
                      e3.waypoints.length === 1 ? `` : `s`
                    ]
                  })
                ]
              }),
              (0, V.jsx)(`button`, {
                onClick: () => i2(e3.id),
                "aria-label": `Delete ${e3.name}`,
                className: `shrink-0 text-slate-300 hover:text-red-500`,
                children: `\u2715`
              })
            ]
          }, e3.id))
        })
      ]
    });
  }
  function rn(e2, t2) {
    let n2 = (0, _.useRef)(t2);
    (0, _.useEffect)(function() {
      t2 !== n2.current && e2.attributionControl != null && (n2.current != null && e2.attributionControl.removeAttribution(n2.current), t2 != null && e2.attributionControl.addAttribution(t2)), n2.current = t2;
    }, [
      e2,
      t2
    ]);
  }
  function an(e2) {
    return Object.freeze({
      __version: 1,
      map: e2
    });
  }
  function on(e2, t2) {
    return Object.freeze({
      ...e2,
      ...t2
    });
  }
  var sn = (0, _.createContext)(null);
  function cn() {
    let e2 = (0, _.use)(sn);
    if (e2 == null) throw Error(`No context provided: useLeafletContext() can only be used in a descendant of <MapContainer>`);
    return e2;
  }
  var ln = m();
  function q(e2) {
    function t2(t3, n2) {
      let { instance: r2, context: i2 } = e2(t3).current;
      (0, _.useImperativeHandle)(n2, () => r2);
      let { children: a2 } = t3;
      return a2 == null ? null : _.createElement(sn, {
        value: i2
      }, a2);
    }
    return (0, _.forwardRef)(t2);
  }
  function un(e2) {
    function t2(t3, n2) {
      let [r2, i2] = (0, _.useState)(false), { instance: a2 } = e2(t3, i2).current;
      (0, _.useImperativeHandle)(n2, () => a2), (0, _.useEffect)(function() {
        r2 && a2.update();
      }, [
        a2,
        r2,
        t3.children
      ]);
      let o2 = a2._contentNode;
      return o2 ? (0, ln.createPortal)(t3.children, o2) : null;
    }
    return (0, _.forwardRef)(t2);
  }
  function dn(e2) {
    function t2(t3, n2) {
      let { instance: r2 } = e2(t3).current;
      return (0, _.useImperativeHandle)(n2, () => r2), null;
    }
    return (0, _.forwardRef)(t2);
  }
  function fn(e2, t2) {
    let n2 = (0, _.useRef)(void 0);
    (0, _.useEffect)(function() {
      return t2 != null && e2.instance.on(t2), n2.current = t2, function() {
        n2.current != null && e2.instance.off(n2.current), n2.current = null;
      };
    }, [
      e2,
      t2
    ]);
  }
  function pn(e2, t2) {
    let n2 = e2.pane ?? t2.pane;
    return n2 ? {
      ...e2,
      pane: n2
    } : e2;
  }
  function mn(e2, t2) {
    return function(n2, r2) {
      let i2 = cn(), a2 = e2(pn(n2, i2), i2);
      return rn(i2.map, n2.attribution), fn(a2.current, n2.eventHandlers), t2(a2.current, i2, n2, r2), a2;
    };
  }
  var hn = o(((e2, t2) => {
    (function(n2, r2) {
      typeof e2 == `object` && t2 !== void 0 ? r2(e2) : typeof define == `function` && define.amd ? define([
        `exports`
      ], r2) : (n2 = typeof globalThis < `u` ? globalThis : n2 || self, r2(n2.leaflet = {}));
    })(e2, (function(e3) {
      var t3 = `1.9.4`;
      function n2(e4) {
        var t4, n3, r3, i3;
        for (n3 = 1, r3 = arguments.length; n3 < r3; n3++) for (t4 in i3 = arguments[n3], i3) e4[t4] = i3[t4];
        return e4;
      }
      var r2 = Object.create || /* @__PURE__ */ (function() {
        function e4() {
        }
        return function(t4) {
          return e4.prototype = t4, new e4();
        };
      })();
      function i2(e4, t4) {
        var n3 = Array.prototype.slice;
        if (e4.bind) return e4.bind.apply(e4, n3.call(arguments, 1));
        var r3 = n3.call(arguments, 2);
        return function() {
          return e4.apply(t4, r3.length ? r3.concat(n3.call(arguments)) : arguments);
        };
      }
      var a2 = 0;
      function o2(e4) {
        return `_leaflet_id` in e4 || (e4._leaflet_id = ++a2), e4._leaflet_id;
      }
      function s2(e4, t4, n3) {
        var r3, i3, a3, o3 = function() {
          r3 = false, i3 &&= (a3.apply(n3, i3), false);
        };
        return a3 = function() {
          r3 ? i3 = arguments : (e4.apply(n3, arguments), setTimeout(o3, t4), r3 = true);
        }, a3;
      }
      function c2(e4, t4, n3) {
        var r3 = t4[1], i3 = t4[0], a3 = r3 - i3;
        return e4 === r3 && n3 ? e4 : ((e4 - i3) % a3 + a3) % a3 + i3;
      }
      function l2() {
        return false;
      }
      function u2(e4, t4) {
        if (t4 === false) return e4;
        var n3 = 10 ** (t4 === void 0 ? 6 : t4);
        return Math.round(e4 * n3) / n3;
      }
      function d2(e4) {
        return e4.trim ? e4.trim() : e4.replace(/^\s+|\s+$/g, ``);
      }
      function f2(e4) {
        return d2(e4).split(/\s+/);
      }
      function p2(e4, t4) {
        for (var n3 in Object.prototype.hasOwnProperty.call(e4, `options`) || (e4.options = e4.options ? r2(e4.options) : {}), t4) e4.options[n3] = t4[n3];
        return e4.options;
      }
      function m2(e4, t4, n3) {
        var r3 = [];
        for (var i3 in e4) r3.push(encodeURIComponent(n3 ? i3.toUpperCase() : i3) + `=` + encodeURIComponent(e4[i3]));
        return (!t4 || t4.indexOf(`?`) === -1 ? `?` : `&`) + r3.join(`&`);
      }
      var h2 = /\{ *([\w_ -]+) *\}/g;
      function g2(e4, t4) {
        return e4.replace(h2, function(e5, n3) {
          var r3 = t4[n3];
          if (r3 === void 0) throw Error(`No value provided for variable ` + e5);
          return typeof r3 == `function` && (r3 = r3(t4)), r3;
        });
      }
      var _2 = Array.isArray || function(e4) {
        return Object.prototype.toString.call(e4) === `[object Array]`;
      };
      function v2(e4, t4) {
        for (var n3 = 0; n3 < e4.length; n3++) if (e4[n3] === t4) return n3;
        return -1;
      }
      var y2 = `data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=`;
      function b2(e4) {
        return window[`webkit` + e4] || window[`moz` + e4] || window[`ms` + e4];
      }
      var x2 = 0;
      function S2(e4) {
        var t4 = +/* @__PURE__ */ new Date(), n3 = Math.max(0, 16 - (t4 - x2));
        return x2 = t4 + n3, window.setTimeout(e4, n3);
      }
      var C2 = window.requestAnimationFrame || b2(`RequestAnimationFrame`) || S2, w2 = window.cancelAnimationFrame || b2(`CancelAnimationFrame`) || b2(`CancelRequestAnimationFrame`) || function(e4) {
        window.clearTimeout(e4);
      };
      function ee2(e4, t4, n3) {
        if (n3 && C2 === S2) e4.call(t4);
        else return C2.call(window, i2(e4, t4));
      }
      function T2(e4) {
        e4 && w2.call(window, e4);
      }
      var te2 = {
        __proto__: null,
        extend: n2,
        create: r2,
        bind: i2,
        get lastId() {
          return a2;
        },
        stamp: o2,
        throttle: s2,
        wrapNum: c2,
        falseFn: l2,
        formatNum: u2,
        trim: d2,
        splitWords: f2,
        setOptions: p2,
        getParamString: m2,
        template: g2,
        isArray: _2,
        indexOf: v2,
        emptyImageUrl: y2,
        requestFn: C2,
        cancelFn: w2,
        requestAnimFrame: ee2,
        cancelAnimFrame: T2
      };
      function ne2() {
      }
      ne2.extend = function(e4) {
        var t4 = function() {
          p2(this), this.initialize && this.initialize.apply(this, arguments), this.callInitHooks();
        }, i3 = t4.__super__ = this.prototype, a3 = r2(i3);
        for (var o3 in a3.constructor = t4, t4.prototype = a3, this) Object.prototype.hasOwnProperty.call(this, o3) && o3 !== `prototype` && o3 !== `__super__` && (t4[o3] = this[o3]);
        return e4.statics && n2(t4, e4.statics), e4.includes && (re2(e4.includes), n2.apply(null, [
          a3
        ].concat(e4.includes))), n2(a3, e4), delete a3.statics, delete a3.includes, a3.options && (a3.options = i3.options ? r2(i3.options) : {}, n2(a3.options, e4.options)), a3._initHooks = [], a3.callInitHooks = function() {
          if (!this._initHooksCalled) {
            i3.callInitHooks && i3.callInitHooks.call(this), this._initHooksCalled = true;
            for (var e5 = 0, t5 = a3._initHooks.length; e5 < t5; e5++) a3._initHooks[e5].call(this);
          }
        }, t4;
      }, ne2.include = function(e4) {
        var t4 = this.prototype.options;
        return n2(this.prototype, e4), e4.options && (this.prototype.options = t4, this.mergeOptions(e4.options)), this;
      }, ne2.mergeOptions = function(e4) {
        return n2(this.prototype.options, e4), this;
      }, ne2.addInitHook = function(e4) {
        var t4 = Array.prototype.slice.call(arguments, 1), n3 = typeof e4 == `function` ? e4 : function() {
          this[e4].apply(this, t4);
        };
        return this.prototype._initHooks = this.prototype._initHooks || [], this.prototype._initHooks.push(n3), this;
      };
      function re2(e4) {
        if (!(typeof L > `u` || !L || !L.Mixin)) {
          e4 = _2(e4) ? e4 : [
            e4
          ];
          for (var t4 = 0; t4 < e4.length; t4++) e4[t4] === L.Mixin.Events && console.warn(`Deprecated include of L.Mixin.Events: this property will be removed in future releases, please inherit from L.Evented instead.`, Error().stack);
        }
      }
      var E2 = {
        on: function(e4, t4, n3) {
          if (typeof e4 == `object`) for (var r3 in e4) this._on(r3, e4[r3], t4);
          else {
            e4 = f2(e4);
            for (var i3 = 0, a3 = e4.length; i3 < a3; i3++) this._on(e4[i3], t4, n3);
          }
          return this;
        },
        off: function(e4, t4, n3) {
          if (!arguments.length) delete this._events;
          else if (typeof e4 == `object`) for (var r3 in e4) this._off(r3, e4[r3], t4);
          else {
            e4 = f2(e4);
            for (var i3 = arguments.length === 1, a3 = 0, o3 = e4.length; a3 < o3; a3++) i3 ? this._off(e4[a3]) : this._off(e4[a3], t4, n3);
          }
          return this;
        },
        _on: function(e4, t4, n3, r3) {
          if (typeof t4 != `function`) {
            console.warn(`wrong listener type: ` + typeof t4);
            return;
          }
          if (this._listens(e4, t4, n3) === false) {
            n3 === this && (n3 = void 0);
            var i3 = {
              fn: t4,
              ctx: n3
            };
            r3 && (i3.once = true), this._events = this._events || {}, this._events[e4] = this._events[e4] || [], this._events[e4].push(i3);
          }
        },
        _off: function(e4, t4, n3) {
          var r3, i3, a3;
          if (this._events && (r3 = this._events[e4], r3)) {
            if (arguments.length === 1) {
              if (this._firingCount) for (i3 = 0, a3 = r3.length; i3 < a3; i3++) r3[i3].fn = l2;
              delete this._events[e4];
              return;
            }
            if (typeof t4 != `function`) {
              console.warn(`wrong listener type: ` + typeof t4);
              return;
            }
            var o3 = this._listens(e4, t4, n3);
            if (o3 !== false) {
              var s3 = r3[o3];
              this._firingCount && (s3.fn = l2, this._events[e4] = r3 = r3.slice()), r3.splice(o3, 1);
            }
          }
        },
        fire: function(e4, t4, r3) {
          if (!this.listens(e4, r3)) return this;
          var i3 = n2({}, t4, {
            type: e4,
            target: this,
            sourceTarget: t4 && t4.sourceTarget || this
          });
          if (this._events) {
            var a3 = this._events[e4];
            if (a3) {
              this._firingCount = this._firingCount + 1 || 1;
              for (var o3 = 0, s3 = a3.length; o3 < s3; o3++) {
                var c3 = a3[o3], l3 = c3.fn;
                c3.once && this.off(e4, l3, c3.ctx), l3.call(c3.ctx || this, i3);
              }
              this._firingCount--;
            }
          }
          return r3 && this._propagateEvent(i3), this;
        },
        listens: function(e4, t4, n3, r3) {
          typeof e4 != `string` && console.warn(`"string" type argument expected`);
          var i3 = t4;
          typeof t4 != `function` && (r3 = !!t4, i3 = void 0, n3 = void 0);
          var a3 = this._events && this._events[e4];
          if (a3 && a3.length && this._listens(e4, i3, n3) !== false) return true;
          if (r3) {
            for (var o3 in this._eventParents) if (this._eventParents[o3].listens(e4, t4, n3, r3)) return true;
          }
          return false;
        },
        _listens: function(e4, t4, n3) {
          if (!this._events) return false;
          var r3 = this._events[e4] || [];
          if (!t4) return !!r3.length;
          n3 === this && (n3 = void 0);
          for (var i3 = 0, a3 = r3.length; i3 < a3; i3++) if (r3[i3].fn === t4 && r3[i3].ctx === n3) return i3;
          return false;
        },
        once: function(e4, t4, n3) {
          if (typeof e4 == `object`) for (var r3 in e4) this._on(r3, e4[r3], t4, true);
          else {
            e4 = f2(e4);
            for (var i3 = 0, a3 = e4.length; i3 < a3; i3++) this._on(e4[i3], t4, n3, true);
          }
          return this;
        },
        addEventParent: function(e4) {
          return this._eventParents = this._eventParents || {}, this._eventParents[o2(e4)] = e4, this;
        },
        removeEventParent: function(e4) {
          return this._eventParents && delete this._eventParents[o2(e4)], this;
        },
        _propagateEvent: function(e4) {
          for (var t4 in this._eventParents) this._eventParents[t4].fire(e4.type, n2({
            layer: e4.target,
            propagatedFrom: e4.target
          }, e4), true);
        }
      };
      E2.addEventListener = E2.on, E2.removeEventListener = E2.clearAllEventListeners = E2.off, E2.addOneTimeEventListener = E2.once, E2.fireEvent = E2.fire, E2.hasEventListeners = E2.listens;
      var D2 = ne2.extend(E2);
      function O2(e4, t4, n3) {
        this.x = n3 ? Math.round(e4) : e4, this.y = n3 ? Math.round(t4) : t4;
      }
      var k2 = Math.trunc || function(e4) {
        return e4 > 0 ? Math.floor(e4) : Math.ceil(e4);
      };
      O2.prototype = {
        clone: function() {
          return new O2(this.x, this.y);
        },
        add: function(e4) {
          return this.clone()._add(A2(e4));
        },
        _add: function(e4) {
          return this.x += e4.x, this.y += e4.y, this;
        },
        subtract: function(e4) {
          return this.clone()._subtract(A2(e4));
        },
        _subtract: function(e4) {
          return this.x -= e4.x, this.y -= e4.y, this;
        },
        divideBy: function(e4) {
          return this.clone()._divideBy(e4);
        },
        _divideBy: function(e4) {
          return this.x /= e4, this.y /= e4, this;
        },
        multiplyBy: function(e4) {
          return this.clone()._multiplyBy(e4);
        },
        _multiplyBy: function(e4) {
          return this.x *= e4, this.y *= e4, this;
        },
        scaleBy: function(e4) {
          return new O2(this.x * e4.x, this.y * e4.y);
        },
        unscaleBy: function(e4) {
          return new O2(this.x / e4.x, this.y / e4.y);
        },
        round: function() {
          return this.clone()._round();
        },
        _round: function() {
          return this.x = Math.round(this.x), this.y = Math.round(this.y), this;
        },
        floor: function() {
          return this.clone()._floor();
        },
        _floor: function() {
          return this.x = Math.floor(this.x), this.y = Math.floor(this.y), this;
        },
        ceil: function() {
          return this.clone()._ceil();
        },
        _ceil: function() {
          return this.x = Math.ceil(this.x), this.y = Math.ceil(this.y), this;
        },
        trunc: function() {
          return this.clone()._trunc();
        },
        _trunc: function() {
          return this.x = k2(this.x), this.y = k2(this.y), this;
        },
        distanceTo: function(e4) {
          e4 = A2(e4);
          var t4 = e4.x - this.x, n3 = e4.y - this.y;
          return Math.sqrt(t4 * t4 + n3 * n3);
        },
        equals: function(e4) {
          return e4 = A2(e4), e4.x === this.x && e4.y === this.y;
        },
        contains: function(e4) {
          return e4 = A2(e4), Math.abs(e4.x) <= Math.abs(this.x) && Math.abs(e4.y) <= Math.abs(this.y);
        },
        toString: function() {
          return `Point(` + u2(this.x) + `, ` + u2(this.y) + `)`;
        }
      };
      function A2(e4, t4, n3) {
        return e4 instanceof O2 ? e4 : _2(e4) ? new O2(e4[0], e4[1]) : e4 == null ? e4 : typeof e4 == `object` && `x` in e4 && `y` in e4 ? new O2(e4.x, e4.y) : new O2(e4, t4, n3);
      }
      function j2(e4, t4) {
        if (e4) for (var n3 = t4 ? [
          e4,
          t4
        ] : e4, r3 = 0, i3 = n3.length; r3 < i3; r3++) this.extend(n3[r3]);
      }
      j2.prototype = {
        extend: function(e4) {
          var t4, n3;
          if (!e4) return this;
          if (e4 instanceof O2 || typeof e4[0] == `number` || `x` in e4) t4 = n3 = A2(e4);
          else if (e4 = M2(e4), t4 = e4.min, n3 = e4.max, !t4 || !n3) return this;
          return !this.min && !this.max ? (this.min = t4.clone(), this.max = n3.clone()) : (this.min.x = Math.min(t4.x, this.min.x), this.max.x = Math.max(n3.x, this.max.x), this.min.y = Math.min(t4.y, this.min.y), this.max.y = Math.max(n3.y, this.max.y)), this;
        },
        getCenter: function(e4) {
          return A2((this.min.x + this.max.x) / 2, (this.min.y + this.max.y) / 2, e4);
        },
        getBottomLeft: function() {
          return A2(this.min.x, this.max.y);
        },
        getTopRight: function() {
          return A2(this.max.x, this.min.y);
        },
        getTopLeft: function() {
          return this.min;
        },
        getBottomRight: function() {
          return this.max;
        },
        getSize: function() {
          return this.max.subtract(this.min);
        },
        contains: function(e4) {
          var t4, n3;
          return e4 = typeof e4[0] == `number` || e4 instanceof O2 ? A2(e4) : M2(e4), e4 instanceof j2 ? (t4 = e4.min, n3 = e4.max) : t4 = n3 = e4, t4.x >= this.min.x && n3.x <= this.max.x && t4.y >= this.min.y && n3.y <= this.max.y;
        },
        intersects: function(e4) {
          e4 = M2(e4);
          var t4 = this.min, n3 = this.max, r3 = e4.min, i3 = e4.max, a3 = i3.x >= t4.x && r3.x <= n3.x, o3 = i3.y >= t4.y && r3.y <= n3.y;
          return a3 && o3;
        },
        overlaps: function(e4) {
          e4 = M2(e4);
          var t4 = this.min, n3 = this.max, r3 = e4.min, i3 = e4.max, a3 = i3.x > t4.x && r3.x < n3.x, o3 = i3.y > t4.y && r3.y < n3.y;
          return a3 && o3;
        },
        isValid: function() {
          return !!(this.min && this.max);
        },
        pad: function(e4) {
          var t4 = this.min, n3 = this.max, r3 = Math.abs(t4.x - n3.x) * e4, i3 = Math.abs(t4.y - n3.y) * e4;
          return M2(A2(t4.x - r3, t4.y - i3), A2(n3.x + r3, n3.y + i3));
        },
        equals: function(e4) {
          return e4 ? (e4 = M2(e4), this.min.equals(e4.getTopLeft()) && this.max.equals(e4.getBottomRight())) : false;
        }
      };
      function M2(e4, t4) {
        return !e4 || e4 instanceof j2 ? e4 : new j2(e4, t4);
      }
      function N2(e4, t4) {
        if (e4) for (var n3 = t4 ? [
          e4,
          t4
        ] : e4, r3 = 0, i3 = n3.length; r3 < i3; r3++) this.extend(n3[r3]);
      }
      N2.prototype = {
        extend: function(e4) {
          var t4 = this._southWest, n3 = this._northEast, r3, i3;
          if (e4 instanceof P2) r3 = e4, i3 = e4;
          else if (e4 instanceof N2) {
            if (r3 = e4._southWest, i3 = e4._northEast, !r3 || !i3) return this;
          } else return e4 ? this.extend(F2(e4) || ie2(e4)) : this;
          return !t4 && !n3 ? (this._southWest = new P2(r3.lat, r3.lng), this._northEast = new P2(i3.lat, i3.lng)) : (t4.lat = Math.min(r3.lat, t4.lat), t4.lng = Math.min(r3.lng, t4.lng), n3.lat = Math.max(i3.lat, n3.lat), n3.lng = Math.max(i3.lng, n3.lng)), this;
        },
        pad: function(e4) {
          var t4 = this._southWest, n3 = this._northEast, r3 = Math.abs(t4.lat - n3.lat) * e4, i3 = Math.abs(t4.lng - n3.lng) * e4;
          return new N2(new P2(t4.lat - r3, t4.lng - i3), new P2(n3.lat + r3, n3.lng + i3));
        },
        getCenter: function() {
          return new P2((this._southWest.lat + this._northEast.lat) / 2, (this._southWest.lng + this._northEast.lng) / 2);
        },
        getSouthWest: function() {
          return this._southWest;
        },
        getNorthEast: function() {
          return this._northEast;
        },
        getNorthWest: function() {
          return new P2(this.getNorth(), this.getWest());
        },
        getSouthEast: function() {
          return new P2(this.getSouth(), this.getEast());
        },
        getWest: function() {
          return this._southWest.lng;
        },
        getSouth: function() {
          return this._southWest.lat;
        },
        getEast: function() {
          return this._northEast.lng;
        },
        getNorth: function() {
          return this._northEast.lat;
        },
        contains: function(e4) {
          e4 = typeof e4[0] == `number` || e4 instanceof P2 || `lat` in e4 ? F2(e4) : ie2(e4);
          var t4 = this._southWest, n3 = this._northEast, r3, i3;
          return e4 instanceof N2 ? (r3 = e4.getSouthWest(), i3 = e4.getNorthEast()) : r3 = i3 = e4, r3.lat >= t4.lat && i3.lat <= n3.lat && r3.lng >= t4.lng && i3.lng <= n3.lng;
        },
        intersects: function(e4) {
          e4 = ie2(e4);
          var t4 = this._southWest, n3 = this._northEast, r3 = e4.getSouthWest(), i3 = e4.getNorthEast(), a3 = i3.lat >= t4.lat && r3.lat <= n3.lat, o3 = i3.lng >= t4.lng && r3.lng <= n3.lng;
          return a3 && o3;
        },
        overlaps: function(e4) {
          e4 = ie2(e4);
          var t4 = this._southWest, n3 = this._northEast, r3 = e4.getSouthWest(), i3 = e4.getNorthEast(), a3 = i3.lat > t4.lat && r3.lat < n3.lat, o3 = i3.lng > t4.lng && r3.lng < n3.lng;
          return a3 && o3;
        },
        toBBoxString: function() {
          return [
            this.getWest(),
            this.getSouth(),
            this.getEast(),
            this.getNorth()
          ].join(`,`);
        },
        equals: function(e4, t4) {
          return e4 ? (e4 = ie2(e4), this._southWest.equals(e4.getSouthWest(), t4) && this._northEast.equals(e4.getNorthEast(), t4)) : false;
        },
        isValid: function() {
          return !!(this._southWest && this._northEast);
        }
      };
      function ie2(e4, t4) {
        return e4 instanceof N2 ? e4 : new N2(e4, t4);
      }
      function P2(e4, t4, n3) {
        if (isNaN(e4) || isNaN(t4)) throw Error(`Invalid LatLng object: (` + e4 + `, ` + t4 + `)`);
        this.lat = +e4, this.lng = +t4, n3 !== void 0 && (this.alt = +n3);
      }
      P2.prototype = {
        equals: function(e4, t4) {
          return e4 ? (e4 = F2(e4), Math.max(Math.abs(this.lat - e4.lat), Math.abs(this.lng - e4.lng)) <= (t4 === void 0 ? 1e-9 : t4)) : false;
        },
        toString: function(e4) {
          return `LatLng(` + u2(this.lat, e4) + `, ` + u2(this.lng, e4) + `)`;
        },
        distanceTo: function(e4) {
          return oe2.distance(this, F2(e4));
        },
        wrap: function() {
          return oe2.wrapLatLng(this);
        },
        toBounds: function(e4) {
          var t4 = 180 * e4 / 40075017, n3 = t4 / Math.cos(Math.PI / 180 * this.lat);
          return ie2([
            this.lat - t4,
            this.lng - n3
          ], [
            this.lat + t4,
            this.lng + n3
          ]);
        },
        clone: function() {
          return new P2(this.lat, this.lng, this.alt);
        }
      };
      function F2(e4, t4, n3) {
        return e4 instanceof P2 ? e4 : _2(e4) && typeof e4[0] != `object` ? e4.length === 3 ? new P2(e4[0], e4[1], e4[2]) : e4.length === 2 ? new P2(e4[0], e4[1]) : null : e4 == null ? e4 : typeof e4 == `object` && `lat` in e4 ? new P2(e4.lat, `lng` in e4 ? e4.lng : e4.lon, e4.alt) : t4 === void 0 ? null : new P2(e4, t4, n3);
      }
      var ae2 = {
        latLngToPoint: function(e4, t4) {
          var n3 = this.projection.project(e4), r3 = this.scale(t4);
          return this.transformation._transform(n3, r3);
        },
        pointToLatLng: function(e4, t4) {
          var n3 = this.scale(t4), r3 = this.transformation.untransform(e4, n3);
          return this.projection.unproject(r3);
        },
        project: function(e4) {
          return this.projection.project(e4);
        },
        unproject: function(e4) {
          return this.projection.unproject(e4);
        },
        scale: function(e4) {
          return 256 * 2 ** e4;
        },
        zoom: function(e4) {
          return Math.log(e4 / 256) / Math.LN2;
        },
        getProjectedBounds: function(e4) {
          if (this.infinite) return null;
          var t4 = this.projection.bounds, n3 = this.scale(e4);
          return new j2(this.transformation.transform(t4.min, n3), this.transformation.transform(t4.max, n3));
        },
        infinite: false,
        wrapLatLng: function(e4) {
          var t4 = this.wrapLng ? c2(e4.lng, this.wrapLng, true) : e4.lng, n3 = this.wrapLat ? c2(e4.lat, this.wrapLat, true) : e4.lat, r3 = e4.alt;
          return new P2(n3, t4, r3);
        },
        wrapLatLngBounds: function(e4) {
          var t4 = e4.getCenter(), n3 = this.wrapLatLng(t4), r3 = t4.lat - n3.lat, i3 = t4.lng - n3.lng;
          if (r3 === 0 && i3 === 0) return e4;
          var a3 = e4.getSouthWest(), o3 = e4.getNorthEast();
          return new N2(new P2(a3.lat - r3, a3.lng - i3), new P2(o3.lat - r3, o3.lng - i3));
        }
      }, oe2 = n2({}, ae2, {
        wrapLng: [
          -180,
          180
        ],
        R: 6371e3,
        distance: function(e4, t4) {
          var n3 = Math.PI / 180, r3 = e4.lat * n3, i3 = t4.lat * n3, a3 = Math.sin((t4.lat - e4.lat) * n3 / 2), o3 = Math.sin((t4.lng - e4.lng) * n3 / 2), s3 = a3 * a3 + Math.cos(r3) * Math.cos(i3) * o3 * o3, c3 = 2 * Math.atan2(Math.sqrt(s3), Math.sqrt(1 - s3));
          return this.R * c3;
        }
      }), se2 = 6378137, ce2 = {
        R: se2,
        MAX_LATITUDE: 85.0511287798,
        project: function(e4) {
          var t4 = Math.PI / 180, n3 = this.MAX_LATITUDE, r3 = Math.max(Math.min(n3, e4.lat), -n3), i3 = Math.sin(r3 * t4);
          return new O2(this.R * e4.lng * t4, this.R * Math.log((1 + i3) / (1 - i3)) / 2);
        },
        unproject: function(e4) {
          var t4 = 180 / Math.PI;
          return new P2((2 * Math.atan(Math.exp(e4.y / this.R)) - Math.PI / 2) * t4, e4.x * t4 / this.R);
        },
        bounds: (function() {
          var e4 = se2 * Math.PI;
          return new j2([
            -e4,
            -e4
          ], [
            e4,
            e4
          ]);
        })()
      };
      function le2(e4, t4, n3, r3) {
        if (_2(e4)) {
          this._a = e4[0], this._b = e4[1], this._c = e4[2], this._d = e4[3];
          return;
        }
        this._a = e4, this._b = t4, this._c = n3, this._d = r3;
      }
      le2.prototype = {
        transform: function(e4, t4) {
          return this._transform(e4.clone(), t4);
        },
        _transform: function(e4, t4) {
          return t4 ||= 1, e4.x = t4 * (this._a * e4.x + this._b), e4.y = t4 * (this._c * e4.y + this._d), e4;
        },
        untransform: function(e4, t4) {
          return t4 ||= 1, new O2((e4.x / t4 - this._b) / this._a, (e4.y / t4 - this._d) / this._c);
        }
      };
      function ue2(e4, t4, n3, r3) {
        return new le2(e4, t4, n3, r3);
      }
      var de2 = n2({}, oe2, {
        code: `EPSG:3857`,
        projection: ce2,
        transformation: (function() {
          var e4 = 0.5 / (Math.PI * ce2.R);
          return ue2(e4, 0.5, -e4, 0.5);
        })()
      }), fe2 = n2({}, de2, {
        code: `EPSG:900913`
      });
      function pe2(e4) {
        return document.createElementNS(`http://www.w3.org/2000/svg`, e4);
      }
      function me2(e4, t4) {
        var n3 = ``, r3, i3, a3, o3, s3, c3;
        for (r3 = 0, a3 = e4.length; r3 < a3; r3++) {
          for (s3 = e4[r3], i3 = 0, o3 = s3.length; i3 < o3; i3++) c3 = s3[i3], n3 += (i3 ? `L` : `M`) + c3.x + ` ` + c3.y;
          n3 += t4 ? z2.svg ? `z` : `x` : ``;
        }
        return n3 || `M0 0`;
      }
      var he2 = document.documentElement.style, ge2 = `ActiveXObject` in window, _e2 = ge2 && !document.addEventListener, ve2 = `msLaunchUri` in navigator && !(`documentMode` in document), ye2 = Xe2(`webkit`), be2 = Xe2(`android`), xe2 = Xe2(`android 2`) || Xe2(`android 3`), Se2 = parseInt(/WebKit\/([0-9]+)|$/.exec(navigator.userAgent)[1], 10), Ce2 = be2 && Xe2(`Google`) && Se2 < 537 && !(`AudioNode` in window), we2 = !!window.opera, Te2 = !ve2 && Xe2(`chrome`), Ee2 = Xe2(`gecko`) && !ye2 && !we2 && !ge2, De2 = !Te2 && Xe2(`safari`), Oe2 = Xe2(`phantom`), ke2 = `OTransition` in he2, Ae2 = navigator.platform.indexOf(`Win`) === 0, je2 = ge2 && `transition` in he2, Me2 = `WebKitCSSMatrix` in window && `m11` in new window.WebKitCSSMatrix() && !xe2, Ne2 = `MozPerspective` in he2, Pe2 = !window.L_DISABLE_3D && (je2 || Me2 || Ne2) && !ke2 && !Oe2, Fe2 = typeof orientation < `u` || Xe2(`mobile`), Ie2 = Fe2 && ye2, I2 = Fe2 && Me2, Le2 = !window.PointerEvent && window.MSPointerEvent, Re2 = !!(window.PointerEvent || Le2), ze2 = `ontouchstart` in window || !!window.TouchEvent, Be2 = !window.L_NO_TOUCH && (ze2 || Re2), R2 = Fe2 && we2, Ve2 = Fe2 && Ee2, He2 = (window.devicePixelRatio || window.screen.deviceXDPI / window.screen.logicalXDPI) > 1, Ue2 = (function() {
        var e4 = false;
        try {
          var t4 = Object.defineProperty({}, "passive", {
            get: function() {
              e4 = true;
            }
          });
          window.addEventListener(`testPassiveEventSupport`, l2, t4), window.removeEventListener(`testPassiveEventSupport`, l2, t4);
        } catch {
        }
        return e4;
      })(), We2 = (function() {
        return !!document.createElement(`canvas`).getContext;
      })(), Ge2 = !!(document.createElementNS && pe2(`svg`).createSVGRect), Ke2 = !!Ge2 && (function() {
        var e4 = document.createElement(`div`);
        return e4.innerHTML = `<svg/>`, (e4.firstChild && e4.firstChild.namespaceURI) === `http://www.w3.org/2000/svg`;
      })(), qe2 = !Ge2 && (function() {
        try {
          var e4 = document.createElement(`div`);
          e4.innerHTML = `<v:shape adj="1"/>`;
          var t4 = e4.firstChild;
          return t4.style.behavior = `url(#default#VML)`, t4 && typeof t4.adj == `object`;
        } catch {
          return false;
        }
      })(), Je2 = navigator.platform.indexOf(`Mac`) === 0, Ye2 = navigator.platform.indexOf(`Linux`) === 0;
      function Xe2(e4) {
        return navigator.userAgent.toLowerCase().indexOf(e4) >= 0;
      }
      var z2 = {
        ie: ge2,
        ielt9: _e2,
        edge: ve2,
        webkit: ye2,
        android: be2,
        android23: xe2,
        androidStock: Ce2,
        opera: we2,
        chrome: Te2,
        gecko: Ee2,
        safari: De2,
        phantom: Oe2,
        opera12: ke2,
        win: Ae2,
        ie3d: je2,
        webkit3d: Me2,
        gecko3d: Ne2,
        any3d: Pe2,
        mobile: Fe2,
        mobileWebkit: Ie2,
        mobileWebkit3d: I2,
        msPointer: Le2,
        pointer: Re2,
        touch: Be2,
        touchNative: ze2,
        mobileOpera: R2,
        mobileGecko: Ve2,
        retina: He2,
        passiveEvents: Ue2,
        canvas: We2,
        svg: Ge2,
        vml: qe2,
        inlineSvg: Ke2,
        mac: Je2,
        linux: Ye2
      }, Ze2 = z2.msPointer ? `MSPointerDown` : `pointerdown`, Qe2 = z2.msPointer ? `MSPointerMove` : `pointermove`, $e2 = z2.msPointer ? `MSPointerUp` : `pointerup`, et2 = z2.msPointer ? `MSPointerCancel` : `pointercancel`, tt2 = {
        touchstart: Ze2,
        touchmove: Qe2,
        touchend: $e2,
        touchcancel: et2
      }, nt2 = {
        touchstart: ft2,
        touchmove: dt2,
        touchend: dt2,
        touchcancel: dt2
      }, rt2 = {}, it2 = false;
      function at2(e4, t4, n3) {
        return t4 === `touchstart` && ut2(), nt2[t4] ? (n3 = nt2[t4].bind(this, n3), e4.addEventListener(tt2[t4], n3, false), n3) : (console.warn(`wrong event specified:`, t4), l2);
      }
      function ot2(e4, t4, n3) {
        if (!tt2[t4]) {
          console.warn(`wrong event specified:`, t4);
          return;
        }
        e4.removeEventListener(tt2[t4], n3, false);
      }
      function st2(e4) {
        rt2[e4.pointerId] = e4;
      }
      function ct2(e4) {
        rt2[e4.pointerId] && (rt2[e4.pointerId] = e4);
      }
      function lt2(e4) {
        delete rt2[e4.pointerId];
      }
      function ut2() {
        it2 ||= (document.addEventListener(Ze2, st2, true), document.addEventListener(Qe2, ct2, true), document.addEventListener($e2, lt2, true), document.addEventListener(et2, lt2, true), true);
      }
      function dt2(e4, t4) {
        if (t4.pointerType !== (t4.MSPOINTER_TYPE_MOUSE || `mouse`)) {
          for (var n3 in t4.touches = [], rt2) t4.touches.push(rt2[n3]);
          t4.changedTouches = [
            t4
          ], e4(t4);
        }
      }
      function ft2(e4, t4) {
        t4.MSPOINTER_TYPE_TOUCH && t4.pointerType === t4.MSPOINTER_TYPE_TOUCH && en2(t4), dt2(e4, t4);
      }
      function pt2(e4) {
        var t4 = {}, n3, r3;
        for (r3 in e4) n3 = e4[r3], t4[r3] = n3 && n3.bind ? n3.bind(e4) : n3;
        return e4 = t4, t4.type = `dblclick`, t4.detail = 2, t4.isTrusted = false, t4._simulated = true, t4;
      }
      var mt2 = 200;
      function ht2(e4, t4) {
        e4.addEventListener(`dblclick`, t4);
        var n3 = 0, r3;
        function i3(e5) {
          if (e5.detail !== 1) {
            r3 = e5.detail;
            return;
          }
          if (!(e5.pointerType === `mouse` || e5.sourceCapabilities && !e5.sourceCapabilities.firesTouchEvents)) {
            var i4 = nn2(e5);
            if (!(i4.some(function(e6) {
              return e6 instanceof HTMLLabelElement && e6.attributes.for;
            }) && !i4.some(function(e6) {
              return e6 instanceof HTMLInputElement || e6 instanceof HTMLSelectElement;
            }))) {
              var a3 = Date.now();
              a3 - n3 <= mt2 ? (r3++, r3 === 2 && t4(pt2(e5))) : r3 = 1, n3 = a3;
            }
          }
        }
        return e4.addEventListener(`click`, i3), {
          dblclick: t4,
          simDblclick: i3
        };
      }
      function gt2(e4, t4) {
        e4.removeEventListener(`dblclick`, t4.dblclick), e4.removeEventListener(`click`, t4.simDblclick);
      }
      var _t2 = kt2([
        `transform`,
        `webkitTransform`,
        `OTransform`,
        `MozTransform`,
        `msTransform`
      ]), vt2 = kt2([
        `webkitTransition`,
        `transition`,
        `OTransition`,
        `MozTransition`,
        `msTransition`
      ]), B2 = vt2 === `webkitTransition` || vt2 === `OTransition` ? vt2 + `End` : `transitionend`;
      function yt2(e4) {
        return typeof e4 == `string` ? document.getElementById(e4) : e4;
      }
      function V2(e4, t4) {
        var n3 = e4.style[t4] || e4.currentStyle && e4.currentStyle[t4];
        if ((!n3 || n3 === `auto`) && document.defaultView) {
          var r3 = document.defaultView.getComputedStyle(e4, null);
          n3 = r3 ? r3[t4] : null;
        }
        return n3 === `auto` ? null : n3;
      }
      function H2(e4, t4, n3) {
        var r3 = document.createElement(e4);
        return r3.className = t4 || ``, n3 && n3.appendChild(r3), r3;
      }
      function U2(e4) {
        var t4 = e4.parentNode;
        t4 && t4.removeChild(e4);
      }
      function bt2(e4) {
        for (; e4.firstChild; ) e4.removeChild(e4.firstChild);
      }
      function xt2(e4) {
        var t4 = e4.parentNode;
        t4 && t4.lastChild !== e4 && t4.appendChild(e4);
      }
      function St2(e4) {
        var t4 = e4.parentNode;
        t4 && t4.firstChild !== e4 && t4.insertBefore(e4, t4.firstChild);
      }
      function Ct2(e4, t4) {
        if (e4.classList !== void 0) return e4.classList.contains(t4);
        var n3 = Et2(e4);
        return n3.length > 0 && RegExp(`(^|\\s)` + t4 + `(\\s|$)`).test(n3);
      }
      function W2(e4, t4) {
        if (e4.classList !== void 0) for (var n3 = f2(t4), r3 = 0, i3 = n3.length; r3 < i3; r3++) e4.classList.add(n3[r3]);
        else if (!Ct2(e4, t4)) {
          var a3 = Et2(e4);
          Tt2(e4, (a3 ? a3 + ` ` : ``) + t4);
        }
      }
      function wt2(e4, t4) {
        e4.classList === void 0 ? Tt2(e4, d2((` ` + Et2(e4) + ` `).replace(` ` + t4 + ` `, ` `))) : e4.classList.remove(t4);
      }
      function Tt2(e4, t4) {
        e4.className.baseVal === void 0 ? e4.className = t4 : e4.className.baseVal = t4;
      }
      function Et2(e4) {
        return e4.correspondingElement && (e4 = e4.correspondingElement), e4.className.baseVal === void 0 ? e4.className : e4.className.baseVal;
      }
      function Dt2(e4, t4) {
        `opacity` in e4.style ? e4.style.opacity = t4 : `filter` in e4.style && Ot2(e4, t4);
      }
      function Ot2(e4, t4) {
        var n3 = false, r3 = `DXImageTransform.Microsoft.Alpha`;
        try {
          n3 = e4.filters.item(r3);
        } catch {
          if (t4 === 1) return;
        }
        t4 = Math.round(t4 * 100), n3 ? (n3.Enabled = t4 !== 100, n3.Opacity = t4) : e4.style.filter += ` progid:` + r3 + `(opacity=` + t4 + `)`;
      }
      function kt2(e4) {
        for (var t4 = document.documentElement.style, n3 = 0; n3 < e4.length; n3++) if (e4[n3] in t4) return e4[n3];
        return false;
      }
      function At2(e4, t4, n3) {
        var r3 = t4 || new O2(0, 0);
        e4.style[_t2] = (z2.ie3d ? `translate(` + r3.x + `px,` + r3.y + `px)` : `translate3d(` + r3.x + `px,` + r3.y + `px,0)`) + (n3 ? ` scale(` + n3 + `)` : ``);
      }
      function jt2(e4, t4) {
        e4._leaflet_pos = t4, z2.any3d ? At2(e4, t4) : (e4.style.left = t4.x + `px`, e4.style.top = t4.y + `px`);
      }
      function Mt2(e4) {
        return e4._leaflet_pos || new O2(0, 0);
      }
      var Nt2, Pt2, Ft2;
      if (`onselectstart` in document) Nt2 = function() {
        G2(window, `selectstart`, en2);
      }, Pt2 = function() {
        K2(window, `selectstart`, en2);
      };
      else {
        var It2 = kt2([
          `userSelect`,
          `WebkitUserSelect`,
          `OUserSelect`,
          `MozUserSelect`,
          `msUserSelect`
        ]);
        Nt2 = function() {
          if (It2) {
            var e4 = document.documentElement.style;
            Ft2 = e4[It2], e4[It2] = `none`;
          }
        }, Pt2 = function() {
          It2 && (document.documentElement.style[It2] = Ft2, Ft2 = void 0);
        };
      }
      function Lt2() {
        G2(window, `dragstart`, en2);
      }
      function Rt2() {
        K2(window, `dragstart`, en2);
      }
      var zt2, Bt2;
      function Vt2(e4) {
        for (; e4.tabIndex === -1; ) e4 = e4.parentNode;
        e4.style && (Ht2(), zt2 = e4, Bt2 = e4.style.outlineStyle, e4.style.outlineStyle = `none`, G2(window, `keydown`, Ht2));
      }
      function Ht2() {
        zt2 && (zt2.style.outlineStyle = Bt2, zt2 = void 0, Bt2 = void 0, K2(window, `keydown`, Ht2));
      }
      function Ut2(e4) {
        do
          e4 = e4.parentNode;
        while ((!e4.offsetWidth || !e4.offsetHeight) && e4 !== document.body);
        return e4;
      }
      function Wt2(e4) {
        var t4 = e4.getBoundingClientRect();
        return {
          x: t4.width / e4.offsetWidth || 1,
          y: t4.height / e4.offsetHeight || 1,
          boundingClientRect: t4
        };
      }
      var Gt2 = {
        __proto__: null,
        TRANSFORM: _t2,
        TRANSITION: vt2,
        TRANSITION_END: B2,
        get: yt2,
        getStyle: V2,
        create: H2,
        remove: U2,
        empty: bt2,
        toFront: xt2,
        toBack: St2,
        hasClass: Ct2,
        addClass: W2,
        removeClass: wt2,
        setClass: Tt2,
        getClass: Et2,
        setOpacity: Dt2,
        testProp: kt2,
        setTransform: At2,
        setPosition: jt2,
        getPosition: Mt2,
        get disableTextSelection() {
          return Nt2;
        },
        get enableTextSelection() {
          return Pt2;
        },
        disableImageDrag: Lt2,
        enableImageDrag: Rt2,
        preventOutline: Vt2,
        restoreOutline: Ht2,
        getSizedParentNode: Ut2,
        getScale: Wt2
      };
      function G2(e4, t4, n3, r3) {
        if (t4 && typeof t4 == `object`) for (var i3 in t4) Yt2(e4, i3, t4[i3], n3);
        else {
          t4 = f2(t4);
          for (var a3 = 0, o3 = t4.length; a3 < o3; a3++) Yt2(e4, t4[a3], n3, r3);
        }
        return this;
      }
      var Kt2 = `_leaflet_events`;
      function K2(e4, t4, n3, r3) {
        if (arguments.length === 1) qt2(e4), delete e4[Kt2];
        else if (t4 && typeof t4 == `object`) for (var i3 in t4) Xt2(e4, i3, t4[i3], n3);
        else if (t4 = f2(t4), arguments.length === 2) qt2(e4, function(e5) {
          return v2(t4, e5) !== -1;
        });
        else for (var a3 = 0, o3 = t4.length; a3 < o3; a3++) Xt2(e4, t4[a3], n3, r3);
        return this;
      }
      function qt2(e4, t4) {
        for (var n3 in e4[Kt2]) {
          var r3 = n3.split(/\d/)[0];
          (!t4 || t4(r3)) && Xt2(e4, r3, null, null, n3);
        }
      }
      var Jt2 = {
        mouseenter: `mouseover`,
        mouseleave: `mouseout`,
        wheel: !(`onwheel` in window) && `mousewheel`
      };
      function Yt2(e4, t4, n3, r3) {
        var i3 = t4 + o2(n3) + (r3 ? `_` + o2(r3) : ``);
        if (e4[Kt2] && e4[Kt2][i3]) return this;
        var a3 = function(t5) {
          return n3.call(r3 || e4, t5 || window.event);
        }, s3 = a3;
        !z2.touchNative && z2.pointer && t4.indexOf(`touch`) === 0 ? a3 = at2(e4, t4, a3) : z2.touch && t4 === `dblclick` ? a3 = ht2(e4, a3) : `addEventListener` in e4 ? t4 === `touchstart` || t4 === `touchmove` || t4 === `wheel` || t4 === `mousewheel` ? e4.addEventListener(Jt2[t4] || t4, a3, z2.passiveEvents ? {
          passive: false
        } : false) : t4 === `mouseenter` || t4 === `mouseleave` ? (a3 = function(t5) {
          t5 ||= window.event, sn2(e4, t5) && s3(t5);
        }, e4.addEventListener(Jt2[t4], a3, false)) : e4.addEventListener(t4, s3, false) : e4.attachEvent(`on` + t4, a3), e4[Kt2] = e4[Kt2] || {}, e4[Kt2][i3] = a3;
      }
      function Xt2(e4, t4, n3, r3, i3) {
        i3 ||= t4 + o2(n3) + (r3 ? `_` + o2(r3) : ``);
        var a3 = e4[Kt2] && e4[Kt2][i3];
        if (!a3) return this;
        !z2.touchNative && z2.pointer && t4.indexOf(`touch`) === 0 ? ot2(e4, t4, a3) : z2.touch && t4 === `dblclick` ? gt2(e4, a3) : `removeEventListener` in e4 ? e4.removeEventListener(Jt2[t4] || t4, a3, false) : e4.detachEvent(`on` + t4, a3), e4[Kt2][i3] = null;
      }
      function Zt2(e4) {
        return e4.stopPropagation ? e4.stopPropagation() : e4.originalEvent ? e4.originalEvent._stopped = true : e4.cancelBubble = true, this;
      }
      function Qt2(e4) {
        return Yt2(e4, `wheel`, Zt2), this;
      }
      function $t2(e4) {
        return G2(e4, `mousedown touchstart dblclick contextmenu`, Zt2), e4._leaflet_disable_click = true, this;
      }
      function en2(e4) {
        return e4.preventDefault ? e4.preventDefault() : e4.returnValue = false, this;
      }
      function tn2(e4) {
        return en2(e4), Zt2(e4), this;
      }
      function nn2(e4) {
        if (e4.composedPath) return e4.composedPath();
        for (var t4 = [], n3 = e4.target; n3; ) t4.push(n3), n3 = n3.parentNode;
        return t4;
      }
      function rn2(e4, t4) {
        if (!t4) return new O2(e4.clientX, e4.clientY);
        var n3 = Wt2(t4), r3 = n3.boundingClientRect;
        return new O2((e4.clientX - r3.left) / n3.x - t4.clientLeft, (e4.clientY - r3.top) / n3.y - t4.clientTop);
      }
      var an2 = z2.linux && z2.chrome ? window.devicePixelRatio : z2.mac ? window.devicePixelRatio * 3 : window.devicePixelRatio > 0 ? 2 * window.devicePixelRatio : 1;
      function on2(e4) {
        return z2.edge ? e4.wheelDeltaY / 2 : e4.deltaY && e4.deltaMode === 0 ? -e4.deltaY / an2 : e4.deltaY && e4.deltaMode === 1 ? -e4.deltaY * 20 : e4.deltaY && e4.deltaMode === 2 ? -e4.deltaY * 60 : e4.deltaX || e4.deltaZ ? 0 : e4.wheelDelta ? (e4.wheelDeltaY || e4.wheelDelta) / 2 : e4.detail && Math.abs(e4.detail) < 32765 ? -e4.detail * 20 : e4.detail ? e4.detail / -32765 * 60 : 0;
      }
      function sn2(e4, t4) {
        var n3 = t4.relatedTarget;
        if (!n3) return true;
        try {
          for (; n3 && n3 !== e4; ) n3 = n3.parentNode;
        } catch {
          return false;
        }
        return n3 !== e4;
      }
      var cn2 = {
        __proto__: null,
        on: G2,
        off: K2,
        stopPropagation: Zt2,
        disableScrollPropagation: Qt2,
        disableClickPropagation: $t2,
        preventDefault: en2,
        stop: tn2,
        getPropagationPath: nn2,
        getMousePosition: rn2,
        getWheelDelta: on2,
        isExternalTarget: sn2,
        addListener: G2,
        removeListener: K2
      }, ln2 = D2.extend({
        run: function(e4, t4, n3, r3) {
          this.stop(), this._el = e4, this._inProgress = true, this._duration = n3 || 0.25, this._easeOutPower = 1 / Math.max(r3 || 0.5, 0.2), this._startPos = Mt2(e4), this._offset = t4.subtract(this._startPos), this._startTime = +/* @__PURE__ */ new Date(), this.fire(`start`), this._animate();
        },
        stop: function() {
          this._inProgress && (this._step(true), this._complete());
        },
        _animate: function() {
          this._animId = ee2(this._animate, this), this._step();
        },
        _step: function(e4) {
          var t4 = +/* @__PURE__ */ new Date() - this._startTime, n3 = this._duration * 1e3;
          t4 < n3 ? this._runFrame(this._easeOut(t4 / n3), e4) : (this._runFrame(1), this._complete());
        },
        _runFrame: function(e4, t4) {
          var n3 = this._startPos.add(this._offset.multiplyBy(e4));
          t4 && n3._round(), jt2(this._el, n3), this.fire(`step`);
        },
        _complete: function() {
          T2(this._animId), this._inProgress = false, this.fire(`end`);
        },
        _easeOut: function(e4) {
          return 1 - (1 - e4) ** this._easeOutPower;
        }
      }), q2 = D2.extend({
        options: {
          crs: de2,
          center: void 0,
          zoom: void 0,
          minZoom: void 0,
          maxZoom: void 0,
          layers: [],
          maxBounds: void 0,
          renderer: void 0,
          zoomAnimation: true,
          zoomAnimationThreshold: 4,
          fadeAnimation: true,
          markerZoomAnimation: true,
          transform3DLimit: 8388608,
          zoomSnap: 1,
          zoomDelta: 1,
          trackResize: true
        },
        initialize: function(e4, t4) {
          t4 = p2(this, t4), this._handlers = [], this._layers = {}, this._zoomBoundLayers = {}, this._sizeChanged = true, this._initContainer(e4), this._initLayout(), this._onResize = i2(this._onResize, this), this._initEvents(), t4.maxBounds && this.setMaxBounds(t4.maxBounds), t4.zoom !== void 0 && (this._zoom = this._limitZoom(t4.zoom)), t4.center && t4.zoom !== void 0 && this.setView(F2(t4.center), t4.zoom, {
            reset: true
          }), this.callInitHooks(), this._zoomAnimated = vt2 && z2.any3d && !z2.mobileOpera && this.options.zoomAnimation, this._zoomAnimated && (this._createAnimProxy(), G2(this._proxy, B2, this._catchTransitionEnd, this)), this._addLayers(this.options.layers);
        },
        setView: function(e4, t4, r3) {
          return t4 = t4 === void 0 ? this._zoom : this._limitZoom(t4), e4 = this._limitCenter(F2(e4), t4, this.options.maxBounds), r3 ||= {}, this._stop(), this._loaded && !r3.reset && r3 !== true && (r3.animate !== void 0 && (r3.zoom = n2({
            animate: r3.animate
          }, r3.zoom), r3.pan = n2({
            animate: r3.animate,
            duration: r3.duration
          }, r3.pan)), this._zoom === t4 ? this._tryAnimatedPan(e4, r3.pan) : this._tryAnimatedZoom && this._tryAnimatedZoom(e4, t4, r3.zoom)) ? (clearTimeout(this._sizeTimer), this) : (this._resetView(e4, t4, r3.pan && r3.pan.noMoveStart), this);
        },
        setZoom: function(e4, t4) {
          return this._loaded ? this.setView(this.getCenter(), e4, {
            zoom: t4
          }) : (this._zoom = e4, this);
        },
        zoomIn: function(e4, t4) {
          return e4 ||= z2.any3d ? this.options.zoomDelta : 1, this.setZoom(this._zoom + e4, t4);
        },
        zoomOut: function(e4, t4) {
          return e4 ||= z2.any3d ? this.options.zoomDelta : 1, this.setZoom(this._zoom - e4, t4);
        },
        setZoomAround: function(e4, t4, n3) {
          var r3 = this.getZoomScale(t4), i3 = this.getSize().divideBy(2), a3 = (e4 instanceof O2 ? e4 : this.latLngToContainerPoint(e4)).subtract(i3).multiplyBy(1 - 1 / r3), o3 = this.containerPointToLatLng(i3.add(a3));
          return this.setView(o3, t4, {
            zoom: n3
          });
        },
        _getBoundsCenterZoom: function(e4, t4) {
          t4 ||= {}, e4 = e4.getBounds ? e4.getBounds() : ie2(e4);
          var n3 = A2(t4.paddingTopLeft || t4.padding || [
            0,
            0
          ]), r3 = A2(t4.paddingBottomRight || t4.padding || [
            0,
            0
          ]), i3 = this.getBoundsZoom(e4, false, n3.add(r3));
          if (i3 = typeof t4.maxZoom == `number` ? Math.min(t4.maxZoom, i3) : i3, i3 === 1 / 0) return {
            center: e4.getCenter(),
            zoom: i3
          };
          var a3 = r3.subtract(n3).divideBy(2), o3 = this.project(e4.getSouthWest(), i3), s3 = this.project(e4.getNorthEast(), i3);
          return {
            center: this.unproject(o3.add(s3).divideBy(2).add(a3), i3),
            zoom: i3
          };
        },
        fitBounds: function(e4, t4) {
          if (e4 = ie2(e4), !e4.isValid()) throw Error(`Bounds are not valid.`);
          var n3 = this._getBoundsCenterZoom(e4, t4);
          return this.setView(n3.center, n3.zoom, t4);
        },
        fitWorld: function(e4) {
          return this.fitBounds([
            [
              -90,
              -180
            ],
            [
              90,
              180
            ]
          ], e4);
        },
        panTo: function(e4, t4) {
          return this.setView(e4, this._zoom, {
            pan: t4
          });
        },
        panBy: function(e4, t4) {
          if (e4 = A2(e4).round(), t4 ||= {}, !e4.x && !e4.y) return this.fire(`moveend`);
          if (t4.animate !== true && !this.getSize().contains(e4)) return this._resetView(this.unproject(this.project(this.getCenter()).add(e4)), this.getZoom()), this;
          if (this._panAnim || (this._panAnim = new ln2(), this._panAnim.on({
            step: this._onPanTransitionStep,
            end: this._onPanTransitionEnd
          }, this)), t4.noMoveStart || this.fire(`movestart`), t4.animate !== false) {
            W2(this._mapPane, `leaflet-pan-anim`);
            var n3 = this._getMapPanePos().subtract(e4).round();
            this._panAnim.run(this._mapPane, n3, t4.duration || 0.25, t4.easeLinearity);
          } else this._rawPanBy(e4), this.fire(`move`).fire(`moveend`);
          return this;
        },
        flyTo: function(e4, t4, n3) {
          if (n3 ||= {}, n3.animate === false || !z2.any3d) return this.setView(e4, t4, n3);
          this._stop();
          var r3 = this.project(this.getCenter()), i3 = this.project(e4), a3 = this.getSize(), o3 = this._zoom;
          e4 = F2(e4), t4 = t4 === void 0 ? o3 : t4;
          var s3 = Math.max(a3.x, a3.y), c3 = s3 * this.getZoomScale(o3, t4), l3 = i3.distanceTo(r3) || 1, u3 = 1.42, d3 = u3 * u3;
          function f3(e5) {
            var t5 = e5 ? -1 : 1, n4 = e5 ? c3 : s3, r4 = (c3 * c3 - s3 * s3 + t5 * d3 * d3 * l3 * l3) / (2 * n4 * d3 * l3), i4 = Math.sqrt(r4 * r4 + 1) - r4;
            return i4 < 1e-9 ? -18 : Math.log(i4);
          }
          function p3(e5) {
            return (Math.exp(e5) - Math.exp(-e5)) / 2;
          }
          function m3(e5) {
            return (Math.exp(e5) + Math.exp(-e5)) / 2;
          }
          function h3(e5) {
            return p3(e5) / m3(e5);
          }
          var g3 = f3(0);
          function _3(e5) {
            return s3 * (m3(g3) / m3(g3 + u3 * e5));
          }
          function v3(e5) {
            return s3 * (m3(g3) * h3(g3 + u3 * e5) - p3(g3)) / d3;
          }
          function y3(e5) {
            return 1 - (1 - e5) ** 1.5;
          }
          var b3 = Date.now(), x3 = (f3(1) - g3) / u3, S3 = n3.duration ? 1e3 * n3.duration : 1e3 * x3 * 0.8;
          function C3() {
            var n4 = (Date.now() - b3) / S3, a4 = y3(n4) * x3;
            n4 <= 1 ? (this._flyToFrame = ee2(C3, this), this._move(this.unproject(r3.add(i3.subtract(r3).multiplyBy(v3(a4) / l3)), o3), this.getScaleZoom(s3 / _3(a4), o3), {
              flyTo: true
            })) : this._move(e4, t4)._moveEnd(true);
          }
          return this._moveStart(true, n3.noMoveStart), C3.call(this), this;
        },
        flyToBounds: function(e4, t4) {
          var n3 = this._getBoundsCenterZoom(e4, t4);
          return this.flyTo(n3.center, n3.zoom, t4);
        },
        setMaxBounds: function(e4) {
          return e4 = ie2(e4), this.listens(`moveend`, this._panInsideMaxBounds) && this.off(`moveend`, this._panInsideMaxBounds), e4.isValid() ? (this.options.maxBounds = e4, this._loaded && this._panInsideMaxBounds(), this.on(`moveend`, this._panInsideMaxBounds)) : (this.options.maxBounds = null, this);
        },
        setMinZoom: function(e4) {
          var t4 = this.options.minZoom;
          return this.options.minZoom = e4, this._loaded && t4 !== e4 && (this.fire(`zoomlevelschange`), this.getZoom() < this.options.minZoom) ? this.setZoom(e4) : this;
        },
        setMaxZoom: function(e4) {
          var t4 = this.options.maxZoom;
          return this.options.maxZoom = e4, this._loaded && t4 !== e4 && (this.fire(`zoomlevelschange`), this.getZoom() > this.options.maxZoom) ? this.setZoom(e4) : this;
        },
        panInsideBounds: function(e4, t4) {
          this._enforcingBounds = true;
          var n3 = this.getCenter(), r3 = this._limitCenter(n3, this._zoom, ie2(e4));
          return n3.equals(r3) || this.panTo(r3, t4), this._enforcingBounds = false, this;
        },
        panInside: function(e4, t4) {
          t4 ||= {};
          var n3 = A2(t4.paddingTopLeft || t4.padding || [
            0,
            0
          ]), r3 = A2(t4.paddingBottomRight || t4.padding || [
            0,
            0
          ]), i3 = this.project(this.getCenter()), a3 = this.project(e4), o3 = this.getPixelBounds(), s3 = M2([
            o3.min.add(n3),
            o3.max.subtract(r3)
          ]), c3 = s3.getSize();
          if (!s3.contains(a3)) {
            this._enforcingBounds = true;
            var l3 = a3.subtract(s3.getCenter()), u3 = s3.extend(a3).getSize().subtract(c3);
            i3.x += l3.x < 0 ? -u3.x : u3.x, i3.y += l3.y < 0 ? -u3.y : u3.y, this.panTo(this.unproject(i3), t4), this._enforcingBounds = false;
          }
          return this;
        },
        invalidateSize: function(e4) {
          if (!this._loaded) return this;
          e4 = n2({
            animate: false,
            pan: true
          }, e4 === true ? {
            animate: true
          } : e4);
          var t4 = this.getSize();
          this._sizeChanged = true, this._lastCenter = null;
          var r3 = this.getSize(), a3 = t4.divideBy(2).round(), o3 = r3.divideBy(2).round(), s3 = a3.subtract(o3);
          return !s3.x && !s3.y ? this : (e4.animate && e4.pan ? this.panBy(s3) : (e4.pan && this._rawPanBy(s3), this.fire(`move`), e4.debounceMoveend ? (clearTimeout(this._sizeTimer), this._sizeTimer = setTimeout(i2(this.fire, this, `moveend`), 200)) : this.fire(`moveend`)), this.fire(`resize`, {
            oldSize: t4,
            newSize: r3
          }));
        },
        stop: function() {
          return this.setZoom(this._limitZoom(this._zoom)), this.options.zoomSnap || this.fire(`viewreset`), this._stop();
        },
        locate: function(e4) {
          if (e4 = this._locateOptions = n2({
            timeout: 1e4,
            watch: false
          }, e4), !(`geolocation` in navigator)) return this._handleGeolocationError({
            code: 0,
            message: `Geolocation not supported.`
          }), this;
          var t4 = i2(this._handleGeolocationResponse, this), r3 = i2(this._handleGeolocationError, this);
          return e4.watch ? this._locationWatchId = navigator.geolocation.watchPosition(t4, r3, e4) : navigator.geolocation.getCurrentPosition(t4, r3, e4), this;
        },
        stopLocate: function() {
          return navigator.geolocation && navigator.geolocation.clearWatch && navigator.geolocation.clearWatch(this._locationWatchId), this._locateOptions && (this._locateOptions.setView = false), this;
        },
        _handleGeolocationError: function(e4) {
          if (this._container._leaflet_id) {
            var t4 = e4.code, n3 = e4.message || (t4 === 1 ? `permission denied` : t4 === 2 ? `position unavailable` : `timeout`);
            this._locateOptions.setView && !this._loaded && this.fitWorld(), this.fire(`locationerror`, {
              code: t4,
              message: `Geolocation error: ` + n3 + `.`
            });
          }
        },
        _handleGeolocationResponse: function(e4) {
          if (this._container._leaflet_id) {
            var t4 = e4.coords.latitude, n3 = e4.coords.longitude, r3 = new P2(t4, n3), i3 = r3.toBounds(e4.coords.accuracy * 2), a3 = this._locateOptions;
            if (a3.setView) {
              var o3 = this.getBoundsZoom(i3);
              this.setView(r3, a3.maxZoom ? Math.min(o3, a3.maxZoom) : o3);
            }
            var s3 = {
              latlng: r3,
              bounds: i3,
              timestamp: e4.timestamp
            };
            for (var c3 in e4.coords) typeof e4.coords[c3] == `number` && (s3[c3] = e4.coords[c3]);
            this.fire(`locationfound`, s3);
          }
        },
        addHandler: function(e4, t4) {
          if (!t4) return this;
          var n3 = this[e4] = new t4(this);
          return this._handlers.push(n3), this.options[e4] && n3.enable(), this;
        },
        remove: function() {
          if (this._initEvents(true), this.options.maxBounds && this.off(`moveend`, this._panInsideMaxBounds), this._containerId !== this._container._leaflet_id) throw Error(`Map container is being reused by another instance`);
          try {
            delete this._container._leaflet_id, delete this._containerId;
          } catch {
            this._container._leaflet_id = void 0, this._containerId = void 0;
          }
          for (var e4 in this._locationWatchId !== void 0 && this.stopLocate(), this._stop(), U2(this._mapPane), this._clearControlPos && this._clearControlPos(), this._resizeRequest &&= (T2(this._resizeRequest), null), this._clearHandlers(), this._loaded && this.fire(`unload`), this._layers) this._layers[e4].remove();
          for (e4 in this._panes) U2(this._panes[e4]);
          return this._layers = [], this._panes = [], delete this._mapPane, delete this._renderer, this;
        },
        createPane: function(e4, t4) {
          var n3 = H2(`div`, `leaflet-pane` + (e4 ? ` leaflet-` + e4.replace(`Pane`, ``) + `-pane` : ``), t4 || this._mapPane);
          return e4 && (this._panes[e4] = n3), n3;
        },
        getCenter: function() {
          return this._checkIfLoaded(), this._lastCenter && !this._moved() ? this._lastCenter.clone() : this.layerPointToLatLng(this._getCenterLayerPoint());
        },
        getZoom: function() {
          return this._zoom;
        },
        getBounds: function() {
          var e4 = this.getPixelBounds();
          return new N2(this.unproject(e4.getBottomLeft()), this.unproject(e4.getTopRight()));
        },
        getMinZoom: function() {
          return this.options.minZoom === void 0 ? this._layersMinZoom || 0 : this.options.minZoom;
        },
        getMaxZoom: function() {
          return this.options.maxZoom === void 0 ? this._layersMaxZoom === void 0 ? 1 / 0 : this._layersMaxZoom : this.options.maxZoom;
        },
        getBoundsZoom: function(e4, t4, n3) {
          e4 = ie2(e4), n3 = A2(n3 || [
            0,
            0
          ]);
          var r3 = this.getZoom() || 0, i3 = this.getMinZoom(), a3 = this.getMaxZoom(), o3 = e4.getNorthWest(), s3 = e4.getSouthEast(), c3 = this.getSize().subtract(n3), l3 = M2(this.project(s3, r3), this.project(o3, r3)).getSize(), u3 = z2.any3d ? this.options.zoomSnap : 1, d3 = c3.x / l3.x, f3 = c3.y / l3.y, p3 = t4 ? Math.max(d3, f3) : Math.min(d3, f3);
          return r3 = this.getScaleZoom(p3, r3), u3 && (r3 = Math.round(r3 / (u3 / 100)) * (u3 / 100), r3 = t4 ? Math.ceil(r3 / u3) * u3 : Math.floor(r3 / u3) * u3), Math.max(i3, Math.min(a3, r3));
        },
        getSize: function() {
          return (!this._size || this._sizeChanged) && (this._size = new O2(this._container.clientWidth || 0, this._container.clientHeight || 0), this._sizeChanged = false), this._size.clone();
        },
        getPixelBounds: function(e4, t4) {
          var n3 = this._getTopLeftPoint(e4, t4);
          return new j2(n3, n3.add(this.getSize()));
        },
        getPixelOrigin: function() {
          return this._checkIfLoaded(), this._pixelOrigin;
        },
        getPixelWorldBounds: function(e4) {
          return this.options.crs.getProjectedBounds(e4 === void 0 ? this.getZoom() : e4);
        },
        getPane: function(e4) {
          return typeof e4 == `string` ? this._panes[e4] : e4;
        },
        getPanes: function() {
          return this._panes;
        },
        getContainer: function() {
          return this._container;
        },
        getZoomScale: function(e4, t4) {
          var n3 = this.options.crs;
          return t4 = t4 === void 0 ? this._zoom : t4, n3.scale(e4) / n3.scale(t4);
        },
        getScaleZoom: function(e4, t4) {
          var n3 = this.options.crs;
          t4 = t4 === void 0 ? this._zoom : t4;
          var r3 = n3.zoom(e4 * n3.scale(t4));
          return isNaN(r3) ? 1 / 0 : r3;
        },
        project: function(e4, t4) {
          return t4 = t4 === void 0 ? this._zoom : t4, this.options.crs.latLngToPoint(F2(e4), t4);
        },
        unproject: function(e4, t4) {
          return t4 = t4 === void 0 ? this._zoom : t4, this.options.crs.pointToLatLng(A2(e4), t4);
        },
        layerPointToLatLng: function(e4) {
          var t4 = A2(e4).add(this.getPixelOrigin());
          return this.unproject(t4);
        },
        latLngToLayerPoint: function(e4) {
          return this.project(F2(e4))._round()._subtract(this.getPixelOrigin());
        },
        wrapLatLng: function(e4) {
          return this.options.crs.wrapLatLng(F2(e4));
        },
        wrapLatLngBounds: function(e4) {
          return this.options.crs.wrapLatLngBounds(ie2(e4));
        },
        distance: function(e4, t4) {
          return this.options.crs.distance(F2(e4), F2(t4));
        },
        containerPointToLayerPoint: function(e4) {
          return A2(e4).subtract(this._getMapPanePos());
        },
        layerPointToContainerPoint: function(e4) {
          return A2(e4).add(this._getMapPanePos());
        },
        containerPointToLatLng: function(e4) {
          var t4 = this.containerPointToLayerPoint(A2(e4));
          return this.layerPointToLatLng(t4);
        },
        latLngToContainerPoint: function(e4) {
          return this.layerPointToContainerPoint(this.latLngToLayerPoint(F2(e4)));
        },
        mouseEventToContainerPoint: function(e4) {
          return rn2(e4, this._container);
        },
        mouseEventToLayerPoint: function(e4) {
          return this.containerPointToLayerPoint(this.mouseEventToContainerPoint(e4));
        },
        mouseEventToLatLng: function(e4) {
          return this.layerPointToLatLng(this.mouseEventToLayerPoint(e4));
        },
        _initContainer: function(e4) {
          var t4 = this._container = yt2(e4);
          if (!t4) throw Error(`Map container not found.`);
          if (t4._leaflet_id) throw Error(`Map container is already initialized.`);
          G2(t4, `scroll`, this._onScroll, this), this._containerId = o2(t4);
        },
        _initLayout: function() {
          var e4 = this._container;
          this._fadeAnimated = this.options.fadeAnimation && z2.any3d, W2(e4, `leaflet-container` + (z2.touch ? ` leaflet-touch` : ``) + (z2.retina ? ` leaflet-retina` : ``) + (z2.ielt9 ? ` leaflet-oldie` : ``) + (z2.safari ? ` leaflet-safari` : ``) + (this._fadeAnimated ? ` leaflet-fade-anim` : ``));
          var t4 = V2(e4, `position`);
          t4 !== `absolute` && t4 !== `relative` && t4 !== `fixed` && t4 !== `sticky` && (e4.style.position = `relative`), this._initPanes(), this._initControlPos && this._initControlPos();
        },
        _initPanes: function() {
          var e4 = this._panes = {};
          this._paneRenderers = {}, this._mapPane = this.createPane(`mapPane`, this._container), jt2(this._mapPane, new O2(0, 0)), this.createPane(`tilePane`), this.createPane(`overlayPane`), this.createPane(`shadowPane`), this.createPane(`markerPane`), this.createPane(`tooltipPane`), this.createPane(`popupPane`), this.options.markerZoomAnimation || (W2(e4.markerPane, `leaflet-zoom-hide`), W2(e4.shadowPane, `leaflet-zoom-hide`));
        },
        _resetView: function(e4, t4, n3) {
          jt2(this._mapPane, new O2(0, 0));
          var r3 = !this._loaded;
          this._loaded = true, t4 = this._limitZoom(t4), this.fire(`viewprereset`);
          var i3 = this._zoom !== t4;
          this._moveStart(i3, n3)._move(e4, t4)._moveEnd(i3), this.fire(`viewreset`), r3 && this.fire(`load`);
        },
        _moveStart: function(e4, t4) {
          return e4 && this.fire(`zoomstart`), t4 || this.fire(`movestart`), this;
        },
        _move: function(e4, t4, n3, r3) {
          t4 === void 0 && (t4 = this._zoom);
          var i3 = this._zoom !== t4;
          return this._zoom = t4, this._lastCenter = e4, this._pixelOrigin = this._getNewPixelOrigin(e4), r3 ? n3 && n3.pinch && this.fire(`zoom`, n3) : ((i3 || n3 && n3.pinch) && this.fire(`zoom`, n3), this.fire(`move`, n3)), this;
        },
        _moveEnd: function(e4) {
          return e4 && this.fire(`zoomend`), this.fire(`moveend`);
        },
        _stop: function() {
          return T2(this._flyToFrame), this._panAnim && this._panAnim.stop(), this;
        },
        _rawPanBy: function(e4) {
          jt2(this._mapPane, this._getMapPanePos().subtract(e4));
        },
        _getZoomSpan: function() {
          return this.getMaxZoom() - this.getMinZoom();
        },
        _panInsideMaxBounds: function() {
          this._enforcingBounds || this.panInsideBounds(this.options.maxBounds);
        },
        _checkIfLoaded: function() {
          if (!this._loaded) throw Error(`Set map center and zoom first.`);
        },
        _initEvents: function(e4) {
          this._targets = {}, this._targets[o2(this._container)] = this;
          var t4 = e4 ? K2 : G2;
          t4(this._container, `click dblclick mousedown mouseup mouseover mouseout mousemove contextmenu keypress keydown keyup`, this._handleDOMEvent, this), this.options.trackResize && t4(window, `resize`, this._onResize, this), z2.any3d && this.options.transform3DLimit && (e4 ? this.off : this.on).call(this, `moveend`, this._onMoveEnd);
        },
        _onResize: function() {
          T2(this._resizeRequest), this._resizeRequest = ee2(function() {
            this.invalidateSize({
              debounceMoveend: true
            });
          }, this);
        },
        _onScroll: function() {
          this._container.scrollTop = 0, this._container.scrollLeft = 0;
        },
        _onMoveEnd: function() {
          var e4 = this._getMapPanePos();
          Math.max(Math.abs(e4.x), Math.abs(e4.y)) >= this.options.transform3DLimit && this._resetView(this.getCenter(), this.getZoom());
        },
        _findEventTargets: function(e4, t4) {
          for (var n3 = [], r3, i3 = t4 === `mouseout` || t4 === `mouseover`, a3 = e4.target || e4.srcElement, s3 = false; a3; ) {
            if (r3 = this._targets[o2(a3)], r3 && (t4 === `click` || t4 === `preclick`) && this._draggableMoved(r3)) {
              s3 = true;
              break;
            }
            if (r3 && r3.listens(t4, true) && (i3 && !sn2(a3, e4) || (n3.push(r3), i3)) || a3 === this._container) break;
            a3 = a3.parentNode;
          }
          return !n3.length && !s3 && !i3 && this.listens(t4, true) && (n3 = [
            this
          ]), n3;
        },
        _isClickDisabled: function(e4) {
          for (; e4 && e4 !== this._container; ) {
            if (e4._leaflet_disable_click) return true;
            e4 = e4.parentNode;
          }
        },
        _handleDOMEvent: function(e4) {
          var t4 = e4.target || e4.srcElement;
          if (!(!this._loaded || t4._leaflet_disable_events || e4.type === `click` && this._isClickDisabled(t4))) {
            var n3 = e4.type;
            n3 === `mousedown` && Vt2(t4), this._fireDOMEvent(e4, n3);
          }
        },
        _mouseEvents: [
          `click`,
          `dblclick`,
          `mouseover`,
          `mouseout`,
          `contextmenu`
        ],
        _fireDOMEvent: function(e4, t4, r3) {
          if (e4.type === `click`) {
            var i3 = n2({}, e4);
            i3.type = `preclick`, this._fireDOMEvent(i3, i3.type, r3);
          }
          var a3 = this._findEventTargets(e4, t4);
          if (r3) {
            for (var o3 = [], s3 = 0; s3 < r3.length; s3++) r3[s3].listens(t4, true) && o3.push(r3[s3]);
            a3 = o3.concat(a3);
          }
          if (a3.length) {
            t4 === `contextmenu` && en2(e4);
            var c3 = a3[0], l3 = {
              originalEvent: e4
            };
            if (e4.type !== `keypress` && e4.type !== `keydown` && e4.type !== `keyup`) {
              var u3 = c3.getLatLng && (!c3._radius || c3._radius <= 10);
              l3.containerPoint = u3 ? this.latLngToContainerPoint(c3.getLatLng()) : this.mouseEventToContainerPoint(e4), l3.layerPoint = this.containerPointToLayerPoint(l3.containerPoint), l3.latlng = u3 ? c3.getLatLng() : this.layerPointToLatLng(l3.layerPoint);
            }
            for (s3 = 0; s3 < a3.length; s3++) if (a3[s3].fire(t4, l3, true), l3.originalEvent._stopped || a3[s3].options.bubblingMouseEvents === false && v2(this._mouseEvents, t4) !== -1) return;
          }
        },
        _draggableMoved: function(e4) {
          return e4 = e4.dragging && e4.dragging.enabled() ? e4 : this, e4.dragging && e4.dragging.moved() || this.boxZoom && this.boxZoom.moved();
        },
        _clearHandlers: function() {
          for (var e4 = 0, t4 = this._handlers.length; e4 < t4; e4++) this._handlers[e4].disable();
        },
        whenReady: function(e4, t4) {
          return this._loaded ? e4.call(t4 || this, {
            target: this
          }) : this.on(`load`, e4, t4), this;
        },
        _getMapPanePos: function() {
          return Mt2(this._mapPane) || new O2(0, 0);
        },
        _moved: function() {
          var e4 = this._getMapPanePos();
          return e4 && !e4.equals([
            0,
            0
          ]);
        },
        _getTopLeftPoint: function(e4, t4) {
          return (e4 && t4 !== void 0 ? this._getNewPixelOrigin(e4, t4) : this.getPixelOrigin()).subtract(this._getMapPanePos());
        },
        _getNewPixelOrigin: function(e4, t4) {
          var n3 = this.getSize()._divideBy(2);
          return this.project(e4, t4)._subtract(n3)._add(this._getMapPanePos())._round();
        },
        _latLngToNewLayerPoint: function(e4, t4, n3) {
          var r3 = this._getNewPixelOrigin(n3, t4);
          return this.project(e4, t4)._subtract(r3);
        },
        _latLngBoundsToNewLayerBounds: function(e4, t4, n3) {
          var r3 = this._getNewPixelOrigin(n3, t4);
          return M2([
            this.project(e4.getSouthWest(), t4)._subtract(r3),
            this.project(e4.getNorthWest(), t4)._subtract(r3),
            this.project(e4.getSouthEast(), t4)._subtract(r3),
            this.project(e4.getNorthEast(), t4)._subtract(r3)
          ]);
        },
        _getCenterLayerPoint: function() {
          return this.containerPointToLayerPoint(this.getSize()._divideBy(2));
        },
        _getCenterOffset: function(e4) {
          return this.latLngToLayerPoint(e4).subtract(this._getCenterLayerPoint());
        },
        _limitCenter: function(e4, t4, n3) {
          if (!n3) return e4;
          var r3 = this.project(e4, t4), i3 = this.getSize().divideBy(2), a3 = new j2(r3.subtract(i3), r3.add(i3)), o3 = this._getBoundsOffset(a3, n3, t4);
          return Math.abs(o3.x) <= 1 && Math.abs(o3.y) <= 1 ? e4 : this.unproject(r3.add(o3), t4);
        },
        _limitOffset: function(e4, t4) {
          if (!t4) return e4;
          var n3 = this.getPixelBounds(), r3 = new j2(n3.min.add(e4), n3.max.add(e4));
          return e4.add(this._getBoundsOffset(r3, t4));
        },
        _getBoundsOffset: function(e4, t4, n3) {
          var r3 = M2(this.project(t4.getNorthEast(), n3), this.project(t4.getSouthWest(), n3)), i3 = r3.min.subtract(e4.min), a3 = r3.max.subtract(e4.max);
          return new O2(this._rebound(i3.x, -a3.x), this._rebound(i3.y, -a3.y));
        },
        _rebound: function(e4, t4) {
          return e4 + t4 > 0 ? Math.round(e4 - t4) / 2 : Math.max(0, Math.ceil(e4)) - Math.max(0, Math.floor(t4));
        },
        _limitZoom: function(e4) {
          var t4 = this.getMinZoom(), n3 = this.getMaxZoom(), r3 = z2.any3d ? this.options.zoomSnap : 1;
          return r3 && (e4 = Math.round(e4 / r3) * r3), Math.max(t4, Math.min(n3, e4));
        },
        _onPanTransitionStep: function() {
          this.fire(`move`);
        },
        _onPanTransitionEnd: function() {
          wt2(this._mapPane, `leaflet-pan-anim`), this.fire(`moveend`);
        },
        _tryAnimatedPan: function(e4, t4) {
          var n3 = this._getCenterOffset(e4)._trunc();
          return (t4 && t4.animate) !== true && !this.getSize().contains(n3) ? false : (this.panBy(n3, t4), true);
        },
        _createAnimProxy: function() {
          var e4 = this._proxy = H2(`div`, `leaflet-proxy leaflet-zoom-animated`);
          this._panes.mapPane.appendChild(e4), this.on(`zoomanim`, function(e5) {
            var t4 = _t2, n3 = this._proxy.style[t4];
            At2(this._proxy, this.project(e5.center, e5.zoom), this.getZoomScale(e5.zoom, 1)), n3 === this._proxy.style[t4] && this._animatingZoom && this._onZoomTransitionEnd();
          }, this), this.on(`load moveend`, this._animMoveEnd, this), this._on(`unload`, this._destroyAnimProxy, this);
        },
        _destroyAnimProxy: function() {
          U2(this._proxy), this.off(`load moveend`, this._animMoveEnd, this), delete this._proxy;
        },
        _animMoveEnd: function() {
          var e4 = this.getCenter(), t4 = this.getZoom();
          At2(this._proxy, this.project(e4, t4), this.getZoomScale(t4, 1));
        },
        _catchTransitionEnd: function(e4) {
          this._animatingZoom && e4.propertyName.indexOf(`transform`) >= 0 && this._onZoomTransitionEnd();
        },
        _nothingToAnimate: function() {
          return !this._container.getElementsByClassName(`leaflet-zoom-animated`).length;
        },
        _tryAnimatedZoom: function(e4, t4, n3) {
          if (this._animatingZoom) return true;
          if (n3 ||= {}, !this._zoomAnimated || n3.animate === false || this._nothingToAnimate() || Math.abs(t4 - this._zoom) > this.options.zoomAnimationThreshold) return false;
          var r3 = this.getZoomScale(t4), i3 = this._getCenterOffset(e4)._divideBy(1 - 1 / r3);
          return n3.animate !== true && !this.getSize().contains(i3) ? false : (ee2(function() {
            this._moveStart(true, n3.noMoveStart || false)._animateZoom(e4, t4, true);
          }, this), true);
        },
        _animateZoom: function(e4, t4, n3, r3) {
          this._mapPane && (n3 && (this._animatingZoom = true, this._animateToCenter = e4, this._animateToZoom = t4, W2(this._mapPane, `leaflet-zoom-anim`)), this.fire(`zoomanim`, {
            center: e4,
            zoom: t4,
            noUpdate: r3
          }), this._tempFireZoomEvent ||= this._zoom !== this._animateToZoom, this._move(this._animateToCenter, this._animateToZoom, void 0, true), setTimeout(i2(this._onZoomTransitionEnd, this), 250));
        },
        _onZoomTransitionEnd: function() {
          this._animatingZoom && (this._mapPane && wt2(this._mapPane, `leaflet-zoom-anim`), this._animatingZoom = false, this._move(this._animateToCenter, this._animateToZoom, void 0, true), this._tempFireZoomEvent && this.fire(`zoom`), delete this._tempFireZoomEvent, this.fire(`move`), this._moveEnd(true));
        }
      });
      function un2(e4, t4) {
        return new q2(e4, t4);
      }
      var dn2 = ne2.extend({
        options: {
          position: `topright`
        },
        initialize: function(e4) {
          p2(this, e4);
        },
        getPosition: function() {
          return this.options.position;
        },
        setPosition: function(e4) {
          var t4 = this._map;
          return t4 && t4.removeControl(this), this.options.position = e4, t4 && t4.addControl(this), this;
        },
        getContainer: function() {
          return this._container;
        },
        addTo: function(e4) {
          this.remove(), this._map = e4;
          var t4 = this._container = this.onAdd(e4), n3 = this.getPosition(), r3 = e4._controlCorners[n3];
          return W2(t4, `leaflet-control`), n3.indexOf(`bottom`) === -1 ? r3.appendChild(t4) : r3.insertBefore(t4, r3.firstChild), this._map.on(`unload`, this.remove, this), this;
        },
        remove: function() {
          return this._map ? (U2(this._container), this.onRemove && this.onRemove(this._map), this._map.off(`unload`, this.remove, this), this._map = null, this) : this;
        },
        _refocusOnMap: function(e4) {
          this._map && e4 && e4.screenX > 0 && e4.screenY > 0 && this._map.getContainer().focus();
        }
      }), fn2 = function(e4) {
        return new dn2(e4);
      };
      q2.include({
        addControl: function(e4) {
          return e4.addTo(this), this;
        },
        removeControl: function(e4) {
          return e4.remove(), this;
        },
        _initControlPos: function() {
          var e4 = this._controlCorners = {}, t4 = `leaflet-`, n3 = this._controlContainer = H2(`div`, t4 + `control-container`, this._container);
          function r3(r4, i3) {
            var a3 = t4 + r4 + ` ` + t4 + i3;
            e4[r4 + i3] = H2(`div`, a3, n3);
          }
          r3(`top`, `left`), r3(`top`, `right`), r3(`bottom`, `left`), r3(`bottom`, `right`);
        },
        _clearControlPos: function() {
          for (var e4 in this._controlCorners) U2(this._controlCorners[e4]);
          U2(this._controlContainer), delete this._controlCorners, delete this._controlContainer;
        }
      });
      var pn2 = dn2.extend({
        options: {
          collapsed: true,
          position: `topright`,
          autoZIndex: true,
          hideSingleBase: false,
          sortLayers: false,
          sortFunction: function(e4, t4, n3, r3) {
            return n3 < r3 ? -1 : +(r3 < n3);
          }
        },
        initialize: function(e4, t4, n3) {
          for (var r3 in p2(this, n3), this._layerControlInputs = [], this._layers = [], this._lastZIndex = 0, this._handlingClick = false, this._preventClick = false, e4) this._addLayer(e4[r3], r3);
          for (r3 in t4) this._addLayer(t4[r3], r3, true);
        },
        onAdd: function(e4) {
          this._initLayout(), this._update(), this._map = e4, e4.on(`zoomend`, this._checkDisabledLayers, this);
          for (var t4 = 0; t4 < this._layers.length; t4++) this._layers[t4].layer.on(`add remove`, this._onLayerChange, this);
          return this._container;
        },
        addTo: function(e4) {
          return dn2.prototype.addTo.call(this, e4), this._expandIfNotCollapsed();
        },
        onRemove: function() {
          this._map.off(`zoomend`, this._checkDisabledLayers, this);
          for (var e4 = 0; e4 < this._layers.length; e4++) this._layers[e4].layer.off(`add remove`, this._onLayerChange, this);
        },
        addBaseLayer: function(e4, t4) {
          return this._addLayer(e4, t4), this._map ? this._update() : this;
        },
        addOverlay: function(e4, t4) {
          return this._addLayer(e4, t4, true), this._map ? this._update() : this;
        },
        removeLayer: function(e4) {
          e4.off(`add remove`, this._onLayerChange, this);
          var t4 = this._getLayer(o2(e4));
          return t4 && this._layers.splice(this._layers.indexOf(t4), 1), this._map ? this._update() : this;
        },
        expand: function() {
          W2(this._container, `leaflet-control-layers-expanded`), this._section.style.height = null;
          var e4 = this._map.getSize().y - (this._container.offsetTop + 50);
          return e4 < this._section.clientHeight ? (W2(this._section, `leaflet-control-layers-scrollbar`), this._section.style.height = e4 + `px`) : wt2(this._section, `leaflet-control-layers-scrollbar`), this._checkDisabledLayers(), this;
        },
        collapse: function() {
          return wt2(this._container, `leaflet-control-layers-expanded`), this;
        },
        _initLayout: function() {
          var e4 = `leaflet-control-layers`, t4 = this._container = H2(`div`, e4), n3 = this.options.collapsed;
          t4.setAttribute(`aria-haspopup`, true), $t2(t4), Qt2(t4);
          var r3 = this._section = H2(`section`, e4 + `-list`);
          n3 && (this._map.on(`click`, this.collapse, this), G2(t4, {
            mouseenter: this._expandSafely,
            mouseleave: this.collapse
          }, this));
          var i3 = this._layersLink = H2(`a`, e4 + `-toggle`, t4);
          i3.href = `#`, i3.title = `Layers`, i3.setAttribute(`role`, `button`), G2(i3, {
            keydown: function(e5) {
              e5.keyCode === 13 && this._expandSafely();
            },
            click: function(e5) {
              en2(e5), this._expandSafely();
            }
          }, this), n3 || this.expand(), this._baseLayersList = H2(`div`, e4 + `-base`, r3), this._separator = H2(`div`, e4 + `-separator`, r3), this._overlaysList = H2(`div`, e4 + `-overlays`, r3), t4.appendChild(r3);
        },
        _getLayer: function(e4) {
          for (var t4 = 0; t4 < this._layers.length; t4++) if (this._layers[t4] && o2(this._layers[t4].layer) === e4) return this._layers[t4];
        },
        _addLayer: function(e4, t4, n3) {
          this._map && e4.on(`add remove`, this._onLayerChange, this), this._layers.push({
            layer: e4,
            name: t4,
            overlay: n3
          }), this.options.sortLayers && this._layers.sort(i2(function(e5, t5) {
            return this.options.sortFunction(e5.layer, t5.layer, e5.name, t5.name);
          }, this)), this.options.autoZIndex && e4.setZIndex && (this._lastZIndex++, e4.setZIndex(this._lastZIndex)), this._expandIfNotCollapsed();
        },
        _update: function() {
          if (!this._container) return this;
          bt2(this._baseLayersList), bt2(this._overlaysList), this._layerControlInputs = [];
          var e4, t4, n3, r3, i3 = 0;
          for (n3 = 0; n3 < this._layers.length; n3++) r3 = this._layers[n3], this._addItem(r3), t4 ||= r3.overlay, e4 ||= !r3.overlay, i3 += +!r3.overlay;
          return this.options.hideSingleBase && (e4 &&= i3 > 1, this._baseLayersList.style.display = e4 ? `` : `none`), this._separator.style.display = t4 && e4 ? `` : `none`, this;
        },
        _onLayerChange: function(e4) {
          this._handlingClick || this._update();
          var t4 = this._getLayer(o2(e4.target)), n3 = t4.overlay ? e4.type === `add` ? `overlayadd` : `overlayremove` : e4.type === `add` ? `baselayerchange` : null;
          n3 && this._map.fire(n3, t4);
        },
        _createRadioElement: function(e4, t4) {
          var n3 = `<input type="radio" class="leaflet-control-layers-selector" name="` + e4 + `"` + (t4 ? ` checked="checked"` : ``) + `/>`, r3 = document.createElement(`div`);
          return r3.innerHTML = n3, r3.firstChild;
        },
        _addItem: function(e4) {
          var t4 = document.createElement(`label`), n3 = this._map.hasLayer(e4.layer), r3;
          e4.overlay ? (r3 = document.createElement(`input`), r3.type = `checkbox`, r3.className = `leaflet-control-layers-selector`, r3.defaultChecked = n3) : r3 = this._createRadioElement(`leaflet-base-layers_` + o2(this), n3), this._layerControlInputs.push(r3), r3.layerId = o2(e4.layer), G2(r3, `click`, this._onInputClick, this);
          var i3 = document.createElement(`span`);
          i3.innerHTML = ` ` + e4.name;
          var a3 = document.createElement(`span`);
          return t4.appendChild(a3), a3.appendChild(r3), a3.appendChild(i3), (e4.overlay ? this._overlaysList : this._baseLayersList).appendChild(t4), this._checkDisabledLayers(), t4;
        },
        _onInputClick: function() {
          if (!this._preventClick) {
            var e4 = this._layerControlInputs, t4, n3, r3 = [], i3 = [];
            this._handlingClick = true;
            for (var a3 = e4.length - 1; a3 >= 0; a3--) t4 = e4[a3], n3 = this._getLayer(t4.layerId).layer, t4.checked ? r3.push(n3) : t4.checked || i3.push(n3);
            for (a3 = 0; a3 < i3.length; a3++) this._map.hasLayer(i3[a3]) && this._map.removeLayer(i3[a3]);
            for (a3 = 0; a3 < r3.length; a3++) this._map.hasLayer(r3[a3]) || this._map.addLayer(r3[a3]);
            this._handlingClick = false, this._refocusOnMap();
          }
        },
        _checkDisabledLayers: function() {
          for (var e4 = this._layerControlInputs, t4, n3, r3 = this._map.getZoom(), i3 = e4.length - 1; i3 >= 0; i3--) t4 = e4[i3], n3 = this._getLayer(t4.layerId).layer, t4.disabled = n3.options.minZoom !== void 0 && r3 < n3.options.minZoom || n3.options.maxZoom !== void 0 && r3 > n3.options.maxZoom;
        },
        _expandIfNotCollapsed: function() {
          return this._map && !this.options.collapsed && this.expand(), this;
        },
        _expandSafely: function() {
          var e4 = this._section;
          this._preventClick = true, G2(e4, `click`, en2), this.expand();
          var t4 = this;
          setTimeout(function() {
            K2(e4, `click`, en2), t4._preventClick = false;
          });
        }
      }), mn2 = function(e4, t4, n3) {
        return new pn2(e4, t4, n3);
      }, hn2 = dn2.extend({
        options: {
          position: `topleft`,
          zoomInText: `<span aria-hidden="true">+</span>`,
          zoomInTitle: `Zoom in`,
          zoomOutText: `<span aria-hidden="true">&#x2212;</span>`,
          zoomOutTitle: `Zoom out`
        },
        onAdd: function(e4) {
          var t4 = `leaflet-control-zoom`, n3 = H2(`div`, t4 + ` leaflet-bar`), r3 = this.options;
          return this._zoomInButton = this._createButton(r3.zoomInText, r3.zoomInTitle, t4 + `-in`, n3, this._zoomIn), this._zoomOutButton = this._createButton(r3.zoomOutText, r3.zoomOutTitle, t4 + `-out`, n3, this._zoomOut), this._updateDisabled(), e4.on(`zoomend zoomlevelschange`, this._updateDisabled, this), n3;
        },
        onRemove: function(e4) {
          e4.off(`zoomend zoomlevelschange`, this._updateDisabled, this);
        },
        disable: function() {
          return this._disabled = true, this._updateDisabled(), this;
        },
        enable: function() {
          return this._disabled = false, this._updateDisabled(), this;
        },
        _zoomIn: function(e4) {
          !this._disabled && this._map._zoom < this._map.getMaxZoom() && this._map.zoomIn(this._map.options.zoomDelta * (e4.shiftKey ? 3 : 1));
        },
        _zoomOut: function(e4) {
          !this._disabled && this._map._zoom > this._map.getMinZoom() && this._map.zoomOut(this._map.options.zoomDelta * (e4.shiftKey ? 3 : 1));
        },
        _createButton: function(e4, t4, n3, r3, i3) {
          var a3 = H2(`a`, n3, r3);
          return a3.innerHTML = e4, a3.href = `#`, a3.title = t4, a3.setAttribute(`role`, `button`), a3.setAttribute(`aria-label`, t4), $t2(a3), G2(a3, `click`, tn2), G2(a3, `click`, i3, this), G2(a3, `click`, this._refocusOnMap, this), a3;
        },
        _updateDisabled: function() {
          var e4 = this._map, t4 = `leaflet-disabled`;
          wt2(this._zoomInButton, t4), wt2(this._zoomOutButton, t4), this._zoomInButton.setAttribute(`aria-disabled`, `false`), this._zoomOutButton.setAttribute(`aria-disabled`, `false`), (this._disabled || e4._zoom === e4.getMinZoom()) && (W2(this._zoomOutButton, t4), this._zoomOutButton.setAttribute(`aria-disabled`, `true`)), (this._disabled || e4._zoom === e4.getMaxZoom()) && (W2(this._zoomInButton, t4), this._zoomInButton.setAttribute(`aria-disabled`, `true`));
        }
      });
      q2.mergeOptions({
        zoomControl: true
      }), q2.addInitHook(function() {
        this.options.zoomControl && (this.zoomControl = new hn2(), this.addControl(this.zoomControl));
      });
      var gn2 = function(e4) {
        return new hn2(e4);
      }, _n2 = dn2.extend({
        options: {
          position: `bottomleft`,
          maxWidth: 100,
          metric: true,
          imperial: true
        },
        onAdd: function(e4) {
          var t4 = `leaflet-control-scale`, n3 = H2(`div`, t4), r3 = this.options;
          return this._addScales(r3, t4 + `-line`, n3), e4.on(r3.updateWhenIdle ? `moveend` : `move`, this._update, this), e4.whenReady(this._update, this), n3;
        },
        onRemove: function(e4) {
          e4.off(this.options.updateWhenIdle ? `moveend` : `move`, this._update, this);
        },
        _addScales: function(e4, t4, n3) {
          e4.metric && (this._mScale = H2(`div`, t4, n3)), e4.imperial && (this._iScale = H2(`div`, t4, n3));
        },
        _update: function() {
          var e4 = this._map, t4 = e4.getSize().y / 2, n3 = e4.distance(e4.containerPointToLatLng([
            0,
            t4
          ]), e4.containerPointToLatLng([
            this.options.maxWidth,
            t4
          ]));
          this._updateScales(n3);
        },
        _updateScales: function(e4) {
          this.options.metric && e4 && this._updateMetric(e4), this.options.imperial && e4 && this._updateImperial(e4);
        },
        _updateMetric: function(e4) {
          var t4 = this._getRoundNum(e4), n3 = t4 < 1e3 ? t4 + ` m` : t4 / 1e3 + ` km`;
          this._updateScale(this._mScale, n3, t4 / e4);
        },
        _updateImperial: function(e4) {
          var t4 = e4 * 3.2808399, n3, r3, i3;
          t4 > 5280 ? (n3 = t4 / 5280, r3 = this._getRoundNum(n3), this._updateScale(this._iScale, r3 + ` mi`, r3 / n3)) : (i3 = this._getRoundNum(t4), this._updateScale(this._iScale, i3 + ` ft`, i3 / t4));
        },
        _updateScale: function(e4, t4, n3) {
          e4.style.width = Math.round(this.options.maxWidth * n3) + `px`, e4.innerHTML = t4;
        },
        _getRoundNum: function(e4) {
          var t4 = 10 ** ((Math.floor(e4) + ``).length - 1), n3 = e4 / t4;
          return n3 = n3 >= 10 ? 10 : n3 >= 5 ? 5 : n3 >= 3 ? 3 : n3 >= 2 ? 2 : 1, t4 * n3;
        }
      }), vn2 = function(e4) {
        return new _n2(e4);
      }, yn2 = dn2.extend({
        options: {
          position: `bottomright`,
          prefix: `<a href="https://leafletjs.com" title="A JavaScript library for interactive maps">` + (z2.inlineSvg ? `<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="12" height="8" viewBox="0 0 12 8" class="leaflet-attribution-flag"><path fill="#4C7BE1" d="M0 0h12v4H0z"/><path fill="#FFD500" d="M0 4h12v3H0z"/><path fill="#E0BC00" d="M0 7h12v1H0z"/></svg> ` : ``) + `Leaflet</a>`
        },
        initialize: function(e4) {
          p2(this, e4), this._attributions = {};
        },
        onAdd: function(e4) {
          for (var t4 in e4.attributionControl = this, this._container = H2(`div`, `leaflet-control-attribution`), $t2(this._container), e4._layers) e4._layers[t4].getAttribution && this.addAttribution(e4._layers[t4].getAttribution());
          return this._update(), e4.on(`layeradd`, this._addAttribution, this), this._container;
        },
        onRemove: function(e4) {
          e4.off(`layeradd`, this._addAttribution, this);
        },
        _addAttribution: function(e4) {
          e4.layer.getAttribution && (this.addAttribution(e4.layer.getAttribution()), e4.layer.once(`remove`, function() {
            this.removeAttribution(e4.layer.getAttribution());
          }, this));
        },
        setPrefix: function(e4) {
          return this.options.prefix = e4, this._update(), this;
        },
        addAttribution: function(e4) {
          return e4 ? (this._attributions[e4] || (this._attributions[e4] = 0), this._attributions[e4]++, this._update(), this) : this;
        },
        removeAttribution: function(e4) {
          return e4 && this._attributions[e4] && (this._attributions[e4]--, this._update()), this;
        },
        _update: function() {
          if (this._map) {
            var e4 = [];
            for (var t4 in this._attributions) this._attributions[t4] && e4.push(t4);
            var n3 = [];
            this.options.prefix && n3.push(this.options.prefix), e4.length && n3.push(e4.join(`, `)), this._container.innerHTML = n3.join(` <span aria-hidden="true">|</span> `);
          }
        }
      });
      q2.mergeOptions({
        attributionControl: true
      }), q2.addInitHook(function() {
        this.options.attributionControl && new yn2().addTo(this);
      }), dn2.Layers = pn2, dn2.Zoom = hn2, dn2.Scale = _n2, dn2.Attribution = yn2, fn2.layers = mn2, fn2.zoom = gn2, fn2.scale = vn2, fn2.attribution = function(e4) {
        return new yn2(e4);
      };
      var bn2 = ne2.extend({
        initialize: function(e4) {
          this._map = e4;
        },
        enable: function() {
          return this._enabled ? this : (this._enabled = true, this.addHooks(), this);
        },
        disable: function() {
          return this._enabled ? (this._enabled = false, this.removeHooks(), this) : this;
        },
        enabled: function() {
          return !!this._enabled;
        }
      });
      bn2.addTo = function(e4, t4) {
        return e4.addHandler(t4, this), this;
      };
      var xn2 = {
        Events: E2
      }, Sn2 = z2.touch ? `touchstart mousedown` : `mousedown`, Cn2 = D2.extend({
        options: {
          clickTolerance: 3
        },
        initialize: function(e4, t4, n3, r3) {
          p2(this, r3), this._element = e4, this._dragStartTarget = t4 || e4, this._preventOutline = n3;
        },
        enable: function() {
          this._enabled ||= (G2(this._dragStartTarget, Sn2, this._onDown, this), true);
        },
        disable: function() {
          this._enabled && (Cn2._dragging === this && this.finishDrag(true), K2(this._dragStartTarget, Sn2, this._onDown, this), this._enabled = false, this._moved = false);
        },
        _onDown: function(e4) {
          if (this._enabled && (this._moved = false, !Ct2(this._element, `leaflet-zoom-anim`))) {
            if (e4.touches && e4.touches.length !== 1) {
              Cn2._dragging === this && this.finishDrag();
              return;
            }
            if (!(Cn2._dragging || e4.shiftKey || e4.which !== 1 && e4.button !== 1 && !e4.touches) && (Cn2._dragging = this, this._preventOutline && Vt2(this._element), Lt2(), Nt2(), !this._moving)) {
              this.fire(`down`);
              var t4 = e4.touches ? e4.touches[0] : e4, n3 = Ut2(this._element);
              this._startPoint = new O2(t4.clientX, t4.clientY), this._startPos = Mt2(this._element), this._parentScale = Wt2(n3);
              var r3 = e4.type === `mousedown`;
              G2(document, r3 ? `mousemove` : `touchmove`, this._onMove, this), G2(document, r3 ? `mouseup` : `touchend touchcancel`, this._onUp, this);
            }
          }
        },
        _onMove: function(e4) {
          if (this._enabled) {
            if (e4.touches && e4.touches.length > 1) {
              this._moved = true;
              return;
            }
            var t4 = e4.touches && e4.touches.length === 1 ? e4.touches[0] : e4, n3 = new O2(t4.clientX, t4.clientY)._subtract(this._startPoint);
            !n3.x && !n3.y || Math.abs(n3.x) + Math.abs(n3.y) < this.options.clickTolerance || (n3.x /= this._parentScale.x, n3.y /= this._parentScale.y, en2(e4), this._moved || (this.fire(`dragstart`), this._moved = true, W2(document.body, `leaflet-dragging`), this._lastTarget = e4.target || e4.srcElement, window.SVGElementInstance && this._lastTarget instanceof window.SVGElementInstance && (this._lastTarget = this._lastTarget.correspondingUseElement), W2(this._lastTarget, `leaflet-drag-target`)), this._newPos = this._startPos.add(n3), this._moving = true, this._lastEvent = e4, this._updatePosition());
          }
        },
        _updatePosition: function() {
          var e4 = {
            originalEvent: this._lastEvent
          };
          this.fire(`predrag`, e4), jt2(this._element, this._newPos), this.fire(`drag`, e4);
        },
        _onUp: function() {
          this._enabled && this.finishDrag();
        },
        finishDrag: function(e4) {
          wt2(document.body, `leaflet-dragging`), this._lastTarget &&= (wt2(this._lastTarget, `leaflet-drag-target`), null), K2(document, `mousemove touchmove`, this._onMove, this), K2(document, `mouseup touchend touchcancel`, this._onUp, this), Rt2(), Pt2();
          var t4 = this._moved && this._moving;
          this._moving = false, Cn2._dragging = false, t4 && this.fire(`dragend`, {
            noInertia: e4,
            distance: this._newPos.distanceTo(this._startPos)
          });
        }
      });
      function wn2(e4, t4, n3) {
        var r3, i3 = [
          1,
          4,
          2,
          8
        ], a3, o3, s3, c3, l3, u3, d3, f3;
        for (a3 = 0, u3 = e4.length; a3 < u3; a3++) e4[a3]._code = Ln2(e4[a3], t4);
        for (s3 = 0; s3 < 4; s3++) {
          for (d3 = i3[s3], r3 = [], a3 = 0, u3 = e4.length, o3 = u3 - 1; a3 < u3; o3 = a3++) c3 = e4[a3], l3 = e4[o3], c3._code & d3 ? l3._code & d3 || (f3 = In2(l3, c3, d3, t4, n3), f3._code = Ln2(f3, t4), r3.push(f3)) : (l3._code & d3 && (f3 = In2(l3, c3, d3, t4, n3), f3._code = Ln2(f3, t4), r3.push(f3)), r3.push(c3));
          e4 = r3;
        }
        return e4;
      }
      function Tn2(e4, t4) {
        var n3, r3, i3, a3, o3, s3, c3, l3, u3;
        if (!e4 || e4.length === 0) throw Error(`latlngs not passed`);
        Bn(e4) || (console.warn(`latlngs are not flat! Only the first ring will be used`), e4 = e4[0]);
        var d3 = F2([
          0,
          0
        ]), f3 = ie2(e4);
        f3.getNorthWest().distanceTo(f3.getSouthWest()) * f3.getNorthEast().distanceTo(f3.getNorthWest()) < 1700 && (d3 = En2(e4));
        var p3 = e4.length, m3 = [];
        for (n3 = 0; n3 < p3; n3++) {
          var h3 = F2(e4[n3]);
          m3.push(t4.project(F2([
            h3.lat - d3.lat,
            h3.lng - d3.lng
          ])));
        }
        for (s3 = c3 = l3 = 0, n3 = 0, r3 = p3 - 1; n3 < p3; r3 = n3++) i3 = m3[n3], a3 = m3[r3], o3 = i3.y * a3.x - a3.y * i3.x, c3 += (i3.x + a3.x) * o3, l3 += (i3.y + a3.y) * o3, s3 += o3 * 3;
        u3 = s3 === 0 ? m3[0] : [
          c3 / s3,
          l3 / s3
        ];
        var g3 = t4.unproject(A2(u3));
        return F2([
          g3.lat + d3.lat,
          g3.lng + d3.lng
        ]);
      }
      function En2(e4) {
        for (var t4 = 0, n3 = 0, r3 = 0, i3 = 0; i3 < e4.length; i3++) {
          var a3 = F2(e4[i3]);
          t4 += a3.lat, n3 += a3.lng, r3++;
        }
        return F2([
          t4 / r3,
          n3 / r3
        ]);
      }
      var Dn2 = {
        __proto__: null,
        clipPolygon: wn2,
        polygonCenter: Tn2,
        centroid: En2
      };
      function On2(e4, t4) {
        if (!t4 || !e4.length) return e4.slice();
        var n3 = t4 * t4;
        return e4 = Nn2(e4, n3), e4 = jn2(e4, n3), e4;
      }
      function kn2(e4, t4, n3) {
        return Math.sqrt(zn(e4, t4, n3, true));
      }
      function An2(e4, t4, n3) {
        return zn(e4, t4, n3);
      }
      function jn2(e4, t4) {
        var n3 = e4.length, r3 = new (typeof Uint8Array < `u` ? Uint8Array : Array)(n3);
        r3[0] = r3[n3 - 1] = 1, Mn2(e4, r3, t4, 0, n3 - 1);
        var i3, a3 = [];
        for (i3 = 0; i3 < n3; i3++) r3[i3] && a3.push(e4[i3]);
        return a3;
      }
      function Mn2(e4, t4, n3, r3, i3) {
        var a3 = 0, o3, s3, c3;
        for (s3 = r3 + 1; s3 <= i3 - 1; s3++) c3 = zn(e4[s3], e4[r3], e4[i3], true), c3 > a3 && (o3 = s3, a3 = c3);
        a3 > n3 && (t4[o3] = 1, Mn2(e4, t4, n3, r3, o3), Mn2(e4, t4, n3, o3, i3));
      }
      function Nn2(e4, t4) {
        for (var n3 = [
          e4[0]
        ], r3 = 1, i3 = 0, a3 = e4.length; r3 < a3; r3++) Rn2(e4[r3], e4[i3]) > t4 && (n3.push(e4[r3]), i3 = r3);
        return i3 < a3 - 1 && n3.push(e4[a3 - 1]), n3;
      }
      var Pn2;
      function Fn2(e4, t4, n3, r3, i3) {
        var a3 = r3 ? Pn2 : Ln2(e4, n3), o3 = Ln2(t4, n3), s3, c3, l3;
        for (Pn2 = o3; ; ) {
          if (!(a3 | o3)) return [
            e4,
            t4
          ];
          if (a3 & o3) return false;
          s3 = a3 || o3, c3 = In2(e4, t4, s3, n3, i3), l3 = Ln2(c3, n3), s3 === a3 ? (e4 = c3, a3 = l3) : (t4 = c3, o3 = l3);
        }
      }
      function In2(e4, t4, n3, r3, i3) {
        var a3 = t4.x - e4.x, o3 = t4.y - e4.y, s3 = r3.min, c3 = r3.max, l3, u3;
        return n3 & 8 ? (l3 = e4.x + a3 * (c3.y - e4.y) / o3, u3 = c3.y) : n3 & 4 ? (l3 = e4.x + a3 * (s3.y - e4.y) / o3, u3 = s3.y) : n3 & 2 ? (l3 = c3.x, u3 = e4.y + o3 * (c3.x - e4.x) / a3) : n3 & 1 && (l3 = s3.x, u3 = e4.y + o3 * (s3.x - e4.x) / a3), new O2(l3, u3, i3);
      }
      function Ln2(e4, t4) {
        var n3 = 0;
        return e4.x < t4.min.x ? n3 |= 1 : e4.x > t4.max.x && (n3 |= 2), e4.y < t4.min.y ? n3 |= 4 : e4.y > t4.max.y && (n3 |= 8), n3;
      }
      function Rn2(e4, t4) {
        var n3 = t4.x - e4.x, r3 = t4.y - e4.y;
        return n3 * n3 + r3 * r3;
      }
      function zn(e4, t4, n3, r3) {
        var i3 = t4.x, a3 = t4.y, o3 = n3.x - i3, s3 = n3.y - a3, c3 = o3 * o3 + s3 * s3, l3;
        return c3 > 0 && (l3 = ((e4.x - i3) * o3 + (e4.y - a3) * s3) / c3, l3 > 1 ? (i3 = n3.x, a3 = n3.y) : l3 > 0 && (i3 += o3 * l3, a3 += s3 * l3)), o3 = e4.x - i3, s3 = e4.y - a3, r3 ? o3 * o3 + s3 * s3 : new O2(i3, a3);
      }
      function Bn(e4) {
        return !_2(e4[0]) || typeof e4[0][0] != `object` && e4[0][0] !== void 0;
      }
      function Vn(e4) {
        return console.warn(`Deprecated use of _flat, please use L.LineUtil.isFlat instead.`), Bn(e4);
      }
      function Hn(e4, t4) {
        var n3, r3, i3, a3, o3, s3, c3, l3;
        if (!e4 || e4.length === 0) throw Error(`latlngs not passed`);
        Bn(e4) || (console.warn(`latlngs are not flat! Only the first ring will be used`), e4 = e4[0]);
        var u3 = F2([
          0,
          0
        ]), d3 = ie2(e4);
        d3.getNorthWest().distanceTo(d3.getSouthWest()) * d3.getNorthEast().distanceTo(d3.getNorthWest()) < 1700 && (u3 = En2(e4));
        var f3 = e4.length, p3 = [];
        for (n3 = 0; n3 < f3; n3++) {
          var m3 = F2(e4[n3]);
          p3.push(t4.project(F2([
            m3.lat - u3.lat,
            m3.lng - u3.lng
          ])));
        }
        for (n3 = 0, r3 = 0; n3 < f3 - 1; n3++) r3 += p3[n3].distanceTo(p3[n3 + 1]) / 2;
        if (r3 === 0) l3 = p3[0];
        else for (n3 = 0, a3 = 0; n3 < f3 - 1; n3++) if (o3 = p3[n3], s3 = p3[n3 + 1], i3 = o3.distanceTo(s3), a3 += i3, a3 > r3) {
          c3 = (a3 - r3) / i3, l3 = [
            s3.x - c3 * (s3.x - o3.x),
            s3.y - c3 * (s3.y - o3.y)
          ];
          break;
        }
        var h3 = t4.unproject(A2(l3));
        return F2([
          h3.lat + u3.lat,
          h3.lng + u3.lng
        ]);
      }
      var Un = {
        __proto__: null,
        simplify: On2,
        pointToSegmentDistance: kn2,
        closestPointOnSegment: An2,
        clipSegment: Fn2,
        _getEdgeIntersection: In2,
        _getBitCode: Ln2,
        _sqClosestPointOnSegment: zn,
        isFlat: Bn,
        _flat: Vn,
        polylineCenter: Hn
      }, Wn = {
        project: function(e4) {
          return new O2(e4.lng, e4.lat);
        },
        unproject: function(e4) {
          return new P2(e4.y, e4.x);
        },
        bounds: new j2([
          -180,
          -90
        ], [
          180,
          90
        ])
      }, Gn = {
        R: 6378137,
        R_MINOR: 6356752314245179e-9,
        bounds: new j2([
          -2003750834279e-5,
          -1549657073972e-5
        ], [
          2003750834279e-5,
          1876465623138e-5
        ]),
        project: function(e4) {
          var t4 = Math.PI / 180, n3 = this.R, r3 = e4.lat * t4, i3 = this.R_MINOR / n3, a3 = Math.sqrt(1 - i3 * i3), o3 = a3 * Math.sin(r3), s3 = Math.tan(Math.PI / 4 - r3 / 2) / ((1 - o3) / (1 + o3)) ** (a3 / 2);
          return r3 = -n3 * Math.log(Math.max(s3, 1e-10)), new O2(e4.lng * t4 * n3, r3);
        },
        unproject: function(e4) {
          for (var t4 = 180 / Math.PI, n3 = this.R, r3 = this.R_MINOR / n3, i3 = Math.sqrt(1 - r3 * r3), a3 = Math.exp(-e4.y / n3), o3 = Math.PI / 2 - 2 * Math.atan(a3), s3 = 0, c3 = 0.1, l3; s3 < 15 && Math.abs(c3) > 1e-7; s3++) l3 = i3 * Math.sin(o3), l3 = ((1 - l3) / (1 + l3)) ** (i3 / 2), c3 = Math.PI / 2 - 2 * Math.atan(a3 * l3) - o3, o3 += c3;
          return new P2(o3 * t4, e4.x * t4 / n3);
        }
      }, Kn = {
        __proto__: null,
        LonLat: Wn,
        Mercator: Gn,
        SphericalMercator: ce2
      }, qn = n2({}, oe2, {
        code: `EPSG:3395`,
        projection: Gn,
        transformation: (function() {
          var e4 = 0.5 / (Math.PI * Gn.R);
          return ue2(e4, 0.5, -e4, 0.5);
        })()
      }), Jn = n2({}, oe2, {
        code: `EPSG:4326`,
        projection: Wn,
        transformation: ue2(1 / 180, 1, -1 / 180, 0.5)
      }), Yn = n2({}, ae2, {
        projection: Wn,
        transformation: ue2(1, 0, -1, 0),
        scale: function(e4) {
          return 2 ** e4;
        },
        zoom: function(e4) {
          return Math.log(e4) / Math.LN2;
        },
        distance: function(e4, t4) {
          var n3 = t4.lng - e4.lng, r3 = t4.lat - e4.lat;
          return Math.sqrt(n3 * n3 + r3 * r3);
        },
        infinite: true
      });
      ae2.Earth = oe2, ae2.EPSG3395 = qn, ae2.EPSG3857 = de2, ae2.EPSG900913 = fe2, ae2.EPSG4326 = Jn, ae2.Simple = Yn;
      var Xn = D2.extend({
        options: {
          pane: `overlayPane`,
          attribution: null,
          bubblingMouseEvents: true
        },
        addTo: function(e4) {
          return e4.addLayer(this), this;
        },
        remove: function() {
          return this.removeFrom(this._map || this._mapToAdd);
        },
        removeFrom: function(e4) {
          return e4 && e4.removeLayer(this), this;
        },
        getPane: function(e4) {
          return this._map.getPane(e4 ? this.options[e4] || e4 : this.options.pane);
        },
        addInteractiveTarget: function(e4) {
          return this._map._targets[o2(e4)] = this, this;
        },
        removeInteractiveTarget: function(e4) {
          return delete this._map._targets[o2(e4)], this;
        },
        getAttribution: function() {
          return this.options.attribution;
        },
        _layerAdd: function(e4) {
          var t4 = e4.target;
          if (t4.hasLayer(this)) {
            if (this._map = t4, this._zoomAnimated = t4._zoomAnimated, this.getEvents) {
              var n3 = this.getEvents();
              t4.on(n3, this), this.once(`remove`, function() {
                t4.off(n3, this);
              }, this);
            }
            this.onAdd(t4), this.fire(`add`), t4.fire(`layeradd`, {
              layer: this
            });
          }
        }
      });
      q2.include({
        addLayer: function(e4) {
          if (!e4._layerAdd) throw Error(`The provided object is not a Layer.`);
          var t4 = o2(e4);
          return this._layers[t4] ? this : (this._layers[t4] = e4, e4._mapToAdd = this, e4.beforeAdd && e4.beforeAdd(this), this.whenReady(e4._layerAdd, e4), this);
        },
        removeLayer: function(e4) {
          var t4 = o2(e4);
          return this._layers[t4] ? (this._loaded && e4.onRemove(this), delete this._layers[t4], this._loaded && (this.fire(`layerremove`, {
            layer: e4
          }), e4.fire(`remove`)), e4._map = e4._mapToAdd = null, this) : this;
        },
        hasLayer: function(e4) {
          return o2(e4) in this._layers;
        },
        eachLayer: function(e4, t4) {
          for (var n3 in this._layers) e4.call(t4, this._layers[n3]);
          return this;
        },
        _addLayers: function(e4) {
          e4 = e4 ? _2(e4) ? e4 : [
            e4
          ] : [];
          for (var t4 = 0, n3 = e4.length; t4 < n3; t4++) this.addLayer(e4[t4]);
        },
        _addZoomLimit: function(e4) {
          (!isNaN(e4.options.maxZoom) || !isNaN(e4.options.minZoom)) && (this._zoomBoundLayers[o2(e4)] = e4, this._updateZoomLevels());
        },
        _removeZoomLimit: function(e4) {
          var t4 = o2(e4);
          this._zoomBoundLayers[t4] && (delete this._zoomBoundLayers[t4], this._updateZoomLevels());
        },
        _updateZoomLevels: function() {
          var e4 = 1 / 0, t4 = -1 / 0, n3 = this._getZoomSpan();
          for (var r3 in this._zoomBoundLayers) {
            var i3 = this._zoomBoundLayers[r3].options;
            e4 = i3.minZoom === void 0 ? e4 : Math.min(e4, i3.minZoom), t4 = i3.maxZoom === void 0 ? t4 : Math.max(t4, i3.maxZoom);
          }
          this._layersMaxZoom = t4 === -1 / 0 ? void 0 : t4, this._layersMinZoom = e4 === 1 / 0 ? void 0 : e4, n3 !== this._getZoomSpan() && this.fire(`zoomlevelschange`), this.options.maxZoom === void 0 && this._layersMaxZoom && this.getZoom() > this._layersMaxZoom && this.setZoom(this._layersMaxZoom), this.options.minZoom === void 0 && this._layersMinZoom && this.getZoom() < this._layersMinZoom && this.setZoom(this._layersMinZoom);
        }
      });
      var Zn = Xn.extend({
        initialize: function(e4, t4) {
          p2(this, t4), this._layers = {};
          var n3, r3;
          if (e4) for (n3 = 0, r3 = e4.length; n3 < r3; n3++) this.addLayer(e4[n3]);
        },
        addLayer: function(e4) {
          var t4 = this.getLayerId(e4);
          return this._layers[t4] = e4, this._map && this._map.addLayer(e4), this;
        },
        removeLayer: function(e4) {
          var t4 = e4 in this._layers ? e4 : this.getLayerId(e4);
          return this._map && this._layers[t4] && this._map.removeLayer(this._layers[t4]), delete this._layers[t4], this;
        },
        hasLayer: function(e4) {
          return (typeof e4 == `number` ? e4 : this.getLayerId(e4)) in this._layers;
        },
        clearLayers: function() {
          return this.eachLayer(this.removeLayer, this);
        },
        invoke: function(e4) {
          var t4 = Array.prototype.slice.call(arguments, 1), n3, r3;
          for (n3 in this._layers) r3 = this._layers[n3], r3[e4] && r3[e4].apply(r3, t4);
          return this;
        },
        onAdd: function(e4) {
          this.eachLayer(e4.addLayer, e4);
        },
        onRemove: function(e4) {
          this.eachLayer(e4.removeLayer, e4);
        },
        eachLayer: function(e4, t4) {
          for (var n3 in this._layers) e4.call(t4, this._layers[n3]);
          return this;
        },
        getLayer: function(e4) {
          return this._layers[e4];
        },
        getLayers: function() {
          var e4 = [];
          return this.eachLayer(e4.push, e4), e4;
        },
        setZIndex: function(e4) {
          return this.invoke(`setZIndex`, e4);
        },
        getLayerId: function(e4) {
          return o2(e4);
        }
      }), Qn = function(e4, t4) {
        return new Zn(e4, t4);
      }, $n = Zn.extend({
        addLayer: function(e4) {
          return this.hasLayer(e4) ? this : (e4.addEventParent(this), Zn.prototype.addLayer.call(this, e4), this.fire(`layeradd`, {
            layer: e4
          }));
        },
        removeLayer: function(e4) {
          return this.hasLayer(e4) ? (e4 in this._layers && (e4 = this._layers[e4]), e4.removeEventParent(this), Zn.prototype.removeLayer.call(this, e4), this.fire(`layerremove`, {
            layer: e4
          })) : this;
        },
        setStyle: function(e4) {
          return this.invoke(`setStyle`, e4);
        },
        bringToFront: function() {
          return this.invoke(`bringToFront`);
        },
        bringToBack: function() {
          return this.invoke(`bringToBack`);
        },
        getBounds: function() {
          var e4 = new N2();
          for (var t4 in this._layers) {
            var n3 = this._layers[t4];
            e4.extend(n3.getBounds ? n3.getBounds() : n3.getLatLng());
          }
          return e4;
        }
      }), er = function(e4, t4) {
        return new $n(e4, t4);
      }, tr = ne2.extend({
        options: {
          popupAnchor: [
            0,
            0
          ],
          tooltipAnchor: [
            0,
            0
          ],
          crossOrigin: false
        },
        initialize: function(e4) {
          p2(this, e4);
        },
        createIcon: function(e4) {
          return this._createIcon(`icon`, e4);
        },
        createShadow: function(e4) {
          return this._createIcon(`shadow`, e4);
        },
        _createIcon: function(e4, t4) {
          var n3 = this._getIconUrl(e4);
          if (!n3) {
            if (e4 === `icon`) throw Error(`iconUrl not set in Icon options (see the docs).`);
            return null;
          }
          var r3 = this._createImg(n3, t4 && t4.tagName === `IMG` ? t4 : null);
          return this._setIconStyles(r3, e4), (this.options.crossOrigin || this.options.crossOrigin === ``) && (r3.crossOrigin = this.options.crossOrigin === true ? `` : this.options.crossOrigin), r3;
        },
        _setIconStyles: function(e4, t4) {
          var n3 = this.options, r3 = n3[t4 + `Size`];
          typeof r3 == `number` && (r3 = [
            r3,
            r3
          ]);
          var i3 = A2(r3), a3 = A2(t4 === `shadow` && n3.shadowAnchor || n3.iconAnchor || i3 && i3.divideBy(2, true));
          e4.className = `leaflet-marker-` + t4 + ` ` + (n3.className || ``), a3 && (e4.style.marginLeft = -a3.x + `px`, e4.style.marginTop = -a3.y + `px`), i3 && (e4.style.width = i3.x + `px`, e4.style.height = i3.y + `px`);
        },
        _createImg: function(e4, t4) {
          return t4 ||= document.createElement(`img`), t4.src = e4, t4;
        },
        _getIconUrl: function(e4) {
          return z2.retina && this.options[e4 + `RetinaUrl`] || this.options[e4 + `Url`];
        }
      });
      function nr(e4) {
        return new tr(e4);
      }
      var rr = tr.extend({
        options: {
          iconUrl: `marker-icon.png`,
          iconRetinaUrl: `marker-icon-2x.png`,
          shadowUrl: `marker-shadow.png`,
          iconSize: [
            25,
            41
          ],
          iconAnchor: [
            12,
            41
          ],
          popupAnchor: [
            1,
            -34
          ],
          tooltipAnchor: [
            16,
            -28
          ],
          shadowSize: [
            41,
            41
          ]
        },
        _getIconUrl: function(e4) {
          return typeof rr.imagePath != `string` && (rr.imagePath = this._detectIconPath()), (this.options.imagePath || rr.imagePath) + tr.prototype._getIconUrl.call(this, e4);
        },
        _stripUrl: function(e4) {
          var t4 = function(e5, t5, n3) {
            var r3 = t5.exec(e5);
            return r3 && r3[n3];
          };
          return e4 = t4(e4, /^url\((['"])?(.+)\1\)$/, 2), e4 && t4(e4, /^(.*)marker-icon\.png$/, 1);
        },
        _detectIconPath: function() {
          var e4 = H2(`div`, `leaflet-default-icon-path`, document.body), t4 = V2(e4, `background-image`) || V2(e4, `backgroundImage`);
          if (document.body.removeChild(e4), t4 = this._stripUrl(t4), t4) return t4;
          var n3 = document.querySelector(`link[href$="leaflet.css"]`);
          return n3 ? n3.href.substring(0, n3.href.length - 11 - 1) : ``;
        }
      }), ir = bn2.extend({
        initialize: function(e4) {
          this._marker = e4;
        },
        addHooks: function() {
          var e4 = this._marker._icon;
          this._draggable ||= new Cn2(e4, e4, true), this._draggable.on({
            dragstart: this._onDragStart,
            predrag: this._onPreDrag,
            drag: this._onDrag,
            dragend: this._onDragEnd
          }, this).enable(), W2(e4, `leaflet-marker-draggable`);
        },
        removeHooks: function() {
          this._draggable.off({
            dragstart: this._onDragStart,
            predrag: this._onPreDrag,
            drag: this._onDrag,
            dragend: this._onDragEnd
          }, this).disable(), this._marker._icon && wt2(this._marker._icon, `leaflet-marker-draggable`);
        },
        moved: function() {
          return this._draggable && this._draggable._moved;
        },
        _adjustPan: function(e4) {
          var t4 = this._marker, n3 = t4._map, r3 = this._marker.options.autoPanSpeed, i3 = this._marker.options.autoPanPadding, a3 = Mt2(t4._icon), o3 = n3.getPixelBounds(), s3 = n3.getPixelOrigin(), c3 = M2(o3.min._subtract(s3).add(i3), o3.max._subtract(s3).subtract(i3));
          if (!c3.contains(a3)) {
            var l3 = A2((Math.max(c3.max.x, a3.x) - c3.max.x) / (o3.max.x - c3.max.x) - (Math.min(c3.min.x, a3.x) - c3.min.x) / (o3.min.x - c3.min.x), (Math.max(c3.max.y, a3.y) - c3.max.y) / (o3.max.y - c3.max.y) - (Math.min(c3.min.y, a3.y) - c3.min.y) / (o3.min.y - c3.min.y)).multiplyBy(r3);
            n3.panBy(l3, {
              animate: false
            }), this._draggable._newPos._add(l3), this._draggable._startPos._add(l3), jt2(t4._icon, this._draggable._newPos), this._onDrag(e4), this._panRequest = ee2(this._adjustPan.bind(this, e4));
          }
        },
        _onDragStart: function() {
          this._oldLatLng = this._marker.getLatLng(), this._marker.closePopup && this._marker.closePopup(), this._marker.fire(`movestart`).fire(`dragstart`);
        },
        _onPreDrag: function(e4) {
          this._marker.options.autoPan && (T2(this._panRequest), this._panRequest = ee2(this._adjustPan.bind(this, e4)));
        },
        _onDrag: function(e4) {
          var t4 = this._marker, n3 = t4._shadow, r3 = Mt2(t4._icon), i3 = t4._map.layerPointToLatLng(r3);
          n3 && jt2(n3, r3), t4._latlng = i3, e4.latlng = i3, e4.oldLatLng = this._oldLatLng, t4.fire(`move`, e4).fire(`drag`, e4);
        },
        _onDragEnd: function(e4) {
          T2(this._panRequest), delete this._oldLatLng, this._marker.fire(`moveend`).fire(`dragend`, e4);
        }
      }), ar = Xn.extend({
        options: {
          icon: new rr(),
          interactive: true,
          keyboard: true,
          title: ``,
          alt: `Marker`,
          zIndexOffset: 0,
          opacity: 1,
          riseOnHover: false,
          riseOffset: 250,
          pane: `markerPane`,
          shadowPane: `shadowPane`,
          bubblingMouseEvents: false,
          autoPanOnFocus: true,
          draggable: false,
          autoPan: false,
          autoPanPadding: [
            50,
            50
          ],
          autoPanSpeed: 10
        },
        initialize: function(e4, t4) {
          p2(this, t4), this._latlng = F2(e4);
        },
        onAdd: function(e4) {
          this._zoomAnimated = this._zoomAnimated && e4.options.markerZoomAnimation, this._zoomAnimated && e4.on(`zoomanim`, this._animateZoom, this), this._initIcon(), this.update();
        },
        onRemove: function(e4) {
          this.dragging && this.dragging.enabled() && (this.options.draggable = true, this.dragging.removeHooks()), delete this.dragging, this._zoomAnimated && e4.off(`zoomanim`, this._animateZoom, this), this._removeIcon(), this._removeShadow();
        },
        getEvents: function() {
          return {
            zoom: this.update,
            viewreset: this.update
          };
        },
        getLatLng: function() {
          return this._latlng;
        },
        setLatLng: function(e4) {
          var t4 = this._latlng;
          return this._latlng = F2(e4), this.update(), this.fire(`move`, {
            oldLatLng: t4,
            latlng: this._latlng
          });
        },
        setZIndexOffset: function(e4) {
          return this.options.zIndexOffset = e4, this.update();
        },
        getIcon: function() {
          return this.options.icon;
        },
        setIcon: function(e4) {
          return this.options.icon = e4, this._map && (this._initIcon(), this.update()), this._popup && this.bindPopup(this._popup, this._popup.options), this;
        },
        getElement: function() {
          return this._icon;
        },
        update: function() {
          if (this._icon && this._map) {
            var e4 = this._map.latLngToLayerPoint(this._latlng).round();
            this._setPos(e4);
          }
          return this;
        },
        _initIcon: function() {
          var e4 = this.options, t4 = `leaflet-zoom-` + (this._zoomAnimated ? `animated` : `hide`), n3 = e4.icon.createIcon(this._icon), r3 = false;
          n3 !== this._icon && (this._icon && this._removeIcon(), r3 = true, e4.title && (n3.title = e4.title), n3.tagName === `IMG` && (n3.alt = e4.alt || ``)), W2(n3, t4), e4.keyboard && (n3.tabIndex = `0`, n3.setAttribute(`role`, `button`)), this._icon = n3, e4.riseOnHover && this.on({
            mouseover: this._bringToFront,
            mouseout: this._resetZIndex
          }), this.options.autoPanOnFocus && G2(n3, `focus`, this._panOnFocus, this);
          var i3 = e4.icon.createShadow(this._shadow), a3 = false;
          i3 !== this._shadow && (this._removeShadow(), a3 = true), i3 && (W2(i3, t4), i3.alt = ``), this._shadow = i3, e4.opacity < 1 && this._updateOpacity(), r3 && this.getPane().appendChild(this._icon), this._initInteraction(), i3 && a3 && this.getPane(e4.shadowPane).appendChild(this._shadow);
        },
        _removeIcon: function() {
          this.options.riseOnHover && this.off({
            mouseover: this._bringToFront,
            mouseout: this._resetZIndex
          }), this.options.autoPanOnFocus && K2(this._icon, `focus`, this._panOnFocus, this), U2(this._icon), this.removeInteractiveTarget(this._icon), this._icon = null;
        },
        _removeShadow: function() {
          this._shadow && U2(this._shadow), this._shadow = null;
        },
        _setPos: function(e4) {
          this._icon && jt2(this._icon, e4), this._shadow && jt2(this._shadow, e4), this._zIndex = e4.y + this.options.zIndexOffset, this._resetZIndex();
        },
        _updateZIndex: function(e4) {
          this._icon && (this._icon.style.zIndex = this._zIndex + e4);
        },
        _animateZoom: function(e4) {
          var t4 = this._map._latLngToNewLayerPoint(this._latlng, e4.zoom, e4.center).round();
          this._setPos(t4);
        },
        _initInteraction: function() {
          if (this.options.interactive && (W2(this._icon, `leaflet-interactive`), this.addInteractiveTarget(this._icon), ir)) {
            var e4 = this.options.draggable;
            this.dragging && (e4 = this.dragging.enabled(), this.dragging.disable()), this.dragging = new ir(this), e4 && this.dragging.enable();
          }
        },
        setOpacity: function(e4) {
          return this.options.opacity = e4, this._map && this._updateOpacity(), this;
        },
        _updateOpacity: function() {
          var e4 = this.options.opacity;
          this._icon && Dt2(this._icon, e4), this._shadow && Dt2(this._shadow, e4);
        },
        _bringToFront: function() {
          this._updateZIndex(this.options.riseOffset);
        },
        _resetZIndex: function() {
          this._updateZIndex(0);
        },
        _panOnFocus: function() {
          var e4 = this._map;
          if (e4) {
            var t4 = this.options.icon.options, n3 = t4.iconSize ? A2(t4.iconSize) : A2(0, 0), r3 = t4.iconAnchor ? A2(t4.iconAnchor) : A2(0, 0);
            e4.panInside(this._latlng, {
              paddingTopLeft: r3,
              paddingBottomRight: n3.subtract(r3)
            });
          }
        },
        _getPopupAnchor: function() {
          return this.options.icon.options.popupAnchor;
        },
        _getTooltipAnchor: function() {
          return this.options.icon.options.tooltipAnchor;
        }
      });
      function or(e4, t4) {
        return new ar(e4, t4);
      }
      var sr = Xn.extend({
        options: {
          stroke: true,
          color: `#3388ff`,
          weight: 3,
          opacity: 1,
          lineCap: `round`,
          lineJoin: `round`,
          dashArray: null,
          dashOffset: null,
          fill: false,
          fillColor: null,
          fillOpacity: 0.2,
          fillRule: `evenodd`,
          interactive: true,
          bubblingMouseEvents: true
        },
        beforeAdd: function(e4) {
          this._renderer = e4.getRenderer(this);
        },
        onAdd: function() {
          this._renderer._initPath(this), this._reset(), this._renderer._addPath(this);
        },
        onRemove: function() {
          this._renderer._removePath(this);
        },
        redraw: function() {
          return this._map && this._renderer._updatePath(this), this;
        },
        setStyle: function(e4) {
          return p2(this, e4), this._renderer && (this._renderer._updateStyle(this), this.options.stroke && e4 && Object.prototype.hasOwnProperty.call(e4, `weight`) && this._updateBounds()), this;
        },
        bringToFront: function() {
          return this._renderer && this._renderer._bringToFront(this), this;
        },
        bringToBack: function() {
          return this._renderer && this._renderer._bringToBack(this), this;
        },
        getElement: function() {
          return this._path;
        },
        _reset: function() {
          this._project(), this._update();
        },
        _clickTolerance: function() {
          return (this.options.stroke ? this.options.weight / 2 : 0) + (this._renderer.options.tolerance || 0);
        }
      }), cr = sr.extend({
        options: {
          fill: true,
          radius: 10
        },
        initialize: function(e4, t4) {
          p2(this, t4), this._latlng = F2(e4), this._radius = this.options.radius;
        },
        setLatLng: function(e4) {
          var t4 = this._latlng;
          return this._latlng = F2(e4), this.redraw(), this.fire(`move`, {
            oldLatLng: t4,
            latlng: this._latlng
          });
        },
        getLatLng: function() {
          return this._latlng;
        },
        setRadius: function(e4) {
          return this.options.radius = this._radius = e4, this.redraw();
        },
        getRadius: function() {
          return this._radius;
        },
        setStyle: function(e4) {
          var t4 = e4 && e4.radius || this._radius;
          return sr.prototype.setStyle.call(this, e4), this.setRadius(t4), this;
        },
        _project: function() {
          this._point = this._map.latLngToLayerPoint(this._latlng), this._updateBounds();
        },
        _updateBounds: function() {
          var e4 = this._radius, t4 = this._radiusY || e4, n3 = this._clickTolerance(), r3 = [
            e4 + n3,
            t4 + n3
          ];
          this._pxBounds = new j2(this._point.subtract(r3), this._point.add(r3));
        },
        _update: function() {
          this._map && this._updatePath();
        },
        _updatePath: function() {
          this._renderer._updateCircle(this);
        },
        _empty: function() {
          return this._radius && !this._renderer._bounds.intersects(this._pxBounds);
        },
        _containsPoint: function(e4) {
          return e4.distanceTo(this._point) <= this._radius + this._clickTolerance();
        }
      });
      function lr(e4, t4) {
        return new cr(e4, t4);
      }
      var ur = cr.extend({
        initialize: function(e4, t4, r3) {
          if (typeof t4 == `number` && (t4 = n2({}, r3, {
            radius: t4
          })), p2(this, t4), this._latlng = F2(e4), isNaN(this.options.radius)) throw Error(`Circle radius cannot be NaN`);
          this._mRadius = this.options.radius;
        },
        setRadius: function(e4) {
          return this._mRadius = e4, this.redraw();
        },
        getRadius: function() {
          return this._mRadius;
        },
        getBounds: function() {
          var e4 = [
            this._radius,
            this._radiusY || this._radius
          ];
          return new N2(this._map.layerPointToLatLng(this._point.subtract(e4)), this._map.layerPointToLatLng(this._point.add(e4)));
        },
        setStyle: sr.prototype.setStyle,
        _project: function() {
          var e4 = this._latlng.lng, t4 = this._latlng.lat, n3 = this._map, r3 = n3.options.crs;
          if (r3.distance === oe2.distance) {
            var i3 = Math.PI / 180, a3 = this._mRadius / oe2.R / i3, o3 = n3.project([
              t4 + a3,
              e4
            ]), s3 = n3.project([
              t4 - a3,
              e4
            ]), c3 = o3.add(s3).divideBy(2), l3 = n3.unproject(c3).lat, u3 = Math.acos((Math.cos(a3 * i3) - Math.sin(t4 * i3) * Math.sin(l3 * i3)) / (Math.cos(t4 * i3) * Math.cos(l3 * i3))) / i3;
            (isNaN(u3) || u3 === 0) && (u3 = a3 / Math.cos(Math.PI / 180 * t4)), this._point = c3.subtract(n3.getPixelOrigin()), this._radius = isNaN(u3) ? 0 : c3.x - n3.project([
              l3,
              e4 - u3
            ]).x, this._radiusY = c3.y - o3.y;
          } else {
            var d3 = r3.unproject(r3.project(this._latlng).subtract([
              this._mRadius,
              0
            ]));
            this._point = n3.latLngToLayerPoint(this._latlng), this._radius = this._point.x - n3.latLngToLayerPoint(d3).x;
          }
          this._updateBounds();
        }
      });
      function dr(e4, t4, n3) {
        return new ur(e4, t4, n3);
      }
      var fr = sr.extend({
        options: {
          smoothFactor: 1,
          noClip: false
        },
        initialize: function(e4, t4) {
          p2(this, t4), this._setLatLngs(e4);
        },
        getLatLngs: function() {
          return this._latlngs;
        },
        setLatLngs: function(e4) {
          return this._setLatLngs(e4), this.redraw();
        },
        isEmpty: function() {
          return !this._latlngs.length;
        },
        closestLayerPoint: function(e4) {
          for (var t4 = 1 / 0, n3 = null, r3 = zn, i3, a3, o3 = 0, s3 = this._parts.length; o3 < s3; o3++) for (var c3 = this._parts[o3], l3 = 1, u3 = c3.length; l3 < u3; l3++) {
            i3 = c3[l3 - 1], a3 = c3[l3];
            var d3 = r3(e4, i3, a3, true);
            d3 < t4 && (t4 = d3, n3 = r3(e4, i3, a3));
          }
          return n3 && (n3.distance = Math.sqrt(t4)), n3;
        },
        getCenter: function() {
          if (!this._map) throw Error(`Must add layer to map before using getCenter()`);
          return Hn(this._defaultShape(), this._map.options.crs);
        },
        getBounds: function() {
          return this._bounds;
        },
        addLatLng: function(e4, t4) {
          return t4 ||= this._defaultShape(), e4 = F2(e4), t4.push(e4), this._bounds.extend(e4), this.redraw();
        },
        _setLatLngs: function(e4) {
          this._bounds = new N2(), this._latlngs = this._convertLatLngs(e4);
        },
        _defaultShape: function() {
          return Bn(this._latlngs) ? this._latlngs : this._latlngs[0];
        },
        _convertLatLngs: function(e4) {
          for (var t4 = [], n3 = Bn(e4), r3 = 0, i3 = e4.length; r3 < i3; r3++) n3 ? (t4[r3] = F2(e4[r3]), this._bounds.extend(t4[r3])) : t4[r3] = this._convertLatLngs(e4[r3]);
          return t4;
        },
        _project: function() {
          var e4 = new j2();
          this._rings = [], this._projectLatlngs(this._latlngs, this._rings, e4), this._bounds.isValid() && e4.isValid() && (this._rawPxBounds = e4, this._updateBounds());
        },
        _updateBounds: function() {
          var e4 = this._clickTolerance(), t4 = new O2(e4, e4);
          this._rawPxBounds && (this._pxBounds = new j2([
            this._rawPxBounds.min.subtract(t4),
            this._rawPxBounds.max.add(t4)
          ]));
        },
        _projectLatlngs: function(e4, t4, n3) {
          var r3 = e4[0] instanceof P2, i3 = e4.length, a3, o3;
          if (r3) {
            for (o3 = [], a3 = 0; a3 < i3; a3++) o3[a3] = this._map.latLngToLayerPoint(e4[a3]), n3.extend(o3[a3]);
            t4.push(o3);
          } else for (a3 = 0; a3 < i3; a3++) this._projectLatlngs(e4[a3], t4, n3);
        },
        _clipPoints: function() {
          var e4 = this._renderer._bounds;
          if (this._parts = [], !(!this._pxBounds || !this._pxBounds.intersects(e4))) {
            if (this.options.noClip) {
              this._parts = this._rings;
              return;
            }
            var t4 = this._parts, n3, r3, i3, a3, o3, s3, c3;
            for (n3 = 0, i3 = 0, a3 = this._rings.length; n3 < a3; n3++) for (c3 = this._rings[n3], r3 = 0, o3 = c3.length; r3 < o3 - 1; r3++) s3 = Fn2(c3[r3], c3[r3 + 1], e4, r3, true), s3 && (t4[i3] = t4[i3] || [], t4[i3].push(s3[0]), (s3[1] !== c3[r3 + 1] || r3 === o3 - 2) && (t4[i3].push(s3[1]), i3++));
          }
        },
        _simplifyPoints: function() {
          for (var e4 = this._parts, t4 = this.options.smoothFactor, n3 = 0, r3 = e4.length; n3 < r3; n3++) e4[n3] = On2(e4[n3], t4);
        },
        _update: function() {
          this._map && (this._clipPoints(), this._simplifyPoints(), this._updatePath());
        },
        _updatePath: function() {
          this._renderer._updatePoly(this);
        },
        _containsPoint: function(e4, t4) {
          var n3, r3, i3, a3, o3, s3, c3 = this._clickTolerance();
          if (!this._pxBounds || !this._pxBounds.contains(e4)) return false;
          for (n3 = 0, a3 = this._parts.length; n3 < a3; n3++) for (s3 = this._parts[n3], r3 = 0, o3 = s3.length, i3 = o3 - 1; r3 < o3; i3 = r3++) if (!(!t4 && r3 === 0) && kn2(e4, s3[i3], s3[r3]) <= c3) return true;
          return false;
        }
      });
      function pr(e4, t4) {
        return new fr(e4, t4);
      }
      fr._flat = Vn;
      var mr = fr.extend({
        options: {
          fill: true
        },
        isEmpty: function() {
          return !this._latlngs.length || !this._latlngs[0].length;
        },
        getCenter: function() {
          if (!this._map) throw Error(`Must add layer to map before using getCenter()`);
          return Tn2(this._defaultShape(), this._map.options.crs);
        },
        _convertLatLngs: function(e4) {
          var t4 = fr.prototype._convertLatLngs.call(this, e4), n3 = t4.length;
          return n3 >= 2 && t4[0] instanceof P2 && t4[0].equals(t4[n3 - 1]) && t4.pop(), t4;
        },
        _setLatLngs: function(e4) {
          fr.prototype._setLatLngs.call(this, e4), Bn(this._latlngs) && (this._latlngs = [
            this._latlngs
          ]);
        },
        _defaultShape: function() {
          return Bn(this._latlngs[0]) ? this._latlngs[0] : this._latlngs[0][0];
        },
        _clipPoints: function() {
          var e4 = this._renderer._bounds, t4 = this.options.weight, n3 = new O2(t4, t4);
          if (e4 = new j2(e4.min.subtract(n3), e4.max.add(n3)), this._parts = [], !(!this._pxBounds || !this._pxBounds.intersects(e4))) {
            if (this.options.noClip) {
              this._parts = this._rings;
              return;
            }
            for (var r3 = 0, i3 = this._rings.length, a3; r3 < i3; r3++) a3 = wn2(this._rings[r3], e4, true), a3.length && this._parts.push(a3);
          }
        },
        _updatePath: function() {
          this._renderer._updatePoly(this, true);
        },
        _containsPoint: function(e4) {
          var t4 = false, n3, r3, i3, a3, o3, s3, c3, l3;
          if (!this._pxBounds || !this._pxBounds.contains(e4)) return false;
          for (a3 = 0, c3 = this._parts.length; a3 < c3; a3++) for (n3 = this._parts[a3], o3 = 0, l3 = n3.length, s3 = l3 - 1; o3 < l3; s3 = o3++) r3 = n3[o3], i3 = n3[s3], r3.y > e4.y != i3.y > e4.y && e4.x < (i3.x - r3.x) * (e4.y - r3.y) / (i3.y - r3.y) + r3.x && (t4 = !t4);
          return t4 || fr.prototype._containsPoint.call(this, e4, true);
        }
      });
      function hr(e4, t4) {
        return new mr(e4, t4);
      }
      var gr = $n.extend({
        initialize: function(e4, t4) {
          p2(this, t4), this._layers = {}, e4 && this.addData(e4);
        },
        addData: function(e4) {
          var t4 = _2(e4) ? e4 : e4.features, n3, r3, i3;
          if (t4) {
            for (n3 = 0, r3 = t4.length; n3 < r3; n3++) i3 = t4[n3], (i3.geometries || i3.geometry || i3.features || i3.coordinates) && this.addData(i3);
            return this;
          }
          var a3 = this.options;
          if (a3.filter && !a3.filter(e4)) return this;
          var o3 = _r(e4, a3);
          return o3 ? (o3.feature = wr(e4), o3.defaultOptions = o3.options, this.resetStyle(o3), a3.onEachFeature && a3.onEachFeature(e4, o3), this.addLayer(o3)) : this;
        },
        resetStyle: function(e4) {
          return e4 === void 0 ? this.eachLayer(this.resetStyle, this) : (e4.options = n2({}, e4.defaultOptions), this._setLayerStyle(e4, this.options.style), this);
        },
        setStyle: function(e4) {
          return this.eachLayer(function(t4) {
            this._setLayerStyle(t4, e4);
          }, this);
        },
        _setLayerStyle: function(e4, t4) {
          e4.setStyle && (typeof t4 == `function` && (t4 = t4(e4.feature)), e4.setStyle(t4));
        }
      });
      function _r(e4, t4) {
        var n3 = e4.type === `Feature` ? e4.geometry : e4, r3 = n3 ? n3.coordinates : null, i3 = [], a3 = t4 && t4.pointToLayer, o3 = t4 && t4.coordsToLatLng || yr, s3, c3, l3, u3;
        if (!r3 && !n3) return null;
        switch (n3.type) {
          case `Point`:
            return s3 = o3(r3), vr(a3, e4, s3, t4);
          case `MultiPoint`:
            for (l3 = 0, u3 = r3.length; l3 < u3; l3++) s3 = o3(r3[l3]), i3.push(vr(a3, e4, s3, t4));
            return new $n(i3);
          case `LineString`:
          case `MultiLineString`:
            return c3 = br(r3, n3.type === `LineString` ? 0 : 1, o3), new fr(c3, t4);
          case `Polygon`:
          case `MultiPolygon`:
            return c3 = br(r3, n3.type === `Polygon` ? 1 : 2, o3), new mr(c3, t4);
          case `GeometryCollection`:
            for (l3 = 0, u3 = n3.geometries.length; l3 < u3; l3++) {
              var d3 = _r({
                geometry: n3.geometries[l3],
                type: `Feature`,
                properties: e4.properties
              }, t4);
              d3 && i3.push(d3);
            }
            return new $n(i3);
          case `FeatureCollection`:
            for (l3 = 0, u3 = n3.features.length; l3 < u3; l3++) {
              var f3 = _r(n3.features[l3], t4);
              f3 && i3.push(f3);
            }
            return new $n(i3);
          default:
            throw Error(`Invalid GeoJSON object.`);
        }
      }
      function vr(e4, t4, n3, r3) {
        return e4 ? e4(t4, n3) : new ar(n3, r3 && r3.markersInheritOptions && r3);
      }
      function yr(e4) {
        return new P2(e4[1], e4[0], e4[2]);
      }
      function br(e4, t4, n3) {
        for (var r3 = [], i3 = 0, a3 = e4.length, o3; i3 < a3; i3++) o3 = t4 ? br(e4[i3], t4 - 1, n3) : (n3 || yr)(e4[i3]), r3.push(o3);
        return r3;
      }
      function xr(e4, t4) {
        return e4 = F2(e4), e4.alt === void 0 ? [
          u2(e4.lng, t4),
          u2(e4.lat, t4)
        ] : [
          u2(e4.lng, t4),
          u2(e4.lat, t4),
          u2(e4.alt, t4)
        ];
      }
      function Sr(e4, t4, n3, r3) {
        for (var i3 = [], a3 = 0, o3 = e4.length; a3 < o3; a3++) i3.push(t4 ? Sr(e4[a3], Bn(e4[a3]) ? 0 : t4 - 1, n3, r3) : xr(e4[a3], r3));
        return !t4 && n3 && i3.length > 0 && i3.push(i3[0].slice()), i3;
      }
      function Cr(e4, t4) {
        return e4.feature ? n2({}, e4.feature, {
          geometry: t4
        }) : wr(t4);
      }
      function wr(e4) {
        return e4.type === `Feature` || e4.type === `FeatureCollection` ? e4 : {
          type: `Feature`,
          properties: {},
          geometry: e4
        };
      }
      var Tr = {
        toGeoJSON: function(e4) {
          return Cr(this, {
            type: `Point`,
            coordinates: xr(this.getLatLng(), e4)
          });
        }
      };
      ar.include(Tr), ur.include(Tr), cr.include(Tr), fr.include({
        toGeoJSON: function(e4) {
          var t4 = !Bn(this._latlngs), n3 = Sr(this._latlngs, +!!t4, false, e4);
          return Cr(this, {
            type: (t4 ? `Multi` : ``) + `LineString`,
            coordinates: n3
          });
        }
      }), mr.include({
        toGeoJSON: function(e4) {
          var t4 = !Bn(this._latlngs), n3 = t4 && !Bn(this._latlngs[0]), r3 = Sr(this._latlngs, n3 ? 2 : +!!t4, true, e4);
          return t4 || (r3 = [
            r3
          ]), Cr(this, {
            type: (n3 ? `Multi` : ``) + `Polygon`,
            coordinates: r3
          });
        }
      }), Zn.include({
        toMultiPoint: function(e4) {
          var t4 = [];
          return this.eachLayer(function(n3) {
            t4.push(n3.toGeoJSON(e4).geometry.coordinates);
          }), Cr(this, {
            type: `MultiPoint`,
            coordinates: t4
          });
        },
        toGeoJSON: function(e4) {
          var t4 = this.feature && this.feature.geometry && this.feature.geometry.type;
          if (t4 === `MultiPoint`) return this.toMultiPoint(e4);
          var n3 = t4 === `GeometryCollection`, r3 = [];
          return this.eachLayer(function(t5) {
            if (t5.toGeoJSON) {
              var i3 = t5.toGeoJSON(e4);
              if (n3) r3.push(i3.geometry);
              else {
                var a3 = wr(i3);
                a3.type === `FeatureCollection` ? r3.push.apply(r3, a3.features) : r3.push(a3);
              }
            }
          }), n3 ? Cr(this, {
            geometries: r3,
            type: `GeometryCollection`
          }) : {
            type: `FeatureCollection`,
            features: r3
          };
        }
      });
      function Er(e4, t4) {
        return new gr(e4, t4);
      }
      var Dr = Er, Or = Xn.extend({
        options: {
          opacity: 1,
          alt: ``,
          interactive: false,
          crossOrigin: false,
          errorOverlayUrl: ``,
          zIndex: 1,
          className: ``
        },
        initialize: function(e4, t4, n3) {
          this._url = e4, this._bounds = ie2(t4), p2(this, n3);
        },
        onAdd: function() {
          this._image || (this._initImage(), this.options.opacity < 1 && this._updateOpacity()), this.options.interactive && (W2(this._image, `leaflet-interactive`), this.addInteractiveTarget(this._image)), this.getPane().appendChild(this._image), this._reset();
        },
        onRemove: function() {
          U2(this._image), this.options.interactive && this.removeInteractiveTarget(this._image);
        },
        setOpacity: function(e4) {
          return this.options.opacity = e4, this._image && this._updateOpacity(), this;
        },
        setStyle: function(e4) {
          return e4.opacity && this.setOpacity(e4.opacity), this;
        },
        bringToFront: function() {
          return this._map && xt2(this._image), this;
        },
        bringToBack: function() {
          return this._map && St2(this._image), this;
        },
        setUrl: function(e4) {
          return this._url = e4, this._image && (this._image.src = e4), this;
        },
        setBounds: function(e4) {
          return this._bounds = ie2(e4), this._map && this._reset(), this;
        },
        getEvents: function() {
          var e4 = {
            zoom: this._reset,
            viewreset: this._reset
          };
          return this._zoomAnimated && (e4.zoomanim = this._animateZoom), e4;
        },
        setZIndex: function(e4) {
          return this.options.zIndex = e4, this._updateZIndex(), this;
        },
        getBounds: function() {
          return this._bounds;
        },
        getElement: function() {
          return this._image;
        },
        _initImage: function() {
          var e4 = this._url.tagName === `IMG`, t4 = this._image = e4 ? this._url : H2(`img`);
          if (W2(t4, `leaflet-image-layer`), this._zoomAnimated && W2(t4, `leaflet-zoom-animated`), this.options.className && W2(t4, this.options.className), t4.onselectstart = l2, t4.onmousemove = l2, t4.onload = i2(this.fire, this, `load`), t4.onerror = i2(this._overlayOnError, this, `error`), (this.options.crossOrigin || this.options.crossOrigin === ``) && (t4.crossOrigin = this.options.crossOrigin === true ? `` : this.options.crossOrigin), this.options.zIndex && this._updateZIndex(), e4) {
            this._url = t4.src;
            return;
          }
          t4.src = this._url, t4.alt = this.options.alt;
        },
        _animateZoom: function(e4) {
          var t4 = this._map.getZoomScale(e4.zoom), n3 = this._map._latLngBoundsToNewLayerBounds(this._bounds, e4.zoom, e4.center).min;
          At2(this._image, n3, t4);
        },
        _reset: function() {
          var e4 = this._image, t4 = new j2(this._map.latLngToLayerPoint(this._bounds.getNorthWest()), this._map.latLngToLayerPoint(this._bounds.getSouthEast())), n3 = t4.getSize();
          jt2(e4, t4.min), e4.style.width = n3.x + `px`, e4.style.height = n3.y + `px`;
        },
        _updateOpacity: function() {
          Dt2(this._image, this.options.opacity);
        },
        _updateZIndex: function() {
          this._image && this.options.zIndex !== void 0 && this.options.zIndex !== null && (this._image.style.zIndex = this.options.zIndex);
        },
        _overlayOnError: function() {
          this.fire(`error`);
          var e4 = this.options.errorOverlayUrl;
          e4 && this._url !== e4 && (this._url = e4, this._image.src = e4);
        },
        getCenter: function() {
          return this._bounds.getCenter();
        }
      }), kr = function(e4, t4, n3) {
        return new Or(e4, t4, n3);
      }, Ar = Or.extend({
        options: {
          autoplay: true,
          loop: true,
          keepAspectRatio: true,
          muted: false,
          playsInline: true
        },
        _initImage: function() {
          var e4 = this._url.tagName === `VIDEO`, t4 = this._image = e4 ? this._url : H2(`video`);
          if (W2(t4, `leaflet-image-layer`), this._zoomAnimated && W2(t4, `leaflet-zoom-animated`), this.options.className && W2(t4, this.options.className), t4.onselectstart = l2, t4.onmousemove = l2, t4.onloadeddata = i2(this.fire, this, `load`), e4) {
            for (var n3 = t4.getElementsByTagName(`source`), r3 = [], a3 = 0; a3 < n3.length; a3++) r3.push(n3[a3].src);
            this._url = n3.length > 0 ? r3 : [
              t4.src
            ];
            return;
          }
          _2(this._url) || (this._url = [
            this._url
          ]), !this.options.keepAspectRatio && Object.prototype.hasOwnProperty.call(t4.style, `objectFit`) && (t4.style.objectFit = `fill`), t4.autoplay = !!this.options.autoplay, t4.loop = !!this.options.loop, t4.muted = !!this.options.muted, t4.playsInline = !!this.options.playsInline;
          for (var o3 = 0; o3 < this._url.length; o3++) {
            var s3 = H2(`source`);
            s3.src = this._url[o3], t4.appendChild(s3);
          }
        }
      });
      function jr(e4, t4, n3) {
        return new Ar(e4, t4, n3);
      }
      var Mr = Or.extend({
        _initImage: function() {
          var e4 = this._image = this._url;
          W2(e4, `leaflet-image-layer`), this._zoomAnimated && W2(e4, `leaflet-zoom-animated`), this.options.className && W2(e4, this.options.className), e4.onselectstart = l2, e4.onmousemove = l2;
        }
      });
      function Nr(e4, t4, n3) {
        return new Mr(e4, t4, n3);
      }
      var Pr = Xn.extend({
        options: {
          interactive: false,
          offset: [
            0,
            0
          ],
          className: ``,
          pane: void 0,
          content: ``
        },
        initialize: function(e4, t4) {
          e4 && (e4 instanceof P2 || _2(e4)) ? (this._latlng = F2(e4), p2(this, t4)) : (p2(this, e4), this._source = t4), this.options.content && (this._content = this.options.content);
        },
        openOn: function(e4) {
          return e4 = arguments.length ? e4 : this._source._map, e4.hasLayer(this) || e4.addLayer(this), this;
        },
        close: function() {
          return this._map && this._map.removeLayer(this), this;
        },
        toggle: function(e4) {
          return this._map ? this.close() : (arguments.length ? this._source = e4 : e4 = this._source, this._prepareOpen(), this.openOn(e4._map)), this;
        },
        onAdd: function(e4) {
          this._zoomAnimated = e4._zoomAnimated, this._container || this._initLayout(), e4._fadeAnimated && Dt2(this._container, 0), clearTimeout(this._removeTimeout), this.getPane().appendChild(this._container), this.update(), e4._fadeAnimated && Dt2(this._container, 1), this.bringToFront(), this.options.interactive && (W2(this._container, `leaflet-interactive`), this.addInteractiveTarget(this._container));
        },
        onRemove: function(e4) {
          e4._fadeAnimated ? (Dt2(this._container, 0), this._removeTimeout = setTimeout(i2(U2, void 0, this._container), 200)) : U2(this._container), this.options.interactive && (wt2(this._container, `leaflet-interactive`), this.removeInteractiveTarget(this._container));
        },
        getLatLng: function() {
          return this._latlng;
        },
        setLatLng: function(e4) {
          return this._latlng = F2(e4), this._map && (this._updatePosition(), this._adjustPan()), this;
        },
        getContent: function() {
          return this._content;
        },
        setContent: function(e4) {
          return this._content = e4, this.update(), this;
        },
        getElement: function() {
          return this._container;
        },
        update: function() {
          this._map && (this._container.style.visibility = `hidden`, this._updateContent(), this._updateLayout(), this._updatePosition(), this._container.style.visibility = ``, this._adjustPan());
        },
        getEvents: function() {
          var e4 = {
            zoom: this._updatePosition,
            viewreset: this._updatePosition
          };
          return this._zoomAnimated && (e4.zoomanim = this._animateZoom), e4;
        },
        isOpen: function() {
          return !!this._map && this._map.hasLayer(this);
        },
        bringToFront: function() {
          return this._map && xt2(this._container), this;
        },
        bringToBack: function() {
          return this._map && St2(this._container), this;
        },
        _prepareOpen: function(e4) {
          var t4 = this._source;
          if (!t4._map) return false;
          if (t4 instanceof $n) {
            t4 = null;
            var n3 = this._source._layers;
            for (var r3 in n3) if (n3[r3]._map) {
              t4 = n3[r3];
              break;
            }
            if (!t4) return false;
            this._source = t4;
          }
          if (!e4) if (t4.getCenter) e4 = t4.getCenter();
          else if (t4.getLatLng) e4 = t4.getLatLng();
          else if (t4.getBounds) e4 = t4.getBounds().getCenter();
          else throw Error(`Unable to get source layer LatLng.`);
          return this.setLatLng(e4), this._map && this.update(), true;
        },
        _updateContent: function() {
          if (this._content) {
            var e4 = this._contentNode, t4 = typeof this._content == `function` ? this._content(this._source || this) : this._content;
            if (typeof t4 == `string`) e4.innerHTML = t4;
            else {
              for (; e4.hasChildNodes(); ) e4.removeChild(e4.firstChild);
              e4.appendChild(t4);
            }
            this.fire(`contentupdate`);
          }
        },
        _updatePosition: function() {
          if (this._map) {
            var e4 = this._map.latLngToLayerPoint(this._latlng), t4 = A2(this.options.offset), n3 = this._getAnchor();
            this._zoomAnimated ? jt2(this._container, e4.add(n3)) : t4 = t4.add(e4).add(n3);
            var r3 = this._containerBottom = -t4.y, i3 = this._containerLeft = -Math.round(this._containerWidth / 2) + t4.x;
            this._container.style.bottom = r3 + `px`, this._container.style.left = i3 + `px`;
          }
        },
        _getAnchor: function() {
          return [
            0,
            0
          ];
        }
      });
      q2.include({
        _initOverlay: function(e4, t4, n3, r3) {
          var i3 = t4;
          return i3 instanceof e4 || (i3 = new e4(r3).setContent(t4)), n3 && i3.setLatLng(n3), i3;
        }
      }), Xn.include({
        _initOverlay: function(e4, t4, n3, r3) {
          var i3 = n3;
          return i3 instanceof e4 ? (p2(i3, r3), i3._source = this) : (i3 = t4 && !r3 ? t4 : new e4(r3, this), i3.setContent(n3)), i3;
        }
      });
      var Fr = Pr.extend({
        options: {
          pane: `popupPane`,
          offset: [
            0,
            7
          ],
          maxWidth: 300,
          minWidth: 50,
          maxHeight: null,
          autoPan: true,
          autoPanPaddingTopLeft: null,
          autoPanPaddingBottomRight: null,
          autoPanPadding: [
            5,
            5
          ],
          keepInView: false,
          closeButton: true,
          autoClose: true,
          closeOnEscapeKey: true,
          className: ``
        },
        openOn: function(e4) {
          return e4 = arguments.length ? e4 : this._source._map, !e4.hasLayer(this) && e4._popup && e4._popup.options.autoClose && e4.removeLayer(e4._popup), e4._popup = this, Pr.prototype.openOn.call(this, e4);
        },
        onAdd: function(e4) {
          Pr.prototype.onAdd.call(this, e4), e4.fire(`popupopen`, {
            popup: this
          }), this._source && (this._source.fire(`popupopen`, {
            popup: this
          }, true), this._source instanceof sr || this._source.on(`preclick`, Zt2));
        },
        onRemove: function(e4) {
          Pr.prototype.onRemove.call(this, e4), e4.fire(`popupclose`, {
            popup: this
          }), this._source && (this._source.fire(`popupclose`, {
            popup: this
          }, true), this._source instanceof sr || this._source.off(`preclick`, Zt2));
        },
        getEvents: function() {
          var e4 = Pr.prototype.getEvents.call(this);
          return (this.options.closeOnClick === void 0 ? this._map.options.closePopupOnClick : this.options.closeOnClick) && (e4.preclick = this.close), this.options.keepInView && (e4.moveend = this._adjustPan), e4;
        },
        _initLayout: function() {
          var e4 = `leaflet-popup`, t4 = this._container = H2(`div`, e4 + ` ` + (this.options.className || ``) + ` leaflet-zoom-animated`), n3 = this._wrapper = H2(`div`, e4 + `-content-wrapper`, t4);
          if (this._contentNode = H2(`div`, e4 + `-content`, n3), $t2(t4), Qt2(this._contentNode), G2(t4, `contextmenu`, Zt2), this._tipContainer = H2(`div`, e4 + `-tip-container`, t4), this._tip = H2(`div`, e4 + `-tip`, this._tipContainer), this.options.closeButton) {
            var r3 = this._closeButton = H2(`a`, e4 + `-close-button`, t4);
            r3.setAttribute(`role`, `button`), r3.setAttribute(`aria-label`, `Close popup`), r3.href = `#close`, r3.innerHTML = `<span aria-hidden="true">&#215;</span>`, G2(r3, `click`, function(e5) {
              en2(e5), this.close();
            }, this);
          }
        },
        _updateLayout: function() {
          var e4 = this._contentNode, t4 = e4.style;
          t4.width = ``, t4.whiteSpace = `nowrap`;
          var n3 = e4.offsetWidth;
          n3 = Math.min(n3, this.options.maxWidth), n3 = Math.max(n3, this.options.minWidth), t4.width = n3 + 1 + `px`, t4.whiteSpace = ``, t4.height = ``;
          var r3 = e4.offsetHeight, i3 = this.options.maxHeight, a3 = `leaflet-popup-scrolled`;
          i3 && r3 > i3 ? (t4.height = i3 + `px`, W2(e4, a3)) : wt2(e4, a3), this._containerWidth = this._container.offsetWidth;
        },
        _animateZoom: function(e4) {
          var t4 = this._map._latLngToNewLayerPoint(this._latlng, e4.zoom, e4.center), n3 = this._getAnchor();
          jt2(this._container, t4.add(n3));
        },
        _adjustPan: function() {
          if (this.options.autoPan) {
            if (this._map._panAnim && this._map._panAnim.stop(), this._autopanning) {
              this._autopanning = false;
              return;
            }
            var e4 = this._map, t4 = parseInt(V2(this._container, `marginBottom`), 10) || 0, n3 = this._container.offsetHeight + t4, r3 = this._containerWidth, i3 = new O2(this._containerLeft, -n3 - this._containerBottom);
            i3._add(Mt2(this._container));
            var a3 = e4.layerPointToContainerPoint(i3), o3 = A2(this.options.autoPanPadding), s3 = A2(this.options.autoPanPaddingTopLeft || o3), c3 = A2(this.options.autoPanPaddingBottomRight || o3), l3 = e4.getSize(), u3 = 0, d3 = 0;
            a3.x + r3 + c3.x > l3.x && (u3 = a3.x + r3 - l3.x + c3.x), a3.x - u3 - s3.x < 0 && (u3 = a3.x - s3.x), a3.y + n3 + c3.y > l3.y && (d3 = a3.y + n3 - l3.y + c3.y), a3.y - d3 - s3.y < 0 && (d3 = a3.y - s3.y), (u3 || d3) && (this.options.keepInView && (this._autopanning = true), e4.fire(`autopanstart`).panBy([
              u3,
              d3
            ]));
          }
        },
        _getAnchor: function() {
          return A2(this._source && this._source._getPopupAnchor ? this._source._getPopupAnchor() : [
            0,
            0
          ]);
        }
      }), Ir = function(e4, t4) {
        return new Fr(e4, t4);
      };
      q2.mergeOptions({
        closePopupOnClick: true
      }), q2.include({
        openPopup: function(e4, t4, n3) {
          return this._initOverlay(Fr, e4, t4, n3).openOn(this), this;
        },
        closePopup: function(e4) {
          return e4 = arguments.length ? e4 : this._popup, e4 && e4.close(), this;
        }
      }), Xn.include({
        bindPopup: function(e4, t4) {
          return this._popup = this._initOverlay(Fr, this._popup, e4, t4), this._popupHandlersAdded ||= (this.on({
            click: this._openPopup,
            keypress: this._onKeyPress,
            remove: this.closePopup,
            move: this._movePopup
          }), true), this;
        },
        unbindPopup: function() {
          return this._popup &&= (this.off({
            click: this._openPopup,
            keypress: this._onKeyPress,
            remove: this.closePopup,
            move: this._movePopup
          }), this._popupHandlersAdded = false, null), this;
        },
        openPopup: function(e4) {
          return this._popup && (this instanceof $n || (this._popup._source = this), this._popup._prepareOpen(e4 || this._latlng) && this._popup.openOn(this._map)), this;
        },
        closePopup: function() {
          return this._popup && this._popup.close(), this;
        },
        togglePopup: function() {
          return this._popup && this._popup.toggle(this), this;
        },
        isPopupOpen: function() {
          return this._popup ? this._popup.isOpen() : false;
        },
        setPopupContent: function(e4) {
          return this._popup && this._popup.setContent(e4), this;
        },
        getPopup: function() {
          return this._popup;
        },
        _openPopup: function(e4) {
          if (!(!this._popup || !this._map)) {
            tn2(e4);
            var t4 = e4.layer || e4.target;
            if (this._popup._source === t4 && !(t4 instanceof sr)) {
              this._map.hasLayer(this._popup) ? this.closePopup() : this.openPopup(e4.latlng);
              return;
            }
            this._popup._source = t4, this.openPopup(e4.latlng);
          }
        },
        _movePopup: function(e4) {
          this._popup.setLatLng(e4.latlng);
        },
        _onKeyPress: function(e4) {
          e4.originalEvent.keyCode === 13 && this._openPopup(e4);
        }
      });
      var Lr = Pr.extend({
        options: {
          pane: `tooltipPane`,
          offset: [
            0,
            0
          ],
          direction: `auto`,
          permanent: false,
          sticky: false,
          opacity: 0.9
        },
        onAdd: function(e4) {
          Pr.prototype.onAdd.call(this, e4), this.setOpacity(this.options.opacity), e4.fire(`tooltipopen`, {
            tooltip: this
          }), this._source && (this.addEventParent(this._source), this._source.fire(`tooltipopen`, {
            tooltip: this
          }, true));
        },
        onRemove: function(e4) {
          Pr.prototype.onRemove.call(this, e4), e4.fire(`tooltipclose`, {
            tooltip: this
          }), this._source && (this.removeEventParent(this._source), this._source.fire(`tooltipclose`, {
            tooltip: this
          }, true));
        },
        getEvents: function() {
          var e4 = Pr.prototype.getEvents.call(this);
          return this.options.permanent || (e4.preclick = this.close), e4;
        },
        _initLayout: function() {
          var e4 = `leaflet-tooltip ` + (this.options.className || ``) + ` leaflet-zoom-` + (this._zoomAnimated ? `animated` : `hide`);
          this._contentNode = this._container = H2(`div`, e4), this._container.setAttribute(`role`, `tooltip`), this._container.setAttribute(`id`, `leaflet-tooltip-` + o2(this));
        },
        _updateLayout: function() {
        },
        _adjustPan: function() {
        },
        _setPosition: function(e4) {
          var t4, n3, r3 = this._map, i3 = this._container, a3 = r3.latLngToContainerPoint(r3.getCenter()), o3 = r3.layerPointToContainerPoint(e4), s3 = this.options.direction, c3 = i3.offsetWidth, l3 = i3.offsetHeight, u3 = A2(this.options.offset), d3 = this._getAnchor();
          s3 === `top` ? (t4 = c3 / 2, n3 = l3) : s3 === `bottom` ? (t4 = c3 / 2, n3 = 0) : s3 === `center` ? (t4 = c3 / 2, n3 = l3 / 2) : s3 === `right` ? (t4 = 0, n3 = l3 / 2) : s3 === `left` ? (t4 = c3, n3 = l3 / 2) : o3.x < a3.x ? (s3 = `right`, t4 = 0, n3 = l3 / 2) : (s3 = `left`, t4 = c3 + (u3.x + d3.x) * 2, n3 = l3 / 2), e4 = e4.subtract(A2(t4, n3, true)).add(u3).add(d3), wt2(i3, `leaflet-tooltip-right`), wt2(i3, `leaflet-tooltip-left`), wt2(i3, `leaflet-tooltip-top`), wt2(i3, `leaflet-tooltip-bottom`), W2(i3, `leaflet-tooltip-` + s3), jt2(i3, e4);
        },
        _updatePosition: function() {
          var e4 = this._map.latLngToLayerPoint(this._latlng);
          this._setPosition(e4);
        },
        setOpacity: function(e4) {
          this.options.opacity = e4, this._container && Dt2(this._container, e4);
        },
        _animateZoom: function(e4) {
          var t4 = this._map._latLngToNewLayerPoint(this._latlng, e4.zoom, e4.center);
          this._setPosition(t4);
        },
        _getAnchor: function() {
          return A2(this._source && this._source._getTooltipAnchor && !this.options.sticky ? this._source._getTooltipAnchor() : [
            0,
            0
          ]);
        }
      }), Rr = function(e4, t4) {
        return new Lr(e4, t4);
      };
      q2.include({
        openTooltip: function(e4, t4, n3) {
          return this._initOverlay(Lr, e4, t4, n3).openOn(this), this;
        },
        closeTooltip: function(e4) {
          return e4.close(), this;
        }
      }), Xn.include({
        bindTooltip: function(e4, t4) {
          return this._tooltip && this.isTooltipOpen() && this.unbindTooltip(), this._tooltip = this._initOverlay(Lr, this._tooltip, e4, t4), this._initTooltipInteractions(), this._tooltip.options.permanent && this._map && this._map.hasLayer(this) && this.openTooltip(), this;
        },
        unbindTooltip: function() {
          return this._tooltip &&= (this._initTooltipInteractions(true), this.closeTooltip(), null), this;
        },
        _initTooltipInteractions: function(e4) {
          if (!(!e4 && this._tooltipHandlersAdded)) {
            var t4 = e4 ? `off` : `on`, n3 = {
              remove: this.closeTooltip,
              move: this._moveTooltip
            };
            this._tooltip.options.permanent ? n3.add = this._openTooltip : (n3.mouseover = this._openTooltip, n3.mouseout = this.closeTooltip, n3.click = this._openTooltip, this._map ? this._addFocusListeners() : n3.add = this._addFocusListeners), this._tooltip.options.sticky && (n3.mousemove = this._moveTooltip), this[t4](n3), this._tooltipHandlersAdded = !e4;
          }
        },
        openTooltip: function(e4) {
          return this._tooltip && (this instanceof $n || (this._tooltip._source = this), this._tooltip._prepareOpen(e4) && (this._tooltip.openOn(this._map), this.getElement ? this._setAriaDescribedByOnLayer(this) : this.eachLayer && this.eachLayer(this._setAriaDescribedByOnLayer, this))), this;
        },
        closeTooltip: function() {
          if (this._tooltip) return this._tooltip.close();
        },
        toggleTooltip: function() {
          return this._tooltip && this._tooltip.toggle(this), this;
        },
        isTooltipOpen: function() {
          return this._tooltip.isOpen();
        },
        setTooltipContent: function(e4) {
          return this._tooltip && this._tooltip.setContent(e4), this;
        },
        getTooltip: function() {
          return this._tooltip;
        },
        _addFocusListeners: function() {
          this.getElement ? this._addFocusListenersOnLayer(this) : this.eachLayer && this.eachLayer(this._addFocusListenersOnLayer, this);
        },
        _addFocusListenersOnLayer: function(e4) {
          var t4 = typeof e4.getElement == `function` && e4.getElement();
          t4 && (G2(t4, `focus`, function() {
            this._tooltip._source = e4, this.openTooltip();
          }, this), G2(t4, `blur`, this.closeTooltip, this));
        },
        _setAriaDescribedByOnLayer: function(e4) {
          var t4 = typeof e4.getElement == `function` && e4.getElement();
          t4 && t4.setAttribute(`aria-describedby`, this._tooltip._container.id);
        },
        _openTooltip: function(e4) {
          if (!(!this._tooltip || !this._map)) {
            if (this._map.dragging && this._map.dragging.moving() && !this._openOnceFlag) {
              this._openOnceFlag = true;
              var t4 = this;
              this._map.once(`moveend`, function() {
                t4._openOnceFlag = false, t4._openTooltip(e4);
              });
              return;
            }
            this._tooltip._source = e4.layer || e4.target, this.openTooltip(this._tooltip.options.sticky ? e4.latlng : void 0);
          }
        },
        _moveTooltip: function(e4) {
          var t4 = e4.latlng, n3, r3;
          this._tooltip.options.sticky && e4.originalEvent && (n3 = this._map.mouseEventToContainerPoint(e4.originalEvent), r3 = this._map.containerPointToLayerPoint(n3), t4 = this._map.layerPointToLatLng(r3)), this._tooltip.setLatLng(t4);
        }
      });
      var zr = tr.extend({
        options: {
          iconSize: [
            12,
            12
          ],
          html: false,
          bgPos: null,
          className: `leaflet-div-icon`
        },
        createIcon: function(e4) {
          var t4 = e4 && e4.tagName === `DIV` ? e4 : document.createElement(`div`), n3 = this.options;
          if (n3.html instanceof Element ? (bt2(t4), t4.appendChild(n3.html)) : t4.innerHTML = n3.html === false ? `` : n3.html, n3.bgPos) {
            var r3 = A2(n3.bgPos);
            t4.style.backgroundPosition = -r3.x + `px ` + -r3.y + `px`;
          }
          return this._setIconStyles(t4, `icon`), t4;
        },
        createShadow: function() {
          return null;
        }
      });
      function Br(e4) {
        return new zr(e4);
      }
      tr.Default = rr;
      var Vr = Xn.extend({
        options: {
          tileSize: 256,
          opacity: 1,
          updateWhenIdle: z2.mobile,
          updateWhenZooming: true,
          updateInterval: 200,
          zIndex: 1,
          bounds: null,
          minZoom: 0,
          maxZoom: void 0,
          maxNativeZoom: void 0,
          minNativeZoom: void 0,
          noWrap: false,
          pane: `tilePane`,
          className: ``,
          keepBuffer: 2
        },
        initialize: function(e4) {
          p2(this, e4);
        },
        onAdd: function() {
          this._initContainer(), this._levels = {}, this._tiles = {}, this._resetView();
        },
        beforeAdd: function(e4) {
          e4._addZoomLimit(this);
        },
        onRemove: function(e4) {
          this._removeAllTiles(), U2(this._container), e4._removeZoomLimit(this), this._container = null, this._tileZoom = void 0;
        },
        bringToFront: function() {
          return this._map && (xt2(this._container), this._setAutoZIndex(Math.max)), this;
        },
        bringToBack: function() {
          return this._map && (St2(this._container), this._setAutoZIndex(Math.min)), this;
        },
        getContainer: function() {
          return this._container;
        },
        setOpacity: function(e4) {
          return this.options.opacity = e4, this._updateOpacity(), this;
        },
        setZIndex: function(e4) {
          return this.options.zIndex = e4, this._updateZIndex(), this;
        },
        isLoading: function() {
          return this._loading;
        },
        redraw: function() {
          if (this._map) {
            this._removeAllTiles();
            var e4 = this._clampZoom(this._map.getZoom());
            e4 !== this._tileZoom && (this._tileZoom = e4, this._updateLevels()), this._update();
          }
          return this;
        },
        getEvents: function() {
          var e4 = {
            viewprereset: this._invalidateAll,
            viewreset: this._resetView,
            zoom: this._resetView,
            moveend: this._onMoveEnd
          };
          return this.options.updateWhenIdle || (this._onMove ||= s2(this._onMoveEnd, this.options.updateInterval, this), e4.move = this._onMove), this._zoomAnimated && (e4.zoomanim = this._animateZoom), e4;
        },
        createTile: function() {
          return document.createElement(`div`);
        },
        getTileSize: function() {
          var e4 = this.options.tileSize;
          return e4 instanceof O2 ? e4 : new O2(e4, e4);
        },
        _updateZIndex: function() {
          this._container && this.options.zIndex !== void 0 && this.options.zIndex !== null && (this._container.style.zIndex = this.options.zIndex);
        },
        _setAutoZIndex: function(e4) {
          for (var t4 = this.getPane().children, n3 = -e4(-1 / 0, 1 / 0), r3 = 0, i3 = t4.length, a3; r3 < i3; r3++) a3 = t4[r3].style.zIndex, t4[r3] !== this._container && a3 && (n3 = e4(n3, +a3));
          isFinite(n3) && (this.options.zIndex = n3 + e4(-1, 1), this._updateZIndex());
        },
        _updateOpacity: function() {
          if (this._map && !z2.ielt9) {
            Dt2(this._container, this.options.opacity);
            var e4 = +/* @__PURE__ */ new Date(), t4 = false, n3 = false;
            for (var r3 in this._tiles) {
              var i3 = this._tiles[r3];
              if (!(!i3.current || !i3.loaded)) {
                var a3 = Math.min(1, (e4 - i3.loaded) / 200);
                Dt2(i3.el, a3), a3 < 1 ? t4 = true : (i3.active ? n3 = true : this._onOpaqueTile(i3), i3.active = true);
              }
            }
            n3 && !this._noPrune && this._pruneTiles(), t4 && (T2(this._fadeFrame), this._fadeFrame = ee2(this._updateOpacity, this));
          }
        },
        _onOpaqueTile: l2,
        _initContainer: function() {
          this._container || (this._container = H2(`div`, `leaflet-layer ` + (this.options.className || ``)), this._updateZIndex(), this.options.opacity < 1 && this._updateOpacity(), this.getPane().appendChild(this._container));
        },
        _updateLevels: function() {
          var e4 = this._tileZoom, t4 = this.options.maxZoom;
          if (e4 !== void 0) {
            for (var n3 in this._levels) n3 = Number(n3), this._levels[n3].el.children.length || n3 === e4 ? (this._levels[n3].el.style.zIndex = t4 - Math.abs(e4 - n3), this._onUpdateLevel(n3)) : (U2(this._levels[n3].el), this._removeTilesAtZoom(n3), this._onRemoveLevel(n3), delete this._levels[n3]);
            var r3 = this._levels[e4], i3 = this._map;
            return r3 || (r3 = this._levels[e4] = {}, r3.el = H2(`div`, `leaflet-tile-container leaflet-zoom-animated`, this._container), r3.el.style.zIndex = t4, r3.origin = i3.project(i3.unproject(i3.getPixelOrigin()), e4).round(), r3.zoom = e4, this._setZoomTransform(r3, i3.getCenter(), i3.getZoom()), r3.el.offsetWidth, this._onCreateLevel(r3)), this._level = r3, r3;
          }
        },
        _onUpdateLevel: l2,
        _onRemoveLevel: l2,
        _onCreateLevel: l2,
        _pruneTiles: function() {
          if (this._map) {
            var e4, t4, n3 = this._map.getZoom();
            if (n3 > this.options.maxZoom || n3 < this.options.minZoom) {
              this._removeAllTiles();
              return;
            }
            for (e4 in this._tiles) t4 = this._tiles[e4], t4.retain = t4.current;
            for (e4 in this._tiles) if (t4 = this._tiles[e4], t4.current && !t4.active) {
              var r3 = t4.coords;
              this._retainParent(r3.x, r3.y, r3.z, r3.z - 5) || this._retainChildren(r3.x, r3.y, r3.z, r3.z + 2);
            }
            for (e4 in this._tiles) this._tiles[e4].retain || this._removeTile(e4);
          }
        },
        _removeTilesAtZoom: function(e4) {
          for (var t4 in this._tiles) this._tiles[t4].coords.z === e4 && this._removeTile(t4);
        },
        _removeAllTiles: function() {
          for (var e4 in this._tiles) this._removeTile(e4);
        },
        _invalidateAll: function() {
          for (var e4 in this._levels) U2(this._levels[e4].el), this._onRemoveLevel(Number(e4)), delete this._levels[e4];
          this._removeAllTiles(), this._tileZoom = void 0;
        },
        _retainParent: function(e4, t4, n3, r3) {
          var i3 = Math.floor(e4 / 2), a3 = Math.floor(t4 / 2), o3 = n3 - 1, s3 = new O2(+i3, +a3);
          s3.z = +o3;
          var c3 = this._tileCoordsToKey(s3), l3 = this._tiles[c3];
          return l3 && l3.active ? (l3.retain = true, true) : (l3 && l3.loaded && (l3.retain = true), o3 > r3 && this._retainParent(i3, a3, o3, r3));
        },
        _retainChildren: function(e4, t4, n3, r3) {
          for (var i3 = 2 * e4; i3 < 2 * e4 + 2; i3++) for (var a3 = 2 * t4; a3 < 2 * t4 + 2; a3++) {
            var o3 = new O2(i3, a3);
            o3.z = n3 + 1;
            var s3 = this._tileCoordsToKey(o3), c3 = this._tiles[s3];
            if (c3 && c3.active) {
              c3.retain = true;
              continue;
            } else c3 && c3.loaded && (c3.retain = true);
            n3 + 1 < r3 && this._retainChildren(i3, a3, n3 + 1, r3);
          }
        },
        _resetView: function(e4) {
          var t4 = e4 && (e4.pinch || e4.flyTo);
          this._setView(this._map.getCenter(), this._map.getZoom(), t4, t4);
        },
        _animateZoom: function(e4) {
          this._setView(e4.center, e4.zoom, true, e4.noUpdate);
        },
        _clampZoom: function(e4) {
          var t4 = this.options;
          return t4.minNativeZoom !== void 0 && e4 < t4.minNativeZoom ? t4.minNativeZoom : t4.maxNativeZoom !== void 0 && t4.maxNativeZoom < e4 ? t4.maxNativeZoom : e4;
        },
        _setView: function(e4, t4, n3, r3) {
          var i3 = Math.round(t4);
          i3 = this.options.maxZoom !== void 0 && i3 > this.options.maxZoom || this.options.minZoom !== void 0 && i3 < this.options.minZoom ? void 0 : this._clampZoom(i3);
          var a3 = this.options.updateWhenZooming && i3 !== this._tileZoom;
          (!r3 || a3) && (this._tileZoom = i3, this._abortLoading && this._abortLoading(), this._updateLevels(), this._resetGrid(), i3 !== void 0 && this._update(e4), n3 || this._pruneTiles(), this._noPrune = !!n3), this._setZoomTransforms(e4, t4);
        },
        _setZoomTransforms: function(e4, t4) {
          for (var n3 in this._levels) this._setZoomTransform(this._levels[n3], e4, t4);
        },
        _setZoomTransform: function(e4, t4, n3) {
          var r3 = this._map.getZoomScale(n3, e4.zoom), i3 = e4.origin.multiplyBy(r3).subtract(this._map._getNewPixelOrigin(t4, n3)).round();
          z2.any3d ? At2(e4.el, i3, r3) : jt2(e4.el, i3);
        },
        _resetGrid: function() {
          var e4 = this._map, t4 = e4.options.crs, n3 = this._tileSize = this.getTileSize(), r3 = this._tileZoom, i3 = this._map.getPixelWorldBounds(this._tileZoom);
          i3 && (this._globalTileRange = this._pxBoundsToTileRange(i3)), this._wrapX = t4.wrapLng && !this.options.noWrap && [
            Math.floor(e4.project([
              0,
              t4.wrapLng[0]
            ], r3).x / n3.x),
            Math.ceil(e4.project([
              0,
              t4.wrapLng[1]
            ], r3).x / n3.y)
          ], this._wrapY = t4.wrapLat && !this.options.noWrap && [
            Math.floor(e4.project([
              t4.wrapLat[0],
              0
            ], r3).y / n3.x),
            Math.ceil(e4.project([
              t4.wrapLat[1],
              0
            ], r3).y / n3.y)
          ];
        },
        _onMoveEnd: function() {
          !this._map || this._map._animatingZoom || this._update();
        },
        _getTiledPixelBounds: function(e4) {
          var t4 = this._map, n3 = t4._animatingZoom ? Math.max(t4._animateToZoom, t4.getZoom()) : t4.getZoom(), r3 = t4.getZoomScale(n3, this._tileZoom), i3 = t4.project(e4, this._tileZoom).floor(), a3 = t4.getSize().divideBy(r3 * 2);
          return new j2(i3.subtract(a3), i3.add(a3));
        },
        _update: function(e4) {
          var t4 = this._map;
          if (t4) {
            var n3 = this._clampZoom(t4.getZoom());
            if (e4 === void 0 && (e4 = t4.getCenter()), this._tileZoom !== void 0) {
              var r3 = this._getTiledPixelBounds(e4), i3 = this._pxBoundsToTileRange(r3), a3 = i3.getCenter(), o3 = [], s3 = this.options.keepBuffer, c3 = new j2(i3.getBottomLeft().subtract([
                s3,
                -s3
              ]), i3.getTopRight().add([
                s3,
                -s3
              ]));
              if (!(isFinite(i3.min.x) && isFinite(i3.min.y) && isFinite(i3.max.x) && isFinite(i3.max.y))) throw Error(`Attempted to load an infinite number of tiles`);
              for (var l3 in this._tiles) {
                var u3 = this._tiles[l3].coords;
                (u3.z !== this._tileZoom || !c3.contains(new O2(u3.x, u3.y))) && (this._tiles[l3].current = false);
              }
              if (Math.abs(n3 - this._tileZoom) > 1) {
                this._setView(e4, n3);
                return;
              }
              for (var d3 = i3.min.y; d3 <= i3.max.y; d3++) for (var f3 = i3.min.x; f3 <= i3.max.x; f3++) {
                var p3 = new O2(f3, d3);
                if (p3.z = this._tileZoom, this._isValidTile(p3)) {
                  var m3 = this._tiles[this._tileCoordsToKey(p3)];
                  m3 ? m3.current = true : o3.push(p3);
                }
              }
              if (o3.sort(function(e5, t5) {
                return e5.distanceTo(a3) - t5.distanceTo(a3);
              }), o3.length !== 0) {
                this._loading || (this._loading = true, this.fire(`loading`));
                var h3 = document.createDocumentFragment();
                for (f3 = 0; f3 < o3.length; f3++) this._addTile(o3[f3], h3);
                this._level.el.appendChild(h3);
              }
            }
          }
        },
        _isValidTile: function(e4) {
          var t4 = this._map.options.crs;
          if (!t4.infinite) {
            var n3 = this._globalTileRange;
            if (!t4.wrapLng && (e4.x < n3.min.x || e4.x > n3.max.x) || !t4.wrapLat && (e4.y < n3.min.y || e4.y > n3.max.y)) return false;
          }
          if (!this.options.bounds) return true;
          var r3 = this._tileCoordsToBounds(e4);
          return ie2(this.options.bounds).overlaps(r3);
        },
        _keyToBounds: function(e4) {
          return this._tileCoordsToBounds(this._keyToTileCoords(e4));
        },
        _tileCoordsToNwSe: function(e4) {
          var t4 = this._map, n3 = this.getTileSize(), r3 = e4.scaleBy(n3), i3 = r3.add(n3);
          return [
            t4.unproject(r3, e4.z),
            t4.unproject(i3, e4.z)
          ];
        },
        _tileCoordsToBounds: function(e4) {
          var t4 = this._tileCoordsToNwSe(e4), n3 = new N2(t4[0], t4[1]);
          return this.options.noWrap || (n3 = this._map.wrapLatLngBounds(n3)), n3;
        },
        _tileCoordsToKey: function(e4) {
          return e4.x + `:` + e4.y + `:` + e4.z;
        },
        _keyToTileCoords: function(e4) {
          var t4 = e4.split(`:`), n3 = new O2(+t4[0], +t4[1]);
          return n3.z = +t4[2], n3;
        },
        _removeTile: function(e4) {
          var t4 = this._tiles[e4];
          t4 && (U2(t4.el), delete this._tiles[e4], this.fire(`tileunload`, {
            tile: t4.el,
            coords: this._keyToTileCoords(e4)
          }));
        },
        _initTile: function(e4) {
          W2(e4, `leaflet-tile`);
          var t4 = this.getTileSize();
          e4.style.width = t4.x + `px`, e4.style.height = t4.y + `px`, e4.onselectstart = l2, e4.onmousemove = l2, z2.ielt9 && this.options.opacity < 1 && Dt2(e4, this.options.opacity);
        },
        _addTile: function(e4, t4) {
          var n3 = this._getTilePos(e4), r3 = this._tileCoordsToKey(e4), a3 = this.createTile(this._wrapCoords(e4), i2(this._tileReady, this, e4));
          this._initTile(a3), this.createTile.length < 2 && ee2(i2(this._tileReady, this, e4, null, a3)), jt2(a3, n3), this._tiles[r3] = {
            el: a3,
            coords: e4,
            current: true
          }, t4.appendChild(a3), this.fire(`tileloadstart`, {
            tile: a3,
            coords: e4
          });
        },
        _tileReady: function(e4, t4, n3) {
          t4 && this.fire(`tileerror`, {
            error: t4,
            tile: n3,
            coords: e4
          });
          var r3 = this._tileCoordsToKey(e4);
          n3 = this._tiles[r3], n3 && (n3.loaded = +/* @__PURE__ */ new Date(), this._map._fadeAnimated ? (Dt2(n3.el, 0), T2(this._fadeFrame), this._fadeFrame = ee2(this._updateOpacity, this)) : (n3.active = true, this._pruneTiles()), t4 || (W2(n3.el, `leaflet-tile-loaded`), this.fire(`tileload`, {
            tile: n3.el,
            coords: e4
          })), this._noTilesToLoad() && (this._loading = false, this.fire(`load`), z2.ielt9 || !this._map._fadeAnimated ? ee2(this._pruneTiles, this) : setTimeout(i2(this._pruneTiles, this), 250)));
        },
        _getTilePos: function(e4) {
          return e4.scaleBy(this.getTileSize()).subtract(this._level.origin);
        },
        _wrapCoords: function(e4) {
          var t4 = new O2(this._wrapX ? c2(e4.x, this._wrapX) : e4.x, this._wrapY ? c2(e4.y, this._wrapY) : e4.y);
          return t4.z = e4.z, t4;
        },
        _pxBoundsToTileRange: function(e4) {
          var t4 = this.getTileSize();
          return new j2(e4.min.unscaleBy(t4).floor(), e4.max.unscaleBy(t4).ceil().subtract([
            1,
            1
          ]));
        },
        _noTilesToLoad: function() {
          for (var e4 in this._tiles) if (!this._tiles[e4].loaded) return false;
          return true;
        }
      });
      function Hr(e4) {
        return new Vr(e4);
      }
      var Ur = Vr.extend({
        options: {
          minZoom: 0,
          maxZoom: 18,
          subdomains: `abc`,
          errorTileUrl: ``,
          zoomOffset: 0,
          tms: false,
          zoomReverse: false,
          detectRetina: false,
          crossOrigin: false,
          referrerPolicy: false
        },
        initialize: function(e4, t4) {
          this._url = e4, t4 = p2(this, t4), t4.detectRetina && z2.retina && t4.maxZoom > 0 ? (t4.tileSize = Math.floor(t4.tileSize / 2), t4.zoomReverse ? (t4.zoomOffset--, t4.minZoom = Math.min(t4.maxZoom, t4.minZoom + 1)) : (t4.zoomOffset++, t4.maxZoom = Math.max(t4.minZoom, t4.maxZoom - 1)), t4.minZoom = Math.max(0, t4.minZoom)) : t4.zoomReverse ? t4.minZoom = Math.min(t4.maxZoom, t4.minZoom) : t4.maxZoom = Math.max(t4.minZoom, t4.maxZoom), typeof t4.subdomains == `string` && (t4.subdomains = t4.subdomains.split(``)), this.on(`tileunload`, this._onTileRemove);
        },
        setUrl: function(e4, t4) {
          return this._url === e4 && t4 === void 0 && (t4 = true), this._url = e4, t4 || this.redraw(), this;
        },
        createTile: function(e4, t4) {
          var n3 = document.createElement(`img`);
          return G2(n3, `load`, i2(this._tileOnLoad, this, t4, n3)), G2(n3, `error`, i2(this._tileOnError, this, t4, n3)), (this.options.crossOrigin || this.options.crossOrigin === ``) && (n3.crossOrigin = this.options.crossOrigin === true ? `` : this.options.crossOrigin), typeof this.options.referrerPolicy == `string` && (n3.referrerPolicy = this.options.referrerPolicy), n3.alt = ``, n3.src = this.getTileUrl(e4), n3;
        },
        getTileUrl: function(e4) {
          var t4 = {
            r: z2.retina ? `@2x` : ``,
            s: this._getSubdomain(e4),
            x: e4.x,
            y: e4.y,
            z: this._getZoomForUrl()
          };
          if (this._map && !this._map.options.crs.infinite) {
            var r3 = this._globalTileRange.max.y - e4.y;
            this.options.tms && (t4.y = r3), t4[`-y`] = r3;
          }
          return g2(this._url, n2(t4, this.options));
        },
        _tileOnLoad: function(e4, t4) {
          z2.ielt9 ? setTimeout(i2(e4, this, null, t4), 0) : e4(null, t4);
        },
        _tileOnError: function(e4, t4, n3) {
          var r3 = this.options.errorTileUrl;
          r3 && t4.getAttribute(`src`) !== r3 && (t4.src = r3), e4(n3, t4);
        },
        _onTileRemove: function(e4) {
          e4.tile.onload = null;
        },
        _getZoomForUrl: function() {
          var e4 = this._tileZoom, t4 = this.options.maxZoom, n3 = this.options.zoomReverse, r3 = this.options.zoomOffset;
          return n3 && (e4 = t4 - e4), e4 + r3;
        },
        _getSubdomain: function(e4) {
          var t4 = Math.abs(e4.x + e4.y) % this.options.subdomains.length;
          return this.options.subdomains[t4];
        },
        _abortLoading: function() {
          var e4, t4;
          for (e4 in this._tiles) if (this._tiles[e4].coords.z !== this._tileZoom && (t4 = this._tiles[e4].el, t4.onload = l2, t4.onerror = l2, !t4.complete)) {
            t4.src = y2;
            var n3 = this._tiles[e4].coords;
            U2(t4), delete this._tiles[e4], this.fire(`tileabort`, {
              tile: t4,
              coords: n3
            });
          }
        },
        _removeTile: function(e4) {
          var t4 = this._tiles[e4];
          if (t4) return t4.el.setAttribute(`src`, y2), Vr.prototype._removeTile.call(this, e4);
        },
        _tileReady: function(e4, t4, n3) {
          if (!(!this._map || n3 && n3.getAttribute(`src`) === y2)) return Vr.prototype._tileReady.call(this, e4, t4, n3);
        }
      });
      function Wr(e4, t4) {
        return new Ur(e4, t4);
      }
      var Gr = Ur.extend({
        defaultWmsParams: {
          service: `WMS`,
          request: `GetMap`,
          layers: ``,
          styles: ``,
          format: `image/jpeg`,
          transparent: false,
          version: `1.1.1`
        },
        options: {
          crs: null,
          uppercase: false
        },
        initialize: function(e4, t4) {
          this._url = e4;
          var r3 = n2({}, this.defaultWmsParams);
          for (var i3 in t4) i3 in this.options || (r3[i3] = t4[i3]);
          t4 = p2(this, t4);
          var a3 = t4.detectRetina && z2.retina ? 2 : 1, o3 = this.getTileSize();
          r3.width = o3.x * a3, r3.height = o3.y * a3, this.wmsParams = r3;
        },
        onAdd: function(e4) {
          this._crs = this.options.crs || e4.options.crs, this._wmsVersion = parseFloat(this.wmsParams.version);
          var t4 = this._wmsVersion >= 1.3 ? `crs` : `srs`;
          this.wmsParams[t4] = this._crs.code, Ur.prototype.onAdd.call(this, e4);
        },
        getTileUrl: function(e4) {
          var t4 = this._tileCoordsToNwSe(e4), n3 = this._crs, r3 = M2(n3.project(t4[0]), n3.project(t4[1])), i3 = r3.min, a3 = r3.max, o3 = (this._wmsVersion >= 1.3 && this._crs === Jn ? [
            i3.y,
            i3.x,
            a3.y,
            a3.x
          ] : [
            i3.x,
            i3.y,
            a3.x,
            a3.y
          ]).join(`,`), s3 = Ur.prototype.getTileUrl.call(this, e4);
          return s3 + m2(this.wmsParams, s3, this.options.uppercase) + (this.options.uppercase ? `&BBOX=` : `&bbox=`) + o3;
        },
        setParams: function(e4, t4) {
          return n2(this.wmsParams, e4), t4 || this.redraw(), this;
        }
      });
      function Kr(e4, t4) {
        return new Gr(e4, t4);
      }
      Ur.WMS = Gr, Wr.wms = Kr;
      var qr = Xn.extend({
        options: {
          padding: 0.1
        },
        initialize: function(e4) {
          p2(this, e4), o2(this), this._layers = this._layers || {};
        },
        onAdd: function() {
          this._container || (this._initContainer(), W2(this._container, `leaflet-zoom-animated`)), this.getPane().appendChild(this._container), this._update(), this.on(`update`, this._updatePaths, this);
        },
        onRemove: function() {
          this.off(`update`, this._updatePaths, this), this._destroyContainer();
        },
        getEvents: function() {
          var e4 = {
            viewreset: this._reset,
            zoom: this._onZoom,
            moveend: this._update,
            zoomend: this._onZoomEnd
          };
          return this._zoomAnimated && (e4.zoomanim = this._onAnimZoom), e4;
        },
        _onAnimZoom: function(e4) {
          this._updateTransform(e4.center, e4.zoom);
        },
        _onZoom: function() {
          this._updateTransform(this._map.getCenter(), this._map.getZoom());
        },
        _updateTransform: function(e4, t4) {
          var n3 = this._map.getZoomScale(t4, this._zoom), r3 = this._map.getSize().multiplyBy(0.5 + this.options.padding), i3 = this._map.project(this._center, t4), a3 = r3.multiplyBy(-n3).add(i3).subtract(this._map._getNewPixelOrigin(e4, t4));
          z2.any3d ? At2(this._container, a3, n3) : jt2(this._container, a3);
        },
        _reset: function() {
          for (var e4 in this._update(), this._updateTransform(this._center, this._zoom), this._layers) this._layers[e4]._reset();
        },
        _onZoomEnd: function() {
          for (var e4 in this._layers) this._layers[e4]._project();
        },
        _updatePaths: function() {
          for (var e4 in this._layers) this._layers[e4]._update();
        },
        _update: function() {
          var e4 = this.options.padding, t4 = this._map.getSize(), n3 = this._map.containerPointToLayerPoint(t4.multiplyBy(-e4)).round();
          this._bounds = new j2(n3, n3.add(t4.multiplyBy(1 + e4 * 2)).round()), this._center = this._map.getCenter(), this._zoom = this._map.getZoom();
        }
      }), Jr = qr.extend({
        options: {
          tolerance: 0
        },
        getEvents: function() {
          var e4 = qr.prototype.getEvents.call(this);
          return e4.viewprereset = this._onViewPreReset, e4;
        },
        _onViewPreReset: function() {
          this._postponeUpdatePaths = true;
        },
        onAdd: function() {
          qr.prototype.onAdd.call(this), this._draw();
        },
        _initContainer: function() {
          var e4 = this._container = document.createElement(`canvas`);
          G2(e4, `mousemove`, this._onMouseMove, this), G2(e4, `click dblclick mousedown mouseup contextmenu`, this._onClick, this), G2(e4, `mouseout`, this._handleMouseOut, this), e4._leaflet_disable_events = true, this._ctx = e4.getContext(`2d`);
        },
        _destroyContainer: function() {
          T2(this._redrawRequest), delete this._ctx, U2(this._container), K2(this._container), delete this._container;
        },
        _updatePaths: function() {
          if (!this._postponeUpdatePaths) {
            var e4;
            for (var t4 in this._redrawBounds = null, this._layers) e4 = this._layers[t4], e4._update();
            this._redraw();
          }
        },
        _update: function() {
          if (!(this._map._animatingZoom && this._bounds)) {
            qr.prototype._update.call(this);
            var e4 = this._bounds, t4 = this._container, n3 = e4.getSize(), r3 = z2.retina ? 2 : 1;
            jt2(t4, e4.min), t4.width = r3 * n3.x, t4.height = r3 * n3.y, t4.style.width = n3.x + `px`, t4.style.height = n3.y + `px`, z2.retina && this._ctx.scale(2, 2), this._ctx.translate(-e4.min.x, -e4.min.y), this.fire(`update`);
          }
        },
        _reset: function() {
          qr.prototype._reset.call(this), this._postponeUpdatePaths && (this._postponeUpdatePaths = false, this._updatePaths());
        },
        _initPath: function(e4) {
          this._updateDashArray(e4), this._layers[o2(e4)] = e4;
          var t4 = e4._order = {
            layer: e4,
            prev: this._drawLast,
            next: null
          };
          this._drawLast && (this._drawLast.next = t4), this._drawLast = t4, this._drawFirst = this._drawFirst || this._drawLast;
        },
        _addPath: function(e4) {
          this._requestRedraw(e4);
        },
        _removePath: function(e4) {
          var t4 = e4._order, n3 = t4.next, r3 = t4.prev;
          n3 ? n3.prev = r3 : this._drawLast = r3, r3 ? r3.next = n3 : this._drawFirst = n3, delete e4._order, delete this._layers[o2(e4)], this._requestRedraw(e4);
        },
        _updatePath: function(e4) {
          this._extendRedrawBounds(e4), e4._project(), e4._update(), this._requestRedraw(e4);
        },
        _updateStyle: function(e4) {
          this._updateDashArray(e4), this._requestRedraw(e4);
        },
        _updateDashArray: function(e4) {
          if (typeof e4.options.dashArray == `string`) {
            var t4 = e4.options.dashArray.split(/[, ]+/), n3 = [], r3, i3;
            for (i3 = 0; i3 < t4.length; i3++) {
              if (r3 = Number(t4[i3]), isNaN(r3)) return;
              n3.push(r3);
            }
            e4.options._dashArray = n3;
          } else e4.options._dashArray = e4.options.dashArray;
        },
        _requestRedraw: function(e4) {
          this._map && (this._extendRedrawBounds(e4), this._redrawRequest = this._redrawRequest || ee2(this._redraw, this));
        },
        _extendRedrawBounds: function(e4) {
          if (e4._pxBounds) {
            var t4 = (e4.options.weight || 0) + 1;
            this._redrawBounds = this._redrawBounds || new j2(), this._redrawBounds.extend(e4._pxBounds.min.subtract([
              t4,
              t4
            ])), this._redrawBounds.extend(e4._pxBounds.max.add([
              t4,
              t4
            ]));
          }
        },
        _redraw: function() {
          this._redrawRequest = null, this._redrawBounds && (this._redrawBounds.min._floor(), this._redrawBounds.max._ceil()), this._clear(), this._draw(), this._redrawBounds = null;
        },
        _clear: function() {
          var e4 = this._redrawBounds;
          if (e4) {
            var t4 = e4.getSize();
            this._ctx.clearRect(e4.min.x, e4.min.y, t4.x, t4.y);
          } else this._ctx.save(), this._ctx.setTransform(1, 0, 0, 1, 0, 0), this._ctx.clearRect(0, 0, this._container.width, this._container.height), this._ctx.restore();
        },
        _draw: function() {
          var e4, t4 = this._redrawBounds;
          if (this._ctx.save(), t4) {
            var n3 = t4.getSize();
            this._ctx.beginPath(), this._ctx.rect(t4.min.x, t4.min.y, n3.x, n3.y), this._ctx.clip();
          }
          this._drawing = true;
          for (var r3 = this._drawFirst; r3; r3 = r3.next) e4 = r3.layer, (!t4 || e4._pxBounds && e4._pxBounds.intersects(t4)) && e4._updatePath();
          this._drawing = false, this._ctx.restore();
        },
        _updatePoly: function(e4, t4) {
          if (this._drawing) {
            var n3, r3, i3, a3, o3 = e4._parts, s3 = o3.length, c3 = this._ctx;
            if (s3) {
              for (c3.beginPath(), n3 = 0; n3 < s3; n3++) {
                for (r3 = 0, i3 = o3[n3].length; r3 < i3; r3++) a3 = o3[n3][r3], c3[r3 ? `lineTo` : `moveTo`](a3.x, a3.y);
                t4 && c3.closePath();
              }
              this._fillStroke(c3, e4);
            }
          }
        },
        _updateCircle: function(e4) {
          if (!(!this._drawing || e4._empty())) {
            var t4 = e4._point, n3 = this._ctx, r3 = Math.max(Math.round(e4._radius), 1), i3 = (Math.max(Math.round(e4._radiusY), 1) || r3) / r3;
            i3 !== 1 && (n3.save(), n3.scale(1, i3)), n3.beginPath(), n3.arc(t4.x, t4.y / i3, r3, 0, Math.PI * 2, false), i3 !== 1 && n3.restore(), this._fillStroke(n3, e4);
          }
        },
        _fillStroke: function(e4, t4) {
          var n3 = t4.options;
          n3.fill && (e4.globalAlpha = n3.fillOpacity, e4.fillStyle = n3.fillColor || n3.color, e4.fill(n3.fillRule || `evenodd`)), n3.stroke && n3.weight !== 0 && (e4.setLineDash && e4.setLineDash(t4.options && t4.options._dashArray || []), e4.globalAlpha = n3.opacity, e4.lineWidth = n3.weight, e4.strokeStyle = n3.color, e4.lineCap = n3.lineCap, e4.lineJoin = n3.lineJoin, e4.stroke());
        },
        _onClick: function(e4) {
          for (var t4 = this._map.mouseEventToLayerPoint(e4), n3, r3, i3 = this._drawFirst; i3; i3 = i3.next) n3 = i3.layer, n3.options.interactive && n3._containsPoint(t4) && (!(e4.type === `click` || e4.type === `preclick`) || !this._map._draggableMoved(n3)) && (r3 = n3);
          this._fireEvent(r3 ? [
            r3
          ] : false, e4);
        },
        _onMouseMove: function(e4) {
          if (!(!this._map || this._map.dragging.moving() || this._map._animatingZoom)) {
            var t4 = this._map.mouseEventToLayerPoint(e4);
            this._handleMouseHover(e4, t4);
          }
        },
        _handleMouseOut: function(e4) {
          var t4 = this._hoveredLayer;
          t4 && (wt2(this._container, `leaflet-interactive`), this._fireEvent([
            t4
          ], e4, `mouseout`), this._hoveredLayer = null, this._mouseHoverThrottled = false);
        },
        _handleMouseHover: function(e4, t4) {
          if (!this._mouseHoverThrottled) {
            for (var n3, r3, a3 = this._drawFirst; a3; a3 = a3.next) n3 = a3.layer, n3.options.interactive && n3._containsPoint(t4) && (r3 = n3);
            r3 !== this._hoveredLayer && (this._handleMouseOut(e4), r3 && (W2(this._container, `leaflet-interactive`), this._fireEvent([
              r3
            ], e4, `mouseover`), this._hoveredLayer = r3)), this._fireEvent(this._hoveredLayer ? [
              this._hoveredLayer
            ] : false, e4), this._mouseHoverThrottled = true, setTimeout(i2(function() {
              this._mouseHoverThrottled = false;
            }, this), 32);
          }
        },
        _fireEvent: function(e4, t4, n3) {
          this._map._fireDOMEvent(t4, n3 || t4.type, e4);
        },
        _bringToFront: function(e4) {
          var t4 = e4._order;
          if (t4) {
            var n3 = t4.next, r3 = t4.prev;
            if (n3) n3.prev = r3;
            else return;
            r3 ? r3.next = n3 : n3 && (this._drawFirst = n3), t4.prev = this._drawLast, this._drawLast.next = t4, t4.next = null, this._drawLast = t4, this._requestRedraw(e4);
          }
        },
        _bringToBack: function(e4) {
          var t4 = e4._order;
          if (t4) {
            var n3 = t4.next, r3 = t4.prev;
            if (r3) r3.next = n3;
            else return;
            n3 ? n3.prev = r3 : r3 && (this._drawLast = r3), t4.prev = null, t4.next = this._drawFirst, this._drawFirst.prev = t4, this._drawFirst = t4, this._requestRedraw(e4);
          }
        }
      });
      function Yr(e4) {
        return z2.canvas ? new Jr(e4) : null;
      }
      var Xr = (function() {
        try {
          return document.namespaces.add(`lvml`, `urn:schemas-microsoft-com:vml`), function(e4) {
            return document.createElement(`<lvml:` + e4 + ` class="lvml">`);
          };
        } catch {
        }
        return function(e4) {
          return document.createElement(`<` + e4 + ` xmlns="urn:schemas-microsoft.com:vml" class="lvml">`);
        };
      })(), Zr = {
        _initContainer: function() {
          this._container = H2(`div`, `leaflet-vml-container`);
        },
        _update: function() {
          this._map._animatingZoom || (qr.prototype._update.call(this), this.fire(`update`));
        },
        _initPath: function(e4) {
          var t4 = e4._container = Xr(`shape`);
          W2(t4, `leaflet-vml-shape ` + (this.options.className || ``)), t4.coordsize = `1 1`, e4._path = Xr(`path`), t4.appendChild(e4._path), this._updateStyle(e4), this._layers[o2(e4)] = e4;
        },
        _addPath: function(e4) {
          var t4 = e4._container;
          this._container.appendChild(t4), e4.options.interactive && e4.addInteractiveTarget(t4);
        },
        _removePath: function(e4) {
          var t4 = e4._container;
          U2(t4), e4.removeInteractiveTarget(t4), delete this._layers[o2(e4)];
        },
        _updateStyle: function(e4) {
          var t4 = e4._stroke, n3 = e4._fill, r3 = e4.options, i3 = e4._container;
          i3.stroked = !!r3.stroke, i3.filled = !!r3.fill, r3.stroke ? (t4 ||= e4._stroke = Xr(`stroke`), i3.appendChild(t4), t4.weight = r3.weight + `px`, t4.color = r3.color, t4.opacity = r3.opacity, r3.dashArray ? t4.dashStyle = _2(r3.dashArray) ? r3.dashArray.join(` `) : r3.dashArray.replace(/( *, *)/g, ` `) : t4.dashStyle = ``, t4.endcap = r3.lineCap.replace(`butt`, `flat`), t4.joinstyle = r3.lineJoin) : t4 && (i3.removeChild(t4), e4._stroke = null), r3.fill ? (n3 ||= e4._fill = Xr(`fill`), i3.appendChild(n3), n3.color = r3.fillColor || r3.color, n3.opacity = r3.fillOpacity) : n3 && (i3.removeChild(n3), e4._fill = null);
        },
        _updateCircle: function(e4) {
          var t4 = e4._point.round(), n3 = Math.round(e4._radius), r3 = Math.round(e4._radiusY || n3);
          this._setPath(e4, e4._empty() ? `M0 0` : `AL ` + t4.x + `,` + t4.y + ` ` + n3 + `,` + r3 + ` 0,23592600`);
        },
        _setPath: function(e4, t4) {
          e4._path.v = t4;
        },
        _bringToFront: function(e4) {
          xt2(e4._container);
        },
        _bringToBack: function(e4) {
          St2(e4._container);
        }
      }, Qr = z2.vml ? Xr : pe2, $r = qr.extend({
        _initContainer: function() {
          this._container = Qr(`svg`), this._container.setAttribute(`pointer-events`, `none`), this._rootGroup = Qr(`g`), this._container.appendChild(this._rootGroup);
        },
        _destroyContainer: function() {
          U2(this._container), K2(this._container), delete this._container, delete this._rootGroup, delete this._svgSize;
        },
        _update: function() {
          if (!(this._map._animatingZoom && this._bounds)) {
            qr.prototype._update.call(this);
            var e4 = this._bounds, t4 = e4.getSize(), n3 = this._container;
            (!this._svgSize || !this._svgSize.equals(t4)) && (this._svgSize = t4, n3.setAttribute(`width`, t4.x), n3.setAttribute(`height`, t4.y)), jt2(n3, e4.min), n3.setAttribute(`viewBox`, [
              e4.min.x,
              e4.min.y,
              t4.x,
              t4.y
            ].join(` `)), this.fire(`update`);
          }
        },
        _initPath: function(e4) {
          var t4 = e4._path = Qr(`path`);
          e4.options.className && W2(t4, e4.options.className), e4.options.interactive && W2(t4, `leaflet-interactive`), this._updateStyle(e4), this._layers[o2(e4)] = e4;
        },
        _addPath: function(e4) {
          this._rootGroup || this._initContainer(), this._rootGroup.appendChild(e4._path), e4.addInteractiveTarget(e4._path);
        },
        _removePath: function(e4) {
          U2(e4._path), e4.removeInteractiveTarget(e4._path), delete this._layers[o2(e4)];
        },
        _updatePath: function(e4) {
          e4._project(), e4._update();
        },
        _updateStyle: function(e4) {
          var t4 = e4._path, n3 = e4.options;
          t4 && (n3.stroke ? (t4.setAttribute(`stroke`, n3.color), t4.setAttribute(`stroke-opacity`, n3.opacity), t4.setAttribute(`stroke-width`, n3.weight), t4.setAttribute(`stroke-linecap`, n3.lineCap), t4.setAttribute(`stroke-linejoin`, n3.lineJoin), n3.dashArray ? t4.setAttribute(`stroke-dasharray`, n3.dashArray) : t4.removeAttribute(`stroke-dasharray`), n3.dashOffset ? t4.setAttribute(`stroke-dashoffset`, n3.dashOffset) : t4.removeAttribute(`stroke-dashoffset`)) : t4.setAttribute(`stroke`, `none`), n3.fill ? (t4.setAttribute(`fill`, n3.fillColor || n3.color), t4.setAttribute(`fill-opacity`, n3.fillOpacity), t4.setAttribute(`fill-rule`, n3.fillRule || `evenodd`)) : t4.setAttribute(`fill`, `none`));
        },
        _updatePoly: function(e4, t4) {
          this._setPath(e4, me2(e4._parts, t4));
        },
        _updateCircle: function(e4) {
          var t4 = e4._point, n3 = Math.max(Math.round(e4._radius), 1), r3 = Math.max(Math.round(e4._radiusY), 1) || n3, i3 = `a` + n3 + `,` + r3 + ` 0 1,0 `, a3 = e4._empty() ? `M0 0` : `M` + (t4.x - n3) + `,` + t4.y + i3 + n3 * 2 + `,0 ` + i3 + -n3 * 2 + `,0 `;
          this._setPath(e4, a3);
        },
        _setPath: function(e4, t4) {
          e4._path.setAttribute(`d`, t4);
        },
        _bringToFront: function(e4) {
          xt2(e4._path);
        },
        _bringToBack: function(e4) {
          St2(e4._path);
        }
      });
      z2.vml && $r.include(Zr);
      function ei(e4) {
        return z2.svg || z2.vml ? new $r(e4) : null;
      }
      q2.include({
        getRenderer: function(e4) {
          var t4 = e4.options.renderer || this._getPaneRenderer(e4.options.pane) || this.options.renderer || this._renderer;
          return t4 ||= this._renderer = this._createRenderer(), this.hasLayer(t4) || this.addLayer(t4), t4;
        },
        _getPaneRenderer: function(e4) {
          if (e4 === `overlayPane` || e4 === void 0) return false;
          var t4 = this._paneRenderers[e4];
          return t4 === void 0 && (t4 = this._createRenderer({
            pane: e4
          }), this._paneRenderers[e4] = t4), t4;
        },
        _createRenderer: function(e4) {
          return this.options.preferCanvas && Yr(e4) || ei(e4);
        }
      });
      var ti = mr.extend({
        initialize: function(e4, t4) {
          mr.prototype.initialize.call(this, this._boundsToLatLngs(e4), t4);
        },
        setBounds: function(e4) {
          return this.setLatLngs(this._boundsToLatLngs(e4));
        },
        _boundsToLatLngs: function(e4) {
          return e4 = ie2(e4), [
            e4.getSouthWest(),
            e4.getNorthWest(),
            e4.getNorthEast(),
            e4.getSouthEast()
          ];
        }
      });
      function ni(e4, t4) {
        return new ti(e4, t4);
      }
      $r.create = Qr, $r.pointsToPath = me2, gr.geometryToLayer = _r, gr.coordsToLatLng = yr, gr.coordsToLatLngs = br, gr.latLngToCoords = xr, gr.latLngsToCoords = Sr, gr.getFeature = Cr, gr.asFeature = wr, q2.mergeOptions({
        boxZoom: true
      });
      var ri = bn2.extend({
        initialize: function(e4) {
          this._map = e4, this._container = e4._container, this._pane = e4._panes.overlayPane, this._resetStateTimeout = 0, e4.on(`unload`, this._destroy, this);
        },
        addHooks: function() {
          G2(this._container, `mousedown`, this._onMouseDown, this);
        },
        removeHooks: function() {
          K2(this._container, `mousedown`, this._onMouseDown, this);
        },
        moved: function() {
          return this._moved;
        },
        _destroy: function() {
          U2(this._pane), delete this._pane;
        },
        _resetState: function() {
          this._resetStateTimeout = 0, this._moved = false;
        },
        _clearDeferredResetState: function() {
          this._resetStateTimeout !== 0 && (clearTimeout(this._resetStateTimeout), this._resetStateTimeout = 0);
        },
        _onMouseDown: function(e4) {
          if (!e4.shiftKey || e4.which !== 1 && e4.button !== 1) return false;
          this._clearDeferredResetState(), this._resetState(), Nt2(), Lt2(), this._startPoint = this._map.mouseEventToContainerPoint(e4), G2(document, {
            contextmenu: tn2,
            mousemove: this._onMouseMove,
            mouseup: this._onMouseUp,
            keydown: this._onKeyDown
          }, this);
        },
        _onMouseMove: function(e4) {
          this._moved || (this._moved = true, this._box = H2(`div`, `leaflet-zoom-box`, this._container), W2(this._container, `leaflet-crosshair`), this._map.fire(`boxzoomstart`)), this._point = this._map.mouseEventToContainerPoint(e4);
          var t4 = new j2(this._point, this._startPoint), n3 = t4.getSize();
          jt2(this._box, t4.min), this._box.style.width = n3.x + `px`, this._box.style.height = n3.y + `px`;
        },
        _finish: function() {
          this._moved && (U2(this._box), wt2(this._container, `leaflet-crosshair`)), Pt2(), Rt2(), K2(document, {
            contextmenu: tn2,
            mousemove: this._onMouseMove,
            mouseup: this._onMouseUp,
            keydown: this._onKeyDown
          }, this);
        },
        _onMouseUp: function(e4) {
          if (!(e4.which !== 1 && e4.button !== 1) && (this._finish(), this._moved)) {
            this._clearDeferredResetState(), this._resetStateTimeout = setTimeout(i2(this._resetState, this), 0);
            var t4 = new N2(this._map.containerPointToLatLng(this._startPoint), this._map.containerPointToLatLng(this._point));
            this._map.fitBounds(t4).fire(`boxzoomend`, {
              boxZoomBounds: t4
            });
          }
        },
        _onKeyDown: function(e4) {
          e4.keyCode === 27 && (this._finish(), this._clearDeferredResetState(), this._resetState());
        }
      });
      q2.addInitHook(`addHandler`, `boxZoom`, ri), q2.mergeOptions({
        doubleClickZoom: true
      });
      var ii = bn2.extend({
        addHooks: function() {
          this._map.on(`dblclick`, this._onDoubleClick, this);
        },
        removeHooks: function() {
          this._map.off(`dblclick`, this._onDoubleClick, this);
        },
        _onDoubleClick: function(e4) {
          var t4 = this._map, n3 = t4.getZoom(), r3 = t4.options.zoomDelta, i3 = e4.originalEvent.shiftKey ? n3 - r3 : n3 + r3;
          t4.options.doubleClickZoom === `center` ? t4.setZoom(i3) : t4.setZoomAround(e4.containerPoint, i3);
        }
      });
      q2.addInitHook(`addHandler`, `doubleClickZoom`, ii), q2.mergeOptions({
        dragging: true,
        inertia: true,
        inertiaDeceleration: 3400,
        inertiaMaxSpeed: 1 / 0,
        easeLinearity: 0.2,
        worldCopyJump: false,
        maxBoundsViscosity: 0
      });
      var ai = bn2.extend({
        addHooks: function() {
          if (!this._draggable) {
            var e4 = this._map;
            this._draggable = new Cn2(e4._mapPane, e4._container), this._draggable.on({
              dragstart: this._onDragStart,
              drag: this._onDrag,
              dragend: this._onDragEnd
            }, this), this._draggable.on(`predrag`, this._onPreDragLimit, this), e4.options.worldCopyJump && (this._draggable.on(`predrag`, this._onPreDragWrap, this), e4.on(`zoomend`, this._onZoomEnd, this), e4.whenReady(this._onZoomEnd, this));
          }
          W2(this._map._container, `leaflet-grab leaflet-touch-drag`), this._draggable.enable(), this._positions = [], this._times = [];
        },
        removeHooks: function() {
          wt2(this._map._container, `leaflet-grab`), wt2(this._map._container, `leaflet-touch-drag`), this._draggable.disable();
        },
        moved: function() {
          return this._draggable && this._draggable._moved;
        },
        moving: function() {
          return this._draggable && this._draggable._moving;
        },
        _onDragStart: function() {
          var e4 = this._map;
          if (e4._stop(), this._map.options.maxBounds && this._map.options.maxBoundsViscosity) {
            var t4 = ie2(this._map.options.maxBounds);
            this._offsetLimit = M2(this._map.latLngToContainerPoint(t4.getNorthWest()).multiplyBy(-1), this._map.latLngToContainerPoint(t4.getSouthEast()).multiplyBy(-1).add(this._map.getSize())), this._viscosity = Math.min(1, Math.max(0, this._map.options.maxBoundsViscosity));
          } else this._offsetLimit = null;
          e4.fire(`movestart`).fire(`dragstart`), e4.options.inertia && (this._positions = [], this._times = []);
        },
        _onDrag: function(e4) {
          if (this._map.options.inertia) {
            var t4 = this._lastTime = +/* @__PURE__ */ new Date(), n3 = this._lastPos = this._draggable._absPos || this._draggable._newPos;
            this._positions.push(n3), this._times.push(t4), this._prunePositions(t4);
          }
          this._map.fire(`move`, e4).fire(`drag`, e4);
        },
        _prunePositions: function(e4) {
          for (; this._positions.length > 1 && e4 - this._times[0] > 50; ) this._positions.shift(), this._times.shift();
        },
        _onZoomEnd: function() {
          var e4 = this._map.getSize().divideBy(2), t4 = this._map.latLngToLayerPoint([
            0,
            0
          ]);
          this._initialWorldOffset = t4.subtract(e4).x, this._worldWidth = this._map.getPixelWorldBounds().getSize().x;
        },
        _viscousLimit: function(e4, t4) {
          return e4 - (e4 - t4) * this._viscosity;
        },
        _onPreDragLimit: function() {
          if (!(!this._viscosity || !this._offsetLimit)) {
            var e4 = this._draggable._newPos.subtract(this._draggable._startPos), t4 = this._offsetLimit;
            e4.x < t4.min.x && (e4.x = this._viscousLimit(e4.x, t4.min.x)), e4.y < t4.min.y && (e4.y = this._viscousLimit(e4.y, t4.min.y)), e4.x > t4.max.x && (e4.x = this._viscousLimit(e4.x, t4.max.x)), e4.y > t4.max.y && (e4.y = this._viscousLimit(e4.y, t4.max.y)), this._draggable._newPos = this._draggable._startPos.add(e4);
          }
        },
        _onPreDragWrap: function() {
          var e4 = this._worldWidth, t4 = Math.round(e4 / 2), n3 = this._initialWorldOffset, r3 = this._draggable._newPos.x, i3 = (r3 - t4 + n3) % e4 + t4 - n3, a3 = (r3 + t4 + n3) % e4 - t4 - n3, o3 = Math.abs(i3 + n3) < Math.abs(a3 + n3) ? i3 : a3;
          this._draggable._absPos = this._draggable._newPos.clone(), this._draggable._newPos.x = o3;
        },
        _onDragEnd: function(e4) {
          var t4 = this._map, n3 = t4.options, r3 = !n3.inertia || e4.noInertia || this._times.length < 2;
          if (t4.fire(`dragend`, e4), r3) t4.fire(`moveend`);
          else {
            this._prunePositions(+/* @__PURE__ */ new Date());
            var i3 = this._lastPos.subtract(this._positions[0]), a3 = (this._lastTime - this._times[0]) / 1e3, o3 = n3.easeLinearity, s3 = i3.multiplyBy(o3 / a3), c3 = s3.distanceTo([
              0,
              0
            ]), l3 = Math.min(n3.inertiaMaxSpeed, c3), u3 = s3.multiplyBy(l3 / c3), d3 = l3 / (n3.inertiaDeceleration * o3), f3 = u3.multiplyBy(-d3 / 2).round();
            !f3.x && !f3.y ? t4.fire(`moveend`) : (f3 = t4._limitOffset(f3, t4.options.maxBounds), ee2(function() {
              t4.panBy(f3, {
                duration: d3,
                easeLinearity: o3,
                noMoveStart: true,
                animate: true
              });
            }));
          }
        }
      });
      q2.addInitHook(`addHandler`, `dragging`, ai), q2.mergeOptions({
        keyboard: true,
        keyboardPanDelta: 80
      });
      var oi = bn2.extend({
        keyCodes: {
          left: [
            37
          ],
          right: [
            39
          ],
          down: [
            40
          ],
          up: [
            38
          ],
          zoomIn: [
            187,
            107,
            61,
            171
          ],
          zoomOut: [
            189,
            109,
            54,
            173
          ]
        },
        initialize: function(e4) {
          this._map = e4, this._setPanDelta(e4.options.keyboardPanDelta), this._setZoomDelta(e4.options.zoomDelta);
        },
        addHooks: function() {
          var e4 = this._map._container;
          e4.tabIndex <= 0 && (e4.tabIndex = `0`), G2(e4, {
            focus: this._onFocus,
            blur: this._onBlur,
            mousedown: this._onMouseDown
          }, this), this._map.on({
            focus: this._addHooks,
            blur: this._removeHooks
          }, this);
        },
        removeHooks: function() {
          this._removeHooks(), K2(this._map._container, {
            focus: this._onFocus,
            blur: this._onBlur,
            mousedown: this._onMouseDown
          }, this), this._map.off({
            focus: this._addHooks,
            blur: this._removeHooks
          }, this);
        },
        _onMouseDown: function() {
          if (!this._focused) {
            var e4 = document.body, t4 = document.documentElement, n3 = e4.scrollTop || t4.scrollTop, r3 = e4.scrollLeft || t4.scrollLeft;
            this._map._container.focus(), window.scrollTo(r3, n3);
          }
        },
        _onFocus: function() {
          this._focused = true, this._map.fire(`focus`);
        },
        _onBlur: function() {
          this._focused = false, this._map.fire(`blur`);
        },
        _setPanDelta: function(e4) {
          var t4 = this._panKeys = {}, n3 = this.keyCodes, r3, i3;
          for (r3 = 0, i3 = n3.left.length; r3 < i3; r3++) t4[n3.left[r3]] = [
            -1 * e4,
            0
          ];
          for (r3 = 0, i3 = n3.right.length; r3 < i3; r3++) t4[n3.right[r3]] = [
            e4,
            0
          ];
          for (r3 = 0, i3 = n3.down.length; r3 < i3; r3++) t4[n3.down[r3]] = [
            0,
            e4
          ];
          for (r3 = 0, i3 = n3.up.length; r3 < i3; r3++) t4[n3.up[r3]] = [
            0,
            -1 * e4
          ];
        },
        _setZoomDelta: function(e4) {
          var t4 = this._zoomKeys = {}, n3 = this.keyCodes, r3, i3;
          for (r3 = 0, i3 = n3.zoomIn.length; r3 < i3; r3++) t4[n3.zoomIn[r3]] = e4;
          for (r3 = 0, i3 = n3.zoomOut.length; r3 < i3; r3++) t4[n3.zoomOut[r3]] = -e4;
        },
        _addHooks: function() {
          G2(document, `keydown`, this._onKeyDown, this);
        },
        _removeHooks: function() {
          K2(document, `keydown`, this._onKeyDown, this);
        },
        _onKeyDown: function(e4) {
          if (!(e4.altKey || e4.ctrlKey || e4.metaKey)) {
            var t4 = e4.keyCode, n3 = this._map, r3;
            if (t4 in this._panKeys) {
              if (!n3._panAnim || !n3._panAnim._inProgress) if (r3 = this._panKeys[t4], e4.shiftKey && (r3 = A2(r3).multiplyBy(3)), n3.options.maxBounds && (r3 = n3._limitOffset(A2(r3), n3.options.maxBounds)), n3.options.worldCopyJump) {
                var i3 = n3.wrapLatLng(n3.unproject(n3.project(n3.getCenter()).add(r3)));
                n3.panTo(i3);
              } else n3.panBy(r3);
            } else if (t4 in this._zoomKeys) n3.setZoom(n3.getZoom() + (e4.shiftKey ? 3 : 1) * this._zoomKeys[t4]);
            else if (t4 === 27 && n3._popup && n3._popup.options.closeOnEscapeKey) n3.closePopup();
            else return;
            tn2(e4);
          }
        }
      });
      q2.addInitHook(`addHandler`, `keyboard`, oi), q2.mergeOptions({
        scrollWheelZoom: true,
        wheelDebounceTime: 40,
        wheelPxPerZoomLevel: 60
      });
      var si = bn2.extend({
        addHooks: function() {
          G2(this._map._container, `wheel`, this._onWheelScroll, this), this._delta = 0;
        },
        removeHooks: function() {
          K2(this._map._container, `wheel`, this._onWheelScroll, this);
        },
        _onWheelScroll: function(e4) {
          var t4 = on2(e4), n3 = this._map.options.wheelDebounceTime;
          this._delta += t4, this._lastMousePos = this._map.mouseEventToContainerPoint(e4), this._startTime ||= +/* @__PURE__ */ new Date();
          var r3 = Math.max(n3 - (+/* @__PURE__ */ new Date() - this._startTime), 0);
          clearTimeout(this._timer), this._timer = setTimeout(i2(this._performZoom, this), r3), tn2(e4);
        },
        _performZoom: function() {
          var e4 = this._map, t4 = e4.getZoom(), n3 = this._map.options.zoomSnap || 0;
          e4._stop();
          var r3 = this._delta / (this._map.options.wheelPxPerZoomLevel * 4), i3 = 4 * Math.log(2 / (1 + Math.exp(-Math.abs(r3)))) / Math.LN2, a3 = n3 ? Math.ceil(i3 / n3) * n3 : i3, o3 = e4._limitZoom(t4 + (this._delta > 0 ? a3 : -a3)) - t4;
          this._delta = 0, this._startTime = null, o3 && (e4.options.scrollWheelZoom === `center` ? e4.setZoom(t4 + o3) : e4.setZoomAround(this._lastMousePos, t4 + o3));
        }
      });
      q2.addInitHook(`addHandler`, `scrollWheelZoom`, si);
      var ci = 600;
      q2.mergeOptions({
        tapHold: z2.touchNative && z2.safari && z2.mobile,
        tapTolerance: 15
      });
      var li = bn2.extend({
        addHooks: function() {
          G2(this._map._container, `touchstart`, this._onDown, this);
        },
        removeHooks: function() {
          K2(this._map._container, `touchstart`, this._onDown, this);
        },
        _onDown: function(e4) {
          if (clearTimeout(this._holdTimeout), e4.touches.length === 1) {
            var t4 = e4.touches[0];
            this._startPos = this._newPos = new O2(t4.clientX, t4.clientY), this._holdTimeout = setTimeout(i2(function() {
              this._cancel(), this._isTapValid() && (G2(document, `touchend`, en2), G2(document, `touchend touchcancel`, this._cancelClickPrevent), this._simulateEvent(`contextmenu`, t4));
            }, this), ci), G2(document, `touchend touchcancel contextmenu`, this._cancel, this), G2(document, `touchmove`, this._onMove, this);
          }
        },
        _cancelClickPrevent: function e4() {
          K2(document, `touchend`, en2), K2(document, `touchend touchcancel`, e4);
        },
        _cancel: function() {
          clearTimeout(this._holdTimeout), K2(document, `touchend touchcancel contextmenu`, this._cancel, this), K2(document, `touchmove`, this._onMove, this);
        },
        _onMove: function(e4) {
          var t4 = e4.touches[0];
          this._newPos = new O2(t4.clientX, t4.clientY);
        },
        _isTapValid: function() {
          return this._newPos.distanceTo(this._startPos) <= this._map.options.tapTolerance;
        },
        _simulateEvent: function(e4, t4) {
          var n3 = new MouseEvent(e4, {
            bubbles: true,
            cancelable: true,
            view: window,
            screenX: t4.screenX,
            screenY: t4.screenY,
            clientX: t4.clientX,
            clientY: t4.clientY
          });
          n3._simulated = true, t4.target.dispatchEvent(n3);
        }
      });
      q2.addInitHook(`addHandler`, `tapHold`, li), q2.mergeOptions({
        touchZoom: z2.touch,
        bounceAtZoomLimits: true
      });
      var ui = bn2.extend({
        addHooks: function() {
          W2(this._map._container, `leaflet-touch-zoom`), G2(this._map._container, `touchstart`, this._onTouchStart, this);
        },
        removeHooks: function() {
          wt2(this._map._container, `leaflet-touch-zoom`), K2(this._map._container, `touchstart`, this._onTouchStart, this);
        },
        _onTouchStart: function(e4) {
          var t4 = this._map;
          if (!(!e4.touches || e4.touches.length !== 2 || t4._animatingZoom || this._zooming)) {
            var n3 = t4.mouseEventToContainerPoint(e4.touches[0]), r3 = t4.mouseEventToContainerPoint(e4.touches[1]);
            this._centerPoint = t4.getSize()._divideBy(2), this._startLatLng = t4.containerPointToLatLng(this._centerPoint), t4.options.touchZoom !== `center` && (this._pinchStartLatLng = t4.containerPointToLatLng(n3.add(r3)._divideBy(2))), this._startDist = n3.distanceTo(r3), this._startZoom = t4.getZoom(), this._moved = false, this._zooming = true, t4._stop(), G2(document, `touchmove`, this._onTouchMove, this), G2(document, `touchend touchcancel`, this._onTouchEnd, this), en2(e4);
          }
        },
        _onTouchMove: function(e4) {
          if (!(!e4.touches || e4.touches.length !== 2 || !this._zooming)) {
            var t4 = this._map, n3 = t4.mouseEventToContainerPoint(e4.touches[0]), r3 = t4.mouseEventToContainerPoint(e4.touches[1]), a3 = n3.distanceTo(r3) / this._startDist;
            if (this._zoom = t4.getScaleZoom(a3, this._startZoom), !t4.options.bounceAtZoomLimits && (this._zoom < t4.getMinZoom() && a3 < 1 || this._zoom > t4.getMaxZoom() && a3 > 1) && (this._zoom = t4._limitZoom(this._zoom)), t4.options.touchZoom === `center`) {
              if (this._center = this._startLatLng, a3 === 1) return;
            } else {
              var o3 = n3._add(r3)._divideBy(2)._subtract(this._centerPoint);
              if (a3 === 1 && o3.x === 0 && o3.y === 0) return;
              this._center = t4.unproject(t4.project(this._pinchStartLatLng, this._zoom).subtract(o3), this._zoom);
            }
            this._moved ||= (t4._moveStart(true, false), true), T2(this._animRequest);
            var s3 = i2(t4._move, t4, this._center, this._zoom, {
              pinch: true,
              round: false
            }, void 0);
            this._animRequest = ee2(s3, this, true), en2(e4);
          }
        },
        _onTouchEnd: function() {
          if (!this._moved || !this._zooming) {
            this._zooming = false;
            return;
          }
          this._zooming = false, T2(this._animRequest), K2(document, `touchmove`, this._onTouchMove, this), K2(document, `touchend touchcancel`, this._onTouchEnd, this), this._map.options.zoomAnimation ? this._map._animateZoom(this._center, this._map._limitZoom(this._zoom), true, this._map.options.zoomSnap) : this._map._resetView(this._center, this._map._limitZoom(this._zoom));
        }
      });
      q2.addInitHook(`addHandler`, `touchZoom`, ui), q2.BoxZoom = ri, q2.DoubleClickZoom = ii, q2.Drag = ai, q2.Keyboard = oi, q2.ScrollWheelZoom = si, q2.TapHold = li, q2.TouchZoom = ui, e3.Bounds = j2, e3.Browser = z2, e3.CRS = ae2, e3.Canvas = Jr, e3.Circle = ur, e3.CircleMarker = cr, e3.Class = ne2, e3.Control = dn2, e3.DivIcon = zr, e3.DivOverlay = Pr, e3.DomEvent = cn2, e3.DomUtil = Gt2, e3.Draggable = Cn2, e3.Evented = D2, e3.FeatureGroup = $n, e3.GeoJSON = gr, e3.GridLayer = Vr, e3.Handler = bn2, e3.Icon = tr, e3.ImageOverlay = Or, e3.LatLng = P2, e3.LatLngBounds = N2, e3.Layer = Xn, e3.LayerGroup = Zn, e3.LineUtil = Un, e3.Map = q2, e3.Marker = ar, e3.Mixin = xn2, e3.Path = sr, e3.Point = O2, e3.PolyUtil = Dn2, e3.Polygon = mr, e3.Polyline = fr, e3.Popup = Fr, e3.PosAnimation = ln2, e3.Projection = Kn, e3.Rectangle = ti, e3.Renderer = qr, e3.SVG = $r, e3.SVGOverlay = Mr, e3.TileLayer = Ur, e3.Tooltip = Lr, e3.Transformation = le2, e3.Util = te2, e3.VideoOverlay = Ar, e3.bind = i2, e3.bounds = M2, e3.canvas = Yr, e3.circle = dr, e3.circleMarker = lr, e3.control = fn2, e3.divIcon = Br, e3.extend = n2, e3.featureGroup = er, e3.geoJSON = Er, e3.geoJson = Dr, e3.gridLayer = Hr, e3.icon = nr, e3.imageOverlay = kr, e3.latLng = F2, e3.latLngBounds = ie2, e3.layerGroup = Qn, e3.map = un2, e3.marker = or, e3.point = A2, e3.polygon = hr, e3.polyline = pr, e3.popup = Ir, e3.rectangle = ni, e3.setOptions = p2, e3.stamp = o2, e3.svg = ei, e3.svgOverlay = Nr, e3.tileLayer = Wr, e3.tooltip = Rr, e3.transformation = ue2, e3.version = t3, e3.videoOverlay = jr;
      var di = window.L;
      e3.noConflict = function() {
        return window.L = di, this;
      }, window.L = e3;
    }));
  }));
  function gn(e2, t2, n2) {
    return Object.freeze({
      instance: e2,
      context: t2,
      container: n2
    });
  }
  function _n(e2, t2) {
    return t2 == null ? function(t3, n2) {
      let r2 = (0, _.useRef)(void 0);
      return r2.current ||= e2(t3, n2), r2;
    } : function(n2, r2) {
      let i2 = (0, _.useRef)(void 0);
      i2.current ||= e2(n2, r2);
      let a2 = (0, _.useRef)(n2), { instance: o2 } = i2.current;
      return (0, _.useEffect)(function() {
        a2.current !== n2 && (t2(o2, n2, a2.current), a2.current = n2);
      }, [
        o2,
        n2,
        t2
      ]), i2;
    };
  }
  function vn(e2, t2) {
    (0, _.useEffect)(function() {
      return (t2.layerContainer ?? t2.map).addLayer(e2.instance), function() {
        t2.layerContainer?.removeLayer(e2.instance), t2.map.removeLayer(e2.instance);
      };
    }, [
      t2,
      e2
    ]);
  }
  function yn(e2) {
    return function(t2) {
      let n2 = cn(), r2 = e2(pn(t2, n2), n2);
      return rn(n2.map, t2.attribution), fn(r2.current, t2.eventHandlers), vn(r2.current, n2), r2;
    };
  }
  function bn(e2, t2) {
    let n2 = (0, _.useRef)(void 0);
    (0, _.useEffect)(function() {
      if (t2.pathOptions !== n2.current) {
        let r2 = t2.pathOptions ?? {};
        e2.instance.setStyle(r2), n2.current = r2;
      }
    }, [
      e2,
      t2
    ]);
  }
  function xn(e2) {
    return function(t2) {
      let n2 = cn(), r2 = e2(pn(t2, n2), n2);
      return fn(r2.current, t2.eventHandlers), vn(r2.current, n2), bn(r2.current, t2), r2;
    };
  }
  function Sn(e2, t2) {
    return q(yn(_n(e2, t2)));
  }
  function Cn(e2, t2) {
    return un(mn(_n(e2), t2));
  }
  function wn(e2, t2) {
    return q(xn(_n(e2, t2)));
  }
  function Tn(e2, t2) {
    return dn(yn(_n(e2, t2)));
  }
  function En(e2, t2, n2) {
    let { opacity: r2, zIndex: i2 } = t2;
    r2 != null && r2 !== n2.opacity && e2.setOpacity(r2), i2 != null && i2 !== n2.zIndex && e2.setZIndex(i2);
  }
  function Dn() {
    return cn().map;
  }
  var On = c(hn(), 1);
  function kn({ bounds: e2, boundsOptions: t2, center: n2, children: r2, className: i2, id: a2, placeholder: o2, style: s2, whenReady: c2, zoom: l2, ...u2 }, d2) {
    let [f2] = (0, _.useState)({
      className: i2,
      id: a2,
      style: s2
    }), [p2, m2] = (0, _.useState)(null), h2 = (0, _.useRef)(void 0);
    (0, _.useImperativeHandle)(d2, () => p2?.map ?? null, [
      p2
    ]);
    let g2 = (0, _.useCallback)((r3) => {
      if (r3 !== null && !h2.current) {
        let i3 = new On.Map(r3, u2);
        h2.current = i3, n2 != null && l2 != null ? i3.setView(n2, l2) : e2 != null && i3.fitBounds(e2, t2), c2 != null && i3.whenReady(c2), m2(an(i3));
      }
    }, []);
    (0, _.useEffect)(() => () => {
      p2?.map.remove();
    }, [
      p2
    ]);
    let v2 = p2 ? _.createElement(sn, {
      value: p2
    }, r2) : o2 ?? null;
    return _.createElement(`div`, {
      ...f2,
      ref: g2
    }, v2);
  }
  var An = (0, _.forwardRef)(kn), jn = Sn(function({ position: e2, ...t2 }, n2) {
    let r2 = new On.Marker(e2, t2);
    return gn(r2, on(n2, {
      overlayContainer: r2
    }));
  }, function(e2, t2, n2) {
    t2.position !== n2.position && e2.setLatLng(t2.position), t2.icon != null && t2.icon !== n2.icon && e2.setIcon(t2.icon), t2.zIndexOffset != null && t2.zIndexOffset !== n2.zIndexOffset && e2.setZIndexOffset(t2.zIndexOffset), t2.opacity != null && t2.opacity !== n2.opacity && e2.setOpacity(t2.opacity), e2.dragging != null && t2.draggable !== n2.draggable && (t2.draggable === true ? e2.dragging.enable() : e2.dragging.disable());
  }), Mn = wn(function({ positions: e2, ...t2 }, n2) {
    let r2 = new On.Polyline(e2, t2);
    return gn(r2, on(n2, {
      overlayContainer: r2
    }));
  }, function(e2, t2, n2) {
    t2.positions !== n2.positions && e2.setLatLngs(t2.positions);
  }), Nn = Cn(function(e2, t2) {
    return gn(new On.Popup(e2, t2.overlayContainer), t2);
  }, function(e2, t2, { position: n2 }, r2) {
    (0, _.useEffect)(function() {
      let { instance: i2 } = e2;
      function a2(e3) {
        e3.popup === i2 && (i2.update(), r2(true));
      }
      function o2(e3) {
        e3.popup === i2 && r2(false);
      }
      return t2.map.on({
        popupopen: a2,
        popupclose: o2
      }), t2.overlayContainer == null ? (n2 != null && i2.setLatLng(n2), i2.openOn(t2.map)) : t2.overlayContainer.bindPopup(i2), function() {
        t2.map.off({
          popupopen: a2,
          popupclose: o2
        }), t2.overlayContainer?.unbindPopup(), t2.map.removeLayer(i2);
      };
    }, [
      e2,
      t2,
      r2,
      n2
    ]);
  }), Pn = Tn(function({ url: e2, ...t2 }, n2) {
    return gn(new On.TileLayer(e2, pn(t2, n2)), n2);
  }, function(e2, t2, n2) {
    En(e2, t2, n2);
    let { url: r2 } = t2;
    r2 != null && r2 !== n2.url && e2.setUrl(r2);
  });
  function Fn(e2, t2) {
    return On.default.divIcon({
      className: ``,
      html: `<div style="
      width:26px;height:26px;border-radius:50%;
      background:${e2};border:2px solid #fff;
      box-shadow:0 1px 4px rgba(0,0,0,.4);
      display:flex;align-items:center;justify-content:center;
      color:#fff;font:700 12px system-ui,sans-serif;">${t2}</div>`,
      iconSize: [
        26,
        26
      ],
      iconAnchor: [
        13,
        13
      ],
      popupAnchor: [
        0,
        -14
      ]
    });
  }
  function In({ points: e2, fitKey: t2 }) {
    let n2 = Dn();
    return (0, _.useEffect)(() => {
      if (e2.length === 0) return;
      if (e2.length === 1) {
        n2.setView([
          e2[0].lat,
          e2[0].lng
        ], 13);
        return;
      }
      let t3 = On.default.latLngBounds(e2.map((e3) => [
        e3.lat,
        e3.lng
      ]));
      n2.fitBounds(t3, {
        padding: [
          50,
          50
        ]
      });
    }, [
      n2,
      t2
    ]), null;
  }
  function Ln() {
    let { startLocation: e2, endLocation: t2, waypoints: n2, optimizedRoute: r2 } = B(Ft((e3) => ({
      startLocation: e3.startLocation,
      endLocation: e3.endLocation,
      waypoints: e3.waypoints,
      optimizedRoute: e3.optimizedRoute
    }))), i2 = (0, _.useMemo)(() => {
      if (r2) {
        let e3 = r2.orderedWaypoints, t3 = e3.length - 1;
        return e3.map((e4, n3) => ({
          point: e4,
          label: String(n3 + 1),
          color: n3 === 0 ? `#059669` : n3 === t3 ? `#e11d48` : `#2563eb`,
          role: n3 === 0 ? `Start` : n3 === t3 ? `End` : `Stop ${n3 + 1}`
        }));
      }
      let i3 = [];
      return e2 && i3.push({
        point: e2,
        label: `S`,
        color: `#059669`,
        role: `Start`
      }), n2.filter((e3) => !e3.delivered).forEach((e3, t3) => i3.push({
        point: e3,
        label: String(t3 + 1),
        color: `#2563eb`,
        role: `Waypoint ${t3 + 1}`
      })), t2 && i3.push({
        point: t2,
        label: `E`,
        color: `#e11d48`,
        role: `End`
      }), i3;
    }, [
      r2,
      e2,
      t2,
      n2
    ]), a2 = (0, _.useMemo)(() => r2 ? r2.geometry.coordinates.map(([e3, t3]) => [
      t3,
      e3
    ]) : [], [
      r2
    ]), o2 = (0, _.useMemo)(() => i2.map((e3) => e3.point), [
      i2
    ]), s2 = o2.map((e3) => `${e3.lat},${e3.lng}`).join(`|`);
    return (0, V.jsxs)(An, {
      center: [
        20,
        0
      ],
      zoom: 2,
      className: `h-full w-full`,
      scrollWheelZoom: true,
      children: [
        (0, V.jsx)(Pn, {
          url: `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`,
          attribution: `\xA9 <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors`
        }),
        i2.map((e3, t3) => (0, V.jsx)(jn, {
          position: [
            e3.point.lat,
            e3.point.lng
          ],
          icon: Fn(e3.color, e3.label),
          children: (0, V.jsxs)(Nn, {
            children: [
              (0, V.jsx)(`strong`, {
                children: e3.role
              }),
              (0, V.jsx)(`br`, {}),
              Ct(e3.point)
            ]
          })
        }, `${e3.point.lat},${e3.point.lng},${t3}`)),
        a2.length > 0 && (0, V.jsx)(Mn, {
          positions: a2,
          pathOptions: {
            color: `#2563eb`,
            weight: 5,
            opacity: 0.8
          }
        }),
        (0, V.jsx)(In, {
          points: o2,
          fitKey: s2
        })
      ]
    });
  }
  function Rn() {
    let e2 = B((e3) => e3.warmUp);
    return (0, _.useEffect)(() => {
      let t2 = setTimeout(() => e2(), 3e3);
      return () => clearTimeout(t2);
    }, [
      e2
    ]), (0, V.jsxs)(`div`, {
      className: `flex h-screen overflow-hidden bg-slate-100`,
      children: [
        (0, V.jsxs)(`aside`, {
          className: `flex w-96 shrink-0 flex-col gap-3 overflow-y-auto border-r border-slate-200 bg-white p-4`,
          children: [
            (0, V.jsx)(H, {}),
            (0, V.jsx)(Bt, {}),
            (0, V.jsx)(Vt, {}),
            (0, V.jsx)(Gt, {}),
            (0, V.jsx)(G, {}),
            (0, V.jsx)(tn, {}),
            (0, V.jsx)(nn, {})
          ]
        }),
        (0, V.jsx)(`main`, {
          className: `relative flex-1`,
          children: (0, V.jsx)(Ln, {})
        })
      ]
    });
  }
  (0, v.createRoot)(document.getElementById(`root`)).render((0, V.jsx)(_.StrictMode, {
    children: (0, V.jsx)(Rn, {})
  }));
})();
