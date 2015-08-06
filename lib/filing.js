var csv = require('fast-csv'),
    fs = require('fs'),
    mappings = require('./mappings'),
    _ = require('lodash');

function Filing (path,cb) {
    var self = this;

    self.version = '8.1';
    self.header = {};
    self.summary = {};
    self.rows = [];
    self.count = 0;

    self.readLine = function (row) {
        if (self.count === 0) {
            self.version = row[2];
        }

        var map = mappings.lookup(row[0],self.version);

        // work around suspected fast-csv bug
        if (map.length-1 === row.length) {
            row.push('');
        }

        row = _.zipObject(map,row);


        if (self.count === 0) {
            self.header = row;
        }
        else if (self.count === 1) {
            self.summary = row;
        }
        else {
            self.rows.push(row);
        }

        self.count++;
    };

    self.readFile = function (path,cb) {
        var FS = '\u001C',
            delimiter = null;

        var readStream = fs.createReadStream(path, {
            start: 0,
            end: 50,
            encoding: 'utf8'
        });

        readStream.on('readable',function () {
            if (delimiter) {
                return;
            }

            if (readStream.read(50).indexOf(FS) === -1) {
                delimiter = ',';
            }
            else {
                delimiter = FS;
            }

            readStream.close();

            self.count = 0;

            fs.createReadStream(path)
                .pipe(csv({
                    headers: false,
                    delimiter: delimiter
                }))
                .on('data', self.readLine)
                .on('end', function(){
                    cb(null,self);
                });
        });

    };

    self.readFile(path,cb);
}

module.exports = Filing;
