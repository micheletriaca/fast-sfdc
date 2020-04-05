// @ts-check
'use strict'

const path = require('path')
const TerserPlugin = require('terser-webpack-plugin')

/** @type {import('webpack').Configuration} */
const config = {
  target: 'node',
  entry: './src/extension.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2',
    devtoolModuleFilenameTemplate: '../[resource-path]'
  },
  devtool: 'source-map',
  externals: {
    vscode: 'commonjs vscode'
  },
  optimization: {
    mergeDuplicateChunks: true,
    minimize: true,
    minimizer: [
      new TerserPlugin({
        sourceMap: true,
        parallel: true,
        cache: true,
        terserOptions: {
          ecma: 6
        }
      })
    ]
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  module: {
    noParse: /\/native-require.js$/,
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader'
          }
        ]
      }
    ]
  }
}

module.exports = config
