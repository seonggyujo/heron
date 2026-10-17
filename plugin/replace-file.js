/**
 * Replaces a file in one step: writes a temporary file next to it, then renames it over the file,
 * so a reader never sees half of it. Throws when it fails; the folder must exist.
 */
'use strict';

const fs = require('fs');

function replaceFile(file, text) {
  const tmp = file + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
}

module.exports = { replaceFile };
