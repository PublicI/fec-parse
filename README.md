# A streaming FEC raw file parser

Currently a mashup of the JS-translated Ruby gem [Fech](https://github.com/NYTimes/Fech) by Derek Willis and others, and the Node [csv-parser](https://github.com/mafintosh/csv-parser) module by Mathias Buus, Max Ogden and others. The module is currently under heavy development, and nobody should use for anything serious.

## Usage

```
var fs = require('fs'),
    parser = require('fec-parse');

fs.createReadStream('876050.fec')
            .pipe(parser())
            .on('data', function(row) {
                console.log(row);
            }
            .on('error', function (err) {
                console.error(err);
            })
            .on('finish',function () {
                console.log('done');
            });
```
