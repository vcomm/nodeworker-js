const path = require('path')
const HTMLWebpackPlugin = require('html-webpack-plugin')
const {CleanWebpackPlugin} = require('clean-webpack-plugin')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin')
const TerserPlugin = require('terser-webpack-plugin')

const isDev = process.env.NODE_ENV === 'development'
const isProd = !isDev

const optimization = () => {
    const config = {
        splitChunks: {
            chunks: 'all'
        }
    }
    if (isProd) {
//        config.minimize = true
        config.minimizer = [
            new CssMinimizerPlugin(),
            new TerserPlugin()
        ]
    }
    return config
}

module.exports = {
    context: path.resolve(__dirname, 'public/src'),
    mode: 'development',
    entry: {
        main: './js/index.js'
    },
    output: {
//        filename: '[name].[contenthash].js',
        filename: '[name].bundle.js',
        path: path.resolve(__dirname, 'public/dist')
    },
    resolve: {
        extensions: ['.js','.css'],
        alias: {
            '@scripts': path.resolve(__dirname, 'node_modules')
        }
    },
    optimization: optimization(),
//    devtool: isDev ? 'source-map' : '',
    plugins: [
        new HTMLWebpackPlugin({
            template: './index.html'
        }),
        new CleanWebpackPlugin(),
        new CopyWebpackPlugin({
        patterns: [
            {
                from: path.resolve(__dirname,'public/src/img/eyes-on.png'),
                to: path.resolve(__dirname,'public/dist')
            }
        ]}),
        new MiniCssExtractPlugin({
            // Options similar to the same options in webpackOptions.output
            // both options are optional
            filename: '[name].bundle.css',
            chunkFilename: '[id].bundle.css',
        }),        
    ],
    module: {
        rules: [
            {
                test: /\.css$/,
                use: [
                    {
                        loader: MiniCssExtractPlugin.loader, 
                        options: {
                            // only enable hot in development
                            hmr: process.env.NODE_ENV === 'development',
                            // if hmr does not work, this is a forceful method.
                            reloadAll: true,
                        },                        
                    },
                    'css-loader'
                ]
            },
            {
                test: /\.(png|jpg|svg|gif)$/,
                use: ['file-loader']
            }
        ]
    }
}