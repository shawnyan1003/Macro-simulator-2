'use strict';
/* Delete the save file so the next start begins a new game */
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'data', 'state.json');
let done = false;
if (fs.existsSync(file)) { fs.unlinkSync(file); done = true; }
const tmp = file + '.tmp';
if (fs.existsSync(tmp)) { fs.unlinkSync(tmp); done = true; }
console.log(done ? '🗑️  Save file deleted; the next start begins a new game.' : '✨ No save file found — starting will begin a new game.');
