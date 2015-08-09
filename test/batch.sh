#!/bin/bash

TEMP_DIR="./temp"
FILINGS_DIR="./filings"
RUBY_PARSED_DIR="./ruby_parsed"
NODE_PARSED_DIR="./node_parsed"

mkdir $TEMP_DIR
mkdir $RUBY_PARSED_DIR
mkdir $NODE_PARSED_DIR
for f in $FILINGS_DIR/*.zip
do
    rm -rf $TEMP_DIR/*.fec
    rm -rf $RUBY_PARSED_DIR/*.json
    rm -rf $NODE_PARSED_DIR/*.json
    echo "unzipping $(basename $f)"
    unzip -oq $f -d $TEMP_DIR
    echo "running ruby parser"
    ruby parse.rb
    echo "running node parser"
    node parse.js
    for f in $RUBY_PARSED_DIR/*.json
    do
        echo "diff $f"
        diff $f ${f/ruby_parsed/node_parsed}
    done
done
