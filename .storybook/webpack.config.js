const path = require('path');

const basePath = process.cwd();

module.exports = ({ config }) => {
  config.module.rules.push({
    test: /\.(ts|tsx)$/,
    use: [
      {
        loader: require.resolve('awesome-typescript-loader'),
      },
      // Optional
      {
        loader: require.resolve('react-docgen-typescript-loader'),
      },
    ],
  });
  config.module.rules.push({
        test: /\.scss$/,
        use: [
          { // creates style nodes from JS strings
            loader: "style-loader"
          },
          { // translates CSS into CommonJS (css-loader) and automatically generates TypeScript types
            loader: 'typings-for-css-modules-loader',
            options: {
              camelCase: true,
              modules: true,
              namedExport: true,
              localIdentName: '[name]__[local]___[hash:base64:5]',
              importLoaders: 2,
              sourceMap: true
            }
          },
          { // compiles Sass to CSS
            loader: "sass-loader",
            options: {
              sourceMap: true
            }
          },
          { // Load global scss files in every other scss file without an @import needed
            loader: 'sass-resources-loader',
            options: {
              resources: ['./src/assets/styles/global-variables.scss']
            },
          },
        ]
      });
  config.resolve.extensions.push('.ts', '.tsx');
  config.resolve.alias = {
    arc: path.resolve(basePath, 'src/arc'),
    actions: path.resolve(basePath, 'src/actions'),
    components: path.resolve(basePath, 'src/components'),
    constants: path.resolve(basePath, 'src/constants'),
    layouts: path.resolve(basePath, 'src/layouts'),
    lib: path.resolve(basePath, 'src/lib'),
    reducers: path.resolve(basePath, 'src/reducers'),
    selectors: path.resolve(basePath, 'src/selectors'),
    schemas: path.resolve(basePath, 'src/schemas'),
    src: path.resolve(basePath, 'src'),
    'ipfs-api': 'ipfs-api/dist',
    'ipfs-http-client': 'ipfs-http-client/dist'
  };
  return config;
};