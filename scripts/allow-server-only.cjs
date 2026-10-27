// Lets command-line scripts reuse the server code: the "server-only" guard is meant for the
// browser bundle and would otherwise stop Node scripts from importing it.
const path = require.resolve("server-only");
require.cache[path] = { id: path, filename: path, loaded: true, exports: {} };
