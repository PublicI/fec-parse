#!/bin/bash

TEMP_DIR="./temp"
FILINGS_DIR="./filings"
RUBY_PARSED_DIR="./ruby_parsed"
NODE_PARSED_DIR="./node_parsed"

for f in $FILINGS_DIR/*.zip
do
    echo "unzipping $(basename $f)"
    unzip -oq $f -d $TEMP_DIR
    ruby parse.rb
    node parse.js
    for f in $RUBY_PARSED_DIR/*.json
    do
        echo "diff $f"
        diff $f ${f/ruby_parsed/node_parsed}
    done
    rm -rf $TEMP_DIR/*.fec
    rm -rf $RUBY_PARSED_DIR/*.json
    rm -rf $NODE_PARSED_DIR/*.json
done
