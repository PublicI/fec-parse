var fs = require('fs'),
    _ = require('lodash'),
    queue = require('queue-async');

var parser = require('../');

var q = queue(1);

fs.readdir(__dirname + '/temp',function (err,files) {
    files.forEach(function (filename) {
        if (filename == '.DS_Store') {
            return;
        }

        q.defer(function (filename) {
            filingId = filename.replace('.fec','');
            console.log('parsing ' + filingId + '.fec');

            var count = 0;

            var file = fs.createWriteStream(__dirname + '/node_parsed/' + filingId + '.json');
            console.log(__dirname + '/node_parsed/' + filingId + '.json');

            file.write('{\r\n  \"rows\": [  \r\n    ');

            fs.createReadStream(__dirname + '/temp/' + filingId + '.fec')
                .pipe(parser())
                .on('data', function(row) {
                    if (row) {
                        if (count !== 0) {
                            file.write(',\r\n    ');
                        }
                        file.write(JSON.stringify(row,null,'      ').replace('}','    }'));
                        count++;
                    }
                })
                .on('finish',function () {
                    file.write('\r\n  ]\r\n}\r\n');
                    file.end();
                    console.log('parsed ' + count + ' rows');
                });
        },filename);
    });
});
