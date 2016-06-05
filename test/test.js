var path = require('path'),
    fs = require('fs'),
    chai = require('chai'),
    parser = require('../');

var should = chai.should();

describe('parser.js', function() {
    it('should correctly return a non-ascii value', function(done) {
        collect('character-encoding.fec', function (err, lines) {
            if (err) {
                throw err;
            }

            lines[15].contributor_name.should.equal('Zorrilla-Martínez^Pedro L.');

            done();
        });
    });

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

    it('should parse a filing with an undefined row type without throwing an error', function (done) {
        collect('undefined-row-type.fec',function (err,lines) {
            if (err) {
                throw err;
            }

            lines.length.should.equal(11);

            done();
        });
    });

    it('should correctly parse a filing with a row that has a line without a header mapping', function (done) {
        collect('no-header-mapping.fec',function (err,lines) {
            if (err) {
                throw err;
            }

            lines.length.should.equal(2);

            done();
        });
    });

    it('should correctly parse a filing with a missing close quote', function (done) {
        collect('trailing-quote.fec',function (err,lines) {
            if (err) {
                throw err;
            }

            lines.length.should.equal(212);

            done();
        });
    });

    it('should correctly parse a filing that leaves a quote open if it uses the FS separator', function (done) {
        collect('quote-left-open.fec',function (err,lines) {
            if (err) {
                throw err;
            }

            // technically quotes aren't even allowed here, but ¯\_(ツ)_/¯
            lines[2].contributor_occupation.should.equal('~"CO"~ AUTHOR OF ~"DIVINE 9/11 INTERVE');

            done();
        });
    });
    
    it('should correctly parse a form 99', function (done) {
        collect('form-99.fec',function (err,lines) {
            if (err) {
                throw err;
            }
            
            lines.length.should.equal(2);
            should.exist(lines[1].text);
            lines[1].text.should.equal('It is the intention of 21st Century Democrats (C00230342) to change to a monthly filing schedule for the year 2002.');

            done();
        });
    });


    it('should return the correct value for total and federal refunds', function (done) {
        collect('federal-refunds.fec',function (err,lines) {
            if (err) {
                throw err;
            }

            lines[1].col_a_total_contributions_refunds.should.equal('270000.00');
            lines[1].col_b_total_contributions_refunds.should.equal('270000.00');
            lines[1].col_a_federal_refunds.should.equal('0.00');
            lines[1].col_b_federal_refunds.should.equal('0.00');

            done();
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
