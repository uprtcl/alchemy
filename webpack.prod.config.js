const path = require('path');

const CopyWebpackPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const OptimizeCSSAssetsPlugin = require("optimize-css-assets-webpack-plugin");
const TerserPlugin = require('terser-webpack-plugin');
const merge = require('webpack-merge');
const webpack = require('webpack');
const WebpackShellPlugin = require('webpack-shell-plugin');

const baseConfig = require('./webpack.base.config.js');

const config = merge(baseConfig, {
  mode: 'production',
  devtool: '',

  entry: {
    // the entry point of our app
    app: __dirname + '/src/index.tsx',
    // 'ipfs-http-client': ['ipfs-http-client'],
    // '@daostack/migration': ['@daostack/migration/']
  },

  output: {
    filename: "[name].bundle-[hash:8].js",
    chunkFilename: '[name].bundle-[hash:8].js',
    path: path.resolve(__dirname, 'dist'),
    publicPath: '',
  },

  optimization: {
    minimize: true,
    minimizer: [
      new OptimizeCSSAssetsPlugin({}),
      new TerserPlugin({
        terserOptions: {
        }
      })
    ],
    splitChunks: {
      chunks: 'all',
    }
  },

  module: {
    rules: [
      {
        test: /\.scss$/,
        use: [
          MiniCssExtractPlugin.loader,
          {
            loader: "css-loader",
            options: {
              modules: {
                localIdentName: "[name]--[local]--[hash:base64:5]"
              },
              importLoaders: 2
            }
          },
          'sass-loader',
          {
            loader: 'sass-resources-loader',
            options: {
              resources: ['./src/assets/styles/global-variables.scss']
            }
          }
        ],
      },
    ],
  },

plugins: [
    new MiniCssExtractPlugin({
      // Options similar to the same options in webpackOptions.output
      // both options are optional
      filename: "[name].[hash].css",
      chunkFilename: "[id].[hash].css",
      modules: true
    }),

    new webpack.EnvironmentPlugin({
      NETWORK: "main",
      NODE_ENV: "production",
      BASE_URL: "",
      ARC_GRAPHQLHTTPPROVIDER: "",
      ARC_GRAPHQLWSPROVIDER : "",
      ARC_WEB3PROVIDER : "https://mainnet.infura.io/ws/v3/e0cdf3bfda9b468fa908aa6ab03d5ba2",
      ARC_WEB3PROVIDERREAD : "https://mainnet.infura.io/ws/v3/e0cdf3bfda9b468fa908aa6ab03d5ba2",
      ARC_IPFSPROVIDER: "",
      ARC_IPFSPROVIDER_HOST : "",
      ARC_IPFSPROVIDER_PORT : "",
      ARC_IPFSPROVIDER_PROTOCOL : "",
      ARC_IPFSPROVIDER_API_PATH : "",
      INFURA_ID : "",
      DAO_AVATAR_ADDRESS: "0x519b70055af55a007110b4ff99b0ea33071c720a",
      DAO_CONTROLLER_ADDRESS: "0x9f828ac3baa9003e8a4e0b24bcae7b027b6740b0"
    }),

    new CopyWebpackPlugin([
      { from: 'src/assets', to: 'assets' }
    ]),
  ],
});

if (process.env.ANALYZE) {
  const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
  config.plugins.push(new BundleAnalyzerPlugin());
}

module.exports = config;
