
/// <reference path="node.d.ts" />

var connect = require('connect');
var serveStatic = require('serve-static');


var PORT =  8080
var IP   = process.env.IP || '127.0.0.1';

console.log("listen on "+PORT);
connect().use(serveStatic(__dirname)).listen(PORT, IP);
