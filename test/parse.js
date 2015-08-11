var fs = require('fs'),
    _ = require('lodash'),
    queue = require('queue-async');

var parser = require('../');

var q = queue(1);

fs.readdir(__dirname + '/temp',function (err,files) {
    files.forEach(function (filename) {
        if (filename == '.DS_Store' || filename.indexOf('.fec') === -1) {
            return;
        }

        q.defer(function (filename,cb) {
            var filingId = filename.replace('.fec','');

            fs.exists(__dirname + '/node_parsed/' + filingId + '.json',function (exists) {
                if (!exists) {
//                    console.log('parsing ' + filingId + '.fec');

                    var count = 0;

                    var file = null;

                    var firstCb = true;

                    fs.createReadStream(__dirname + '/temp/' + filingId + '.fec')
                        .pipe(parser())
                        .on('data', function(row) {
                            if (row) {
                                if (count === 0) {
                                    file = fs.createWriteStream(__dirname + '/node_parsed/' + filingId + '.json');
                                    file.write('{\r\n  \"rows\": [  \r\n    ');
                                }
                                else {
                                    file.write(',\r\n    ');
                                }

                                file.write(JSON.stringify(row,null,'      ').replace('}','    }'));
                                count++;
                            }
                        })
                        .on('error',function (e) {
                            if (firstCb &&
                                e.message != 'Row type was undefined' &&
                                e.message != 'Couldn\'t find header mapping') {
//                               console.log(e);
                                cb(null);
                                firstCb = false;
                            }
                        })
                        .on('finish',function () {
                            if (count > 0) {
                                file.write('\r\n  ]\r\n}\r\n');
                                file.end();
                            }
//                            console.log('parsed ' + count + ' rows');

                            if (firstCb) {
                                cb(null);
                                firstCb = false;
                            }
                        });
                }
                else {
 //                   console.log('skipping ' + filingId + ' because parsed file exists');

                    cb(null);
                }
            });

        },filename);

    });
});
