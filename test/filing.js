var fs = require('fs'),
    _ = require('lodash');

var parser = require('../lib/parser');

// var filingId = '266598';
var filingId = '1015585'; // Hillary for America July 2015 report
/*
fs.readFile(function (err,contents) {
    var fromFech = JSON.parse(contents);
*/
/*
    new Filing(__dirname + '/temp/' + filingId + '.fec',function (err,filing) {
        console.log(JSON.stringify(filing,null,'  '));
    });*/
//});

console.log('parsing ' + filingId + '.fec');

var count = 0;

fs.createReadStream(__dirname + '/temp/' + filingId + '.fec')
    .pipe(parser())
    .on('data', function(row) {
        if (row) {
            JSON.stringify(row);
            count++;
        }
    })
    .on('end',function () {
        console.log('parsed ' + count + ' rows');
    });


/*
var mappings = require('../lib/mappings.js');

var map = mappings.lookup('f3n');

console.log(map);
*/