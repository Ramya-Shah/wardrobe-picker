// Metro config: lets the app import the shared, platform-independent code in ../lib
// (Claude schema, validation, search, outfit logic…) that the web app also uses.
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const sharedLib = path.resolve(projectRoot, "../lib");

const config = getDefaultConfig(projectRoot);

// Watch only ../lib (not the web app's node_modules), and resolve every package —
// including zod/fflate imported from ../lib — from this app's node_modules.
config.watchFolders = [sharedLib];
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, "node_modules")];

module.exports = config;
