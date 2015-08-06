var fs = require('fs'),
	_ = require('lodash');

var Filing = require('../');

// var filingId = '266598';
var filingId = '1015585'; // Hillary for America July 2015 report
/*
fs.readFile(function (err,contents) {
    var fromFech = JSON.parse(contents);
*/
    new Filing(__dirname + '/temp/' + filingId + '.fec',function (err,filing) {
        console.log(JSON.stringify(filing,null,'  '));
    });
//});



/*
var mappings = require('../lib/mappings.js');

var map = mappings.lookup('f3n');

console.log(map);
*/