/*
forked from https://github.com/mafintosh/csv-parser
copyright (c) 2014 Mathias Buus
licensed MIT */

var stream = require('stream'),
    inherits = require('inherits'),
    genobj = require('generate-object-property'),
    genfun = require('generate-function'),
    mappings = require('./mappings');

var quote = new Buffer('"')[0],
    comma = new Buffer(',')[0],
    cr = new Buffer('\r')[0],
    nl = new Buffer('\n')[0],
    fs = new Buffer('\u001C')[0];

var Parser = function(opts) {
    if (!opts) opts = {};

    stream.Transform.call(this, {
        objectMode: true,
        highWaterMark: 16
    });

    this.separator = fs;
    this.newline = nl;

    this.headers = null;

    this._raw = !!opts.raw;
    this._prev = null;
    this._prevEnd = 0;
    this._first = true;
    this._quoting = false;
    this._empty = this._raw ? new Buffer(0) : null;
    this._Rows = {};
    this.version = '8.1';
};

inherits(Parser, stream.Transform);

Parser.prototype._transform = function(data, enc, cb) {
    if (typeof data === 'string') data = new Buffer(data);

    var start = 0;
    var buf = data;

    if (this._prev) {
        start = this._prev.length;
        buf = Buffer.concat([this._prev, data]);
        this._prev = null;
    }

    for (var i = start; i < buf.length; i++) {
        if (buf[i] === quote) this._quoting = !this._quoting;
        if (!this._quoting) {
            if (this._first) {
                if (buf[i] === nl) {
                    this.newline = nl;
                } else if (buf[i] === cr) {
                    if (buf[i + 1] !== nl) {
                        this.newline = cr;
                    }
                }
            }

            if (buf[i] === this.newline) {
                this._online(buf, this._prevEnd, i + 1);
                this._prevEnd = i + 1;
            }
        }
    }

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
};

Parser.prototype._flush = function(cb) {
    if (this._quoting || !this._prev) return cb();
    this._online(this._prev, this._prevEnd, this._prev.length + 1); // plus since online -1s
    cb();
};

Parser.prototype._online = function(buf, start, end) {
    end--; // trim newline
    if (buf.length && buf[end - 1] === cr) end--;

    var sep = this.separator,
        cells = [],
        inQuotes = false,
        offset = start;

    for (var i = start; i < end; i++) {
        if (buf[i] === quote) { // "
            if (i < end - 1 && buf[i + 1] === quote) { // ""
                i++;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }
        if (buf[i] === sep && !inQuotes) {
            cells.push(this._oncell(buf, offset, i));
            offset = i + 1;
        }
    }

    if (!this.version) {
        return;
    }

    if (this._first && cells.length === 0 && this.separator !== comma) {
        // probs the wrong separator, try comma
        this.separator = comma;
        this._online(buf,start,end);
        return;
    }
    else if (this._first && cells.length === 0) {
        this.emit('error', new Error('Cannot parse header row'));
        this.version = null;
        return;
    }

    if (offset < end) cells.push(this._oncell(buf, offset, end));
    if (buf[end - 1] === sep) cells.push(this._empty);

    if (this._first) {
        this._first = false;
        this.version = cells[2];
    }

    var _Row = this._compile(cells[0],this.version);

    if (this.headers && cells.length !== this.headers.length) {
        for (var num = cells.length; num <= this.headers.length; num++) {
            cells.push(this._empty);
        }
    }

    if (_Row) {
        this._emit(_Row, cells);
    }
};

Parser.prototype._compile = function(type,version) {
    if (typeof type === 'undefined') {
        this.emit('error', new Error('Row type was undefined'));
        return;
    }

    type = type.toLowerCase();

    if (type in this._Rows && version in this._Rows[type]) {
        return this._Rows[type][this.version];
    }
    else if (!(type in this._Rows)) {
        this._Rows[type] = {};
    }

    this.headers = mappings.lookup(type,version);

    if (!this.headers) {
        this.emit('error', new Error('Couldn\'t find header mapping'));
        return null;
    }

    var Row = genfun()('function Row (cells) {');

    this.headers.forEach(function(cell, i) {
        Row('%s = cells[%d]', genobj('this', cell), i);
    });

    Row('}');

    var _Row = Row.toFunction();

    if (Object.defineProperty) {
        Object.defineProperty(_Row.prototype, 'headers', {
            enumerable: false,
            value: this.headers
        });
    } else {
        _Row.prototype.headers = this.headers;
    }

    this._Rows[type][this.version] = _Row;

    return _Row;
};

Parser.prototype._emit = function(Row, cells) {
    this.push(new Row(cells));
};

Parser.prototype._oncell = function(buf, start, end) {
    if (start === end) {
        return this._empty;
    }

    if (buf[start] === quote && buf[end - 1] === quote) {
        start++;
        end--;
    }

    if (start === end) {
        this._empty = '';
        return this._empty;
    }

    for (var i = start, y = start; i < end; i++) {
        if (buf[i] === quote && buf[i + 1] === quote) i++;
        if (y !== i) buf[y] = buf[i];
        y++;
    }

    return this._onvalue(buf, start, y);
};

Parser.prototype._onvalue = function(buf, start, end) {
    if (this._raw) return buf.slice(start, end);
    return buf.toString('utf-8', start, end);
};

module.exports = function(opts) {
    return new Parser(opts);
};
