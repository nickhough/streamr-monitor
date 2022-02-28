#! /usr/bin/env node

console.log('Installing');

const fs = require('fs');
const os = require('os');

const envDirectory = `${os.homedir()}/.streamr-monitor/config`;
const envFile = `${envDirectory}/.env`;

if (!fs.existsSync(envDirectory)) {
  fs.mkdirSync(envDirectory, {recursive: true});
}

if (!fs.existsSync(envFile)) {
  fs.copyFileSync(`${process.env.INIT_CWD}/.env.template`, envFile);
  console.log(`.env file copied: ${envFile}`);
} else {
  console.log(`.env file already exists: ${envFile}`);
}
