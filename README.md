This is an unofficial Node.js parser for electronic filings submitted to the Federal Election Commission.

This uses code from the [Fech](https://github.com/NYTimes/Fech) Ruby gem by Derek Willis and others, and the [csv-parser](https://github.com/mafintosh/csv-parser) module by Mathias Buus, Max Ogden and others. It uses header mappings contributed to by many and refined by Evan Sonderegger for [fecfile](https://github.com/esonderegger/fecfile).

## Installation

```shell
npm i fec-parse
```

## Usage

### Parse from downloaded file

```shell
wget http://docquery.fec.gov/dcdev/posted/876050.fec
```

```js
import fs from "fs";
import parser from "fec-parse";

const filingId = "876050"; // Obama for America 2012 post-general report

fs.createReadStream(`${filingId}.fec`)
  .pipe(parser())
  .on("data", (row) => {
    console.log(row);
  })
  .on("error", (err) => {
    console.error(err);
  })
  .on("finish", () => {
    console.log("done");
  });
```

### Download and parse in one

```sh
npm install --save request JSONStream
```

```js
import fs from "fs";
import parser from "fec-parse";
import request from "request";
import JSONStream from "JSONStream";

const filingId = "876050";

request(`http://docquery.fec.gov/dcdev/posted/${filingId}.fec`)
  .pipe(parser())
  .pipe(JSONStream.stringify('{"rows":[\n', ",\n", "\n]}"))
  .pipe(fs.createWriteStream(`${filingId}.json`));
```
