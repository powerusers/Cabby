'use strict';

const fs = require('fs');
const path = require('path');

function paths() {
  const dir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
  return { dir, file: path.join(dir, 'operator.json') };
}

function readOperator() {
  const { file } = paths();
  try {
    const raw = fs.readFileSync(file, 'utf8');
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    return data;
  } catch (err) {
    if (err.code === 'ENOENT' || err instanceof SyntaxError) return null;
    throw err;
  }
}

function saveOperator(operator) {
  const { dir, file } = paths();
  try {
    fs.mkdirSync(dir, { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, `${JSON.stringify(operator, null, 2)}\n`, 'utf8');
    fs.renameSync(tmp, file);
  } catch (err) {
    const error = new Error('Could not save operator details on the server.');
    error.status = 500;
    error.cause = err;
    throw error;
  }
  return operator;
}

module.exports = { readOperator, saveOperator };
