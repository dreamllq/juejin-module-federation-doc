const path = require('path');
const { VueLoaderPlugin } = require('vue-loader');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { ProgressPlugin } = require('webpack');
const { ModuleFederationPlugin } = require('webpack').container;

const host = '127.0.0.1';
const port = '8081'

module.exports = ({WEBPACK_SERVE}) => {
  return {
    mode:WEBPACK_SERVE?'development':'production',
    entry: path.join(process.cwd(), 'src/main.ts'),
    output: {
      path: path.join(process.cwd(), 'dist'),
      filename: 'assets/[name].[contenthash:6].js',
      chunkFilename: 'assets/[name].[contenthash:8].js',
      publicPath: WEBPACK_SERVE?`http://${host}:${port}/`:'/',
      library: { type: 'module' },
      clean: true
    },
    experiments: { outputModule: true },
    resolve: {
      extensions: [
        '.mjs',
        '.js',
        '.ts',
        '.jsx',
        '.tsx',
        '.json',
        '.vue'
      ],
      alias: {
        '@':  path.join(process.cwd(), 'src')
      }
    },
    module: {
      rules: [
        {
          test: /\.vue$/,
          use: 'vue-loader'
        },
        {
          test: /.ts$/, 
          use: {
            loader: 'babel-loader',
            options: { presets: [['@babel/preset-typescript', { allExtensions: true }]] }
          }
        },
        {
          test: /\.(png|svg|jpg|gif)$/,
          type: 'asset'
        },
        {
          test: /\.(ttf|eot|woff|woff2)$/,
          type:'asset/inline'
        }
      ],
      noParse: [require.resolve('typescript/lib/typescript.js')]
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: 'index.ejs',
        inject: false
      }),
      new VueLoaderPlugin(),
      new ProgressPlugin(),
      new ModuleFederationPlugin({
        name: 'app-a',
        filename: 'remoteEntry.js',
        exposes: {},
        library: { type: 'module' },
        remoteType: 'module',
        shared: {
          "vue": {
            "singleton": true
          }
        },
        remotes:{
          'app-b':'http://127.0.0.1:8082/remoteEntry.js'
        }
      })
    ],
    performance: { hints: false },
    devServer: WEBPACK_SERVE?{
      static: { directory: path.join(process.cwd(), 'public') },
      host: host,
      compress: true,
      port: port,
      hot: true,
      historyApiFallback: true,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers':
          'X-Requested-With, content-type, Authorization'
      },
      client: { overlay: false },
    }:undefined
  }
};
