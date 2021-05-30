const rules = require('./webpack.rules');
const plugins = require('./webpack.plugins');

rules.push(
  {
    test: /\.css$/,
    use: [
      { loader: 'style-loader' },
      { loader: 'css-loader' }
    ],
  },
  {
    test: /\.s[ca]ss$/,
    use: [
      { loader: 'style-loader' },
      { loader: 'css-loader' },
      { loader: 'sass-loader' },
    ],
  },
  {
    test: /\.(woff(2)?|ttf|eot|svg)(\?v=\d+\.\d+\.\d+)?$/,
    use: [
      {
        loader: 'file-loader',
      }
    ]
  },
  {
    test: /\.(png|jpg|jpeg)$/,
    use: [
      {
        loader: 'file-loader',
        options: {
          publicPath: '../', // Needs this to correctly locate files, for some reason...
          
        }
      }
    ]
  },
);

module.exports = {
  module: {
    rules,
  },
  plugins: plugins,
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css']
  },
};
