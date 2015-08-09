var path = require('path'),
    fs = require('fs'),
    chai = require('chai'),
    parser = require('../');

var should = chai.should();

describe('parser.js', function() {
    /*
    describe('#_onvalue()', function() {

        it('should correctly return a non-ascii value', function(done) {
            var Doupé = new Buffer([0x44,0x6F,0x75,0x70,0x8E]); // possibly in Mac OS Roman
            parser()._onvalue(new Buffer(Doupé),0,5).should.equal('Doupé');
        });

        it('should correctly return a non-ascii value', function(done) {
            collect('non-ascii-char.fec', function (err, lines) {
                if (err) {
                    throw err;
                }

                lines[47].contributor_name.should.equal('Doupé^Joan Covert^Ms.^');

                done();
            });
        });

    });*/

    describe('#_online()', function() {

        it('should correctly return the value at the end of a header line delimited with commas', function(done) {
            collect('last-value.fec', function (err, lines) {
                if (err) {
                    throw err;
                }

                should.exist(lines[0].report_number);
                lines[0].report_number.should.equal('1');

                done();
            });
        });

    });

    describe('#_transform()', function() {
        it('should parse a filing with an undefined row type without throwing an error', function (done) {
            collect('undefined-row-type.fec',function (err,lines) {
                if (err) {
                    throw err;
                }

                lines.length.should.equal(11);

                done();
            });
        });

        it('should correctly parse this one filing', function (done) {
            collect('12344.fec',function (err,lines) {
                if (err) {
                    throw err;
                }

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
