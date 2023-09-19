const path = require("path");
const HTMLPlugin = require("html-webpack-plugin");
const CopyPlugin = require("copy-webpack-plugin")
const version = {
    current: "2.0.1"
}

module.exports = {
    entry: {
        index: "./src/index.js",
        background: path.resolve('src/content_scripts/background.js'),
        content: path.resolve('src/content_scripts/content.js'),
        articleContent: path.resolve('src/content_scripts/articleContent.js'),
        legacy_content: path.resolve('src/content_scripts/legacy_content.js')
    },
    mode: "production",
    module: {
        rules: [
            {
                test: /\.(js|jsx)$/,
                exclude: /node_modules/,
                use: {
                    loader: "babel-loader",
                    options: {
                        presets: ["@babel/preset-env", "@babel/preset-react"],
                    }
                }
            },
            {
                test: /\.css$/,
                use: [
                  'style-loader', // Injects CSS into the DOM
                  'css-loader'    // Handles CSS files' imports and modules
                ],
            },
            {
                type: 'asset/inline',
                test: /\.(png|jpg|jpeg|gif|woff|woff2|tff|eot|svg)$/,
            }
        ],
      },
    plugins: [
        new CopyPlugin({
            patterns:[{
                from: path.resolve("src/static"),
                to: path.resolve(`caerus-reactjs-${version.current}`),
                toType: "dir"
            }],
        }),
        ...getHtmlPlugins(["index"]),
    ],
    resolve: {
        extensions: [".jsx", ".js"],
    },
    output: {
        path: path.join(__dirname, `caerus-reactjs-${version.current}`+ "/js"),
        filename: "[name].js",
    },
};

function getHtmlPlugins(chunks) {
    return chunks.map(
        (chunk) =>
            new HTMLPlugin({
                title: "React extension",
                filename: `${chunk}.html`,
                chunks: [chunk],
            })
    );
}
