var ts = require("./node_modules/typescript");
var path = require("path");

var configPath = ts.findConfigFile("./", ts.sys.fileExists, "tsconfig.json");
var configFile = ts.readConfigFile(configPath, ts.sys.readFile);
var parsedConfig = ts.parseJsonConfigFileContent(configFile.config, ts.sys, "./");
var options = Object.assign({}, parsedConfig.options, {
  incremental: false,
  tsBuildInfoFile: undefined,
  noEmit: true
});
var program = ts.createProgram(parsedConfig.fileNames, options);
var diagnostics = ts.getPreEmitDiagnostics(program);

var ours = Array.from(diagnostics).filter(function(d) {
  var f = d.file ? d.file.fileName : "";
  return f.indexOf("/.next/") === -1 && f.indexOf("/node_modules/") === -1;
});

if (ours.length === 0) {
  console.log("OK: no type errors in project source");
} else {
  ours.forEach(function(d) {
    var msg = ts.flattenDiagnosticMessageText(d.messageText, "\n");
    if (d.file) {
      var lc = ts.getLineAndCharacterOfPosition(d.file, d.start);
      var rel = path.relative("./", d.file.fileName);
      console.log(rel + ":" + (lc.line+1) + ":" + (lc.character+1) + " TS" + d.code + ": " + msg);
    } else {
      console.log("TS" + d.code + ": " + msg);
    }
  });
}
