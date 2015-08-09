# A streaming FEC raw file parser

Currently a mashup of the JS-translated Ruby gem [Fech](https://github.com/NYTimes/Fech) by Derek Willis and others, and the Node [csv-parser](https://github.com/mafintosh/csv-parser) module by Mathias Buus, Max Ogden and others. The module is currently under heavy development, and nobody should use for anything serious.

## Installation

```
npm install --save github:chriszs/fec-parse
```

## Usage

### Parse from downloaded file

```
wget http://docquery.fec.gov/dcdev/posted/876050.fec
```

```
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

```
npm install --save request JSONStream
```

```
var fs = require('fs'),
    parser = require('../'),
    request = require('request'),
    JSONStream = require('JSONStream');

var filingId = '876050';

request('http://docquery.fec.gov/dcdev/posted/' + filingId + '.fec')
    .pipe(parser())
    .pipe(JSONStream.stringify('{"rows":[\n',',\n','\n]}'))
    .pipe(fs.createWriteStream(filingId + '.json'));
```
