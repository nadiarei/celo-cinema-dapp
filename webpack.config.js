const path = require("path");
const webpack = require("webpack");
const FriendlyErrorsWebpackPlugin = require('@soda/friendly-errors-webpack-plugin');
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyPlugin = require("copy-webpack-plugin");
const CompressionPlugin = require("compression-webpack-plugin");

module.exports = {
  mode: "development",
  devtool: "cheap-module-eval-source-map",
  entry: {
    main: path.resolve(process.cwd(), "src", "main.js"),
    admin: path.resolve(process.cwd(), "src", "admin.js"),
    profile: path.resolve(process.cwd(), "src", "profile.js")
  },
  output: {
    path: path.resolve(process.cwd(), "docs"),
    publicPath: ""
  },
  node: {
    fs: "empty",
    net: "empty"
  },
  watchOptions: {
    // ignored: /node_modules/,
    aggregateTimeout: 300, // After seeing an edit, wait .3 seconds to recompile
    poll: 500 // Check for edits every 5 seconds
  },
  plugins: [
    new FriendlyErrorsWebpackPlugin(),
    new webpack.ProgressPlugin(),
    new HtmlWebpackPlugin({
      filename: 'index.html',
      template: path.resolve(process.cwd(), "public", "index.html"),
      chunks: ['main']
    }),
    new HtmlWebpackPlugin({
      filename: 'admin.html',
      template: path.resolve(process.cwd(), "public", "admin.html"),
      chunks: ['admin']
    }),
    new HtmlWebpackPlugin({
      filename: 'profile.html',
      template: path.resolve(process.cwd(), "public", "profile.html"),
      chunks: ['profile']
    }),
    new CopyPlugin({
      patterns: [
        { from: "public/favicon.ico" },
        { from: "public/assets" }
      ],
    }),
    new CompressionPlugin()
  ]
}
