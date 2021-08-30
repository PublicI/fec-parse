import fs from "fs";
import chai from "chai";
import parser from "../lib/parser.js";

const should = chai.should();

describe("parser.js", () => {
  /*
    it('should correctly return a non-ascii value', function(done) {
        collect('character-encoding.fec', function (err, lines) {
            if (err) {
                throw err;
            }

            lines[15].contributor_name.should.equal('Zorrilla-Martínez^Pedro L.');

            done();
        });
    });*/

  it("should correctly return the value at the end of a header line delimited with commas", (done) => {
    collect("last-value.fec", (err, lines) => {
      if (err) {
        throw err;
      }

      should.exist(lines[0].report_number);
      lines[0].report_number.should.equal("1");

      done();
    });
  });

  it("should parse a filing with an undefined row type without throwing an error", (done) => {
    collect("undefined-row-type.fec", (err, { length }) => {
      if (err) {
        throw err;
      }

      length.should.equal(11);

      done();
    });
  });

  it("should correctly parse a filing with a row that has a line without a header mapping", (done) => {
    collect("no-header-mapping.fec", (err, { length }) => {
      if (err) {
        throw err;
      }

      length.should.equal(2);

      done();
    });
  });

  it("should correctly parse a filing with a missing close quote", (done) => {
    collect("trailing-quote.fec", (err, { length }) => {
      if (err) {
        throw err;
      }

      length.should.equal(212);

      done();
    });
  });

  it("should correctly parse a filing that leaves a quote open if it uses the FS separator", (done) => {
    collect("quote-left-open.fec", (err, lines) => {
      if (err) {
        throw err;
      }

      // technically quotes aren't even allowed here, but ¯\_(ツ)_/¯
      lines[2].contributor_occupation.should.equal(
        '~"CO"~ AUTHOR OF ~"DIVINE 9/11 INTERVE'
      );

      done();
    });
  });

  it("should correctly parse a form 99", (done) => {
    collect("form-99.fec", (err, lines) => {
      if (err) {
        throw err;
      }

      lines.length.should.equal(2);
      should.exist(lines[1].text);
      lines[1].text.should.equal(
        "It is the intention of 21st Century Democrats (C00230342) to change to a monthly filing schedule for the year 2002."
      );

      done();
    });
  });

  it("should return the correct value for total and federal refunds", (done) => {
    collect("federal-refunds.fec", (err, lines) => {
      if (err) {
        throw err;
      }

      lines[1].col_a_total_contributions_refunds.should.equal("270000.00");
      lines[1].col_b_total_contributions_refunds.should.equal("270000.00");
      lines[1].col_a_federal_refunds.should.equal("0.00");
      lines[1].col_b_federal_refunds.should.equal("0.00");

      done();
    });
  });

  it("should correctly parse a version 2.6 paper filing header row", (done) => {
    collect("843444.fec", (err, lines) => {
      if (err) {
        throw err;
      }

      lines[0].received_date.should.equal("20121031");

      done();
    });
  });

  it("should correctly parse certain lines of a converted paper filing", (done) => {
    collect("paper1.fec", (err, lines) => {
      if (err) {
        throw err;
      }

      lines.length.should.equal(11);
      lines[0].record_type.should.equal("HDR");
      lines[0].fec_version.should.equal("P3.2");
      lines[0].soft_name.should.equal('"Aurotech/Captricity"');
      lines[0].batch_number.should.equal("1");
      lines[0].received_date.should.equal("20161008");

      lines[1].col_a_cash_on_hand_close.should.equal("634214.43");
      lines[1].begin_image_number.should.equal("201610040200394414");
      lines[1].receipt_date.should.equal("20161004");

      lines[2].form_type.should.equal("SA11AI");
      lines[2].filer_committee_id_number.should.equal("C00608851");
      lines[2].contributor_last_name.should.equal("TARRICONE");
      lines[2].contributor_first_name.should.equal("ANTHONY");
      lines[2].contributor_street_1.should.equal("22 VINE ST");
      lines[2].contributor_city.should.equal("GLOUCESTER");
      lines[2].contributor_state.should.equal("MA");
      lines[2].contributor_zip_code.should.equal("019301759");
      lines[2].contribution_date.should.equal("20160630");
      lines[2].contributor_employer.should.equal("KREINDLER AND KREINDLER LLP");
      lines[2].contributor_occupation.should.equal("ATTORNEY");
      lines[2].election_code.should.equal("P2016");
      lines[2].contribution_aggregate.should.equal("3000.00");
      lines[2].contribution_amount.should.equal("1500.00");
      lines[2].memo_text_description.should.equal(
        "* EARMARKED CONTRIBUTION: SEE BELOW"
      );
      lines[2].image_number.should.equal("201610040200394419");

      lines[7].form_type.should.equal("SB17");
      lines[7].filer_committee_id_number.should.equal("C00608851");
      lines[7].payee_last_name.should.equal("HEAD");
      lines[7].payee_first_name.should.equal("BRIGHT");
      lines[7].payee_street_1.should.equal("225 ANNUNCIATION ST");
      lines[7].payee_city.should.equal("LAFAYETTE");
      lines[7].payee_state.should.equal("LA");
      lines[7].payee_zip_code.should.equal("705086027");
      lines[7].expenditure_date.should.equal("20160401");
      lines[7].expenditure_purpose_descrip.should.equal(
        "CONSULTING: COMMUNICATIONS"
      );
      lines[7].category_code.should.equal("001");
      lines[7].election_code.should.equal("P2016");
      lines[7].expenditure_amount.should.equal("4000.00");
      lines[7].image_number.should.equal("201610040200394555");

      done();
    });
  });
});

/*
forked from https://github.com/mafintosh/csv-parser/blob/master/test/test.js
copyright (c) 2014 Mathias Buus
licensed MIT */

function fixture(name) {
  return new URL(`data/${name}`, import.meta.url);
}

function collect(file, opts, cb) {
  if (typeof opts === "function") {
    return collect(file, undefined, opts);
  }

  const data = fs.createReadStream(fixture(file));
  const lines = [];
  data
    .pipe(parser(opts))
    .on("data", (line) => {
      lines.push(line);
    })
    .on("error", (err) => {
      cb(err, lines);
    })
    .on("end", () => {
      cb(false, lines);
    });

  return parser;
}
