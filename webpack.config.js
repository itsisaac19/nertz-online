const HtmlWebpackPlugin = require('html-webpack-plugin');

const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const HTMLInlineCSSWebpackPlugin = require("html-inline-css-webpack-plugin").default;

const InlineChunkHtmlPlugin = require('react-dev-utils/InlineChunkHtmlPlugin');

const path = require('path')

module.exports = {
    mode: 'development',
    watch: true,
    entry: {
        'index' : './src/index.js',
        'indexCSS' : './src/index.css'
    },
    output: {
        path: path.resolve(__dirname, 'server/client'),
        filename: '[name].js'
    },
    plugins: [
      new MiniCssExtractPlugin({
        filename: "[name].css",
        chunkFilename: "[id].css"
      }),
      new HtmlWebpackPlugin({
        templateContent: `
        <!DOCTYPE html>
        <html lang="en">

        <head>
            <meta charset="UTF-8">
            <meta http-equiv="X-UA-Compatible" content="IE=edge">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Nertz</title>
            <meta name="title" content="Nertz">
            <meta name="description" content="The fastest you'll ever play.">

            <script src="/socket.io/socket.io.js"></script>        
        </head>

        <body>
            <section id="game-field" class="hidden hide">
                <div class="foundations BlockLayout BlockLayout--typeGrid slots">

                </div>
                <div class="timer-wrap">
                    <span id="timer" class="timer-value"></span>
                </div>
                <div class="code-wrap-top-right">
                    <span id="party-code-top-right" class="code-value-top-right"></span>
                </div>
            </section>

            <section id="menu">
                <div class="hero">
                    <h1 class="title show">Nertz</h1>
                    <p class="desc show">(the card game)</p>
                    <h1 class="fastest show"><div>The fastest game</div> <div class="new">you'll</div> <div class="new">ever</div> <span>play.</span> <span class="play one">play.</span> <span class="play two">play.</span> <span class="play three">play.</span></h1>
                    
                    <div class="video-wrap show">
                        <video autoplay muted preload loop>
                            <source src="./hero-video.mp4" type="video/mp4">
                        </video>
                    </div>

                    <div class="create-party-container show">
                        <div class="create-party">
                            <span class="multi">Multiplayer</span>
                            <button class="create-party-button">Create Party</button>
                            <button class="join-party-button">Join Party</button>
                            <span class="single">Single-player</span>
                            <button class="bots-button">Play with computers</button>
                        </div>
                    </div>
                </div>
                <div class="waiting-area hidden">
                    <div class="players-container">
                        <div class="players-wrapper">
                            <div class="player-slot player-one" data-player="1">
                                <div class="player-label">Player 1</div>
                                <div class="player-name" contenteditable="false" spellcheck="false">...</div>
                            </div>
                            <div class="player-slot player-two" data-player="2">
                                <div class="player-label">Player 2</div>
                                <div class="player-name" contenteditable="false" spellcheck="false">...</div>
                            </div>
                            <div class="player-slot player-three" data-player="3">
                                <div class="player-label">Player 3</div>
                                <div class="player-name" contenteditable="false" spellcheck="false">...</div>
                            </div>
                        </div>
                    </div>
        
                    <div class="game-settings">
                        <div class="points-threshold">
                            <span>Stop when a player gets <b class="points-threshold-value">100</b> points <input type="checkbox" id="points-checkox"></span>
                            <input type="range" id="points-input" min="1" max="200" value="100">
                        </div>
                        <div class="rounds-threshold">
                            <span>Stop after <b class="rounds-threshold-value">4</b> rounds <input type="checkbox" id="rounds-checkox"></span>
                            <input type="range" id="rounds-input" min="1" max="10" value="4">
                        </div>
                    </div>

                    <div class="code-wrapper-container">
                        <div class="code-label"></div>
                        <div class="code-wrapper">
                            <div class="code-value">...</div>
                            <input id="code-input" class="hidden" placeholder="code" type="text" spellcheck="false">
                            <button class="code-input-submit hidden">Join</button>
                        </div>
                    </div>
        
                    <div class="start-wrapper">
                        <button class="start-button">Start game</button>
                    </div>
                    <div class="exit-wrapper">
                        <button class="exit-button">leave party</button>
                    </div>

                    <div class="popper-wrapper hide">
                        <div id="popper">
                            <div class="stat-popup">
                                <button class="close-popper">close</button>
                                <div class="leaderboard">
                                    <div class="leaderboard-label">Leaderboard</div> 
                                    <div class="leaderboard-list">
                                        
                                    </div>    
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </section>
        </body>
        </html>
        `,
        inject: 'body',
        filename: 'production-inline.html',
      }),
      new HTMLInlineCSSWebpackPlugin(),
      new InlineChunkHtmlPlugin(HtmlWebpackPlugin, [/index/]),
    ],
    module: {
        rules: [
          {
            test: /\.css$/,
            use: [
              MiniCssExtractPlugin.loader,
              "css-loader"
            ]
          }
        ]
    }
};