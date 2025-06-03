const { getDefaultConfig } = require('@expo/metro-config');
const path = require('path');

// Define the path to the empty shim
const emptyShim = path.resolve(__dirname, 'shims/empty.js');

module.exports = (() => {
  const config = getDefaultConfig(__dirname);

  // Ignore any .babelrc inside node_modules
  config.transformer.enableBabelRCLookup = false;

  // 👇  Map troublesome Node modules to safe shims or browser polyfills
  config.resolver.extraNodeModules = {
    // existing polyfills & shims
    events: require.resolve('events/'), // trailing slash = main file
    stream: require.resolve('stream-browserify'),
    buffer: require.resolve('buffer/'),
    tty: require.resolve('tty-browserify'),
    util: require.resolve('util/'),

    // empty shims for Node-only stuff we never need
    ws: emptyShim,
    http: emptyShim,
    https: emptyShim,
    net: emptyShim,
    tls: emptyShim,
    fs: emptyShim,
    path: emptyShim, // Added path shim
    zlib: emptyShim, // Added zlib shim
    crypto: emptyShim, // Added crypto shim
    os: emptyShim, // Added os shim

    // 👇 NEW polyfill for url
    url: require.resolve('url/'),
  };

  return config;
})();
