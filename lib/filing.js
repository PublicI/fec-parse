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
        self.count = 0;

        fs.createReadStream(path)
            .pipe(csv({
                headers: false
            }))
            .on('data', self.readLine)
            .on('end', function(){
                cb(null,self);
            });
    };

    self.readFile(path,cb);
}

module.exports = Filing;
