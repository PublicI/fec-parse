import commonjs from 'rollup-plugin-commonjs';
import json from 'rollup-plugin-json';
import builtins from '@stream-io/rollup-plugin-node-builtins';
import resolve from 'rollup-plugin-node-resolve';
import globals from 'rollup-plugin-node-globals';

const config = {
	input: 'index.js',
	output: {
		file: 'dist/bundle.js',
		format: 'umd',
		name: 'FECParse'
	},
	plugins: [commonjs(), json(), globals(), builtins(), resolve()]
};

export default config;
