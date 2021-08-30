/*
forked from https://github.com/mafintosh/csv-parser
copyright (c) 2014 Mathias Buus
licensed MIT */

import {Transform} from 'stream';

import genobj from 'generate-object-property';
import genfun from 'generate-function';

import mappings from './mappings.js';

const quote = new Buffer.from('"')[0];
const comma = new Buffer.from(',')[0];
const cr = new Buffer.from('\r')[0];
const lf = new Buffer.from('\n')[0];
const fs = new Buffer.from('\u001C')[0];

/**
* Sets up the parser, stream and instance variables. Instantiated internally.
*
* @constructor
* @param {Object} opts No options, yet.
*/

class Parser extends Transform {
    constructor(opts = {map: true}) {
        super({
            objectMode: true,
            highWaterMark: 16
        });

        this.version = '8.2'; // default filing version

        this.map = !opts.map && opts.map !== false ? true : opts.map;

        this._prev = null; // already buffered stream data
        this._prevEnd = 0; // where buffer ends
        this._first = true; // whether the currently parsed row is the first
        this._empty = null; // the default value returned for empty fields
        this._Rows = {}; // lookup for generated Row classes
        this._separator = fs; // field separator/delimiter character
        this._newline = lf; // new line character
        this._f99 = false; // is an F99 form with a block of free text input
    }

    /**
    * Called automatically by the incoming stream, does the first level of parsing.
    * 
    * @param {Buffer/string} data The incoming data.
    * @param {string?} enc The encoding.
    * @param {function} cb A callback for when it's done.
    */

    _transform(data, enc, cb) {
        if (typeof data === 'string') {
            data = new Buffer(data);
        }

        let start = 0;
        let buf = data;

        // if previous buffered data exists, pick up where it left off
        if (this._prev) {
            start = this._prev.length;
            buf = Buffer.concat([this._prev, data]);
            this._prev = null;
        }

        for (let i = start; i < buf.length; i++) {
            // auto-detect the line feed character
            if (this._first) {
                if (buf[i] === lf) {
                    this._newline = lf;
                }
                else if (buf[i] === cr) {
                    if (buf[i + 1] !== lf) { 
                        this._newline = cr;
                    }
                }
            }

            // parse each line
            if (buf[i] === this._newline) {
                this._online(buf, this._prevEnd, i + 1);
                this._prevEnd = i + 1;
            }
        }

        // handle the remaining buffer
        if (this._prevEnd === buf.length) {
            this._prevEnd = 0;
            return cb();
        }

        if (buf.length - this._prevEnd < data.length) {
            this._prev = data;
            this._prevEnd -= (buf.length - data.length);
            return cb();
        }

        this._prev = buf;
        cb();
    }

    /**
    * Handles the stream closing.
    * 
    * @param {function} cb A callback for when it's done.
    */

    _flush(cb) {
        if (this._quoting || !this._prev) {
            return cb();
        }
        this._online(this._prev, this._prevEnd, this._prev.length + 1); // plus since online -1s
        cb();
    }

    /**
    * Parses each line.
    * 
    * @param {Buffer} buf The buffered data.
    * @param {integer} start Index of the start of the line.
    * @param {integer} end Index of the end of the line.
    */

    _online(buf, start, end) {
        end--; // trim newline
        if (buf.length && buf[end - 1] === cr) {
            end--;
        }

        const sep = this._separator;
        let cells = [];
        let inQuotes = false;
        let offset = start;

        // parses each cell
        for (let i = start; i < end; i++) {
            if (buf[i] === quote) { // "
                if (i < end - 1 && buf[i + 1] === quote) { // ""
                    i++;
                }
                else {
                    inQuotes = !inQuotes;
                }
                continue;
            }
            if (buf[i] === sep && (!inQuotes || sep === fs)) {
                cells.push(this._oncell(buf, offset, i));
                offset = i + 1;
            }
        }

        // if version couldn't be parsed, return
        if (!this.version) {
            return;
        }

        // auto-detects which field separator to use, FS or comma
        if (this._first && cells.length === 0 && this._separator !== comma) {
            this._separator = comma;
            this._online(buf,start,end+1);
            return;
        }
        else if (this._first && cells.length === 0) {
            this.emit('error', new Error('Cannot parse header row'));
            this.version = null;
            return;
        }

        // take care of any trailing data on the line
        if (offset < end) {
            cells.push(this._oncell(buf, offset, end));
        }
        if (buf[end - 1] === sep) {
            cells.push(this._empty);
        }

        // sets the version
        if (this._first) {
            this._first = false;
            this.version = cells[2];

            // try to detect whether this is an electronic filing, look in different location for version if not
            if (cells[1] !== 'FEC') {
                this.version = cells[1];
            }
        }

        // handle form 99s
        if (cells[0] && cells[0].toLowerCase() == 'f99') {
            this._f99 = true;
            cells.push('');
            this._cells = cells;
            return;
        }

        if (this._f99) {
            const textIndex = this._cells.length-1;
            if (cells[0] && cells[0].toUpperCase() == '[BEGINTEXT]') {
                return;
            }
            else if (cells[0] && cells[0].toUpperCase() == '[ENDTEXT]') {
                cells = this._cells;
                cells[textIndex] = cells[textIndex].substr(0,cells[textIndex].length-1);
                this._f99 = false;
            }
            else {
                this._cells[textIndex] = this._cells[textIndex]
                                            .concat(`${this._onvalue(buf,start,end)}\n`);
                return;
            }
        }

        // compile the Row class with field names for the form type and filing version
        const res = this._lookup(cells[0],this.version);

        // if there are more field names for the row than cells, add empties
        if (res.headers && cells.length !== res.headers.length) {
            for (let num = cells.length; num <= res.headers.length; num++) {
                cells.push(this._empty);
            }
        }

        if (!this.map && res.headers) {
            this.push({row: cells, headers: res.headers });
            return;
        }
        else if (res._Row) {
            // send out the cells and the compiled Row class
            this._emit(res._Row, cells);
        }
    }

    /**
    * Looks up the field names based on the form type and filing version.
    * 
    * @param {string} type Form type, the first value on a line.
    * @param {string} version The filing version from the filing header.
    */

    _lookup(type, version) {
        const res = {
            _Row: null,
            headers: null
        };

        if (typeof type === 'undefined' || !type) {
            // errors appear to (eventually?) derail streams, so commenting out recoverable errors for now
            // this.emit('error', new Error('Row type was undefined'));
            return res;
        }

        type = type.toLowerCase();

        // try to look up a pre-compiled Row by version and form type
        if (type in this._Rows && version in this._Rows[type]) {
            return this._Rows[type][this.version];
        }
        else if (!(type in this._Rows)) {
            this._Rows[type] = {};
        }

        // get the appropriate field names from the mappings
        res.headers = mappings.lookup(type,version);

        if (!res.headers) {
            // errors appear to (eventually?) derail streams, so commenting out recoverable errors for now
            // this.emit('error', new Error('Couldn\'t find header mapping'));
            return res;
        }

        res._Row = this._compile(res.headers);

        // store it in the lookup
        this._Rows[type][this.version] = res;

        return res;

    }

    /**
    * Generates a Row class to return.
    *
    * @param {array} headers The fields names for the row.
    */

    _compile(headers) {
        // generate a Row class on the fly
        const Row = genfun()('function Row (cells) {');

        headers.forEach((cell, i) => {
            Row('%s = cells[%d]', genobj('this', cell), i);
        });

        Row('}');

        const _Row = Row.toFunction();

        return _Row;
    }

    /**
    * Instantiates a new Row object with the cells and sends it to the pipe.
    * 
    * @param {function} Row The Row class for this line.
    * @param {array} cells The data in parsed cells.
    */

    _emit(Row, cells) {
        this.push(new Row(cells));
    }

    /**
    * Processes a single cell.
    * 
    * @param {Buffer} buf The buffered data.
    * @param {integer} start Index of the start of the cell.
    * @param {integer} end Index of the end of the cell.
    */

    _oncell(buf, start, end) {
        if (start === end) {
            return this._empty;
        }

        // if the cell is quoted, remove the quotes
        if (buf[start] === quote && buf[end - 1] === quote) {
            start++;
            end--;
        }

        // if the cell is quoted and empty, return an empty string instead of null
        if (start === end) {
            return '';
        }

        for (var i = start, y = start; i < end; i++) {
            if (buf[i] === quote && buf[i + 1] === quote) { // ""
                i++;
            }
            if (y !== i) {
                buf[y] = buf[i];
            }
            y++;
        }

        return this._onvalue(buf, start, y);
    }

    /**
    * Convert the buffered value to UTF-8.
    * 
    * @param {Buffer} buf The buffered data.
    * @param {integer} start Index of the start of the value.
    * @param {integer} end Index of the end of the value.
    */

    _onvalue(buf, start, end) {
        return buf.toString('utf8', start, end).replace('\ufffd','');
    }
}

export default opts => new Parser(opts);
