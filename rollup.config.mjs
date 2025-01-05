import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';

/** @type {import('@rollup/plugin-terser').Options} */
const terserConfig = {
  // eslint-disable-next-line camelcase
  keep_classnames: true,
  // eslint-disable-next-line camelcase
  keep_fnames: true,
};

/** @type {import('rollup').RollupOptions[]} */
export default [
  {
    input: './out.prod/main.js',
    output: [
      {
        file: './dist/proxy-pool.js',
        format: 'commonjs',
      },
    ],
    plugins: [commonjs(), json(), resolve(), terser(terserConfig)],
  },
];
