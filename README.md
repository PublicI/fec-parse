This is currently a mashup of the [Fech](https://github.com/NYTimes/Fech) Ruby gem by Derek Willis and others (portions ported to JavaScript), and the  [csv-parser](https://github.com/mafintosh/csv-parser) module by Mathias Buus, Max Ogden and others.

**This module is currently beta software. Users are strongly cautioned against relying on the output being 100% correct for every filing.**

## Installation

```shell
npm install --save fec-parse
```

## Usage

### Parse from downloaded file

```shell
wget http://docquery.fec.gov/dcdev/posted/876050.fec
```

```js
var fs = require('fs'),
    parser = require('fec-parse');

var filingId = '876050'; // Obama for America 2012 post-general report

fs.createReadStream(filingId + '.fec')
            .pipe(parser())
            .on('data', function(row) {
                console.log(row);
            })
            .on('error', function (err) {
                console.error(err);
            })
            .on('finish',function () {
                console.log('done');
            });
```

### Download and parse in one

```sh
npm install --save request JSONStream
```

```js
var fs = require('fs'),
    parser = require('fec-parse'),
    request = require('request'),
    JSONStream = require('JSONStream');

var filingId = '876050';

request('http://docquery.fec.gov/dcdev/posted/' + filingId + '.fec')
    .pipe(parser())
    .pipe(JSONStream.stringify('{"rows":[\n',',\n','\n]}'))
    .pipe(fs.createWriteStream(filingId + '.json'));
```
