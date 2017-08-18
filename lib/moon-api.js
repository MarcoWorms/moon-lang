"use strict";

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

// Moon's high-level API.

module.exports = function (ipfsUrl) {
  var ipfs = require("nano-ipfs-store").at(ipfsUrl || "https://ipfs.infura.io:5001");
  var memo = require("nano-persistent-memoizer");
  var util = require("./moon-util.js");
  var comp = require("./moon-jit-compiler.js");
  var hexs = require("./moon-pack.js");
  var synt = require("./moon-syntax.js");

  // type Native = <a native JavaScript value>

  // type Opts = {
  //   fast: Bool,       -- builds a native term that runs faster but can't be stringified
  //   opsLimit: Number, -- max limit of operations that compiled functions can perform (UNIMPLEMENTED - will be soon)
  // }

  // String [, Opts] -> Native
  //   Parses Moon code to a native value / function.
  var parse = function parse(code) {
    var opts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

    var term = synt.termFromString(code);
    var jsValue = (opts || {}).fast ? comp.termCompileFast(term) : comp.termCompileFull(term);
    return eval(jsValue)();
  };

  // Native [, Opts] -> String
  //   Stringifies a native value / function back to Moon.
  var stringify = function stringify(value, opts) {
    return synt.termToString(comp.termDecompileFull(value));
  };

  // String [, Opts] -> String
  //   Runs Moon code and returns the resulting Moon code.
  //   Uses fast mode if possible.
  var run = function run(code, opts) {
    var term = synt.termFromString(code);
    return synt.termToString(comp.termReduce(term));
  };

  // String-> String
  //   Returns the canonical binary representation of a term.
  var pack = function pack(code) {
    return hexs.termToHex(synt.termFromString(code));
  };

  // String [, Opts] -> String
  //   Unpacks the canonical binary representation of a term. 
  var unpack = function unpack(hex) {
    return synt.termToString(hexs.termFromHex(hex));
  };

  // String -> String
  //   Compiles Moon code to JavaScript code.
  var compile = function compile(code) {
    return comp.termCompileFast(synt.termFromString(code));
  };

  // CID -> Promise String
  //   Stores a term on IPFS.
  var load = memo("moon-base").async(function (cid) {
    return ipfs.get(cid).then(function (bytes) {
      return unpack(util.bytesToHex(bytes));
    });
  });

  // String -> Promise CID 
  //   Gets a term from IPFS.
  var save = function save(code) {
    return ipfs.add(util.hexToBytes(pack(code)));
  };

  // String -> Promise CID
  //   Returns the CID of a term (without storing it).
  var cid = function cid(code) {
    return ipfs.cid(util.hexToBytes(pack(code)));
  };

  // Term -> [String]
  var termRefs = function termRefs(term) {
    var fvs = {};
    term({
      App: function App(f, x) {},
      Lam: function Lam(name, body) {},
      Var: function Var(name) {},
      Ref: function Ref(name) {
        return fvs[name] = 1;
      },
      Let: function Let(name, term, body) {},
      Fix: function Fix(name, term) {},
      Pri: function Pri(name, args) {},
      Num: function Num(num) {},
      Str: function Str(num) {},
      Map: function Map(kvs) {}
    });
    return Object.keys(fvs);
  };

  // (String -> Promise String), String -> Promise String
  //   Recursivelly imports missing variables with custom importer.
  var importsWith = function importsWith(eitherImporter, code) {
    return new Promise(function (resolve, reject) {
      var makeImporter = function makeImporter(importer) {
        return (typeof importer === "undefined" ? "undefined" : _typeof(importer)) === "object" ? function (name) {
          return importer[name];
        } : importer;
      };
      try {
        var importer = makeImporter(eitherImporter);
        var _imports = [];
        var imported = {};
        var result = "";
        var go = function go(name, code) {
          if (!imported[name]) {
            if (code) {
              var codeRefs = termRefs(synt.termFromString(code));
              var refsProm = Promise.all(codeRefs.map(function (ref) {
                return importer(ref).then(function (code) {
                  return go(ref, code);
                });
              }));
              imported[name] = refsProm.then(function () {
                return result = result + "\n" + name + " = " + code;
              }).catch(function () {
                return reject("Moon: couldn't resolve " + name + ".");
              });
            } else {
              imported[name] = Promise.resolve(null);
            }
          }
          return imported[name];
        };
        return go("main", code).then(function () {
          return resolve(result + "\nmain");
        });
      } catch (e) {
        reject(e);
      }
    });
  };

  // String -> Promise String
  //   Recursivelly imports missing variables from IPFS.
  var imports = function imports(code) {
    return importsWith(load, code);
  };

  // Native, Methods -> Promise result
  var performIO = function performIO(program, methods) {
    return program(function (method) {
      return function (args) {
        return function (cont) {
          if (!methods[method]) {
            throw "Unknown IO method: " + method;
          } else {
            return methods[method](args).then(cont);
          }
        };
      };
    })(function (result) {
      return Promise.resolve(result);
    });
  };

  return {
    parse: parse,
    stringify: stringify,
    run: run,
    pack: pack,
    unpack: unpack,
    compile: compile,
    save: save,
    load: load,
    importsWith: importsWith,
    imports: imports,
    performIO: performIO
  };
};