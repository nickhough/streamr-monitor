#! /usr/bin/env node

console.log('Installing');

const fs = require('fs');
const os = require('os');

const envDirectory = `${os.homedir()}/.streamr-monitor/config`;
const envFile = `${envDirectory}/.env`;

const nodesYmlDirectory = `${os.homedir()}/.streamr/config`;
const nodesYmlFile = `${nodesYmlDirectory}/nodes.yml`;

if (!fs.existsSync(nodesYmlDirectory)) {
  fs.mkdirSync(nodesYmlDirectory, {recursive: true});
}

if (!fs.existsSync(envDirectory)) {
  fs.mkdirSync(envDirectory, {recursive: true});
}

if (!fs.existsSync(envFile)) {
  fs.copyFileSync(`./.env.template`, envFile);
  console.log(`.env file copied: ${envFile}`);
} else {
  console.log(`.env file already exists: ${envFile}`);
}

if (!fs.existsSync(nodesYmlFile)) {
  fs.copyFileSync(`./nodes.yml`, nodesYmlFile);
  console.log(`.env file copied: ${nodesYmlFile}`);
} else {
  console.log(`.env file already exists: ${nodesYmlFile}`);
}
