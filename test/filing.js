var fs = require('fs');

var Filing = require('../lib/filing');

var filingId = '266598';
/*
fs.readFile(function (err,contents) {
    var fromFech = JSON.parse(contents);
*/
    new Filing(__dirname + '/temp/' + filingId + '.fec',function (err,filing) {
        console.log(JSON.stringify(filing,'  '));
    });
//});



/*
var mappings = require('../lib/mappings.js');

var map = mappings.lookup('f3n');

console.log(map);
*/