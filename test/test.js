var path = require('path'),
    fs = require('fs'),
    chai = require('chai'),
    parser = require('../');

chai.should();

describe('parser.js', function() {
    describe('#_onvalue()', function() {
        it('should correctly return a non-ascii value', function(done) {
            collect('non-ascii-char.fec', function (err, lines) {
                if (err) {
                    throw err;
                }

                lines[47].contributor_name.should.equal('Doup^Joan Covert^Ms.^');

                done();
            });
        });
    });
});

/*
forked from https://github.com/mafintosh/csv-parser/blob/master/test/test.js
copyright (c) 2014 Mathias Buus
licensed MIT */

function fixture(name) {
    return path.join(__dirname, 'data', name);
}

function collect(file, opts, cb) {
    if (typeof opts === 'function') {
        return collect(file, null, opts);
    }
    var data = fs.createReadStream(fixture(file));
    var lines = [];
    data.pipe(parser(opts))
        .on('data', function(line) {
            lines.push(line);
        })
        .on('error', function(err) {
            cb(err, lines);
        })
        .on('end', function() {
            cb(false, lines);
        });

    return parser;
}
