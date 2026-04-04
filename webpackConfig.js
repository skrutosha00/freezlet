const path = require("path");

module.exports = {
  entry: "./script.js",
  output: {
    filename: "bundle.js",
    path: path.resolve(__dirname, "dist"),
    publicPath: "auto",
    clean: true
  },
  devServer: {
    static: {
      directory: __dirname
    },
    port: 8080,
    open: false,
    hot: true
  },
  devtool: "source-map"
};
