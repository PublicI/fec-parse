(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
	typeof define === 'function' && define.amd ? define(factory) :
	(global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.FECParse = factory());
}(this, (function () { 'use strict';

	function getAugmentedNamespace(n) {
		if (n.__esModule) return n;
		var a = Object.defineProperty({}, '__esModule', {value: true});
		Object.keys(n).forEach(function (k) {
			var d = Object.getOwnPropertyDescriptor(n, k);
			Object.defineProperty(a, k, d.get ? d : {
				enumerable: true,
				get: function () {
					return n[k];
				}
			});
		});
		return a;
	}

	var global$1 = (typeof global !== "undefined" ? global :
	            typeof self !== "undefined" ? self :
	            typeof window !== "undefined" ? window : {});

	var lookup = [];
	var revLookup = [];
	var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array;
	var inited = false;
	function init () {
	  inited = true;
	  var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
	  for (var i = 0, len = code.length; i < len; ++i) {
	    lookup[i] = code[i];
	    revLookup[code.charCodeAt(i)] = i;
	  }

	  revLookup['-'.charCodeAt(0)] = 62;
	  revLookup['_'.charCodeAt(0)] = 63;
	}

	function toByteArray (b64) {
	  if (!inited) {
	    init();
	  }
	  var i, j, l, tmp, placeHolders, arr;
	  var len = b64.length;

	  if (len % 4 > 0) {
	    throw new Error('Invalid string. Length must be a multiple of 4')
	  }

	  // the number of equal signs (place holders)
	  // if there are two placeholders, than the two characters before it
	  // represent one byte
	  // if there is only one, then the three characters before it represent 2 bytes
	  // this is just a cheap hack to not do indexOf twice
	  placeHolders = b64[len - 2] === '=' ? 2 : b64[len - 1] === '=' ? 1 : 0;

	  // base64 is 4/3 + up to two characters of the original data
	  arr = new Arr(len * 3 / 4 - placeHolders);

	  // if there are placeholders, only get up to the last complete 4 chars
	  l = placeHolders > 0 ? len - 4 : len;

	  var L = 0;

	  for (i = 0, j = 0; i < l; i += 4, j += 3) {
	    tmp = (revLookup[b64.charCodeAt(i)] << 18) | (revLookup[b64.charCodeAt(i + 1)] << 12) | (revLookup[b64.charCodeAt(i + 2)] << 6) | revLookup[b64.charCodeAt(i + 3)];
	    arr[L++] = (tmp >> 16) & 0xFF;
	    arr[L++] = (tmp >> 8) & 0xFF;
	    arr[L++] = tmp & 0xFF;
	  }

	  if (placeHolders === 2) {
	    tmp = (revLookup[b64.charCodeAt(i)] << 2) | (revLookup[b64.charCodeAt(i + 1)] >> 4);
	    arr[L++] = tmp & 0xFF;
	  } else if (placeHolders === 1) {
	    tmp = (revLookup[b64.charCodeAt(i)] << 10) | (revLookup[b64.charCodeAt(i + 1)] << 4) | (revLookup[b64.charCodeAt(i + 2)] >> 2);
	    arr[L++] = (tmp >> 8) & 0xFF;
	    arr[L++] = tmp & 0xFF;
	  }

	  return arr
	}

	function tripletToBase64 (num) {
	  return lookup[num >> 18 & 0x3F] + lookup[num >> 12 & 0x3F] + lookup[num >> 6 & 0x3F] + lookup[num & 0x3F]
	}

	function encodeChunk (uint8, start, end) {
	  var tmp;
	  var output = [];
	  for (var i = start; i < end; i += 3) {
	    tmp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2]);
	    output.push(tripletToBase64(tmp));
	  }
	  return output.join('')
	}

	function fromByteArray (uint8) {
	  if (!inited) {
	    init();
	  }
	  var tmp;
	  var len = uint8.length;
	  var extraBytes = len % 3; // if we have 1 byte left, pad 2 bytes
	  var output = '';
	  var parts = [];
	  var maxChunkLength = 16383; // must be multiple of 3

	  // go through the array every three bytes, we'll deal with trailing stuff later
	  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
	    parts.push(encodeChunk(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)));
	  }

	  // pad the end with zeros, but make sure to not forget the extra bytes
	  if (extraBytes === 1) {
	    tmp = uint8[len - 1];
	    output += lookup[tmp >> 2];
	    output += lookup[(tmp << 4) & 0x3F];
	    output += '==';
	  } else if (extraBytes === 2) {
	    tmp = (uint8[len - 2] << 8) + (uint8[len - 1]);
	    output += lookup[tmp >> 10];
	    output += lookup[(tmp >> 4) & 0x3F];
	    output += lookup[(tmp << 2) & 0x3F];
	    output += '=';
	  }

	  parts.push(output);

	  return parts.join('')
	}

	function read (buffer, offset, isLE, mLen, nBytes) {
	  var e, m;
	  var eLen = nBytes * 8 - mLen - 1;
	  var eMax = (1 << eLen) - 1;
	  var eBias = eMax >> 1;
	  var nBits = -7;
	  var i = isLE ? (nBytes - 1) : 0;
	  var d = isLE ? -1 : 1;
	  var s = buffer[offset + i];

	  i += d;

	  e = s & ((1 << (-nBits)) - 1);
	  s >>= (-nBits);
	  nBits += eLen;
	  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

	  m = e & ((1 << (-nBits)) - 1);
	  e >>= (-nBits);
	  nBits += mLen;
	  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

	  if (e === 0) {
	    e = 1 - eBias;
	  } else if (e === eMax) {
	    return m ? NaN : ((s ? -1 : 1) * Infinity)
	  } else {
	    m = m + Math.pow(2, mLen);
	    e = e - eBias;
	  }
	  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
	}

	function write (buffer, value, offset, isLE, mLen, nBytes) {
	  var e, m, c;
	  var eLen = nBytes * 8 - mLen - 1;
	  var eMax = (1 << eLen) - 1;
	  var eBias = eMax >> 1;
	  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0);
	  var i = isLE ? 0 : (nBytes - 1);
	  var d = isLE ? 1 : -1;
	  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0;

	  value = Math.abs(value);

	  if (isNaN(value) || value === Infinity) {
	    m = isNaN(value) ? 1 : 0;
	    e = eMax;
	  } else {
	    e = Math.floor(Math.log(value) / Math.LN2);
	    if (value * (c = Math.pow(2, -e)) < 1) {
	      e--;
	      c *= 2;
	    }
	    if (e + eBias >= 1) {
	      value += rt / c;
	    } else {
	      value += rt * Math.pow(2, 1 - eBias);
	    }
	    if (value * c >= 2) {
	      e++;
	      c /= 2;
	    }

	    if (e + eBias >= eMax) {
	      m = 0;
	      e = eMax;
	    } else if (e + eBias >= 1) {
	      m = (value * c - 1) * Math.pow(2, mLen);
	      e = e + eBias;
	    } else {
	      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
	      e = 0;
	    }
	  }

	  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

	  e = (e << mLen) | m;
	  eLen += mLen;
	  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

	  buffer[offset + i - d] |= s * 128;
	}

	var toString = {}.toString;

	var isArray$1 = Array.isArray || function (arr) {
	  return toString.call(arr) == '[object Array]';
	};

	var INSPECT_MAX_BYTES = 50;

	/**
	 * If `Buffer.TYPED_ARRAY_SUPPORT`:
	 *   === true    Use Uint8Array implementation (fastest)
	 *   === false   Use Object implementation (most compatible, even IE6)
	 *
	 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
	 * Opera 11.6+, iOS 4.2+.
	 *
	 * Due to various browser bugs, sometimes the Object implementation will be used even
	 * when the browser supports typed arrays.
	 *
	 * Note:
	 *
	 *   - Firefox 4-29 lacks support for adding new properties to `Uint8Array` instances,
	 *     See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
	 *
	 *   - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
	 *
	 *   - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
	 *     incorrect length in some situations.

	 * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they
	 * get the Object implementation, which is slower but behaves correctly.
	 */
	Buffer.TYPED_ARRAY_SUPPORT = global$1.TYPED_ARRAY_SUPPORT !== undefined
	  ? global$1.TYPED_ARRAY_SUPPORT
	  : true;

	function kMaxLength () {
	  return Buffer.TYPED_ARRAY_SUPPORT
	    ? 0x7fffffff
	    : 0x3fffffff
	}

	function createBuffer (that, length) {
	  if (kMaxLength() < length) {
	    throw new RangeError('Invalid typed array length')
	  }
	  if (Buffer.TYPED_ARRAY_SUPPORT) {
	    // Return an augmented `Uint8Array` instance, for best performance
	    that = new Uint8Array(length);
	    that.__proto__ = Buffer.prototype;
	  } else {
	    // Fallback: Return an object instance of the Buffer class
	    if (that === null) {
	      that = new Buffer(length);
	    }
	    that.length = length;
	  }

	  return that
	}

	/**
	 * The Buffer constructor returns instances of `Uint8Array` that have their
	 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
	 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
	 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
	 * returns a single octet.
	 *
	 * The `Uint8Array` prototype remains unmodified.
	 */

	function Buffer (arg, encodingOrOffset, length) {
	  if (!Buffer.TYPED_ARRAY_SUPPORT && !(this instanceof Buffer)) {
	    return new Buffer(arg, encodingOrOffset, length)
	  }

	  // Common case.
	  if (typeof arg === 'number') {
	    if (typeof encodingOrOffset === 'string') {
	      throw new Error(
	        'If encoding is specified then the first argument must be a string'
	      )
	    }
	    return allocUnsafe(this, arg)
	  }
	  return from(this, arg, encodingOrOffset, length)
	}

	Buffer.poolSize = 8192; // not used by this implementation

	// TODO: Legacy, not needed anymore. Remove in next major version.
	Buffer._augment = function (arr) {
	  arr.__proto__ = Buffer.prototype;
	  return arr
	};

	function from (that, value, encodingOrOffset, length) {
	  if (typeof value === 'number') {
	    throw new TypeError('"value" argument must not be a number')
	  }

	  if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) {
	    return fromArrayBuffer(that, value, encodingOrOffset, length)
	  }

	  if (typeof value === 'string') {
	    return fromString(that, value, encodingOrOffset)
	  }

	  return fromObject(that, value)
	}

	/**
	 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
	 * if value is a number.
	 * Buffer.from(str[, encoding])
	 * Buffer.from(array)
	 * Buffer.from(buffer)
	 * Buffer.from(arrayBuffer[, byteOffset[, length]])
	 **/
	Buffer.from = function (value, encodingOrOffset, length) {
	  return from(null, value, encodingOrOffset, length)
	};

	if (Buffer.TYPED_ARRAY_SUPPORT) {
	  Buffer.prototype.__proto__ = Uint8Array.prototype;
	  Buffer.__proto__ = Uint8Array;
	}

	function assertSize (size) {
	  if (typeof size !== 'number') {
	    throw new TypeError('"size" argument must be a number')
	  } else if (size < 0) {
	    throw new RangeError('"size" argument must not be negative')
	  }
	}

	function alloc (that, size, fill, encoding) {
	  assertSize(size);
	  if (size <= 0) {
	    return createBuffer(that, size)
	  }
	  if (fill !== undefined) {
	    // Only pay attention to encoding if it's a string. This
	    // prevents accidentally sending in a number that would
	    // be interpretted as a start offset.
	    return typeof encoding === 'string'
	      ? createBuffer(that, size).fill(fill, encoding)
	      : createBuffer(that, size).fill(fill)
	  }
	  return createBuffer(that, size)
	}

	/**
	 * Creates a new filled Buffer instance.
	 * alloc(size[, fill[, encoding]])
	 **/
	Buffer.alloc = function (size, fill, encoding) {
	  return alloc(null, size, fill, encoding)
	};

	function allocUnsafe (that, size) {
	  assertSize(size);
	  that = createBuffer(that, size < 0 ? 0 : checked(size) | 0);
	  if (!Buffer.TYPED_ARRAY_SUPPORT) {
	    for (var i = 0; i < size; ++i) {
	      that[i] = 0;
	    }
	  }
	  return that
	}

	/**
	 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
	 * */
	Buffer.allocUnsafe = function (size) {
	  return allocUnsafe(null, size)
	};
	/**
	 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
	 */
	Buffer.allocUnsafeSlow = function (size) {
	  return allocUnsafe(null, size)
	};

	function fromString (that, string, encoding) {
	  if (typeof encoding !== 'string' || encoding === '') {
	    encoding = 'utf8';
	  }

	  if (!Buffer.isEncoding(encoding)) {
	    throw new TypeError('"encoding" must be a valid string encoding')
	  }

	  var length = byteLength(string, encoding) | 0;
	  that = createBuffer(that, length);

	  var actual = that.write(string, encoding);

	  if (actual !== length) {
	    // Writing a hex string, for example, that contains invalid characters will
	    // cause everything after the first invalid character to be ignored. (e.g.
	    // 'abxxcd' will be treated as 'ab')
	    that = that.slice(0, actual);
	  }

	  return that
	}

	function fromArrayLike (that, array) {
	  var length = array.length < 0 ? 0 : checked(array.length) | 0;
	  that = createBuffer(that, length);
	  for (var i = 0; i < length; i += 1) {
	    that[i] = array[i] & 255;
	  }
	  return that
	}

	function fromArrayBuffer (that, array, byteOffset, length) {
	  array.byteLength; // this throws if `array` is not a valid ArrayBuffer

	  if (byteOffset < 0 || array.byteLength < byteOffset) {
	    throw new RangeError('\'offset\' is out of bounds')
	  }

	  if (array.byteLength < byteOffset + (length || 0)) {
	    throw new RangeError('\'length\' is out of bounds')
	  }

	  if (byteOffset === undefined && length === undefined) {
	    array = new Uint8Array(array);
	  } else if (length === undefined) {
	    array = new Uint8Array(array, byteOffset);
	  } else {
	    array = new Uint8Array(array, byteOffset, length);
	  }

	  if (Buffer.TYPED_ARRAY_SUPPORT) {
	    // Return an augmented `Uint8Array` instance, for best performance
	    that = array;
	    that.__proto__ = Buffer.prototype;
	  } else {
	    // Fallback: Return an object instance of the Buffer class
	    that = fromArrayLike(that, array);
	  }
	  return that
	}

	function fromObject (that, obj) {
	  if (internalIsBuffer(obj)) {
	    var len = checked(obj.length) | 0;
	    that = createBuffer(that, len);

	    if (that.length === 0) {
	      return that
	    }

	    obj.copy(that, 0, 0, len);
	    return that
	  }

	  if (obj) {
	    if ((typeof ArrayBuffer !== 'undefined' &&
	        obj.buffer instanceof ArrayBuffer) || 'length' in obj) {
	      if (typeof obj.length !== 'number' || isnan(obj.length)) {
	        return createBuffer(that, 0)
	      }
	      return fromArrayLike(that, obj)
	    }

	    if (obj.type === 'Buffer' && isArray$1(obj.data)) {
	      return fromArrayLike(that, obj.data)
	    }
	  }

	  throw new TypeError('First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object.')
	}

	function checked (length) {
	  // Note: cannot use `length < kMaxLength()` here because that fails when
	  // length is NaN (which is otherwise coerced to zero.)
	  if (length >= kMaxLength()) {
	    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
	                         'size: 0x' + kMaxLength().toString(16) + ' bytes')
	  }
	  return length | 0
	}
	Buffer.isBuffer = isBuffer$1;
	function internalIsBuffer (b) {
	  return !!(b != null && b._isBuffer)
	}

	Buffer.compare = function compare (a, b) {
	  if (!internalIsBuffer(a) || !internalIsBuffer(b)) {
	    throw new TypeError('Arguments must be Buffers')
	  }

	  if (a === b) return 0

	  var x = a.length;
	  var y = b.length;

	  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
	    if (a[i] !== b[i]) {
	      x = a[i];
	      y = b[i];
	      break
	    }
	  }

	  if (x < y) return -1
	  if (y < x) return 1
	  return 0
	};

	Buffer.isEncoding = function isEncoding (encoding) {
	  switch (String(encoding).toLowerCase()) {
	    case 'hex':
	    case 'utf8':
	    case 'utf-8':
	    case 'ascii':
	    case 'latin1':
	    case 'binary':
	    case 'base64':
	    case 'ucs2':
	    case 'ucs-2':
	    case 'utf16le':
	    case 'utf-16le':
	      return true
	    default:
	      return false
	  }
	};

	Buffer.concat = function concat (list, length) {
	  if (!isArray$1(list)) {
	    throw new TypeError('"list" argument must be an Array of Buffers')
	  }

	  if (list.length === 0) {
	    return Buffer.alloc(0)
	  }

	  var i;
	  if (length === undefined) {
	    length = 0;
	    for (i = 0; i < list.length; ++i) {
	      length += list[i].length;
	    }
	  }

	  var buffer = Buffer.allocUnsafe(length);
	  var pos = 0;
	  for (i = 0; i < list.length; ++i) {
	    var buf = list[i];
	    if (!internalIsBuffer(buf)) {
	      throw new TypeError('"list" argument must be an Array of Buffers')
	    }
	    buf.copy(buffer, pos);
	    pos += buf.length;
	  }
	  return buffer
	};

	function byteLength (string, encoding) {
	  if (internalIsBuffer(string)) {
	    return string.length
	  }
	  if (typeof ArrayBuffer !== 'undefined' && typeof ArrayBuffer.isView === 'function' &&
	      (ArrayBuffer.isView(string) || string instanceof ArrayBuffer)) {
	    return string.byteLength
	  }
	  if (typeof string !== 'string') {
	    string = '' + string;
	  }

	  var len = string.length;
	  if (len === 0) return 0

	  // Use a for loop to avoid recursion
	  var loweredCase = false;
	  for (;;) {
	    switch (encoding) {
	      case 'ascii':
	      case 'latin1':
	      case 'binary':
	        return len
	      case 'utf8':
	      case 'utf-8':
	      case undefined:
	        return utf8ToBytes(string).length
	      case 'ucs2':
	      case 'ucs-2':
	      case 'utf16le':
	      case 'utf-16le':
	        return len * 2
	      case 'hex':
	        return len >>> 1
	      case 'base64':
	        return base64ToBytes(string).length
	      default:
	        if (loweredCase) return utf8ToBytes(string).length // assume utf8
	        encoding = ('' + encoding).toLowerCase();
	        loweredCase = true;
	    }
	  }
	}
	Buffer.byteLength = byteLength;

	function slowToString (encoding, start, end) {
	  var loweredCase = false;

	  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
	  // property of a typed array.

	  // This behaves neither like String nor Uint8Array in that we set start/end
	  // to their upper/lower bounds if the value passed is out of range.
	  // undefined is handled specially as per ECMA-262 6th Edition,
	  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
	  if (start === undefined || start < 0) {
	    start = 0;
	  }
	  // Return early if start > this.length. Done here to prevent potential uint32
	  // coercion fail below.
	  if (start > this.length) {
	    return ''
	  }

	  if (end === undefined || end > this.length) {
	    end = this.length;
	  }

	  if (end <= 0) {
	    return ''
	  }

	  // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
	  end >>>= 0;
	  start >>>= 0;

	  if (end <= start) {
	    return ''
	  }

	  if (!encoding) encoding = 'utf8';

	  while (true) {
	    switch (encoding) {
	      case 'hex':
	        return hexSlice(this, start, end)

	      case 'utf8':
	      case 'utf-8':
	        return utf8Slice(this, start, end)

	      case 'ascii':
	        return asciiSlice(this, start, end)

	      case 'latin1':
	      case 'binary':
	        return latin1Slice(this, start, end)

	      case 'base64':
	        return base64Slice(this, start, end)

	      case 'ucs2':
	      case 'ucs-2':
	      case 'utf16le':
	      case 'utf-16le':
	        return utf16leSlice(this, start, end)

	      default:
	        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
	        encoding = (encoding + '').toLowerCase();
	        loweredCase = true;
	    }
	  }
	}

	// The property is used by `Buffer.isBuffer` and `is-buffer` (in Safari 5-7) to detect
	// Buffer instances.
	Buffer.prototype._isBuffer = true;

	function swap (b, n, m) {
	  var i = b[n];
	  b[n] = b[m];
	  b[m] = i;
	}

	Buffer.prototype.swap16 = function swap16 () {
	  var len = this.length;
	  if (len % 2 !== 0) {
	    throw new RangeError('Buffer size must be a multiple of 16-bits')
	  }
	  for (var i = 0; i < len; i += 2) {
	    swap(this, i, i + 1);
	  }
	  return this
	};

	Buffer.prototype.swap32 = function swap32 () {
	  var len = this.length;
	  if (len % 4 !== 0) {
	    throw new RangeError('Buffer size must be a multiple of 32-bits')
	  }
	  for (var i = 0; i < len; i += 4) {
	    swap(this, i, i + 3);
	    swap(this, i + 1, i + 2);
	  }
	  return this
	};

	Buffer.prototype.swap64 = function swap64 () {
	  var len = this.length;
	  if (len % 8 !== 0) {
	    throw new RangeError('Buffer size must be a multiple of 64-bits')
	  }
	  for (var i = 0; i < len; i += 8) {
	    swap(this, i, i + 7);
	    swap(this, i + 1, i + 6);
	    swap(this, i + 2, i + 5);
	    swap(this, i + 3, i + 4);
	  }
	  return this
	};

	Buffer.prototype.toString = function toString () {
	  var length = this.length | 0;
	  if (length === 0) return ''
	  if (arguments.length === 0) return utf8Slice(this, 0, length)
	  return slowToString.apply(this, arguments)
	};

	Buffer.prototype.equals = function equals (b) {
	  if (!internalIsBuffer(b)) throw new TypeError('Argument must be a Buffer')
	  if (this === b) return true
	  return Buffer.compare(this, b) === 0
	};

	Buffer.prototype.inspect = function inspect () {
	  var str = '';
	  var max = INSPECT_MAX_BYTES;
	  if (this.length > 0) {
	    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ');
	    if (this.length > max) str += ' ... ';
	  }
	  return '<Buffer ' + str + '>'
	};

	Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
	  if (!internalIsBuffer(target)) {
	    throw new TypeError('Argument must be a Buffer')
	  }

	  if (start === undefined) {
	    start = 0;
	  }
	  if (end === undefined) {
	    end = target ? target.length : 0;
	  }
	  if (thisStart === undefined) {
	    thisStart = 0;
	  }
	  if (thisEnd === undefined) {
	    thisEnd = this.length;
	  }

	  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
	    throw new RangeError('out of range index')
	  }

	  if (thisStart >= thisEnd && start >= end) {
	    return 0
	  }
	  if (thisStart >= thisEnd) {
	    return -1
	  }
	  if (start >= end) {
	    return 1
	  }

	  start >>>= 0;
	  end >>>= 0;
	  thisStart >>>= 0;
	  thisEnd >>>= 0;

	  if (this === target) return 0

	  var x = thisEnd - thisStart;
	  var y = end - start;
	  var len = Math.min(x, y);

	  var thisCopy = this.slice(thisStart, thisEnd);
	  var targetCopy = target.slice(start, end);

	  for (var i = 0; i < len; ++i) {
	    if (thisCopy[i] !== targetCopy[i]) {
	      x = thisCopy[i];
	      y = targetCopy[i];
	      break
	    }
	  }

	  if (x < y) return -1
	  if (y < x) return 1
	  return 0
	};

	// Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
	// OR the last index of `val` in `buffer` at offset <= `byteOffset`.
	//
	// Arguments:
	// - buffer - a Buffer to search
	// - val - a string, Buffer, or number
	// - byteOffset - an index into `buffer`; will be clamped to an int32
	// - encoding - an optional encoding, relevant is val is a string
	// - dir - true for indexOf, false for lastIndexOf
	function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
	  // Empty buffer means no match
	  if (buffer.length === 0) return -1

	  // Normalize byteOffset
	  if (typeof byteOffset === 'string') {
	    encoding = byteOffset;
	    byteOffset = 0;
	  } else if (byteOffset > 0x7fffffff) {
	    byteOffset = 0x7fffffff;
	  } else if (byteOffset < -0x80000000) {
	    byteOffset = -0x80000000;
	  }
	  byteOffset = +byteOffset;  // Coerce to Number.
	  if (isNaN(byteOffset)) {
	    // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
	    byteOffset = dir ? 0 : (buffer.length - 1);
	  }

	  // Normalize byteOffset: negative offsets start from the end of the buffer
	  if (byteOffset < 0) byteOffset = buffer.length + byteOffset;
	  if (byteOffset >= buffer.length) {
	    if (dir) return -1
	    else byteOffset = buffer.length - 1;
	  } else if (byteOffset < 0) {
	    if (dir) byteOffset = 0;
	    else return -1
	  }

	  // Normalize val
	  if (typeof val === 'string') {
	    val = Buffer.from(val, encoding);
	  }

	  // Finally, search either indexOf (if dir is true) or lastIndexOf
	  if (internalIsBuffer(val)) {
	    // Special case: looking for empty string/buffer always fails
	    if (val.length === 0) {
	      return -1
	    }
	    return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
	  } else if (typeof val === 'number') {
	    val = val & 0xFF; // Search for a byte value [0-255]
	    if (Buffer.TYPED_ARRAY_SUPPORT &&
	        typeof Uint8Array.prototype.indexOf === 'function') {
	      if (dir) {
	        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
	      } else {
	        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
	      }
	    }
	    return arrayIndexOf(buffer, [ val ], byteOffset, encoding, dir)
	  }

	  throw new TypeError('val must be string, number or Buffer')
	}

	function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
	  var indexSize = 1;
	  var arrLength = arr.length;
	  var valLength = val.length;

	  if (encoding !== undefined) {
	    encoding = String(encoding).toLowerCase();
	    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
	        encoding === 'utf16le' || encoding === 'utf-16le') {
	      if (arr.length < 2 || val.length < 2) {
	        return -1
	      }
	      indexSize = 2;
	      arrLength /= 2;
	      valLength /= 2;
	      byteOffset /= 2;
	    }
	  }

	  function read (buf, i) {
	    if (indexSize === 1) {
	      return buf[i]
	    } else {
	      return buf.readUInt16BE(i * indexSize)
	    }
	  }

	  var i;
	  if (dir) {
	    var foundIndex = -1;
	    for (i = byteOffset; i < arrLength; i++) {
	      if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
	        if (foundIndex === -1) foundIndex = i;
	        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
	      } else {
	        if (foundIndex !== -1) i -= i - foundIndex;
	        foundIndex = -1;
	      }
	    }
	  } else {
	    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength;
	    for (i = byteOffset; i >= 0; i--) {
	      var found = true;
	      for (var j = 0; j < valLength; j++) {
	        if (read(arr, i + j) !== read(val, j)) {
	          found = false;
	          break
	        }
	      }
	      if (found) return i
	    }
	  }

	  return -1
	}

	Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
	  return this.indexOf(val, byteOffset, encoding) !== -1
	};

	Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
	  return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
	};

	Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
	  return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
	};

	function hexWrite (buf, string, offset, length) {
	  offset = Number(offset) || 0;
	  var remaining = buf.length - offset;
	  if (!length) {
	    length = remaining;
	  } else {
	    length = Number(length);
	    if (length > remaining) {
	      length = remaining;
	    }
	  }

	  // must be an even number of digits
	  var strLen = string.length;
	  if (strLen % 2 !== 0) throw new TypeError('Invalid hex string')

	  if (length > strLen / 2) {
	    length = strLen / 2;
	  }
	  for (var i = 0; i < length; ++i) {
	    var parsed = parseInt(string.substr(i * 2, 2), 16);
	    if (isNaN(parsed)) return i
	    buf[offset + i] = parsed;
	  }
	  return i
	}

	function utf8Write (buf, string, offset, length) {
	  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
	}

	function asciiWrite (buf, string, offset, length) {
	  return blitBuffer(asciiToBytes(string), buf, offset, length)
	}

	function latin1Write (buf, string, offset, length) {
	  return asciiWrite(buf, string, offset, length)
	}

	function base64Write (buf, string, offset, length) {
	  return blitBuffer(base64ToBytes(string), buf, offset, length)
	}

	function ucs2Write (buf, string, offset, length) {
	  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
	}

	Buffer.prototype.write = function write (string, offset, length, encoding) {
	  // Buffer#write(string)
	  if (offset === undefined) {
	    encoding = 'utf8';
	    length = this.length;
	    offset = 0;
	  // Buffer#write(string, encoding)
	  } else if (length === undefined && typeof offset === 'string') {
	    encoding = offset;
	    length = this.length;
	    offset = 0;
	  // Buffer#write(string, offset[, length][, encoding])
	  } else if (isFinite(offset)) {
	    offset = offset | 0;
	    if (isFinite(length)) {
	      length = length | 0;
	      if (encoding === undefined) encoding = 'utf8';
	    } else {
	      encoding = length;
	      length = undefined;
	    }
	  // legacy write(string, encoding, offset, length) - remove in v0.13
	  } else {
	    throw new Error(
	      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
	    )
	  }

	  var remaining = this.length - offset;
	  if (length === undefined || length > remaining) length = remaining;

	  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
	    throw new RangeError('Attempt to write outside buffer bounds')
	  }

	  if (!encoding) encoding = 'utf8';

	  var loweredCase = false;
	  for (;;) {
	    switch (encoding) {
	      case 'hex':
	        return hexWrite(this, string, offset, length)

	      case 'utf8':
	      case 'utf-8':
	        return utf8Write(this, string, offset, length)

	      case 'ascii':
	        return asciiWrite(this, string, offset, length)

	      case 'latin1':
	      case 'binary':
	        return latin1Write(this, string, offset, length)

	      case 'base64':
	        // Warning: maxLength not taken into account in base64Write
	        return base64Write(this, string, offset, length)

	      case 'ucs2':
	      case 'ucs-2':
	      case 'utf16le':
	      case 'utf-16le':
	        return ucs2Write(this, string, offset, length)

	      default:
	        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
	        encoding = ('' + encoding).toLowerCase();
	        loweredCase = true;
	    }
	  }
	};

	Buffer.prototype.toJSON = function toJSON () {
	  return {
	    type: 'Buffer',
	    data: Array.prototype.slice.call(this._arr || this, 0)
	  }
	};

	function base64Slice (buf, start, end) {
	  if (start === 0 && end === buf.length) {
	    return fromByteArray(buf)
	  } else {
	    return fromByteArray(buf.slice(start, end))
	  }
	}

	function utf8Slice (buf, start, end) {
	  end = Math.min(buf.length, end);
	  var res = [];

	  var i = start;
	  while (i < end) {
	    var firstByte = buf[i];
	    var codePoint = null;
	    var bytesPerSequence = (firstByte > 0xEF) ? 4
	      : (firstByte > 0xDF) ? 3
	      : (firstByte > 0xBF) ? 2
	      : 1;

	    if (i + bytesPerSequence <= end) {
	      var secondByte, thirdByte, fourthByte, tempCodePoint;

	      switch (bytesPerSequence) {
	        case 1:
	          if (firstByte < 0x80) {
	            codePoint = firstByte;
	          }
	          break
	        case 2:
	          secondByte = buf[i + 1];
	          if ((secondByte & 0xC0) === 0x80) {
	            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F);
	            if (tempCodePoint > 0x7F) {
	              codePoint = tempCodePoint;
	            }
	          }
	          break
	        case 3:
	          secondByte = buf[i + 1];
	          thirdByte = buf[i + 2];
	          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
	            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F);
	            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
	              codePoint = tempCodePoint;
	            }
	          }
	          break
	        case 4:
	          secondByte = buf[i + 1];
	          thirdByte = buf[i + 2];
	          fourthByte = buf[i + 3];
	          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
	            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F);
	            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
	              codePoint = tempCodePoint;
	            }
	          }
	      }
	    }

	    if (codePoint === null) {
	      // we did not generate a valid codePoint so insert a
	      // replacement char (U+FFFD) and advance only 1 byte
	      codePoint = 0xFFFD;
	      bytesPerSequence = 1;
	    } else if (codePoint > 0xFFFF) {
	      // encode to utf16 (surrogate pair dance)
	      codePoint -= 0x10000;
	      res.push(codePoint >>> 10 & 0x3FF | 0xD800);
	      codePoint = 0xDC00 | codePoint & 0x3FF;
	    }

	    res.push(codePoint);
	    i += bytesPerSequence;
	  }

	  return decodeCodePointsArray(res)
	}

	// Based on http://stackoverflow.com/a/22747272/680742, the browser with
	// the lowest limit is Chrome, with 0x10000 args.
	// We go 1 magnitude less, for safety
	var MAX_ARGUMENTS_LENGTH = 0x1000;

	function decodeCodePointsArray (codePoints) {
	  var len = codePoints.length;
	  if (len <= MAX_ARGUMENTS_LENGTH) {
	    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
	  }

	  // Decode in chunks to avoid "call stack size exceeded".
	  var res = '';
	  var i = 0;
	  while (i < len) {
	    res += String.fromCharCode.apply(
	      String,
	      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
	    );
	  }
	  return res
	}

	function asciiSlice (buf, start, end) {
	  var ret = '';
	  end = Math.min(buf.length, end);

	  for (var i = start; i < end; ++i) {
	    ret += String.fromCharCode(buf[i] & 0x7F);
	  }
	  return ret
	}

	function latin1Slice (buf, start, end) {
	  var ret = '';
	  end = Math.min(buf.length, end);

	  for (var i = start; i < end; ++i) {
	    ret += String.fromCharCode(buf[i]);
	  }
	  return ret
	}

	function hexSlice (buf, start, end) {
	  var len = buf.length;

	  if (!start || start < 0) start = 0;
	  if (!end || end < 0 || end > len) end = len;

	  var out = '';
	  for (var i = start; i < end; ++i) {
	    out += toHex(buf[i]);
	  }
	  return out
	}

	function utf16leSlice (buf, start, end) {
	  var bytes = buf.slice(start, end);
	  var res = '';
	  for (var i = 0; i < bytes.length; i += 2) {
	    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256);
	  }
	  return res
	}

	Buffer.prototype.slice = function slice (start, end) {
	  var len = this.length;
	  start = ~~start;
	  end = end === undefined ? len : ~~end;

	  if (start < 0) {
	    start += len;
	    if (start < 0) start = 0;
	  } else if (start > len) {
	    start = len;
	  }

	  if (end < 0) {
	    end += len;
	    if (end < 0) end = 0;
	  } else if (end > len) {
	    end = len;
	  }

	  if (end < start) end = start;

	  var newBuf;
	  if (Buffer.TYPED_ARRAY_SUPPORT) {
	    newBuf = this.subarray(start, end);
	    newBuf.__proto__ = Buffer.prototype;
	  } else {
	    var sliceLen = end - start;
	    newBuf = new Buffer(sliceLen, undefined);
	    for (var i = 0; i < sliceLen; ++i) {
	      newBuf[i] = this[i + start];
	    }
	  }

	  return newBuf
	};

	/*
	 * Need to make sure that buffer isn't trying to write out of bounds.
	 */
	function checkOffset (offset, ext, length) {
	  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
	  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
	}

	Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
	  offset = offset | 0;
	  byteLength = byteLength | 0;
	  if (!noAssert) checkOffset(offset, byteLength, this.length);

	  var val = this[offset];
	  var mul = 1;
	  var i = 0;
	  while (++i < byteLength && (mul *= 0x100)) {
	    val += this[offset + i] * mul;
	  }

	  return val
	};

	Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
	  offset = offset | 0;
	  byteLength = byteLength | 0;
	  if (!noAssert) {
	    checkOffset(offset, byteLength, this.length);
	  }

	  var val = this[offset + --byteLength];
	  var mul = 1;
	  while (byteLength > 0 && (mul *= 0x100)) {
	    val += this[offset + --byteLength] * mul;
	  }

	  return val
	};

	Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
	  if (!noAssert) checkOffset(offset, 1, this.length);
	  return this[offset]
	};

	Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
	  if (!noAssert) checkOffset(offset, 2, this.length);
	  return this[offset] | (this[offset + 1] << 8)
	};

	Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
	  if (!noAssert) checkOffset(offset, 2, this.length);
	  return (this[offset] << 8) | this[offset + 1]
	};

	Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
	  if (!noAssert) checkOffset(offset, 4, this.length);

	  return ((this[offset]) |
	      (this[offset + 1] << 8) |
	      (this[offset + 2] << 16)) +
	      (this[offset + 3] * 0x1000000)
	};

	Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
	  if (!noAssert) checkOffset(offset, 4, this.length);

	  return (this[offset] * 0x1000000) +
	    ((this[offset + 1] << 16) |
	    (this[offset + 2] << 8) |
	    this[offset + 3])
	};

	Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
	  offset = offset | 0;
	  byteLength = byteLength | 0;
	  if (!noAssert) checkOffset(offset, byteLength, this.length);

	  var val = this[offset];
	  var mul = 1;
	  var i = 0;
	  while (++i < byteLength && (mul *= 0x100)) {
	    val += this[offset + i] * mul;
	  }
	  mul *= 0x80;

	  if (val >= mul) val -= Math.pow(2, 8 * byteLength);

	  return val
	};

	Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
	  offset = offset | 0;
	  byteLength = byteLength | 0;
	  if (!noAssert) checkOffset(offset, byteLength, this.length);

	  var i = byteLength;
	  var mul = 1;
	  var val = this[offset + --i];
	  while (i > 0 && (mul *= 0x100)) {
	    val += this[offset + --i] * mul;
	  }
	  mul *= 0x80;

	  if (val >= mul) val -= Math.pow(2, 8 * byteLength);

	  return val
	};

	Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
	  if (!noAssert) checkOffset(offset, 1, this.length);
	  if (!(this[offset] & 0x80)) return (this[offset])
	  return ((0xff - this[offset] + 1) * -1)
	};

	Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
	  if (!noAssert) checkOffset(offset, 2, this.length);
	  var val = this[offset] | (this[offset + 1] << 8);
	  return (val & 0x8000) ? val | 0xFFFF0000 : val
	};

	Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
	  if (!noAssert) checkOffset(offset, 2, this.length);
	  var val = this[offset + 1] | (this[offset] << 8);
	  return (val & 0x8000) ? val | 0xFFFF0000 : val
	};

	Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
	  if (!noAssert) checkOffset(offset, 4, this.length);

	  return (this[offset]) |
	    (this[offset + 1] << 8) |
	    (this[offset + 2] << 16) |
	    (this[offset + 3] << 24)
	};

	Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
	  if (!noAssert) checkOffset(offset, 4, this.length);

	  return (this[offset] << 24) |
	    (this[offset + 1] << 16) |
	    (this[offset + 2] << 8) |
	    (this[offset + 3])
	};

	Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
	  if (!noAssert) checkOffset(offset, 4, this.length);
	  return read(this, offset, true, 23, 4)
	};

	Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
	  if (!noAssert) checkOffset(offset, 4, this.length);
	  return read(this, offset, false, 23, 4)
	};

	Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
	  if (!noAssert) checkOffset(offset, 8, this.length);
	  return read(this, offset, true, 52, 8)
	};

	Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
	  if (!noAssert) checkOffset(offset, 8, this.length);
	  return read(this, offset, false, 52, 8)
	};

	function checkInt (buf, value, offset, ext, max, min) {
	  if (!internalIsBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
	  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
	  if (offset + ext > buf.length) throw new RangeError('Index out of range')
	}

	Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
	  value = +value;
	  offset = offset | 0;
	  byteLength = byteLength | 0;
	  if (!noAssert) {
	    var maxBytes = Math.pow(2, 8 * byteLength) - 1;
	    checkInt(this, value, offset, byteLength, maxBytes, 0);
	  }

	  var mul = 1;
	  var i = 0;
	  this[offset] = value & 0xFF;
	  while (++i < byteLength && (mul *= 0x100)) {
	    this[offset + i] = (value / mul) & 0xFF;
	  }

	  return offset + byteLength
	};

	Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
	  value = +value;
	  offset = offset | 0;
	  byteLength = byteLength | 0;
	  if (!noAssert) {
	    var maxBytes = Math.pow(2, 8 * byteLength) - 1;
	    checkInt(this, value, offset, byteLength, maxBytes, 0);
	  }

	  var i = byteLength - 1;
	  var mul = 1;
	  this[offset + i] = value & 0xFF;
	  while (--i >= 0 && (mul *= 0x100)) {
	    this[offset + i] = (value / mul) & 0xFF;
	  }

	  return offset + byteLength
	};

	Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
	  value = +value;
	  offset = offset | 0;
	  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0);
	  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value);
	  this[offset] = (value & 0xff);
	  return offset + 1
	};

	function objectWriteUInt16 (buf, value, offset, littleEndian) {
	  if (value < 0) value = 0xffff + value + 1;
	  for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; ++i) {
	    buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
	      (littleEndian ? i : 1 - i) * 8;
	  }
	}

	Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
	  value = +value;
	  offset = offset | 0;
	  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0);
	  if (Buffer.TYPED_ARRAY_SUPPORT) {
	    this[offset] = (value & 0xff);
	    this[offset + 1] = (value >>> 8);
	  } else {
	    objectWriteUInt16(this, value, offset, true);
	  }
	  return offset + 2
	};

	Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
	  value = +value;
	  offset = offset | 0;
	  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0);
	  if (Buffer.TYPED_ARRAY_SUPPORT) {
	    this[offset] = (value >>> 8);
	    this[offset + 1] = (value & 0xff);
	  } else {
	    objectWriteUInt16(this, value, offset, false);
	  }
	  return offset + 2
	};

	function objectWriteUInt32 (buf, value, offset, littleEndian) {
	  if (value < 0) value = 0xffffffff + value + 1;
	  for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; ++i) {
	    buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff;
	  }
	}

	Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
	  value = +value;
	  offset = offset | 0;
	  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0);
	  if (Buffer.TYPED_ARRAY_SUPPORT) {
	    this[offset + 3] = (value >>> 24);
	    this[offset + 2] = (value >>> 16);
	    this[offset + 1] = (value >>> 8);
	    this[offset] = (value & 0xff);
	  } else {
	    objectWriteUInt32(this, value, offset, true);
	  }
	  return offset + 4
	};

	Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
	  value = +value;
	  offset = offset | 0;
	  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0);
	  if (Buffer.TYPED_ARRAY_SUPPORT) {
	    this[offset] = (value >>> 24);
	    this[offset + 1] = (value >>> 16);
	    this[offset + 2] = (value >>> 8);
	    this[offset + 3] = (value & 0xff);
	  } else {
	    objectWriteUInt32(this, value, offset, false);
	  }
	  return offset + 4
	};

	Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
	  value = +value;
	  offset = offset | 0;
	  if (!noAssert) {
	    var limit = Math.pow(2, 8 * byteLength - 1);

	    checkInt(this, value, offset, byteLength, limit - 1, -limit);
	  }

	  var i = 0;
	  var mul = 1;
	  var sub = 0;
	  this[offset] = value & 0xFF;
	  while (++i < byteLength && (mul *= 0x100)) {
	    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
	      sub = 1;
	    }
	    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF;
	  }

	  return offset + byteLength
	};

	Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
	  value = +value;
	  offset = offset | 0;
	  if (!noAssert) {
	    var limit = Math.pow(2, 8 * byteLength - 1);

	    checkInt(this, value, offset, byteLength, limit - 1, -limit);
	  }

	  var i = byteLength - 1;
	  var mul = 1;
	  var sub = 0;
	  this[offset + i] = value & 0xFF;
	  while (--i >= 0 && (mul *= 0x100)) {
	    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
	      sub = 1;
	    }
	    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF;
	  }

	  return offset + byteLength
	};

	Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
	  value = +value;
	  offset = offset | 0;
	  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80);
	  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value);
	  if (value < 0) value = 0xff + value + 1;
	  this[offset] = (value & 0xff);
	  return offset + 1
	};

	Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
	  value = +value;
	  offset = offset | 0;
	  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000);
	  if (Buffer.TYPED_ARRAY_SUPPORT) {
	    this[offset] = (value & 0xff);
	    this[offset + 1] = (value >>> 8);
	  } else {
	    objectWriteUInt16(this, value, offset, true);
	  }
	  return offset + 2
	};

	Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
	  value = +value;
	  offset = offset | 0;
	  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000);
	  if (Buffer.TYPED_ARRAY_SUPPORT) {
	    this[offset] = (value >>> 8);
	    this[offset + 1] = (value & 0xff);
	  } else {
	    objectWriteUInt16(this, value, offset, false);
	  }
	  return offset + 2
	};

	Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
	  value = +value;
	  offset = offset | 0;
	  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000);
	  if (Buffer.TYPED_ARRAY_SUPPORT) {
	    this[offset] = (value & 0xff);
	    this[offset + 1] = (value >>> 8);
	    this[offset + 2] = (value >>> 16);
	    this[offset + 3] = (value >>> 24);
	  } else {
	    objectWriteUInt32(this, value, offset, true);
	  }
	  return offset + 4
	};

	Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
	  value = +value;
	  offset = offset | 0;
	  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000);
	  if (value < 0) value = 0xffffffff + value + 1;
	  if (Buffer.TYPED_ARRAY_SUPPORT) {
	    this[offset] = (value >>> 24);
	    this[offset + 1] = (value >>> 16);
	    this[offset + 2] = (value >>> 8);
	    this[offset + 3] = (value & 0xff);
	  } else {
	    objectWriteUInt32(this, value, offset, false);
	  }
	  return offset + 4
	};

	function checkIEEE754 (buf, value, offset, ext, max, min) {
	  if (offset + ext > buf.length) throw new RangeError('Index out of range')
	  if (offset < 0) throw new RangeError('Index out of range')
	}

	function writeFloat (buf, value, offset, littleEndian, noAssert) {
	  if (!noAssert) {
	    checkIEEE754(buf, value, offset, 4);
	  }
	  write(buf, value, offset, littleEndian, 23, 4);
	  return offset + 4
	}

	Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
	  return writeFloat(this, value, offset, true, noAssert)
	};

	Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
	  return writeFloat(this, value, offset, false, noAssert)
	};

	function writeDouble (buf, value, offset, littleEndian, noAssert) {
	  if (!noAssert) {
	    checkIEEE754(buf, value, offset, 8);
	  }
	  write(buf, value, offset, littleEndian, 52, 8);
	  return offset + 8
	}

	Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
	  return writeDouble(this, value, offset, true, noAssert)
	};

	Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
	  return writeDouble(this, value, offset, false, noAssert)
	};

	// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
	Buffer.prototype.copy = function copy (target, targetStart, start, end) {
	  if (!start) start = 0;
	  if (!end && end !== 0) end = this.length;
	  if (targetStart >= target.length) targetStart = target.length;
	  if (!targetStart) targetStart = 0;
	  if (end > 0 && end < start) end = start;

	  // Copy 0 bytes; we're done
	  if (end === start) return 0
	  if (target.length === 0 || this.length === 0) return 0

	  // Fatal error conditions
	  if (targetStart < 0) {
	    throw new RangeError('targetStart out of bounds')
	  }
	  if (start < 0 || start >= this.length) throw new RangeError('sourceStart out of bounds')
	  if (end < 0) throw new RangeError('sourceEnd out of bounds')

	  // Are we oob?
	  if (end > this.length) end = this.length;
	  if (target.length - targetStart < end - start) {
	    end = target.length - targetStart + start;
	  }

	  var len = end - start;
	  var i;

	  if (this === target && start < targetStart && targetStart < end) {
	    // descending copy from end
	    for (i = len - 1; i >= 0; --i) {
	      target[i + targetStart] = this[i + start];
	    }
	  } else if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
	    // ascending copy from start
	    for (i = 0; i < len; ++i) {
	      target[i + targetStart] = this[i + start];
	    }
	  } else {
	    Uint8Array.prototype.set.call(
	      target,
	      this.subarray(start, start + len),
	      targetStart
	    );
	  }

	  return len
	};

	// Usage:
	//    buffer.fill(number[, offset[, end]])
	//    buffer.fill(buffer[, offset[, end]])
	//    buffer.fill(string[, offset[, end]][, encoding])
	Buffer.prototype.fill = function fill (val, start, end, encoding) {
	  // Handle string cases:
	  if (typeof val === 'string') {
	    if (typeof start === 'string') {
	      encoding = start;
	      start = 0;
	      end = this.length;
	    } else if (typeof end === 'string') {
	      encoding = end;
	      end = this.length;
	    }
	    if (val.length === 1) {
	      var code = val.charCodeAt(0);
	      if (code < 256) {
	        val = code;
	      }
	    }
	    if (encoding !== undefined && typeof encoding !== 'string') {
	      throw new TypeError('encoding must be a string')
	    }
	    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
	      throw new TypeError('Unknown encoding: ' + encoding)
	    }
	  } else if (typeof val === 'number') {
	    val = val & 255;
	  }

	  // Invalid ranges are not set to a default, so can range check early.
	  if (start < 0 || this.length < start || this.length < end) {
	    throw new RangeError('Out of range index')
	  }

	  if (end <= start) {
	    return this
	  }

	  start = start >>> 0;
	  end = end === undefined ? this.length : end >>> 0;

	  if (!val) val = 0;

	  var i;
	  if (typeof val === 'number') {
	    for (i = start; i < end; ++i) {
	      this[i] = val;
	    }
	  } else {
	    var bytes = internalIsBuffer(val)
	      ? val
	      : utf8ToBytes(new Buffer(val, encoding).toString());
	    var len = bytes.length;
	    for (i = 0; i < end - start; ++i) {
	      this[i + start] = bytes[i % len];
	    }
	  }

	  return this
	};

	// HELPER FUNCTIONS
	// ================

	var INVALID_BASE64_RE = /[^+\/0-9A-Za-z-_]/g;

	function base64clean (str) {
	  // Node strips out invalid characters like \n and \t from the string, base64-js does not
	  str = stringtrim(str).replace(INVALID_BASE64_RE, '');
	  // Node converts strings with length < 2 to ''
	  if (str.length < 2) return ''
	  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
	  while (str.length % 4 !== 0) {
	    str = str + '=';
	  }
	  return str
	}

	function stringtrim (str) {
	  if (str.trim) return str.trim()
	  return str.replace(/^\s+|\s+$/g, '')
	}

	function toHex (n) {
	  if (n < 16) return '0' + n.toString(16)
	  return n.toString(16)
	}

	function utf8ToBytes (string, units) {
	  units = units || Infinity;
	  var codePoint;
	  var length = string.length;
	  var leadSurrogate = null;
	  var bytes = [];

	  for (var i = 0; i < length; ++i) {
	    codePoint = string.charCodeAt(i);

	    // is surrogate component
	    if (codePoint > 0xD7FF && codePoint < 0xE000) {
	      // last char was a lead
	      if (!leadSurrogate) {
	        // no lead yet
	        if (codePoint > 0xDBFF) {
	          // unexpected trail
	          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
	          continue
	        } else if (i + 1 === length) {
	          // unpaired lead
	          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
	          continue
	        }

	        // valid lead
	        leadSurrogate = codePoint;

	        continue
	      }

	      // 2 leads in a row
	      if (codePoint < 0xDC00) {
	        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
	        leadSurrogate = codePoint;
	        continue
	      }

	      // valid surrogate pair
	      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000;
	    } else if (leadSurrogate) {
	      // valid bmp char, but last char was a lead
	      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
	    }

	    leadSurrogate = null;

	    // encode utf8
	    if (codePoint < 0x80) {
	      if ((units -= 1) < 0) break
	      bytes.push(codePoint);
	    } else if (codePoint < 0x800) {
	      if ((units -= 2) < 0) break
	      bytes.push(
	        codePoint >> 0x6 | 0xC0,
	        codePoint & 0x3F | 0x80
	      );
	    } else if (codePoint < 0x10000) {
	      if ((units -= 3) < 0) break
	      bytes.push(
	        codePoint >> 0xC | 0xE0,
	        codePoint >> 0x6 & 0x3F | 0x80,
	        codePoint & 0x3F | 0x80
	      );
	    } else if (codePoint < 0x110000) {
	      if ((units -= 4) < 0) break
	      bytes.push(
	        codePoint >> 0x12 | 0xF0,
	        codePoint >> 0xC & 0x3F | 0x80,
	        codePoint >> 0x6 & 0x3F | 0x80,
	        codePoint & 0x3F | 0x80
	      );
	    } else {
	      throw new Error('Invalid code point')
	    }
	  }

	  return bytes
	}

	function asciiToBytes (str) {
	  var byteArray = [];
	  for (var i = 0; i < str.length; ++i) {
	    // Node's code seems to be doing this and not & 0x7F..
	    byteArray.push(str.charCodeAt(i) & 0xFF);
	  }
	  return byteArray
	}

	function utf16leToBytes (str, units) {
	  var c, hi, lo;
	  var byteArray = [];
	  for (var i = 0; i < str.length; ++i) {
	    if ((units -= 2) < 0) break

	    c = str.charCodeAt(i);
	    hi = c >> 8;
	    lo = c % 256;
	    byteArray.push(lo);
	    byteArray.push(hi);
	  }

	  return byteArray
	}


	function base64ToBytes (str) {
	  return toByteArray(base64clean(str))
	}

	function blitBuffer (src, dst, offset, length) {
	  for (var i = 0; i < length; ++i) {
	    if ((i + offset >= dst.length) || (i >= src.length)) break
	    dst[i + offset] = src[i];
	  }
	  return i
	}

	function isnan (val) {
	  return val !== val // eslint-disable-line no-self-compare
	}


	// the following is from is-buffer, also by Feross Aboukhadijeh and with same lisence
	// The _isBuffer check is for Safari 5-7 support, because it's missing
	// Object.prototype.constructor. Remove this eventually
	function isBuffer$1(obj) {
	  return obj != null && (!!obj._isBuffer || isFastBuffer(obj) || isSlowBuffer(obj))
	}

	function isFastBuffer (obj) {
	  return !!obj.constructor && typeof obj.constructor.isBuffer === 'function' && obj.constructor.isBuffer(obj)
	}

	// For Node v0.10 support. Remove this eventually.
	function isSlowBuffer (obj) {
	  return typeof obj.readFloatLE === 'function' && typeof obj.slice === 'function' && isFastBuffer(obj.slice(0, 0))
	}

	var domain;

	// This constructor is used to store event handlers. Instantiating this is
	// faster than explicitly calling `Object.create(null)` to get a "clean" empty
	// object (tested with v8 v4.9).
	function EventHandlers() {}
	EventHandlers.prototype = Object.create(null);

	function EventEmitter() {
	  EventEmitter.init.call(this);
	}

	// nodejs oddity
	// require('events') === require('events').EventEmitter
	EventEmitter.EventEmitter = EventEmitter;

	EventEmitter.usingDomains = false;

	EventEmitter.prototype.domain = undefined;
	EventEmitter.prototype._events = undefined;
	EventEmitter.prototype._maxListeners = undefined;

	// By default EventEmitters will print a warning if more than 10 listeners are
	// added to it. This is a useful default which helps finding memory leaks.
	EventEmitter.defaultMaxListeners = 10;

	EventEmitter.init = function() {
	  this.domain = null;
	  if (EventEmitter.usingDomains) {
	    // if there is an active domain, then attach to it.
	    if (domain.active ) ;
	  }

	  if (!this._events || this._events === Object.getPrototypeOf(this)._events) {
	    this._events = new EventHandlers();
	    this._eventsCount = 0;
	  }

	  this._maxListeners = this._maxListeners || undefined;
	};

	// Obviously not all Emitters should be limited to 10. This function allows
	// that to be increased. Set to zero for unlimited.
	EventEmitter.prototype.setMaxListeners = function setMaxListeners(n) {
	  if (typeof n !== 'number' || n < 0 || isNaN(n))
	    throw new TypeError('"n" argument must be a positive number');
	  this._maxListeners = n;
	  return this;
	};

	function $getMaxListeners(that) {
	  if (that._maxListeners === undefined)
	    return EventEmitter.defaultMaxListeners;
	  return that._maxListeners;
	}

	EventEmitter.prototype.getMaxListeners = function getMaxListeners() {
	  return $getMaxListeners(this);
	};

	// These standalone emit* functions are used to optimize calling of event
	// handlers for fast cases because emit() itself often has a variable number of
	// arguments and can be deoptimized because of that. These functions always have
	// the same number of arguments and thus do not get deoptimized, so the code
	// inside them can execute faster.
	function emitNone(handler, isFn, self) {
	  if (isFn)
	    handler.call(self);
	  else {
	    var len = handler.length;
	    var listeners = arrayClone(handler, len);
	    for (var i = 0; i < len; ++i)
	      listeners[i].call(self);
	  }
	}
	function emitOne(handler, isFn, self, arg1) {
	  if (isFn)
	    handler.call(self, arg1);
	  else {
	    var len = handler.length;
	    var listeners = arrayClone(handler, len);
	    for (var i = 0; i < len; ++i)
	      listeners[i].call(self, arg1);
	  }
	}
	function emitTwo(handler, isFn, self, arg1, arg2) {
	  if (isFn)
	    handler.call(self, arg1, arg2);
	  else {
	    var len = handler.length;
	    var listeners = arrayClone(handler, len);
	    for (var i = 0; i < len; ++i)
	      listeners[i].call(self, arg1, arg2);
	  }
	}
	function emitThree(handler, isFn, self, arg1, arg2, arg3) {
	  if (isFn)
	    handler.call(self, arg1, arg2, arg3);
	  else {
	    var len = handler.length;
	    var listeners = arrayClone(handler, len);
	    for (var i = 0; i < len; ++i)
	      listeners[i].call(self, arg1, arg2, arg3);
	  }
	}

	function emitMany(handler, isFn, self, args) {
	  if (isFn)
	    handler.apply(self, args);
	  else {
	    var len = handler.length;
	    var listeners = arrayClone(handler, len);
	    for (var i = 0; i < len; ++i)
	      listeners[i].apply(self, args);
	  }
	}

	EventEmitter.prototype.emit = function emit(type) {
	  var er, handler, len, args, i, events, domain;
	  var doError = (type === 'error');

	  events = this._events;
	  if (events)
	    doError = (doError && events.error == null);
	  else if (!doError)
	    return false;

	  domain = this.domain;

	  // If there is no 'error' event listener then throw.
	  if (doError) {
	    er = arguments[1];
	    if (domain) {
	      if (!er)
	        er = new Error('Uncaught, unspecified "error" event');
	      er.domainEmitter = this;
	      er.domain = domain;
	      er.domainThrown = false;
	      domain.emit('error', er);
	    } else if (er instanceof Error) {
	      throw er; // Unhandled 'error' event
	    } else {
	      // At least give some kind of context to the user
	      var err = new Error('Uncaught, unspecified "error" event. (' + er + ')');
	      err.context = er;
	      throw err;
	    }
	    return false;
	  }

	  handler = events[type];

	  if (!handler)
	    return false;

	  var isFn = typeof handler === 'function';
	  len = arguments.length;
	  switch (len) {
	    // fast cases
	    case 1:
	      emitNone(handler, isFn, this);
	      break;
	    case 2:
	      emitOne(handler, isFn, this, arguments[1]);
	      break;
	    case 3:
	      emitTwo(handler, isFn, this, arguments[1], arguments[2]);
	      break;
	    case 4:
	      emitThree(handler, isFn, this, arguments[1], arguments[2], arguments[3]);
	      break;
	    // slower
	    default:
	      args = new Array(len - 1);
	      for (i = 1; i < len; i++)
	        args[i - 1] = arguments[i];
	      emitMany(handler, isFn, this, args);
	  }

	  return true;
	};

	function _addListener(target, type, listener, prepend) {
	  var m;
	  var events;
	  var existing;

	  if (typeof listener !== 'function')
	    throw new TypeError('"listener" argument must be a function');

	  events = target._events;
	  if (!events) {
	    events = target._events = new EventHandlers();
	    target._eventsCount = 0;
	  } else {
	    // To avoid recursion in the case that type === "newListener"! Before
	    // adding it to the listeners, first emit "newListener".
	    if (events.newListener) {
	      target.emit('newListener', type,
	                  listener.listener ? listener.listener : listener);

	      // Re-assign `events` because a newListener handler could have caused the
	      // this._events to be assigned to a new object
	      events = target._events;
	    }
	    existing = events[type];
	  }

	  if (!existing) {
	    // Optimize the case of one listener. Don't need the extra array object.
	    existing = events[type] = listener;
	    ++target._eventsCount;
	  } else {
	    if (typeof existing === 'function') {
	      // Adding the second element, need to change to array.
	      existing = events[type] = prepend ? [listener, existing] :
	                                          [existing, listener];
	    } else {
	      // If we've already got an array, just append.
	      if (prepend) {
	        existing.unshift(listener);
	      } else {
	        existing.push(listener);
	      }
	    }

	    // Check for listener leak
	    if (!existing.warned) {
	      m = $getMaxListeners(target);
	      if (m && m > 0 && existing.length > m) {
	        existing.warned = true;
	        var w = new Error('Possible EventEmitter memory leak detected. ' +
	                            existing.length + ' ' + type + ' listeners added. ' +
	                            'Use emitter.setMaxListeners() to increase limit');
	        w.name = 'MaxListenersExceededWarning';
	        w.emitter = target;
	        w.type = type;
	        w.count = existing.length;
	        emitWarning(w);
	      }
	    }
	  }

	  return target;
	}
	function emitWarning(e) {
	  typeof console.warn === 'function' ? console.warn(e) : console.log(e);
	}
	EventEmitter.prototype.addListener = function addListener(type, listener) {
	  return _addListener(this, type, listener, false);
	};

	EventEmitter.prototype.on = EventEmitter.prototype.addListener;

	EventEmitter.prototype.prependListener =
	    function prependListener(type, listener) {
	      return _addListener(this, type, listener, true);
	    };

	function _onceWrap(target, type, listener) {
	  var fired = false;
	  function g() {
	    target.removeListener(type, g);
	    if (!fired) {
	      fired = true;
	      listener.apply(target, arguments);
	    }
	  }
	  g.listener = listener;
	  return g;
	}

	EventEmitter.prototype.once = function once(type, listener) {
	  if (typeof listener !== 'function')
	    throw new TypeError('"listener" argument must be a function');
	  this.on(type, _onceWrap(this, type, listener));
	  return this;
	};

	EventEmitter.prototype.prependOnceListener =
	    function prependOnceListener(type, listener) {
	      if (typeof listener !== 'function')
	        throw new TypeError('"listener" argument must be a function');
	      this.prependListener(type, _onceWrap(this, type, listener));
	      return this;
	    };

	// emits a 'removeListener' event iff the listener was removed
	EventEmitter.prototype.removeListener =
	    function removeListener(type, listener) {
	      var list, events, position, i, originalListener;

	      if (typeof listener !== 'function')
	        throw new TypeError('"listener" argument must be a function');

	      events = this._events;
	      if (!events)
	        return this;

	      list = events[type];
	      if (!list)
	        return this;

	      if (list === listener || (list.listener && list.listener === listener)) {
	        if (--this._eventsCount === 0)
	          this._events = new EventHandlers();
	        else {
	          delete events[type];
	          if (events.removeListener)
	            this.emit('removeListener', type, list.listener || listener);
	        }
	      } else if (typeof list !== 'function') {
	        position = -1;

	        for (i = list.length; i-- > 0;) {
	          if (list[i] === listener ||
	              (list[i].listener && list[i].listener === listener)) {
	            originalListener = list[i].listener;
	            position = i;
	            break;
	          }
	        }

	        if (position < 0)
	          return this;

	        if (list.length === 1) {
	          list[0] = undefined;
	          if (--this._eventsCount === 0) {
	            this._events = new EventHandlers();
	            return this;
	          } else {
	            delete events[type];
	          }
	        } else {
	          spliceOne(list, position);
	        }

	        if (events.removeListener)
	          this.emit('removeListener', type, originalListener || listener);
	      }

	      return this;
	    };

	EventEmitter.prototype.removeAllListeners =
	    function removeAllListeners(type) {
	      var listeners, events;

	      events = this._events;
	      if (!events)
	        return this;

	      // not listening for removeListener, no need to emit
	      if (!events.removeListener) {
	        if (arguments.length === 0) {
	          this._events = new EventHandlers();
	          this._eventsCount = 0;
	        } else if (events[type]) {
	          if (--this._eventsCount === 0)
	            this._events = new EventHandlers();
	          else
	            delete events[type];
	        }
	        return this;
	      }

	      // emit removeListener for all listeners on all events
	      if (arguments.length === 0) {
	        var keys = Object.keys(events);
	        for (var i = 0, key; i < keys.length; ++i) {
	          key = keys[i];
	          if (key === 'removeListener') continue;
	          this.removeAllListeners(key);
	        }
	        this.removeAllListeners('removeListener');
	        this._events = new EventHandlers();
	        this._eventsCount = 0;
	        return this;
	      }

	      listeners = events[type];

	      if (typeof listeners === 'function') {
	        this.removeListener(type, listeners);
	      } else if (listeners) {
	        // LIFO order
	        do {
	          this.removeListener(type, listeners[listeners.length - 1]);
	        } while (listeners[0]);
	      }

	      return this;
	    };

	EventEmitter.prototype.listeners = function listeners(type) {
	  var evlistener;
	  var ret;
	  var events = this._events;

	  if (!events)
	    ret = [];
	  else {
	    evlistener = events[type];
	    if (!evlistener)
	      ret = [];
	    else if (typeof evlistener === 'function')
	      ret = [evlistener.listener || evlistener];
	    else
	      ret = unwrapListeners(evlistener);
	  }

	  return ret;
	};

	EventEmitter.listenerCount = function(emitter, type) {
	  if (typeof emitter.listenerCount === 'function') {
	    return emitter.listenerCount(type);
	  } else {
	    return listenerCount$1.call(emitter, type);
	  }
	};

	EventEmitter.prototype.listenerCount = listenerCount$1;
	function listenerCount$1(type) {
	  var events = this._events;

	  if (events) {
	    var evlistener = events[type];

	    if (typeof evlistener === 'function') {
	      return 1;
	    } else if (evlistener) {
	      return evlistener.length;
	    }
	  }

	  return 0;
	}

	EventEmitter.prototype.eventNames = function eventNames() {
	  return this._eventsCount > 0 ? Reflect.ownKeys(this._events) : [];
	};

	// About 1.5x faster than the two-arg version of Array#splice().
	function spliceOne(list, index) {
	  for (var i = index, k = i + 1, n = list.length; k < n; i += 1, k += 1)
	    list[i] = list[k];
	  list.pop();
	}

	function arrayClone(arr, i) {
	  var copy = new Array(i);
	  while (i--)
	    copy[i] = arr[i];
	  return copy;
	}

	function unwrapListeners(arr) {
	  var ret = new Array(arr.length);
	  for (var i = 0; i < ret.length; ++i) {
	    ret[i] = arr[i].listener || arr[i];
	  }
	  return ret;
	}

	// shim for using process in browser
	// based off https://github.com/defunctzombie/node-process/blob/master/browser.js

	function defaultSetTimout() {
	    throw new Error('setTimeout has not been defined');
	}
	function defaultClearTimeout () {
	    throw new Error('clearTimeout has not been defined');
	}
	var cachedSetTimeout = defaultSetTimout;
	var cachedClearTimeout = defaultClearTimeout;
	if (typeof global$1.setTimeout === 'function') {
	    cachedSetTimeout = setTimeout;
	}
	if (typeof global$1.clearTimeout === 'function') {
	    cachedClearTimeout = clearTimeout;
	}

	function runTimeout(fun) {
	    if (cachedSetTimeout === setTimeout) {
	        //normal enviroments in sane situations
	        return setTimeout(fun, 0);
	    }
	    // if setTimeout wasn't available but was latter defined
	    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
	        cachedSetTimeout = setTimeout;
	        return setTimeout(fun, 0);
	    }
	    try {
	        // when when somebody has screwed with setTimeout but no I.E. maddness
	        return cachedSetTimeout(fun, 0);
	    } catch(e){
	        try {
	            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
	            return cachedSetTimeout.call(null, fun, 0);
	        } catch(e){
	            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
	            return cachedSetTimeout.call(this, fun, 0);
	        }
	    }


	}
	function runClearTimeout(marker) {
	    if (cachedClearTimeout === clearTimeout) {
	        //normal enviroments in sane situations
	        return clearTimeout(marker);
	    }
	    // if clearTimeout wasn't available but was latter defined
	    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
	        cachedClearTimeout = clearTimeout;
	        return clearTimeout(marker);
	    }
	    try {
	        // when when somebody has screwed with setTimeout but no I.E. maddness
	        return cachedClearTimeout(marker);
	    } catch (e){
	        try {
	            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
	            return cachedClearTimeout.call(null, marker);
	        } catch (e){
	            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
	            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
	            return cachedClearTimeout.call(this, marker);
	        }
	    }



	}
	var queue = [];
	var draining = false;
	var currentQueue;
	var queueIndex = -1;

	function cleanUpNextTick() {
	    if (!draining || !currentQueue) {
	        return;
	    }
	    draining = false;
	    if (currentQueue.length) {
	        queue = currentQueue.concat(queue);
	    } else {
	        queueIndex = -1;
	    }
	    if (queue.length) {
	        drainQueue();
	    }
	}

	function drainQueue() {
	    if (draining) {
	        return;
	    }
	    var timeout = runTimeout(cleanUpNextTick);
	    draining = true;

	    var len = queue.length;
	    while(len) {
	        currentQueue = queue;
	        queue = [];
	        while (++queueIndex < len) {
	            if (currentQueue) {
	                currentQueue[queueIndex].run();
	            }
	        }
	        queueIndex = -1;
	        len = queue.length;
	    }
	    currentQueue = null;
	    draining = false;
	    runClearTimeout(timeout);
	}
	function nextTick(fun) {
	    var args = new Array(arguments.length - 1);
	    if (arguments.length > 1) {
	        for (var i = 1; i < arguments.length; i++) {
	            args[i - 1] = arguments[i];
	        }
	    }
	    queue.push(new Item(fun, args));
	    if (queue.length === 1 && !draining) {
	        runTimeout(drainQueue);
	    }
	}
	// v8 likes predictible objects
	function Item(fun, array) {
	    this.fun = fun;
	    this.array = array;
	}
	Item.prototype.run = function () {
	    this.fun.apply(null, this.array);
	};

	// from https://github.com/kumavis/browser-process-hrtime/blob/master/index.js
	var performance = global$1.performance || {};
	performance.now        ||
	  performance.mozNow     ||
	  performance.msNow      ||
	  performance.oNow       ||
	  performance.webkitNow  ||
	  function(){ return (new Date()).getTime() };

	var inherits$2;
	if (typeof Object.create === 'function'){
	  inherits$2 = function inherits(ctor, superCtor) {
	    // implementation from standard node.js 'util' module
	    ctor.super_ = superCtor;
	    ctor.prototype = Object.create(superCtor.prototype, {
	      constructor: {
	        value: ctor,
	        enumerable: false,
	        writable: true,
	        configurable: true
	      }
	    });
	  };
	} else {
	  inherits$2 = function inherits(ctor, superCtor) {
	    ctor.super_ = superCtor;
	    var TempCtor = function () {};
	    TempCtor.prototype = superCtor.prototype;
	    ctor.prototype = new TempCtor();
	    ctor.prototype.constructor = ctor;
	  };
	}
	var inherits$3 = inherits$2;

	var formatRegExp = /%[sdj%]/g;
	function format(f) {
	  if (!isString(f)) {
	    var objects = [];
	    for (var i = 0; i < arguments.length; i++) {
	      objects.push(inspect(arguments[i]));
	    }
	    return objects.join(' ');
	  }

	  var i = 1;
	  var args = arguments;
	  var len = args.length;
	  var str = String(f).replace(formatRegExp, function(x) {
	    if (x === '%%') return '%';
	    if (i >= len) return x;
	    switch (x) {
	      case '%s': return String(args[i++]);
	      case '%d': return Number(args[i++]);
	      case '%j':
	        try {
	          return JSON.stringify(args[i++]);
	        } catch (_) {
	          return '[Circular]';
	        }
	      default:
	        return x;
	    }
	  });
	  for (var x = args[i]; i < len; x = args[++i]) {
	    if (isNull(x) || !isObject(x)) {
	      str += ' ' + x;
	    } else {
	      str += ' ' + inspect(x);
	    }
	  }
	  return str;
	}

	// Mark that a method should not be used.
	// Returns a modified function which warns once by default.
	// If --no-deprecation is set, then it is a no-op.
	function deprecate(fn, msg) {
	  // Allow for deprecating things in the process of starting up.
	  if (isUndefined(global$1.process)) {
	    return function() {
	      return deprecate(fn, msg).apply(this, arguments);
	    };
	  }

	  var warned = false;
	  function deprecated() {
	    if (!warned) {
	      {
	        console.error(msg);
	      }
	      warned = true;
	    }
	    return fn.apply(this, arguments);
	  }

	  return deprecated;
	}

	var debugs = {};
	var debugEnviron;
	function debuglog(set) {
	  if (isUndefined(debugEnviron))
	    debugEnviron = '';
	  set = set.toUpperCase();
	  if (!debugs[set]) {
	    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
	      var pid = 0;
	      debugs[set] = function() {
	        var msg = format.apply(null, arguments);
	        console.error('%s %d: %s', set, pid, msg);
	      };
	    } else {
	      debugs[set] = function() {};
	    }
	  }
	  return debugs[set];
	}

	/**
	 * Echos the value of a value. Trys to print the value out
	 * in the best way possible given the different types.
	 *
	 * @param {Object} obj The object to print out.
	 * @param {Object} opts Optional options object that alters the output.
	 */
	/* legacy: obj, showHidden, depth, colors*/
	function inspect(obj, opts) {
	  // default options
	  var ctx = {
	    seen: [],
	    stylize: stylizeNoColor
	  };
	  // legacy...
	  if (arguments.length >= 3) ctx.depth = arguments[2];
	  if (arguments.length >= 4) ctx.colors = arguments[3];
	  if (isBoolean(opts)) {
	    // legacy...
	    ctx.showHidden = opts;
	  } else if (opts) {
	    // got an "options" object
	    _extend(ctx, opts);
	  }
	  // set default options
	  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
	  if (isUndefined(ctx.depth)) ctx.depth = 2;
	  if (isUndefined(ctx.colors)) ctx.colors = false;
	  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
	  if (ctx.colors) ctx.stylize = stylizeWithColor;
	  return formatValue(ctx, obj, ctx.depth);
	}

	// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
	inspect.colors = {
	  'bold' : [1, 22],
	  'italic' : [3, 23],
	  'underline' : [4, 24],
	  'inverse' : [7, 27],
	  'white' : [37, 39],
	  'grey' : [90, 39],
	  'black' : [30, 39],
	  'blue' : [34, 39],
	  'cyan' : [36, 39],
	  'green' : [32, 39],
	  'magenta' : [35, 39],
	  'red' : [31, 39],
	  'yellow' : [33, 39]
	};

	// Don't use 'blue' not visible on cmd.exe
	inspect.styles = {
	  'special': 'cyan',
	  'number': 'yellow',
	  'boolean': 'yellow',
	  'undefined': 'grey',
	  'null': 'bold',
	  'string': 'green',
	  'date': 'magenta',
	  // "name": intentionally not styling
	  'regexp': 'red'
	};


	function stylizeWithColor(str, styleType) {
	  var style = inspect.styles[styleType];

	  if (style) {
	    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
	           '\u001b[' + inspect.colors[style][1] + 'm';
	  } else {
	    return str;
	  }
	}


	function stylizeNoColor(str, styleType) {
	  return str;
	}


	function arrayToHash(array) {
	  var hash = {};

	  array.forEach(function(val, idx) {
	    hash[val] = true;
	  });

	  return hash;
	}


	function formatValue(ctx, value, recurseTimes) {
	  // Provide a hook for user-specified inspect functions.
	  // Check that value is an object with an inspect function on it
	  if (ctx.customInspect &&
	      value &&
	      isFunction(value.inspect) &&
	      // Filter out the util module, it's inspect function is special
	      value.inspect !== inspect &&
	      // Also filter out any prototype objects using the circular check.
	      !(value.constructor && value.constructor.prototype === value)) {
	    var ret = value.inspect(recurseTimes, ctx);
	    if (!isString(ret)) {
	      ret = formatValue(ctx, ret, recurseTimes);
	    }
	    return ret;
	  }

	  // Primitive types cannot have properties
	  var primitive = formatPrimitive(ctx, value);
	  if (primitive) {
	    return primitive;
	  }

	  // Look up the keys of the object.
	  var keys = Object.keys(value);
	  var visibleKeys = arrayToHash(keys);

	  if (ctx.showHidden) {
	    keys = Object.getOwnPropertyNames(value);
	  }

	  // IE doesn't make error fields non-enumerable
	  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
	  if (isError(value)
	      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
	    return formatError(value);
	  }

	  // Some type of object without properties can be shortcutted.
	  if (keys.length === 0) {
	    if (isFunction(value)) {
	      var name = value.name ? ': ' + value.name : '';
	      return ctx.stylize('[Function' + name + ']', 'special');
	    }
	    if (isRegExp(value)) {
	      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
	    }
	    if (isDate(value)) {
	      return ctx.stylize(Date.prototype.toString.call(value), 'date');
	    }
	    if (isError(value)) {
	      return formatError(value);
	    }
	  }

	  var base = '', array = false, braces = ['{', '}'];

	  // Make Array say that they are Array
	  if (isArray(value)) {
	    array = true;
	    braces = ['[', ']'];
	  }

	  // Make functions say that they are functions
	  if (isFunction(value)) {
	    var n = value.name ? ': ' + value.name : '';
	    base = ' [Function' + n + ']';
	  }

	  // Make RegExps say that they are RegExps
	  if (isRegExp(value)) {
	    base = ' ' + RegExp.prototype.toString.call(value);
	  }

	  // Make dates with properties first say the date
	  if (isDate(value)) {
	    base = ' ' + Date.prototype.toUTCString.call(value);
	  }

	  // Make error with message first say the error
	  if (isError(value)) {
	    base = ' ' + formatError(value);
	  }

	  if (keys.length === 0 && (!array || value.length == 0)) {
	    return braces[0] + base + braces[1];
	  }

	  if (recurseTimes < 0) {
	    if (isRegExp(value)) {
	      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
	    } else {
	      return ctx.stylize('[Object]', 'special');
	    }
	  }

	  ctx.seen.push(value);

	  var output;
	  if (array) {
	    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
	  } else {
	    output = keys.map(function(key) {
	      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
	    });
	  }

	  ctx.seen.pop();

	  return reduceToSingleString(output, base, braces);
	}


	function formatPrimitive(ctx, value) {
	  if (isUndefined(value))
	    return ctx.stylize('undefined', 'undefined');
	  if (isString(value)) {
	    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
	                                             .replace(/'/g, "\\'")
	                                             .replace(/\\"/g, '"') + '\'';
	    return ctx.stylize(simple, 'string');
	  }
	  if (isNumber(value))
	    return ctx.stylize('' + value, 'number');
	  if (isBoolean(value))
	    return ctx.stylize('' + value, 'boolean');
	  // For some reason typeof null is "object", so special case here.
	  if (isNull(value))
	    return ctx.stylize('null', 'null');
	}


	function formatError(value) {
	  return '[' + Error.prototype.toString.call(value) + ']';
	}


	function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
	  var output = [];
	  for (var i = 0, l = value.length; i < l; ++i) {
	    if (hasOwnProperty(value, String(i))) {
	      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
	          String(i), true));
	    } else {
	      output.push('');
	    }
	  }
	  keys.forEach(function(key) {
	    if (!key.match(/^\d+$/)) {
	      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
	          key, true));
	    }
	  });
	  return output;
	}


	function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
	  var name, str, desc;
	  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
	  if (desc.get) {
	    if (desc.set) {
	      str = ctx.stylize('[Getter/Setter]', 'special');
	    } else {
	      str = ctx.stylize('[Getter]', 'special');
	    }
	  } else {
	    if (desc.set) {
	      str = ctx.stylize('[Setter]', 'special');
	    }
	  }
	  if (!hasOwnProperty(visibleKeys, key)) {
	    name = '[' + key + ']';
	  }
	  if (!str) {
	    if (ctx.seen.indexOf(desc.value) < 0) {
	      if (isNull(recurseTimes)) {
	        str = formatValue(ctx, desc.value, null);
	      } else {
	        str = formatValue(ctx, desc.value, recurseTimes - 1);
	      }
	      if (str.indexOf('\n') > -1) {
	        if (array) {
	          str = str.split('\n').map(function(line) {
	            return '  ' + line;
	          }).join('\n').substr(2);
	        } else {
	          str = '\n' + str.split('\n').map(function(line) {
	            return '   ' + line;
	          }).join('\n');
	        }
	      }
	    } else {
	      str = ctx.stylize('[Circular]', 'special');
	    }
	  }
	  if (isUndefined(name)) {
	    if (array && key.match(/^\d+$/)) {
	      return str;
	    }
	    name = JSON.stringify('' + key);
	    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
	      name = name.substr(1, name.length - 2);
	      name = ctx.stylize(name, 'name');
	    } else {
	      name = name.replace(/'/g, "\\'")
	                 .replace(/\\"/g, '"')
	                 .replace(/(^"|"$)/g, "'");
	      name = ctx.stylize(name, 'string');
	    }
	  }

	  return name + ': ' + str;
	}


	function reduceToSingleString(output, base, braces) {
	  var length = output.reduce(function(prev, cur) {
	    if (cur.indexOf('\n') >= 0) ;
	    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
	  }, 0);

	  if (length > 60) {
	    return braces[0] +
	           (base === '' ? '' : base + '\n ') +
	           ' ' +
	           output.join(',\n  ') +
	           ' ' +
	           braces[1];
	  }

	  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
	}


	// NOTE: These type checking functions intentionally don't use `instanceof`
	// because it is fragile and can be easily faked with `Object.create()`.
	function isArray(ar) {
	  return Array.isArray(ar);
	}

	function isBoolean(arg) {
	  return typeof arg === 'boolean';
	}

	function isNull(arg) {
	  return arg === null;
	}

	function isNullOrUndefined(arg) {
	  return arg == null;
	}

	function isNumber(arg) {
	  return typeof arg === 'number';
	}

	function isString(arg) {
	  return typeof arg === 'string';
	}

	function isSymbol(arg) {
	  return typeof arg === 'symbol';
	}

	function isUndefined(arg) {
	  return arg === void 0;
	}

	function isRegExp(re) {
	  return isObject(re) && objectToString(re) === '[object RegExp]';
	}

	function isObject(arg) {
	  return typeof arg === 'object' && arg !== null;
	}

	function isDate(d) {
	  return isObject(d) && objectToString(d) === '[object Date]';
	}

	function isError(e) {
	  return isObject(e) &&
	      (objectToString(e) === '[object Error]' || e instanceof Error);
	}

	function isFunction(arg) {
	  return typeof arg === 'function';
	}

	function isPrimitive(arg) {
	  return arg === null ||
	         typeof arg === 'boolean' ||
	         typeof arg === 'number' ||
	         typeof arg === 'string' ||
	         typeof arg === 'symbol' ||  // ES6 symbol
	         typeof arg === 'undefined';
	}

	function isBuffer(maybeBuf) {
	  return isBuffer$1(maybeBuf);
	}

	function objectToString(o) {
	  return Object.prototype.toString.call(o);
	}


	function pad(n) {
	  return n < 10 ? '0' + n.toString(10) : n.toString(10);
	}


	var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
	              'Oct', 'Nov', 'Dec'];

	// 26 Feb 16:19:34
	function timestamp() {
	  var d = new Date();
	  var time = [pad(d.getHours()),
	              pad(d.getMinutes()),
	              pad(d.getSeconds())].join(':');
	  return [d.getDate(), months[d.getMonth()], time].join(' ');
	}


	// log is just a thin wrapper to console.log that prepends a timestamp
	function log() {
	  console.log('%s - %s', timestamp(), format.apply(null, arguments));
	}

	function _extend(origin, add) {
	  // Don't do anything if add isn't an object
	  if (!add || !isObject(add)) return origin;

	  var keys = Object.keys(add);
	  var i = keys.length;
	  while (i--) {
	    origin[keys[i]] = add[keys[i]];
	  }
	  return origin;
	}
	function hasOwnProperty(obj, prop) {
	  return Object.prototype.hasOwnProperty.call(obj, prop);
	}

	var util$2 = {
	  inherits: inherits$3,
	  _extend: _extend,
	  log: log,
	  isBuffer: isBuffer,
	  isPrimitive: isPrimitive,
	  isFunction: isFunction,
	  isError: isError,
	  isDate: isDate,
	  isObject: isObject,
	  isRegExp: isRegExp,
	  isUndefined: isUndefined,
	  isSymbol: isSymbol,
	  isString: isString,
	  isNumber: isNumber,
	  isNullOrUndefined: isNullOrUndefined,
	  isNull: isNull,
	  isBoolean: isBoolean,
	  isArray: isArray,
	  inspect: inspect,
	  deprecate: deprecate,
	  format: format,
	  debuglog: debuglog
	};

	var util$3 = /*#__PURE__*/Object.freeze({
		__proto__: null,
		format: format,
		deprecate: deprecate,
		debuglog: debuglog,
		inspect: inspect,
		isArray: isArray,
		isBoolean: isBoolean,
		isNull: isNull,
		isNullOrUndefined: isNullOrUndefined,
		isNumber: isNumber,
		isString: isString,
		isSymbol: isSymbol,
		isUndefined: isUndefined,
		isRegExp: isRegExp,
		isObject: isObject,
		isDate: isDate,
		isError: isError,
		isFunction: isFunction,
		isPrimitive: isPrimitive,
		isBuffer: isBuffer,
		log: log,
		inherits: inherits$3,
		_extend: _extend,
		'default': util$2
	});

	function BufferList() {
	  this.head = null;
	  this.tail = null;
	  this.length = 0;
	}

	BufferList.prototype.push = function (v) {
	  var entry = { data: v, next: null };
	  if (this.length > 0) this.tail.next = entry;else this.head = entry;
	  this.tail = entry;
	  ++this.length;
	};

	BufferList.prototype.unshift = function (v) {
	  var entry = { data: v, next: this.head };
	  if (this.length === 0) this.tail = entry;
	  this.head = entry;
	  ++this.length;
	};

	BufferList.prototype.shift = function () {
	  if (this.length === 0) return;
	  var ret = this.head.data;
	  if (this.length === 1) this.head = this.tail = null;else this.head = this.head.next;
	  --this.length;
	  return ret;
	};

	BufferList.prototype.clear = function () {
	  this.head = this.tail = null;
	  this.length = 0;
	};

	BufferList.prototype.join = function (s) {
	  if (this.length === 0) return '';
	  var p = this.head;
	  var ret = '' + p.data;
	  while (p = p.next) {
	    ret += s + p.data;
	  }return ret;
	};

	BufferList.prototype.concat = function (n) {
	  if (this.length === 0) return Buffer.alloc(0);
	  if (this.length === 1) return this.head.data;
	  var ret = Buffer.allocUnsafe(n >>> 0);
	  var p = this.head;
	  var i = 0;
	  while (p) {
	    p.data.copy(ret, i);
	    i += p.data.length;
	    p = p.next;
	  }
	  return ret;
	};

	// Copyright Joyent, Inc. and other Node contributors.
	var isBufferEncoding = Buffer.isEncoding
	  || function(encoding) {
	       switch (encoding && encoding.toLowerCase()) {
	         case 'hex': case 'utf8': case 'utf-8': case 'ascii': case 'binary': case 'base64': case 'ucs2': case 'ucs-2': case 'utf16le': case 'utf-16le': case 'raw': return true;
	         default: return false;
	       }
	     };


	function assertEncoding(encoding) {
	  if (encoding && !isBufferEncoding(encoding)) {
	    throw new Error('Unknown encoding: ' + encoding);
	  }
	}

	// StringDecoder provides an interface for efficiently splitting a series of
	// buffers into a series of JS strings without breaking apart multi-byte
	// characters. CESU-8 is handled as part of the UTF-8 encoding.
	//
	// @TODO Handling all encodings inside a single object makes it very difficult
	// to reason about this code, so it should be split up in the future.
	// @TODO There should be a utf8-strict encoding that rejects invalid UTF-8 code
	// points as used by CESU-8.
	function StringDecoder(encoding) {
	  this.encoding = (encoding || 'utf8').toLowerCase().replace(/[-_]/, '');
	  assertEncoding(encoding);
	  switch (this.encoding) {
	    case 'utf8':
	      // CESU-8 represents each of Surrogate Pair by 3-bytes
	      this.surrogateSize = 3;
	      break;
	    case 'ucs2':
	    case 'utf16le':
	      // UTF-16 represents each of Surrogate Pair by 2-bytes
	      this.surrogateSize = 2;
	      this.detectIncompleteChar = utf16DetectIncompleteChar;
	      break;
	    case 'base64':
	      // Base-64 stores 3 bytes in 4 chars, and pads the remainder.
	      this.surrogateSize = 3;
	      this.detectIncompleteChar = base64DetectIncompleteChar;
	      break;
	    default:
	      this.write = passThroughWrite;
	      return;
	  }

	  // Enough space to store all bytes of a single character. UTF-8 needs 4
	  // bytes, but CESU-8 may require up to 6 (3 bytes per surrogate).
	  this.charBuffer = new Buffer(6);
	  // Number of bytes received for the current incomplete multi-byte character.
	  this.charReceived = 0;
	  // Number of bytes expected for the current incomplete multi-byte character.
	  this.charLength = 0;
	}

	// write decodes the given buffer and returns it as JS string that is
	// guaranteed to not contain any partial multi-byte characters. Any partial
	// character found at the end of the buffer is buffered up, and will be
	// returned when calling write again with the remaining bytes.
	//
	// Note: Converting a Buffer containing an orphan surrogate to a String
	// currently works, but converting a String to a Buffer (via `new Buffer`, or
	// Buffer#write) will replace incomplete surrogates with the unicode
	// replacement character. See https://codereview.chromium.org/121173009/ .
	StringDecoder.prototype.write = function(buffer) {
	  var charStr = '';
	  // if our last write ended with an incomplete multibyte character
	  while (this.charLength) {
	    // determine how many remaining bytes this buffer has to offer for this char
	    var available = (buffer.length >= this.charLength - this.charReceived) ?
	        this.charLength - this.charReceived :
	        buffer.length;

	    // add the new bytes to the char buffer
	    buffer.copy(this.charBuffer, this.charReceived, 0, available);
	    this.charReceived += available;

	    if (this.charReceived < this.charLength) {
	      // still not enough chars in this buffer? wait for more ...
	      return '';
	    }

	    // remove bytes belonging to the current character from the buffer
	    buffer = buffer.slice(available, buffer.length);

	    // get the character that was split
	    charStr = this.charBuffer.slice(0, this.charLength).toString(this.encoding);

	    // CESU-8: lead surrogate (D800-DBFF) is also the incomplete character
	    var charCode = charStr.charCodeAt(charStr.length - 1);
	    if (charCode >= 0xD800 && charCode <= 0xDBFF) {
	      this.charLength += this.surrogateSize;
	      charStr = '';
	      continue;
	    }
	    this.charReceived = this.charLength = 0;

	    // if there are no more bytes in this buffer, just emit our char
	    if (buffer.length === 0) {
	      return charStr;
	    }
	    break;
	  }

	  // determine and set charLength / charReceived
	  this.detectIncompleteChar(buffer);

	  var end = buffer.length;
	  if (this.charLength) {
	    // buffer the incomplete character bytes we got
	    buffer.copy(this.charBuffer, 0, buffer.length - this.charReceived, end);
	    end -= this.charReceived;
	  }

	  charStr += buffer.toString(this.encoding, 0, end);

	  var end = charStr.length - 1;
	  var charCode = charStr.charCodeAt(end);
	  // CESU-8: lead surrogate (D800-DBFF) is also the incomplete character
	  if (charCode >= 0xD800 && charCode <= 0xDBFF) {
	    var size = this.surrogateSize;
	    this.charLength += size;
	    this.charReceived += size;
	    this.charBuffer.copy(this.charBuffer, size, 0, size);
	    buffer.copy(this.charBuffer, 0, 0, size);
	    return charStr.substring(0, end);
	  }

	  // or just emit the charStr
	  return charStr;
	};

	// detectIncompleteChar determines if there is an incomplete UTF-8 character at
	// the end of the given buffer. If so, it sets this.charLength to the byte
	// length that character, and sets this.charReceived to the number of bytes
	// that are available for this character.
	StringDecoder.prototype.detectIncompleteChar = function(buffer) {
	  // determine how many bytes we have to check at the end of this buffer
	  var i = (buffer.length >= 3) ? 3 : buffer.length;

	  // Figure out if one of the last i bytes of our buffer announces an
	  // incomplete char.
	  for (; i > 0; i--) {
	    var c = buffer[buffer.length - i];

	    // See http://en.wikipedia.org/wiki/UTF-8#Description

	    // 110XXXXX
	    if (i == 1 && c >> 5 == 0x06) {
	      this.charLength = 2;
	      break;
	    }

	    // 1110XXXX
	    if (i <= 2 && c >> 4 == 0x0E) {
	      this.charLength = 3;
	      break;
	    }

	    // 11110XXX
	    if (i <= 3 && c >> 3 == 0x1E) {
	      this.charLength = 4;
	      break;
	    }
	  }
	  this.charReceived = i;
	};

	StringDecoder.prototype.end = function(buffer) {
	  var res = '';
	  if (buffer && buffer.length)
	    res = this.write(buffer);

	  if (this.charReceived) {
	    var cr = this.charReceived;
	    var buf = this.charBuffer;
	    var enc = this.encoding;
	    res += buf.slice(0, cr).toString(enc);
	  }

	  return res;
	};

	function passThroughWrite(buffer) {
	  return buffer.toString(this.encoding);
	}

	function utf16DetectIncompleteChar(buffer) {
	  this.charReceived = buffer.length % 2;
	  this.charLength = this.charReceived ? 2 : 0;
	}

	function base64DetectIncompleteChar(buffer) {
	  this.charReceived = buffer.length % 3;
	  this.charLength = this.charReceived ? 3 : 0;
	}

	Readable.ReadableState = ReadableState;

	var debug = debuglog('stream');
	inherits$3(Readable, EventEmitter);

	function prependListener(emitter, event, fn) {
	  // Sadly this is not cacheable as some libraries bundle their own
	  // event emitter implementation with them.
	  if (typeof emitter.prependListener === 'function') {
	    return emitter.prependListener(event, fn);
	  } else {
	    // This is a hack to make sure that our error handler is attached before any
	    // userland ones.  NEVER DO THIS. This is here only because this code needs
	    // to continue to work with older versions of Node.js that do not include
	    // the prependListener() method. The goal is to eventually remove this hack.
	    if (!emitter._events || !emitter._events[event])
	      emitter.on(event, fn);
	    else if (Array.isArray(emitter._events[event]))
	      emitter._events[event].unshift(fn);
	    else
	      emitter._events[event] = [fn, emitter._events[event]];
	  }
	}
	function listenerCount (emitter, type) {
	  return emitter.listeners(type).length;
	}
	function ReadableState(options, stream) {

	  options = options || {};

	  // object stream flag. Used to make read(n) ignore n and to
	  // make all the buffer merging and length checks go away
	  this.objectMode = !!options.objectMode;

	  if (stream instanceof Duplex) this.objectMode = this.objectMode || !!options.readableObjectMode;

	  // the point at which it stops calling _read() to fill the buffer
	  // Note: 0 is a valid value, means "don't call _read preemptively ever"
	  var hwm = options.highWaterMark;
	  var defaultHwm = this.objectMode ? 16 : 16 * 1024;
	  this.highWaterMark = hwm || hwm === 0 ? hwm : defaultHwm;

	  // cast to ints.
	  this.highWaterMark = ~ ~this.highWaterMark;

	  // A linked list is used to store data chunks instead of an array because the
	  // linked list can remove elements from the beginning faster than
	  // array.shift()
	  this.buffer = new BufferList();
	  this.length = 0;
	  this.pipes = null;
	  this.pipesCount = 0;
	  this.flowing = null;
	  this.ended = false;
	  this.endEmitted = false;
	  this.reading = false;

	  // a flag to be able to tell if the onwrite cb is called immediately,
	  // or on a later tick.  We set this to true at first, because any
	  // actions that shouldn't happen until "later" should generally also
	  // not happen before the first write call.
	  this.sync = true;

	  // whenever we return null, then we set a flag to say
	  // that we're awaiting a 'readable' event emission.
	  this.needReadable = false;
	  this.emittedReadable = false;
	  this.readableListening = false;
	  this.resumeScheduled = false;

	  // Crypto is kind of old and crusty.  Historically, its default string
	  // encoding is 'binary' so we have to make this configurable.
	  // Everything else in the universe uses 'utf8', though.
	  this.defaultEncoding = options.defaultEncoding || 'utf8';

	  // when piping, we only care about 'readable' events that happen
	  // after read()ing all the bytes and not getting any pushback.
	  this.ranOut = false;

	  // the number of writers that are awaiting a drain event in .pipe()s
	  this.awaitDrain = 0;

	  // if true, a maybeReadMore has been scheduled
	  this.readingMore = false;

	  this.decoder = null;
	  this.encoding = null;
	  if (options.encoding) {
	    this.decoder = new StringDecoder(options.encoding);
	    this.encoding = options.encoding;
	  }
	}
	function Readable(options) {

	  if (!(this instanceof Readable)) return new Readable(options);

	  this._readableState = new ReadableState(options, this);

	  // legacy
	  this.readable = true;

	  if (options && typeof options.read === 'function') this._read = options.read;

	  EventEmitter.call(this);
	}

	// Manually shove something into the read() buffer.
	// This returns true if the highWaterMark has not been hit yet,
	// similar to how Writable.write() returns true if you should
	// write() some more.
	Readable.prototype.push = function (chunk, encoding) {
	  var state = this._readableState;

	  if (!state.objectMode && typeof chunk === 'string') {
	    encoding = encoding || state.defaultEncoding;
	    if (encoding !== state.encoding) {
	      chunk = Buffer.from(chunk, encoding);
	      encoding = '';
	    }
	  }

	  return readableAddChunk(this, state, chunk, encoding, false);
	};

	// Unshift should *always* be something directly out of read()
	Readable.prototype.unshift = function (chunk) {
	  var state = this._readableState;
	  return readableAddChunk(this, state, chunk, '', true);
	};

	Readable.prototype.isPaused = function () {
	  return this._readableState.flowing === false;
	};

	function readableAddChunk(stream, state, chunk, encoding, addToFront) {
	  var er = chunkInvalid(state, chunk);
	  if (er) {
	    stream.emit('error', er);
	  } else if (chunk === null) {
	    state.reading = false;
	    onEofChunk(stream, state);
	  } else if (state.objectMode || chunk && chunk.length > 0) {
	    if (state.ended && !addToFront) {
	      var e = new Error('stream.push() after EOF');
	      stream.emit('error', e);
	    } else if (state.endEmitted && addToFront) {
	      var _e = new Error('stream.unshift() after end event');
	      stream.emit('error', _e);
	    } else {
	      var skipAdd;
	      if (state.decoder && !addToFront && !encoding) {
	        chunk = state.decoder.write(chunk);
	        skipAdd = !state.objectMode && chunk.length === 0;
	      }

	      if (!addToFront) state.reading = false;

	      // Don't add to the buffer if we've decoded to an empty string chunk and
	      // we're not in object mode
	      if (!skipAdd) {
	        // if we want the data now, just emit it.
	        if (state.flowing && state.length === 0 && !state.sync) {
	          stream.emit('data', chunk);
	          stream.read(0);
	        } else {
	          // update the buffer info.
	          state.length += state.objectMode ? 1 : chunk.length;
	          if (addToFront) state.buffer.unshift(chunk);else state.buffer.push(chunk);

	          if (state.needReadable) emitReadable(stream);
	        }
	      }

	      maybeReadMore(stream, state);
	    }
	  } else if (!addToFront) {
	    state.reading = false;
	  }

	  return needMoreData(state);
	}

	// if it's past the high water mark, we can push in some more.
	// Also, if we have no data yet, we can stand some
	// more bytes.  This is to work around cases where hwm=0,
	// such as the repl.  Also, if the push() triggered a
	// readable event, and the user called read(largeNumber) such that
	// needReadable was set, then we ought to push more, so that another
	// 'readable' event will be triggered.
	function needMoreData(state) {
	  return !state.ended && (state.needReadable || state.length < state.highWaterMark || state.length === 0);
	}

	// backwards compatibility.
	Readable.prototype.setEncoding = function (enc) {
	  this._readableState.decoder = new StringDecoder(enc);
	  this._readableState.encoding = enc;
	  return this;
	};

	// Don't raise the hwm > 8MB
	var MAX_HWM = 0x800000;
	function computeNewHighWaterMark(n) {
	  if (n >= MAX_HWM) {
	    n = MAX_HWM;
	  } else {
	    // Get the next highest power of 2 to prevent increasing hwm excessively in
	    // tiny amounts
	    n--;
	    n |= n >>> 1;
	    n |= n >>> 2;
	    n |= n >>> 4;
	    n |= n >>> 8;
	    n |= n >>> 16;
	    n++;
	  }
	  return n;
	}

	// This function is designed to be inlinable, so please take care when making
	// changes to the function body.
	function howMuchToRead(n, state) {
	  if (n <= 0 || state.length === 0 && state.ended) return 0;
	  if (state.objectMode) return 1;
	  if (n !== n) {
	    // Only flow one buffer at a time
	    if (state.flowing && state.length) return state.buffer.head.data.length;else return state.length;
	  }
	  // If we're asking for more than the current hwm, then raise the hwm.
	  if (n > state.highWaterMark) state.highWaterMark = computeNewHighWaterMark(n);
	  if (n <= state.length) return n;
	  // Don't have enough
	  if (!state.ended) {
	    state.needReadable = true;
	    return 0;
	  }
	  return state.length;
	}

	// you can override either this method, or the async _read(n) below.
	Readable.prototype.read = function (n) {
	  debug('read', n);
	  n = parseInt(n, 10);
	  var state = this._readableState;
	  var nOrig = n;

	  if (n !== 0) state.emittedReadable = false;

	  // if we're doing read(0) to trigger a readable event, but we
	  // already have a bunch of data in the buffer, then just trigger
	  // the 'readable' event and move on.
	  if (n === 0 && state.needReadable && (state.length >= state.highWaterMark || state.ended)) {
	    debug('read: emitReadable', state.length, state.ended);
	    if (state.length === 0 && state.ended) endReadable(this);else emitReadable(this);
	    return null;
	  }

	  n = howMuchToRead(n, state);

	  // if we've ended, and we're now clear, then finish it up.
	  if (n === 0 && state.ended) {
	    if (state.length === 0) endReadable(this);
	    return null;
	  }

	  // All the actual chunk generation logic needs to be
	  // *below* the call to _read.  The reason is that in certain
	  // synthetic stream cases, such as passthrough streams, _read
	  // may be a completely synchronous operation which may change
	  // the state of the read buffer, providing enough data when
	  // before there was *not* enough.
	  //
	  // So, the steps are:
	  // 1. Figure out what the state of things will be after we do
	  // a read from the buffer.
	  //
	  // 2. If that resulting state will trigger a _read, then call _read.
	  // Note that this may be asynchronous, or synchronous.  Yes, it is
	  // deeply ugly to write APIs this way, but that still doesn't mean
	  // that the Readable class should behave improperly, as streams are
	  // designed to be sync/async agnostic.
	  // Take note if the _read call is sync or async (ie, if the read call
	  // has returned yet), so that we know whether or not it's safe to emit
	  // 'readable' etc.
	  //
	  // 3. Actually pull the requested chunks out of the buffer and return.

	  // if we need a readable event, then we need to do some reading.
	  var doRead = state.needReadable;
	  debug('need readable', doRead);

	  // if we currently have less than the highWaterMark, then also read some
	  if (state.length === 0 || state.length - n < state.highWaterMark) {
	    doRead = true;
	    debug('length less than watermark', doRead);
	  }

	  // however, if we've ended, then there's no point, and if we're already
	  // reading, then it's unnecessary.
	  if (state.ended || state.reading) {
	    doRead = false;
	    debug('reading or ended', doRead);
	  } else if (doRead) {
	    debug('do read');
	    state.reading = true;
	    state.sync = true;
	    // if the length is currently zero, then we *need* a readable event.
	    if (state.length === 0) state.needReadable = true;
	    // call internal read method
	    this._read(state.highWaterMark);
	    state.sync = false;
	    // If _read pushed data synchronously, then `reading` will be false,
	    // and we need to re-evaluate how much data we can return to the user.
	    if (!state.reading) n = howMuchToRead(nOrig, state);
	  }

	  var ret;
	  if (n > 0) ret = fromList(n, state);else ret = null;

	  if (ret === null) {
	    state.needReadable = true;
	    n = 0;
	  } else {
	    state.length -= n;
	  }

	  if (state.length === 0) {
	    // If we have nothing in the buffer, then we want to know
	    // as soon as we *do* get something into the buffer.
	    if (!state.ended) state.needReadable = true;

	    // If we tried to read() past the EOF, then emit end on the next tick.
	    if (nOrig !== n && state.ended) endReadable(this);
	  }

	  if (ret !== null) this.emit('data', ret);

	  return ret;
	};

	function chunkInvalid(state, chunk) {
	  var er = null;
	  if (!isBuffer$1(chunk) && typeof chunk !== 'string' && chunk !== null && chunk !== undefined && !state.objectMode) {
	    er = new TypeError('Invalid non-string/buffer chunk');
	  }
	  return er;
	}

	function onEofChunk(stream, state) {
	  if (state.ended) return;
	  if (state.decoder) {
	    var chunk = state.decoder.end();
	    if (chunk && chunk.length) {
	      state.buffer.push(chunk);
	      state.length += state.objectMode ? 1 : chunk.length;
	    }
	  }
	  state.ended = true;

	  // emit 'readable' now to make sure it gets picked up.
	  emitReadable(stream);
	}

	// Don't emit readable right away in sync mode, because this can trigger
	// another read() call => stack overflow.  This way, it might trigger
	// a nextTick recursion warning, but that's not so bad.
	function emitReadable(stream) {
	  var state = stream._readableState;
	  state.needReadable = false;
	  if (!state.emittedReadable) {
	    debug('emitReadable', state.flowing);
	    state.emittedReadable = true;
	    if (state.sync) nextTick(emitReadable_, stream);else emitReadable_(stream);
	  }
	}

	function emitReadable_(stream) {
	  debug('emit readable');
	  stream.emit('readable');
	  flow(stream);
	}

	// at this point, the user has presumably seen the 'readable' event,
	// and called read() to consume some data.  that may have triggered
	// in turn another _read(n) call, in which case reading = true if
	// it's in progress.
	// However, if we're not ended, or reading, and the length < hwm,
	// then go ahead and try to read some more preemptively.
	function maybeReadMore(stream, state) {
	  if (!state.readingMore) {
	    state.readingMore = true;
	    nextTick(maybeReadMore_, stream, state);
	  }
	}

	function maybeReadMore_(stream, state) {
	  var len = state.length;
	  while (!state.reading && !state.flowing && !state.ended && state.length < state.highWaterMark) {
	    debug('maybeReadMore read 0');
	    stream.read(0);
	    if (len === state.length)
	      // didn't get any data, stop spinning.
	      break;else len = state.length;
	  }
	  state.readingMore = false;
	}

	// abstract method.  to be overridden in specific implementation classes.
	// call cb(er, data) where data is <= n in length.
	// for virtual (non-string, non-buffer) streams, "length" is somewhat
	// arbitrary, and perhaps not very meaningful.
	Readable.prototype._read = function (n) {
	  this.emit('error', new Error('not implemented'));
	};

	Readable.prototype.pipe = function (dest, pipeOpts) {
	  var src = this;
	  var state = this._readableState;

	  switch (state.pipesCount) {
	    case 0:
	      state.pipes = dest;
	      break;
	    case 1:
	      state.pipes = [state.pipes, dest];
	      break;
	    default:
	      state.pipes.push(dest);
	      break;
	  }
	  state.pipesCount += 1;
	  debug('pipe count=%d opts=%j', state.pipesCount, pipeOpts);

	  var doEnd = (!pipeOpts || pipeOpts.end !== false);

	  var endFn = doEnd ? onend : cleanup;
	  if (state.endEmitted) nextTick(endFn);else src.once('end', endFn);

	  dest.on('unpipe', onunpipe);
	  function onunpipe(readable) {
	    debug('onunpipe');
	    if (readable === src) {
	      cleanup();
	    }
	  }

	  function onend() {
	    debug('onend');
	    dest.end();
	  }

	  // when the dest drains, it reduces the awaitDrain counter
	  // on the source.  This would be more elegant with a .once()
	  // handler in flow(), but adding and removing repeatedly is
	  // too slow.
	  var ondrain = pipeOnDrain(src);
	  dest.on('drain', ondrain);

	  var cleanedUp = false;
	  function cleanup() {
	    debug('cleanup');
	    // cleanup event handlers once the pipe is broken
	    dest.removeListener('close', onclose);
	    dest.removeListener('finish', onfinish);
	    dest.removeListener('drain', ondrain);
	    dest.removeListener('error', onerror);
	    dest.removeListener('unpipe', onunpipe);
	    src.removeListener('end', onend);
	    src.removeListener('end', cleanup);
	    src.removeListener('data', ondata);

	    cleanedUp = true;

	    // if the reader is waiting for a drain event from this
	    // specific writer, then it would cause it to never start
	    // flowing again.
	    // So, if this is awaiting a drain, then we just call it now.
	    // If we don't know, then assume that we are waiting for one.
	    if (state.awaitDrain && (!dest._writableState || dest._writableState.needDrain)) ondrain();
	  }

	  // If the user pushes more data while we're writing to dest then we'll end up
	  // in ondata again. However, we only want to increase awaitDrain once because
	  // dest will only emit one 'drain' event for the multiple writes.
	  // => Introduce a guard on increasing awaitDrain.
	  var increasedAwaitDrain = false;
	  src.on('data', ondata);
	  function ondata(chunk) {
	    debug('ondata');
	    increasedAwaitDrain = false;
	    var ret = dest.write(chunk);
	    if (false === ret && !increasedAwaitDrain) {
	      // If the user unpiped during `dest.write()`, it is possible
	      // to get stuck in a permanently paused state if that write
	      // also returned false.
	      // => Check whether `dest` is still a piping destination.
	      if ((state.pipesCount === 1 && state.pipes === dest || state.pipesCount > 1 && indexOf(state.pipes, dest) !== -1) && !cleanedUp) {
	        debug('false write response, pause', src._readableState.awaitDrain);
	        src._readableState.awaitDrain++;
	        increasedAwaitDrain = true;
	      }
	      src.pause();
	    }
	  }

	  // if the dest has an error, then stop piping into it.
	  // however, don't suppress the throwing behavior for this.
	  function onerror(er) {
	    debug('onerror', er);
	    unpipe();
	    dest.removeListener('error', onerror);
	    if (listenerCount(dest, 'error') === 0) dest.emit('error', er);
	  }

	  // Make sure our error handler is attached before userland ones.
	  prependListener(dest, 'error', onerror);

	  // Both close and finish should trigger unpipe, but only once.
	  function onclose() {
	    dest.removeListener('finish', onfinish);
	    unpipe();
	  }
	  dest.once('close', onclose);
	  function onfinish() {
	    debug('onfinish');
	    dest.removeListener('close', onclose);
	    unpipe();
	  }
	  dest.once('finish', onfinish);

	  function unpipe() {
	    debug('unpipe');
	    src.unpipe(dest);
	  }

	  // tell the dest that it's being piped to
	  dest.emit('pipe', src);

	  // start the flow if it hasn't been started already.
	  if (!state.flowing) {
	    debug('pipe resume');
	    src.resume();
	  }

	  return dest;
	};

	function pipeOnDrain(src) {
	  return function () {
	    var state = src._readableState;
	    debug('pipeOnDrain', state.awaitDrain);
	    if (state.awaitDrain) state.awaitDrain--;
	    if (state.awaitDrain === 0 && src.listeners('data').length) {
	      state.flowing = true;
	      flow(src);
	    }
	  };
	}

	Readable.prototype.unpipe = function (dest) {
	  var state = this._readableState;

	  // if we're not piping anywhere, then do nothing.
	  if (state.pipesCount === 0) return this;

	  // just one destination.  most common case.
	  if (state.pipesCount === 1) {
	    // passed in one, but it's not the right one.
	    if (dest && dest !== state.pipes) return this;

	    if (!dest) dest = state.pipes;

	    // got a match.
	    state.pipes = null;
	    state.pipesCount = 0;
	    state.flowing = false;
	    if (dest) dest.emit('unpipe', this);
	    return this;
	  }

	  // slow case. multiple pipe destinations.

	  if (!dest) {
	    // remove all.
	    var dests = state.pipes;
	    var len = state.pipesCount;
	    state.pipes = null;
	    state.pipesCount = 0;
	    state.flowing = false;

	    for (var _i = 0; _i < len; _i++) {
	      dests[_i].emit('unpipe', this);
	    }return this;
	  }

	  // try to find the right one.
	  var i = indexOf(state.pipes, dest);
	  if (i === -1) return this;

	  state.pipes.splice(i, 1);
	  state.pipesCount -= 1;
	  if (state.pipesCount === 1) state.pipes = state.pipes[0];

	  dest.emit('unpipe', this);

	  return this;
	};

	// set up data events if they are asked for
	// Ensure readable listeners eventually get something
	Readable.prototype.on = function (ev, fn) {
	  var res = EventEmitter.prototype.on.call(this, ev, fn);

	  if (ev === 'data') {
	    // Start flowing on next tick if stream isn't explicitly paused
	    if (this._readableState.flowing !== false) this.resume();
	  } else if (ev === 'readable') {
	    var state = this._readableState;
	    if (!state.endEmitted && !state.readableListening) {
	      state.readableListening = state.needReadable = true;
	      state.emittedReadable = false;
	      if (!state.reading) {
	        nextTick(nReadingNextTick, this);
	      } else if (state.length) {
	        emitReadable(this);
	      }
	    }
	  }

	  return res;
	};
	Readable.prototype.addListener = Readable.prototype.on;

	function nReadingNextTick(self) {
	  debug('readable nexttick read 0');
	  self.read(0);
	}

	// pause() and resume() are remnants of the legacy readable stream API
	// If the user uses them, then switch into old mode.
	Readable.prototype.resume = function () {
	  var state = this._readableState;
	  if (!state.flowing) {
	    debug('resume');
	    state.flowing = true;
	    resume(this, state);
	  }
	  return this;
	};

	function resume(stream, state) {
	  if (!state.resumeScheduled) {
	    state.resumeScheduled = true;
	    nextTick(resume_, stream, state);
	  }
	}

	function resume_(stream, state) {
	  if (!state.reading) {
	    debug('resume read 0');
	    stream.read(0);
	  }

	  state.resumeScheduled = false;
	  state.awaitDrain = 0;
	  stream.emit('resume');
	  flow(stream);
	  if (state.flowing && !state.reading) stream.read(0);
	}

	Readable.prototype.pause = function () {
	  debug('call pause flowing=%j', this._readableState.flowing);
	  if (false !== this._readableState.flowing) {
	    debug('pause');
	    this._readableState.flowing = false;
	    this.emit('pause');
	  }
	  return this;
	};

	function flow(stream) {
	  var state = stream._readableState;
	  debug('flow', state.flowing);
	  while (state.flowing && stream.read() !== null) {}
	}

	// wrap an old-style stream as the async data source.
	// This is *not* part of the readable stream interface.
	// It is an ugly unfortunate mess of history.
	Readable.prototype.wrap = function (stream) {
	  var state = this._readableState;
	  var paused = false;

	  var self = this;
	  stream.on('end', function () {
	    debug('wrapped end');
	    if (state.decoder && !state.ended) {
	      var chunk = state.decoder.end();
	      if (chunk && chunk.length) self.push(chunk);
	    }

	    self.push(null);
	  });

	  stream.on('data', function (chunk) {
	    debug('wrapped data');
	    if (state.decoder) chunk = state.decoder.write(chunk);

	    // don't skip over falsy values in objectMode
	    if (state.objectMode && (chunk === null || chunk === undefined)) return;else if (!state.objectMode && (!chunk || !chunk.length)) return;

	    var ret = self.push(chunk);
	    if (!ret) {
	      paused = true;
	      stream.pause();
	    }
	  });

	  // proxy all the other methods.
	  // important when wrapping filters and duplexes.
	  for (var i in stream) {
	    if (this[i] === undefined && typeof stream[i] === 'function') {
	      this[i] = function (method) {
	        return function () {
	          return stream[method].apply(stream, arguments);
	        };
	      }(i);
	    }
	  }

	  // proxy certain important events.
	  var events = ['error', 'close', 'destroy', 'pause', 'resume'];
	  forEach(events, function (ev) {
	    stream.on(ev, self.emit.bind(self, ev));
	  });

	  // when we try to consume some more bytes, simply unpause the
	  // underlying stream.
	  self._read = function (n) {
	    debug('wrapped _read', n);
	    if (paused) {
	      paused = false;
	      stream.resume();
	    }
	  };

	  return self;
	};

	// exposed for testing purposes only.
	Readable._fromList = fromList;

	// Pluck off n bytes from an array of buffers.
	// Length is the combined lengths of all the buffers in the list.
	// This function is designed to be inlinable, so please take care when making
	// changes to the function body.
	function fromList(n, state) {
	  // nothing buffered
	  if (state.length === 0) return null;

	  var ret;
	  if (state.objectMode) ret = state.buffer.shift();else if (!n || n >= state.length) {
	    // read it all, truncate the list
	    if (state.decoder) ret = state.buffer.join('');else if (state.buffer.length === 1) ret = state.buffer.head.data;else ret = state.buffer.concat(state.length);
	    state.buffer.clear();
	  } else {
	    // read part of list
	    ret = fromListPartial(n, state.buffer, state.decoder);
	  }

	  return ret;
	}

	// Extracts only enough buffered data to satisfy the amount requested.
	// This function is designed to be inlinable, so please take care when making
	// changes to the function body.
	function fromListPartial(n, list, hasStrings) {
	  var ret;
	  if (n < list.head.data.length) {
	    // slice is the same for buffers and strings
	    ret = list.head.data.slice(0, n);
	    list.head.data = list.head.data.slice(n);
	  } else if (n === list.head.data.length) {
	    // first chunk is a perfect match
	    ret = list.shift();
	  } else {
	    // result spans more than one buffer
	    ret = hasStrings ? copyFromBufferString(n, list) : copyFromBuffer(n, list);
	  }
	  return ret;
	}

	// Copies a specified amount of characters from the list of buffered data
	// chunks.
	// This function is designed to be inlinable, so please take care when making
	// changes to the function body.
	function copyFromBufferString(n, list) {
	  var p = list.head;
	  var c = 1;
	  var ret = p.data;
	  n -= ret.length;
	  while (p = p.next) {
	    var str = p.data;
	    var nb = n > str.length ? str.length : n;
	    if (nb === str.length) ret += str;else ret += str.slice(0, n);
	    n -= nb;
	    if (n === 0) {
	      if (nb === str.length) {
	        ++c;
	        if (p.next) list.head = p.next;else list.head = list.tail = null;
	      } else {
	        list.head = p;
	        p.data = str.slice(nb);
	      }
	      break;
	    }
	    ++c;
	  }
	  list.length -= c;
	  return ret;
	}

	// Copies a specified amount of bytes from the list of buffered data chunks.
	// This function is designed to be inlinable, so please take care when making
	// changes to the function body.
	function copyFromBuffer(n, list) {
	  var ret = Buffer.allocUnsafe(n);
	  var p = list.head;
	  var c = 1;
	  p.data.copy(ret);
	  n -= p.data.length;
	  while (p = p.next) {
	    var buf = p.data;
	    var nb = n > buf.length ? buf.length : n;
	    buf.copy(ret, ret.length - n, 0, nb);
	    n -= nb;
	    if (n === 0) {
	      if (nb === buf.length) {
	        ++c;
	        if (p.next) list.head = p.next;else list.head = list.tail = null;
	      } else {
	        list.head = p;
	        p.data = buf.slice(nb);
	      }
	      break;
	    }
	    ++c;
	  }
	  list.length -= c;
	  return ret;
	}

	function endReadable(stream) {
	  var state = stream._readableState;

	  // If we get here before consuming all the bytes, then that is a
	  // bug in node.  Should never happen.
	  if (state.length > 0) throw new Error('"endReadable()" called on non-empty stream');

	  if (!state.endEmitted) {
	    state.ended = true;
	    nextTick(endReadableNT, state, stream);
	  }
	}

	function endReadableNT(state, stream) {
	  // Check that we didn't get one last unshift.
	  if (!state.endEmitted && state.length === 0) {
	    state.endEmitted = true;
	    stream.readable = false;
	    stream.emit('end');
	  }
	}

	function forEach(xs, f) {
	  for (var i = 0, l = xs.length; i < l; i++) {
	    f(xs[i], i);
	  }
	}

	function indexOf(xs, x) {
	  for (var i = 0, l = xs.length; i < l; i++) {
	    if (xs[i] === x) return i;
	  }
	  return -1;
	}

	// A bit simpler than readable streams.
	Writable.WritableState = WritableState;
	inherits$3(Writable, EventEmitter);

	function nop() {}

	function WriteReq(chunk, encoding, cb) {
	  this.chunk = chunk;
	  this.encoding = encoding;
	  this.callback = cb;
	  this.next = null;
	}

	function WritableState(options, stream) {
	  Object.defineProperty(this, 'buffer', {
	    get: deprecate(function () {
	      return this.getBuffer();
	    }, '_writableState.buffer is deprecated. Use _writableState.getBuffer ' + 'instead.')
	  });
	  options = options || {};

	  // object stream flag to indicate whether or not this stream
	  // contains buffers or objects.
	  this.objectMode = !!options.objectMode;

	  if (stream instanceof Duplex) this.objectMode = this.objectMode || !!options.writableObjectMode;

	  // the point at which write() starts returning false
	  // Note: 0 is a valid value, means that we always return false if
	  // the entire buffer is not flushed immediately on write()
	  var hwm = options.highWaterMark;
	  var defaultHwm = this.objectMode ? 16 : 16 * 1024;
	  this.highWaterMark = hwm || hwm === 0 ? hwm : defaultHwm;

	  // cast to ints.
	  this.highWaterMark = ~ ~this.highWaterMark;

	  this.needDrain = false;
	  // at the start of calling end()
	  this.ending = false;
	  // when end() has been called, and returned
	  this.ended = false;
	  // when 'finish' is emitted
	  this.finished = false;

	  // should we decode strings into buffers before passing to _write?
	  // this is here so that some node-core streams can optimize string
	  // handling at a lower level.
	  var noDecode = options.decodeStrings === false;
	  this.decodeStrings = !noDecode;

	  // Crypto is kind of old and crusty.  Historically, its default string
	  // encoding is 'binary' so we have to make this configurable.
	  // Everything else in the universe uses 'utf8', though.
	  this.defaultEncoding = options.defaultEncoding || 'utf8';

	  // not an actual buffer we keep track of, but a measurement
	  // of how much we're waiting to get pushed to some underlying
	  // socket or file.
	  this.length = 0;

	  // a flag to see when we're in the middle of a write.
	  this.writing = false;

	  // when true all writes will be buffered until .uncork() call
	  this.corked = 0;

	  // a flag to be able to tell if the onwrite cb is called immediately,
	  // or on a later tick.  We set this to true at first, because any
	  // actions that shouldn't happen until "later" should generally also
	  // not happen before the first write call.
	  this.sync = true;

	  // a flag to know if we're processing previously buffered items, which
	  // may call the _write() callback in the same tick, so that we don't
	  // end up in an overlapped onwrite situation.
	  this.bufferProcessing = false;

	  // the callback that's passed to _write(chunk,cb)
	  this.onwrite = function (er) {
	    onwrite(stream, er);
	  };

	  // the callback that the user supplies to write(chunk,encoding,cb)
	  this.writecb = null;

	  // the amount that is being written when _write is called.
	  this.writelen = 0;

	  this.bufferedRequest = null;
	  this.lastBufferedRequest = null;

	  // number of pending user-supplied write callbacks
	  // this must be 0 before 'finish' can be emitted
	  this.pendingcb = 0;

	  // emit prefinish if the only thing we're waiting for is _write cbs
	  // This is relevant for synchronous Transform streams
	  this.prefinished = false;

	  // True if the error was already emitted and should not be thrown again
	  this.errorEmitted = false;

	  // count buffered requests
	  this.bufferedRequestCount = 0;

	  // allocate the first CorkedRequest, there is always
	  // one allocated and free to use, and we maintain at most two
	  this.corkedRequestsFree = new CorkedRequest(this);
	}

	WritableState.prototype.getBuffer = function writableStateGetBuffer() {
	  var current = this.bufferedRequest;
	  var out = [];
	  while (current) {
	    out.push(current);
	    current = current.next;
	  }
	  return out;
	};
	function Writable(options) {

	  // Writable ctor is applied to Duplexes, though they're not
	  // instanceof Writable, they're instanceof Readable.
	  if (!(this instanceof Writable) && !(this instanceof Duplex)) return new Writable(options);

	  this._writableState = new WritableState(options, this);

	  // legacy.
	  this.writable = true;

	  if (options) {
	    if (typeof options.write === 'function') this._write = options.write;

	    if (typeof options.writev === 'function') this._writev = options.writev;
	  }

	  EventEmitter.call(this);
	}

	// Otherwise people can pipe Writable streams, which is just wrong.
	Writable.prototype.pipe = function () {
	  this.emit('error', new Error('Cannot pipe, not readable'));
	};

	function writeAfterEnd(stream, cb) {
	  var er = new Error('write after end');
	  // TODO: defer error events consistently everywhere, not just the cb
	  stream.emit('error', er);
	  nextTick(cb, er);
	}

	// If we get something that is not a buffer, string, null, or undefined,
	// and we're not in objectMode, then that's an error.
	// Otherwise stream chunks are all considered to be of length=1, and the
	// watermarks determine how many objects to keep in the buffer, rather than
	// how many bytes or characters.
	function validChunk(stream, state, chunk, cb) {
	  var valid = true;
	  var er = false;
	  // Always throw error if a null is written
	  // if we are not in object mode then throw
	  // if it is not a buffer, string, or undefined.
	  if (chunk === null) {
	    er = new TypeError('May not write null values to stream');
	  } else if (!Buffer.isBuffer(chunk) && typeof chunk !== 'string' && chunk !== undefined && !state.objectMode) {
	    er = new TypeError('Invalid non-string/buffer chunk');
	  }
	  if (er) {
	    stream.emit('error', er);
	    nextTick(cb, er);
	    valid = false;
	  }
	  return valid;
	}

	Writable.prototype.write = function (chunk, encoding, cb) {
	  var state = this._writableState;
	  var ret = false;

	  if (typeof encoding === 'function') {
	    cb = encoding;
	    encoding = null;
	  }

	  if (Buffer.isBuffer(chunk)) encoding = 'buffer';else if (!encoding) encoding = state.defaultEncoding;

	  if (typeof cb !== 'function') cb = nop;

	  if (state.ended) writeAfterEnd(this, cb);else if (validChunk(this, state, chunk, cb)) {
	    state.pendingcb++;
	    ret = writeOrBuffer(this, state, chunk, encoding, cb);
	  }

	  return ret;
	};

	Writable.prototype.cork = function () {
	  var state = this._writableState;

	  state.corked++;
	};

	Writable.prototype.uncork = function () {
	  var state = this._writableState;

	  if (state.corked) {
	    state.corked--;

	    if (!state.writing && !state.corked && !state.finished && !state.bufferProcessing && state.bufferedRequest) clearBuffer(this, state);
	  }
	};

	Writable.prototype.setDefaultEncoding = function setDefaultEncoding(encoding) {
	  // node::ParseEncoding() requires lower case.
	  if (typeof encoding === 'string') encoding = encoding.toLowerCase();
	  if (!(['hex', 'utf8', 'utf-8', 'ascii', 'binary', 'base64', 'ucs2', 'ucs-2', 'utf16le', 'utf-16le', 'raw'].indexOf((encoding + '').toLowerCase()) > -1)) throw new TypeError('Unknown encoding: ' + encoding);
	  this._writableState.defaultEncoding = encoding;
	  return this;
	};

	function decodeChunk(state, chunk, encoding) {
	  if (!state.objectMode && state.decodeStrings !== false && typeof chunk === 'string') {
	    chunk = Buffer.from(chunk, encoding);
	  }
	  return chunk;
	}

	// if we're already writing something, then just put this
	// in the queue, and wait our turn.  Otherwise, call _write
	// If we return false, then we need a drain event, so set that flag.
	function writeOrBuffer(stream, state, chunk, encoding, cb) {
	  chunk = decodeChunk(state, chunk, encoding);

	  if (Buffer.isBuffer(chunk)) encoding = 'buffer';
	  var len = state.objectMode ? 1 : chunk.length;

	  state.length += len;

	  var ret = state.length < state.highWaterMark;
	  // we must ensure that previous needDrain will not be reset to false.
	  if (!ret) state.needDrain = true;

	  if (state.writing || state.corked) {
	    var last = state.lastBufferedRequest;
	    state.lastBufferedRequest = new WriteReq(chunk, encoding, cb);
	    if (last) {
	      last.next = state.lastBufferedRequest;
	    } else {
	      state.bufferedRequest = state.lastBufferedRequest;
	    }
	    state.bufferedRequestCount += 1;
	  } else {
	    doWrite(stream, state, false, len, chunk, encoding, cb);
	  }

	  return ret;
	}

	function doWrite(stream, state, writev, len, chunk, encoding, cb) {
	  state.writelen = len;
	  state.writecb = cb;
	  state.writing = true;
	  state.sync = true;
	  if (writev) stream._writev(chunk, state.onwrite);else stream._write(chunk, encoding, state.onwrite);
	  state.sync = false;
	}

	function onwriteError(stream, state, sync, er, cb) {
	  --state.pendingcb;
	  if (sync) nextTick(cb, er);else cb(er);

	  stream._writableState.errorEmitted = true;
	  stream.emit('error', er);
	}

	function onwriteStateUpdate(state) {
	  state.writing = false;
	  state.writecb = null;
	  state.length -= state.writelen;
	  state.writelen = 0;
	}

	function onwrite(stream, er) {
	  var state = stream._writableState;
	  var sync = state.sync;
	  var cb = state.writecb;

	  onwriteStateUpdate(state);

	  if (er) onwriteError(stream, state, sync, er, cb);else {
	    // Check if we're actually ready to finish, but don't emit yet
	    var finished = needFinish(state);

	    if (!finished && !state.corked && !state.bufferProcessing && state.bufferedRequest) {
	      clearBuffer(stream, state);
	    }

	    if (sync) {
	      /*<replacement>*/
	        nextTick(afterWrite, stream, state, finished, cb);
	      /*</replacement>*/
	    } else {
	        afterWrite(stream, state, finished, cb);
	      }
	  }
	}

	function afterWrite(stream, state, finished, cb) {
	  if (!finished) onwriteDrain(stream, state);
	  state.pendingcb--;
	  cb();
	  finishMaybe(stream, state);
	}

	// Must force callback to be called on nextTick, so that we don't
	// emit 'drain' before the write() consumer gets the 'false' return
	// value, and has a chance to attach a 'drain' listener.
	function onwriteDrain(stream, state) {
	  if (state.length === 0 && state.needDrain) {
	    state.needDrain = false;
	    stream.emit('drain');
	  }
	}

	// if there's something in the buffer waiting, then process it
	function clearBuffer(stream, state) {
	  state.bufferProcessing = true;
	  var entry = state.bufferedRequest;

	  if (stream._writev && entry && entry.next) {
	    // Fast case, write everything using _writev()
	    var l = state.bufferedRequestCount;
	    var buffer = new Array(l);
	    var holder = state.corkedRequestsFree;
	    holder.entry = entry;

	    var count = 0;
	    while (entry) {
	      buffer[count] = entry;
	      entry = entry.next;
	      count += 1;
	    }

	    doWrite(stream, state, true, state.length, buffer, '', holder.finish);

	    // doWrite is almost always async, defer these to save a bit of time
	    // as the hot path ends with doWrite
	    state.pendingcb++;
	    state.lastBufferedRequest = null;
	    if (holder.next) {
	      state.corkedRequestsFree = holder.next;
	      holder.next = null;
	    } else {
	      state.corkedRequestsFree = new CorkedRequest(state);
	    }
	  } else {
	    // Slow case, write chunks one-by-one
	    while (entry) {
	      var chunk = entry.chunk;
	      var encoding = entry.encoding;
	      var cb = entry.callback;
	      var len = state.objectMode ? 1 : chunk.length;

	      doWrite(stream, state, false, len, chunk, encoding, cb);
	      entry = entry.next;
	      // if we didn't call the onwrite immediately, then
	      // it means that we need to wait until it does.
	      // also, that means that the chunk and cb are currently
	      // being processed, so move the buffer counter past them.
	      if (state.writing) {
	        break;
	      }
	    }

	    if (entry === null) state.lastBufferedRequest = null;
	  }

	  state.bufferedRequestCount = 0;
	  state.bufferedRequest = entry;
	  state.bufferProcessing = false;
	}

	Writable.prototype._write = function (chunk, encoding, cb) {
	  cb(new Error('not implemented'));
	};

	Writable.prototype._writev = null;

	Writable.prototype.end = function (chunk, encoding, cb) {
	  var state = this._writableState;

	  if (typeof chunk === 'function') {
	    cb = chunk;
	    chunk = null;
	    encoding = null;
	  } else if (typeof encoding === 'function') {
	    cb = encoding;
	    encoding = null;
	  }

	  if (chunk !== null && chunk !== undefined) this.write(chunk, encoding);

	  // .end() fully uncorks
	  if (state.corked) {
	    state.corked = 1;
	    this.uncork();
	  }

	  // ignore unnecessary end() calls.
	  if (!state.ending && !state.finished) endWritable(this, state, cb);
	};

	function needFinish(state) {
	  return state.ending && state.length === 0 && state.bufferedRequest === null && !state.finished && !state.writing;
	}

	function prefinish(stream, state) {
	  if (!state.prefinished) {
	    state.prefinished = true;
	    stream.emit('prefinish');
	  }
	}

	function finishMaybe(stream, state) {
	  var need = needFinish(state);
	  if (need) {
	    if (state.pendingcb === 0) {
	      prefinish(stream, state);
	      state.finished = true;
	      stream.emit('finish');
	    } else {
	      prefinish(stream, state);
	    }
	  }
	  return need;
	}

	function endWritable(stream, state, cb) {
	  state.ending = true;
	  finishMaybe(stream, state);
	  if (cb) {
	    if (state.finished) nextTick(cb);else stream.once('finish', cb);
	  }
	  state.ended = true;
	  stream.writable = false;
	}

	// It seems a linked list but it is not
	// there will be only 2 of these for each stream
	function CorkedRequest(state) {
	  var _this = this;

	  this.next = null;
	  this.entry = null;

	  this.finish = function (err) {
	    var entry = _this.entry;
	    _this.entry = null;
	    while (entry) {
	      var cb = entry.callback;
	      state.pendingcb--;
	      cb(err);
	      entry = entry.next;
	    }
	    if (state.corkedRequestsFree) {
	      state.corkedRequestsFree.next = _this;
	    } else {
	      state.corkedRequestsFree = _this;
	    }
	  };
	}

	inherits$3(Duplex, Readable);

	var keys = Object.keys(Writable.prototype);
	for (var v = 0; v < keys.length; v++) {
	  var method = keys[v];
	  if (!Duplex.prototype[method]) Duplex.prototype[method] = Writable.prototype[method];
	}
	function Duplex(options) {
	  if (!(this instanceof Duplex)) return new Duplex(options);

	  Readable.call(this, options);
	  Writable.call(this, options);

	  if (options && options.readable === false) this.readable = false;

	  if (options && options.writable === false) this.writable = false;

	  this.allowHalfOpen = true;
	  if (options && options.allowHalfOpen === false) this.allowHalfOpen = false;

	  this.once('end', onend);
	}

	// the no-half-open enforcer
	function onend() {
	  // if we allow half-open state, or if the writable side ended,
	  // then we're ok.
	  if (this.allowHalfOpen || this._writableState.ended) return;

	  // no more data can be written.
	  // But allow more writes to happen in this tick.
	  nextTick(onEndNT, this);
	}

	function onEndNT(self) {
	  self.end();
	}

	// a transform stream is a readable/writable stream where you do
	inherits$3(Transform, Duplex);

	function TransformState(stream) {
	  this.afterTransform = function (er, data) {
	    return afterTransform(stream, er, data);
	  };

	  this.needTransform = false;
	  this.transforming = false;
	  this.writecb = null;
	  this.writechunk = null;
	  this.writeencoding = null;
	}

	function afterTransform(stream, er, data) {
	  var ts = stream._transformState;
	  ts.transforming = false;

	  var cb = ts.writecb;

	  if (!cb) return stream.emit('error', new Error('no writecb in Transform class'));

	  ts.writechunk = null;
	  ts.writecb = null;

	  if (data !== null && data !== undefined) stream.push(data);

	  cb(er);

	  var rs = stream._readableState;
	  rs.reading = false;
	  if (rs.needReadable || rs.length < rs.highWaterMark) {
	    stream._read(rs.highWaterMark);
	  }
	}
	function Transform(options) {
	  if (!(this instanceof Transform)) return new Transform(options);

	  Duplex.call(this, options);

	  this._transformState = new TransformState(this);

	  // when the writable side finishes, then flush out anything remaining.
	  var stream = this;

	  // start out asking for a readable event once data is transformed.
	  this._readableState.needReadable = true;

	  // we have implemented the _read method, and done the other things
	  // that Readable wants before the first _read call, so unset the
	  // sync guard flag.
	  this._readableState.sync = false;

	  if (options) {
	    if (typeof options.transform === 'function') this._transform = options.transform;

	    if (typeof options.flush === 'function') this._flush = options.flush;
	  }

	  this.once('prefinish', function () {
	    if (typeof this._flush === 'function') this._flush(function (er) {
	      done(stream, er);
	    });else done(stream);
	  });
	}

	Transform.prototype.push = function (chunk, encoding) {
	  this._transformState.needTransform = false;
	  return Duplex.prototype.push.call(this, chunk, encoding);
	};

	// This is the part where you do stuff!
	// override this function in implementation classes.
	// 'chunk' is an input chunk.
	//
	// Call `push(newChunk)` to pass along transformed output
	// to the readable side.  You may call 'push' zero or more times.
	//
	// Call `cb(err)` when you are done with this chunk.  If you pass
	// an error, then that'll put the hurt on the whole operation.  If you
	// never call cb(), then you'll never get another chunk.
	Transform.prototype._transform = function (chunk, encoding, cb) {
	  throw new Error('Not implemented');
	};

	Transform.prototype._write = function (chunk, encoding, cb) {
	  var ts = this._transformState;
	  ts.writecb = cb;
	  ts.writechunk = chunk;
	  ts.writeencoding = encoding;
	  if (!ts.transforming) {
	    var rs = this._readableState;
	    if (ts.needTransform || rs.needReadable || rs.length < rs.highWaterMark) this._read(rs.highWaterMark);
	  }
	};

	// Doesn't matter what the args are here.
	// _transform does all the work.
	// That we got here means that the readable side wants more data.
	Transform.prototype._read = function (n) {
	  var ts = this._transformState;

	  if (ts.writechunk !== null && ts.writecb && !ts.transforming) {
	    ts.transforming = true;
	    this._transform(ts.writechunk, ts.writeencoding, ts.afterTransform);
	  } else {
	    // mark that we need a transform, so that any data that comes in
	    // will get processed, now that we've asked for it.
	    ts.needTransform = true;
	  }
	};

	function done(stream, er) {
	  if (er) return stream.emit('error', er);

	  // if there's nothing in the write buffer, then that means
	  // that nothing more will ever be provided
	  var ws = stream._writableState;
	  var ts = stream._transformState;

	  if (ws.length) throw new Error('Calling transform done when ws.length != 0');

	  if (ts.transforming) throw new Error('Calling transform done when still transforming');

	  return stream.push(null);
	}

	inherits$3(PassThrough, Transform);
	function PassThrough(options) {
	  if (!(this instanceof PassThrough)) return new PassThrough(options);

	  Transform.call(this, options);
	}

	PassThrough.prototype._transform = function (chunk, encoding, cb) {
	  cb(null, chunk);
	};

	inherits$3(Stream, EventEmitter);
	Stream.Readable = Readable;
	Stream.Writable = Writable;
	Stream.Duplex = Duplex;
	Stream.Transform = Transform;
	Stream.PassThrough = PassThrough;

	// Backwards-compat with node 0.4.x
	Stream.Stream = Stream;

	// old-style streams.  Note that the pipe method (the only relevant
	// part of this class) is overridden in the Readable class.

	function Stream() {
	  EventEmitter.call(this);
	}

	Stream.prototype.pipe = function(dest, options) {
	  var source = this;

	  function ondata(chunk) {
	    if (dest.writable) {
	      if (false === dest.write(chunk) && source.pause) {
	        source.pause();
	      }
	    }
	  }

	  source.on('data', ondata);

	  function ondrain() {
	    if (source.readable && source.resume) {
	      source.resume();
	    }
	  }

	  dest.on('drain', ondrain);

	  // If the 'end' option is not supplied, dest.end() will be called when
	  // source gets the 'end' or 'close' events.  Only dest.end() once.
	  if (!dest._isStdio && (!options || options.end !== false)) {
	    source.on('end', onend);
	    source.on('close', onclose);
	  }

	  var didOnEnd = false;
	  function onend() {
	    if (didOnEnd) return;
	    didOnEnd = true;

	    dest.end();
	  }


	  function onclose() {
	    if (didOnEnd) return;
	    didOnEnd = true;

	    if (typeof dest.destroy === 'function') dest.destroy();
	  }

	  // don't leave dangling pipes when there are errors.
	  function onerror(er) {
	    cleanup();
	    if (EventEmitter.listenerCount(this, 'error') === 0) {
	      throw er; // Unhandled stream error in pipe.
	    }
	  }

	  source.on('error', onerror);
	  dest.on('error', onerror);

	  // remove all the event listeners that were added.
	  function cleanup() {
	    source.removeListener('data', ondata);
	    dest.removeListener('drain', ondrain);

	    source.removeListener('end', onend);
	    source.removeListener('close', onclose);

	    source.removeListener('error', onerror);
	    dest.removeListener('error', onerror);

	    source.removeListener('end', cleanup);
	    source.removeListener('close', cleanup);

	    dest.removeListener('close', cleanup);
	  }

	  source.on('end', cleanup);
	  source.on('close', cleanup);

	  dest.on('close', cleanup);

	  dest.emit('pipe', source);

	  // Allow for unix-like usage: A.pipe(B).pipe(C)
	  return dest;
	};

	var stream$1 = /*#__PURE__*/Object.freeze({
		__proto__: null,
		'default': Stream,
		Readable: Readable,
		Writable: Writable,
		Duplex: Duplex,
		Transform: Transform,
		PassThrough: PassThrough,
		Stream: Stream
	});

	var require$$0$2 = /*@__PURE__*/getAugmentedNamespace(stream$1);

	var inherits$1 = {exports: {}};

	var require$$0$1 = /*@__PURE__*/getAugmentedNamespace(util$3);

	var inherits_browser = {exports: {}};

	if (typeof Object.create === 'function') {
	  // implementation from standard node.js 'util' module
	  inherits_browser.exports = function inherits(ctor, superCtor) {
	    if (superCtor) {
	      ctor.super_ = superCtor;
	      ctor.prototype = Object.create(superCtor.prototype, {
	        constructor: {
	          value: ctor,
	          enumerable: false,
	          writable: true,
	          configurable: true
	        }
	      });
	    }
	  };
	} else {
	  // old school shim for old browsers
	  inherits_browser.exports = function inherits(ctor, superCtor) {
	    if (superCtor) {
	      ctor.super_ = superCtor;
	      var TempCtor = function () {};
	      TempCtor.prototype = superCtor.prototype;
	      ctor.prototype = new TempCtor();
	      ctor.prototype.constructor = ctor;
	    }
	  };
	}

	try {
	  var util$1 = require$$0$1;
	  /* istanbul ignore next */
	  if (typeof util$1.inherits !== 'function') throw '';
	  inherits$1.exports = util$1.inherits;
	} catch (e) {
	  /* istanbul ignore next */
	  inherits$1.exports = inherits_browser.exports;
	}

	function isProperty$2(str) {
	  return /^[$A-Z\_a-z\xaa\xb5\xba\xc0-\xd6\xd8-\xf6\xf8-\u02c1\u02c6-\u02d1\u02e0-\u02e4\u02ec\u02ee\u0370-\u0374\u0376\u0377\u037a-\u037d\u0386\u0388-\u038a\u038c\u038e-\u03a1\u03a3-\u03f5\u03f7-\u0481\u048a-\u0527\u0531-\u0556\u0559\u0561-\u0587\u05d0-\u05ea\u05f0-\u05f2\u0620-\u064a\u066e\u066f\u0671-\u06d3\u06d5\u06e5\u06e6\u06ee\u06ef\u06fa-\u06fc\u06ff\u0710\u0712-\u072f\u074d-\u07a5\u07b1\u07ca-\u07ea\u07f4\u07f5\u07fa\u0800-\u0815\u081a\u0824\u0828\u0840-\u0858\u08a0\u08a2-\u08ac\u0904-\u0939\u093d\u0950\u0958-\u0961\u0971-\u0977\u0979-\u097f\u0985-\u098c\u098f\u0990\u0993-\u09a8\u09aa-\u09b0\u09b2\u09b6-\u09b9\u09bd\u09ce\u09dc\u09dd\u09df-\u09e1\u09f0\u09f1\u0a05-\u0a0a\u0a0f\u0a10\u0a13-\u0a28\u0a2a-\u0a30\u0a32\u0a33\u0a35\u0a36\u0a38\u0a39\u0a59-\u0a5c\u0a5e\u0a72-\u0a74\u0a85-\u0a8d\u0a8f-\u0a91\u0a93-\u0aa8\u0aaa-\u0ab0\u0ab2\u0ab3\u0ab5-\u0ab9\u0abd\u0ad0\u0ae0\u0ae1\u0b05-\u0b0c\u0b0f\u0b10\u0b13-\u0b28\u0b2a-\u0b30\u0b32\u0b33\u0b35-\u0b39\u0b3d\u0b5c\u0b5d\u0b5f-\u0b61\u0b71\u0b83\u0b85-\u0b8a\u0b8e-\u0b90\u0b92-\u0b95\u0b99\u0b9a\u0b9c\u0b9e\u0b9f\u0ba3\u0ba4\u0ba8-\u0baa\u0bae-\u0bb9\u0bd0\u0c05-\u0c0c\u0c0e-\u0c10\u0c12-\u0c28\u0c2a-\u0c33\u0c35-\u0c39\u0c3d\u0c58\u0c59\u0c60\u0c61\u0c85-\u0c8c\u0c8e-\u0c90\u0c92-\u0ca8\u0caa-\u0cb3\u0cb5-\u0cb9\u0cbd\u0cde\u0ce0\u0ce1\u0cf1\u0cf2\u0d05-\u0d0c\u0d0e-\u0d10\u0d12-\u0d3a\u0d3d\u0d4e\u0d60\u0d61\u0d7a-\u0d7f\u0d85-\u0d96\u0d9a-\u0db1\u0db3-\u0dbb\u0dbd\u0dc0-\u0dc6\u0e01-\u0e30\u0e32\u0e33\u0e40-\u0e46\u0e81\u0e82\u0e84\u0e87\u0e88\u0e8a\u0e8d\u0e94-\u0e97\u0e99-\u0e9f\u0ea1-\u0ea3\u0ea5\u0ea7\u0eaa\u0eab\u0ead-\u0eb0\u0eb2\u0eb3\u0ebd\u0ec0-\u0ec4\u0ec6\u0edc-\u0edf\u0f00\u0f40-\u0f47\u0f49-\u0f6c\u0f88-\u0f8c\u1000-\u102a\u103f\u1050-\u1055\u105a-\u105d\u1061\u1065\u1066\u106e-\u1070\u1075-\u1081\u108e\u10a0-\u10c5\u10c7\u10cd\u10d0-\u10fa\u10fc-\u1248\u124a-\u124d\u1250-\u1256\u1258\u125a-\u125d\u1260-\u1288\u128a-\u128d\u1290-\u12b0\u12b2-\u12b5\u12b8-\u12be\u12c0\u12c2-\u12c5\u12c8-\u12d6\u12d8-\u1310\u1312-\u1315\u1318-\u135a\u1380-\u138f\u13a0-\u13f4\u1401-\u166c\u166f-\u167f\u1681-\u169a\u16a0-\u16ea\u16ee-\u16f0\u1700-\u170c\u170e-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176c\u176e-\u1770\u1780-\u17b3\u17d7\u17dc\u1820-\u1877\u1880-\u18a8\u18aa\u18b0-\u18f5\u1900-\u191c\u1950-\u196d\u1970-\u1974\u1980-\u19ab\u19c1-\u19c7\u1a00-\u1a16\u1a20-\u1a54\u1aa7\u1b05-\u1b33\u1b45-\u1b4b\u1b83-\u1ba0\u1bae\u1baf\u1bba-\u1be5\u1c00-\u1c23\u1c4d-\u1c4f\u1c5a-\u1c7d\u1ce9-\u1cec\u1cee-\u1cf1\u1cf5\u1cf6\u1d00-\u1dbf\u1e00-\u1f15\u1f18-\u1f1d\u1f20-\u1f45\u1f48-\u1f4d\u1f50-\u1f57\u1f59\u1f5b\u1f5d\u1f5f-\u1f7d\u1f80-\u1fb4\u1fb6-\u1fbc\u1fbe\u1fc2-\u1fc4\u1fc6-\u1fcc\u1fd0-\u1fd3\u1fd6-\u1fdb\u1fe0-\u1fec\u1ff2-\u1ff4\u1ff6-\u1ffc\u2071\u207f\u2090-\u209c\u2102\u2107\u210a-\u2113\u2115\u2119-\u211d\u2124\u2126\u2128\u212a-\u212d\u212f-\u2139\u213c-\u213f\u2145-\u2149\u214e\u2160-\u2188\u2c00-\u2c2e\u2c30-\u2c5e\u2c60-\u2ce4\u2ceb-\u2cee\u2cf2\u2cf3\u2d00-\u2d25\u2d27\u2d2d\u2d30-\u2d67\u2d6f\u2d80-\u2d96\u2da0-\u2da6\u2da8-\u2dae\u2db0-\u2db6\u2db8-\u2dbe\u2dc0-\u2dc6\u2dc8-\u2dce\u2dd0-\u2dd6\u2dd8-\u2dde\u2e2f\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303c\u3041-\u3096\u309d-\u309f\u30a1-\u30fa\u30fc-\u30ff\u3105-\u312d\u3131-\u318e\u31a0-\u31ba\u31f0-\u31ff\u3400-\u4db5\u4e00-\u9fcc\ua000-\ua48c\ua4d0-\ua4fd\ua500-\ua60c\ua610-\ua61f\ua62a\ua62b\ua640-\ua66e\ua67f-\ua697\ua6a0-\ua6ef\ua717-\ua71f\ua722-\ua788\ua78b-\ua78e\ua790-\ua793\ua7a0-\ua7aa\ua7f8-\ua801\ua803-\ua805\ua807-\ua80a\ua80c-\ua822\ua840-\ua873\ua882-\ua8b3\ua8f2-\ua8f7\ua8fb\ua90a-\ua925\ua930-\ua946\ua960-\ua97c\ua984-\ua9b2\ua9cf\uaa00-\uaa28\uaa40-\uaa42\uaa44-\uaa4b\uaa60-\uaa76\uaa7a\uaa80-\uaaaf\uaab1\uaab5\uaab6\uaab9-\uaabd\uaac0\uaac2\uaadb-\uaadd\uaae0-\uaaea\uaaf2-\uaaf4\uab01-\uab06\uab09-\uab0e\uab11-\uab16\uab20-\uab26\uab28-\uab2e\uabc0-\uabe2\uac00-\ud7a3\ud7b0-\ud7c6\ud7cb-\ud7fb\uf900-\ufa6d\ufa70-\ufad9\ufb00-\ufb06\ufb13-\ufb17\ufb1d\ufb1f-\ufb28\ufb2a-\ufb36\ufb38-\ufb3c\ufb3e\ufb40\ufb41\ufb43\ufb44\ufb46-\ufbb1\ufbd3-\ufd3d\ufd50-\ufd8f\ufd92-\ufdc7\ufdf0-\ufdfb\ufe70-\ufe74\ufe76-\ufefc\uff21-\uff3a\uff41-\uff5a\uff66-\uffbe\uffc2-\uffc7\uffca-\uffcf\uffd2-\uffd7\uffda-\uffdc][$A-Z\_a-z\xaa\xb5\xba\xc0-\xd6\xd8-\xf6\xf8-\u02c1\u02c6-\u02d1\u02e0-\u02e4\u02ec\u02ee\u0370-\u0374\u0376\u0377\u037a-\u037d\u0386\u0388-\u038a\u038c\u038e-\u03a1\u03a3-\u03f5\u03f7-\u0481\u048a-\u0527\u0531-\u0556\u0559\u0561-\u0587\u05d0-\u05ea\u05f0-\u05f2\u0620-\u064a\u066e\u066f\u0671-\u06d3\u06d5\u06e5\u06e6\u06ee\u06ef\u06fa-\u06fc\u06ff\u0710\u0712-\u072f\u074d-\u07a5\u07b1\u07ca-\u07ea\u07f4\u07f5\u07fa\u0800-\u0815\u081a\u0824\u0828\u0840-\u0858\u08a0\u08a2-\u08ac\u0904-\u0939\u093d\u0950\u0958-\u0961\u0971-\u0977\u0979-\u097f\u0985-\u098c\u098f\u0990\u0993-\u09a8\u09aa-\u09b0\u09b2\u09b6-\u09b9\u09bd\u09ce\u09dc\u09dd\u09df-\u09e1\u09f0\u09f1\u0a05-\u0a0a\u0a0f\u0a10\u0a13-\u0a28\u0a2a-\u0a30\u0a32\u0a33\u0a35\u0a36\u0a38\u0a39\u0a59-\u0a5c\u0a5e\u0a72-\u0a74\u0a85-\u0a8d\u0a8f-\u0a91\u0a93-\u0aa8\u0aaa-\u0ab0\u0ab2\u0ab3\u0ab5-\u0ab9\u0abd\u0ad0\u0ae0\u0ae1\u0b05-\u0b0c\u0b0f\u0b10\u0b13-\u0b28\u0b2a-\u0b30\u0b32\u0b33\u0b35-\u0b39\u0b3d\u0b5c\u0b5d\u0b5f-\u0b61\u0b71\u0b83\u0b85-\u0b8a\u0b8e-\u0b90\u0b92-\u0b95\u0b99\u0b9a\u0b9c\u0b9e\u0b9f\u0ba3\u0ba4\u0ba8-\u0baa\u0bae-\u0bb9\u0bd0\u0c05-\u0c0c\u0c0e-\u0c10\u0c12-\u0c28\u0c2a-\u0c33\u0c35-\u0c39\u0c3d\u0c58\u0c59\u0c60\u0c61\u0c85-\u0c8c\u0c8e-\u0c90\u0c92-\u0ca8\u0caa-\u0cb3\u0cb5-\u0cb9\u0cbd\u0cde\u0ce0\u0ce1\u0cf1\u0cf2\u0d05-\u0d0c\u0d0e-\u0d10\u0d12-\u0d3a\u0d3d\u0d4e\u0d60\u0d61\u0d7a-\u0d7f\u0d85-\u0d96\u0d9a-\u0db1\u0db3-\u0dbb\u0dbd\u0dc0-\u0dc6\u0e01-\u0e30\u0e32\u0e33\u0e40-\u0e46\u0e81\u0e82\u0e84\u0e87\u0e88\u0e8a\u0e8d\u0e94-\u0e97\u0e99-\u0e9f\u0ea1-\u0ea3\u0ea5\u0ea7\u0eaa\u0eab\u0ead-\u0eb0\u0eb2\u0eb3\u0ebd\u0ec0-\u0ec4\u0ec6\u0edc-\u0edf\u0f00\u0f40-\u0f47\u0f49-\u0f6c\u0f88-\u0f8c\u1000-\u102a\u103f\u1050-\u1055\u105a-\u105d\u1061\u1065\u1066\u106e-\u1070\u1075-\u1081\u108e\u10a0-\u10c5\u10c7\u10cd\u10d0-\u10fa\u10fc-\u1248\u124a-\u124d\u1250-\u1256\u1258\u125a-\u125d\u1260-\u1288\u128a-\u128d\u1290-\u12b0\u12b2-\u12b5\u12b8-\u12be\u12c0\u12c2-\u12c5\u12c8-\u12d6\u12d8-\u1310\u1312-\u1315\u1318-\u135a\u1380-\u138f\u13a0-\u13f4\u1401-\u166c\u166f-\u167f\u1681-\u169a\u16a0-\u16ea\u16ee-\u16f0\u1700-\u170c\u170e-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176c\u176e-\u1770\u1780-\u17b3\u17d7\u17dc\u1820-\u1877\u1880-\u18a8\u18aa\u18b0-\u18f5\u1900-\u191c\u1950-\u196d\u1970-\u1974\u1980-\u19ab\u19c1-\u19c7\u1a00-\u1a16\u1a20-\u1a54\u1aa7\u1b05-\u1b33\u1b45-\u1b4b\u1b83-\u1ba0\u1bae\u1baf\u1bba-\u1be5\u1c00-\u1c23\u1c4d-\u1c4f\u1c5a-\u1c7d\u1ce9-\u1cec\u1cee-\u1cf1\u1cf5\u1cf6\u1d00-\u1dbf\u1e00-\u1f15\u1f18-\u1f1d\u1f20-\u1f45\u1f48-\u1f4d\u1f50-\u1f57\u1f59\u1f5b\u1f5d\u1f5f-\u1f7d\u1f80-\u1fb4\u1fb6-\u1fbc\u1fbe\u1fc2-\u1fc4\u1fc6-\u1fcc\u1fd0-\u1fd3\u1fd6-\u1fdb\u1fe0-\u1fec\u1ff2-\u1ff4\u1ff6-\u1ffc\u2071\u207f\u2090-\u209c\u2102\u2107\u210a-\u2113\u2115\u2119-\u211d\u2124\u2126\u2128\u212a-\u212d\u212f-\u2139\u213c-\u213f\u2145-\u2149\u214e\u2160-\u2188\u2c00-\u2c2e\u2c30-\u2c5e\u2c60-\u2ce4\u2ceb-\u2cee\u2cf2\u2cf3\u2d00-\u2d25\u2d27\u2d2d\u2d30-\u2d67\u2d6f\u2d80-\u2d96\u2da0-\u2da6\u2da8-\u2dae\u2db0-\u2db6\u2db8-\u2dbe\u2dc0-\u2dc6\u2dc8-\u2dce\u2dd0-\u2dd6\u2dd8-\u2dde\u2e2f\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303c\u3041-\u3096\u309d-\u309f\u30a1-\u30fa\u30fc-\u30ff\u3105-\u312d\u3131-\u318e\u31a0-\u31ba\u31f0-\u31ff\u3400-\u4db5\u4e00-\u9fcc\ua000-\ua48c\ua4d0-\ua4fd\ua500-\ua60c\ua610-\ua61f\ua62a\ua62b\ua640-\ua66e\ua67f-\ua697\ua6a0-\ua6ef\ua717-\ua71f\ua722-\ua788\ua78b-\ua78e\ua790-\ua793\ua7a0-\ua7aa\ua7f8-\ua801\ua803-\ua805\ua807-\ua80a\ua80c-\ua822\ua840-\ua873\ua882-\ua8b3\ua8f2-\ua8f7\ua8fb\ua90a-\ua925\ua930-\ua946\ua960-\ua97c\ua984-\ua9b2\ua9cf\uaa00-\uaa28\uaa40-\uaa42\uaa44-\uaa4b\uaa60-\uaa76\uaa7a\uaa80-\uaaaf\uaab1\uaab5\uaab6\uaab9-\uaabd\uaac0\uaac2\uaadb-\uaadd\uaae0-\uaaea\uaaf2-\uaaf4\uab01-\uab06\uab09-\uab0e\uab11-\uab16\uab20-\uab26\uab28-\uab2e\uabc0-\uabe2\uac00-\ud7a3\ud7b0-\ud7c6\ud7cb-\ud7fb\uf900-\ufa6d\ufa70-\ufad9\ufb00-\ufb06\ufb13-\ufb17\ufb1d\ufb1f-\ufb28\ufb2a-\ufb36\ufb38-\ufb3c\ufb3e\ufb40\ufb41\ufb43\ufb44\ufb46-\ufbb1\ufbd3-\ufd3d\ufd50-\ufd8f\ufd92-\ufdc7\ufdf0-\ufdfb\ufe70-\ufe74\ufe76-\ufefc\uff21-\uff3a\uff41-\uff5a\uff66-\uffbe\uffc2-\uffc7\uffca-\uffcf\uffd2-\uffd7\uffda-\uffdc0-9\u0300-\u036f\u0483-\u0487\u0591-\u05bd\u05bf\u05c1\u05c2\u05c4\u05c5\u05c7\u0610-\u061a\u064b-\u0669\u0670\u06d6-\u06dc\u06df-\u06e4\u06e7\u06e8\u06ea-\u06ed\u06f0-\u06f9\u0711\u0730-\u074a\u07a6-\u07b0\u07c0-\u07c9\u07eb-\u07f3\u0816-\u0819\u081b-\u0823\u0825-\u0827\u0829-\u082d\u0859-\u085b\u08e4-\u08fe\u0900-\u0903\u093a-\u093c\u093e-\u094f\u0951-\u0957\u0962\u0963\u0966-\u096f\u0981-\u0983\u09bc\u09be-\u09c4\u09c7\u09c8\u09cb-\u09cd\u09d7\u09e2\u09e3\u09e6-\u09ef\u0a01-\u0a03\u0a3c\u0a3e-\u0a42\u0a47\u0a48\u0a4b-\u0a4d\u0a51\u0a66-\u0a71\u0a75\u0a81-\u0a83\u0abc\u0abe-\u0ac5\u0ac7-\u0ac9\u0acb-\u0acd\u0ae2\u0ae3\u0ae6-\u0aef\u0b01-\u0b03\u0b3c\u0b3e-\u0b44\u0b47\u0b48\u0b4b-\u0b4d\u0b56\u0b57\u0b62\u0b63\u0b66-\u0b6f\u0b82\u0bbe-\u0bc2\u0bc6-\u0bc8\u0bca-\u0bcd\u0bd7\u0be6-\u0bef\u0c01-\u0c03\u0c3e-\u0c44\u0c46-\u0c48\u0c4a-\u0c4d\u0c55\u0c56\u0c62\u0c63\u0c66-\u0c6f\u0c82\u0c83\u0cbc\u0cbe-\u0cc4\u0cc6-\u0cc8\u0cca-\u0ccd\u0cd5\u0cd6\u0ce2\u0ce3\u0ce6-\u0cef\u0d02\u0d03\u0d3e-\u0d44\u0d46-\u0d48\u0d4a-\u0d4d\u0d57\u0d62\u0d63\u0d66-\u0d6f\u0d82\u0d83\u0dca\u0dcf-\u0dd4\u0dd6\u0dd8-\u0ddf\u0df2\u0df3\u0e31\u0e34-\u0e3a\u0e47-\u0e4e\u0e50-\u0e59\u0eb1\u0eb4-\u0eb9\u0ebb\u0ebc\u0ec8-\u0ecd\u0ed0-\u0ed9\u0f18\u0f19\u0f20-\u0f29\u0f35\u0f37\u0f39\u0f3e\u0f3f\u0f71-\u0f84\u0f86\u0f87\u0f8d-\u0f97\u0f99-\u0fbc\u0fc6\u102b-\u103e\u1040-\u1049\u1056-\u1059\u105e-\u1060\u1062-\u1064\u1067-\u106d\u1071-\u1074\u1082-\u108d\u108f-\u109d\u135d-\u135f\u1712-\u1714\u1732-\u1734\u1752\u1753\u1772\u1773\u17b4-\u17d3\u17dd\u17e0-\u17e9\u180b-\u180d\u1810-\u1819\u18a9\u1920-\u192b\u1930-\u193b\u1946-\u194f\u19b0-\u19c0\u19c8\u19c9\u19d0-\u19d9\u1a17-\u1a1b\u1a55-\u1a5e\u1a60-\u1a7c\u1a7f-\u1a89\u1a90-\u1a99\u1b00-\u1b04\u1b34-\u1b44\u1b50-\u1b59\u1b6b-\u1b73\u1b80-\u1b82\u1ba1-\u1bad\u1bb0-\u1bb9\u1be6-\u1bf3\u1c24-\u1c37\u1c40-\u1c49\u1c50-\u1c59\u1cd0-\u1cd2\u1cd4-\u1ce8\u1ced\u1cf2-\u1cf4\u1dc0-\u1de6\u1dfc-\u1dff\u200c\u200d\u203f\u2040\u2054\u20d0-\u20dc\u20e1\u20e5-\u20f0\u2cef-\u2cf1\u2d7f\u2de0-\u2dff\u302a-\u302f\u3099\u309a\ua620-\ua629\ua66f\ua674-\ua67d\ua69f\ua6f0\ua6f1\ua802\ua806\ua80b\ua823-\ua827\ua880\ua881\ua8b4-\ua8c4\ua8d0-\ua8d9\ua8e0-\ua8f1\ua900-\ua909\ua926-\ua92d\ua947-\ua953\ua980-\ua983\ua9b3-\ua9c0\ua9d0-\ua9d9\uaa29-\uaa36\uaa43\uaa4c\uaa4d\uaa50-\uaa59\uaa7b\uaab0\uaab2-\uaab4\uaab7\uaab8\uaabe\uaabf\uaac1\uaaeb-\uaaef\uaaf5\uaaf6\uabe3-\uabea\uabec\uabed\uabf0-\uabf9\ufb1e\ufe00-\ufe0f\ufe20-\ufe26\ufe33\ufe34\ufe4d-\ufe4f\uff10-\uff19\uff3f]*$/.test(str)
	}
	var isProperty_1 = isProperty$2;

	var isProperty$1 = isProperty_1;

	var gen = function(obj, prop) {
	  return isProperty$1(prop) ? obj+'.'+prop : obj+'['+JSON.stringify(prop)+']'
	};

	gen.valid = isProperty$1;
	gen.property = function (prop) {
	 return isProperty$1(prop) ? prop : JSON.stringify(prop)
	};

	var generateObjectProperty = gen;

	var util = require$$0$1;
	var isProperty = isProperty_1;

	var INDENT_START = /[\{\[]/;
	var INDENT_END = /[\}\]]/;

	// from https://mathiasbynens.be/notes/reserved-keywords
	var RESERVED = [
	  'do',
	  'if',
	  'in',
	  'for',
	  'let',
	  'new',
	  'try',
	  'var',
	  'case',
	  'else',
	  'enum',
	  'eval',
	  'null',
	  'this',
	  'true',
	  'void',
	  'with',
	  'await',
	  'break',
	  'catch',
	  'class',
	  'const',
	  'false',
	  'super',
	  'throw',
	  'while',
	  'yield',
	  'delete',
	  'export',
	  'import',
	  'public',
	  'return',
	  'static',
	  'switch',
	  'typeof',
	  'default',
	  'extends',
	  'finally',
	  'package',
	  'private',
	  'continue',
	  'debugger',
	  'function',
	  'arguments',
	  'interface',
	  'protected',
	  'implements',
	  'instanceof',
	  'NaN',
	  'undefined'
	];

	var RESERVED_MAP = {};

	for (var i = 0; i < RESERVED.length; i++) {
	  RESERVED_MAP[RESERVED[i]] = true;
	}

	var isVariable = function (name) {
	  return isProperty(name) && !RESERVED_MAP.hasOwnProperty(name)
	};

	var formats = {
	  s: function(s) {
	    return '' + s
	  },
	  d: function(d) {
	    return '' + Number(d)
	  },
	  o: function(o) {
	    return JSON.stringify(o)
	  }
	};

	var genfun$1 = function() {
	  var lines = [];
	  var indent = 0;
	  var vars = {};

	  var push = function(str) {
	    var spaces = '';
	    while (spaces.length < indent*2) spaces += '  ';
	    lines.push(spaces+str);
	  };

	  var pushLine = function(line) {
	    if (INDENT_END.test(line.trim()[0]) && INDENT_START.test(line[line.length-1])) {
	      indent--;
	      push(line);
	      indent++;
	      return
	    }
	    if (INDENT_START.test(line[line.length-1])) {
	      push(line);
	      indent++;
	      return
	    }
	    if (INDENT_END.test(line.trim()[0])) {
	      indent--;
	      push(line);
	      return
	    }

	    push(line);
	  };

	  var line = function(fmt) {
	    if (!fmt) return line

	    if (arguments.length === 1 && fmt.indexOf('\n') > -1) {
	      var lines = fmt.trim().split('\n');
	      for (var i = 0; i < lines.length; i++) {
	        pushLine(lines[i].trim());
	      }
	    } else {
	      pushLine(util.format.apply(util, arguments));
	    }

	    return line
	  };

	  line.scope = {};
	  line.formats = formats;

	  line.sym = function(name) {
	    if (!name || !isVariable(name)) name = 'tmp';
	    if (!vars[name]) vars[name] = 0;
	    return name + (vars[name]++ || '')
	  };

	  line.property = function(obj, name) {
	    if (arguments.length === 1) {
	      name = obj;
	      obj = '';
	    }

	    name = name + '';

	    if (isProperty(name)) return (obj ? obj + '.' + name : name)
	    return obj ? obj + '[' + JSON.stringify(name) + ']' : JSON.stringify(name)
	  };

	  line.toString = function() {
	    return lines.join('\n')
	  };

	  line.toFunction = function(scope) {
	    if (!scope) scope = {};

	    var src = 'return ('+line.toString()+')';

	    Object.keys(line.scope).forEach(function (key) {
	      if (!scope[key]) scope[key] = line.scope[key];
	    });

	    var keys = Object.keys(scope).map(function(key) {
	      return key
	    });

	    var vals = keys.map(function(key) {
	      return scope[key]
	    });

	    return Function.apply(null, keys.concat(src)).apply(null, vals)
	  };

	  if (arguments.length) line.apply(null, arguments);

	  return line
	};

	genfun$1.formats = formats;
	var generateFunction = genfun$1;

	var require$$0 = {
		"^hdr$": {
		"^(P3|P2.6)": [
			"record_type",
			"fec_version",
			"soft_name",
			"batch_number",
			"received_date",
			"report_id"
		],
		"^(P2.2|P2.3|P2.4)": [
			"record_type",
			"fec_version",
			"soft_name",
			"batch_number",
			"report_id"
		],
		"^P1": [
			"record_type",
			"fec_version",
			"soft_name",
			"batch_number"
		],
		"^[6-8]": [
			"record_type",
			"ef_type",
			"fec_version",
			"soft_name",
			"soft_ver",
			"report_id",
			"report_number",
			"comment"
		],
		"^[3-5]": [
			"record_type",
			"ef_type",
			"fec_version",
			"soft_name",
			"soft_ver",
			"name_delim",
			"report_id",
			"report_number",
			"comment"
		]
	},
		"^f1[an]": {
		"^P3.2|^P3.3|^P3.4": [
			"form_type",
			"filer_committee_id_number",
			"change_of_committee_name",
			"committee_name",
			"change_of_address",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"change_of_committee_email",
			"committee_email",
			"change_of_committee_url",
			"committee_url",
			"effective_date",
			"signature_last_name",
			"signature_first_name",
			"signature_middle_name",
			"signature_prefix",
			"signature_suffix",
			"date_signed",
			"committee_type",
			"candidate_last_name",
			"candidate_first_name",
			"candidate_middle_name",
			"candidate_prefix",
			"candidate_suffix",
			"candidate_office",
			"candidate_state",
			"candidate_district",
			"party_code",
			"party_type",
			"organization_type",
			"lobbyist_registrant_pac",
			"lobbyist_registrant_pac_2",
			"leadership_pac",
			"affiliated_committee_name",
			"affiliated_last_name",
			"affiliated_first_name",
			"affiliated_middle_name",
			"affiliated_prefix",
			"affiliated_suffix",
			"affiliated_street_1",
			"affiliated_street_2",
			"affiliated_city",
			"affiliated_state",
			"affiliated_zip_code",
			"affiliated_relationship_code",
			"custodian_last_name",
			"custodian_first_name",
			"custodian_middle_name",
			"custodian_prefix",
			"custodian_suffix",
			"custodian_street_1",
			"custodian_street_2",
			"custodian_city",
			"custodian_state",
			"custodian_zip_code",
			"custodian_title",
			"custodian_telephone",
			"treasurer_last_name",
			"treasurer_first_name",
			"treasurer_middle_name",
			"treasurer_prefix",
			"treasurer_suffix",
			"treasurer_street_1",
			"treasurer_street_2",
			"treasurer_city",
			"treasurer_state",
			"treasurer_zip_code",
			"treasurer_title",
			"treasurer_telephone",
			"agent_last_name",
			"agent_first_name",
			"agent_middle_name",
			"agent_prefix",
			"agent_suffix",
			"agent_street_1",
			"agent_street_2",
			"agent_city",
			"agent_state",
			"agent_zip_code",
			"agent_title",
			"agent_telephone",
			"bank_name",
			"bank_street_1",
			"bank_street_2",
			"bank_city",
			"bank_state",
			"bank_zip_code",
			"bank2_name",
			"bank2_street_1",
			"bank2_street_2",
			"bank2_city",
			"bank2_state",
			"bank2_zip_code",
			"beginning_image_number",
			"end_image_number",
			"receipt_date"
		],
		"^P2.6|^P3.0|^P3.1": [
			"form_type",
			"filer_committee_id_number",
			"change_of_committee_name",
			"committee_name",
			"change_of_address",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"change_of_committee_email",
			"committee_email",
			"change_of_committee_url",
			"committee_url",
			"effective_date",
			"signature_last_name",
			"signature_first_name",
			"signature_middle_name",
			"signature_prefix",
			"signature_suffix",
			"date_signed",
			"committee_type",
			"candidate_last_name",
			"candidate_first_name",
			"candidate_middle_name",
			"candidate_prefix",
			"candidate_suffix",
			"candidate_office",
			"candidate_state",
			"candidate_district",
			"party_code",
			"party_type",
			"organization_type",
			"lobbyist_registrant_pac",
			"lobbyist_registrant_pac_2",
			"leadership_pac",
			"affiliated_committee_name",
			"affiliated_last_name",
			"affiliated_first_name",
			"affiliated_middle_name",
			"affiliated_prefix",
			"affiliated_suffix",
			"affiliated_street_1",
			"affiliated_street_2",
			"affiliated_city",
			"affiliated_state",
			"affiliated_zip_code",
			"affiliated_relationship_code",
			"custodian_last_name",
			"custodian_first_name",
			"custodian_middle_name",
			"custodian_prefix",
			"custodian_suffix",
			"custodian_street_1",
			"custodian_street_2",
			"custodian_city",
			"custodian_state",
			"custodian_zip_code",
			"custodian_title",
			"custodian_telephone",
			"treasurer_last_name",
			"treasurer_first_name",
			"treasurer_middle_name",
			"treasurer_prefix",
			"treasurer_suffix",
			"treasurer_street_1",
			"treasurer_street_2",
			"treasurer_city",
			"treasurer_state",
			"treasurer_zip_code",
			"treasurer_title",
			"treasurer_telephone",
			"agent_last_name",
			"agent_first_name",
			"agent_middle_name",
			"agent_prefix",
			"agent_suffix",
			"agent_street_1",
			"agent_street_2",
			"agent_city",
			"agent_state",
			"agent_zip_code",
			"agent_title",
			"agent_telephone",
			"bank_name",
			"bank_street_1",
			"bank_street_2",
			"bank_city",
			"bank_state",
			"bank_zip_code",
			"bank2_name",
			"bank2_street_1",
			"bank2_street_2",
			"bank2_city",
			"bank2_state",
			"bank2_zip_code",
			"beginning_image_number"
		],
		"^P2.4": [
			"form_type",
			"filer_committee_id_number",
			"change_of_committee_name",
			"committee_name",
			"change_of_address",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"committee_email",
			"committee_url",
			"committee_fax_number",
			"effective_date",
			"signature_last_name",
			"signature_first_name",
			"signature_middle_name",
			"signature_prefix",
			"signature_suffix",
			"date_signed",
			"committee_type",
			"candidate_last_name",
			"candidate_first_name",
			"candidate_middle_name",
			"candidate_prefix",
			"candidate_suffix",
			"candidate_office",
			"candidate_state",
			"candidate_district",
			"party_code",
			"party_type",
			"organization_type",
			"leadership_pac",
			"affiliated_committee_name",
			"affiliated_street_1",
			"affiliated_street_2",
			"affiliated_city",
			"affiliated_state",
			"affiliated_zip_code",
			"affiliated_relationship_code",
			"custodian_last_name",
			"custodian_first_name",
			"custodian_middle_name",
			"custodian_prefix",
			"custodian_suffix",
			"custodian_street_1",
			"custodian_street_2",
			"custodian_city",
			"custodian_state",
			"custodian_zip_code",
			"custodian_title",
			"custodian_telephone",
			"treasurer_last_name",
			"treasurer_first_name",
			"treasurer_middle_name",
			"treasurer_prefix",
			"treasurer_suffix",
			"treasurer_street_1",
			"treasurer_street_2",
			"treasurer_city",
			"treasurer_state",
			"treasurer_zip_code",
			"treasurer_title",
			"treasurer_telephone",
			"agent_last_name",
			"agent_first_name",
			"agent_middle_name",
			"agent_prefix",
			"agent_suffix",
			"agent_street_1",
			"agent_street_2",
			"agent_city",
			"agent_state",
			"agent_zip_code",
			"agent_title",
			"agent_telephone",
			"bank_name",
			"bank_street_1",
			"bank_street_2",
			"bank_city",
			"bank_state",
			"bank_zip_code",
			"bank2_name",
			"bank2_street_1",
			"bank2_street_2",
			"bank2_city",
			"bank2_state",
			"bank2_zip_code",
			"beginning_image_number"
		],
		"^P1.0|^P2.2|^P2.3": [
			"form_type",
			"filer_committee_id_number",
			"change_of_committee_name",
			"committee_name",
			"change_of_address",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"committee_email",
			"committee_url",
			"committee_fax_number",
			"effective_date",
			"signature_last_name",
			"signature_first_name",
			"signature_middle_name",
			"signature_prefix",
			"signature_suffix",
			"date_signed",
			"committee_type",
			"candidate_last_name",
			"candidate_first_name",
			"candidate_middle_name",
			"candidate_prefix",
			"candidate_suffix",
			"candidate_office",
			"candidate_state",
			"candidate_district",
			"party_code",
			"party_type",
			"affiliated_committee_name",
			"affiliated_street_1",
			"affiliated_street_2",
			"affiliated_city",
			"affiliated_state",
			"affiliated_zip_code",
			"affiliated_relationship_code",
			"organization_type",
			"custodian_last_name",
			"custodian_first_name",
			"custodian_middle_name",
			"custodian_prefix",
			"custodian_suffix",
			"custodian_street_1",
			"custodian_street_2",
			"custodian_city",
			"custodian_state",
			"custodian_zip_code",
			"custodian_title",
			"custodian_telephone",
			"treasurer_last_name",
			"treasurer_first_name",
			"treasurer_middle_name",
			"treasurer_prefix",
			"treasurer_suffix",
			"treasurer_street_1",
			"treasurer_street_2",
			"treasurer_city",
			"treasurer_state",
			"treasurer_zip_code",
			"treasurer_title",
			"treasurer_telephone",
			"agent_last_name",
			"agent_first_name",
			"agent_middle_name",
			"agent_prefix",
			"agent_suffix",
			"agent_street_1",
			"agent_street_2",
			"agent_city",
			"agent_state",
			"agent_zip_code",
			"agent_title",
			"agent_telephone",
			"bank_name",
			"bank_street_1",
			"bank_street_2",
			"bank_city",
			"bank_state",
			"bank_zip_code",
			"beginning_image_number"
		],
		"^8.3|8.2|8.1|8.0|7.0|6.4": [
			"form_type",
			"filer_committee_id_number",
			"change_of_committee_name",
			"committee_name",
			"change_of_address",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"change_of_committee_email",
			"committee_email",
			"change_of_committee_url",
			"committee_url",
			"effective_date",
			"signature_last_name",
			"signature_first_name",
			"signature_middle_name",
			"signature_prefix",
			"signature_suffix",
			"date_signed",
			"committee_type",
			"candidate_id_number",
			"candidate_last_name",
			"candidate_first_name",
			"candidate_middle_name",
			"candidate_prefix",
			"candidate_suffix",
			"candidate_office",
			"candidate_state",
			"candidate_district",
			"party_code",
			"party_type",
			"organization_type",
			"lobbyist_registrant_pac",
			"lobbyist_registrant_pac_2",
			"leadership_pac",
			"affiliated_committee_id_number",
			"affiliated_committee_name",
			"affiliated_candidate_id_number",
			"affiliated_last_name",
			"affiliated_first_name",
			"affiliated_middle_name",
			"affiliated_prefix",
			"affiliated_suffix",
			"affiliated_street_1",
			"affiliated_street_2",
			"affiliated_city",
			"affiliated_state",
			"affiliated_zip_code",
			"affiliated_relationship_code",
			"custodian_last_name",
			"custodian_first_name",
			"custodian_middle_name",
			"custodian_prefix",
			"custodian_suffix",
			"custodian_street_1",
			"custodian_street_2",
			"custodian_city",
			"custodian_state",
			"custodian_zip_code",
			"custodian_title",
			"custodian_telephone",
			"treasurer_last_name",
			"treasurer_first_name",
			"treasurer_middle_name",
			"treasurer_prefix",
			"treasurer_suffix",
			"treasurer_street_1",
			"treasurer_street_2",
			"treasurer_city",
			"treasurer_state",
			"treasurer_zip_code",
			"treasurer_title",
			"treasurer_telephone",
			"agent_last_name",
			"agent_first_name",
			"agent_middle_name",
			"agent_prefix",
			"agent_suffix",
			"agent_street_1",
			"agent_street_2",
			"agent_city",
			"agent_state",
			"agent_zip_code",
			"agent_title",
			"agent_telephone",
			"bank_name",
			"bank_street_1",
			"bank_street_2",
			"bank_city",
			"bank_state",
			"bank_zip_code",
			"bank2_name",
			"bank2_street_1",
			"bank2_street_2",
			"bank2_city",
			"bank2_state",
			"bank2_zip_code"
		],
		"^6.3|6.2|6.1": [
			"form_type",
			"filer_committee_id_number",
			"change_of_committee_name",
			"committee_name",
			"change_of_address",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"change_of_committee_email",
			"committee_email",
			"change_of_committee_url",
			"committee_url",
			"effective_date",
			"signature_last_name",
			"signature_first_name",
			"signature_middle_name",
			"signature_prefix",
			"signature_suffix",
			"date_signed",
			"committee_type",
			"candidate_id_number",
			"candidate_last_name",
			"candidate_first_name",
			"candidate_middle_name",
			"candidate_prefix",
			"candidate_suffix",
			"candidate_office",
			"candidate_state",
			"candidate_district",
			"party_code",
			"party_type",
			"organization_type",
			"lobbyist_registrant_pac",
			"lobbyist_registrant_pac_2",
			"leadership_pac",
			"affiliated_committee_id_number",
			"affiliated_committee_name",
			"affiliated_candidate_id_number",
			"affiliated_last_name",
			"affiliated_first_name",
			"affiliated_middle_name",
			"affiliated_prefix",
			"affiliated_suffix",
			"affiliated_street_1",
			"affiliated_street_2",
			"affiliated_city",
			"affiliated_state",
			"affiliated_zip_code",
			"affiliated_relationship_code",
			"custodian_last_name",
			"custodian_first_name",
			"custodian_middle_name",
			"custodian_prefix",
			"custodian_suffix",
			"custodian_street_1",
			"custodian_street_2",
			"custodian_city",
			"custodian_state",
			"custodian_zip_code",
			"custodian_title",
			"custodian_telephone",
			"treasurer_last_name",
			"treasurer_first_name",
			"treasurer_middle_name",
			"treasurer_prefix",
			"treasurer_suffix",
			"treasurer_street_1",
			"treasurer_street_2",
			"treasurer_city",
			"treasurer_state",
			"treasurer_zip_code",
			"treasurer_title",
			"treasurer_telephone",
			"agent_last_name",
			"agent_first_name",
			"agent_middle_name",
			"agent_prefix",
			"agent_suffix",
			"agent_street_1",
			"agent_street_2",
			"agent_city",
			"agent_state",
			"agent_zip_code",
			"agent_title",
			"agent_telephone",
			"bank_name",
			"bank_street_1",
			"bank_street_2",
			"bank_city",
			"bank_state",
			"bank_zip_code",
			"bank2_name",
			"bank2_street_1",
			"bank2_street_2",
			"bank2_city",
			"bank2_state",
			"bank2_zip_code"
		],
		"^5.3|5.2|5.1|5.0": [
			"form_type",
			"filer_committee_id_number",
			"committee_name",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"effective_date",
			"change_of_committee_name",
			"change_of_address",
			"committee_type",
			"candidate_id_number",
			"candidate_name",
			"candidate_office",
			"candidate_state",
			"candidate_district",
			"party_code",
			"party_type",
			"affiliated_committee_id_number",
			"affiliated_committee_name",
			"affiliated_street_1",
			"affiliated_street_2",
			"affiliated_city",
			"affiliated_state",
			"affiliated_zip_code",
			"affiliated_relationship_code",
			"organization_type",
			"custodian_name",
			"custodian_street_1",
			"custodian_street_2",
			"custodian_city",
			"custodian_state",
			"custodian_zip_code",
			"custodian_title",
			"custodian_telephone",
			"treasurer_name",
			"treasurer_street_1",
			"treasurer_street_2",
			"treasurer_city",
			"treasurer_state",
			"treasurer_zip_code",
			"treasurer_title",
			"treasurer_telephone",
			"agent_name",
			"agent_street_1",
			"agent_street_2",
			"agent_city",
			"agent_state",
			"agent_zip_code",
			"agent_title",
			"agent_telephone",
			"bank_name",
			"bank_street_1",
			"bank_street_2",
			"bank_city",
			"bank_state",
			"bank_zip_code",
			"signature_name",
			"date_signed",
			"committee_email",
			"committee_url",
			"committee_fax_number"
		],
		"^3.0": [
			"form_type",
			"filer_committee_id_number",
			"committee_name",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"effective_date",
			"change_of_committee_name",
			"change_of_address",
			"committee_type",
			"candidate_id_number",
			"candidate_name",
			"candidate_office",
			"candidate_state",
			"candidate_district",
			"party_code",
			"party_type",
			"affiliated_committee_id_number",
			"affiliated_committee_name",
			"affiliated_street_1",
			"affiliated_street_2",
			"affiliated_city",
			"affiliated_state",
			"affiliated_zip_code",
			"affiliated_relationship_code",
			"organization_type",
			"custodian_name",
			"custodian_street_1",
			"custodian_street_2",
			"custodian_city",
			"custodian_state",
			"custodian_zip_code",
			"custodian_title",
			"custodian_telephone",
			"treasurer_name",
			"treasurer_street_1",
			"treasurer_street_2",
			"treasurer_city",
			"treasurer_state",
			"treasurer_zip_code",
			"treasurer_title",
			"treasurer_telephone",
			"agent_name",
			"agent_street_1",
			"agent_street_2",
			"agent_city",
			"agent_state",
			"agent_zip_code",
			"agent_title",
			"agent_telephone",
			"bank_name",
			"bank_street_1",
			"bank_street_2",
			"bank_city",
			"bank_state",
			"bank_zip_code",
			"signature_name",
			"date_signed",
			"committee_email",
			"committee_url"
		],
		"^2": [
			"form_type",
			"filer_committee_id_number",
			"committee_name",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"effective_date",
			"change_of_committee_name",
			"change_of_address",
			"committee_type",
			"candidate_id_number",
			"candidate_name",
			"candidate_office",
			"candidate_state",
			"candidate_district",
			"party_code",
			"party_type",
			"affiliated_committee_id_number",
			"affiliated_committee_name",
			"affiliated_street_1",
			"affiliated_street_2",
			"affiliated_city",
			"affiliated_state",
			"affiliated_zip_code",
			"affiliated_relationship_code",
			"organization_type",
			"custodian_name",
			"custodian_street_1",
			"custodian_street_2",
			"custodian_city",
			"custodian_state",
			"custodian_zip_code",
			"custodian_title",
			"custodian_telephone",
			"treasurer_name",
			"treasurer_street_1",
			"treasurer_street_2",
			"treasurer_city",
			"treasurer_state",
			"treasurer_zip_code",
			"treasurer_title",
			"treasurer_telephone",
			"agent_name",
			"agent_street_1",
			"agent_street_2",
			"agent_city",
			"agent_state",
			"agent_zip_code",
			"agent_title",
			"agent_telephone",
			"bank_name",
			"bank_street_1",
			"bank_street_2",
			"bank_city",
			"bank_state",
			"bank_zip_code",
			"signature_name",
			"date_signed"
		]
	},
		"^f13[an]": {
		"^P3.2|^P3.3|^P3.4": [
			"form_type",
			"filer_committee_id_number",
			"committee_name",
			"change_of_address",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"report_code",
			"amendment_date",
			"coverage_from_date",
			"coverage_through_date",
			"total_donations_accepted",
			"total_donations_refunded",
			"net_donations",
			"designated_last_name",
			"designated_first_name",
			"designated_middle_name",
			"designated_prefix",
			"designated_suffix",
			"date_signed",
			"beginning_image_number",
			"end_image_number",
			"receipt_date"
		],
		"^P3.0|^P3.1": [
			"form_type",
			"filer_committee_id_number",
			"committee_name",
			"change_of_address",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"report_code",
			"amendment_date",
			"coverage_from_date",
			"coverage_through_date",
			"total_donations_accepted",
			"total_donations_refunded",
			"net_donations",
			"designated_last_name",
			"designated_first_name",
			"designated_middle_name",
			"designated_prefix",
			"designated_suffix",
			"date_signed",
			"beginning_image_number"
		],
		"^8.3|8.2|8.1|8.0|7.0|6.4|6.3|6.2|6.1": [
			"form_type",
			"filer_committee_id_number",
			"committee_name",
			"change_of_address",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"report_code",
			"amendment_date",
			"coverage_from_date",
			"coverage_through_date",
			"total_donations_accepted",
			"total_donations_refunded",
			"net_donations",
			"designated_last_name",
			"designated_first_name",
			"designated_middle_name",
			"designated_prefix",
			"designated_suffix",
			"date_signed"
		],
		"^5.3|5.2": [
			"form_type",
			"filer_committee_id_number",
			"committee_name",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"change_of_address",
			"report_code",
			"amendment_date",
			"coverage_from_date",
			"coverage_through_date",
			"total_donations_accepted",
			"total_donations_refunded",
			"net_donations",
			"designated_last_name",
			"designated_first_name",
			"designated_middle_name",
			"designated_prefix",
			"designated_suffix",
			"date_signed"
		]
	},
		"^f132": {
		"^P3.2|^P3.3|^P3.4": [
			"form_type",
			"filer_committee_id_number",
			"contributor_organization_name",
			"contributor_last_name",
			"contributor_first_name",
			"contributor_middle_name",
			"contributor_prefix",
			"contributor_suffix",
			"contributor_street_1",
			"contributor_street_2",
			"contributor_city",
			"contributor_state",
			"contributor_zip",
			"donation_date",
			"donation_amount",
			"donation_aggregate_amount",
			"memo_code",
			"memo_text_description",
			"image_number"
		],
		"^P3.0|^P3.1": [
			"form_type",
			"filer_committee_id_number",
			"contributor_organization_name",
			"contributor_last_name",
			"contributor_first_name",
			"contributor_middle_name",
			"contributor_prefix",
			"contributor_suffix",
			"contributor_street_1",
			"contributor_street_2",
			"contributor_city",
			"contributor_state",
			"contributor_zip",
			"donation_date",
			"donation_amount",
			"donation_aggregate_amount",
			"memo_text_description",
			"image_number"
		],
		"^8.3|8.2|8.1|8.0|7.0|6.4|6.3|6.2|6.1": [
			"form_type",
			"filer_committee_id_number",
			"transaction_id_number",
			"back_reference_tran_id_number",
			"back_reference_sched_name",
			"entity_type",
			"contributor_organization_name",
			"contributor_last_name",
			"contributor_first_name",
			"contributor_middle_name",
			"contributor_prefix",
			"contributor_suffix",
			"contributor_street_1",
			"contributor_street_2",
			"contributor_city",
			"contributor_state",
			"contributor_zip",
			"donation_date",
			"donation_amount",
			"donation_aggregate_amount",
			"memo_code",
			"memo_text_description"
		],
		"^5.3|5.2": [
			"form_type",
			"filer_committee_id_number",
			"entity_type",
			"contributor_organization_name",
			"contributor_last_name",
			"contributor_first_name",
			"contributor_middle_name",
			"contributor_prefix",
			"contributor_suffix",
			"contributor_street_1",
			"contributor_street_2",
			"contributor_city",
			"contributor_state",
			"contributor_zip",
			"donation_date",
			"donation_amount",
			"donation_aggregate_amount",
			"",
			"transaction_id_number",
			"back_reference_tran_id_number",
			"back_reference_sched_name"
		]
	},
		"^f133": {
		"^P3.2|^P3.3|^P3.4": [
			"form_type",
			"filer_committee_id_number",
			"contributor_organization_name",
			"contributor_last_name",
			"contributor_first_name",
			"contributor_middle_name",
			"contributor_prefix",
			"contributor_suffix",
			"contributor_street_1",
			"contributor_street_2",
			"contributor_city",
			"contributor_state",
			"contributor_zip",
			"refund_date",
			"refund_amount",
			"memo_code",
			"memo_text_description",
			"image_number"
		],
		"^P3.0|^P3.1": [
			"form_type",
			"filer_committee_id_number",
			"contributor_organization_name",
			"contributor_last_name",
			"contributor_first_name",
			"contributor_middle_name",
			"contributor_prefix",
			"contributor_suffix",
			"contributor_street_1",
			"contributor_street_2",
			"contributor_city",
			"contributor_state",
			"contributor_zip",
			"refund_date",
			"refund_amount",
			"memo_text_description",
			"image_number"
		],
		"^8.3|8.2|8.1|8.0|7.0|6.4|6.3|6.2|6.1": [
			"form_type",
			"filer_committee_id_number",
			"transaction_id_number",
			"back_reference_tran_id_number",
			"back_reference_sched_name",
			"entity_type",
			"contributor_organization_name",
			"contributor_last_name",
			"contributor_first_name",
			"contributor_middle_name",
			"contributor_prefix",
			"contributor_suffix",
			"contributor_street_1",
			"contributor_street_2",
			"contributor_city",
			"contributor_state",
			"contributor_zip",
			"refund_date",
			"refund_amount",
			"memo_code",
			"memo_text_description"
		],
		"^5.3|5.2": [
			"form_type",
			"filer_committee_id_number",
			"entity_type",
			"contributor_organization_name",
			"contributor_last_name",
			"contributor_first_name",
			"contributor_middle_name",
			"contributor_prefix",
			"contributor_suffix",
			"contributor_street_1",
			"contributor_street_2",
			"contributor_city",
			"contributor_state",
			"contributor_zip",
			"refund_date",
			"refund_amount",
			"",
			"transaction_id_number",
			"back_reference_tran_id_number",
			"back_reference_sched_name"
		]
	},
		"^(f1m$|f1m[a|n])": {
		"^P3.2|^P3.3|^P3.4": [
			"form_type",
			"filer_committee_id_number",
			"committee_name",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"committee_type",
			"affiliated_date_f1_filed",
			"affiliated_committee_name",
			"affiliated_committee_id_number",
			"first_candidate_last_name",
			"first_candidate_first_name",
			"first_candidate_middle_name",
			"first_candidate_prefix",
			"first_candidate_suffix",
			"first_candidate_office",
			"first_candidate_state",
			"first_candidate_district",
			"first_candidate_contribution_date",
			"second_candidate_last_name",
			"second_candidate_first_name",
			"second_candidate_middle_name",
			"second_candidate_prefix",
			"second_candidate_suffix",
			"second_candidate_office",
			"second_candidate_state",
			"second_candidate_district",
			"second_candidate_contribution_date",
			"third_candidate_last_name",
			"third_candidate_first_name",
			"third_candidate_middle_name",
			"third_candidate_prefix",
			"third_candidate_suffix",
			"third_candidate_office",
			"third_candidate_state",
			"third_candidate_district",
			"third_candidate_contribution_date",
			"fourth_candidate_last_name",
			"fourth_candidate_first_name",
			"fourth_candidate_middle_name",
			"fourth_candidate_prefix",
			"fourth_candidate_suffix",
			"fourth_candidate_office",
			"fourth_candidate_state",
			"fourth_candidate_district",
			"fourth_candidate_contribution_date",
			"fifth_candidate_last_name",
			"fifth_candidate_first_name",
			"fifth_candidate_middle_name",
			"fifth_candidate_prefix",
			"fifth_candidate_suffix",
			"fifth_candidate_office",
			"fifth_candidate_state",
			"fifth_candidate_district",
			"fifth_candidate_contribution_date",
			"fifty_first_contributor_date",
			"original_registration_date",
			"requirements_met_date",
			"treasurer_last_name",
			"treasurer_first_name",
			"treasurer_middle_name",
			"treasurer_prefix",
			"treasurer_suffix",
			"date_signed",
			"beginning_image_number",
			"end_image_number",
			"receipt_date"
		],
		"^P1|^P2|^P3.0|^P3.1": [
			"form_type",
			"filer_committee_id_number",
			"committee_name",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"committee_type",
			"affiliated_date_f1_filed",
			"affiliated_committee_name",
			"affiliated_committee_id_number",
			"first_candidate_last_name",
			"first_candidate_first_name",
			"first_candidate_middle_name",
			"first_candidate_prefix",
			"first_candidate_suffix",
			"first_candidate_office",
			"first_candidate_state",
			"first_candidate_district",
			"first_candidate_contribution_date",
			"second_candidate_last_name",
			"second_candidate_first_name",
			"second_candidate_middle_name",
			"second_candidate_prefix",
			"second_candidate_suffix",
			"second_candidate_office",
			"second_candidate_state",
			"second_candidate_district",
			"second_candidate_contribution_date",
			"third_candidate_last_name",
			"third_candidate_first_name",
			"third_candidate_middle_name",
			"third_candidate_prefix",
			"third_candidate_suffix",
			"third_candidate_office",
			"third_candidate_state",
			"third_candidate_district",
			"third_candidate_contribution_date",
			"fourth_candidate_last_name",
			"fourth_candidate_first_name",
			"fourth_candidate_middle_name",
			"fourth_candidate_prefix",
			"fourth_candidate_suffix",
			"fourth_candidate_office",
			"fourth_candidate_state",
			"fourth_candidate_district",
			"fourth_candidate_contribution_date",
			"fifth_candidate_last_name",
			"fifth_candidate_first_name",
			"fifth_candidate_middle_name",
			"fifth_candidate_prefix",
			"fifth_candidate_suffix",
			"fifth_candidate_office",
			"fifth_candidate_state",
			"fifth_candidate_district",
			"fifth_candidate_contribution_date",
			"fifty_first_contributor_date",
			"original_registration_date",
			"requirements_met_date",
			"treasurer_last_name",
			"treasurer_first_name",
			"treasurer_middle_name",
			"treasurer_prefix",
			"treasurer_suffix",
			"date_signed",
			"beginning_image_number"
		],
		"^8.3|8.2|8.1|8.0|7.0|6.4|6.3|6.2|6.1": [
			"form_type",
			"filer_committee_id_number",
			"committee_name",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"committee_type",
			"affiliated_date_f1_filed",
			"affiliated_committee_id_number",
			"affiliated_committee_name",
			"first_candidate_id_number",
			"first_candidate_last_name",
			"first_candidate_first_name",
			"first_candidate_middle_name",
			"first_candidate_prefix",
			"first_candidate_suffix",
			"first_candidate_office",
			"first_candidate_state",
			"first_candidate_district",
			"first_candidate_contribution_date",
			"second_candidate_id_number",
			"second_candidate_last_name",
			"second_candidate_first_name",
			"second_candidate_middle_name",
			"second_candidate_prefix",
			"second_candidate_suffix",
			"second_candidate_office",
			"second_candidate_state",
			"second_candidate_district",
			"second_candidate_contribution_date",
			"third_candidate_id_number",
			"third_candidate_last_name",
			"third_candidate_first_name",
			"third_candidate_middle_name",
			"third_candidate_prefix",
			"third_candidate_suffix",
			"third_candidate_office",
			"third_candidate_state",
			"third_candidate_district",
			"third_candidate_contribution_date",
			"fourth_candidate_id_number",
			"fourth_candidate_last_name",
			"fourth_candidate_first_name",
			"fourth_candidate_middle_name",
			"fourth_candidate_prefix",
			"fourth_candidate_suffix",
			"fourth_candidate_office",
			"fourth_candidate_state",
			"fourth_candidate_district",
			"fourth_candidate_contribution_date",
			"fifth_candidate_id_number",
			"fifth_candidate_last_name",
			"fifth_candidate_first_name",
			"fifth_candidate_middle_name",
			"fifth_candidate_prefix",
			"fifth_candidate_suffix",
			"fifth_candidate_office",
			"fifth_candidate_state",
			"fifth_candidate_district",
			"fifth_candidate_contribution_date",
			"fifty_first_contributor_date",
			"original_registration_date",
			"requirements_met_date",
			"treasurer_last_name",
			"treasurer_first_name",
			"treasurer_middle_name",
			"treasurer_prefix",
			"treasurer_suffix",
			"date_signed"
		],
		"^5.3|5.2|5.1|5.0|^3.0": [
			"form_type",
			"filer_committee_id_number",
			"committee_name",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"committee_type",
			"affiliated_date_f1_filed",
			"affiliated_committee_id_number",
			"affiliated_committee_name",
			"first_candidate_id_number",
			"first_candidate_name",
			"first_candidate_office",
			"first_candidate_state",
			"first_candidate_district",
			"first_candidate_contribution_date",
			"second_candidate_id_number",
			"second_candidate_name",
			"second_candidate_office",
			"second_candidate_state",
			"second_candidate_district",
			"second_candidate_contribution_date",
			"third_candidate_id_number",
			"third_candidate_name",
			"third_candidate_office",
			"third_candidate_state",
			"third_candidate_district",
			"third_candidate_contribution_date",
			"fourth_candidate_id_number",
			"fourth_candidate_name",
			"fourth_candidate_office",
			"fourth_candidate_state",
			"fourth_candidate_district",
			"fourth_candidate_contribution_date",
			"fifth_candidate_id_number",
			"fifth_candidate_name",
			"fifth_candidate_office",
			"fifth_candidate_state",
			"fifth_candidate_district",
			"fifth_candidate_contribution_date",
			"fifty_first_contributor_date",
			"original_registration_date",
			"requirements_met_date",
			"treasurer_name",
			"date_signed"
		]
	},
		"^f1s": {
		"^P2.6|^P3": [
			"form_type",
			"filer_committee_id_number",
			"joint_fund_participant_committee_name",
			"joint_fund_participant_committee_id_number",
			"affiliated_committee_name",
			"affiliated_last_name",
			"affiliated_first_name",
			"affiliated_middle_name",
			"affiliated_prefix",
			"affiliated_suffix",
			"affiliated_street_1",
			"affiliated_street_2",
			"affiliated_city",
			"affiliated_state",
			"affiliated_zip_code",
			"affiliated_relationship_code",
			"agent_last_name",
			"agent_first_name",
			"agent_middle_name",
			"agent_prefix",
			"agent_suffix",
			"agent_street_1",
			"agent_street_2",
			"agent_city",
			"agent_state",
			"agent_zip_code",
			"agent_title",
			"agent_telephone",
			"bank_name",
			"bank_street_1",
			"bank_street_2",
			"bank_city",
			"bank_state",
			"bank_zip_code",
			"beginning_image_number"
		],
		"^P2.4": [
			"form_type",
			"filer_committee_id_number",
			"joint_fund_participant_committee_name",
			"joint_fund_participant_committee_id_number",
			"affiliated_committee_name",
			"affiliated_street_1",
			"affiliated_street_2",
			"affiliated_city",
			"affiliated_state",
			"affiliated_zip_code",
			"affiliated_relationship_code",
			"agent_last_name",
			"agent_first_name",
			"agent_middle_name",
			"agent_prefix",
			"agent_suffix",
			"agent_street_1",
			"agent_street_2",
			"agent_city",
			"agent_state",
			"agent_zip_code",
			"agent_title",
			"agent_telephone",
			"bank_name",
			"bank_street_1",
			"bank_street_2",
			"bank_city",
			"bank_state",
			"bank_zip_code",
			"beginning_image_number"
		],
		"^P1|^P2.2|^P2.3": [
			"form_type",
			"filer_committee_id_number",
			"affiliated_committee_name",
			"affiliated_street_1",
			"affiliated_street_2",
			"affiliated_city",
			"affiliated_state",
			"affiliated_zip_code",
			"affiliated_relationship_code",
			"affiliated_organization_type",
			"agent_last_name",
			"agent_first_name",
			"agent_middle_name",
			"agent_prefix",
			"agent_suffix",
			"agent_street_1",
			"agent_street_2",
			"agent_city",
			"agent_state",
			"agent_zip_code",
			"agent_title",
			"agent_telephone",
			"bank_name",
			"bank_street_1",
			"bank_street_2",
			"bank_city",
			"bank_state",
			"bank_zip_code",
			"beginning_image_number"
		],
		"^8.3|8.2|8.1|8.0|7.0|6.4|6.3|6.2": [
			"form_type",
			"filer_committee_id_number",
			"joint_fund_participant_committee_name",
			"joint_fund_participant_committee_id_number",
			"affiliated_committee_id_number",
			"affiliated_committee_name",
			"affiliated_candidate_id_number",
			"affiliated_last_name",
			"affiliated_first_name",
			"affiliated_middle_name",
			"affiliated_prefix",
			"affiliated_suffix",
			"affiliated_street_1",
			"affiliated_street_2",
			"affiliated_city",
			"affiliated_state",
			"affiliated_zip_code",
			"affiliated_relationship_code",
			"agent_last_name",
			"agent_first_name",
			"agent_middle_name",
			"agent_prefix",
			"agent_suffix",
			"agent_street_1",
			"agent_street_2",
			"agent_city",
			"agent_state",
			"agent_zip_code",
			"agent_title",
			"agent_telephone",
			"bank_name",
			"bank_street_1",
			"bank_street_2",
			"bank_city",
			"bank_state",
			"bank_zip_code"
		],
		"^6.1": [
			"form_type",
			"filer_committee_id_number",
			"affiliated_committee_id_number",
			"affiliated_committee_name",
			"affiliated_street_1",
			"affiliated_street_2",
			"affiliated_city",
			"affiliated_state",
			"affiliated_zip_code",
			"affiliated_relationship_code",
			"",
			"agent_last_name",
			"agent_first_name",
			"agent_middle_name",
			"agent_prefix",
			"agent_suffix",
			"agent_street_1",
			"agent_street_2",
			"agent_city",
			"agent_state",
			"agent_zip_code",
			"agent_title",
			"agent_telephone",
			"bank_name",
			"bank_street_1",
			"bank_street_2",
			"bank_city",
			"bank_state",
			"bank_zip_code"
		],
		"^5.3|5.2|5.1|5.0": [
		],
		"^3.0": [
		]
	},
		"(^f2$)|(^f2[^4])": {
		"^P3.4": [
			"form_type",
			"candidate_id_number",
			"candidate_last_name",
			"candidate_first_name",
			"candidate_middle_name",
			"candidate_prefix",
			"candidate_suffix",
			"candidate_street_1",
			"candidate_street_2",
			"change_of_address",
			"candidate_city",
			"candidate_state",
			"candidate_zip_code",
			"candidate_party_code",
			"candidate_office",
			"candidate_state",
			"candidate_district",
			"election_year",
			"committee_name",
			"committee_street_1",
			"committee_street_2",
			"committee_city",
			"committee_state",
			"committee_zip_code",
			"authorized_committee_name",
			"authorized_committee_street_1",
			"authorized_committee_street_2",
			"authorized_committee_city",
			"authorized_committee_state",
			"authorized_committee_zip_code",
			"candidate_signature_last_name",
			"candidate_signature_first_name",
			"candidate_signature_middle_name",
			"candidate_signature_prefix",
			"candidate_signature_suffix",
			"date_signed",
			"beginning_image_number",
			"end_image_number",
			"receipt_date",
			"vice_president_last_name",
			"vice_president_first_name",
			"vice_president_middle_name",
			"vice_president_prefix",
			"vice_president_suffix"
		],
		"^P3.3|^P3.2": [
			"form_type",
			"candidate_id_number",
			"candidate_last_name",
			"candidate_first_name",
			"candidate_middle_name",
			"candidate_prefix",
			"candidate_suffix",
			"candidate_street_1",
			"candidate_street_2",
			"change_of_address",
			"candidate_city",
			"candidate_state",
			"candidate_zip_code",
			"candidate_party_code",
			"candidate_office",
			"candidate_state",
			"candidate_district",
			"election_year",
			"committee_name",
			"committee_street_1",
			"committee_street_2",
			"committee_city",
			"committee_state",
			"committee_zip_code",
			"authorized_committee_name",
			"authorized_committee_street_1",
			"authorized_committee_street_2",
			"authorized_committee_city",
			"authorized_committee_state",
			"authorized_committee_zip_code",
			"candidate_signature_last_name",
			"candidate_signature_first_name",
			"candidate_signature_middle_name",
			"candidate_signature_prefix",
			"candidate_signature_suffix",
			"date_signed",
			"beginning_image_number",
			"end_image_number",
			"receipt_date"
		],
		"^P(3.1|3.0|2.6)": [
			"form_type",
			"candidate_id_number",
			"candidate_last_name",
			"candidate_first_name",
			"candidate_middle_name",
			"candidate_prefix",
			"candidate_suffix",
			"candidate_street_1",
			"candidate_street_2",
			"change_of_address",
			"candidate_city",
			"candidate_state",
			"candidate_zip_code",
			"candidate_party_code",
			"candidate_office",
			"candidate_state",
			"candidate_district",
			"election_year",
			"committee_name",
			"committee_street_1",
			"committee_street_2",
			"committee_city",
			"committee_state",
			"committee_zip_code",
			"authorized_committee_name",
			"authorized_committee_street_1",
			"authorized_committee_street_2",
			"authorized_committee_city",
			"authorized_committee_state",
			"authorized_committee_zip_code",
			"candidate_signature_last_name",
			"candidate_signature_first_name",
			"candidate_signature_middle_name",
			"candidate_signature_prefix",
			"candidate_signature_suffix",
			"date_signed",
			"beginning_image_number"
		],
		"^P(2.4|2.3|2.2|1)": [
			"form_type",
			"candidate_id_number",
			"candidate_last_name",
			"candidate_first_name",
			"candidate_middle_name",
			"candidate_prefix",
			"candidate_suffix",
			"candidate_street_1",
			"candidate_street_2",
			"change_of_address",
			"candidate_city",
			"candidate_state",
			"candidate_zip_code",
			"candidate_party_code",
			"candidate_office",
			"candidate_state",
			"candidate_district",
			"election_year",
			"committee_name",
			"committee_street_1",
			"committee_street_2",
			"committee_city",
			"committee_state",
			"committee_zip_code",
			"authorized_committee_name",
			"authorized_committee_street_1",
			"authorized_committee_street_2",
			"authorized_committee_city",
			"authorized_committee_state",
			"authorized_committee_zip_code",
			"primary_personal_funds_declared",
			"general_personal_funds_declared",
			"candidate_signature_last_name",
			"candidate_signature_first_name",
			"candidate_signature_middle_name",
			"candidate_signature_prefix",
			"candidate_signature_suffix",
			"date_signed",
			"beginning_image_number"
		],
		"^8.3|8.2": [
			"form_type",
			"candidate_id_number",
			"candidate_last_name",
			"candidate_first_name",
			"candidate_middle_name",
			"candidate_prefix",
			"candidate_suffix",
			"vice_president_last_name",
			"vice_president_first_name",
			"vice_president_middle_name",
			"vice_president_prefix",
			"vice_president_suffix",
			"change_of_address",
			"candidate_street_1",
			"candidate_street_2",
			"candidate_city",
			"candidate_state",
			"candidate_zip_code",
			"candidate_party_code",
			"candidate_office",
			"candidate_state",
			"candidate_district",
			"election_year",
			"committee_id_number",
			"committee_name",
			"committee_street_1",
			"committee_street_2",
			"committee_city",
			"committee_state",
			"committee_zip_code",
			"authorized_committee_id_number",
			"authorized_committee_name",
			"authorized_committee_street_1",
			"authorized_committee_street_2",
			"authorized_committee_city",
			"authorized_committee_state",
			"authorized_committee_zip_code",
			"candidate_signature_last_name",
			"candidate_signature_first_name",
			"candidate_signature_middle_name",
			"candidate_signature_prefix",
			"candidate_signature_suffix",
			"date_signed"
		],
		"^8.1|8.0|7.0|6.4": [
			"form_type",
			"candidate_id_number",
			"candidate_last_name",
			"candidate_first_name",
			"candidate_middle_name",
			"candidate_prefix",
			"candidate_suffix",
			"change_of_address",
			"candidate_street_1",
			"candidate_street_2",
			"candidate_city",
			"candidate_state",
			"candidate_zip_code",
			"candidate_party_code",
			"candidate_office",
			"candidate_state",
			"candidate_district",
			"election_year",
			"committee_id_number",
			"committee_name",
			"committee_street_1",
			"committee_street_2",
			"committee_city",
			"committee_state",
			"committee_zip_code",
			"authorized_committee_id_number",
			"authorized_committee_name",
			"authorized_committee_street_1",
			"authorized_committee_street_2",
			"authorized_committee_city",
			"authorized_committee_state",
			"authorized_committee_zip_code",
			"candidate_signature_last_name",
			"candidate_signature_first_name",
			"candidate_signature_middle_name",
			"candidate_signature_prefix",
			"candidate_signature_suffix",
			"date_signed"
		],
		"^6.3|6.2|6.1": [
			"form_type",
			"candidate_id_number",
			"candidate_last_name",
			"candidate_first_name",
			"candidate_middle_name",
			"candidate_prefix",
			"candidate_suffix",
			"change_of_address",
			"candidate_street_1",
			"candidate_street_2",
			"candidate_city",
			"candidate_state",
			"candidate_zip_code",
			"candidate_party_code",
			"candidate_office",
			"candidate_state",
			"candidate_district",
			"election_year",
			"committee_id_number",
			"committee_name",
			"committee_street_1",
			"committee_street_2",
			"committee_city",
			"committee_state",
			"committee_zip_code",
			"authorized_committee_id_number",
			"authorized_committee_name",
			"authorized_committee_street_1",
			"authorized_committee_street_2",
			"authorized_committee_city",
			"authorized_committee_state",
			"authorized_committee_zip_code",
			"primary_personal_funds_declared",
			"general_personal_funds_declared",
			"candidate_signature_last_name",
			"candidate_signature_first_name",
			"candidate_signature_middle_name",
			"candidate_signature_prefix",
			"candidate_signature_suffix",
			"date_signed"
		],
		"^5.3|5.2|5.1|5.0": [
			"form_type",
			"candidate_id_number",
			"candidate_name",
			"candidate_street_1",
			"candidate_street_2",
			"candidate_city",
			"candidate_state",
			"candidate_zip_code",
			"candidate_party_code",
			"candidate_office",
			"candidate_state",
			"candidate_district",
			"election_year",
			"committee_id_number",
			"committee_name",
			"committee_street_1",
			"committee_street_2",
			"committee_city",
			"committee_state",
			"committee_zip_code",
			"authorized_committee_id_number",
			"authorized_committee_name",
			"authorized_committee_street_1",
			"authorized_committee_street_2",
			"authorized_committee_city",
			"authorized_committee_state",
			"authorized_committee_zip_code",
			"candidate_signature_name",
			"date_signed",
			"primary_personal_funds_declared",
			"general_personal_funds_declared",
			"candidate_last_name",
			"candidate_first_name",
			"candidate_middle_name",
			"candidate_prefix",
			"candidate_suffix"
		],
		"^3.0": [
			"form_type",
			"candidate_id_number",
			"candidate_name",
			"candidate_street_1",
			"candidate_street_2",
			"candidate_city",
			"candidate_state",
			"candidate_zip_code",
			"candidate_party_code",
			"candidate_office",
			"candidate_state",
			"candidate_district",
			"election_year",
			"committee_id_number",
			"committee_name",
			"committee_street_1",
			"committee_street_2",
			"committee_city",
			"committee_state",
			"committee_zip_code",
			"authorized_committee_id_number",
			"authorized_committee_name",
			"authorized_committee_street_1",
			"authorized_committee_street_2",
			"authorized_committee_city",
			"authorized_committee_state",
			"authorized_committee_zip_code",
			"candidate_signature_name",
			"date_signed"
		]
	},
		"(^f24$)|(^f24[an])": {
		"^(P3.4|P3.3|P3.2)": [
			"form_type",
			"filer_committee_id_number",
			"committee_name",
			"report_type",
			"original_amendment_date",
			"treasurer_last_name",
			"treasurer_first_name",
			"treasurer_middle_name",
			"treasurer_prefix",
			"treasurer_suffix",
			"date_signed",
			"beginning_image_number",
			"end_image_number",
			"receipt_date"
		],
		"^(P3.1|P3.0)": [
			"form_type",
			"filer_committee_id_number",
			"committee_name",
			"report_type",
			"original_amendment_date",
			"treasurer_last_name",
			"treasurer_first_name",
			"treasurer_middle_name",
			"treasurer_prefix",
			"treasurer_suffix",
			"date_signed",
			"beginning_image_number"
		],
		"^(P2|P1)": [
			"form_type",
			"filer_committee_id_number",
			"committee_name",
			"report_type",
			"treasurer_last_name",
			"treasurer_first_name",
			"treasurer_middle_name",
			"treasurer_prefix",
			"treasurer_suffix",
			"date_signed",
			"beginning_image_number"
		],
		"^8.3|8.2|8.1|8.0": [
			"form_type",
			"filer_committee_id_number",
			"report_type",
			"original_amendment_date",
			"committee_name",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"treasurer_last_name",
			"treasurer_first_name",
			"treasurer_middle_name",
			"treasurer_prefix",
			"treasurer_suffix",
			"date_signed"
		],
		"^7.0|6.4|6.3|6.2|6.1": [
			"form_type",
			"filer_committee_id_number",
			"report_type",
			"committee_name",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"treasurer_last_name",
			"treasurer_first_name",
			"treasurer_middle_name",
			"treasurer_prefix",
			"treasurer_suffix",
			"date_signed"
		],
		"^5.0|5.1|5.2|5.3": [
			"form_type",
			"filer_committee_id_number",
			"committee_name",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"",
			"date_signed",
			"report_type"
		],
		"^3": [
			"form_type",
			"filer_committee_id_number",
			"committee_name",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"",
			"date_signed"
		]
	},
		"^f3[a|n|t]": {
		"^P3.2|^P3.3|^P3.4": [
			"form_type",
			"filer_committee_id_number",
			"committee_name",
			"change_of_address",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"election_state",
			"election_district",
			"report_code",
			"election_date",
			"state_of_election",
			"coverage_from_date",
			"coverage_through_date",
			"treasurer_last_name",
			"treasurer_first_name",
			"treasurer_middle_name",
			"treasurer_prefix",
			"treasurer_suffix",
			"date_signed",
			"col_a_total_contributions_no_loans",
			"col_a_total_contributions_refunds",
			"col_a_net_contributions",
			"col_a_total_operating_expenditures",
			"col_a_total_offset_to_operating_expenditures",
			"col_a_net_operating_expenditures",
			"col_a_cash_on_hand_close_of_period",
			"col_a_debts_to",
			"col_a_debts_by",
			"col_a_individual_contributions_itemized",
			"col_a_individual_contributions_unitemized",
			"col_a_total_individual_contributions",
			"col_a_political_party_contributions",
			"col_a_pac_contributions",
			"col_a_candidate_contributions",
			"col_a_total_contributions",
			"col_a_transfers_from_authorized",
			"col_a_candidate_loans",
			"col_a_other_loans",
			"col_a_total_loans",
			"col_a_offset_to_operating_expenditures",
			"col_a_other_receipts",
			"col_a_total_receipts",
			"col_a_operating_expenditures",
			"col_a_transfers_to_authorized",
			"col_a_candidate_loan_repayments",
			"col_a_other_loan_repayments",
			"col_a_total_loan_repayments",
			"col_a_refunds_to_individuals",
			"col_a_refunds_to_party_committees",
			"col_a_refunds_to_other_committees",
			"col_a_total_refunds",
			"col_a_other_disbursements",
			"col_a_total_disbursements",
			"col_b_total_contributions_no_loans",
			"col_b_total_contributions_refunds",
			"col_b_net_contributions",
			"col_b_total_operating_expenditures",
			"col_b_total_offset_to_operating_expenditures",
			"col_b_net_operating_expenditures",
			"col_b_individual_contributions_itemized",
			"col_b_individual_contributions_unitemized",
			"col_b_total_individual_contributions",
			"col_b_political_party_contributions",
			"col_b_pac_contributions",
			"col_b_candidate_contributions",
			"col_b_total_contributions",
			"col_b_transfers_from_authorized",
			"col_b_candidate_loans",
			"col_b_other_loans",
			"col_b_total_loans",
			"col_b_offset_to_operating_expenditures",
			"col_b_other_receipts",
			"col_b_total_receipts",
			"col_b_operating_expenditures",
			"col_b_transfers_to_authorized",
			"col_b_candidate_loan_repayments",
			"col_b_other_loan_repayments",
			"col_b_total_loan_repayments",
			"col_b_refunds_to_individuals",
			"col_b_refunds_to_party_committees",
			"col_b_refunds_to_other_committees",
			"col_b_total_refunds",
			"col_b_other_disbursements",
			"col_b_total_disbursements",
			"col_a_cash_beginning_reporting_period",
			"col_a_total_receipts_period",
			"col_a_subtotals",
			"col_a_total_disbursements_period",
			"col_a_cash_on_hand_close",
			"beginning_image_number",
			"end_image_number",
			"receipt_date"
		],
		"^(P2.6|P3.0|P3.1)": [
			"form_type",
			"filer_committee_id_number",
			"committee_name",
			"change_of_address",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"election_state",
			"election_district",
			"report_code",
			"election_date",
			"state_of_election",
			"coverage_from_date",
			"coverage_through_date",
			"treasurer_last_name",
			"treasurer_first_name",
			"treasurer_middle_name",
			"treasurer_prefix",
			"treasurer_suffix",
			"date_signed",
			"col_a_total_contributions_no_loans",
			"col_a_total_contributions_refunds",
			"col_a_net_contributions",
			"col_a_total_operating_expenditures",
			"col_a_total_offset_to_operating_expenditures",
			"col_a_net_operating_expenditures",
			"col_a_cash_on_hand_close_of_period",
			"col_a_debts_to",
			"col_a_debts_by",
			"col_a_individual_contributions_itemized",
			"col_a_individual_contributions_unitemized",
			"col_a_total_individual_contributions",
			"col_a_political_party_contributions",
			"col_a_pac_contributions",
			"col_a_candidate_contributions",
			"col_a_total_contributions",
			"col_a_transfers_from_authorized",
			"col_a_candidate_loans",
			"col_a_other_loans",
			"col_a_total_loans",
			"col_a_offset_to_operating_expenditures",
			"col_a_other_receipts",
			"col_a_total_receipts",
			"col_a_operating_expenditures",
			"col_a_transfers_to_authorized",
			"col_a_candidate_loan_repayments",
			"col_a_other_loan_repayments",
			"col_a_total_loan_repayments",
			"col_a_refunds_to_individuals",
			"col_a_refunds_to_party_committees",
			"col_a_refunds_to_other_committees",
			"col_a_total_refunds",
			"col_a_other_disbursements",
			"col_a_total_disbursements",
			"col_b_total_contributions_no_loans",
			"col_b_total_contributions_refunds",
			"col_b_net_contributions",
			"col_b_total_operating_expenditures",
			"col_b_total_offset_to_operating_expenditures",
			"col_b_net_operating_expenditures",
			"col_b_individual_contributions_itemized",
			"col_b_individual_contributions_unitemized",
			"col_b_total_individual_contributions",
			"col_b_political_party_contributions",
			"col_b_pac_contributions",
			"col_b_candidate_contributions",
			"col_b_total_contributions",
			"col_b_transfers_from_authorized",
			"col_b_candidate_loans",
			"col_b_other_loans",
			"col_b_total_loans",
			"col_b_offset_to_operating_expenditures",
			"col_b_other_receipts",
			"col_b_total_receipts",
			"col_b_operating_expenditures",
			"col_b_transfers_to_authorized",
			"col_b_candidate_loan_repayments",
			"col_b_other_loan_repayments",
			"col_b_total_loan_repayments",
			"col_b_refunds_to_individuals",
			"col_b_refunds_to_party_committees",
			"col_b_refunds_to_other_committees",
			"col_b_total_refunds",
			"col_b_other_disbursements",
			"col_b_total_disbursements",
			"col_a_cash_beginning_reporting_period",
			"col_a_total_receipts_period",
			"col_a_subtotals",
			"col_a_total_disbursements_period",
			"col_a_cash_on_hand_close",
			"beginning_image_number"
		],
		"^(P1|P2.2|P2.3|P2.4)": [
			"form_type",
			"filer_committee_id_number",
			"committee_name",
			"change_of_address",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"election_state",
			"election_district",
			"report_code",
			"election_date",
			"state_of_election",
			"coverage_from_date",
			"coverage_through_date",
			"treasurer_last_name",
			"treasurer_first_name",
			"treasurer_middle_name",
			"treasurer_prefix",
			"treasurer_suffix",
			"date_signed",
			"col_a_total_contributions_no_loans",
			"col_a_total_contributions_refunds",
			"col_a_net_contributions",
			"col_a_total_operating_expenditures",
			"col_a_total_offset_to_operating_expenditures",
			"col_a_net_operating_expenditures",
			"col_a_cash_on_hand_close_of_period",
			"col_a_debts_to",
			"col_a_debts_by",
			"col_a_individual_contributions_itemized",
			"col_a_individual_contributions_unitemized",
			"col_a_total_individual_contributions",
			"col_a_political_party_contributions",
			"col_a_pac_contributions",
			"col_a_candidate_contributions",
			"col_a_total_contributions",
			"col_a_transfers_from_authorized",
			"col_a_candidate_loans",
			"col_a_other_loans",
			"col_a_total_loans",
			"col_a_offset_to_operating_expenditures",
			"col_a_other_receipts",
			"col_a_total_receipts",
			"col_a_operating_expenditures",
			"col_a_transfers_to_authorized",
			"col_a_candidate_loan_repayments",
			"col_a_other_loan_repayments",
			"col_a_total_loan_repayments",
			"col_a_refunds_to_individuals",
			"col_a_refunds_to_party_committees",
			"col_a_refunds_to_other_committees",
			"col_a_total_refunds",
			"col_a_other_disbursements",
			"col_a_total_disbursements",
			"col_b_total_contributions_no_loans",
			"col_b_total_contributions_refunds",
			"col_b_net_contributions",
			"col_b_total_operating_expenditures",
			"col_b_total_offset_to_operating_expenditures",
			"col_b_net_operating_expenditures",
			"col_b_individual_contributions_itemized",
			"col_b_individual_contributions_unitemized",
			"col_b_total_individual_contributions",
			"col_b_political_party_contributions",
			"col_b_pac_contributions",
			"col_b_candidate_contributions",
			"col_b_total_contributions",
			"col_b_transfers_from_authorized",
			"col_b_candidate_loans",
			"col_b_other_loans",
			"col_b_total_loans",
			"col_b_offset_to_operating_expenditures",
			"col_b_other_receipts",
			"col_b_total_receipts",
			"col_b_operating_expenditures",
			"col_b_transfers_to_authorized",
			"col_b_candidate_loan_repayments",
			"col_b_other_loan_repayments",
			"col_b_total_loan_repayments",
			"col_b_refunds_to_individuals",
			"col_b_refunds_to_party_committees",
			"col_b_refunds_to_other_committees",
			"col_b_total_refunds",
			"col_b_other_disbursements",
			"col_b_total_disbursements",
			"col_a_cash_beginning_reporting_period",
			"col_a_total_receipts_period",
			"col_a_subtotals",
			"col_a_total_disbursements_period",
			"col_a_cash_on_hand_close",
			"candidate_last_name",
			"candidate_first_name",
			"candidate_middle_name",
			"candidate_prefix",
			"candidate_suffix",
			"candidate_id_number",
			"report_type",
			"col_b_gross_receipts_authorized_primary",
			"col_b_aggregate_personal_funds_primary",
			"col_b_gross_receipts_minus_personal_funds_primary",
			"col_b_gross_receipts_authorized_general",
			"col_b_aggregate_personal_funds_general",
			"col_b_gross_receipts_minus_personal_funds_general",
			"beginning_image_number"
		],
		"^8.3|8.2|8.1|8.0|7.0|6.4": [
			"form_type",
			"filer_committee_id_number",
			"committee_name",
			"change_of_address",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"election_state",
			"election_district",
			"report_code",
			"election_code",
			"election_date",
			"state_of_election",
			"coverage_from_date",
			"coverage_through_date",
			"treasurer_last_name",
			"treasurer_first_name",
			"treasurer_middle_name",
			"treasurer_prefix",
			"treasurer_suffix",
			"date_signed",
			"col_a_total_contributions_no_loans",
			"col_a_total_contributions_refunds",
			"col_a_net_contributions",
			"col_a_total_operating_expenditures",
			"col_a_total_offset_to_operating_expenditures",
			"col_a_net_operating_expenditures",
			"col_a_cash_on_hand_close_of_period",
			"col_a_debts_to",
			"col_a_debts_by",
			"col_a_individual_contributions_itemized",
			"col_a_individual_contributions_unitemized",
			"col_a_total_individual_contributions",
			"col_a_political_party_contributions",
			"col_a_pac_contributions",
			"col_a_candidate_contributions",
			"col_a_total_contributions",
			"col_a_transfers_from_authorized",
			"col_a_candidate_loans",
			"col_a_other_loans",
			"col_a_total_loans",
			"col_a_offset_to_operating_expenditures",
			"col_a_other_receipts",
			"col_a_total_receipts",
			"col_a_operating_expenditures",
			"col_a_transfers_to_authorized",
			"col_a_candidate_loan_repayments",
			"col_a_other_loan_repayments",
			"col_a_total_loan_repayments",
			"col_a_refunds_to_individuals",
			"col_a_refunds_to_party_committees",
			"col_a_refunds_to_other_committees",
			"col_a_total_refunds",
			"col_a_other_disbursements",
			"col_a_total_disbursements",
			"col_a_cash_beginning_reporting_period",
			"col_a_total_receipts_period",
			"col_a_subtotals",
			"col_a_total_disbursements_period",
			"col_a_cash_on_hand_close",
			"col_b_total_contributions_no_loans",
			"col_b_total_contributions_refunds",
			"col_b_net_contributions",
			"col_b_total_operating_expenditures",
			"col_b_total_offset_to_operating_expenditures",
			"col_b_net_operating_expenditures",
			"col_b_individual_contributions_itemized",
			"col_b_individual_contributions_unitemized",
			"col_b_total_individual_contributions",
			"col_b_political_party_contributions",
			"col_b_pac_contributions",
			"col_b_candidate_contributions",
			"col_b_total_contributions",
			"col_b_transfers_from_authorized",
			"col_b_candidate_loans",
			"col_b_other_loans",
			"col_b_total_loans",
			"col_b_offset_to_operating_expenditures",
			"col_b_other_receipts",
			"col_b_total_receipts",
			"col_b_operating_expenditures",
			"col_b_transfers_to_authorized",
			"col_b_candidate_loan_repayments",
			"col_b_other_loan_repayments",
			"col_b_total_loan_repayments",
			"col_b_refunds_to_individuals",
			"col_b_refunds_to_party_committees",
			"col_b_refunds_to_other_committees",
			"col_b_total_refunds",
			"col_b_other_disbursements",
			"col_b_total_disbursements"
		],
		"^6.3|6.2|6.1": [
			"form_type",
			"filer_committee_id_number",
			"committee_name",
			"change_of_address",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"election_state",
			"election_district",
			"report_code",
			"election_code",
			"election_date",
			"state_of_election",
			"coverage_from_date",
			"coverage_through_date",
			"treasurer_last_name",
			"treasurer_first_name",
			"treasurer_middle_name",
			"treasurer_prefix",
			"treasurer_suffix",
			"date_signed",
			"candidate_id_number",
			"candidate_last_name",
			"candidate_first_name",
			"candidate_middle_name",
			"candidate_prefix",
			"candidate_suffix",
			"report_type",
			"col_a_total_contributions_no_loans",
			"col_a_total_contributions_refunds",
			"col_a_net_contributions",
			"col_a_total_operating_expenditures",
			"col_a_total_offset_to_operating_expenditures",
			"col_a_net_operating_expenditures",
			"col_a_cash_on_hand_close_of_period",
			"col_a_debts_to",
			"col_a_debts_by",
			"col_a_individual_contributions_itemized",
			"col_a_individual_contributions_unitemized",
			"col_a_total_individual_contributions",
			"col_a_political_party_contributions",
			"col_a_pac_contributions",
			"col_a_candidate_contributions",
			"col_a_total_contributions",
			"col_a_transfers_from_authorized",
			"col_a_candidate_loans",
			"col_a_other_loans",
			"col_a_total_loans",
			"col_a_offset_to_operating_expenditures",
			"col_a_other_receipts",
			"col_a_total_receipts",
			"col_a_operating_expenditures",
			"col_a_transfers_to_authorized",
			"col_a_candidate_loan_repayments",
			"col_a_other_loan_repayments",
			"col_a_total_loan_repayments",
			"col_a_refunds_to_individuals",
			"col_a_refunds_to_party_committees",
			"col_a_refunds_to_other_committees",
			"col_a_total_refunds",
			"col_a_other_disbursements",
			"col_a_total_disbursements",
			"col_a_cash_beginning_reporting_period",
			"col_a_total_receipts_period",
			"col_a_subtotals",
			"col_a_total_disbursements_period",
			"col_a_cash_on_hand_close",
			"col_b_total_contributions_no_loans",
			"col_b_total_contributions_refunds",
			"col_b_net_contributions",
			"col_b_total_operating_expenditures",
			"col_b_total_offset_to_operating_expenditures",
			"col_b_net_operating_expenditures",
			"col_b_individual_contributions_itemized",
			"col_b_individual_contributions_unitemized",
			"col_b_total_individual_contributions",
			"col_b_political_party_contributions",
			"col_b_pac_contributions",
			"col_b_candidate_contributions",
			"col_b_total_contributions",
			"col_b_transfers_from_authorized",
			"col_b_candidate_loans",
			"col_b_other_loans",
			"col_b_total_loans",
			"col_b_offset_to_operating_expenditures",
			"col_b_other_receipts",
			"col_b_total_receipts",
			"col_b_operating_expenditures",
			"col_b_transfers_to_authorized",
			"col_b_candidate_loan_repayments",
			"col_b_other_loan_repayments",
			"col_b_total_loan_repayments",
			"col_b_refunds_to_individuals",
			"col_b_refunds_to_party_committees",
			"col_b_refunds_to_other_committees",
			"col_b_total_refunds",
			"col_b_other_disbursements",
			"col_b_total_disbursements",
			"col_b_gross_receipts_authorized_primary",
			"col_b_aggregate_personal_funds_primary",
			"col_b_gross_receipts_minus_personal_funds_primary",
			"col_b_gross_receipts_authorized_general",
			"col_b_aggregate_personal_funds_general",
			"col_b_gross_receipts_minus_personal_funds_general"
		],
		"^5.3|5.2|5.1|5.0": [
			"form_type",
			"filer_committee_id_number",
			"committee_name",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"change_of_address",
			"election_state",
			"election_district",
			"report_code",
			"election_code",
			"election_date",
			"state_of_election",
			"primary_election",
			"general_election",
			"special_election",
			"runoff_election",
			"coverage_from_date",
			"coverage_through_date",
			"col_a_total_contributions_no_loans",
			"col_a_total_contributions_refunds",
			"col_a_net_contributions",
			"col_a_total_operating_expenditures",
			"col_a_total_offset_to_operating_expenditures",
			"col_a_net_operating_expenditures",
			"col_a_cash_on_hand_close_of_period",
			"col_a_debts_to",
			"col_a_debts_by",
			"col_a_individual_contributions_itemized",
			"col_a_individual_contributions_unitemized",
			"col_a_total_individual_contributions",
			"col_a_political_party_contributions",
			"col_a_pac_contributions",
			"col_a_candidate_contributions",
			"col_a_total_contributions",
			"col_a_transfers_from_authorized",
			"col_a_candidate_loans",
			"col_a_other_loans",
			"col_a_total_loans",
			"col_a_offset_to_operating_expenditures",
			"col_a_other_receipts",
			"col_a_total_receipts",
			"col_a_operating_expenditures",
			"col_a_transfers_to_authorized",
			"col_a_candidate_loan_repayments",
			"",
			"col_a_total_loan_repayments",
			"col_a_refunds_to_individuals",
			"col_a_refunds_to_party_committees",
			"col_a_refunds_to_other_committees",
			"col_a_total_refunds",
			"col_a_other_disbursements",
			"col_a_total_disbursements",
			"col_a_cash_beginning_reporting_period",
			"col_a_total_receipts_period",
			"col_a_subtotals",
			"col_a_total_disbursements_period",
			"col_a_cash_on_hand_close",
			"col_b_total_contributions_no_loans",
			"col_b_total_contributions_refunds",
			"col_b_net_contributions",
			"col_b_total_operating_expenditures",
			"col_b_total_offset_to_operating_expenditures",
			"col_b_net_operating_expenditures",
			"col_b_individual_contributions_itemized",
			"col_b_individual_contributions_unitemized",
			"col_b_total_individual_contributions",
			"col_b_political_party_contributions",
			"col_b_pac_contributions",
			"col_b_candidate_contributions",
			"col_b_total_contributions",
			"col_b_transfers_from_authorized",
			"col_b_candidate_loans",
			"col_b_other_loans",
			"col_b_total_loans",
			"col_b_offset_to_operating_expenditures",
			"col_b_other_receipts",
			"col_b_total_receipts",
			"col_b_operating_expenditures",
			"col_b_transfers_to_authorized",
			"col_b_candidate_loan_repayments",
			"",
			"col_b_total_loan_repayments",
			"col_b_refunds_to_individuals",
			"",
			"",
			"col_b_total_refunds",
			"col_b_other_disbursements",
			"col_b_total_disbursements",
			"treasurer_name",
			"date_signed",
			"candidate_id_number",
			"candidate_name",
			"report_type",
			"col_b_gross_receipts_authorized_primary",
			"col_b_aggregate_personal_funds_primary",
			"col_b_gross_receipts_minus_personal_funds_primary",
			"col_b_gross_receipts_authorized_general",
			"col_b_aggregate_personal_funds_general",
			"col_b_gross_receipts_minus_personal_funds_general"
		],
		"^3.0|^2|^1": [
			"form_type",
			"filer_committee_id_number",
			"committee_name",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"change_of_address",
			"election_state",
			"election_district",
			"report_code",
			"election_code",
			"election_date",
			"state_of_election",
			"primary_election",
			"general_election",
			"special_election",
			"runoff_election",
			"coverage_from_date",
			"coverage_through_date",
			"col_a_total_contributions_no_loans",
			"col_a_total_contributions_refunds",
			"col_a_net_contributions",
			"col_a_total_operating_expenditures",
			"col_a_total_offset_to_operating_expenditures",
			"col_a_net_operating_expenditures",
			"col_a_cash_on_hand_close_of_period",
			"col_a_debts_to",
			"col_a_debts_by",
			"col_a_individual_contributions_itemized",
			"col_a_individual_contributions_unitemized",
			"col_a_total_individual_contributions",
			"col_a_political_party_contributions",
			"col_a_pac_contributions",
			"col_a_candidate_contributions",
			"col_a_total_contributions",
			"col_a_transfers_from_authorized",
			"col_a_candidate_loans",
			"col_a_other_loans",
			"col_a_total_loans",
			"col_a_offset_to_operating_expenditures",
			"col_a_other_receipts",
			"col_a_total_receipts",
			"col_a_operating_expenditures",
			"col_a_transfers_to_authorized",
			"col_a_candidate_loan_repayments",
			"col_a_other_loan_repayments",
			"col_a_total_loan_repayments",
			"col_a_refunds_to_individuals",
			"col_a_refunds_to_party_committees",
			"col_a_refunds_to_other_committees",
			"col_a_total_refunds",
			"col_a_other_disbursements",
			"col_a_total_disbursements",
			"col_a_cash_beginning_reporting_period",
			"col_a_total_receipts_period",
			"col_a_subtotals",
			"col_a_total_disbursements_period",
			"col_a_cash_on_hand_close",
			"col_b_total_contributions_no_loans",
			"col_b_total_contributions_refunds",
			"col_b_net_contributions",
			"col_b_total_operating_expenditures",
			"col_b_total_offset_to_operating_expenditures",
			"col_b_net_operating_expenditures",
			"col_b_individual_contributions_itemized",
			"col_b_individual_contributions_unitemized",
			"col_b_total_individual_contributions",
			"col_b_political_party_contributions",
			"col_b_pac_contributions",
			"col_b_candidate_contributions",
			"col_b_total_contributions",
			"col_b_transfers_from_authorized",
			"col_b_candidate_loans",
			"col_b_other_loans",
			"col_b_total_loans",
			"col_b_offset_to_operating_expenditures",
			"col_b_other_receipts",
			"col_b_total_receipts",
			"col_b_operating_expenditures",
			"col_b_transfers_to_authorized",
			"col_b_candidate_loan_repayments",
			"col_b_other_loan_repayments",
			"col_b_total_loan_repayments",
			"col_b_refunds_to_individuals",
			"col_b_refunds_to_party_committees",
			"col_b_refunds_to_other_committees",
			"col_b_total_refunds",
			"col_b_other_disbursements",
			"col_b_total_disbursements",
			"treasurer_name",
			"date_signed"
		]
	},
		"^f3l[a|n]": {
		"^P(3.4|3.3|3.2)": [
			"form_type",
			"filer_committee_id_number",
			"committee_name",
			"change_of_address",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"election_state",
			"election_district",
			"report_code",
			"election_date",
			"election_state",
			"semi_annual_period",
			"coverage_from_date",
			"coverage_through_date",
			"semi_annual_period_jan_june",
			"semi_annual_period_jul_dec",
			"quarterly_monthly_bundled_contributions",
			"semi_annual_bundled_contributions",
			"treasurer_last_name",
			"treasurer_first_name",
			"treasurer_middle_name",
			"treasurer_prefix",
			"treasurer_suffix",
			"date_signed",
			"beginning_image_number",
			"end_image_number",
			"receipt_date"
		],
		"^P(3.1|3.0|2.6)": [
			"form_type",
			"filer_committee_id_number",
			"committee_name",
			"change_of_address",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"election_state",
			"election_district",
			"report_code",
			"election_date",
			"election_state",
			"semi_annual_period",
			"coverage_from_date",
			"coverage_through_date",
			"semi_annual_period_jan_june",
			"semi_annual_period_jul_dec",
			"quarterly_monthly_bundled_contributions",
			"semi_annual_bundled_contributions",
			"treasurer_last_name",
			"treasurer_first_name",
			"treasurer_middle_name",
			"treasurer_prefix",
			"treasurer_suffix",
			"date_signed",
			"beginning_image_number"
		],
		"^8.3|8.2|8.1|8.0|7.0|6.4": [
			"form_type",
			"filer_committee_id_number",
			"committee_name",
			"change_of_address",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"election_state",
			"election_district",
			"report_code",
			"election_date",
			"",
			"semi_annual_period",
			"coverage_from_date",
			"coverage_through_date",
			"semi_annual_period_jan_june",
			"semi_annual_period_jul_dec",
			"quarterly_monthly_bundled_contributions",
			"semi_annual_bundled_contributions",
			"treasurer_last_name",
			"treasurer_first_name",
			"treasurer_middle_name",
			"treasurer_prefix",
			"treasurer_suffix",
			"date_signed"
		]
	},
		"(^f3p$)|(^f3p[^s|3])": {
		"^P3.2|^P3.3|^P3.4": [
			"form_type",
			"filer_committee_id_number",
			"committee_name",
			"change_of_address",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"activity_primary",
			"activity_general",
			"report_code",
			"date_of_election",
			"state_of_election",
			"coverage_from_date",
			"coverage_through_date",
			"treasurer_last_name",
			"treasurer_first_name",
			"treasurer_middle_name",
			"treasurer_prefix",
			"treasurer_suffix",
			"date_signed",
			"col_a_cash_on_hand_beginning_period",
			"col_a_total_receipts",
			"col_a_subtotal",
			"col_a_total_disbursements",
			"col_a_cash_on_hand_close_of_period",
			"col_a_debts_to",
			"col_a_debts_by",
			"col_a_expenditures_subject_to_limits",
			"col_a_net_contributions",
			"col_a_net_operating_expenditures",
			"col_a_federal_funds",
			"col_a_individuals_itemized",
			"col_a_individuals_unitemized",
			"col_a_individual_contribution_total",
			"col_a_political_party_committees_receipts",
			"col_a_other_political_committees_pacs",
			"col_a_the_candidate",
			"col_a_total_contributions",
			"col_a_transfers_from_aff_other_party_cmttees",
			"col_a_received_from_or_guaranteed_by_cand",
			"col_a_other_loans",
			"col_a_total_loans",
			"col_a_operating",
			"col_a_fundraising",
			"col_a_legal_and_accounting",
			"col_a_total_offsets_to_expenditures",
			"col_a_other_receipts",
			"col_a_total_receipts",
			"col_a_operating_expenditures",
			"col_a_transfers_to_other_authorized_committees",
			"col_a_fundraising_disbursements",
			"col_a_exempt_legal_accounting_disbursement",
			"col_a_made_or_guaranteed_by_candidate",
			"col_a_other_repayments",
			"col_a_total_loan_repayments_made",
			"col_a_individuals",
			"col_a_political_party_committees_refunds",
			"col_a_other_political_committees",
			"col_a_total_contributions_refunds",
			"col_a_other_disbursements",
			"col_a_total_disbursements",
			"col_a_items_on_hand_to_be_liquidated",
			"col_a_alabama",
			"col_a_alaska",
			"col_a_arizona",
			"col_a_arkansas",
			"col_a_california",
			"col_a_colorado",
			"col_a_connecticut",
			"col_a_delaware",
			"col_a_dist_of_columbia",
			"col_a_florida",
			"col_a_georgia",
			"col_a_hawaii",
			"col_a_idaho",
			"col_a_illinois",
			"col_a_indiana",
			"col_a_iowa",
			"col_a_kansas",
			"col_a_kentucky",
			"col_a_louisiana",
			"col_a_maine",
			"col_a_maryland",
			"col_a_massachusetts",
			"col_a_michigan",
			"col_a_minnesota",
			"col_a_mississippi",
			"col_a_missouri",
			"col_a_montana",
			"col_a_nebraska",
			"col_a_nevada",
			"col_a_new_hampshire",
			"col_a_new_jersey",
			"col_a_new_mexico",
			"col_a_new_york",
			"col_a_north_carolina",
			"col_a_north_dakota",
			"col_a_ohio",
			"col_a_oklahoma",
			"col_a_oregon",
			"col_a_pennsylvania",
			"col_a_rhode_island",
			"col_a_south_carolina",
			"col_a_south_dakota",
			"col_a_tennessee",
			"col_a_texas",
			"col_a_utah",
			"col_a_vermont",
			"col_a_virginia",
			"col_a_washington",
			"col_a_west_virginia",
			"col_a_wisconsin",
			"col_a_wyoming",
			"col_a_puerto_rico",
			"col_a_guam",
			"col_a_virgin_islands",
			"col_a_totals",
			"col_b_federal_funds",
			"col_b_individuals_itemized",
			"col_b_individuals_unitemized",
			"col_b_individual_contribution_total",
			"col_b_political_party_committees_receipts",
			"col_b_other_political_committees_pacs",
			"col_b_the_candidate",
			"col_b_total_contributions_other_than_loans",
			"col_b_transfers_from_aff_other_party_cmttees",
			"col_b_received_from_or_guaranteed_by_cand",
			"col_b_other_loans",
			"col_b_total_loans",
			"col_b_operating",
			"col_b_fundraising",
			"col_b_legal_and_accounting",
			"col_b_total_offsets_to_operating_expenditures",
			"col_b_other_receipts",
			"col_b_total_receipts",
			"col_b_operating_expenditures",
			"col_b_transfers_to_other_authorized_committees",
			"col_b_fundraising_disbursements",
			"col_b_exempt_legal_accounting_disbursement",
			"col_b_made_or_guaranteed_by_the_candidate",
			"col_b_other_repayments",
			"col_b_total_loan_repayments_made",
			"col_b_individuals",
			"col_b_political_party_committees_refunds",
			"col_b_other_political_committees",
			"col_b_total_contributions_refunds",
			"col_b_other_disbursements",
			"col_b_total_disbursements",
			"col_b_alabama",
			"col_b_alaska",
			"col_b_arizona",
			"col_b_arkansas",
			"col_b_california",
			"col_b_colorado",
			"col_b_connecticut",
			"col_b_delaware",
			"col_b_dist_of_columbia",
			"col_b_florida",
			"col_b_georgia",
			"col_b_hawaii",
			"col_b_idaho",
			"col_b_illinois",
			"col_b_indiana",
			"col_b_iowa",
			"col_b_kansas",
			"col_b_kentucky",
			"col_b_louisiana",
			"col_b_maine",
			"col_b_maryland",
			"col_b_massachusetts",
			"col_b_michigan",
			"col_b_minnesota",
			"col_b_mississippi",
			"col_b_missouri",
			"col_b_montana",
			"col_b_nebraska",
			"col_b_nevada",
			"col_b_new_hampshire",
			"col_b_new_jersey",
			"col_b_new_mexico",
			"col_b_new_york",
			"col_b_north_carolina",
			"col_b_north_dakota",
			"col_b_ohio",
			"col_b_oklahoma",
			"col_b_oregon",
			"col_b_pennsylvania",
			"col_b_rhode_island",
			"col_b_south_carolina",
			"col_b_south_dakota",
			"col_b_tennessee",
			"col_b_texas",
			"col_b_utah",
			"col_b_vermont",
			"col_b_virginia",
			"col_b_washington",
			"col_b_west_virginia",
			"col_b_wisconsin",
			"col_b_wyoming",
			"col_b_puerto_rico",
			"col_b_guam",
			"col_b_virgin_islands",
			"col_b_totals",
			"beginning_image_number",
			"end_image_number",
			"receipt_date"
		],
		"^8.3|8.2|8.1|8.0|7.0": [
			"form_type",
			"filer_committee_id_number",
			"committee_name",
			"change_of_address",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"activity_primary",
			"activity_general",
			"report_code",
			"election_code",
			"date_of_election",
			"state_of_election",
			"coverage_from_date",
			"coverage_through_date",
			"treasurer_last_name",
			"treasurer_first_name",
			"treasurer_middle_name",
			"treasurer_prefix",
			"treasurer_suffix",
			"date_signed",
			"col_a_cash_on_hand_beginning_period",
			"col_a_total_receipts",
			"col_a_subtotal",
			"col_a_total_disbursements",
			"col_a_cash_on_hand_close_of_period",
			"col_a_debts_to",
			"col_a_debts_by",
			"col_a_expenditures_subject_to_limits",
			"col_a_net_contributions",
			"col_a_net_operating_expenditures",
			"col_a_federal_funds",
			"col_a_individuals_itemized",
			"col_a_individuals_unitemized",
			"col_a_individual_contribution_total",
			"col_a_political_party_committees_receipts",
			"col_a_other_political_committees_pacs",
			"col_a_the_candidate",
			"col_a_total_contributions",
			"col_a_transfers_from_aff_other_party_cmttees",
			"col_a_received_from_or_guaranteed_by_cand",
			"col_a_other_loans",
			"col_a_total_loans",
			"col_a_operating",
			"col_a_fundraising",
			"col_a_legal_and_accounting",
			"col_a_total_offsets_to_expenditures",
			"col_a_other_receipts",
			"col_a_total_receipts",
			"col_a_operating_expenditures",
			"col_a_transfers_to_other_authorized_committees",
			"col_a_fundraising_disbursements",
			"col_a_exempt_legal_accounting_disbursement",
			"col_a_made_or_guaranteed_by_candidate",
			"col_a_other_repayments",
			"col_a_total_loan_repayments_made",
			"col_a_individuals",
			"col_a_political_party_committees_refunds",
			"col_a_other_political_committees",
			"col_a_total_contributions_refunds",
			"col_a_other_disbursements",
			"col_a_total_disbursements",
			"col_a_items_on_hand_to_be_liquidated",
			"col_a_alabama",
			"col_a_alaska",
			"col_a_arizona",
			"col_a_arkansas",
			"col_a_california",
			"col_a_colorado",
			"col_a_connecticut",
			"col_a_delaware",
			"col_a_dist_of_columbia",
			"col_a_florida",
			"col_a_georgia",
			"col_a_hawaii",
			"col_a_idaho",
			"col_a_illinois",
			"col_a_indiana",
			"col_a_iowa",
			"col_a_kansas",
			"col_a_kentucky",
			"col_a_louisiana",
			"col_a_maine",
			"col_a_maryland",
			"col_a_massachusetts",
			"col_a_michigan",
			"col_a_minnesota",
			"col_a_mississippi",
			"col_a_missouri",
			"col_a_montana",
			"col_a_nebraska",
			"col_a_nevada",
			"col_a_new_hampshire",
			"col_a_new_jersey",
			"col_a_new_mexico",
			"col_a_new_york",
			"col_a_north_carolina",
			"col_a_north_dakota",
			"col_a_ohio",
			"col_a_oklahoma",
			"col_a_oregon",
			"col_a_pennsylvania",
			"col_a_rhode_island",
			"col_a_south_carolina",
			"col_a_south_dakota",
			"col_a_tennessee",
			"col_a_texas",
			"col_a_utah",
			"col_a_vermont",
			"col_a_virginia",
			"col_a_washington",
			"col_a_west_virginia",
			"col_a_wisconsin",
			"col_a_wyoming",
			"col_a_puerto_rico",
			"col_a_guam",
			"col_a_virgin_islands",
			"col_a_totals",
			"col_b_federal_funds",
			"col_b_individuals_itemized",
			"col_b_individuals_unitemized",
			"col_b_individual_contribution_total",
			"col_b_political_party_committees_receipts",
			"col_b_other_political_committees_pacs",
			"col_b_the_candidate",
			"col_b_total_contributions_other_than_loans",
			"col_b_transfers_from_aff_other_party_cmttees",
			"col_b_received_from_or_guaranteed_by_cand",
			"col_b_other_loans",
			"col_b_total_loans",
			"col_b_operating",
			"col_b_fundraising",
			"col_b_legal_and_accounting",
			"col_b_total_offsets_to_operating_expenditures",
			"col_b_other_receipts",
			"col_b_total_receipts",
			"col_b_operating_expenditures",
			"col_b_transfers_to_other_authorized_committees",
			"col_b_fundraising_disbursements",
			"col_b_exempt_legal_accounting_disbursement",
			"col_b_made_or_guaranteed_by_the_candidate",
			"col_b_other_repayments",
			"col_b_total_loan_repayments_made",
			"col_b_individuals",
			"col_b_political_party_committees_refunds",
			"col_b_other_political_committees",
			"col_b_total_contributions_refunds",
			"col_b_other_disbursements",
			"col_b_total_disbursements",
			"col_b_alabama",
			"col_b_alaska",
			"col_b_arizona",
			"col_b_arkansas",
			"col_b_california",
			"col_b_colorado",
			"col_b_connecticut",
			"col_b_delaware",
			"col_b_dist_of_columbia",
			"col_b_florida",
			"col_b_georgia",
			"col_b_hawaii",
			"col_b_idaho",
			"col_b_illinois",
			"col_b_indiana",
			"col_b_iowa",
			"col_b_kansas",
			"col_b_kentucky",
			"col_b_louisiana",
			"col_b_maine",
			"col_b_maryland",
			"col_b_massachusetts",
			"col_b_michigan",
			"col_b_minnesota",
			"col_b_mississippi",
			"col_b_missouri",
			"col_b_montana",
			"col_b_nebraska",
			"col_b_nevada",
			"col_b_new_hampshire",
			"col_b_new_jersey",
			"col_b_new_mexico",
			"col_b_new_york",
			"col_b_north_carolina",
			"col_b_north_dakota",
			"col_b_ohio",
			"col_b_oklahoma",
			"col_b_oregon",
			"col_b_pennsylvania",
			"col_b_rhode_island",
			"col_b_south_carolina",
			"col_b_south_dakota",
			"col_b_tennessee",
			"col_b_texas",
			"col_b_utah",
			"col_b_vermont",
			"col_b_virginia",
			"col_b_washington",
			"col_b_west_virginia",
			"col_b_wisconsin",
			"col_b_wyoming",
			"col_b_puerto_rico",
			"col_b_guam",
			"col_b_virgin_islands",
			"col_b_totals"
		],
		"^6.4|6.3|6.2|6.1": [
			"form_type",
			"filer_committee_id_number",
			"committee_name",
			"change_of_address",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"activity_primary",
			"activity_general",
			"report_code",
			"election_code",
			"date_of_election",
			"state_of_election",
			"coverage_from_date",
			"coverage_through_date",
			"treasurer_last_name",
			"treasurer_first_name",
			"treasurer_middle_name",
			"treasurer_prefix",
			"treasurer_suffix",
			"date_signed",
			"col_a_cash_on_hand_beginning_period",
			"col_a_total_receipts",
			"col_a_subtotal",
			"col_a_total_disbursements",
			"col_a_cash_on_hand_close_of_period",
			"col_a_debts_to",
			"col_a_debts_by",
			"col_a_expenditures_subject_to_limits",
			"col_a_net_contributions",
			"col_a_net_operating_expenditures",
			"col_a_federal_funds",
			"col_a_individual_contribution_total",
			"col_a_political_party_committees_receipts",
			"col_a_other_political_committees_pacs",
			"col_a_the_candidate",
			"col_a_total_contributions",
			"col_a_transfers_from_aff_other_party_cmttees",
			"col_a_received_from_or_guaranteed_by_cand",
			"col_a_other_loans",
			"col_a_total_loans",
			"col_a_operating",
			"col_a_fundraising",
			"col_a_legal_and_accounting",
			"col_a_total_offsets_to_expenditures",
			"col_a_other_receipts",
			"col_a_total_receipts",
			"col_a_operating_expenditures",
			"col_a_transfers_to_other_authorized_committees",
			"col_a_fundraising_disbursements",
			"col_a_exempt_legal_accounting_disbursement",
			"col_a_made_or_guaranteed_by_candidate",
			"col_a_other_repayments",
			"col_a_total_loan_repayments_made",
			"col_a_individuals",
			"col_a_political_party_committees_refunds",
			"col_a_other_political_committees",
			"col_a_total_contributions_refunds",
			"col_a_other_disbursements",
			"col_a_total_disbursements",
			"col_a_items_on_hand_to_be_liquidated",
			"col_a_alabama",
			"col_a_alaska",
			"col_a_arizona",
			"col_a_arkansas",
			"col_a_california",
			"col_a_colorado",
			"col_a_connecticut",
			"col_a_delaware",
			"col_a_dist_of_columbia",
			"col_a_florida",
			"col_a_georgia",
			"col_a_hawaii",
			"col_a_idaho",
			"col_a_illinois",
			"col_a_indiana",
			"col_a_iowa",
			"col_a_kansas",
			"col_a_kentucky",
			"col_a_louisiana",
			"col_a_maine",
			"col_a_maryland",
			"col_a_massachusetts",
			"col_a_michigan",
			"col_a_minnesota",
			"col_a_mississippi",
			"col_a_missouri",
			"col_a_montana",
			"col_a_nebraska",
			"col_a_nevada",
			"col_a_new_hampshire",
			"col_a_new_jersey",
			"col_a_new_mexico",
			"col_a_new_york",
			"col_a_north_carolina",
			"col_a_north_dakota",
			"col_a_ohio",
			"col_a_oklahoma",
			"col_a_oregon",
			"col_a_pennsylvania",
			"col_a_rhode_island",
			"col_a_south_carolina",
			"col_a_south_dakota",
			"col_a_tennessee",
			"col_a_texas",
			"col_a_utah",
			"col_a_vermont",
			"col_a_virginia",
			"col_a_washington",
			"col_a_west_virginia",
			"col_a_wisconsin",
			"col_a_wyoming",
			"col_a_puerto_rico",
			"col_a_guam",
			"col_a_virgin_islands",
			"col_a_totals",
			"col_b_federal_funds",
			"col_b_individual_contribution_total",
			"col_b_political_party_committees_receipts",
			"col_b_other_political_committees_pacs",
			"col_b_the_candidate",
			"col_b_total_contributions_other_than_loans",
			"col_b_transfers_from_aff_other_party_cmttees",
			"col_b_received_from_or_guaranteed_by_cand",
			"col_b_other_loans",
			"col_b_total_loans",
			"col_b_operating",
			"col_b_fundraising",
			"col_b_legal_and_accounting",
			"col_b_total_offsets_to_operating_expenditures",
			"col_b_other_receipts",
			"col_b_total_receipts",
			"col_b_operating_expenditures",
			"col_b_transfers_to_other_authorized_committees",
			"col_b_fundraising_disbursements",
			"col_b_exempt_legal_accounting_disbursement",
			"col_b_made_or_guaranteed_by_the_candidate",
			"col_b_other_repayments",
			"col_b_total_loan_repayments_made",
			"col_b_individuals",
			"col_b_political_party_committees_refunds",
			"col_b_other_political_committees",
			"col_b_total_contributions_refunds",
			"col_b_other_disbursements",
			"col_b_total_disbursements",
			"col_b_alabama",
			"col_b_alaska",
			"col_b_arizona",
			"col_b_arkansas",
			"col_b_california",
			"col_b_colorado",
			"col_b_connecticut",
			"col_b_delaware",
			"col_b_dist_of_columbia",
			"col_b_florida",
			"col_b_georgia",
			"col_b_hawaii",
			"col_b_idaho",
			"col_b_illinois",
			"col_b_indiana",
			"col_b_iowa",
			"col_b_kansas",
			"col_b_kentucky",
			"col_b_louisiana",
			"col_b_maine",
			"col_b_maryland",
			"col_b_massachusetts",
			"col_b_michigan",
			"col_b_minnesota",
			"col_b_mississippi",
			"col_b_missouri",
			"col_b_montana",
			"col_b_nebraska",
			"col_b_nevada",
			"col_b_new_hampshire",
			"col_b_new_jersey",
			"col_b_new_mexico",
			"col_b_new_york",
			"col_b_north_carolina",
			"col_b_north_dakota",
			"col_b_ohio",
			"col_b_oklahoma",
			"col_b_oregon",
			"col_b_pennsylvania",
			"col_b_rhode_island",
			"col_b_south_carolina",
			"col_b_south_dakota",
			"col_b_tennessee",
			"col_b_texas",
			"col_b_utah",
			"col_b_vermont",
			"col_b_virginia",
			"col_b_washington",
			"col_b_west_virginia",
			"col_b_wisconsin",
			"col_b_wyoming",
			"col_b_puerto_rico",
			"col_b_guam",
			"col_b_virgin_islands",
			"col_b_totals"
		],
		"^5.3|5.2": [
			"form_type",
			"filer_committee_id_number",
			"committee_name",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"change_of_address",
			"activity_primary",
			"activity_general",
			"report_code",
			"election_code",
			"date_of_election",
			"state_of_election",
			"coverage_from_date",
			"coverage_through_date",
			"col_a_cash_on_hand_beginning_period",
			"col_a_total_receipts",
			"col_a_subtotal",
			"col_a_total_disbursements",
			"col_a_cash_on_hand_close_of_period",
			"col_a_debts_to",
			"col_a_debts_by",
			"col_a_expenditures_subject_to_limits",
			"col_a_net_contributions",
			"col_a_net_operating_expenditures",
			"col_a_federal_funds",
			"col_a_individual_contribution_total",
			"col_a_political_party_committees_receipts",
			"col_a_other_political_committees_pacs",
			"col_a_the_candidate",
			"col_a_total_contributions",
			"col_a_transfers_from_aff_other_party_cmttees",
			"col_a_received_from_or_guaranteed_by_cand",
			"col_a_other_loans",
			"col_a_total_loans",
			"col_a_operating",
			"col_a_fundraising",
			"col_a_legal_and_accounting",
			"col_a_total_offsets_to_expenditures",
			"col_a_other_receipts",
			"col_a_total_receipts",
			"col_a_operating_expenditures",
			"col_a_transfers_to_other_authorized_committees",
			"col_a_fundraising_disbursements",
			"col_a_exempt_legal_accounting_disbursement",
			"col_a_made_or_guaranteed_by_candidate",
			"col_a_other_repayments",
			"col_a_total_loan_repayments_made",
			"col_a_individuals",
			"col_a_political_party_committees_refunds",
			"col_a_other_political_committees",
			"col_a_total_contributions_refunds",
			"col_a_other_disbursements",
			"col_a_total_disbursements",
			"col_a_items_on_hand_to_be_liquidated",
			"col_a_alabama",
			"col_a_alaska",
			"col_a_arizona",
			"col_a_arkansas",
			"col_a_california",
			"col_a_colorado",
			"col_a_connecticut",
			"col_a_delaware",
			"col_a_dist_of_columbia",
			"col_a_florida",
			"col_a_georgia",
			"col_a_hawaii",
			"col_a_idaho",
			"col_a_illinois",
			"col_a_indiana",
			"col_a_iowa",
			"col_a_kansas",
			"col_a_kentucky",
			"col_a_louisiana",
			"col_a_maine",
			"col_a_maryland",
			"col_a_massachusetts",
			"col_a_michigan",
			"col_a_minnesota",
			"col_a_mississippi",
			"col_a_missouri",
			"col_a_montana",
			"col_a_nebraska",
			"col_a_nevada",
			"col_a_new_hampshire",
			"col_a_new_jersey",
			"col_a_new_mexico",
			"col_a_new_york",
			"col_a_north_carolina",
			"col_a_north_dakota",
			"col_a_ohio",
			"col_a_oklahoma",
			"col_a_oregon",
			"col_a_pennsylvania",
			"col_a_rhode_island",
			"col_a_south_carolina",
			"col_a_south_dakota",
			"col_a_tennessee",
			"col_a_texas",
			"col_a_utah",
			"col_a_vermont",
			"col_a_virginia",
			"col_a_washington",
			"col_a_west_virginia",
			"col_a_wisconsin",
			"col_a_wyoming",
			"col_a_puerto_rico",
			"col_a_guam",
			"col_a_virgin_islands",
			"col_a_totals",
			"col_b_federal_funds",
			"col_b_individual_contribution_total",
			"col_b_political_party_committees_receipts",
			"col_b_other_political_committees_pacs",
			"col_b_the_candidate",
			"col_b_total_contributions_other_than_loans",
			"col_b_transfers_from_aff_other_party_cmttees",
			"col_b_received_from_or_guaranteed_by_cand",
			"col_b_other_loans",
			"col_b_total_loans",
			"col_b_operating",
			"col_b_fundraising",
			"col_b_legal_and_accounting",
			"col_b_total_offsets_to_operating_expenditures",
			"col_b_other_receipts",
			"col_b_total_receipts",
			"col_b_operating_expenditures",
			"col_b_transfers_to_other_authorized_committees",
			"col_b_fundraising_disbursements",
			"col_b_exempt_legal_accounting_disbursement",
			"col_b_made_or_guaranteed_by_the_candidate",
			"col_b_other_repayments",
			"col_b_total_loan_repayments_made",
			"col_b_individuals",
			"col_b_political_party_committees_refunds",
			"col_b_other_political_committees",
			"col_b_total_contributions_refunds",
			"col_b_other_disbursements",
			"col_b_total_disbursements",
			"col_b_alabama",
			"col_b_alaska",
			"col_b_arizona",
			"col_b_arkansas",
			"col_b_california",
			"col_b_colorado",
			"col_b_connecticut",
			"col_b_delaware",
			"col_b_dist_of_columbia",
			"col_b_florida",
			"col_b_georgia",
			"col_b_hawaii",
			"col_b_idaho",
			"col_b_illinois",
			"col_b_indiana",
			"col_b_iowa",
			"col_b_kansas",
			"col_b_kentucky",
			"col_b_louisiana",
			"col_b_maine",
			"col_b_maryland",
			"col_b_massachusetts",
			"col_b_michigan",
			"col_b_minnesota",
			"col_b_mississippi",
			"col_b_missouri",
			"col_b_montana",
			"col_b_nebraska",
			"col_b_nevada",
			"col_b_new_hampshire",
			"col_b_new_jersey",
			"col_b_new_mexico",
			"col_b_new_york",
			"col_b_north_carolina",
			"col_b_north_dakota",
			"col_b_ohio",
			"col_b_oklahoma",
			"col_b_oregon",
			"col_b_pennsylvania",
			"col_b_rhode_island",
			"col_b_south_carolina",
			"col_b_south_dakota",
			"col_b_tennessee",
			"col_b_texas",
			"col_b_utah",
			"col_b_vermont",
			"col_b_virginia",
			"col_b_washington",
			"col_b_west_virginia",
			"col_b_wisconsin",
			"col_b_wyoming",
			"col_b_puerto_rico",
			"col_b_guam",
			"col_b_virgin_islands",
			"col_b_totals",
			"treasurer_name",
			"date_signed"
		],
		"^(5.1|5.0|3|2|1)": [
			"form_type",
			"filer_committee_id_number",
			"committee_name",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"change_of_address",
			"activity_primary",
			"activity_general",
			"report_code",
			"election_code",
			"date_of_election",
			"state_of_election",
			"coverage_from_date",
			"coverage_through_date",
			"col_a_cash_on_hand_beginning_period",
			"col_a_total_receipts",
			"col_a_subtotal",
			"col_a_total_disbursements",
			"col_a_cash_on_hand_close_of_period",
			"col_a_debts_to",
			"col_a_debts_by",
			"col_a_expenditures_subject_to_limits",
			"col_a_net_contributions",
			"col_a_net_operating_expenditures",
			"col_a_federal_funds",
			"col_a_individual_contribution_total",
			"col_a_political_party_committees_receipts",
			"col_a_other_political_committees_pacs",
			"col_a_the_candidate",
			"col_a_total_contributions",
			"col_a_transfers_from_aff_other_party_cmttees",
			"col_a_received_from_or_guaranteed_by_cand",
			"col_a_other_loans",
			"col_a_total_loans",
			"col_a_operating",
			"col_a_fundraising",
			"col_a_legal_and_accounting",
			"col_a_total_offsets_to_expenditures",
			"col_a_other_receipts",
			"col_a_total_receipts",
			"col_a_operating_expenditures",
			"col_a_transfers_to_other_authorized_committees",
			"col_a_fundraising_disbursements",
			"col_a_exempt_legal_accounting_disbursement",
			"col_a_made_or_guaranteed_by_candidate",
			"col_a_other_repayments",
			"col_a_total_loan_repayments_made",
			"col_a_individuals",
			"col_a_political_party_committees_refunds",
			"col_a_other_political_committees",
			"col_a_total_contributions_refunds",
			"col_a_other_disbursements",
			"col_a_total_disbursements",
			"col_a_items_on_hand_to_be_liquidated",
			"col_a_alabama",
			"col_a_alaska",
			"col_a_arizona",
			"col_a_arkansas",
			"col_a_california",
			"col_a_colorado",
			"col_a_connecticut",
			"col_a_delaware",
			"col_a_dist_of_columbia",
			"col_a_florida",
			"col_a_georgia",
			"col_a_hawaii",
			"col_a_idaho",
			"col_a_illinois",
			"col_a_indiana",
			"col_a_iowa",
			"col_a_kansas",
			"col_a_kentucky",
			"col_a_louisiana",
			"col_a_maine",
			"col_a_maryland",
			"col_a_massachusetts",
			"col_a_michigan",
			"col_a_minnesota",
			"col_a_mississippi",
			"col_a_missouri",
			"col_a_montana",
			"col_a_nebraska",
			"col_a_nevada",
			"col_a_new_hampshire",
			"col_a_new_jersey",
			"col_a_new_mexico",
			"col_a_new_york",
			"col_a_north_carolina",
			"col_a_north_dakota",
			"col_a_ohio",
			"col_a_oklahoma",
			"col_a_oregon",
			"col_a_pennsylvania",
			"col_a_rhode_island",
			"col_a_south_carolina",
			"col_a_south_dakota",
			"col_a_tennessee",
			"col_a_texas",
			"col_a_utah",
			"col_a_vermont",
			"col_a_virginia",
			"col_a_washington",
			"col_a_west_virginia",
			"col_a_wisconsin",
			"col_a_wyoming",
			"col_a_puerto_rico",
			"col_a_guam",
			"col_a_virgin_islands",
			"col_a_totals",
			"col_b_federal_funds",
			"col_b_individual_contribution_total",
			"col_b_political_party_committees_receipts",
			"col_b_other_political_committees_pacs",
			"col_b_the_candidate",
			"col_b_total_contributions_other_than_loans",
			"col_b_transfers_from_aff_other_party_cmttees",
			"col_b_received_from_or_guaranteed_by_cand",
			"col_b_other_loans",
			"col_b_total_loans",
			"col_b_operating",
			"col_b_fundraising",
			"col_b_legal_and_accounting",
			"col_b_total_offsets_to_operating_expenditures",
			"col_b_other_receipts",
			"col_b_total_receipts",
			"col_b_operating_expenditures",
			"col_b_transfers_to_other_authorized_committees",
			"col_b_fundraising_disbursements",
			"col_b_exempt_legal_accounting_disbursement",
			"col_b_made_or_guaranteed_by_the_candidate",
			"col_b_other_repayments",
			"col_b_total_loan_repayments_made",
			"col_b_individuals",
			"col_b_political_party_committees_refunds",
			"col_b_other_political_committees",
			"col_b_total_contributions_refunds",
			"col_b_other_disbursements",
			"col_b_total_disbursements",
			"col_b_alabama",
			"col_b_alaska",
			"col_b_arizona",
			"col_b_arkansas",
			"col_b_california",
			"col_b_colorado",
			"col_b_connecticut",
			"col_b_delaware",
			"col_b_dist_of_columbia",
			"col_b_florida",
			"col_b_georgia",
			"col_b_hawaii",
			"col_b_idaho",
			"col_b_illinois",
			"col_b_indiana",
			"col_b_iowa",
			"col_b_kansas",
			"col_b_kentucky",
			"col_b_louisiana",
			"col_b_maine",
			"col_b_maryland",
			"col_b_massachusetts",
			"col_b_michigan",
			"col_b_minnesota",
			"col_b_mississippi",
			"col_b_missouri",
			"col_b_montana",
			"col_b_nebraska",
			"col_b_nevada",
			"col_b_new_hampshire",
			"col_b_new_jersey",
			"col_b_new_mexico",
			"col_b_new_york",
			"col_b_north_carolina",
			"col_b_north_dakota",
			"col_b_ohio",
			"col_b_oklahoma",
			"col_b_oregon",
			"col_b_pennsylvania",
			"col_b_rhode_island",
			"col_b_south_carolina",
			"col_b_south_dakota",
			"col_b_tennessee",
			"col_b_texas",
			"col_b_utah",
			"col_b_vermont",
			"col_b_virginia",
			"col_b_washington",
			"col_b_west_virginia",
			"col_b_wisconsin",
			"col_b_wyoming",
			"col_b_puerto_rico",
			"col_b_guam",
			"col_b_virgin_islands",
			"col_b_totals",
			"treasurer_name",
			"date_signed"
		]
	},
		"^f3p31": {
		"^8.3|8.2|8.1|8.0|7.0|6.4|6.3|6.2|6.1": [
			"form_type",
			"filer_committee_id_number",
			"transaction_id_number",
			"entity_type",
			"contributor_organization_name",
			"contributor_last_name",
			"contributor_first_name",
			"contributor_middle_name",
			"contributor_prefix",
			"contributor_suffix",
			"contributor_street_1",
			"contributor_street_2",
			"contributor_city",
			"contributor_state",
			"contributor_zip_code",
			"election_code",
			"item_description",
			"item_contribution_aquired_date",
			"item_fair_market_value",
			"contributor_employer",
			"contributor_occupation",
			"memo_code",
			"memo_text_description"
		],
		"^5.3": [
			"form_type",
			"filer_committee_id_number",
			"entity_type",
			"contributor_name",
			"contributor_street_1",
			"contributor_street_2",
			"contributor_city",
			"contributor_state",
			"contributor_zip_code",
			"election_code",
			"contributor_employer",
			"contributor_occupation",
			"item_contribution_aquired_date",
			"item_fair_market_value",
			"transaction_code",
			"transaction_description",
			"fec_committee_id_number",
			"fec_candidate_id_number",
			"candidate_name",
			"candidate_office",
			"candidate_state",
			"candidate_district",
			"conduit_name",
			"conduit_street_1",
			"conduit_street_2",
			"conduit_city",
			"conduit_state",
			"conduit_zip_code",
			"memo_code",
			"memo_text_description",
			"",
			"transaction_id_number"
		],
		"^5.2|5.1|5.0|^3": [
			"form_type",
			"filer_committee_id_number",
			"entity_type",
			"contributor_name",
			"contributor_street_1",
			"contributor_street_2",
			"contributor_city",
			"contributor_state",
			"contributor_zip_code",
			"election_code",
			"contributor_employer",
			"contributor_occupation",
			"item_contribution_aquired_date",
			"item_fair_market_value",
			"transaction_code",
			"transaction_description",
			"fec_committee_id_number",
			"fec_candidate_id_number",
			"candidate_name",
			"candidate_office",
			"candidate_state",
			"candidate_district",
			"conduit_name",
			"conduit_street_1",
			"conduit_street_2",
			"conduit_city",
			"conduit_state",
			"conduit_zip_code",
			"memo_code",
			"memo_text_description",
			"",
			"transaction_id_number"
		]
	},
		"^f3ps": {
		"^8.3|8.2|8.1|8.0|7.0": [
			"form_type",
			"filer_committee_id_number",
			"date_general_election",
			"date_day_after_general_election",
			"net_contributions",
			"net_expenditures",
			"federal_funds",
			"a_i_individuals_itemized",
			"a_ii_individuals_unitemized",
			"a_iii_individual_contribution_total",
			"b_political_party_committees",
			"c_other_political_committees_pacs",
			"d_the_candidate",
			"e_total_contributions_other_than_loans",
			"transfers_from_aff_other_party_committees",
			"a_received_from_or_guaranteed_by_candidate",
			"b_other_loans",
			"c_total_loans",
			"a_operating",
			"b_fundraising",
			"c_legal_and_accounting",
			"d_total_offsets_to_operating_expenditures",
			"other_receipts",
			"total_receipts",
			"operating_expenditures",
			"transfers_to_other_authorized_committees",
			"fundraising_disbursements",
			"exempt_legal_and_accounting_disbursements",
			"a_made_or_guaranteed_by_the_candidate",
			"b_other_repayments",
			"c_total_loan_repayments_made",
			"a_individuals",
			"b_political_party_committees",
			"c_other_political_committees",
			"d_total_contributions_refunds",
			"other_disbursements",
			"total_disbursements",
			"alabama",
			"alaska",
			"arizona",
			"arkansas",
			"california",
			"colorado",
			"connecticut",
			"delaware",
			"dist_of_columbia",
			"florida",
			"georgia",
			"hawaii",
			"idaho",
			"illinois",
			"indiana",
			"iowa",
			"kansas",
			"kentucky",
			"louisiana",
			"maine",
			"maryland",
			"massachusetts",
			"michigan",
			"minnesota",
			"mississippi",
			"missouri",
			"montana",
			"nebraska",
			"nevada",
			"new_hampshire",
			"new_jersey",
			"new_mexico",
			"new_york",
			"north_carolina",
			"north_dakota",
			"ohio",
			"oklahoma",
			"oregon",
			"pennsylvania",
			"rhode_island",
			"south_carolina",
			"south_dakota",
			"tennessee",
			"texas",
			"utah",
			"vermont",
			"virginia",
			"washington",
			"west_virginia",
			"wisconsin",
			"wyoming",
			"puerto_rico",
			"guam",
			"virgin_islands",
			"totals"
		],
		"^6.4|6.3|6.2|6.1": [
			"form_type",
			"filer_committee_id_number",
			"date_general_election",
			"date_day_after_general_election",
			"net_contributions",
			"net_expenditures",
			"federal_funds",
			"a_individuals",
			"b_political_party_committees",
			"c_other_political_committees_pacs",
			"d_the_candidate",
			"e_total_contributions_other_than_loans",
			"transfers_from_aff_other_party_committees",
			"a_received_from_or_guaranteed_by_candidate",
			"b_other_loans",
			"c_total_loans",
			"a_operating",
			"b_fundraising",
			"c_legal_and_accounting",
			"d_total_offsets_to_operating_expenditures",
			"other_receipts",
			"total_receipts",
			"operating_expenditures",
			"transfers_to_other_authorized_committees",
			"fundraising_disbursements",
			"exempt_legal_and_accounting_disbursements",
			"a_made_or_guaranteed_by_the_candidate",
			"b_other_repayments",
			"c_total_loan_repayments_made",
			"a_individuals",
			"b_political_party_committees",
			"c_other_political_committees",
			"d_total_contributions_refunds",
			"other_disbursements",
			"total_disbursements",
			"alabama",
			"alaska",
			"arizona",
			"arkansas",
			"california",
			"colorado",
			"connecticut",
			"delaware",
			"dist_of_columbia",
			"florida",
			"georgia",
			"hawaii",
			"idaho",
			"illinois",
			"indiana",
			"iowa",
			"kansas",
			"kentucky",
			"louisiana",
			"maine",
			"maryland",
			"massachusetts",
			"michigan",
			"minnesota",
			"mississippi",
			"missouri",
			"montana",
			"nebraska",
			"nevada",
			"new_hampshire",
			"new_jersey",
			"new_mexico",
			"new_york",
			"north_carolina",
			"north_dakota",
			"ohio",
			"oklahoma",
			"oregon",
			"pennsylvania",
			"rhode_island",
			"south_carolina",
			"south_dakota",
			"tennessee",
			"texas",
			"utah",
			"vermont",
			"virginia",
			"washington",
			"west_virginia",
			"wisconsin",
			"wyoming",
			"puerto_rico",
			"guam",
			"virgin_islands",
			"totals"
		],
		"^5.3|5.2|5.1|5.0|^3": [
			"form_type",
			"filer_committee_id_number",
			"net_contributions",
			"net_expenditures",
			"federal_funds",
			"a_individuals",
			"b_political_party_committees",
			"c_other_political_committees_pacs",
			"d_the_candidate",
			"e_total_contributions_other_than_loans",
			"transfers_from_aff_other_party_committees",
			"a_received_from_or_guaranteed_by_candidate",
			"b_other_loans",
			"c_total_loans",
			"a_operating",
			"b_fundraising",
			"c_legal_and_accounting",
			"d_total_offsets_to_operating_expenditures",
			"other_receipts",
			"total_receipts",
			"operating_expenditures",
			"transfers_to_other_authorized_committees",
			"fundraising_disbursements",
			"exempt_legal_and_accounting_disbursements",
			"a_made_or_guaranteed_by_the_candidate",
			"b_other_repayments",
			"c_total_loan_repayments_made",
			"a_individuals",
			"b_political_party_committees",
			"c_other_political_committees",
			"d_total_contributions_refunds",
			"other_disbursements",
			"total_disbursements",
			"alabama",
			"alaska",
			"arizona",
			"arkansas",
			"california",
			"colorado",
			"connecticut",
			"delaware",
			"dist_of_columbia",
			"florida",
			"georgia",
			"hawaii",
			"idaho",
			"illinois",
			"indiana",
			"iowa",
			"kansas",
			"kentucky",
			"louisiana",
			"maine",
			"maryland",
			"massachusetts",
			"michigan",
			"minnesota",
			"mississippi",
			"missouri",
			"montana",
			"nebraska",
			"nevada",
			"new_hampshire",
			"new_jersey",
			"new_mexico",
			"new_york",
			"north_carolina",
			"north_dakota",
			"ohio",
			"oklahoma",
			"oregon",
			"pennsylvania",
			"rhode_island",
			"south_carolina",
			"south_dakota",
			"tennessee",
			"texas",
			"utah",
			"vermont",
			"virginia",
			"washington",
			"west_virginia",
			"wisconsin",
			"wyoming",
			"puerto_rico",
			"guam",
			"virgin_islands",
			"totals",
			"date_general_election",
			"date_day_after_general_election"
		]
	},
		"^f3s": {
		"^P3|^P2": [
			"form_type",
			"filer_committee_id_number",
			"date_general_election",
			"date_day_after_general_election",
			"a_i_individuals_itemized",
			"a_ii_individuals_unitemized",
			"a_iii_individuals_total",
			"b_political_party_committees",
			"c_all_other_political_committees_pacs",
			"d_the_candidate",
			"e_total_contributions",
			"transfers_from_other_auth_committees",
			"a_loans_made_or_guarn_by_the_candidate",
			"b_all_other_loans",
			"c_total_loans",
			"offsets_to_operating_expenditures",
			"other_receipts",
			"total_receipts",
			"operating_expenditures",
			"transfers_to_other_auth_committees",
			"a_loan_repayment_by_candidate",
			"b_loan_repayments_all_other_loans",
			"c_total_loan_repayments",
			"a_refund_individuals_other_than_pol_cmtes",
			"b_refund_political_party_committees",
			"c_refund_other_political_committees",
			"d_total_contributions_refunds",
			"other_disbursements",
			"total_disbursements",
			"a_total_contributions_no_loans",
			"c_net_operating_expenditures",
			"beginning_image_number"
		],
		"^P1": [
			"form_type",
			"filer_committee_id_number",
			"date_general_election",
			"date_day_after_general_election",
			"a_iii_individuals_total",
			"b_political_party_committees",
			"c_all_other_political_committees_pacs",
			"d_the_candidate",
			"e_total_contributions",
			"transfers_from_other_auth_committees",
			"a_loans_made_or_guarn_by_the_candidate",
			"b_all_other_loans",
			"c_total_loans",
			"offsets_to_operating_expenditures",
			"other_receipts",
			"total_receipts",
			"operating_expenditures",
			"transfers_to_other_auth_committees",
			"a_loan_repayment_by_candidate",
			"b_loan_repayments_all_other_loans",
			"c_total_loan_repayments",
			"a_refund_individuals_other_than_pol_cmtes",
			"b_refund_political_party_committees",
			"c_refund_other_political_committees",
			"d_total_contributions_refunds",
			"other_disbursements",
			"total_disbursements",
			"beginning_image_number"
		],
		"^8.3|8.2|8.1|8.0|7.0|6.4|6.3|6.2|6.1": [
			"form_type",
			"filer_committee_id_number",
			"date_general_election",
			"date_day_after_general_election",
			"a_total_contributions_no_loans",
			"b_total_contribution_refunds",
			"c_net_contributions",
			"a_total_operating_expenditures",
			"b_total_offsets_to_operating_expenditures",
			"c_net_operating_expenditures",
			"a_i_individuals_itemized",
			"a_ii_individuals_unitemized",
			"a_iii_individuals_total",
			"b_political_party_committees",
			"c_all_other_political_committees_pacs",
			"d_the_candidate",
			"e_total_contributions",
			"transfers_from_other_auth_committees",
			"a_loans_made_or_guarn_by_the_candidate",
			"b_all_other_loans",
			"c_total_loans",
			"offsets_to_operating_expenditures",
			"other_receipts",
			"total_receipts",
			"operating_expenditures",
			"transfers_to_other_auth_committees",
			"a_loan_repayment_by_candidate",
			"b_loan_repayments_all_other_loans",
			"c_total_loan_repayments",
			"a_refund_individuals_other_than_pol_cmtes",
			"b_refund_political_party_committees",
			"c_refund_other_political_committees",
			"d_total_contributions_refunds",
			"other_disbursements",
			"total_disbursements"
		],
		"^5.3|5.2|5.1|5.0|^3": [
			"form_type",
			"filer_committee_id_number",
			"a_total_contributions_no_loans",
			"b_total_contribution_refunds",
			"c_net_contributions",
			"a_total_operating_expenditures",
			"b_total_offsets_to_operating_expenditures",
			"c_net_operating_expenditures",
			"a_i_individuals_itemized",
			"a_ii_individuals_unitemized",
			"a_iii_individuals_total",
			"b_political_party_committees",
			"c_all_other_political_committees_pacs",
			"d_the_candidate",
			"e_total_contributions",
			"transfers_from_other_auth_committees",
			"a_loans_made_or_guarn_by_the_candidate",
			"b_all_other_loans",
			"c_total_loans",
			"offsets_to_operating_expenditures",
			"other_receipts",
			"total_receipts",
			"operating_expenditures",
			"transfers_to_other_auth_committees",
			"a_loan_repayment_by_candidate",
			"",
			"c_total_loan_repayments",
			"a_refund_individuals_other_than_pol_cmtes",
			"",
			"",
			"d_total_contributions_refunds",
			"other_disbursements",
			"total_disbursements",
			"date_general_election",
			"date_day_after_general_election"
		]
	},
		"(^f3x$)|(^f3x[ant])": {
		"^P3.2|^P3.3|^P3.4": [
			"form_type",
			"filer_committee_id_number",
			"committee_name",
			"change_of_address",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"report_code",
			"date_of_election",
			"state_of_election",
			"coverage_from_date",
			"coverage_through_date",
			"treasurer_last_name",
			"treasurer_first_name",
			"treasurer_middle_name",
			"treasurer_prefix",
			"treasurer_suffix",
			"date_signed",
			"col_a_cash_on_hand_beginning_period",
			"col_a_total_receipts",
			"col_a_subtotal",
			"col_a_total_disbursements",
			"col_a_cash_on_hand_close_of_period",
			"col_a_debts_to",
			"col_a_debts_by",
			"qualified_committee",
			"col_a_individuals_itemized",
			"col_a_individuals_unitemized",
			"col_a_individual_contribution_total",
			"col_a_political_party_committees",
			"col_a_other_political_committees_pacs",
			"col_a_total_contributions",
			"col_a_transfers_from_aff_other_party_cmttees",
			"col_a_total_loans",
			"col_a_total_loan_repayments_received",
			"col_a_offsets_to_expenditures",
			"col_a_federal_refunds",
			"col_a_other_federal_receipts",
			"col_a_transfers_from_nonfederal_h3",
			"col_a_levin_funds",
			"col_a_total_nonfederal_transfers",
			"col_a_total_receipts",
			"col_a_total_federal_receipts",
			"col_a_shared_operating_expenditures_federal",
			"col_a_shared_operating_expenditures_nonfederal",
			"col_a_other_federal_operating_expenditures",
			"col_a_total_operating_expenditures",
			"col_a_transfers_to_affiliated",
			"col_a_contributions_to_candidates",
			"col_a_independent_expenditures",
			"col_a_coordinated_expenditures_by_party_committees",
			"col_a_total_loan_repayments_made",
			"col_a_loans_made",
			"col_a_refunds_to_individuals",
			"col_a_refunds_to_party_committees",
			"col_a_refunds_to_other_committees",
			"col_a_total_refunds",
			"col_a_other_disbursements",
			"col_a_federal_election_activity_federal_share",
			"col_a_federal_election_activity_levin_share",
			"col_a_federal_election_activity_all_federal",
			"col_a_federal_election_activity_total",
			"col_a_total_disbursements",
			"col_a_total_federal_disbursements",
			"col_a_total_contributions",
			"col_a_total_contributions_refunds",
			"col_a_net_contributions",
			"col_a_total_federal_operating_expenditures",
			"col_a_total_offsets_to_expenditures",
			"col_a_net_operating_expenditures",
			"col_b_cash_on_hand_jan_1",
			"col_b_year",
			"col_b_total_receipts",
			"col_b_subtotal",
			"col_b_total_disbursements",
			"col_b_cash_on_hand_close_of_period",
			"col_b_individuals_itemized",
			"col_b_individuals_unitemized",
			"col_b_individual_contribution_total",
			"col_b_political_party_committees",
			"col_b_other_political_committees_pacs",
			"col_b_total_contributions",
			"col_b_transfers_from_aff_other_party_cmttees",
			"col_b_total_loans",
			"col_b_total_loan_repayments_received",
			"col_b_offsets_to_expenditures",
			"col_b_federal_refunds",
			"col_b_other_federal_receipts",
			"col_b_transfers_from_nonfederal_h3",
			"col_b_levin_funds",
			"col_b_total_nonfederal_transfers",
			"col_b_total_receipts",
			"col_b_total_federal_receipts",
			"col_b_shared_operating_expenditures_federal",
			"col_b_shared_operating_expenditures_nonfederal",
			"col_b_other_federal_operating_expenditures",
			"col_b_total_operating_expenditures",
			"col_b_transfers_to_affiliated",
			"col_b_contributions_to_candidates",
			"col_b_independent_expenditures",
			"col_b_coordinated_expenditures_by_party_committees",
			"col_b_total_loan_repayments_made",
			"col_b_loans_made",
			"col_b_refunds_to_individuals",
			"col_b_refunds_to_party_committees",
			"col_b_refunds_to_other_committees",
			"col_b_total_refunds",
			"col_b_other_disbursements",
			"col_b_federal_election_activity_federal_share",
			"col_b_federal_election_activity_levin_share",
			"col_b_federal_election_activity_all_federal",
			"col_b_federal_election_activity_total",
			"col_b_total_disbursements",
			"col_b_total_federal_disbursements",
			"col_b_total_contributions",
			"col_b_total_contributions_refunds",
			"col_b_net_contributions",
			"col_b_total_federal_operating_expenditures",
			"col_b_total_offsets_to_expenditures",
			"col_b_net_operating_expenditures",
			"beginning_image_number",
			"end_image_number",
			"receipt_date"
		],
		"^P1|^P2|^P3.0|^P3.1": [
			"form_type",
			"filer_committee_id_number",
			"committee_name",
			"change_of_address",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"report_code",
			"date_of_election",
			"state_of_election",
			"coverage_from_date",
			"coverage_through_date",
			"treasurer_last_name",
			"treasurer_first_name",
			"treasurer_middle_name",
			"treasurer_prefix",
			"treasurer_suffix",
			"date_signed",
			"col_a_cash_on_hand_beginning_period",
			"col_a_total_receipts",
			"col_a_subtotal",
			"col_a_total_disbursements",
			"col_a_cash_on_hand_close_of_period",
			"col_a_debts_to",
			"col_a_debts_by",
			"qualified_committee",
			"col_a_individuals_itemized",
			"col_a_individuals_unitemized",
			"col_a_individual_contribution_total",
			"col_a_political_party_committees",
			"col_a_other_political_committees_pacs",
			"col_a_total_contributions",
			"col_a_transfers_from_aff_other_party_cmttees",
			"col_a_total_loans",
			"col_a_total_loan_repayments_received",
			"col_a_offsets_to_expenditures",
			"col_a_federal_refunds",
			"col_a_other_federal_receipts",
			"col_a_transfers_from_nonfederal_h3",
			"col_a_levin_funds",
			"col_a_total_nonfederal_transfers",
			"col_a_total_receipts",
			"col_a_total_federal_receipts",
			"col_a_shared_operating_expenditures_federal",
			"col_a_shared_operating_expenditures_nonfederal",
			"col_a_other_federal_operating_expenditures",
			"col_a_total_operating_expenditures",
			"col_a_transfers_to_affiliated",
			"col_a_contributions_to_candidates",
			"col_a_independent_expenditures",
			"col_a_coordinated_expenditures_by_party_committees",
			"col_a_total_loan_repayments_made",
			"col_a_loans_made",
			"col_a_refunds_to_individuals",
			"col_a_refunds_to_party_committees",
			"col_a_refunds_to_other_committees",
			"col_a_total_refunds",
			"col_a_other_disbursements",
			"col_a_federal_election_activity_federal_share",
			"col_a_federal_election_activity_levin_share",
			"col_a_federal_election_activity_all_federal",
			"col_a_federal_election_activity_total",
			"col_a_total_disbursements",
			"col_a_total_federal_disbursements",
			"col_a_total_contributions",
			"col_a_total_contributions_refunds",
			"col_a_net_contributions",
			"col_a_total_federal_operating_expenditures",
			"col_a_total_offsets_to_expenditures",
			"col_a_net_operating_expenditures",
			"col_b_cash_on_hand_jan_1",
			"col_b_year",
			"col_b_total_receipts",
			"col_b_subtotal",
			"col_b_total_disbursements",
			"col_b_cash_on_hand_close_of_period",
			"col_b_individuals_itemized",
			"col_b_individuals_unitemized",
			"col_b_individual_contribution_total",
			"col_b_political_party_committees",
			"col_b_other_political_committees_pacs",
			"col_b_total_contributions",
			"col_b_transfers_from_aff_other_party_cmttees",
			"col_b_total_loans",
			"col_b_total_loan_repayments_received",
			"col_b_offsets_to_expenditures",
			"col_b_federal_refunds",
			"col_b_other_federal_receipts",
			"col_b_transfers_from_nonfederal_h3",
			"col_b_levin_funds",
			"col_b_total_nonfederal_transfers",
			"col_b_total_receipts",
			"col_b_total_federal_receipts",
			"col_b_shared_operating_expenditures_federal",
			"col_b_shared_operating_expenditures_nonfederal",
			"col_b_other_federal_operating_expenditures",
			"col_b_total_operating_expenditures",
			"col_b_transfers_to_affiliated",
			"col_b_contributions_to_candidates",
			"col_b_independent_expenditures",
			"col_b_coordinated_expenditures_by_party_committees",
			"col_b_total_loan_repayments_made",
			"col_b_loans_made",
			"col_b_refunds_to_individuals",
			"col_b_refunds_to_party_committees",
			"col_b_refunds_to_other_committees",
			"col_b_total_refunds",
			"col_b_other_disbursements",
			"col_b_federal_election_activity_federal_share",
			"col_b_federal_election_activity_levin_share",
			"col_b_federal_election_activity_all_federal",
			"col_b_federal_election_activity_total",
			"col_b_total_disbursements",
			"col_b_total_federal_disbursements",
			"col_b_total_contributions",
			"col_b_total_contributions_refunds",
			"col_b_net_contributions",
			"col_b_total_federal_operating_expenditures",
			"col_b_total_offsets_to_expenditures",
			"col_b_net_operating_expenditures",
			"beginning_image_number"
		],
		"^8.3|8.2|8.1|8.0|7.0|6.4|6.3|6.2|6.1": [
			"form_type",
			"filer_committee_id_number",
			"committee_name",
			"change_of_address",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"report_code",
			"election_code",
			"date_of_election",
			"state_of_election",
			"coverage_from_date",
			"coverage_through_date",
			"qualified_committee",
			"treasurer_last_name",
			"treasurer_first_name",
			"treasurer_middle_name",
			"treasurer_prefix",
			"treasurer_suffix",
			"date_signed",
			"col_a_cash_on_hand_beginning_period",
			"col_a_total_receipts",
			"col_a_subtotal",
			"col_a_total_disbursements",
			"col_a_cash_on_hand_close_of_period",
			"col_a_debts_to",
			"col_a_debts_by",
			"col_a_individuals_itemized",
			"col_a_individuals_unitemized",
			"col_a_individual_contribution_total",
			"col_a_political_party_committees",
			"col_a_other_political_committees_pacs",
			"col_a_total_contributions",
			"col_a_transfers_from_aff_other_party_cmttees",
			"col_a_total_loans",
			"col_a_total_loan_repayments_received",
			"col_a_offsets_to_expenditures",
			"col_a_federal_refunds",
			"col_a_other_federal_receipts",
			"col_a_transfers_from_nonfederal_h3",
			"col_a_levin_funds",
			"col_a_total_nonfederal_transfers",
			"col_a_total_receipts",
			"col_a_total_federal_receipts",
			"col_a_shared_operating_expenditures_federal",
			"col_a_shared_operating_expenditures_nonfederal",
			"col_a_other_federal_operating_expenditures",
			"col_a_total_operating_expenditures",
			"col_a_transfers_to_affiliated",
			"col_a_contributions_to_candidates",
			"col_a_independent_expenditures",
			"col_a_coordinated_expenditures_by_party_committees",
			"col_a_total_loan_repayments_made",
			"col_a_loans_made",
			"col_a_refunds_to_individuals",
			"col_a_refunds_to_party_committees",
			"col_a_refunds_to_other_committees",
			"col_a_total_refunds",
			"col_a_other_disbursements",
			"col_a_federal_election_activity_federal_share",
			"col_a_federal_election_activity_levin_share",
			"col_a_federal_election_activity_all_federal",
			"col_a_federal_election_activity_total",
			"col_a_total_disbursements",
			"col_a_total_federal_disbursements",
			"col_a_total_contributions",
			"col_a_total_contributions_refunds",
			"col_a_net_contributions",
			"col_a_total_federal_operating_expenditures",
			"col_a_total_offsets_to_expenditures",
			"col_a_net_operating_expenditures",
			"col_b_cash_on_hand_jan_1",
			"col_b_year",
			"col_b_total_receipts",
			"col_b_subtotal",
			"col_b_total_disbursements",
			"col_b_cash_on_hand_close_of_period",
			"col_b_individuals_itemized",
			"col_b_individuals_unitemized",
			"col_b_individual_contribution_total",
			"col_b_political_party_committees",
			"col_b_other_political_committees_pacs",
			"col_b_total_contributions",
			"col_b_transfers_from_aff_other_party_cmttees",
			"col_b_total_loans",
			"col_b_total_loan_repayments_received",
			"col_b_offsets_to_expenditures",
			"col_b_federal_refunds",
			"col_b_other_federal_receipts",
			"col_b_transfers_from_nonfederal_h3",
			"col_b_levin_funds",
			"col_b_total_nonfederal_transfers",
			"col_b_total_receipts",
			"col_b_total_federal_receipts",
			"col_b_shared_operating_expenditures_federal",
			"col_b_shared_operating_expenditures_nonfederal",
			"col_b_other_federal_operating_expenditures",
			"col_b_total_operating_expenditures",
			"col_b_transfers_to_affiliated",
			"col_b_contributions_to_candidates",
			"col_b_independent_expenditures",
			"col_b_coordinated_expenditures_by_party_committees",
			"col_b_total_loan_repayments_made",
			"col_b_loans_made",
			"col_b_refunds_to_individuals",
			"col_b_refunds_to_party_committees",
			"col_b_refunds_to_other_committees",
			"col_b_total_refunds",
			"col_b_other_disbursements",
			"col_b_federal_election_activity_federal_share",
			"col_b_federal_election_activity_levin_share",
			"col_b_federal_election_activity_all_federal",
			"col_b_federal_election_activity_total",
			"col_b_total_disbursements",
			"col_b_total_federal_disbursements",
			"col_b_total_contributions",
			"col_b_total_contributions_refunds",
			"col_b_net_contributions",
			"col_b_total_federal_operating_expenditures",
			"col_b_total_offsets_to_expenditures",
			"col_b_net_operating_expenditures"
		],
		"^5.3|5.2|5.1|5.0": [
			"form_type",
			"filer_committee_id_number",
			"committee_name",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"change_of_address",
			"qualified_committee",
			"report_code",
			"election_code",
			"date_of_election",
			"state_of_election",
			"coverage_from_date",
			"coverage_through_date",
			"col_a_cash_on_hand_beginning_period",
			"col_a_total_receipts",
			"col_a_subtotal",
			"col_a_total_disbursements",
			"col_a_cash_on_hand_close_of_period",
			"col_a_debts_to",
			"col_a_debts_by",
			"col_a_individuals_itemized",
			"col_a_individuals_unitemized",
			"col_a_individual_contribution_total",
			"col_a_political_party_committees",
			"col_a_other_political_committees_pacs",
			"col_a_total_contributions",
			"col_a_transfers_from_aff_other_party_cmttees",
			"col_a_total_loans",
			"col_a_total_loan_repayments_received",
			"col_a_offsets_to_expenditures",
			"col_a_federal_refunds",
			"col_a_other_federal_receipts",
			"col_a_transfers_from_nonfederal_h3",
			"col_a_total_receipts",
			"col_a_total_federal_receipts",
			"col_a_shared_operating_expenditures_federal",
			"col_a_shared_operating_expenditures_nonfederal",
			"col_a_other_federal_operating_expenditures",
			"col_a_total_operating_expenditures",
			"col_a_transfers_to_affiliated",
			"col_a_contributions_to_candidates",
			"col_a_independent_expenditures",
			"col_a_coordinated_expenditures_by_party_committees",
			"col_a_total_loan_repayments_made",
			"col_a_loans_made",
			"col_a_refunds_to_individuals",
			"col_a_refunds_to_party_committees",
			"col_a_refunds_to_other_committees",
			"col_a_total_refunds",
			"col_a_other_disbursements",
			"col_a_total_disbursements",
			"col_a_total_federal_disbursements",
			"col_a_total_contributions",
			"col_a_total_contributions_refunds",
			"col_a_net_contributions",
			"col_a_total_federal_operating_expenditures",
			"col_a_total_offsets_to_expenditures",
			"col_a_net_operating_expenditures",
			"col_b_cash_on_hand_jan_1",
			"col_b_year",
			"col_b_total_receipts",
			"col_b_subtotal",
			"col_b_total_disbursements",
			"col_b_cash_on_hand_close_of_period",
			"col_b_individuals_itemized",
			"col_b_individuals_unitemized",
			"col_b_individual_contribution_total",
			"col_b_political_party_committees",
			"col_b_other_political_committees_pacs",
			"col_b_total_contributions",
			"col_b_transfers_from_aff_other_party_cmttees",
			"col_b_total_loans",
			"col_b_total_loan_repayments_received",
			"col_b_offsets_to_expenditures",
			"col_b_federal_refunds",
			"col_b_other_federal_receipts",
			"col_b_transfers_from_nonfederal_h3",
			"col_b_total_receipts",
			"col_b_total_federal_receipts",
			"col_b_shared_operating_expenditures_federal",
			"col_b_shared_operating_expenditures_nonfederal",
			"col_b_other_federal_operating_expenditures",
			"col_b_total_operating_expenditures",
			"col_b_transfers_to_affiliated",
			"col_b_contributions_to_candidates",
			"col_b_independent_expenditures",
			"col_b_coordinated_expenditures_by_party_committees",
			"col_b_total_loan_repayments_made",
			"col_b_loans_made",
			"col_b_refunds_to_individuals",
			"col_b_refunds_to_party_committees",
			"col_b_refunds_to_other_committees",
			"col_b_total_refunds",
			"col_b_other_disbursements",
			"col_b_total_disbursements",
			"col_b_total_federal_disbursements",
			"col_b_total_contributions",
			"col_b_total_contributions_refunds",
			"col_b_net_contributions",
			"col_b_total_federal_operating_expenditures",
			"col_b_total_offsets_to_expenditures",
			"col_b_net_operating_expenditures",
			"treasurer_name",
			"date_signed",
			"col_a_levin_funds",
			"col_a_total_nonfederal_transfers",
			"col_a_federal_election_activity_federal_share",
			"col_a_federal_election_activity_levin_share",
			"col_a_federal_election_activity_all_federal",
			"col_a_federal_election_activity_total",
			"col_b_levin_funds",
			"col_b_total_nonfederal_transfers",
			"col_b_federal_election_activity_federal_share",
			"col_b_federal_election_activity_levin_share",
			"col_b_federal_election_activity_all_federal",
			"col_b_federal_election_activity_total"
		],
		"^3|^2|^1": [
			"form_type",
			"filer_committee_id_number",
			"committee_name",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"change_of_address",
			"qualified_committee",
			"report_code",
			"election_code",
			"date_of_election",
			"state_of_election",
			"coverage_from_date",
			"coverage_through_date",
			"col_a_cash_on_hand_beginning_period",
			"col_a_total_receipts",
			"col_a_subtotal",
			"col_a_total_disbursements",
			"col_a_cash_on_hand_close_of_period",
			"col_a_debts_to",
			"col_a_debts_by",
			"col_a_individuals_itemized",
			"col_a_individuals_unitemized",
			"col_a_individual_contribution_total",
			"col_a_political_party_committees",
			"col_a_other_political_committees_pacs",
			"col_a_total_contributions",
			"col_a_transfers_from_aff_other_party_cmttees",
			"col_a_total_loans",
			"col_a_total_loan_repayments_received",
			"col_a_offsets_to_expenditures",
			"col_a_federal_refunds",
			"col_a_other_federal_receipts",
			"col_a_transfers_from_nonfederal_h3",
			"col_a_total_receipts",
			"col_a_total_federal_receipts",
			"col_a_shared_operating_expenditures_federal",
			"col_a_shared_operating_expenditures_nonfederal",
			"col_a_other_federal_operating_expenditures",
			"col_a_total_operating_expenditures",
			"col_a_transfers_to_affiliated",
			"col_a_contributions_to_candidates",
			"col_a_independent_expenditures",
			"col_a_coordinated_expenditures_by_party_committees",
			"col_a_total_loan_repayments_made",
			"col_a_loans_made",
			"col_a_refunds_to_individuals",
			"col_a_refunds_to_party_committees",
			"col_a_refunds_to_other_committees",
			"col_a_total_refunds",
			"col_a_other_disbursements",
			"col_a_total_disbursements",
			"col_a_total_federal_disbursements",
			"col_a_total_contributions",
			"col_a_total_contributions_refunds",
			"col_a_net_contributions",
			"col_a_total_federal_operating_expenditures",
			"col_a_total_offsets_to_expenditures",
			"col_a_net_operating_expenditures",
			"col_b_cash_on_hand_jan_1",
			"col_b_year",
			"col_b_total_receipts",
			"col_b_subtotal",
			"col_b_total_disbursements",
			"col_b_cash_on_hand_close_of_period",
			"col_b_individuals_itemized",
			"col_b_individuals_unitemized",
			"col_b_individual_contribution_total",
			"col_b_political_party_committees",
			"col_b_other_political_committees_pacs",
			"col_b_total_contributions",
			"col_b_transfers_from_aff_other_party_cmttees",
			"col_b_total_loans",
			"col_b_total_loan_repayments_received",
			"col_b_offsets_to_expenditures",
			"col_b_federal_refunds",
			"col_b_other_federal_receipts",
			"col_b_transfers_from_nonfederal_h3",
			"col_b_total_receipts",
			"col_b_total_federal_receipts",
			"col_b_shared_operating_expenditures_federal",
			"col_b_shared_operating_expenditures_nonfederal",
			"col_b_other_federal_operating_expenditures",
			"col_b_total_operating_expenditures",
			"col_b_transfers_to_affiliated",
			"col_b_contributions_to_candidates",
			"col_b_independent_expenditures",
			"col_b_coordinated_expenditures_by_party_committees",
			"col_b_total_loan_repayments_made",
			"col_b_loans_made",
			"col_b_refunds_to_individuals",
			"col_b_refunds_to_party_committees",
			"col_b_refunds_to_other_committees",
			"col_b_total_refunds",
			"col_b_other_disbursements",
			"col_b_total_disbursements",
			"col_b_total_federal_disbursements",
			"col_b_total_contributions",
			"col_b_total_contributions_refunds",
			"col_b_net_contributions",
			"col_b_total_federal_operating_expenditures",
			"col_b_total_offsets_to_expenditures",
			"col_b_net_operating_expenditures",
			"treasurer_name",
			"date_signed"
		]
	},
		"(^f3z$)|(^f3z[t])": {
		"^(P3|P2)": [
			"form_type",
			"filer_committee_id_number",
			"principal_committee_name",
			"coverage_from_date",
			"coverage_through_date",
			"authorized_committee_name",
			"col_a_individual_contributions_itemized",
			"col_a_political_party_contributions",
			"col_a_pac_contributions",
			"col_a_candidate_contributions",
			"col_a_total_contributions",
			"col_a_transfers_from_authorized",
			"col_a_candidate_loans",
			"col_a_other_loans",
			"col_a_total_loans",
			"col_a_offset_to_operating_expenditures",
			"col_a_other_receipts",
			"col_a_total_receipts",
			"col_a_operating_expenditures",
			"col_a_transfers_to_authorized",
			"col_a_candidate_loan_repayments",
			"col_a_other_loan_repayments",
			"col_a_total_loan_repayments",
			"col_a_refunds_to_individuals",
			"col_a_refunds_to_party_committees",
			"col_a_refunds_to_other_committees",
			"col_a_total_refunds",
			"col_a_other_disbursements",
			"col_a_total_disbursements",
			"col_a_cash_beginning_reporting_period",
			"col_a_cash_on_hand_close",
			"col_a_debts_to",
			"col_a_debts_by",
			"col_a_net_contributions",
			"col_a_net_operating_expenditures",
			"image_number"
		],
		"^P1": [
			"form_type",
			"filer_committee_id_number",
			"principal_committee_name",
			"coverage_from_date",
			"coverage_through_date",
			"col_a_individual_contributions_itemized",
			"col_a_political_party_contributions",
			"col_a_pac_contributions",
			"col_a_candidate_contributions",
			"col_a_total_contributions",
			"col_a_transfers_from_authorized",
			"col_a_candidate_loans",
			"col_a_other_loans",
			"col_a_total_loans",
			"col_a_offset_to_operating_expenditures",
			"col_a_other_receipts",
			"col_a_total_receipts",
			"col_a_operating_expenditures",
			"col_a_transfers_to_authorized",
			"col_a_candidate_loan_repayments",
			"col_a_other_loan_repayments",
			"col_a_total_loan_repayments",
			"col_a_refunds_to_individuals",
			"col_a_refunds_to_party_committees",
			"col_a_refunds_to_other_committees",
			"col_a_total_refunds",
			"col_a_other_disbursements",
			"col_a_total_disbursements",
			"col_a_cash_beginning_reporting_period",
			"col_a_cash_on_hand_close",
			"col_a_debts_to",
			"col_a_debts_by",
			"col_a_net_contributions",
			"col_a_net_operating_expenditures",
			"image_number"
		],
		"^(8.1|8.0|7.0|6|5|3|2|1)": [
			"form_type",
			"filer_committee_id_number",
			"principal_committee_name",
			"coverage_from_date",
			"coverage_through_date",
			"authorized_committee_id_number",
			"authorized_committee_name",
			"col_a_individual_contributions_itemized",
			"col_a_political_party_contributions",
			"col_a_pac_contributions",
			"col_a_candidate_contributions",
			"col_a_total_contributions",
			"col_a_transfers_from_authorized",
			"col_a_candidate_loans",
			"col_a_other_loans",
			"col_a_total_loans",
			"col_a_offset_to_operating_expenditures",
			"col_a_other_receipts",
			"col_a_total_receipts",
			"col_a_operating_expenditures",
			"col_a_transfers_to_authorized",
			"col_a_candidate_loan_repayments",
			"col_a_other_loan_repayments",
			"col_a_total_loan_repayments",
			"col_a_refunds_to_individuals",
			"col_a_refunds_to_party_committees",
			"col_a_refunds_to_other_committees",
			"col_a_total_refunds",
			"col_a_other_disbursements",
			"col_a_total_disbursements",
			"col_a_cash_beginning_reporting_period",
			"col_a_cash_on_hand_close",
			"col_a_debts_to",
			"col_a_debts_by",
			"col_a_net_contributions",
			"col_a_net_operating_expenditures"
		]
	},
		"^f3z1": {
		"^(P3.4|8.3|8.2)": [
			"form_type",
			"filer_committee_id_number",
			"principal_committee_name",
			"coverage_from_date",
			"coverage_through_date",
			"authorized_committee_id_number",
			"authorized_committee_name",
			"col_a_net_contributions",
			"col_a_net_operating_expenditures",
			"col_a_debts_to",
			"col_a_debts_by",
			"col_a_individual_contributions",
			"col_a_political_party_contributions",
			"col_a_pac_contributions",
			"col_a_candidate_contributions",
			"col_a_total_contributions",
			"col_a_transfers_from_authorized",
			"col_a_candidate_loans",
			"col_a_other_loans",
			"col_a_total_loans",
			"col_a_offset_to_operating_expenditures",
			"col_a_other_receipts",
			"col_a_total_receipts",
			"col_a_operating_expenditures",
			"col_a_transfers_to_authorized",
			"col_a_candidate_loan_repayments",
			"col_a_other_loan_repayments",
			"col_a_total_loan_repayments",
			"col_a_refunds_to_individuals",
			"col_a_refunds_to_party_committees",
			"col_a_refunds_to_other_committees",
			"col_a_total_refunds",
			"col_a_other_disbursements",
			"col_a_total_disbursements",
			"col_a_cash_beginning_reporting_period",
			"col_a_cash_on_hand_close"
		]
	},
		"^f3z2": {
		"^(P3.4|8.3|8.2)": [
			"form_type",
			"filer_committee_id_number",
			"principal_committee_name",
			"coverage_from_date",
			"coverage_through_date",
			"col_a_net_contributions",
			"col_a_net_operating_expenditures",
			"col_a_debts_to",
			"col_a_debts_by",
			"col_a_individual_contributions",
			"col_a_political_party_contributions",
			"col_a_pac_contributions",
			"col_a_candidate_contributions",
			"col_a_total_contributions",
			"col_a_transfers_from_authorized",
			"col_a_candidate_loans",
			"col_a_other_loans",
			"col_a_total_loans",
			"col_a_offset_to_operating_expenditures",
			"col_a_other_receipts",
			"col_a_total_receipts",
			"col_a_operating_expenditures",
			"col_a_transfers_to_authorized",
			"col_a_candidate_loan_repayments",
			"col_a_other_loan_repayments",
			"col_a_total_loan_repayments",
			"col_a_refunds_to_individuals",
			"col_a_refunds_to_party_committees",
			"col_a_refunds_to_other_committees",
			"col_a_total_refunds",
			"col_a_other_disbursements",
			"col_a_total_disbursements",
			"col_a_cash_beginning_reporting_period",
			"col_a_cash_on_hand_close"
		]
	},
		"^f4[ant]": {
		"^(P3.4|P3.3|P3.2)": [
			"form_type",
			"filer_committee_id_number",
			"committee_name",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"committee_type",
			"committee_type_description",
			"report_code",
			"coverage_from_date",
			"coverage_through_date",
			"treasurer_last_name",
			"treasurer_first_name",
			"treasurer_middle_name",
			"treasurer_prefix",
			"treasurer_suffix",
			"date_signed",
			"col_a_cash_on_hand_beginning_reporting_period",
			"col_a_total_receipts",
			"col_a_subtotal",
			"col_a_total_disbursements",
			"col_a_cash_on_hand_close_of_period",
			"col_a_debts_to",
			"col_a_debts_by",
			"col_a_convention_expenditures",
			"col_a_convention_refunds",
			"col_a_expenditures_subject_to_limits",
			"col_a_prior_expenditures_subject_to_limits",
			"col_a_federal_funds",
			"col_a_contributions_itemized",
			"col_a_contributions_unitemized",
			"col_a_contributions_subtotal",
			"col_a_transfers_from_affiliated",
			"col_a_loans_received",
			"col_a_loan_repayments_received",
			"col_a_loan_receipts_subtotal",
			"col_a_convention_refunds_itemized",
			"col_a_convention_refunds_unitemized",
			"col_a_convention_refunds_subtotal",
			"col_a_other_refunds_itemized",
			"col_a_other_refunds_unitemized",
			"col_a_other_refunds_subtotal",
			"col_a_other_income_itemized",
			"col_a_other_income_unitemized",
			"col_a_other_income_subtotal",
			"col_a_total_receipts",
			"col_a_convention_expenses_itemized",
			"col_a_convention_expenses_unitemized",
			"col_a_convention_expenses_subtotal",
			"col_a_transfers_to_affiliated",
			"col_a_loans_made",
			"col_a_loan_repayments_made",
			"col_a_loan_disbursements_subtotal",
			"col_a_other_disbursements_itemized",
			"col_a_other_disbursements_unitemized",
			"col_a_other_disbursements_subtotal",
			"col_a_total_disbursements",
			"col_b_cash_on_hand_beginning_year",
			"col_b_beginning_year",
			"col_b_total_receipts",
			"col_b_subtotal",
			"col_b_total_disbursements",
			"col_b_cash_on_hand_close_of_period",
			"col_b_convention_expenditures",
			"col_b_convention_refunds",
			"col_b_expenditures_subject_to_limits",
			"col_b_prior_expendiutres_subject_to_limits",
			"col_b_total_expenditures_subject_to_limits",
			"col_b_federal_funds",
			"col_b_contributions_subtotal",
			"col_b_transfers_from_affiliated",
			"col_b_loan_receipts_subtotal",
			"col_b_convention_refunds_subtotal",
			"col_b_other_refunds_subtotal",
			"col_b_other_income_subtotal",
			"col_b_total_receipts",
			"col_b_convention_expenses_subtotal",
			"col_b_transfers_to_affiliated",
			"col_b_loan_disbursements_subtotal",
			"col_b_other_disbursements_subtotal",
			"col_b_total_disbursements",
			"beginning_image_number",
			"end_image_number",
			"receipt_date"
		],
		"^(P3.1|P3.0|P2|P1)": [
			"form_type",
			"filer_committee_id_number",
			"committee_name",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"committee_type",
			"committee_type_description",
			"report_code",
			"coverage_from_date",
			"coverage_through_date",
			"treasurer_last_name",
			"treasurer_first_name",
			"treasurer_middle_name",
			"treasurer_prefix",
			"treasurer_suffix",
			"date_signed",
			"col_a_cash_on_hand_beginning_reporting_period",
			"col_a_total_receipts",
			"col_a_subtotal",
			"col_a_total_disbursements",
			"col_a_cash_on_hand_close_of_period",
			"col_a_debts_to",
			"col_a_debts_by",
			"col_a_convention_expenditures",
			"col_a_convention_refunds",
			"col_a_expenditures_subject_to_limits",
			"col_a_prior_expenditures_subject_to_limits",
			"col_a_federal_funds",
			"col_a_contributions_itemized",
			"col_a_contributions_unitemized",
			"col_a_contributions_subtotal",
			"col_a_transfers_from_affiliated",
			"col_a_loans_received",
			"col_a_loan_repayments_received",
			"col_a_loan_receipts_subtotal",
			"col_a_convention_refunds_itemized",
			"col_a_convention_refunds_unitemized",
			"col_a_convention_refunds_subtotal",
			"col_a_other_refunds_itemized",
			"col_a_other_refunds_unitemized",
			"col_a_other_refunds_subtotal",
			"col_a_other_income_itemized",
			"col_a_other_income_unitemized",
			"col_a_other_income_subtotal",
			"col_a_total_receipts",
			"col_a_convention_expenses_itemized",
			"col_a_convention_expenses_unitemized",
			"col_a_convention_expenses_subtotal",
			"col_a_transfers_to_affiliated",
			"col_a_loans_made",
			"col_a_loan_repayments_made",
			"col_a_loan_disbursements_subtotal",
			"col_a_other_disbursements_itemized",
			"col_a_other_disbursements_unitemized",
			"col_a_other_disbursements_subtotal",
			"col_a_total_disbursements",
			"col_b_cash_on_hand_beginning_year",
			"col_b_beginning_year",
			"col_b_total_receipts",
			"col_b_subtotal",
			"col_b_total_disbursements",
			"col_b_cash_on_hand_close_of_period",
			"col_b_convention_expenditures",
			"col_b_convention_refunds",
			"col_b_expenditures_subject_to_limits",
			"col_b_prior_expendiutres_subject_to_limits",
			"col_b_total_expenditures_subject_to_limits",
			"col_b_federal_funds",
			"col_b_contributions_subtotal",
			"col_b_transfers_from_affiliated",
			"col_b_loan_receipts_subtotal",
			"col_b_convention_refunds_subtotal",
			"col_b_other_refunds_subtotal",
			"col_b_other_income_subtotal",
			"col_b_total_receipts",
			"col_b_convention_expenses_subtotal",
			"col_b_transfers_to_affiliated",
			"col_b_loan_disbursements_subtotal",
			"col_b_other_disbursements_subtotal",
			"col_b_total_disbursements",
			"beginning_image_number"
		],
		"^8.3|8.2|8.1|8.0|7.0|6.4|6.3|6.2|6.1": [
			"form_type",
			"filer_committee_id_number",
			"committee_name",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"committee_type",
			"committee_type_description",
			"report_code",
			"coverage_from_date",
			"coverage_through_date",
			"treasurer_last_name",
			"treasurer_first_name",
			"treasurer_middle_name",
			"treasurer_prefix",
			"treasurer_suffix",
			"date_signed",
			"col_a_cash_on_hand_beginning_reporting_period",
			"col_a_total_receipts",
			"col_a_subtotal",
			"col_a_total_disbursements",
			"col_a_cash_on_hand_close_of_period",
			"col_a_debts_to",
			"col_a_debts_by",
			"col_a_convention_expenditures",
			"col_a_convention_refunds",
			"col_a_expenditures_subject_to_limits",
			"col_a_prior_expenditures_subject_to_limits",
			"col_a_federal_funds",
			"col_a_contributions_itemized",
			"col_a_contributions_unitemized",
			"col_a_contributions_subtotal",
			"col_a_transfers_from_affiliated",
			"col_a_loans_received",
			"col_a_loan_repayments_received",
			"col_a_loan_receipts_subtotal",
			"col_a_convention_refunds_itemized",
			"col_a_convention_refunds_unitemized",
			"col_a_convention_refunds_subtotal",
			"col_a_other_refunds_itemized",
			"col_a_other_refunds_unitemized",
			"col_a_other_refunds_subtotal",
			"col_a_other_income_itemized",
			"col_a_other_income_unitemized",
			"col_a_other_income_subtotal",
			"col_a_total_receipts",
			"col_a_convention_expenses_itemized",
			"col_a_convention_expenses_unitemized",
			"col_a_convention_expenses_subtotal",
			"col_a_transfers_to_affiliated",
			"col_a_loans_made",
			"col_a_loan_repayments_made",
			"col_a_loan_disbursements_subtotal",
			"col_a_other_disbursements_itemized",
			"col_a_other_disbursements_unitemized",
			"col_a_other_disbursements_subtotal",
			"col_a_total_disbursements",
			"col_b_cash_on_hand_beginning_year",
			"col_b_beginning_year",
			"col_b_total_receipts",
			"col_b_subtotal",
			"col_b_total_disbursements",
			"col_b_cash_on_hand_close_of_period",
			"col_b_convention_expenditures",
			"col_b_convention_refunds",
			"col_b_expenditures_subject_to_limits",
			"col_b_prior_expendiutres_subject_to_limits",
			"col_b_total_expenditures_subject_to_limits",
			"col_b_federal_funds",
			"col_b_contributions_subtotal",
			"col_b_transfers_from_affiliated",
			"col_b_loan_receipts_subtotal",
			"col_b_convention_refunds_subtotal",
			"col_b_other_refunds_subtotal",
			"col_b_other_income_subtotal",
			"col_b_total_receipts",
			"col_b_convention_expenses_subtotal",
			"col_b_transfers_to_affiliated",
			"col_b_loan_disbursements_subtotal",
			"col_b_other_disbursements_subtotal",
			"col_b_total_disbursements"
		],
		"^5.3|5.2|5.1|5.0|^3": [
			"form_type",
			"filer_committee_id_number",
			"committee_name",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"committee_type",
			"committee_type_description",
			"report_code",
			"coverage_from_date",
			"coverage_through_date",
			"col_a_cash_on_hand_beginning_reporting_period",
			"col_a_total_receipts",
			"col_a_subtotal",
			"col_a_total_disbursements",
			"col_a_cash_on_hand_close_of_period",
			"col_a_debts_to",
			"col_a_debts_by",
			"col_a_convention_expenditures",
			"col_a_convention_refunds",
			"col_a_expenditures_subject_to_limits",
			"col_a_prior_expenditures_subject_to_limits",
			"col_a_total_expenditures_subject_to_limits",
			"col_a_federal_funds",
			"col_a_contributions_itemized",
			"col_a_contributions_unitemized",
			"col_a_contributions_subtotal",
			"col_a_transfers_from_affiliated",
			"col_a_loans_received",
			"col_a_loan_repayments_received",
			"col_a_loan_receipts_subtotal",
			"col_a_convention_refunds_itemized",
			"col_a_convention_refunds_unitemized",
			"col_a_convention_refunds_subtotal",
			"col_a_other_refunds_itemized",
			"col_a_other_refunds_unitemized",
			"col_a_other_refunds_subtotal",
			"col_a_other_income_itemized",
			"col_a_other_income_unitemized",
			"col_a_other_income_subtotal",
			"col_a_total_receipts",
			"col_a_convention_expenses_itemized",
			"col_a_convention_expenses_unitemized",
			"col_a_convention_expenses_subtotal",
			"col_a_transfers_to_affiliated",
			"col_a_loans_made",
			"col_a_loan_repayments_made",
			"col_a_loan_disbursements_subtotal",
			"col_a_other_disbursements_itemized",
			"col_a_other_disbursements_unitemized",
			"col_a_other_disbursements_subtotal",
			"col_a_total_disbursements",
			"col_b_cash_on_hand_beginning_year",
			"col_b_beginning_year",
			"col_b_total_receipts",
			"col_b_subtotal",
			"col_b_total_disbursements",
			"col_b_cash_on_hand_close_of_period",
			"col_b_convention_expenditures",
			"col_b_convention_refunds",
			"col_b_expenditures_subject_to_limits",
			"col_b_prior_expendiutres_subject_to_limits",
			"col_b_total_expenditures_subject_to_limits",
			"col_b_federal_funds",
			"col_b_contributions_subtotal",
			"col_b_transfers_from_affiliated",
			"col_b_loan_receipts_subtotal",
			"col_b_convention_refunds_subtotal",
			"col_b_other_refunds_subtotal",
			"col_b_other_income_subtotal",
			"col_b_total_receipts",
			"col_b_convention_expenses_subtotal",
			"col_b_transfers_to_affiliated",
			"col_b_loan_disbursements_subtotal",
			"col_b_other_disbursements_subtotal",
			"col_b_total_disbursements",
			"treasurer_name",
			"date_signed"
		]
	},
		"^f5[na]": {
		"^(P3.4|P3.3|P3.2)": [
			"form_type",
			"filer_committee_id_number",
			"organization_name",
			"individual_last_name",
			"individual_first_name",
			"individual_middle_name",
			"individual_prefix",
			"individual_suffix",
			"change_of_address",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"individual_occupation",
			"individual_employer",
			"report_code",
			"report_type",
			"original_amendment_date",
			"coverage_from_date",
			"coverage_through_date",
			"total_contribution",
			"total_independent_expenditure",
			"person_completing_last_name",
			"person_completing_first_name",
			"person_completing_middle_name",
			"person_completing_prefix",
			"person_completing_suffix",
			"date_signed",
			"beginning_image_number",
			"end_image_number",
			"receipt_date"
		],
		"^P3.1": [
			"form_type",
			"filer_committee_id_number",
			"organization_name",
			"individual_last_name",
			"individual_first_name",
			"individual_middle_name",
			"individual_prefix",
			"individual_suffix",
			"change_of_address",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"individual_occupation",
			"individual_employer",
			"report_code",
			"report_type",
			"original_amendment_date",
			"coverage_from_date",
			"coverage_through_date",
			"total_contribution",
			"total_independent_expenditure",
			"person_completing_last_name",
			"person_completing_first_name",
			"person_completing_middle_name",
			"person_completing_prefix",
			"person_completing_suffix",
			"date_signed",
			"beginning_image_number"
		],
		"^P2|^P3.0": [
			"form_type",
			"filer_committee_id_number",
			"organization_name",
			"individual_last_name",
			"individual_first_name",
			"individual_middle_name",
			"individual_prefix",
			"individual_suffix",
			"change_of_address",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"qualified_nonprofit",
			"individual_employer",
			"individual_occupation",
			"report_code",
			"report_type",
			"coverage_from_date",
			"coverage_through_date",
			"total_contribution",
			"total_independent_expenditure",
			"person_completing_last_name",
			"person_completing_first_name",
			"person_completing_middle_name",
			"person_completing_prefix",
			"person_completing_suffix",
			"date_signed",
			"beginning_image_number"
		],
		"^P1": [
			"form_type",
			"filer_committee_id_number",
			"organization_name",
			"individual_last_name",
			"individual_first_name",
			"individual_middle_name",
			"individual_prefix",
			"individual_suffix",
			"change_of_address",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"qualified_nonprofit",
			"individual_employer",
			"individual_occupation",
			"report_code",
			"report_type",
			"election_code",
			"election_date",
			"election_state",
			"coverage_from_date",
			"coverage_through_date",
			"total_contribution",
			"total_independent_expenditure",
			"person_completing_last_name",
			"person_completing_first_name",
			"person_completing_middle_name",
			"person_completing_prefix",
			"person_completing_suffix",
			"date_signed",
			"beginning_image_number"
		],
		"^(8.3|8.2|8.1)": [
			"form_type",
			"filer_committee_id_number",
			"entity_type",
			"organization_name",
			"individual_last_name",
			"individual_first_name",
			"individual_middle_name",
			"individual_prefix",
			"individual_suffix",
			"change_of_address",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"individual_occupation",
			"individual_employer",
			"report_code",
			"report_type",
			"original_amendment_date",
			"coverage_from_date",
			"coverage_through_date",
			"total_contribution",
			"total_independent_expenditure",
			"person_completing_last_name",
			"person_completing_first_name",
			"person_completing_middle_name",
			"person_completing_prefix",
			"person_completing_suffix",
			"date_signed"
		],
		"^(8.0|7.0|6.4|6.3|6.2|6.1)": [
			"form_type",
			"filer_committee_id_number",
			"entity_type",
			"organization_name",
			"individual_last_name",
			"individual_first_name",
			"individual_middle_name",
			"individual_prefix",
			"individual_suffix",
			"change_of_address",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"qualified_nonprofit",
			"individual_employer",
			"individual_occupation",
			"report_code",
			"report_type",
			"coverage_from_date",
			"coverage_through_date",
			"total_contribution",
			"total_independent_expenditure",
			"person_completing_last_name",
			"person_completing_first_name",
			"person_completing_middle_name",
			"person_completing_prefix",
			"person_completing_suffix",
			"date_signed"
		],
		"^5.3": [
			"form_type",
			"filer_committee_id_number",
			"committee_name",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"change_of_address",
			"qualified_nonprofit",
			"individual_employer",
			"",
			"report_code",
			"",
			"",
			"",
			"coverage_from_date",
			"coverage_through_date",
			"total_contribution",
			"total_independent_expenditure",
			"person_completing_name",
			"date_signed",
			"",
			"",
			"",
			"report_type"
		],
		"^(5.2|5.1|5.0)": [
			"form_type",
			"filer_committee_id_number",
			"committee_name",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"change_of_address",
			"qualified_nonprofit",
			"individual_employer",
			"individual_occupation",
			"report_code",
			"report_pgi",
			"election_date",
			"election_state",
			"coverage_from_date",
			"coverage_through_date",
			"total_contribution",
			"total_independent_expenditure",
			"person_completing_name",
			"date_signed",
			"date_notarized",
			"date_notary_commission_expires",
			"notary_name",
			"report_type"
		],
		"^3": [
			"form_type",
			"filer_committee_id_number",
			"committee_name",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"change_of_address",
			"qualified_nonprofit",
			"individual_employer",
			"individual_occupation",
			"report_code",
			"report_pgi",
			"election_date",
			"election_state",
			"coverage_from_date",
			"coverage_through_date",
			"total_contribution",
			"total_independent_expenditure",
			"person_completing_name",
			"date_signed",
			"date_notarized",
			"date_notary_commission_expires",
			"notary_name"
		]
	},
		"^f56": {
		"^(P3|P2|P1)": [
			"form_type",
			"filer_committee_id_number",
			"contributor_organization_name",
			"contributor_last_name",
			"contributor_first_name",
			"contributor_middle_name",
			"contributor_prefix",
			"contributor_suffix",
			"contributor_street_1",
			"contributor_street_2",
			"contributor_city",
			"contributor_state",
			"contributor_zip_code",
			"contributor_fec_id",
			"contribution_date",
			"contribution_amount",
			"contributor_employer",
			"contributor_occupation",
			"image_number"
		],
		"^8.3|8.2|8.1|8.0|7.0|6.4|6.3|6.2": [
			"form_type",
			"filer_committee_id_number",
			"transaction_id",
			"entity_type",
			"contributor_organization_name",
			"contributor_last_name",
			"contributor_first_name",
			"contributor_middle_name",
			"contributor_prefix",
			"contributor_suffix",
			"contributor_street_1",
			"contributor_street_2",
			"contributor_city",
			"contributor_state",
			"contributor_zip_code",
			"contributor_fec_id",
			"contribution_date",
			"contribution_amount",
			"contributor_employer",
			"contributor_occupation"
		],
		"^5.3|5.2|5.1|5.0|^3.0": [
			"form_type",
			"filer_committee_id_number",
			"entity_type",
			"contributor_name",
			"contributor_street_1",
			"contributor_street_2",
			"contributor_city",
			"contributor_state",
			"contributor_zip_code",
			"contributor_employer",
			"contributor_occupation",
			"contribution_date",
			"contribution_amount",
			"contributor_fec_id",
			"candidate_id",
			"candidate_name",
			"candidate_office",
			"candidate_state",
			"candidate_district",
			"conduit_name",
			"conduit_street_1",
			"conduit_street_2",
			"conduit_city",
			"conduit_state",
			"conduit_zip_code",
			"",
			"transaction_id"
		]
	},
		"^f57": {
		"^P(3|2|1)": [
			"form_type",
			"filer_committee_id_number",
			"payee_organization_name",
			"payee_last_name",
			"payee_first_name",
			"payee_middle_name",
			"payee_prefix",
			"payee_suffix",
			"payee_street_1",
			"payee_street_2",
			"payee_city",
			"payee_state",
			"payee_zip_code",
			"dissemination_date",
			"expenditure_amount",
			"expenditure_purpose_descrip",
			"category_code",
			"candidate_last_name",
			"candidate_first_name",
			"candidate_middle_name",
			"candidate_prefix",
			"candidate_suffix",
			"candidate_office",
			"candidate_state",
			"candidate_district",
			"support_oppose_code",
			"calendar_y_t_d_per_election_office",
			"election_code",
			"election_other_description",
			"image_number"
		],
		"^8.3|8.2|8.1": [
			"form_type",
			"filer_committee_id_number",
			"transaction_id_number",
			"entity_type",
			"payee_organization_name",
			"payee_last_name",
			"payee_first_name",
			"payee_middle_name",
			"payee_prefix",
			"payee_suffix",
			"payee_street_1",
			"payee_street_2",
			"payee_city",
			"payee_state",
			"payee_zip_code",
			"election_code",
			"election_other_description",
			"dissemination_date",
			"expenditure_amount",
			"calendar_y_t_d_per_election_office",
			"expenditure_purpose_descrip",
			"category_code",
			"payee_cmtte_fec_id_number",
			"support_oppose_code",
			"candidate_id_number",
			"candidate_last_name",
			"candidate_first_name",
			"candidate_middle_name",
			"candidate_prefix",
			"candidate_suffix",
			"candidate_office",
			"candidate_state",
			"candidate_district"
		],
		"^8.0": [
			"form_type",
			"filer_committee_id_number",
			"transaction_id_number",
			"entity_type",
			"payee_organization_name",
			"payee_last_name",
			"payee_first_name",
			"payee_middle_name",
			"payee_prefix",
			"payee_suffix",
			"payee_street_1",
			"payee_street_2",
			"payee_city",
			"payee_state",
			"payee_zip_code",
			"election_code",
			"election_other_description",
			"dissemination_date",
			"expenditure_amount",
			"calendar_y_t_d_per_election_office",
			"expenditure_purpose_descrip",
			"category_code",
			"payee_cmtte_fec_id_number",
			"support_oppose_code",
			"candidate_id_number",
			"candidate_last_name",
			"candidate_first_name",
			"candidate_middle_name",
			"candidate_prefix",
			"candidate_suffix",
			"candidate_office",
			"candidate_state",
			"candidate_district"
		],
		"^7.0|6.4|6.3|6.2|6.1": [
			"form_type",
			"filer_committee_id_number",
			"transaction_id_number",
			"entity_type",
			"payee_organization_name",
			"payee_last_name",
			"payee_first_name",
			"payee_middle_name",
			"payee_prefix",
			"payee_suffix",
			"payee_street_1",
			"payee_street_2",
			"payee_city",
			"payee_state",
			"payee_zip_code",
			"election_code",
			"election_other_description",
			"dissemination_date",
			"expenditure_amount",
			"calendar_y_t_d_per_election_office",
			"expenditure_purpose_code",
			"expenditure_purpose_descrip",
			"category_code",
			"payee_cmtte_fec_id_number",
			"support_oppose_code",
			"candidate_id_number",
			"candidate_last_name",
			"candidate_first_name",
			"candidate_middle_name",
			"candidate_prefix",
			"candidate_suffix",
			"candidate_office",
			"candidate_state",
			"candidate_district"
		],
		"^5.3|5.2|5.1|5.0": [
			"form_type",
			"filer_committee_id_number",
			"entity_type",
			"payee_name",
			"payee_street_1",
			"payee_street_2",
			"payee_city",
			"payee_state",
			"payee_zip_code",
			"expenditure_purpose_descrip",
			"dissemination_date",
			"expenditure_amount",
			"support_oppose_code",
			"candidate_id_number",
			"candidate_name",
			"candidate_office",
			"candidate_state",
			"candidate_district",
			"",
			"",
			"",
			"",
			"",
			"",
			"conduit_name",
			"conduit_street_1",
			"conduit_street_2",
			"conduit_city",
			"conduit_state",
			"conduit_zip_code",
			"",
			"transaction_id_number",
			"category_code",
			"expenditure_purpose_code",
			"calendar_y_t_d_per_election_office",
			"election_code",
			"election_other_description"
		],
		"^3": [
			"form_type",
			"filer_committee_id_number",
			"entity_type",
			"payee_name",
			"payee_street_2",
			"",
			"payee_city",
			"payee_state",
			"payee_zip_code",
			"expenditure_purpose_descrip",
			"dissemination_date",
			"expenditure_amount",
			"support_oppose_code",
			"candidate_id_number",
			"candidate_name",
			"candidate_office",
			"candidate_state",
			"candidate_district",
			"",
			"",
			"",
			"",
			"",
			"",
			"conduit_name",
			"conduit_street_1",
			"conduit_street_2",
			"conduit_city",
			"conduit_state",
			"conduit_zip_code",
			"amended_code"
		]
	},
		"(^f6$)|(^f6[an])": {
		"^P3.2|^P3.3|^P3.4": [
			"form_type",
			"filer_committee_id_number",
			"original_amendment_date",
			"committee_name",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"candidate_last_name",
			"candidate_first_name",
			"candidate_middle_name",
			"candidate_prefix",
			"candidate_suffix",
			"candidate_office",
			"candidate_state",
			"candidate_district",
			"date_signed",
			"beginning_image_number",
			"end_image_number",
			"receipt_date"
		],
		"^P3.0|^P3.1": [
			"form_type",
			"filer_committee_id_number",
			"original_amendment_date",
			"committee_name",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"candidate_last_name",
			"candidate_first_name",
			"candidate_middle_name",
			"candidate_prefix",
			"candidate_suffix",
			"candidate_office",
			"candidate_state",
			"candidate_district",
			"date_signed",
			"beginning_image_number"
		],
		"^P1|^P2": [
			"form_type",
			"filer_committee_id_number",
			"committee_name",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"candidate_last_name",
			"candidate_first_name",
			"candidate_middle_name",
			"candidate_prefix",
			"candidate_suffix",
			"candidate_office",
			"candidate_state",
			"candidate_district",
			"date_signed",
			"beginning_image_number"
		],
		"^8.3|8.2|8.1|8.0": [
			"form_type",
			"filer_committee_id_number",
			"original_amendment_date",
			"committee_name",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"candidate_id_number",
			"candidate_last_name",
			"candidate_first_name",
			"candidate_middle_name",
			"candidate_prefix",
			"candidate_suffix",
			"candidate_office",
			"candidate_state",
			"candidate_district",
			"signer_last_name",
			"signer_first_name",
			"signer_middle_name",
			"signer_prefix",
			"signer_suffix",
			"date_signed"
		],
		"^7.0|6.4|6.3|6.2|6.1": [
			"form_type",
			"filer_committee_id_number",
			"committee_name",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"candidate_id_number",
			"candidate_last_name",
			"candidate_first_name",
			"candidate_middle_name",
			"candidate_prefix",
			"candidate_suffix",
			"candidate_office",
			"candidate_state",
			"candidate_district",
			"signer_last_name",
			"signer_first_name",
			"signer_middle_name",
			"signer_prefix",
			"signer_suffix",
			"date_signed"
		],
		"^(5.3|5.2|5.1|5.0|3.0|2|1)": [
			"form_type",
			"filer_committee_id_number",
			"committee_name",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"candidate_id_number",
			"candidate_name",
			"candidate_office",
			"candidate_state",
			"candidate_district",
			"date_signed"
		]
	},
		"^f65": {
		"^(P3|P2|P1)": [
			"form_type",
			"filer_committee_id_number",
			"contributor_organization_name",
			"contributor_last_name",
			"contributor_first_name",
			"contributor_middle_name",
			"contributor_prefix",
			"contributor_suffix",
			"contributor_street_1",
			"contributor_street_2",
			"contributor_city",
			"contributor_state",
			"contributor_zip_code",
			"contributor_employer",
			"contributor_occupation",
			"contribution_date",
			"contribution_amount",
			"image_number"
		],
		"^8.3|8.2|8.1|8.0|7.0|6.4|6.3|6.2|6.1": [
			"form_type",
			"filer_committee_id_number",
			"transaction_id",
			"entity_type",
			"contributor_organization_name",
			"contributor_last_name",
			"contributor_first_name",
			"contributor_middle_name",
			"contributor_prefix",
			"contributor_suffix",
			"contributor_street_1",
			"contributor_street_2",
			"contributor_city",
			"contributor_state",
			"contributor_zip_code",
			"contributor_fec_id",
			"contribution_date",
			"contribution_amount",
			"contributor_employer",
			"contributor_occupation"
		],
		"^(5.3|5.2|5.1|5.0|3.0|2)": [
			"form_type",
			"filer_committee_id_number",
			"entity_type",
			"contributor_name",
			"contributor_street_1",
			"contributor_street_2",
			"contributor_city",
			"contributor_state",
			"contributor_zip_code",
			"contributor_employer",
			"contributor_occupation",
			"contribution_date",
			"contribution_amount",
			"contributor_fec_id",
			"candidate_id",
			"candidate_name",
			"candidate_office",
			"candidate_state",
			"candidate_district",
			"conduit_name",
			"conduit_street_1",
			"conduit_street_2",
			"conduit_city",
			"conduit_state",
			"conduit_zip_code",
			"amended_cd",
			"transaction_id"
		]
	},
		"^f7[na]": {
		"^P(3.4|3.3|3.2)": [
			"form_type",
			"filer_committee_id_number",
			"organization_name",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"organization_type",
			"report_code",
			"election_date",
			"election_state",
			"coverage_from_date",
			"coverage_through_date",
			"total_costs",
			"person_designated_last_name",
			"person_designated_first_name",
			"person_designated_middle_name",
			"person_designated_prefix",
			"person_designated_suffix",
			"person_designated_title",
			"date_signed",
			"beginning_image_number",
			"end_image_number",
			"receipt_date"
		],
		"^P(3.1|3.0|2|1)": [
			"form_type",
			"filer_committee_id_number",
			"organization_name",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"organization_type",
			"report_code",
			"election_date",
			"election_state",
			"coverage_from_date",
			"coverage_through_date",
			"total_costs",
			"person_designated_last_name",
			"person_designated_first_name",
			"person_designated_middle_name",
			"person_designated_prefix",
			"person_designated_suffix",
			"person_designated_title",
			"date_signed",
			"beginning_image_number"
		],
		"^8.3|8.2|8.1|8.0|7.0|6.4|6.3|6.2|6.1": [
			"form_type",
			"filer_committee_id_number",
			"organization_name",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"organization_type",
			"report_code",
			"election_date",
			"election_state",
			"coverage_from_date",
			"coverage_through_date",
			"total_costs",
			"person_designated_last_name",
			"person_designated_first_name",
			"person_designated_middle_name",
			"person_designated_prefix",
			"person_designated_suffix",
			"person_designated_title",
			"date_signed"
		],
		"^5.3|5.2|5.1|5.0|^3.0": [
			"form_type",
			"filer_committee_id_number",
			"organization_name",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"organization_type",
			"report_code",
			"election_date",
			"election_state",
			"coverage_from_date",
			"coverage_through_date",
			"total_costs",
			"person_designated_name",
			"date_signed",
			"person_designated_title"
		]
	},
		"^f76": {
		"^P(3|2|1)": [
			"form_type",
			"filer_committee_id_number",
			"communication_type",
			"communication_type_description",
			"communication_class",
			"communication_date",
			"support_oppose_code",
			"candidate_last_name",
			"candidate_first_name",
			"candidate_middle_name",
			"candidate_prefix",
			"candidate_suffix",
			"candidate_office",
			"candidate_state",
			"candidate_district",
			"election_code",
			"communication_cost",
			"image_number"
		],
		"^8.3|8.2|8.1|8.0|7.0|6.4|6.3|6.2|6.1": [
			"form_type",
			"filer_committee_id_number",
			"transaction_id",
			"communication_type",
			"communication_type_description",
			"communication_class",
			"communication_date",
			"communication_cost",
			"election_code",
			"election_other_description",
			"support_oppose_code",
			"candidate_id_number",
			"candidate_last_name",
			"candidate_first_name",
			"candidate_middle_name",
			"candidate_prefix",
			"candidate_suffix",
			"candidate_office",
			"candidate_state",
			"candidate_district"
		],
		"^5.3|5.2|5.1|5.0|^3.0": [
			"form_type",
			"filer_committee_id_number",
			"communication_type",
			"communication_type_description",
			"communication_class",
			"communication_date",
			"support_oppose_code",
			"candidate_id_number",
			"candidate_name",
			"candidate_office",
			"candidate_state",
			"candidate_district",
			"election_code",
			"communication_cost",
			"",
			"transaction_id"
		]
	},
		"(^f8$)|(^f8[an])": {
		"^6": [
			"form_type",
			"filer_committee_id_number",
			"committee_name",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"cash_on_hand",
			"cash_on_hand_as_of_date",
			"total_assets_to_be_liquidated",
			"total_assets",
			"receipts_ytd",
			"disbursements_ytd",
			"total_debts_owed",
			"total_num_creditors_owed",
			"num_creditors_part_ii",
			"total_debts_owed_part_ii",
			"total_to_be_paid_to_creditors",
			"committee_is_terminating_activities",
			"planned_termination_report_date",
			"other_auth_committees",
			"other_auth_committees_description",
			"sufficient_funds_to_pay_total",
			"steps_taken_description",
			"committee_filed_previous_plans",
			"residual_funds",
			"residual_funds_description",
			"sufficient_funds_part_iii",
			"sufficient_funds_part_iii_description",
			"treasurer_last_name",
			"treasurer_first_name",
			"treasurer_middle_name",
			"treasurer_prefix",
			"treasurer_suffix",
			"date_signed"
		],
		"^5": [
			"form_type",
			"filer_committee_id_number",
			"committee_name",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"cash_on_hand",
			"cash_on_hand_as_of_date",
			"total_assets_to_be_liquidated",
			"total_assets",
			"receipts_ytd",
			"disbursements_ytd",
			"total_debts_owed",
			"total_num_creditors_owed",
			"num_creditors_part_ii",
			"total_debts_owed_part_ii",
			"total_to_be_paid_to_creditors",
			"committee_is_terminating_activities",
			"planned_termination_report_date",
			"other_auth_committees",
			"other_auth_committees_description",
			"sufficient_funds_to_pay_total",
			"steps_taken_description",
			"committee_filed_previous_plans",
			"residual_funds",
			"residual_funds_description",
			"sufficient_funds_part_iii",
			"sufficient_funds_part_iii_description",
			"treasurer_name",
			"date_signed"
		]
	},
		"^f8ii$": {
		"^6": [
			"form_type",
			"filer_committee_id_number",
			"transaction_id",
			"entity_type",
			"creditor_organization_name",
			"creditor_last_name",
			"creditor_first_name",
			"creditor_middle_name",
			"creditor_prefix",
			"creditor_suffix",
			"creditor_street_1",
			"creditor_street_2",
			"creditor_city",
			"creditor_state",
			"creditor_zip_code",
			"date_incurred",
			"amount_owed_to",
			"amount_offered_in",
			"creditor_code",
			"nature_of_debt_description",
			"efforts_made_to_pay_debt",
			"steps_taken_to_collect",
			"effort_made_by_creditor",
			"no_effort_description",
			"terms_of_settlement_comparable",
			"not_comparable_description",
			"creditor_committee_id_number",
			"creditor_candidate_id_number",
			"creditor_candidate_last_name",
			"creditor_candidate_first_name",
			"creditor_candidate_middle_name",
			"creditor_candidate_prefix",
			"creditor_candidate_suffix",
			"creditor_candidate_office",
			"creditor_candidate_state",
			"creditor_candidate_district",
			"signer_last_name",
			"signer_first_name",
			"signer_middle_name",
			"signer_prefix",
			"signer_suffix",
			"date_signed"
		],
		"^5": [
			"form_type",
			"filer_committee_id_number",
			"creditor_code",
			"creditor_name",
			"creditor_street_1",
			"creditor_street_2",
			"creditor_city",
			"creditor_state",
			"creditor_zip_code",
			"date_incurred",
			"amount_owed_to",
			"amount_offered_in",
			"nature_of_debt_description",
			"efforts_made_to_pay_debt",
			"steps_taken_to_collect",
			"effort_made_by_creditor",
			"no_effort_description",
			"terms_of_settlement_comparable",
			"not_comparable_description",
			"creditor_committee_id_number",
			"creditor_candidate_id_number",
			"creditor_candidate_name",
			"creditor_candidate_office",
			"creditor_candidate_state",
			"creditor_candidate_district",
			"signer_name",
			"date_signed",
			"amended_cd",
			"transaction_id"
		]
	},
		"^f8iii$": {
		"^6": [
			"form_type",
			"filer_committee_id_number",
			"transaction_id",
			"entity_type",
			"creditor_organization_name",
			"creditor_last_name",
			"creditor_first_name",
			"creditor_middle_name",
			"creditor_prefix",
			"creditor_suffix",
			"creditor_street_1",
			"creditor_street_2",
			"creditor_city",
			"creditor_state",
			"creditor_zip_code",
			"date_incurred",
			"amount_owed_to",
			"amount_expected_to_pay",
			"creditor_code",
			"disputed_debt",
			"creditor_committee_id_number",
			"creditor_candidate_id_number",
			"creditor_candidate_last_name",
			"creditor_candidate_first_name",
			"creditor_candidate_middle_name",
			"creditor_candidate_prefix",
			"creditor_candidate_suffix",
			"creditor_candidate_office",
			"creditor_candidate_state",
			"creditor_candidate_district"
		],
		"^5": [
			"form_type",
			"filer_committee_id_number",
			"creditor_code",
			"creditor_name",
			"creditor_street_1",
			"creditor_street_2",
			"creditor_city",
			"creditor_state",
			"creditor_zip_code",
			"disputed_debt",
			"date_incurred",
			"amount_owed_to",
			"amount_expected_to_pay",
			"creditor_committee_id_number",
			"creditor_candidate_id_number",
			"creditor_candidate_name",
			"creditor_candidate_office",
			"creditor_candidate_state",
			"creditor_candidate_district",
			"amended_cd",
			"transaction_id"
		]
	},
		"(^f9$)|(^f9[an])": {
		"^P(3.4|3.3|3.2)": [
			"form_type",
			"filer_committee_id_number",
			"organization_name",
			"individual_last_name",
			"individual_first_name",
			"individual_middle_name",
			"individual_prefix",
			"individual_suffix",
			"change_of_address",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"individual_employer",
			"individual_occupation",
			"coverage_from_date",
			"coverage_through_date",
			"date_public_distribution",
			"communication_title",
			"filer_code",
			"filer_code_description",
			"segregated_bank_account",
			"custodian_last_name",
			"custodian_first_name",
			"custodian_middle_name",
			"custodian_prefix",
			"custodian_suffix",
			"custodian_street_1",
			"custodian_street_2",
			"custodian_city",
			"custodian_state",
			"custodian_zip_code",
			"custodian_employer",
			"custodian_occupation",
			"total_donations",
			"total_disbursements",
			"person_completing_last_name",
			"person_completing_first_name",
			"person_completing_middle_name",
			"person_completing_prefix",
			"person_completing_suffix",
			"date_signed",
			"beginning_image_number",
			"end_image_number",
			"receipt_date"
		],
		"^P(3.1|3.0|2.6|2.4)": [
			"form_type",
			"filer_committee_id_number",
			"organization_name",
			"individual_last_name",
			"individual_first_name",
			"individual_middle_name",
			"individual_prefix",
			"individual_suffix",
			"change_of_address",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"individual_employer",
			"individual_occupation",
			"coverage_from_date",
			"coverage_through_date",
			"date_public_distribution",
			"communication_title",
			"filer_code",
			"filer_code_description",
			"segregated_bank_account",
			"custodian_last_name",
			"custodian_first_name",
			"custodian_middle_name",
			"custodian_prefix",
			"custodian_suffix",
			"custodian_street_1",
			"custodian_street_2",
			"custodian_city",
			"custodian_state",
			"custodian_zip_code",
			"custodian_employer",
			"custodian_occupation",
			"total_donations",
			"total_disbursements",
			"person_completing_last_name",
			"person_completing_first_name",
			"person_completing_middle_name",
			"person_completing_prefix",
			"person_completing_suffix",
			"date_signed",
			"beginning_image_number"
		],
		"^P(2.3|2.2|1)": [
			"form_type",
			"filer_committee_id_number",
			"organization_name",
			"individual_last_name",
			"individual_first_name",
			"individual_middle_name",
			"individual_prefix",
			"individual_suffix",
			"change_of_address",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"individual_employer",
			"individual_occupation",
			"coverage_from_date",
			"coverage_through_date",
			"date_public_distribution",
			"communication_title",
			"qualified_non_profit",
			"segregated_bank_account",
			"custodian_last_name",
			"custodian_first_name",
			"custodian_middle_name",
			"custodian_prefix",
			"custodian_suffix",
			"custodian_street_1",
			"custodian_street_2",
			"custodian_city",
			"custodian_state",
			"custodian_zip_code",
			"custodian_employer",
			"custodian_occupation",
			"total_donations",
			"total_disbursements",
			"person_completing_last_name",
			"person_completing_first_name",
			"person_completing_middle_name",
			"person_completing_prefix",
			"person_completing_suffix",
			"date_signed",
			"beginning_image_number"
		],
		"^8.3": [
			"form_type",
			"filer_committee_id_number",
			"entity_type",
			"organization_name",
			"individual_last_name",
			"individual_first_name",
			"individual_middle_name",
			"individual_prefix",
			"individual_suffix",
			"change_of_address",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"individual_employer",
			"individual_occupation",
			"original_amendment_date",
			"coverage_from_date",
			"coverage_through_date",
			"date_public_distribution",
			"communication_title",
			"filer_code",
			"filer_code_description",
			"segregated_bank_account",
			"custodian_last_name",
			"custodian_first_name",
			"custodian_middle_name",
			"custodian_prefix",
			"custodian_suffix",
			"custodian_street_1",
			"custodian_street_2",
			"custodian_city",
			"custodian_state",
			"custodian_zip_code",
			"custodian_employer",
			"custodian_occupation",
			"total_donations",
			"total_disbursements",
			"person_completing_last_name",
			"person_completing_first_name",
			"person_completing_middle_name",
			"person_completing_prefix",
			"person_completing_suffix",
			"date_signed"
		],
		"^8.2|8.1|8.0|7.0|6.4|6.3|6.2": [
			"form_type",
			"filer_committee_id_number",
			"entity_type",
			"organization_name",
			"individual_last_name",
			"individual_first_name",
			"individual_middle_name",
			"individual_prefix",
			"individual_suffix",
			"change_of_address",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"individual_employer",
			"individual_occupation",
			"coverage_from_date",
			"coverage_through_date",
			"date_public_distribution",
			"communication_title",
			"filer_code",
			"filer_code_description",
			"segregated_bank_account",
			"custodian_last_name",
			"custodian_first_name",
			"custodian_middle_name",
			"custodian_prefix",
			"custodian_suffix",
			"custodian_street_1",
			"custodian_street_2",
			"custodian_city",
			"custodian_state",
			"custodian_zip_code",
			"custodian_employer",
			"custodian_occupation",
			"total_donations",
			"total_disbursements",
			"person_completing_last_name",
			"person_completing_first_name",
			"person_completing_middle_name",
			"person_completing_prefix",
			"person_completing_suffix",
			"date_signed"
		],
		"^6.1": [
			"form_type",
			"filer_committee_id_number",
			"entity_type",
			"organization_name",
			"individual_last_name",
			"individual_first_name",
			"individual_middle_name",
			"individual_prefix",
			"individual_suffix",
			"change_of_address",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"individual_employer",
			"individual_occupation",
			"coverage_from_date",
			"coverage_through_date",
			"date_public_distribution",
			"communication_title",
			"qualified_non_profit",
			"segregated_bank_account",
			"custodian_last_name",
			"custodian_first_name",
			"custodian_middle_name",
			"custodian_prefix",
			"custodian_suffix",
			"custodian_street_1",
			"custodian_street_2",
			"custodian_city",
			"custodian_state",
			"custodian_zip_code",
			"custodian_employer",
			"custodian_occupation",
			"total_donations",
			"total_disbursements",
			"person_completing_last_name",
			"person_completing_first_name",
			"person_completing_middle_name",
			"person_completing_prefix",
			"person_completing_suffix",
			"date_signed"
		],
		"^5.3|5.2|5.1|5.0": [
			"form_type",
			"filer_committee_id_number",
			"organization_name",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"change_of_address",
			"individual_employer",
			"individual_occupation",
			"coverage_from_date",
			"coverage_through_date",
			"date_public_distribution",
			"communication_title",
			"qualified_non_profit",
			"segregated_bank_account",
			"custodian_last_name",
			"custodian_street_1",
			"custodian_street_2",
			"custodian_city",
			"custodian_state",
			"custodian_zip_code",
			"custodian_employer",
			"custodian_occupation",
			"total_donations",
			"total_disbursements",
			"person_completing_last_name",
			"date_signed"
		]
	},
		"^f91": {
		"^(P3|P2|P1)": [
			"form_type",
			"filer_committee_id_number",
			"controller_last_name",
			"controller_first_name",
			"controller_middle_name",
			"controller_prefix",
			"controller_suffix",
			"controller_street_1",
			"controller_street_2",
			"controller_city",
			"controller_state",
			"controller_zip_code",
			"controller_employer",
			"controller_occupation",
			"image_number"
		],
		"^8.3|8.2|8.1|8.0|7.0|6.4|6.3|6.2|6.1": [
			"form_type",
			"filer_committee_id_number",
			"transaction_id",
			"controller_last_name",
			"controller_first_name",
			"controller_middle_name",
			"controller_prefix",
			"controller_suffix",
			"controller_street_1",
			"controller_street_2",
			"controller_city",
			"controller_state",
			"controller_zip_code",
			"controller_employer",
			"controller_occupation"
		],
		"^5.3": [
			"form_type",
			"filer_committee_id_number",
			"controller_last_name",
			"controller_street_1",
			"controller_street_2",
			"controller_city",
			"controller_state",
			"controller_zip_code",
			"controller_employer",
			"controller_occupation",
			"",
			"transaction_id"
		],
		"^5.2|5.1|5.0": [
			"form_type",
			"filer_committee_id_number",
			"controller_last_name",
			"controller_street_1",
			"controller_street_2",
			"controller_city",
			"controller_state",
			"controller_zip_code",
			"controller_employer",
			"controller_occupation",
			"amended_cd",
			"transaction_id"
		]
	},
		"^f92": {
		"^(P3|P2|P1)": [
			"form_type",
			"filer_committee_id_number",
			"contributor_organization_name",
			"contributor_last_name",
			"contributor_first_name",
			"contributor_middle_name",
			"contributor_prefix",
			"contributor_suffix",
			"contributor_street_1",
			"contributor_street_2",
			"contributor_city",
			"contributor_state",
			"contributor_zip_code",
			"contribution_date",
			"contribution_amount",
			"memo_text_description",
			"image_number"
		],
		"^8.3|8.2|8.1|8.0|7.0|6.4|6.3|6.2|6.1": [
			"form_type",
			"filer_committee_id_number",
			"transaction_id",
			"back_reference_tran_id_number",
			"back_reference_sched_name",
			"entity_type",
			"contributor_organization_name",
			"contributor_last_name",
			"contributor_first_name",
			"contributor_middle_name",
			"contributor_prefix",
			"contributor_suffix",
			"contributor_street_1",
			"contributor_street_2",
			"contributor_city",
			"contributor_state",
			"contributor_zip_code",
			"contribution_date",
			"contribution_amount"
		],
		"^5.3|5.2": [
			"form_type",
			"filer_committee_id_number",
			"entity_type",
			"contributor_organization_name",
			"contributor_street_1",
			"contributor_street_2",
			"contributor_city",
			"contributor_state",
			"contributor_zip_code",
			"",
			"",
			"contributor_employer",
			"contributor_occupation",
			"",
			"contribution_date",
			"contribution_amount",
			"transaction_type",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"transaction_id",
			"back_reference_tran_id_number",
			"back_reference_sched_name"
		],
		"^5.1": [
			"form_type",
			"filer_committee_id_number",
			"entity_type",
			"",
			"contributor_street_1",
			"contributor_street_2",
			"contributor_city",
			"contributor_state",
			"contributor_zip_code",
			"",
			"",
			"contributor_employer",
			"contributor_occupation",
			"",
			"contribution_date",
			"contribution_amount",
			"transaction_type",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"transaction_id",
			"back_reference_tran_id_number",
			"back_reference_sched_name",
			"",
			"",
			"contributor_organization_name",
			"contributor_last_name",
			"contributor_first_name",
			"contributor_middle_name",
			"contributor_prefix",
			"contributor_suffix"
		],
		"^5.0": [
			"form_type",
			"filer_committee_id_number",
			"entity_type",
			"contributor_organization_name",
			"contributor_street_1",
			"contributor_street_2",
			"contributor_city",
			"contributor_state",
			"contributor_zip_code",
			"",
			"",
			"contributor_employer",
			"contributor_occupation",
			"",
			"contribution_date",
			"contribution_amount",
			"transaction_type",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"transaction_id",
			"back_reference_tran_id_number",
			"back_reference_sched_name"
		]
	},
		"^f93": {
		"^(P3.4|3.3|3.2)": [
			"form_type",
			"filer_committee_id_number",
			"payee_organization_name",
			"payee_last_name",
			"payee_first_name",
			"payee_middle_name",
			"payee_prefix",
			"payee_suffix",
			"payee_street_1",
			"payee_street_2",
			"payee_city",
			"payee_state",
			"payee_zip_code",
			"expenditure_date",
			"expenditure_amount",
			"communication_date",
			"expenditure_purpose_descrip",
			"transaction_id",
			"image_number"
		],
		"^(P3.1|3.0|P2|P1)": [
			"form_type",
			"filer_committee_id_number",
			"payee_organization_name",
			"payee_last_name",
			"payee_first_name",
			"payee_middle_name",
			"payee_prefix",
			"payee_suffix",
			"payee_street_1",
			"payee_street_2",
			"payee_city",
			"payee_state",
			"payee_zip_code",
			"expenditure_date",
			"expenditure_amount",
			"communication_date",
			"expenditure_purpose_descrip",
			"memo_text_description",
			"transaction_id",
			"image_number"
		],
		"^8.3|8.2|8.1|8.0|7.0|6.4|6.3|6.2|6.1": [
			"form_type",
			"filer_committee_id_number",
			"transaction_id",
			"back_reference_tran_id_number",
			"back_reference_sched_name",
			"entity_type",
			"payee_organization_name",
			"payee_last_name",
			"payee_first_name",
			"payee_middle_name",
			"payee_prefix",
			"payee_suffix",
			"payee_street_1",
			"payee_street_2",
			"payee_city",
			"payee_state",
			"payee_zip_code",
			"election_code",
			"election_other_description",
			"expenditure_date",
			"expenditure_amount",
			"expenditure_purpose_descrip",
			"payee_employer",
			"payee_occupation",
			"communication_date"
		],
		"^5.3|5.2": [
			"form_type",
			"filer_committee_id_number",
			"entity_type",
			"",
			"payee_street_1",
			"payee_street_2",
			"payee_city",
			"payee_state",
			"payee_zip_code",
			"expenditure_purpose_code",
			"expenditure_purpose_descrip",
			"election_code",
			"election_other_description",
			"expenditure_date",
			"expenditure_amount",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"transaction_id",
			"back_reference_tran_id_number",
			"back_reference_sched_name",
			"",
			"",
			"",
			"communication_date",
			"payee_organization_name",
			"payee_last_name",
			"payee_first_name",
			"payee_middle_name",
			"payee_prefix",
			"payee_suffix"
		],
		"^5.1": [
			"form_type",
			"filer_committee_id_number",
			"entity_type",
			"payee_organization_name",
			"payee_street_1",
			"payee_street_2",
			"payee_city",
			"payee_state",
			"payee_zip_code",
			"expenditure_purpose_descrip",
			"expenditure_purpose_code",
			"election_code",
			"election_other_description",
			"expenditure_date",
			"expenditure_amount",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"transaction_id",
			"back_reference_tran_id_number",
			"back_reference_sched_name",
			"",
			"",
			"",
			"communication_date",
			"",
			"payee_last_name",
			"payee_first_name",
			"payee_middle_name",
			"payee_prefix",
			"payee_suffix"
		],
		"^5.0": [
			"form_type",
			"filer_committee_id_number",
			"entity_type",
			"payee_organization_name",
			"payee_street_1",
			"payee_street_2",
			"payee_city",
			"payee_state",
			"payee_zip_code",
			"election_code",
			"election_other_description",
			"payee_employer",
			"payee_occupation",
			"",
			"expenditure_date",
			"expenditure_amount",
			"expenditure_purpose_descrip",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"transaction_id",
			"back_reference_tran_id_number",
			"back_reference_sched_name"
		]
	},
		"^f94": {
		"^(P3|P2|P1)": [
			"form_type",
			"filer_committee_id_number",
			"candidate_last_name",
			"candidate_first_name",
			"candidate_middle_name",
			"candidate_prefix",
			"candidate_suffix",
			"candidate_office",
			"candidate_state",
			"candidate_district",
			"election_code",
			"election_other_description",
			"back_reference_tran_id_number",
			"image_number"
		],
		"^8.3|8.2|8.1|8.0|7.0|6.4|6.3|6.2|6.1": [
			"form_type",
			"filer_committee_id_number",
			"transaction_id",
			"back_reference_tran_id_number",
			"back_reference_sched_name",
			"candidate_id_number",
			"candidate_last_name",
			"candidate_first_name",
			"candidate_middle_name",
			"candidate_prefix",
			"candidate_suffix",
			"candidate_office",
			"candidate_state",
			"candidate_district",
			"election_code",
			"election_other_description"
		],
		"^5.3|5.2|5.1|5.0": [
			"form_type",
			"filer_committee_id_number",
			"candidate_id_number",
			"candidate_name",
			"candidate_office",
			"candidate_state",
			"candidate_district",
			"election_code",
			"election_other_description",
			"",
			"transaction_id",
			"back_reference_tran_id_number",
			"back_reference_sched_name"
		]
	},
		"^f99": {
		"^(P3.4|P3.3|P3.2)": [
			"form_type",
			"filer_committee_id_number",
			"beginning_image_number",
			"end_image_number",
			"receipt_date"
		],
		"^8.3|8.2|8.1|8.0|7.0|6.4|6.3|6.2|6.1": [
			"form_type",
			"filer_committee_id_number",
			"committee_name",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"treasurer_last_name",
			"treasurer_first_name",
			"treasurer_middle_name",
			"treasurer_prefix",
			"treasurer_suffix",
			"date_signed",
			"text_code",
			"text"
		],
		"^5.3|5.2|5.1|5.0": [
			"form_type",
			"filer_committee_id_number",
			"committee_name",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"treasurer_name",
			"date_signed",
			"text_code",
			"text"
		],
		"^3": [
			"form_type",
			"filer_committee_id_number",
			"committee_name",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"treasurer_name",
			"date_signed",
			"text"
		]
	},
		"^f10$": {
		"^6": [
			"form_type",
			"filer_committee_id_number",
			"committee_name",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"candidate_id",
			"candidate_last_name",
			"candidate_first_name",
			"candidate_middle_name",
			"candidate_prefix",
			"candidate_suffix",
			"candidate_office",
			"candidate_state",
			"candidate_district",
			"previous_expenditure_aggregate",
			"expenditure_total_this_report",
			"expenditure_total_cycle_to_date",
			"meets_f6_filing_requirements",
			"candidate_employer",
			"candidate_occupation",
			"treasurer_last_name",
			"treasurer_first_name",
			"treasurer_middle_name",
			"treasurer_prefix",
			"treasurer_suffix",
			"date_signed"
		],
		"^5.3": [
			"form_type",
			"filer_committee_id_number",
			"candidate_name",
			"candidate_id",
			"candidate_office",
			"candidate_state",
			"candidate_district",
			"committee_name",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"previous_expenditure_aggregate",
			"expenditure_total_this_report",
			"expenditure_total_cycle_to_date",
			"signer_name",
			"date_signed",
			"meets_f6_filing_requirements",
			"candidate_employer",
			"candidate_occupation"
		],
		"^(5.0|5.1|5.2)": [
			"form_type",
			"filer_committee_id_number",
			"candidate_name",
			"candidate_id",
			"candidate_office",
			"candidate_state",
			"candidate_district",
			"committee_name",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"previous_expenditure_aggregate",
			"expenditure_total_this_report",
			"expenditure_total_cycle_to_date",
			"signer_name",
			"date_signed"
		]
	},
		"^f105$": {
		"^6": [
			"form_type",
			"filer_committee_id_number",
			"transaction_id",
			"election_code",
			"election_other_description",
			"expenditure_date",
			"expenditure_amount",
			"loan_check"
		],
		"^5": [
			"form_type",
			"filer_committee_id_number",
			"expenditure_date",
			"item_elect_cd",
			"item_elect_other",
			"expenditure_amount",
			"loan_check",
			"amended_cd",
			"transaction_id"
		]
	},
		"^h1": {
		"^P3.4": [
			"form_type",
			"filer_committee_id_number",
			"presidential_only_election_year",
			"presidential_senate_election_year",
			"senate_only_election_year",
			"non_presidential_non_senate_election_year",
			"federal_percent",
			"nonfederal_percent",
			"administrative_ratio_applies",
			"generic_voter_drive_ratio_applies",
			"public_communications_referencing_party_ratio_applies",
			"image_number"
		],
		"^P1|^P2|^P3.0|^P3.1|^P3.2|^P3.3": [
			"form_type",
			"filer_committee_id_number",
			"presidential_only_election_year",
			"presidential_senate_election_year",
			"senate_only_election_year",
			"non_presidential_non_senate_election_year",
			"flat_minimum_federal_percentage",
			"federal_percent",
			"nonfederal_percent",
			"administrative_ratio_applies",
			"generic_voter_drive_ratio_applies",
			"public_communications_referencing_party_ratio_applies",
			"image_number"
		],
		"^8.3|8.2": [
			"form_type",
			"filer_committee_id_number",
			"transaction_id",
			"presidential_only_election_year",
			"presidential_senate_election_year",
			"senate_only_election_year",
			"non_presidential_non_senate_election_year",
			"federal_percent",
			"nonfederal_percent",
			"administrative_ratio_applies",
			"generic_voter_drive_ratio_applies",
			"public_communications_referencing_party_ratio_applies"
		],
		"^8.1|8.0|7.0|6.4|6.3|6.2|6.1": [
			"form_type",
			"filer_committee_id_number",
			"transaction_id",
			"presidential_only_election_year",
			"presidential_senate_election_year",
			"senate_only_election_year",
			"non_presidential_non_senate_election_year",
			"flat_minimum_federal_percentage",
			"federal_percent",
			"nonfederal_percent",
			"administrative_ratio_applies",
			"generic_voter_drive_ratio_applies",
			"public_communications_referencing_party_ratio_applies"
		],
		"^5.3|5.2": [
			"form_type",
			"filer_committee_id_number",
			"transaction_id",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"presidential_only_election_year",
			"presidential_senate_election_year",
			"senate_only_election_year",
			"non_presidential_non_senate_election_year",
			"flat_minimum_federal_percentage",
			"federal_percent",
			"nonfederal_percent",
			"administrative_ratio_applies",
			"generic_voter_drive_ratio_applies",
			"public_communications_referencing_party_ratio_applies"
		],
		"^5.1|5.0": [
			"form_type",
			"filer_committee_id_number",
			"national_party_committee_percentage",
			"house_senate_party_committees_minimum_federal_percentage",
			"house_senate_party_committees_percentage_federal_candidate_support",
			"house_senate_party_committees_percentage_nonfederal_candidate_support",
			"house_senate_party_committees_actual_federal_candidate_support",
			"house_senate_party_committees_actual_nonfederal_candidate_support",
			"house_senate_party_committees_percentage_actual_federal",
			"federal_percent",
			"nonfederal_percent",
			"actual_direct_candidate_support_federal",
			"actual_direct_candidate_support_nonfederal",
			"actual_direct_candidate_support_federal_percent",
			"ballot_presidential",
			"ballot_senate",
			"ballot_house",
			"subtotal_federal",
			"ballot_governor",
			"ballot_other_statewide",
			"ballot_state_senate",
			"ballot_state_representative",
			"ballot_local_candidates",
			"extra_nonfederal_point",
			"subtotal",
			"total_points",
			"flat_minimum_federal_percentage",
			"",
			"transaction_id",
			"presidential_only_election_year",
			"presidential_senate_election_year",
			"senate_only_election_year",
			"non_presidential_non_senate_election_year"
		],
		"^3.0|^2|^1": [
			"ballot_local_candidates",
			"filer_committee_id_number",
			"national_party_committee_percentage",
			"house_senate_party_committees_minimum_federal_percentage",
			"house_senate_party_committees_percentage_federal_candidate_support",
			"house_senate_party_committees_percentage_nonfederal_candidate_support",
			"house_senate_party_committees_actual_federal_candidate_support",
			"house_senate_party_committees_actual_nonfederal_candidate_support",
			"house_senate_party_committees_percentage_actual_federal",
			"federal_percent",
			"nonfederal_percent",
			"actual_direct_candidate_support_federal",
			"actual_direct_candidate_support_nonfederal",
			"actual_direct_candidate_support_federal_percent",
			"ballot_presidential",
			"ballot_senate",
			"ballot_house",
			"subtotal_federal",
			"ballot_governor",
			"ballot_other_statewide",
			"ballot_state_senate",
			"ballot_state_representative",
			"ballot_local_candidates",
			"extra_nonfederal_point",
			"subtotal",
			"total_points",
			"flat_minimum_federal_percentage",
			"amended_cd",
			"transaction_id"
		]
	},
		"^h2": {
		"^P3|^P2|^P1": [
			"form_type",
			"filer_committee_id_number",
			"activity_event_name",
			"direct_fundraising",
			"direct_candidate_support",
			"ratio_code",
			"federal_percentage",
			"nonfederal_percentage",
			"image_number"
		],
		"^8.3|8.2|8.1|8.0|7.0|6.4|6.3|6.2|6.1": [
			"form_type",
			"filer_committee_id_number",
			"transaction_id",
			"activity_event_name",
			"direct_fundraising",
			"direct_candidate_support",
			"ratio_code",
			"federal_percentage",
			"nonfederal_percentage"
		],
		"^5.3|5.2|5.1": [
			"form_type",
			"filer_committee_id_number",
			"activity_event_name",
			"direct_fundraising",
			"",
			"direct_candidate_support",
			"ratio_code",
			"federal_percentage",
			"nonfederal_percentage",
			"",
			"transaction_id"
		],
		"^5.0|^3.0|^2|^1": [
			"form_type",
			"filer_committee_id_number",
			"activity_event_name",
			"direct_fundraising",
			"exempt_activity",
			"direct_candidate_support",
			"ratio_code",
			"federal_percentage",
			"nonfederal_percentage",
			"amended_cd",
			"transaction_id"
		]
	},
		"^h3": {
		"^P3|^P2|^P1": [
			"form_type",
			"filer_committee_id_number",
			"account_name",
			"receipt_date",
			"total_amount_transferred",
			"event_type",
			"transferred_amount",
			"event_activity_name",
			"image_number"
		],
		"^8.3|8.2|8.1|8.0|7.0|6.4|6.3|6.2|6.1": [
			"form_type",
			"filer_committee_id_number",
			"transaction_id",
			"back_reference_tran_id_number",
			"account_name",
			"event_type",
			"event_activity_name",
			"receipt_date",
			"total_amount_transferred",
			"transferred_amount"
		],
		"^5.3|5.2|5.1|5.0|^3.0": [
			"form_type",
			"filer_committee_id_number",
			"back_reference_tran_id_number",
			"account_name",
			"event_activity_name",
			"event_type",
			"receipt_date",
			"transferred_amount",
			"total_amount_transferred",
			"amended_cd",
			"transaction_id"
		],
		"^2": [
			"form_type",
			"filer_committee_id_number",
			"account_name",
			"receipt_date",
			"total_amount_transferred",
			"administrative_voter_drive_activity",
			"direct_fundraising",
			"exempt_activity",
			"amended_cd",
			"transaction_id",
			"orig_tran_id",
			"supr_tran_id"
		]
	},
		"^h4": {
		"^P3.2|^P3.3|^P3.4": [
			"form_type",
			"filer_committee_id_number",
			"payee_organization_name",
			"payee_last_name",
			"payee_first_name",
			"payee_middle_name",
			"payee_prefix",
			"payee_suffix",
			"payee_street_1",
			"payee_street_2",
			"payee_city",
			"payee_state",
			"payee_zip_code",
			"expenditure_purpose_description",
			"account_identifier",
			"category_code",
			"administrative_voter_drive_activity",
			"fundraising_activity",
			"exempt_activity",
			"generic_voter_drive_activity",
			"direct_candidate_support_activity",
			"public_communications_party_activity",
			"event_year_to_date",
			"expenditure_date",
			"federal_share",
			"nonfederal_share",
			"total_amount",
			"memo_code",
			"memo_text",
			"image_number"
		],
		"^P1|^P2|^P3.0|^P3.1": [
			"form_type",
			"filer_committee_id_number",
			"payee_organization_name",
			"payee_last_name",
			"payee_first_name",
			"payee_middle_name",
			"payee_prefix",
			"payee_suffix",
			"payee_street_1",
			"payee_street_2",
			"payee_city",
			"payee_state",
			"payee_zip_code",
			"expenditure_purpose_description",
			"account_identifier",
			"category_code",
			"administrative_voter_drive_activity",
			"fundraising_activity",
			"exempt_activity",
			"generic_voter_drive_activity",
			"direct_candidate_support_activity",
			"public_communications_party_activity",
			"event_year_to_date",
			"expenditure_date",
			"federal_share",
			"nonfederal_share",
			"total_amount",
			"image_number"
		],
		"^8.3|8.2|8.1|8.0": [
			"form_type",
			"filer_committee_id_number",
			"transaction_id_number",
			"back_reference_tran_id_number",
			"back_reference_sched_name",
			"entity_type",
			"payee_organization_name",
			"payee_last_name",
			"payee_first_name",
			"payee_middle_name",
			"payee_prefix",
			"payee_suffix",
			"payee_street_1",
			"payee_street_2",
			"payee_city",
			"payee_state",
			"payee_zip_code",
			"account_identifier",
			"expenditure_date",
			"total_amount",
			"federal_share",
			"nonfederal_share",
			"event_year_to_date",
			"expenditure_purpose_description",
			"category_code",
			"administrative_voter_drive_activity",
			"fundraising_activity",
			"exempt_activity",
			"generic_voter_drive_activity",
			"direct_candidate_support_activity",
			"public_communications_party_activity",
			"memo_code",
			"memo_text"
		],
		"^7.0|6.4|6.3|6.2|6.1": [
			"form_type",
			"filer_committee_id_number",
			"transaction_id_number",
			"back_reference_tran_id_number",
			"back_reference_sched_name",
			"entity_type",
			"payee_organization_name",
			"payee_last_name",
			"payee_first_name",
			"payee_middle_name",
			"payee_prefix",
			"payee_suffix",
			"payee_street_1",
			"payee_street_2",
			"payee_city",
			"payee_state",
			"payee_zip_code",
			"account_identifier",
			"expenditure_date",
			"total_amount",
			"federal_share",
			"nonfederal_share",
			"event_year_to_date",
			"expenditure_purpose_code",
			"expenditure_purpose_description",
			"category_code",
			"administrative_voter_drive_activity",
			"fundraising_activity",
			"exempt_activity",
			"generic_voter_drive_activity",
			"direct_candidate_support_activity",
			"public_communications_party_activity",
			"memo_code",
			"memo_text"
		],
		"^5.3|5.2": [
			"form_type",
			"filer_committee_id_number",
			"entity_type",
			"payee_name",
			"payee_street_1",
			"payee_street_2",
			"payee_city",
			"payee_state",
			"payee_zip_code",
			"expenditure_purpose_description",
			"expenditure_date",
			"total_amount",
			"federal_share",
			"nonfederal_share",
			"",
			"fundraising_activity",
			"exempt_activity",
			"direct_candidate_support_activity",
			"event_year_to_date",
			"account_identifier",
			"fec_committee_id_number",
			"fec_candidate_id_number",
			"candidate_name",
			"candidate_office",
			"candidate_state",
			"candidate_district",
			"conduit_name",
			"conduit_street_1",
			"conduit_street_2",
			"conduit_city",
			"conduit_state",
			"conduit_zip_code",
			"",
			"transaction_id_number",
			"memo_code",
			"memo_text",
			"back_reference_tran_id_number",
			"back_reference_sched_name",
			"administrative_voter_drive_activity",
			"generic_voter_drive_activity",
			"category_code",
			"expenditure_purpose_code",
			"public_communications_party_activity"
		],
		"^5.1|5.0": [
			"form_type",
			"filer_committee_id_number",
			"entity_type",
			"payee_name",
			"payee_street_1",
			"payee_street_2",
			"payee_city",
			"payee_state",
			"payee_zip_code",
			"expenditure_purpose_description",
			"expenditure_date",
			"total_amount",
			"federal_share",
			"nonfederal_share",
			"",
			"fundraising_activity",
			"exempt_activity",
			"direct_candidate_support_activity",
			"event_year_to_date",
			"account_identifier",
			"fec_committee_id_number",
			"fec_candidate_id_number",
			"candidate_name",
			"candidate_office",
			"candidate_state",
			"candidate_district",
			"conduit_name",
			"conduit_street_1",
			"conduit_street_2",
			"conduit_city",
			"conduit_state",
			"conduit_zip_code",
			"",
			"transaction_id_number",
			"memo_code",
			"memo_text",
			"back_reference_tran_id_number",
			"back_reference_sched_name",
			"administrative_voter_drive_activity",
			"generic_voter_drive_activity",
			"category_code",
			"expenditure_purpose_code"
		],
		"^3.0": [
			"form_type",
			"filer_committee_id_number",
			"entity_type",
			"payee_name",
			"payee_street_1",
			"payee_street_2",
			"payee_city",
			"payee_state",
			"payee_zip_code",
			"expenditure_purpose_description",
			"expenditure_date",
			"total_amount",
			"federal_share",
			"nonfederal_share",
			"administrative_voter_drive_activity",
			"fundraising_activity",
			"exempt_activity",
			"direct_candidate_support_activity",
			"event_year_to_date",
			"account_identifier",
			"fec_committee_id_number",
			"fec_candidate_id_number",
			"candidate_name",
			"candidate_office",
			"candidate_state",
			"candidate_district",
			"conduit_name",
			"conduit_street_1",
			"conduit_street_2",
			"conduit_city",
			"conduit_state",
			"conduit_zip_code",
			"amended_cd",
			"transaction_id_number",
			"memo_code",
			"memo_text",
			"back_reference_tran_id_number",
			"back_reference_sched_name"
		],
		"^2": [
			"form_type",
			"filer_committee_id_number",
			"entity_type",
			"payee_name",
			"payee_street_1",
			"payee_street_2",
			"payee_city",
			"payee_state",
			"payee_zip_code",
			"expenditure_purpose_description",
			"expenditure_date",
			"total_amount",
			"federal_share",
			"nonfederal_share",
			"administrative_voter_drive_activity",
			"fundraising_activity",
			"exempt_activity",
			"direct_candidate_support_activity",
			"event_year_to_date",
			"account_identifier",
			"fec_committee_id_number",
			"fec_candidate_id_number",
			"candidate_name",
			"candidate_office",
			"candidate_state",
			"candidate_district",
			"conduit_name",
			"conduit_street_1",
			"conduit_street_2",
			"conduit_city",
			"conduit_state",
			"conduit_zip_code",
			"amended_cd",
			"transaction_id_number",
			"orig_tran_id",
			"supr_tran_id"
		]
	},
		"^h5": {
		"^(P3|P2|P1)": [
			"form_type",
			"filer_committee_id_number",
			"account_name",
			"receipt_date",
			"total_amount_transferred",
			"voter_registration_amount",
			"voter_id_amount",
			"gotv_amount",
			"generic_campaign_amount",
			"image_number"
		],
		"^8.3|8.2|8.1|8.0|7.0|6.4|6.3|6.2|6.1": [
			"form_type",
			"filer_committee_id_number",
			"transaction_id",
			"account_name",
			"receipt_date",
			"total_amount_transferred",
			"voter_registration_amount",
			"voter_id_amount",
			"gotv_amount",
			"generic_campaign_amount"
		],
		"^5.3|5.2|5.1|5.0": [
			"form_type",
			"filer_committee_id_number",
			"account_name",
			"receipt_date",
			"voter_registration_amount",
			"voter_id_amount",
			"gotv_amount",
			"generic_campaign_amount",
			"total_amount_transferred",
			"",
			"transaction_id"
		]
	},
		"^h6": {
		"^(P3.4|P3.3|P3.2)": [
			"form_type",
			"filer_committee_id_number",
			"payee_organization_name",
			"payee_last_name",
			"payee_first_name",
			"payee_middle_name",
			"payee_prefix",
			"payee_suffix",
			"payee_street_1",
			"payee_street_2",
			"payee_city",
			"payee_state",
			"payee_zip_code",
			"expenditure_purpose_description",
			"category_code",
			"voter_registration_activity",
			"gotv_activity",
			"voter_id_activity",
			"generic_campaign_activity",
			"event_year_to_date",
			"expenditure_date",
			"federal_share",
			"levin_share",
			"total_amount",
			"memo_code",
			"memo_text",
			"image_number"
		],
		"^(P3.1|P3.0|P2|P1)": [
			"form_type",
			"filer_committee_id_number",
			"payee_organization_name",
			"payee_last_name",
			"payee_first_name",
			"payee_middle_name",
			"payee_prefix",
			"payee_suffix",
			"payee_street_1",
			"payee_street_2",
			"payee_city",
			"payee_state",
			"payee_zip_code",
			"expenditure_purpose_description",
			"category_code",
			"voter_registration_activity",
			"gotv_activity",
			"voter_id_activity",
			"generic_campaign_activity",
			"event_year_to_date",
			"expenditure_date",
			"federal_share",
			"levin_share",
			"total_amount",
			"image_number"
		],
		"^8.3|8.2|8.1|8.0": [
			"form_type",
			"filer_committee_id_number",
			"transaction_id_number",
			"back_reference_tran_id_number",
			"back_reference_sched_name",
			"entity_type",
			"payee_organization_name",
			"payee_last_name",
			"payee_first_name",
			"payee_middle_name",
			"payee_prefix",
			"payee_suffix",
			"payee_street_1",
			"payee_street_2",
			"payee_city",
			"payee_state",
			"payee_zip_code",
			"account_identifier",
			"expenditure_date",
			"total_amount",
			"federal_share",
			"levin_share",
			"event_year_to_date",
			"expenditure_purpose_description",
			"category_code",
			"voter_registration_activity",
			"gotv_activity",
			"voter_id_activity",
			"generic_campaign_activity",
			"memo_code",
			"memo_text"
		],
		"^7.0|6.4|6.3|6.2|6.1": [
			"form_type",
			"filer_committee_id_number",
			"transaction_id_number",
			"back_reference_tran_id_number",
			"back_reference_sched_name",
			"entity_type",
			"payee_organization_name",
			"payee_last_name",
			"payee_first_name",
			"payee_middle_name",
			"payee_prefix",
			"payee_suffix",
			"payee_street_1",
			"payee_street_2",
			"payee_city",
			"payee_state",
			"payee_zip_code",
			"account_identifier",
			"expenditure_date",
			"total_amount",
			"federal_share",
			"levin_share",
			"event_year_to_date",
			"expenditure_purpose_code",
			"expenditure_purpose_description",
			"category_code",
			"voter_registration_activity",
			"gotv_activity",
			"voter_id_activity",
			"generic_campaign_activity",
			"memo_code",
			"memo_text"
		],
		"^5.3|5.2|5.1|5.0": [
			"form_type",
			"filer_committee_id_number",
			"entity_type",
			"payee_name",
			"payee_street_1",
			"payee_street_2",
			"payee_city",
			"payee_state",
			"payee_zip_code",
			"category_code",
			"expenditure_purpose_code",
			"expenditure_purpose_description",
			"expenditure_date",
			"total_amount",
			"federal_share",
			"levin_share",
			"voter_registration_activity",
			"gotv_activity",
			"voter_id_activity",
			"generic_campaign_activity",
			"event_year_to_date",
			"account_identifier",
			"fec_committee_id_number",
			"fec_candidate_id_number",
			"candidate_name",
			"candidate_office",
			"candidate_state",
			"candidate_district",
			"conduit_committee_id",
			"conduit_name",
			"conduit_street_1",
			"conduit_street_2",
			"conduit_city",
			"conduit_state",
			"conduit_zip_code",
			"memo_code",
			"memo_text",
			"",
			"transaction_id_number",
			"back_reference_tran_id_number",
			"back_reference_sched_name"
		]
	},
		"^sa": {
		"^P3.2|^P3.3|^P3.4": [
			"form_type",
			"filer_committee_id_number",
			"contributor_organization_name",
			"contributor_last_name",
			"contributor_first_name",
			"contributor_middle_name",
			"contributor_prefix",
			"contributor_suffix",
			"contributor_street_1",
			"contributor_street_2",
			"contributor_city",
			"contributor_state",
			"contributor_zip_code",
			"contribution_date",
			"donor_committee_fec_id",
			"contributor_employer",
			"contributor_occupation",
			"election_code",
			"election_other_description",
			"contribution_aggregate",
			"contribution_amount",
			"memo_code",
			"memo_text_description",
			"image_number"
		],
		"^(P2.6|P3.0|P3.1)": [
			"form_type",
			"filer_committee_id_number",
			"contributor_organization_name",
			"contributor_last_name",
			"contributor_first_name",
			"contributor_middle_name",
			"contributor_prefix",
			"contributor_suffix",
			"contributor_street_1",
			"contributor_street_2",
			"contributor_city",
			"contributor_state",
			"contributor_zip_code",
			"contribution_date",
			"donor_committee_fec_id",
			"contributor_employer",
			"contributor_occupation",
			"election_code",
			"election_other_description",
			"contribution_aggregate",
			"contribution_amount",
			"memo_text_description",
			"image_number"
		],
		"^(P1|P2.2|P2.3|P2.4)": [
			"form_type",
			"filer_committee_id_number",
			"contributor_organization_name",
			"contributor_last_name",
			"contributor_first_name",
			"contributor_middle_name",
			"contributor_prefix",
			"contributor_suffix",
			"contributor_street_1",
			"contributor_street_2",
			"contributor_city",
			"contributor_state",
			"contributor_zip_code",
			"contribution_date",
			"donor_committee_fec_id",
			"contributor_employer",
			"contributor_occupation",
			"election_code",
			"election_other_description",
			"contribution_aggregate",
			"contribution_amount",
			"memo_text_description",
			"increased_limit_code",
			"image_number"
		],
		"^8.3|8.2|8.1|8.0": [
			"form_type",
			"filer_committee_id_number",
			"transaction_id",
			"back_reference_tran_id_number",
			"back_reference_sched_name",
			"entity_type",
			"contributor_organization_name",
			"contributor_last_name",
			"contributor_first_name",
			"contributor_middle_name",
			"contributor_prefix",
			"contributor_suffix",
			"contributor_street_1",
			"contributor_street_2",
			"contributor_city",
			"contributor_state",
			"contributor_zip_code",
			"election_code",
			"election_other_description",
			"contribution_date",
			"contribution_amount",
			"contribution_aggregate",
			"contribution_purpose_descrip",
			"contributor_employer",
			"contributor_occupation",
			"donor_committee_fec_id",
			"donor_committee_name",
			"donor_candidate_fec_id",
			"donor_candidate_last_name",
			"donor_candidate_first_name",
			"donor_candidate_middle_name",
			"donor_candidate_prefix",
			"donor_candidate_suffix",
			"donor_candidate_office",
			"donor_candidate_state",
			"donor_candidate_district",
			"conduit_name",
			"conduit_street1",
			"conduit_street2",
			"conduit_city",
			"conduit_state",
			"conduit_zip_code",
			"memo_code",
			"memo_text_description",
			"reference_code"
		],
		"^7.0|6.4": [
			"form_type",
			"filer_committee_id_number",
			"transaction_id",
			"back_reference_tran_id_number",
			"back_reference_sched_name",
			"entity_type",
			"contributor_organization_name",
			"contributor_last_name",
			"contributor_first_name",
			"contributor_middle_name",
			"contributor_prefix",
			"contributor_suffix",
			"contributor_street_1",
			"contributor_street_2",
			"contributor_city",
			"contributor_state",
			"contributor_zip_code",
			"election_code",
			"election_other_description",
			"contribution_date",
			"contribution_amount",
			"contribution_aggregate",
			"contribution_purpose_code",
			"contribution_purpose_descrip",
			"contributor_employer",
			"contributor_occupation",
			"donor_committee_fec_id",
			"donor_committee_name",
			"donor_candidate_fec_id",
			"donor_candidate_last_name",
			"donor_candidate_first_name",
			"donor_candidate_middle_name",
			"donor_candidate_prefix",
			"donor_candidate_suffix",
			"donor_candidate_office",
			"donor_candidate_state",
			"donor_candidate_district",
			"conduit_name",
			"conduit_street1",
			"conduit_street2",
			"conduit_city",
			"conduit_state",
			"conduit_zip_code",
			"memo_code",
			"memo_text_description",
			"reference_code"
		],
		"^6.3|6.2": [
			"form_type",
			"filer_committee_id_number",
			"transaction_id",
			"back_reference_tran_id_number",
			"back_reference_sched_name",
			"entity_type",
			"contributor_organization_name",
			"contributor_last_name",
			"contributor_first_name",
			"contributor_middle_name",
			"contributor_prefix",
			"contributor_suffix",
			"contributor_street_1",
			"contributor_street_2",
			"contributor_city",
			"contributor_state",
			"contributor_zip_code",
			"election_code",
			"election_other_description",
			"contribution_date",
			"contribution_amount",
			"contribution_aggregate",
			"contribution_purpose_code",
			"contribution_purpose_descrip",
			"increased_limit_code",
			"contributor_employer",
			"contributor_occupation",
			"donor_committee_fec_id",
			"donor_committee_name",
			"donor_candidate_fec_id",
			"donor_candidate_last_name",
			"donor_candidate_first_name",
			"donor_candidate_middle_name",
			"donor_candidate_prefix",
			"donor_candidate_suffix",
			"donor_candidate_office",
			"donor_candidate_state",
			"donor_candidate_district",
			"conduit_name",
			"conduit_street1",
			"conduit_street2",
			"conduit_city",
			"conduit_state",
			"conduit_zip_code",
			"memo_code",
			"memo_text_description",
			"reference_code"
		],
		"^6.1": [
			"form_type",
			"filer_committee_id_number",
			"transaction_id",
			"back_reference_tran_id_number",
			"back_reference_sched_name",
			"entity_type",
			"contributor_organization_name",
			"contributor_last_name",
			"contributor_first_name",
			"contributor_middle_name",
			"contributor_prefix",
			"contributor_suffix",
			"contributor_street_1",
			"contributor_street_2",
			"contributor_city",
			"contributor_state",
			"contributor_zip_code",
			"election_code",
			"election_other_description",
			"contribution_date",
			"contribution_amount",
			"contribution_aggregate",
			"contribution_purpose_code",
			"contribution_purpose_descrip",
			"increased_limit_code",
			"contributor_employer",
			"contributor_occupation",
			"donor_committee_fec_id",
			"donor_candidate_fec_id",
			"donor_candidate_last_name",
			"donor_candidate_first_name",
			"donor_candidate_middle_name",
			"donor_candidate_prefix",
			"donor_candidate_suffix",
			"donor_candidate_office",
			"donor_candidate_state",
			"donor_candidate_district",
			"conduit_name",
			"conduit_street1",
			"conduit_street2",
			"conduit_city",
			"conduit_state",
			"conduit_zip_code",
			"memo_code",
			"memo_text_description",
			"reference_code"
		],
		"^5.3": [
			"form_type",
			"filer_committee_id_number",
			"entity_type",
			"contributor_name",
			"contributor_street_1",
			"contributor_street_2",
			"contributor_city",
			"contributor_state",
			"contributor_zip_code",
			"election_code",
			"election_other_description",
			"contributor_employer",
			"contributor_occupation",
			"contribution_aggregate",
			"contribution_date",
			"contribution_amount",
			"contribution_purpose_code",
			"contribution_purpose_descrip",
			"donor_committee_fec_id",
			"donor_candidate_fec_id",
			"donor_candidate_name",
			"donor_candidate_office",
			"donor_candidate_state",
			"donor_candidate_district",
			"conduit_name",
			"conduit_street1",
			"conduit_street2",
			"conduit_city",
			"conduit_state",
			"conduit_zip_code",
			"memo_code",
			"memo_text_description",
			"amended_cd",
			"transaction_id",
			"back_reference_tran_id_number",
			"back_reference_sched_name",
			"reference_code",
			"increased_limit_code",
			"contributor_organization_name",
			"contributor_last_name",
			"contributor_first_name",
			"contributor_middle_name",
			"contributor_prefix",
			"contributor_suffix"
		],
		"^5.2": [
			"form_type",
			"filer_committee_id_number",
			"entity_type",
			"contributor_name",
			"contributor_street_1",
			"contributor_street_2",
			"contributor_city",
			"contributor_state",
			"contributor_zip_code",
			"election_code",
			"election_other_description",
			"contributor_employer",
			"contributor_occupation",
			"contribution_aggregate",
			"contribution_date",
			"contribution_amount",
			"contribution_purpose_code",
			"contribution_purpose_descrip",
			"donor_committee_fec_id",
			"donor_candidate_fec_id",
			"donor_candidate_name",
			"donor_candidate_office",
			"donor_candidate_state",
			"donor_candidate_district",
			"conduit_name",
			"conduit_street1",
			"conduit_street2",
			"conduit_city",
			"conduit_state",
			"conduit_zip_code",
			"memo_code",
			"memo_text_description",
			"amended_cd",
			"transaction_id",
			"back_reference_tran_id_number",
			"back_reference_sched_name",
			"reference_code",
			"increased_limit_code",
			"contributor_organization_name",
			"contributor_last_name",
			"contributor_first_name",
			"contributor_middle_name",
			"contributor_prefix",
			"contributor_suffix"
		],
		"^5.1": [
			"form_type",
			"filer_committee_id_number",
			"entity_type",
			"contributor_name",
			"contributor_street_1",
			"contributor_street_2",
			"contributor_city",
			"contributor_state",
			"contributor_zip_code",
			"election_code",
			"election_other_description",
			"contributor_employer",
			"contributor_occupation",
			"contribution_aggregate",
			"contribution_date",
			"contribution_amount",
			"contribution_purpose_code",
			"contribution_purpose_descrip",
			"donor_committee_fec_id",
			"donor_candidate_fec_id",
			"donor_candidate_name",
			"donor_candidate_office",
			"donor_candidate_state",
			"donor_candidate_district",
			"conduit_name",
			"conduit_street1",
			"conduit_street2",
			"conduit_city",
			"conduit_state",
			"conduit_zip_code",
			"memo_code",
			"memo_text_description",
			"amended_cd",
			"transaction_id",
			"back_reference_tran_id_number",
			"back_reference_sched_name",
			"reference_code",
			"increased_limit_code",
			"contributor_organization_name",
			"contributor_last_name",
			"contributor_first_name",
			"contributor_middle_name",
			"contributor_prefix",
			"contributor_suffix"
		],
		"^5.0": [
			"form_type",
			"filer_committee_id_number",
			"entity_type",
			"contributor_name",
			"contributor_street_1",
			"contributor_street_2",
			"contributor_city",
			"contributor_state",
			"contributor_zip_code",
			"election_code",
			"election_other_description",
			"contributor_employer",
			"contributor_occupation",
			"contribution_aggregate",
			"contribution_date",
			"contribution_amount",
			"contribution_purpose_code",
			"contribution_purpose_descrip",
			"donor_committee_fec_id",
			"donor_candidate_fec_id",
			"donor_candidate_name",
			"donor_candidate_office",
			"donor_candidate_state",
			"donor_candidate_district",
			"conduit_name",
			"conduit_street1",
			"conduit_street2",
			"conduit_city",
			"conduit_state",
			"conduit_zip_code",
			"memo_code",
			"memo_text_description",
			"amended_cd",
			"transaction_id",
			"back_reference_tran_id_number",
			"back_reference_sched_name",
			"reference_code",
			"increased_limit_code"
		],
		"^3|^2": [
			"form_type",
			"filer_committee_id_number",
			"entity_type",
			"contributor_name",
			"contributor_street_1",
			"contributor_street_2",
			"contributor_city",
			"contributor_state",
			"contributor_zip_code",
			"election_code",
			"election_other_description",
			"contributor_employer",
			"contributor_occupation",
			"contribution_aggregate",
			"contribution_date",
			"contribution_amount",
			"contribution_purpose_code",
			"contribution_purpose_descrip",
			"donor_committee_fec_id",
			"donor_candidate_fec_id",
			"donor_candidate_name",
			"donor_candidate_office",
			"donor_candidate_state",
			"donor_candidate_district",
			"conduit_name",
			"conduit_street1",
			"conduit_street2",
			"conduit_city",
			"conduit_state",
			"conduit_zip_code",
			"memo_code",
			"memo_text_description",
			"amended_cd",
			"transaction_id",
			"back_reference_tran_id_number",
			"back_reference_sched_name",
			"reference_code"
		],
		"^1": [
			"form_type",
			"filer_committee_id_number",
			"contributor_name",
			"contributor_street_1",
			"contributor_street_2",
			"contributor_city",
			"contributor_state",
			"contributor_zip_code",
			"election_code",
			"election_other_description",
			"contributor_employer",
			"contributor_occupation",
			"contribution_aggregate",
			"contribution_date",
			"contribution_amount",
			"contribution_purpose_code",
			"contribution_purpose_descrip",
			"donor_committee_fec_id",
			"conduit_name",
			"conduit_street1",
			"conduit_street2",
			"conduit_city",
			"conduit_state",
			"conduit_zip_code",
			"donor_candidate_fec_id",
			"donor_candidate_name",
			"donor_candidate_office",
			"donor_candidate_state",
			"donor_candidate_district",
			"memo_code",
			"memo_text_description",
			"amended_cd"
		]
	},
		"^sa3l": {
		"^8.3|8.2|8.1|8.0": [
			"form_type",
			"filer_committee_id_number",
			"transaction_id",
			"back_reference_tran_id_number",
			"back_reference_sched_name",
			"entity_type",
			"lobbyist_registrant_organization_name",
			"lobbyist_registrant_last_name",
			"lobbyist_registrant_first_name",
			"lobbyist_registrant_middle_name",
			"lobbyist_registrant_prefix",
			"lobbyist_registrant_suffix",
			"lobbyist_registrant_street_1",
			"lobbyist_registrant_street_2",
			"lobbyist_registrant_city",
			"lobbyist_registrant_state",
			"lobbyist_registrant_zip_code",
			"election_code",
			"election_other_description",
			"contribution_date",
			"bundled_amount_period",
			"bundled_amount_semi_annual",
			"contribution_purpose_descrip",
			"lobbyist_registrant_employer",
			"lobbyist_registrant_occupation",
			"donor_committee_fec_id",
			"donor_committee_name",
			"donor_candidate_fec_id",
			"donor_candidate_last_name",
			"donor_candidate_first_name",
			"donor_candidate_middle_name",
			"donor_candidate_prefix",
			"donor_candidate_suffix",
			"donor_candidate_office",
			"donor_candidate_state",
			"donor_candidate_district",
			"conduit_name",
			"conduit_street1",
			"conduit_street2",
			"conduit_city",
			"conduit_state",
			"conduit_zip_code",
			"associated_text_record",
			"memo_text",
			"reference_code"
		],
		"^7.0|6.4": [
			"form_type",
			"filer_committee_id_number",
			"transaction_id",
			"back_reference_tran_id_number",
			"back_reference_sched_name",
			"entity_type",
			"lobbyist_registrant_organization_name",
			"lobbyist_registrant_last_name",
			"lobbyist_registrant_first_name",
			"lobbyist_registrant_middle_name",
			"lobbyist_registrant_prefix",
			"lobbyist_registrant_suffix",
			"lobbyist_registrant_street_1",
			"lobbyist_registrant_street_2",
			"lobbyist_registrant_city",
			"lobbyist_registrant_state",
			"lobbyist_registrant_zip_code",
			"election_code",
			"election_other_description",
			"contribution_date",
			"bundled_amount_period",
			"bundled_amount_semi_annual",
			"contribution_purpose_code",
			"contribution_purpose_descrip",
			"lobbyist_registrant_employer",
			"lobbyist_registrant_occupation",
			"donor_committee_fec_id",
			"donor_committee_name",
			"donor_candidate_fec_id",
			"donor_candidate_last_name",
			"donor_candidate_first_name",
			"donor_candidate_middle_name",
			"donor_candidate_prefix",
			"donor_candidate_suffix",
			"donor_candidate_office",
			"donor_candidate_state",
			"donor_candidate_district",
			"conduit_name",
			"conduit_street1",
			"conduit_street2",
			"conduit_city",
			"conduit_state",
			"conduit_zip_code",
			"associated_text_record",
			"memo_text",
			"reference_code"
		]
	},
		"^sb": {
		"^P3.3|^P3.4": [
			"form_type",
			"filer_committee_id_number",
			"payee_organization_name",
			"payee_last_name",
			"payee_first_name",
			"payee_middle_name",
			"payee_prefix",
			"payee_suffix",
			"payee_street_1",
			"payee_street_2",
			"payee_city",
			"payee_state",
			"payee_zip_code",
			"expenditure_date",
			"expenditure_purpose_descrip",
			"beneficiary_committee_name",
			"beneficiary_candidate_last_name",
			"beneficiary_candidate_first_name",
			"beneficiary_candidate_middle_name",
			"beneficiary_candidate_prefix",
			"beneficiary_candidate_suffix",
			"category_code",
			"beneficiary_candidate_office",
			"beneficiary_candidate_state",
			"beneficiary_candidate_district",
			"election_code",
			"election_other_description",
			"expenditure_amount",
			"semi_annual_refunded_bundled_amt",
			"memo_code",
			"memo_text_description",
			"image_number",
			"beneficiary_committee_fec_id"
		],
		"^P3.2": [
			"form_type",
			"filer_committee_id_number",
			"payee_organization_name",
			"payee_last_name",
			"payee_first_name",
			"payee_middle_name",
			"payee_prefix",
			"payee_suffix",
			"payee_street_1",
			"payee_street_2",
			"payee_city",
			"payee_state",
			"payee_zip_code",
			"expenditure_date",
			"expenditure_purpose_descrip",
			"beneficiary_committee_name",
			"beneficiary_candidate_last_name",
			"beneficiary_candidate_first_name",
			"beneficiary_candidate_middle_name",
			"beneficiary_candidate_prefix",
			"beneficiary_candidate_suffix",
			"category_code",
			"beneficiary_candidate_office",
			"beneficiary_candidate_state",
			"beneficiary_candidate_district",
			"election_code",
			"election_other_description",
			"expenditure_amount",
			"semi_annual_refunded_bundled_amt",
			"memo_code",
			"memo_text_description",
			"image_number"
		],
		"^(P2.6|P3.0|P3.1)": [
			"form_type",
			"filer_committee_id_number",
			"payee_organization_name",
			"payee_last_name",
			"payee_first_name",
			"payee_middle_name",
			"payee_prefix",
			"payee_suffix",
			"payee_street_1",
			"payee_street_2",
			"payee_city",
			"payee_state",
			"payee_zip_code",
			"expenditure_date",
			"expenditure_purpose_descrip",
			"beneficiary_committee_name",
			"beneficiary_candidate_last_name",
			"beneficiary_candidate_first_name",
			"beneficiary_candidate_middle_name",
			"beneficiary_candidate_prefix",
			"beneficiary_candidate_suffix",
			"category_code",
			"beneficiary_candidate_office",
			"beneficiary_candidate_state",
			"beneficiary_candidate_district",
			"election_code",
			"election_other_description",
			"expenditure_amount",
			"semi_annual_refunded_bundled_amt",
			"memo_text_description",
			"image_number"
		],
		"^P2.4": [
			"form_type",
			"filer_committee_id_number",
			"payee_organization_name",
			"payee_last_name",
			"payee_first_name",
			"payee_middle_name",
			"payee_prefix",
			"payee_suffix",
			"payee_street_1",
			"payee_street_2",
			"payee_city",
			"payee_state",
			"payee_zip_code",
			"expenditure_date",
			"expenditure_purpose_descrip",
			"beneficiary_committee_name",
			"beneficiary_candidate_last_name",
			"beneficiary_candidate_first_name",
			"beneficiary_candidate_middle_name",
			"beneficiary_candidate_prefix",
			"beneficiary_candidate_suffix",
			"category_code",
			"beneficiary_candidate_office",
			"beneficiary_candidate_state",
			"beneficiary_candidate_district",
			"election_code",
			"election_other_description",
			"expenditure_amount",
			"memo_text_description",
			"refund_or_disposal_of_excess",
			"image_number"
		],
		"^(P1|P2.2|P2.3)": [
			"form_type",
			"filer_committee_id_number",
			"payee_organization_name",
			"payee_last_name",
			"payee_first_name",
			"payee_middle_name",
			"payee_prefix",
			"payee_suffix",
			"payee_street_1",
			"payee_street_2",
			"payee_city",
			"payee_state",
			"payee_zip_code",
			"expenditure_date",
			"expenditure_purpose_descrip",
			"beneficiary_candidate_last_name",
			"beneficiary_candidate_first_name",
			"beneficiary_candidate_middle_name",
			"beneficiary_candidate_prefix",
			"beneficiary_candidate_suffix",
			"category_code",
			"beneficiary_candidate_office",
			"beneficiary_candidate_state",
			"beneficiary_candidate_district",
			"election_code",
			"election_other_description",
			"expenditure_amount",
			"memo_text_description",
			"refund_or_disposal_of_excess",
			"image_number"
		],
		"^8.3|8.2|8.1|8.0": [
			"form_type",
			"filer_committee_id_number",
			"transaction_id_number",
			"back_reference_tran_id_number",
			"back_reference_sched_name",
			"entity_type",
			"payee_organization_name",
			"payee_last_name",
			"payee_first_name",
			"payee_middle_name",
			"payee_prefix",
			"payee_suffix",
			"payee_street_1",
			"payee_street_2",
			"payee_city",
			"payee_state",
			"payee_zip_code",
			"election_code",
			"election_other_description",
			"expenditure_date",
			"expenditure_amount",
			"semi_annual_refunded_bundled_amt",
			"expenditure_purpose_descrip",
			"category_code",
			"beneficiary_committee_fec_id",
			"beneficiary_committee_name",
			"beneficiary_candidate_fec_id",
			"beneficiary_candidate_last_name",
			"beneficiary_candidate_first_name",
			"beneficiary_candidate_middle_name",
			"beneficiary_candidate_prefix",
			"beneficiary_candidate_suffix",
			"beneficiary_candidate_office",
			"beneficiary_candidate_state",
			"beneficiary_candidate_district",
			"conduit_name",
			"conduit_street_1",
			"conduit_street_2",
			"conduit_city",
			"conduit_state",
			"conduit_zip_code",
			"memo_code",
			"memo_text_description",
			"reference_to_si_or_sl_system_code_that_identifies_the_account"
		],
		"^7.0|6.4": [
			"form_type",
			"filer_committee_id_number",
			"transaction_id_number",
			"back_reference_tran_id_number",
			"back_reference_sched_name",
			"entity_type",
			"payee_organization_name",
			"payee_last_name",
			"payee_first_name",
			"payee_middle_name",
			"payee_prefix",
			"payee_suffix",
			"payee_street_1",
			"payee_street_2",
			"payee_city",
			"payee_state",
			"payee_zip_code",
			"election_code",
			"election_other_description",
			"expenditure_date",
			"expenditure_amount",
			"semi_annual_refunded_bundled_amt",
			"expenditure_purpose_code",
			"expenditure_purpose_descrip",
			"category_code",
			"beneficiary_committee_fec_id",
			"beneficiary_committee_name",
			"beneficiary_candidate_fec_id",
			"beneficiary_candidate_last_name",
			"beneficiary_candidate_first_name",
			"beneficiary_candidate_middle_name",
			"beneficiary_candidate_prefix",
			"beneficiary_candidate_suffix",
			"beneficiary_candidate_office",
			"beneficiary_candidate_state",
			"beneficiary_candidate_district",
			"conduit_name",
			"conduit_street_1",
			"conduit_street_2",
			"conduit_city",
			"conduit_state",
			"conduit_zip_code",
			"memo_code",
			"memo_text_description",
			"reference_to_si_or_sl_system_code_that_identifies_the_account"
		],
		"^6.3|6.2": [
			"form_type",
			"filer_committee_id_number",
			"transaction_id_number",
			"back_reference_tran_id_number",
			"back_reference_sched_name",
			"entity_type",
			"payee_organization_name",
			"payee_last_name",
			"payee_first_name",
			"payee_middle_name",
			"payee_prefix",
			"payee_suffix",
			"payee_street_1",
			"payee_street_2",
			"payee_city",
			"payee_state",
			"payee_zip_code",
			"election_code",
			"election_other_description",
			"expenditure_date",
			"expenditure_amount",
			"expenditure_purpose_code",
			"expenditure_purpose_descrip",
			"category_code",
			"refund_or_disposal_of_excess",
			"communication_date",
			"beneficiary_committee_fec_id",
			"beneficiary_committee_name",
			"beneficiary_candidate_fec_id",
			"beneficiary_candidate_last_name",
			"beneficiary_candidate_first_name",
			"beneficiary_candidate_middle_name",
			"beneficiary_candidate_prefix",
			"beneficiary_candidate_suffix",
			"beneficiary_candidate_office",
			"beneficiary_candidate_state",
			"beneficiary_candidate_district",
			"conduit_name",
			"conduit_street_1",
			"conduit_street_2",
			"conduit_city",
			"conduit_state",
			"conduit_zip_code",
			"memo_code",
			"memo_text_description",
			"reference_to_si_or_sl_system_code_that_identifies_the_account"
		],
		"^6.1": [
			"form_type",
			"filer_committee_id_number",
			"transaction_id_number",
			"back_reference_tran_id_number",
			"back_reference_sched_name",
			"entity_type",
			"payee_organization_name",
			"payee_last_name",
			"payee_first_name",
			"payee_middle_name",
			"payee_prefix",
			"payee_suffix",
			"payee_street_1",
			"payee_street_2",
			"payee_city",
			"payee_state",
			"payee_zip_code",
			"election_code",
			"election_other_description",
			"expenditure_date",
			"expenditure_amount",
			"expenditure_purpose_code",
			"expenditure_purpose_descrip",
			"category_code",
			"refund_or_disposal_of_excess",
			"communication_date",
			"beneficiary_committee_fec_id",
			"beneficiary_candidate_fec_id",
			"beneficiary_candidate_last_name",
			"beneficiary_candidate_first_name",
			"beneficiary_candidate_middle_name",
			"beneficiary_candidate_prefix",
			"beneficiary_candidate_suffix",
			"beneficiary_candidate_office",
			"beneficiary_candidate_state",
			"beneficiary_candidate_district",
			"conduit_name",
			"conduit_street_1",
			"conduit_street_2",
			"conduit_city",
			"conduit_state",
			"conduit_zip_code",
			"memo_code",
			"memo_text_description",
			"reference_to_si_or_sl_system_code_that_identifies_the_account"
		],
		"^5.3": [
			"form_type",
			"filer_committee_id_number",
			"entity_type",
			"payee_name",
			"payee_street_1",
			"payee_street_2",
			"payee_city",
			"payee_state",
			"payee_zip_code",
			"expenditure_purpose_code",
			"expenditure_purpose_descrip",
			"election_code",
			"election_other_description",
			"expenditure_date",
			"expenditure_amount",
			"beneficiary_committee_fec_id",
			"beneficiary_candidate_fec_id",
			"beneficiary_candidate_name",
			"beneficiary_candidate_office",
			"beneficiary_candidate_state",
			"beneficiary_candidate_district",
			"conduit_name",
			"conduit_street_1",
			"conduit_street_2",
			"conduit_city",
			"conduit_state",
			"conduit_zip_code",
			"memo_code",
			"memo_text_description",
			"amended_cd",
			"transaction_id_number",
			"back_reference_tran_id_number",
			"back_reference_sched_name",
			"reference_to_si_or_sl_system_code_that_identifies_the_account",
			"refund_or_disposal_of_excess",
			"category_code",
			"communication_date",
			"payee_organization_name",
			"payee_last_name",
			"payee_first_name",
			"payee_middle_name",
			"payee_prefix",
			"payee_suffix"
		],
		"^5.2|5.1": [
			"form_type",
			"filer_committee_id_number",
			"entity_type",
			"payee_name",
			"payee_street_1",
			"payee_street_2",
			"payee_city",
			"payee_state",
			"payee_zip_code",
			"expenditure_purpose_code",
			"expenditure_purpose_descrip",
			"election_code",
			"election_other_description",
			"expenditure_date",
			"expenditure_amount",
			"beneficiary_committee_fec_id",
			"beneficiary_candidate_fec_id",
			"beneficiary_candidate_name",
			"beneficiary_candidate_office",
			"beneficiary_candidate_state",
			"beneficiary_candidate_district",
			"conduit_name",
			"conduit_street_1",
			"conduit_street_2",
			"conduit_city",
			"conduit_state",
			"conduit_zip_code",
			"memo_code",
			"memo_text_description",
			"amended_cd",
			"transaction_id_number",
			"back_reference_tran_id_number",
			"back_reference_sched_name",
			"reference_to_si_or_sl_system_code_that_identifies_the_account",
			"refund_or_disposal_of_excess",
			"category_code",
			"communication_date",
			"payee_organization_name",
			"payee_last_name",
			"payee_first_name",
			"payee_middle_name",
			"payee_prefix",
			"payee_suffix"
		],
		"^5.0": [
			"form_type",
			"filer_committee_id_number",
			"entity_type",
			"payee_name",
			"payee_street_1",
			"payee_street_2",
			"payee_city",
			"payee_state",
			"payee_zip_code",
			"expenditure_purpose_code",
			"expenditure_purpose_descrip",
			"election_code",
			"election_other_description",
			"expenditure_date",
			"expenditure_amount",
			"beneficiary_committee_fec_id",
			"beneficiary_candidate_fec_id",
			"beneficiary_candidate_name",
			"beneficiary_candidate_office",
			"beneficiary_candidate_state",
			"beneficiary_candidate_district",
			"conduit_name",
			"conduit_street_1",
			"conduit_street_2",
			"conduit_city",
			"conduit_state",
			"conduit_zip_code",
			"memo_code",
			"memo_text_description",
			"amended_cd",
			"transaction_id_number",
			"back_reference_tran_id_number",
			"back_reference_sched_name",
			"reference_to_si_or_sl_system_code_that_identifies_the_account",
			"refund_or_disposal_of_excess",
			"category_code",
			"communication_date"
		],
		"^3|^2": [
			"form_type",
			"filer_committee_id_number",
			"entity_type",
			"payee_name",
			"payee_street_1",
			"payee_street_2",
			"payee_city",
			"payee_state",
			"payee_zip_code",
			"expenditure_purpose_code",
			"expenditure_purpose_descrip",
			"election_code",
			"election_other_description",
			"expenditure_date",
			"expenditure_amount",
			"beneficiary_committee_fec_id",
			"beneficiary_candidate_fec_id",
			"beneficiary_candidate_name",
			"beneficiary_candidate_office",
			"beneficiary_candidate_state",
			"beneficiary_candidate_district",
			"conduit_name",
			"conduit_street_1",
			"conduit_street_2",
			"conduit_city",
			"conduit_state",
			"conduit_zip_code",
			"memo_code",
			"memo_text_description",
			"amended_cd",
			"transaction_id_number",
			"back_reference_tran_id_number",
			"back_reference_sched_name",
			"reference_to_si_or_sl_system_code_that_identifies_the_account"
		],
		"^1": [
			"form_type",
			"filer_committee_id_number",
			"payee_name",
			"payee_street_1",
			"payee_street_2",
			"payee_city",
			"payee_state",
			"payee_zip_code",
			"expenditure_purpose_code",
			"expenditure_purpose_descrip",
			"election_code",
			"election_other_description",
			"expenditure_date",
			"expenditure_amount",
			"beneficiary_committee_fec_id",
			"conduit_name",
			"conduit_street_1",
			"conduit_street_2",
			"conduit_city",
			"conduit_state",
			"conduit_zip_code",
			"beneficiary_candidate_fec_id",
			"beneficiary_candidate_name",
			"beneficiary_candidate_office",
			"beneficiary_candidate_state",
			"beneficiary_candidate_district",
			"memo_code",
			"memo_text_description",
			"amended_cd"
		]
	},
		"^sc[^1-2]": {
		"^P3.4|^P3.3|^P3.2": [
			"form_type",
			"filer_committee_id_number",
			"receipt_line_number",
			"lender_organization_name",
			"lender_last_name",
			"lender_first_name",
			"lender_middle_name",
			"lender_prefix",
			"lender_suffix",
			"lender_street_1",
			"lender_street_2",
			"lender_city",
			"lender_state",
			"lender_zip_code",
			"election_code",
			"election_other_description",
			"loan_amount_original",
			"loan_payment_to_date",
			"loan_balance",
			"loan_incurred_date_terms",
			"loan_due_date_terms",
			"loan_interest_rate_terms",
			"secured",
			"memo_code",
			"memo_text_description",
			"image_number"
		],
		"^P3.1|^P3.0|^P2.6|^P2.4": [
			"form_type",
			"filer_committee_id_number",
			"receipt_line_number",
			"lender_organization_name",
			"lender_last_name",
			"lender_first_name",
			"lender_middle_name",
			"lender_prefix",
			"lender_suffix",
			"lender_street_1",
			"lender_street_2",
			"lender_city",
			"lender_state",
			"lender_zip_code",
			"election_code",
			"election_other_description",
			"loan_amount_original",
			"loan_payment_to_date",
			"loan_balance",
			"loan_incurred_date_terms",
			"loan_due_date_terms",
			"loan_interest_rate_terms",
			"secured",
			"memo_text_description",
			"image_number"
		],
		"^P2.3|^P2.2|^P1": [
			"form_type",
			"filer_committee_id_number",
			"receipt_line_number",
			"lender_organization_name",
			"lender_last_name",
			"lender_first_name",
			"lender_middle_name",
			"lender_prefix",
			"lender_suffix",
			"lender_street_1",
			"lender_street_2",
			"lender_city",
			"lender_state",
			"lender_zip_code",
			"election_code",
			"election_other_description",
			"loan_amount_original",
			"loan_payment_to_date",
			"loan_balance",
			"loan_incurred_date_terms",
			"loan_due_date_terms",
			"loan_interest_rate_terms",
			"secured",
			"image_number"
		],
		"^8.3|8.2|8.1|8.0|7.0|6.4|6.3|6.2": [
			"form_type",
			"filer_committee_id_number",
			"transaction_id_number",
			"receipt_line_number",
			"entity_type",
			"lender_organization_name",
			"lender_last_name",
			"lender_first_name",
			"lender_middle_name",
			"lender_prefix",
			"lender_suffix",
			"lender_street_1",
			"lender_street_2",
			"lender_city",
			"lender_state",
			"lender_zip_code",
			"election_code",
			"election_other_description",
			"loan_amount_original",
			"loan_payment_to_date",
			"loan_balance",
			"loan_incurred_date_terms",
			"loan_due_date_terms",
			"loan_interest_rate_terms",
			"secured",
			"personal_funds",
			"lender_committee_id_number",
			"lender_candidate_id_number",
			"lender_candidate_last_name",
			"lender_candidate_first_name",
			"lender_candidate_middle_nm",
			"lender_candidate_prefix",
			"lender_candidate_suffix",
			"lender_candidate_office",
			"lender_candidate_state",
			"lender_candidate_district",
			"memo_code",
			"memo_text_description"
		],
		"^6.1": [
			"form_type",
			"filer_committee_id_number",
			"transaction_id_number",
			"receipt_line_number",
			"entity_type",
			"lender_organization_name",
			"lender_last_name",
			"lender_first_name",
			"lender_middle_name",
			"lender_prefix",
			"lender_suffix",
			"lender_street_1",
			"lender_street_2",
			"lender_city",
			"lender_state",
			"lender_zip_code",
			"election_code",
			"election_other_description",
			"loan_amount_original",
			"loan_payment_to_date",
			"loan_balance",
			"loan_incurred_date_terms",
			"loan_due_date_terms",
			"loan_interest_rate_terms",
			"secured",
			"lender_committee_id_number",
			"lender_candidate_id_number",
			"lender_candidate_last_name",
			"lender_candidate_first_name",
			"lender_candidate_middle_nm",
			"lender_candidate_prefix",
			"lender_candidate_suffix",
			"lender_candidate_office",
			"lender_candidate_state",
			"lender_candidate_district"
		],
		"^5.3": [
			"form_type",
			"filer_committee_id_number",
			"entity_type",
			"lender_name",
			"lender_street_1",
			"lender_street_2",
			"lender_city",
			"lender_state",
			"lender_zip_code",
			"election_code",
			"election_other_description",
			"loan_amount_original",
			"loan_payment_to_date",
			"loan_balance",
			"loan_incurred_date_terms",
			"loan_due_date_terms",
			"loan_interest_rate_terms",
			"secured",
			"lender_committee_id_number",
			"lender_candidate_id_number",
			"lender_candidate_name",
			"lender_candidate_office",
			"lender_candidate_state",
			"lender_candidate_district",
			"amended_cd",
			"transaction_id_number",
			"receipt_line_number"
		],
		"^5.2|5.1": [
			"form_type",
			"filer_committee_id_number",
			"entity_type",
			"lender_name",
			"lender_street_1",
			"lender_street_2",
			"lender_city",
			"lender_state",
			"lender_zip_code",
			"election_code",
			"election_other_description",
			"loan_amount_original",
			"loan_payment_to_date",
			"loan_balance",
			"loan_incurred_date_terms",
			"loan_due_date_terms",
			"loan_interest_rate_terms",
			"secured",
			"lender_committee_id_number",
			"lender_candidate_id_number",
			"lender_candidate_name",
			"lender_candidate_office",
			"lender_candidate_state",
			"lender_candidate_district",
			"amended_cd",
			"transaction_id_number",
			"receipt_line_number"
		],
		"^5.0|^3|^2|^1": [
			"form_type",
			"filer_committee_id_number",
			"entity_type",
			"lender_name",
			"lender_street_1",
			"lender_street_2",
			"lender_city",
			"lender_state",
			"lender_zip_code",
			"election_code",
			"election_other_description",
			"loan_amount_original",
			"loan_payment_to_date",
			"loan_balance",
			"loan_incurred_date_terms",
			"loan_due_date_terms",
			"loan_interest_rate_terms",
			"secured",
			"lender_committee_id_number",
			"lender_candidate_id_number",
			"lender_candidate_name",
			"lender_candidate_office",
			"lender_candidate_state",
			"lender_candidate_district",
			"amended_cd",
			"transaction_id_number"
		]
	},
		"^sc1": {
		"^(P3.4|P3.3|P3.2)": [
			"form_type",
			"filer_committee_id_number",
			"lender_organization_name",
			"lender_street_1",
			"lender_street_2",
			"lender_city",
			"lender_state",
			"lender_zip_code",
			"loan_amount",
			"loan_interest_rate",
			"loan_incurred_date",
			"loan_due_date",
			"loan_restructured",
			"loan_inccured_date_original",
			"credit_amount_this_draw",
			"total_balance",
			"others_liable",
			"collateral",
			"description",
			"collateral_value_amount",
			"perfected_interest",
			"future_income",
			"description",
			"estimated_value",
			"established_date",
			"account_location_name",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"f_basis_of_loan_description",
			"treasurer_last_name",
			"treasurer_first_name",
			"treasurer_middle_name",
			"treasurer_prefix",
			"treasurer_suffix",
			"date_signed",
			"authorized_last_name",
			"authorized_first_name",
			"authorized_middle_name",
			"authorized_prefix",
			"authorized_suffix",
			"authorized_title",
			"authorized_date",
			"deposit_acct_auth_date_presidential",
			"image_number"
		],
		"^(P1|P2|P3.0|P3.1)": [
			"form_type",
			"filer_committee_id_number",
			"lender_organization_name",
			"lender_street_1",
			"lender_street_2",
			"lender_city",
			"lender_state",
			"lender_zip_code",
			"loan_amount",
			"loan_interest_rate",
			"loan_incurred_date",
			"loan_due_date",
			"loan_restructured",
			"loan_inccured_date_original",
			"credit_amount_this_draw",
			"total_balance",
			"others_liable",
			"collateral",
			"description",
			"collateral_value_amount",
			"perfected_interest",
			"future_income",
			"description",
			"estimated_value",
			"established_date",
			"account_location_name",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"f_basis_of_loan_description",
			"treasurer_last_name",
			"treasurer_first_name",
			"treasurer_middle_name",
			"treasurer_prefix",
			"treasurer_suffix",
			"date_signed",
			"authorized_last_name",
			"authorized_first_name",
			"authorized_middle_name",
			"authorized_prefix",
			"authorized_suffix",
			"authorized_title",
			"authorized_date",
			"image_number"
		],
		"^8.3|8.2|8.1|8.0|7.0|6.4|6.3|6.2|6.1": [
			"form_type",
			"filer_committee_id_number",
			"transaction_id_number",
			"back_reference_tran_id_number",
			"lender_organization_name",
			"lender_street_1",
			"lender_street_2",
			"lender_city",
			"lender_state",
			"lender_zip_code",
			"loan_amount",
			"loan_interest_rate",
			"loan_incurred_date",
			"loan_due_date",
			"loan_restructured",
			"loan_inccured_date_original",
			"credit_amount_this_draw",
			"total_balance",
			"others_liable",
			"collateral",
			"description",
			"collateral_value_amount",
			"perfected_interest",
			"future_income",
			"description",
			"estimated_value",
			"established_date",
			"account_location_name",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"deposit_acct_auth_date_presidential",
			"f_basis_of_loan_description",
			"treasurer_last_name",
			"treasurer_first_name",
			"treasurer_middle_name",
			"treasurer_prefix",
			"treasurer_suffix",
			"date_signed",
			"authorized_last_name",
			"authorized_first_name",
			"authorized_middle_name",
			"authorized_prefix",
			"authorized_suffix",
			"authorized_title",
			"authorized_date"
		],
		"^5.3": [
			"form_type",
			"filer_committee_id_number",
			"back_reference_tran_id_number",
			"entity_type",
			"lender_organization_name",
			"lender_street_1",
			"lender_street_2",
			"lender_city",
			"lender_state",
			"lender_zip_code",
			"loan_amount",
			"loan_interest_rate",
			"loan_incurred_date",
			"loan_due_date",
			"loan_restructured",
			"loan_inccured_date_original",
			"credit_amount_this_draw",
			"total_balance",
			"others_liable",
			"collateral",
			"description",
			"collateral_value_amount",
			"perfected_interest",
			"future_income",
			"description",
			"estimated_value",
			"established_date",
			"account_location_name",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"deposit_acct_auth_date_presidential",
			"f_basis_of_loan_description",
			"treasurer_name",
			"date_signed",
			"authorized_name",
			"authorized_title",
			"authorized_date"
		],
		"^5.2|5.1|5.0": [
			"form_type",
			"filer_committee_id_number",
			"back_reference_tran_id_number",
			"entity_type",
			"lender_organization_name",
			"lender_street_1",
			"lender_street_2",
			"lender_city",
			"lender_state",
			"lender_zip_code",
			"loan_amount",
			"loan_interest_rate",
			"loan_incurred_date",
			"loan_due_date",
			"loan_restructured",
			"loan_inccured_date_original",
			"credit_amount_this_draw",
			"total_balance",
			"others_liable",
			"collateral",
			"description",
			"collateral_value_amount",
			"perfected_interest",
			"future_income",
			"description",
			"estimated_value",
			"established_date",
			"account_location_name",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"deposit_acct_auth_date_presidential",
			"f_basis_of_loan_description",
			"treasurer_name",
			"date_signed",
			"authorized_name",
			"authorized_title",
			"authorized_date"
		],
		"^3": [
			"form_type",
			"filer_committee_id_number",
			"back_reference_tran_id_number",
			"entity_type",
			"lender_organization_name",
			"lender_street_1",
			"lender_street_2",
			"lender_city",
			"lender_state",
			"lender_zip_code",
			"loan_amount",
			"loan_interest_rate",
			"loan_incurred_date",
			"loan_due_date",
			"loan_restructured",
			"loan_inccured_date_original",
			"credit_amount_this_draw",
			"total_balance",
			"others_liable",
			"collateral",
			"description",
			"collateral_value_amount",
			"perfected_interest",
			"future_income",
			"description",
			"estimated_value",
			"established_date",
			"account_location_name",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"deposit_acct_auth_date_presidential",
			"f_basis_of_loan_description",
			"treasurer_name",
			"date_signed",
			"authorized_name",
			"authorized_title",
			"authorized_date"
		],
		"^2": [
			"form_type",
			"filer_committee_id_number",
			"back_reference_tran_id_number",
			"entity_type",
			"lender_organization_name",
			"lender_street_1",
			"lender_street_2",
			"lender_city",
			"lender_state",
			"lender_zip_code",
			"loan_amount",
			"loan_interest_rate",
			"loan_incurred_date",
			"loan_due_date",
			"loan_restructured",
			"loan_inccured_date_original",
			"credit_amount_this_draw",
			"total_balance",
			"others_liable",
			"collateral",
			"description",
			"collateral_value_amount",
			"perfected_interest",
			"future_income",
			"description",
			"estimated_value",
			"established_date",
			"account_location_name",
			"street_1",
			"street_2",
			"city",
			"state",
			"zip_code",
			"deposit_acct_auth_date_presidential",
			"f_basis_of_loan_description",
			"treasurer_name",
			"date_signed",
			"authorized_name",
			"authorized_title"
		]
	},
		"^sc2": {
		"^(P1|P2|P3)": [
			"form_type",
			"filer_committee_id_number",
			"guarantor_last_name",
			"guarantor_first_name",
			"guarantor_middle_name",
			"guarantor_prefix",
			"guarantor_suffix",
			"guarantor_street_1",
			"guarantor_street_2",
			"guarantor_city",
			"guarantor_state",
			"guarantor_zip_code",
			"guarantor_employer",
			"guarantor_occupation",
			"guaranteed_amount",
			"image_number"
		],
		"^8.3|8.2|8.1|8.0|7.0|6.4|6.3|6.2|6.1": [
			"form_type",
			"filer_committee_id_number",
			"transaction_id_number",
			"back_reference_tran_id_number",
			"guarantor_last_name",
			"guarantor_first_name",
			"guarantor_middle_name",
			"guarantor_prefix",
			"guarantor_suffix",
			"guarantor_street_1",
			"guarantor_street_2",
			"guarantor_city",
			"guarantor_state",
			"guarantor_zip_code",
			"guarantor_employer",
			"guarantor_occupation",
			"guaranteed_amount"
		],
		"^5.3": [
			"form_type",
			"filer_committee_id_number",
			"back_reference_tran_id_number",
			"guarantor_name",
			"guarantor_street_1",
			"guarantor_street_2",
			"guarantor_city",
			"guarantor_state",
			"guarantor_zip_code",
			"guarantor_employer",
			"guarantor_occupation",
			"guaranteed_amount"
		],
		"^5.2|5.1|5.0": [
			"form_type",
			"filer_committee_id_number",
			"back_reference_tran_id_number",
			"guarantor_name",
			"guarantor_street_1",
			"guarantor_street_2",
			"guarantor_city",
			"guarantor_state",
			"guarantor_zip_code",
			"guarantor_employer",
			"guarantor_occupation",
			"guaranteed_amount"
		],
		"^3|^2": [
			"form_type",
			"filer_committee_id_number",
			"back_reference_tran_id_number",
			"guarantor_name",
			"guarantor_street_1",
			"guarantor_street_2",
			"guarantor_city",
			"guarantor_state",
			"guarantor_zip_code",
			"guarantor_employer",
			"guarantor_occupation",
			"guaranteed_amount"
		]
	},
		"^sd": {
		"^P3|^P2|^P1": [
			"form_type",
			"filer_committee_id_number",
			"creditor_organization_name",
			"creditor_last_name",
			"creditor_first_name",
			"creditor_middle_name",
			"creditor_prefix",
			"creditor_suffix",
			"creditor_street_1",
			"creditor_street_2",
			"creditor_city",
			"creditor_state",
			"creditor_zip_code",
			"purpose_of_debt_or_obligation",
			"beginning_balance_this_period",
			"incurred_amount_this_period",
			"payment_amount_this_period",
			"balance_at_close_this_period",
			"image_number"
		],
		"^8.3|8.2|8.1|8.0|7.0|6.4|6.3|6.2|6.1": [
			"form_type",
			"filer_committee_id_number",
			"transaction_id_number",
			"entity_type",
			"creditor_organization_name",
			"creditor_last_name",
			"creditor_first_name",
			"creditor_middle_name",
			"creditor_prefix",
			"creditor_suffix",
			"creditor_street_1",
			"creditor_street_2",
			"creditor_city",
			"creditor_state",
			"creditor_zip_code",
			"purpose_of_debt_or_obligation",
			"beginning_balance_this_period",
			"incurred_amount_this_period",
			"payment_amount_this_period",
			"balance_at_close_this_period"
		],
		"^5.3": [
			"form_type",
			"filer_committee_id_number",
			"entity_type",
			"creditor_name",
			"creditor_street_1",
			"creditor_street_2",
			"creditor_city",
			"creditor_state",
			"creditor_zip_code",
			"purpose_of_debt_or_obligation",
			"beginning_balance_this_period",
			"incurred_amount_this_period",
			"payment_amount_this_period",
			"balance_at_close_this_period",
			"fec_committee_id_number",
			"fec_candidate_id_number",
			"candidate_name",
			"candidate_office",
			"candidate_state",
			"candidate_district",
			"conduit_name",
			"conduit_street_1",
			"conduit_street_2",
			"conduit_city",
			"conduit_state",
			"conduit_zip_code",
			"amended_cd",
			"transaction_id_number"
		],
		"^5.2|5.1|5.0|^3|^2": [
			"form_type",
			"filer_committee_id_number",
			"entity_type",
			"creditor_name",
			"creditor_street_1",
			"creditor_street_2",
			"creditor_city",
			"creditor_state",
			"creditor_zip_code",
			"purpose_of_debt_or_obligation",
			"beginning_balance_this_period",
			"incurred_amount_this_period",
			"payment_amount_this_period",
			"balance_at_close_this_period",
			"fec_committee_id_number",
			"fec_candidate_id_number",
			"candidate_name",
			"candidate_office",
			"candidate_state",
			"candidate_district",
			"conduit_name",
			"conduit_street_1",
			"conduit_street_2",
			"conduit_city",
			"conduit_state",
			"conduit_zip_code",
			"amended_cd",
			"transaction_id_number"
		],
		"^1": [
			"form_type",
			"filer_committee_id_number",
			"creditor_name",
			"creditor_street_1",
			"creditor_street_2",
			"creditor_city",
			"creditor_state",
			"creditor_zip_code",
			"purpose_of_debt_or_obligation",
			"beginning_balance_this_period",
			"incurred_amount_this_period",
			"payment_amount_this_period",
			"balance_at_close_this_period",
			"amended_cd"
		]
	},
		"^se": {
		"^(P3.4|P3.3|P3.2)": [
			"form_type",
			"filer_committee_id_number",
			"payee_organization_name",
			"payee_last_name",
			"payee_first_name",
			"payee_middle_name",
			"payee_prefix",
			"payee_suffix",
			"payee_street_1",
			"payee_street_2",
			"payee_city",
			"payee_state",
			"payee_zip_code",
			"dissemination_date",
			"expenditure_amount",
			"disbursement_date",
			"expenditure_purpose_descrip",
			"category_code",
			"candidate_last_name",
			"candidate_first_name",
			"candidate_middle_name",
			"candidate_prefix",
			"candidate_suffix",
			"candidate_office",
			"candidate_district",
			"candidate_state",
			"support_oppose_code",
			"calendar_y_t_d_per_election_office",
			"election_code",
			"election_other_description",
			"completing_last_name",
			"completing_first_name",
			"completing_middle_name",
			"completing_prefix",
			"completing_suffix",
			"date_signed",
			"memo_code",
			"memo_text_description",
			"image_number"
		],
		"^P3.1": [
			"form_type",
			"filer_committee_id_number",
			"payee_organization_name",
			"payee_last_name",
			"payee_first_name",
			"payee_middle_name",
			"payee_prefix",
			"payee_suffix",
			"payee_street_1",
			"payee_street_2",
			"payee_city",
			"payee_state",
			"payee_zip_code",
			"dissemination_date",
			"expenditure_amount",
			"disbursement_date",
			"expenditure_purpose_descrip",
			"category_code",
			"candidate_last_name",
			"candidate_first_name",
			"candidate_middle_name",
			"candidate_prefix",
			"candidate_suffix",
			"candidate_office",
			"candidate_district",
			"candidate_state",
			"support_oppose_code",
			"calendar_y_t_d_per_election_office",
			"election_code",
			"election_other_description",
			"completing_last_name",
			"completing_first_name",
			"completing_middle_name",
			"completing_prefix",
			"completing_suffix",
			"date_signed",
			"image_number"
		],
		"^(P1|P2|P3.0)": [
			"form_type",
			"filer_committee_id_number",
			"payee_organization_name",
			"payee_last_name",
			"payee_first_name",
			"payee_middle_name",
			"payee_prefix",
			"payee_suffix",
			"payee_street_1",
			"payee_street_2",
			"payee_city",
			"payee_state",
			"payee_zip_code",
			"dissemination_date",
			"expenditure_amount",
			"expenditure_purpose_descrip",
			"category_code",
			"candidate_last_name",
			"candidate_first_name",
			"candidate_middle_name",
			"candidate_prefix",
			"candidate_suffix",
			"candidate_office",
			"candidate_district",
			"candidate_state",
			"support_oppose_code",
			"calendar_y_t_d_per_election_office",
			"election_code",
			"election_other_description",
			"completing_last_name",
			"completing_first_name",
			"completing_middle_name",
			"completing_prefix",
			"completing_suffix",
			"date_signed",
			"image_number"
		],
		"^8.3|8.2|8.1": [
			"form_type",
			"filer_committee_id_number",
			"transaction_id_number",
			"back_reference_tran_id_number",
			"back_reference_sched_name",
			"entity_type",
			"payee_organization_name",
			"payee_last_name",
			"payee_first_name",
			"payee_middle_name",
			"payee_prefix",
			"payee_suffix",
			"payee_street_1",
			"payee_street_2",
			"payee_city",
			"payee_state",
			"payee_zip_code",
			"election_code",
			"election_other_description",
			"dissemination_date",
			"expenditure_amount",
			"disbursement_date",
			"calendar_y_t_d_per_election_office",
			"expenditure_purpose_descrip",
			"category_code",
			"payee_cmtte_fec_id_number",
			"support_oppose_code",
			"candidate_id_number",
			"candidate_last_name",
			"candidate_first_name",
			"candidate_middle_name",
			"candidate_prefix",
			"candidate_suffix",
			"candidate_office",
			"candidate_district",
			"candidate_state",
			"completing_last_name",
			"completing_first_name",
			"completing_middle_name",
			"completing_prefix",
			"completing_suffix",
			"date_signed",
			"memo_code",
			"memo_text_description"
		],
		"^8.0": [
			"form_type",
			"filer_committee_id_number",
			"transaction_id_number",
			"back_reference_tran_id_number",
			"back_reference_sched_name",
			"entity_type",
			"payee_organization_name",
			"payee_last_name",
			"payee_first_name",
			"payee_middle_name",
			"payee_prefix",
			"payee_suffix",
			"payee_street_1",
			"payee_street_2",
			"payee_city",
			"payee_state",
			"payee_zip_code",
			"election_code",
			"election_other_description",
			"dissemination_date",
			"expenditure_amount",
			"calendar_y_t_d_per_election_office",
			"expenditure_purpose_descrip",
			"category_code",
			"payee_cmtte_fec_id_number",
			"support_oppose_code",
			"candidate_id_number",
			"candidate_last_name",
			"candidate_first_name",
			"candidate_middle_name",
			"candidate_prefix",
			"candidate_suffix",
			"candidate_office",
			"candidate_state",
			"candidate_district",
			"completing_last_name",
			"completing_first_name",
			"completing_middle_name",
			"completing_prefix",
			"completing_suffix",
			"date_signed",
			"memo_code",
			"memo_text_description"
		],
		"^7.0|6.4|6.3|6.2|6.1": [
			"form_type",
			"filer_committee_id_number",
			"transaction_id_number",
			"back_reference_tran_id_number",
			"back_reference_sched_name",
			"entity_type",
			"payee_organization_name",
			"payee_last_name",
			"payee_first_name",
			"payee_middle_name",
			"payee_prefix",
			"payee_suffix",
			"payee_street_1",
			"payee_street_2",
			"payee_city",
			"payee_state",
			"payee_zip_code",
			"election_code",
			"election_other_description",
			"dissemination_date",
			"expenditure_amount",
			"calendar_y_t_d_per_election_office",
			"expenditure_purpose_code",
			"expenditure_purpose_descrip",
			"category_code",
			"payee_cmtte_fec_id_number",
			"support_oppose_code",
			"candidate_id_number",
			"candidate_last_name",
			"candidate_first_name",
			"candidate_middle_name",
			"candidate_prefix",
			"candidate_suffix",
			"candidate_office",
			"candidate_state",
			"candidate_district",
			"completing_last_name",
			"completing_first_name",
			"completing_middle_name",
			"completing_prefix",
			"completing_suffix",
			"date_signed",
			"memo_code",
			"memo_text_description"
		],
		"^5.3": [
			"form_type",
			"filer_committee_id_number",
			"entity_type",
			"payee_name",
			"payee_street_1",
			"payee_street_2",
			"payee_city",
			"payee_state",
			"payee_zip_code",
			"expenditure_purpose_descrip",
			"dissemination_date",
			"expenditure_amount",
			"support_oppose_code",
			"candidate_id_number",
			"candidate_name",
			"candidate_office",
			"candidate_state",
			"candidate_district",
			"payee_cmtte_fec_id_number",
			"",
			"",
			"",
			"",
			"",
			"conduit_name",
			"conduit_street_1",
			"conduit_street_2",
			"conduit_city",
			"conduit_state",
			"conduit_zip_code",
			"ind_name_as_signed",
			"date_signed",
			"date_notarized",
			"date_notary_commission_expires",
			"ind_name_notary",
			"",
			"transaction_id_number",
			"memo_code",
			"memo_text_description",
			"back_reference_tran_id_number",
			"back_reference_sched_name",
			"election_code",
			"election_other_description",
			"category_code",
			"expenditure_purpose_code",
			"calendar_y_t_d_per_election_office"
		],
		"^5.2|5.1|5.0": [
			"form_type",
			"filer_committee_id_number",
			"entity_type",
			"payee_name",
			"payee_street_1",
			"payee_street_2",
			"payee_city",
			"payee_state",
			"payee_zip_code",
			"expenditure_purpose_descrip",
			"dissemination_date",
			"expenditure_amount",
			"support_oppose_code",
			"candidate_id_number",
			"candidate_name",
			"candidate_office",
			"candidate_state",
			"candidate_district",
			"payee_cmtte_fec_id_number",
			"",
			"",
			"",
			"",
			"",
			"conduit_name",
			"conduit_street_1",
			"conduit_street_2",
			"conduit_city",
			"conduit_state",
			"conduit_zip_code",
			"ind_name_as_signed",
			"date_signed",
			"date_notarized",
			"date_notary_commission_expires",
			"ind_name_notary",
			"",
			"transaction_id_number",
			"memo_code",
			"memo_text_description",
			"back_reference_tran_id_number",
			"back_reference_sched_name",
			"election_code",
			"election_other_description",
			"category_code",
			"expenditure_purpose_code",
			"calendar_y_t_d_per_election_office"
		],
		"^3": [
			"form_type",
			"filer_committee_id_number",
			"entity_type",
			"payee_name",
			"payee_street_1",
			"payee_street_2",
			"payee_city",
			"payee_state",
			"payee_zip_code",
			"expenditure_purpose_descrip",
			"dissemination_date",
			"expenditure_amount",
			"support_oppose_code",
			"candidate_id_number",
			"candidate_name",
			"candidate_office",
			"candidate_state",
			"candidate_district",
			"payee_cmtte_fec_id_number",
			"",
			"",
			"",
			"",
			"",
			"conduit_name",
			"conduit_street_1",
			"conduit_street_2",
			"conduit_city",
			"conduit_state",
			"conduit_zip_code",
			"ind_name_as_signed",
			"date_signed",
			"date_notarized",
			"date_notary_commission_expires",
			"ind_name_notary",
			"",
			"transaction_id_number",
			"memo_code",
			"memo_text_description",
			"back_reference_tran_id_number",
			"back_reference_sched_name"
		],
		"^2": [
			"form_type",
			"filer_committee_id_number",
			"entity_type",
			"payee_name",
			"payee_street_1",
			"payee_street_2",
			"payee_city",
			"payee_state",
			"payee_zip_code",
			"expenditure_purpose_descrip",
			"dissemination_date",
			"expenditure_amount",
			"support_oppose_code",
			"candidate_id_number",
			"candidate_name",
			"candidate_office",
			"candidate_state",
			"candidate_district",
			"payee_cmtte_fec_id_number",
			"",
			"",
			"",
			"",
			"",
			"conduit_name",
			"conduit_street_1",
			"conduit_street_2",
			"conduit_city",
			"conduit_state",
			"conduit_zip_code",
			"ind_name_as_signed",
			"date_signed",
			"date_notarized",
			"date_notary_commission_expires",
			"ind_name_notary",
			"amended_cd",
			"transaction_id_number",
			"back_reference_tran_id_number",
			"back_reference_sched_name"
		],
		"^1": [
			"form_type",
			"filer_committee_id_number",
			"payee_name",
			"payee_street_1",
			"payee_street_2",
			"payee_city",
			"payee_state",
			"payee_zip_code",
			"expenditure_purpose_descrip",
			"dissemination_date",
			"expenditure_amount",
			"candidate_id_number",
			"candidate_name",
			"candidate_office",
			"candidate_state",
			"candidate_district",
			"support_oppose_code",
			"ind_name_as_signed",
			"date_signed",
			"date_notarized",
			"date_notary_commission_expires",
			"ind_name_notary",
			"amended_cd"
		]
	},
		"^sf": {
		"^(P3.4|P3.3|P3.2)": [
			"form_type",
			"filer_committee_id_number",
			"coordinated_expenditures",
			"designating_committee_name",
			"subordinate_committee_name",
			"subordinate_street_1",
			"subordinate_street_2",
			"subordinate_city",
			"subordinate_state",
			"subordinate_zip_code",
			"payee_organization_name",
			"payee_last_name",
			"payee_first_name",
			"payee_middle_name",
			"payee_prefix",
			"payee_suffix",
			"payee_street_1",
			"payee_street_2",
			"payee_city",
			"payee_state",
			"payee_zip_code",
			"expenditure_purpose_descrip",
			"category_code",
			"expenditure_date",
			"payee_candidate_last_name",
			"payee_candidate_first_name",
			"payee_candidate_middle_name",
			"payee_candidate_prefix",
			"payee_candidate_suffix",
			"payee_candidate_office",
			"payee_candidate_state",
			"payee_candidate_district",
			"aggregate_general_elec_expended",
			"expenditure_amount",
			"memo_code",
			"memo_text_description",
			"image_number"
		],
		"^(P2.6|P3.0|P3.1)": [
			"form_type",
			"filer_committee_id_number",
			"coordinated_expenditures",
			"designating_committee_name",
			"subordinate_committee_name",
			"subordinate_street_1",
			"subordinate_street_2",
			"subordinate_city",
			"subordinate_state",
			"subordinate_zip_code",
			"payee_organization_name",
			"payee_last_name",
			"payee_first_name",
			"payee_middle_name",
			"payee_prefix",
			"payee_suffix",
			"payee_street_1",
			"payee_street_2",
			"payee_city",
			"payee_state",
			"payee_zip_code",
			"expenditure_purpose_descrip",
			"category_code",
			"expenditure_date",
			"payee_candidate_last_name",
			"payee_candidate_first_name",
			"payee_candidate_middle_name",
			"payee_candidate_prefix",
			"payee_candidate_suffix",
			"payee_candidate_office",
			"payee_candidate_state",
			"payee_candidate_district",
			"aggregate_general_elec_expended",
			"expenditure_amount",
			"image_number"
		],
		"^(P1|P2.2|P2.3|P2.4)": [
			"form_type",
			"filer_committee_id_number",
			"24_hour_notice",
			"coordinated_expenditures",
			"designating_committee_name",
			"subordinate_committee_name",
			"subordinate_street_1",
			"subordinate_street_2",
			"subordinate_city",
			"subordinate_state",
			"subordinate_zip_code",
			"payee_organization_name",
			"payee_last_name",
			"payee_first_name",
			"payee_middle_name",
			"payee_prefix",
			"payee_suffix",
			"payee_street_1",
			"payee_street_2",
			"payee_city",
			"payee_state",
			"payee_zip_code",
			"expenditure_purpose_descrip",
			"category_code",
			"expenditure_date",
			"payee_candidate_last_name",
			"payee_candidate_first_name",
			"payee_candidate_middle_name",
			"payee_candidate_prefix",
			"payee_candidate_suffix",
			"payee_candidate_office",
			"payee_candidate_state",
			"payee_candidate_district",
			"aggregate_general_elec_expended",
			"expenditure_amount",
			"increased_limit",
			"image_number"
		],
		"^8.3|8.2|8.1|8.0": [
			"form_type",
			"filer_committee_id_number",
			"transaction_id_number",
			"back_reference_tran_id_number",
			"back_reference_sched_name",
			"coordinated_expenditures",
			"designating_committee_id_number",
			"designating_committee_name",
			"subordinate_committee_id_number",
			"subordinate_committee_name",
			"subordinate_street_1",
			"subordinate_street_2",
			"subordinate_city",
			"subordinate_state",
			"subordinate_zip_code",
			"entity_type",
			"payee_organization_name",
			"payee_last_name",
			"payee_first_name",
			"payee_middle_name",
			"payee_prefix",
			"payee_suffix",
			"payee_street_1",
			"payee_street_2",
			"payee_city",
			"payee_state",
			"payee_zip_code",
			"expenditure_date",
			"expenditure_amount",
			"aggregate_general_elec_expended",
			"expenditure_purpose_descrip",
			"category_code",
			"payee_committee_id_number",
			"payee_candidate_id_number",
			"payee_candidate_last_name",
			"payee_candidate_first_name",
			"payee_candidate_middle_name",
			"payee_candidate_prefix",
			"payee_candidate_suffix",
			"payee_candidate_office",
			"payee_candidate_state",
			"payee_candidate_district",
			"memo_code",
			"memo_text_description"
		],
		"^7.0|6.4": [
			"form_type",
			"filer_committee_id_number",
			"transaction_id_number",
			"back_reference_tran_id_number",
			"back_reference_sched_name",
			"coordinated_expenditures",
			"designating_committee_id_number",
			"designating_committee_name",
			"subordinate_committee_id_number",
			"subordinate_committee_name",
			"subordinate_street_1",
			"subordinate_street_2",
			"subordinate_city",
			"subordinate_state",
			"subordinate_zip_code",
			"entity_type",
			"payee_organization_name",
			"payee_last_name",
			"payee_first_name",
			"payee_middle_name",
			"payee_prefix",
			"payee_suffix",
			"payee_street_1",
			"payee_street_2",
			"payee_city",
			"payee_state",
			"payee_zip_code",
			"expenditure_date",
			"expenditure_amount",
			"aggregate_general_elec_expended",
			"expenditure_purpose_code",
			"expenditure_purpose_descrip",
			"category_code",
			"payee_committee_id_number",
			"payee_candidate_id_number",
			"payee_candidate_last_name",
			"payee_candidate_first_name",
			"payee_candidate_middle_name",
			"payee_candidate_prefix",
			"payee_candidate_suffix",
			"payee_candidate_office",
			"payee_candidate_state",
			"payee_candidate_district",
			"memo_code",
			"memo_text_description"
		],
		"^6.3|6.2|6.1": [
			"form_type",
			"filer_committee_id_number",
			"transaction_id_number",
			"back_reference_tran_id_number",
			"back_reference_sched_name",
			"coordinated_expenditures",
			"designating_committee_id_number",
			"designating_committee_name",
			"subordinate_committee_id_number",
			"subordinate_committee_name",
			"subordinate_street_1",
			"subordinate_street_2",
			"subordinate_city",
			"subordinate_state",
			"subordinate_zip_code",
			"entity_type",
			"payee_organization_name",
			"payee_last_name",
			"payee_first_name",
			"payee_middle_name",
			"payee_prefix",
			"payee_suffix",
			"payee_street_1",
			"payee_street_2",
			"payee_city",
			"payee_state",
			"payee_zip_code",
			"expenditure_date",
			"expenditure_amount",
			"aggregate_general_elec_expended",
			"expenditure_purpose_code",
			"expenditure_purpose_descrip",
			"category_code",
			"increased_limit",
			"payee_committee_id_number",
			"payee_candidate_id_number",
			"payee_candidate_last_name",
			"payee_candidate_first_name",
			"payee_candidate_middle_name",
			"payee_candidate_prefix",
			"payee_candidate_suffix",
			"payee_candidate_office",
			"payee_candidate_state",
			"payee_candidate_district",
			"memo_code",
			"memo_text_description"
		],
		"^5.3": [
			"form_type",
			"filer_committee_id_number",
			"coordinated_expenditures",
			"designating_committee_id_number",
			"designating_committee_name",
			"subordinate_committee_id_number",
			"subordinate_committee_name",
			"subordinate_street_1",
			"subordinate_street_2",
			"subordinate_city",
			"subordinate_state",
			"subordinate_zip_code",
			"entity_type",
			"payee_name",
			"payee_street_1",
			"payee_street_2",
			"payee_city",
			"payee_state",
			"payee_zip_code",
			"aggregate_general_elec_expended",
			"expenditure_purpose_descrip",
			"expenditure_date",
			"expenditure_amount",
			"payee_committee_id_number",
			"payee_candidate_id_number",
			"payee_candidate_name",
			"payee_candidate_office",
			"payee_candidate_state",
			"payee_candidate_district",
			"conduit_name",
			"conduit_street_1",
			"conduit_street_2",
			"conduit_city",
			"conduit_state",
			"conduit_zip_code",
			"",
			"transaction_id_number",
			"memo_code",
			"memo_text_description",
			"back_reference_tran_id_number",
			"back_reference_sched_name",
			"increased_limit",
			"category_code",
			"expenditure_purpose_code"
		],
		"^5.2|5.1|5.0": [
			"form_type",
			"filer_committee_id_number",
			"coordinated_expenditures",
			"designating_committee_id_number",
			"designating_committee_name",
			"subordinate_committee_id_number",
			"subordinate_committee_name",
			"subordinate_street_1",
			"subordinate_street_2",
			"subordinate_city",
			"subordinate_state",
			"subordinate_zip_code",
			"entity_type",
			"payee_name",
			"payee_street_1",
			"payee_street_2",
			"payee_city",
			"payee_state",
			"payee_zip_code",
			"aggregate_general_elec_expended",
			"expenditure_purpose_descrip",
			"expenditure_date",
			"expenditure_amount",
			"payee_committee_id_number",
			"payee_candidate_id_number",
			"payee_candidate_name",
			"payee_candidate_office",
			"payee_candidate_state",
			"payee_candidate_district",
			"conduit_name",
			"conduit_street_1",
			"conduit_street_2",
			"conduit_city",
			"conduit_state",
			"conduit_zip_code",
			"",
			"transaction_id_number",
			"memo_code",
			"memo_text_description",
			"back_reference_tran_id_number",
			"back_reference_sched_name",
			"increased_limit",
			"category_code",
			"expenditure_purpose_code"
		],
		"^3": [
			"form_type",
			"filer_committee_id_number",
			"coordinated_expenditures",
			"designating_committee_id_number",
			"designating_committee_name",
			"subordinate_committee_id_number",
			"subordinate_committee_name",
			"subordinate_street_1",
			"subordinate_street_2",
			"subordinate_city",
			"subordinate_state",
			"subordinate_zip_code",
			"entity_type",
			"payee_name",
			"payee_street_1",
			"payee_street_2",
			"payee_city",
			"payee_state",
			"payee_zip_code",
			"aggregate_general_elec_expended",
			"expenditure_purpose_descrip",
			"expenditure_date",
			"expenditure_amount",
			"payee_committee_id_number",
			"payee_candidate_id_number",
			"payee_candidate_name",
			"payee_candidate_office",
			"payee_candidate_state",
			"payee_candidate_district",
			"conduit_name",
			"conduit_street_1",
			"conduit_street_2",
			"conduit_city",
			"conduit_state",
			"conduit_zip_code",
			"amended_cd",
			"transaction_id_number",
			"memo_code",
			"memo_text_description",
			"back_reference_tran_id_number",
			"back_reference_sched_name"
		],
		"^2": [
			"form_type",
			"filer_committee_id_number",
			"coordinated_expenditures",
			"designating_committee_id_number",
			"designating_committee_name",
			"subordinate_committee_id_number",
			"subordinate_committee_name",
			"subordinate_street_1",
			"subordinate_street_2",
			"subordinate_city",
			"subordinate_state",
			"subordinate_zip_code",
			"entity_type",
			"payee_name",
			"payee_street_1",
			"payee_street_2",
			"payee_city",
			"payee_state",
			"payee_zip_code",
			"aggregate_general_elec_expended",
			"expenditure_purpose_descrip",
			"expenditure_date",
			"expenditure_amount",
			"payee_committee_id_number",
			"payee_candidate_id_number",
			"payee_candidate_name",
			"payee_candidate_office",
			"payee_candidate_state",
			"payee_candidate_district",
			"conduit_name",
			"conduit_street_1",
			"conduit_street_2",
			"conduit_city",
			"conduit_state",
			"conduit_zip_code",
			"amended_cd",
			"transaction_id_number",
			"orig_tran_id",
			"supr_tran_id"
		]
	},
		"^si": {
		"^(3|5)": [
			"form_type",
			"filer_committee_id_number",
			"bank_account_id",
			"account_name",
			"coverage_from_date",
			"coverage_through_date",
			"col_a_total_receipts",
			"col_a_transfers_to_fed",
			"col_a_transfers_to_state_local",
			"col_a_direct_state_local_support",
			"col_a_other_disbursements",
			"col_a_total_disbursements",
			"col_a_cash_on_hand_beginning_period",
			"col_a_receipts_period",
			"col_a_subtotal",
			"col_a_disbursements_period",
			"col_a_cash_on_hand_close_of_period",
			"col_b_total_receipts",
			"col_b_transfers_to_fed",
			"col_b_transfers_to_state_local",
			"col_b_direct_state_local_support",
			"col_b_other_disbursements",
			"col_b_total_disbursements",
			"col_b_cash_on_hand_beginning_period",
			"col_b_receipts_period",
			"col_b_subtotal",
			"col_b_disbursements_period",
			"col_b_cash_on_hand_close_of_period",
			"amended_cd",
			"transaction_id",
			"account_identifier"
		]
	},
		"^sl": {
		"^(P3|P2|P1)": [
			"form_type",
			"filer_committee_id_number",
			"account_name",
			"col_a_itemized_receipts_persons",
			"col_a_unitemized_receipts_persons",
			"col_a_total_receipts_persons",
			"col_a_other_receipts",
			"col_a_total_receipts",
			"col_a_voter_registration_disbursements",
			"col_a_voter_id_disbursements",
			"col_a_gotv_disbursements",
			"col_a_generic_campaign_disbursements",
			"col_a_disbursements_subtotal",
			"col_a_other_disbursements",
			"col_a_total_disbursements",
			"col_a_cash_on_hand_beginning_period",
			"col_a_receipts_period",
			"col_a_subtotal_period",
			"col_a_disbursements_period",
			"col_a_cash_on_hand_close_of_period",
			"col_b_itemized_receipts_persons",
			"col_b_unitemized_receipts_persons",
			"col_b_total_receipts_persons",
			"col_b_other_receipts",
			"col_b_total_receipts",
			"col_b_voter_registration_disbursements",
			"col_b_voter_id_disbursements",
			"col_b_gotv_disbursements",
			"col_b_generic_campaign_disbursements",
			"col_b_disbursements_subtotal",
			"col_b_other_disbursements",
			"col_b_total_disbursements",
			"col_b_cash_on_hand_beginning_period",
			"col_b_receipts_period",
			"col_b_subtotal_period",
			"col_b_disbursements_period",
			"col_b_cash_on_hand_close_of_period",
			"image_number"
		],
		"^8.3|8.2|8.1|8.0|7.0|6.4|6.3|6.2|6.1": [
			"form_type",
			"filer_committee_id_number",
			"transaction_id_number",
			"record_id_number",
			"account_name",
			"coverage_from_date",
			"coverage_through_date",
			"col_a_itemized_receipts_persons",
			"col_a_unitemized_receipts_persons",
			"col_a_total_receipts_persons",
			"col_a_other_receipts",
			"col_a_total_receipts",
			"col_a_voter_registration_disbursements",
			"col_a_voter_id_disbursements",
			"col_a_gotv_disbursements",
			"col_a_generic_campaign_disbursements",
			"col_a_disbursements_subtotal",
			"col_a_other_disbursements",
			"col_a_total_disbursements",
			"col_a_cash_on_hand_beginning_period",
			"col_a_receipts_period",
			"col_a_subtotal_period",
			"col_b_disbursements_period",
			"col_b_cash_on_hand_close_of_period",
			"col_b_itemized_receipts_persons",
			"col_b_unitemized_receipts_persons",
			"col_b_total_receipts_persons",
			"col_b_other_receipts",
			"col_b_total_receipts",
			"col_b_voter_registration_disbursements",
			"col_b_voter_id_disbursements",
			"col_b_gotv_disbursements",
			"col_b_generic_campaign_disbursements",
			"col_b_disbursements_subtotal",
			"col_b_other_disbursements",
			"col_b_total_disbursements",
			"col_b_cash_on_hand_beginning_period",
			"col_b_receipts_period",
			"col_b_subtotal_period",
			"col_b_disbursements_period",
			"col_b_cash_on_hand_close_of_period"
		],
		"^5.3|5.2|5.1|5.0": [
			"form_type",
			"filer_committee_id_number",
			"account_name",
			"record_id_number",
			"coverage_from_date",
			"coverage_through_date",
			"col_a_itemized_receipts_persons",
			"col_a_unitemized_receipts_persons",
			"col_a_total_receipts_persons",
			"col_a_other_receipts",
			"col_a_total_receipts",
			"col_a_voter_registration_disbursements",
			"col_a_voter_id_disbursements",
			"col_a_gotv_disbursements",
			"col_a_generic_campaign_disbursements",
			"col_a_disbursements_subtotal",
			"col_a_other_disbursements",
			"col_a_total_disbursements",
			"col_a_cash_on_hand_beginning_period",
			"col_a_receipts_period",
			"col_a_subtotal_period",
			"col_b_disbursements_period",
			"col_b_itemized_receipts_persons",
			"col_b_unitemized_receipts_persons",
			"col_b_total_receipts_persons",
			"col_b_other_receipts",
			"col_b_total_receipts",
			"col_b_voter_registration_disbursements",
			"col_b_voter_id_disbursements",
			"col_b_gotv_disbursements",
			"col_b_generic_campaign_disbursements",
			"col_b_disbursements_subtotal",
			"col_b_other_disbursements",
			"col_b_total_disbursements",
			"col_b_cash_on_hand_beginning_period",
			"col_b_receipts_period",
			"col_b_subtotal_period",
			"col_b_disbursements_period",
			"col_b_cash_on_hand_close_of_period",
			"",
			"transaction_id_number"
		]
	},
		"^text": {
		"^8.3|8.2|8.1|8.0|7.0|6.4|6.3|6.2|6.1": [
			"rec_type",
			"filer_committee_id_number",
			"transaction_id_number",
			"back_reference_tran_id_number",
			"back_reference_sched_form_name",
			"text"
		],
		"^5.3": [
			"rec_type",
			"form_type",
			"back_reference_tran_id_number",
			"text"
		],
		"^5.2|5.1|5.0": [
			"rec_type",
			"form_type",
			"back_reference_tran_id_number",
			"text"
		],
		"^3": [
			"rec_type",
			"form_type",
			"back_reference_tran_id_number",
			"text"
		]
	}
	};

	/*
	based on https://github.com/NYTimes/Fech/blob/master/lib/fech/mappings.rb
	copyright (c) 2011 The New York Times Company
	licensed Apache */

	const renderedMaps = require$$0;

	class Mappings {
	    keyByRegex(maps, label) {
	        if (!maps) {
	            return null;
	        }

	        let key = Object.keys(maps)
	            .sort((a, b) => a.length - b.length)
	            .find(key => new RegExp(key, 'i').test(label));

	        let result = key ? maps[key] : null;

	        // for compatibility
	        if (
	            Array.isArray(result) &&
	            result.includes('beginning_image_number')
	        ) {
	            result = result.map(value =>
	                value.replace('beginning_image_number', 'begin_image_number')
	            );
	        }

	        return result;
	    }

	    lookup(type, version) {
	        return this.keyByRegex(this.keyByRegex(renderedMaps, type), version);
	    }
	}

	var mappings$1 = new Mappings();

	var stream = require$$0$2,
	    inherits = inherits$1.exports,
	    genobj = generateObjectProperty,
	    genfun = generateFunction,
	    mappings = mappings$1;

	var quote = new Buffer.from('"')[0],
	    comma = new Buffer.from(',')[0],
	    cr = new Buffer.from('\r')[0],
	    lf = new Buffer.from('\n')[0],
	    fs = new Buffer.from('\u001C')[0];

	/**
	* Sets up the parser, stream and instance variables. Instantiated internally.
	*
	* @constructor
	* @param {Object} opts No options, yet.
	*/

	var Parser = function(opts) {
	    if (!opts) {
	        opts = {};
	    }

	    stream.Transform.call(this, {
	        objectMode: true,
	        highWaterMark: 16
	    });

	    this.version = '8.2'; // default filing version

	    if ((!opts.map && opts.map !== false) || (opts.map && opts.map === true)) {
	        this.map = true;
	    }
	    else {
	        this.map = false;
	    }

	    this._prev = null; // already buffered stream data
	    this._prevEnd = 0; // where buffer ends
	    this._first = true; // whether the currently parsed row is the first
	    this._empty = null; // the default value returned for empty fields
	    this._Rows = {}; // lookup for generated Row classes
	    this._separator = fs; // field separator/delimiter character
	    this._newline = lf; // new line character
	    this._f99 = false; // is an F99 form with a block of free text input
	};

	inherits(Parser, stream.Transform);

	/**
	* Called automatically by the incoming stream, does the first level of parsing.
	* 
	* @param {Buffer/string} data The incoming data.
	* @param {string?} enc The encoding.
	* @param {function} cb A callback for when it's done.
	*/

	Parser.prototype._transform = function(data, enc, cb) {
	    if (typeof data === 'string') {
	        data = new Buffer(data);
	    }

	    var start = 0;
	    var buf = data;

	    // if previous buffered data exists, pick up where it left off
	    if (this._prev) {
	        start = this._prev.length;
	        buf = Buffer.concat([this._prev, data]);
	        this._prev = null;
	    }

	    for (var i = start; i < buf.length; i++) {
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
	};


	/**
	* Handles the stream closing.
	* 
	* @param {function} cb A callback for when it's done.
	*/

	Parser.prototype._flush = function(cb) {
	    if (this._quoting || !this._prev) {
	        return cb();
	    }
	    this._online(this._prev, this._prevEnd, this._prev.length + 1); // plus since online -1s
	    cb();
	};

	/**
	* Parses each line.
	* 
	* @param {Buffer} buf The buffered data.
	* @param {integer} start Index of the start of the line.
	* @param {integer} end Index of the end of the line.
	*/

	Parser.prototype._online = function(buf, start, end) {
	    end--; // trim newline
	    if (buf.length && buf[end - 1] === cr) {
	        end--;
	    }

	    var sep = this._separator,
	        cells = [],
	        inQuotes = false,
	        offset = start;

	    // parses each cell
	    for (var i = start; i < end; i++) {
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
	        var textIndex = this._cells.length-1;
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
	                                        .concat(this._onvalue(buf,start,end) + '\n');
	            return;
	        }
	    }

	    // compile the Row class with field names for the form type and filing version
	    var res = this._lookup(cells[0],this.version);

	    // if there are more field names for the row than cells, add empties
	    if (res.headers && cells.length !== res.headers.length) {
	        for (var num = cells.length; num <= res.headers.length; num++) {
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
	};

	/**
	* Looks up the field names based on the form type and filing version.
	* 
	* @param {string} type Form type, the first value on a line.
	* @param {string} version The filing version from the filing header.
	*/

	Parser.prototype._lookup = function(type,version) {
	    var res = {
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

	};

	/**
	* Generates a Row class to return.
	*
	* @param {array} headers The fields names for the row.
	*/

	Parser.prototype._compile = function(headers) {
	    // generate a Row class on the fly
	    var Row = genfun()('function Row (cells) {');

	    headers.forEach(function(cell, i) {
	        Row('%s = cells[%d]', genobj('this', cell), i);
	    });

	    Row('}');

	    var _Row = Row.toFunction();

	    return _Row;
	};

	/**
	* Instantiates a new Row object with the cells and sends it to the pipe.
	* 
	* @param {function} Row The Row class for this line.
	* @param {array} cells The data in parsed cells.
	*/

	Parser.prototype._emit = function(Row, cells) {
	    this.push(new Row(cells));
	};

	/**
	* Processes a single cell.
	* 
	* @param {Buffer} buf The buffered data.
	* @param {integer} start Index of the start of the cell.
	* @param {integer} end Index of the end of the cell.
	*/

	Parser.prototype._oncell = function(buf, start, end) {
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
	};

	/**
	* Convert the buffered value to UTF-8.
	* 
	* @param {Buffer} buf The buffered data.
	* @param {integer} start Index of the start of the value.
	* @param {integer} end Index of the end of the value.
	*/

	Parser.prototype._onvalue = function(buf, start, end) {
	    return buf.toString('utf8', start, end).replace('\ufffd','');
	};

	var parser = function(opts) {
	    return new Parser(opts);
	};

	var fecParse = parser;

	return fecParse;

})));
