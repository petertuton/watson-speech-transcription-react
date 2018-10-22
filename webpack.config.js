const CleanWebpackPlugin = require('clean-webpack-plugin');
const HtmlWebPackPlugin = require('html-webpack-plugin');
const LiveReloadPlugin = require('webpack-livereload-plugin');
const path = require('path');

module.exports = {
  entry: {
    main: './client/index.js'
  },
  output: {
    filename: '[name].[hash].js',
    path: path.resolve('./dist'),
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: [/node_modules/],
        use: [{ 
          loader: 'babel-loader' 
        }]
      },
      {
        test: /\.s(a|c)ss$/,
        use: [{
          loader: 'style-loader'
        }, {
          loader: 'css-loader'
        }, {
          loader: 'sass-loader'
        }]
   	  },
       {
        test: /\.html$/,
        use: [{ 
          loader: 'html-loader' 
        }]
      }
    ]
  },
  node: {
    fs: 'empty',
    net: 'empty',
    tls: 'empty'
  },
  devServer: {
    port: 8080,
    open: false,
    proxy: {
      "/api": "http://localhost:3000"
    }
  },
  performance: {
    hints: false
  },
  plugins: [
    new HtmlWebPackPlugin({
      template: 'client/index.html'
    }),
    new CleanWebpackPlugin(['dist']),
    new LiveReloadPlugin()
  ]
}
