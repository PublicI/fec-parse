#!/bin/bash

TEMP_DIR="./temp"
FILINGS_DIR="./filings"

for f in $FILINGS_DIR/*.zip
do
    echo "unzipping $(basename $f)"
    unzip -oq $f -d $TEMP_DIR
    ruby parse.rb
    rm -rf $TEMP_DIR/*.fec
done
