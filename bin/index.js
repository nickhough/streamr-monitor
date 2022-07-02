#! /usr/bin/env node

const axios = require('axios');
const dotenv = require('dotenv');
const fs = require('fs');
const moment = require('moment');
const os = require('os');

const command = process.argv.slice(2).length > 0 ? process.argv.slice(2)[0] : null;
const args = process.argv.slice(3).length > 0 ? process.argv.slice(3) : null;

const envDirectory = `${os.homedir()}/.streamr-monitor/config`;
const envFile = `${envDirectory}/.env`;

const ethers = require('ethers');
const streamrBroker = require('streamr-broker/dist/src/config/ConfigWizard');
const streamrDirectory = `${os.homedir()}/.streamr/config`;

const nodesYml = `${streamrDirectory}/nodes.yml`;

dotenv.config({
  path: envFile,
});

const nodes = {};

const skip = [
  'Analyzing NAT type',
  'conn.close(',
  'Brubeck miner plugin started',
  'View your node in the Network Explorer:',
  'WebRTC private address probing is allowed.',
  'Unable to publish NodeMetrics',
  'failed to subscribe (or connect) to',
  'unexpected iceCandidate from',
  'close connection to',
  'Could not connect to tracker',
  'Network node ',
];

const ansiRegex = ({onlyFirst = false} = {}) => {
  const pattern = [
    '[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)',
    '(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))'
  ].join('|');

  return new RegExp(pattern, onlyFirst ? undefined : 'g');
}

const cleanEntry = (entry) => {
  return entry
    .replace(ansiRegex(), '')
    .replace('\n', '')
    .replace('\e', '');
}

const init = () => {

  if (!fs.existsSync(envDirectory)) {
    fs.mkdirSync(envDirectory, {recursive: true});
  }

  if (!fs.existsSync(envFile)) {
    console.log(`.env file missing: ${envFile}`);
  } else {
    console.log(`.env file already exists: ${envFile}`);
  }

  if (!fs.existsSync(streamrDirectory)) {
    fs.mkdirSync(streamrDirectory, {recursive: true});
  }

  if (!fs.existsSync(nodesYml)) {
    fs.copyFileSync(`./nodes.yml`, nodesYml);
  }
};

const parseBrokerVersion = (message, pm2Name) => {
  nodes[pm2Name].version = message.replace('Starting broker version ', '');
};

const parseEthereumAddress = (message, pm2Name) => {
  nodes[pm2Name].ethereumAddress = message.replace('Ethereum address ', '');
};

const parseBrokerName = (message, pm2Name) => {
  nodes[pm2Name].name = message.replace('Welcome to the Streamr Network. Your node\'s generated name is ', '').replace('.', '');
};

const parseHTTPServer = (message, pm2Name) => {

  const port = parseInt(message.replace('HTTP server listening on ', '').trim());

  nodes[pm2Name].http = {
    listening: true,
    port,
  };
};

const parseMQTTServer = (message, pm2Name) => {

  const port = parseInt(message.replace('MQTT server listening on port ', '').trim());

  nodes[pm2Name].mqtt = {
    listening: true,
    port,
  };
};

const parseWebsocketServer = (message, pm2Name) => {

  const port = parseInt(message.replace('Websocket server listening on ', '').trim());

  nodes[pm2Name].websocket = {
    listening: true,
    port,
  };
};

const parsePeers = (message, pm2Name) => {
  nodes[pm2Name].peers = message.split(' (')[1].split('), ')[0].replace(')', '').split(',');
};

const parseTracker = (message, pm2Name) => {

  let trackers = nodes[pm2Name].trackers;

  let tracker = message.replace('Connected to tracker ', '').trim();

  trackers.push(tracker);

  nodes[pm2Name].trackers = [...new Set(trackers)];
};

const parseNATType = (message, pm2Name) => {
  nodes[pm2Name].nat = message.replace('NAT type:', '').trim();
};

const parsePlugins = (message, pm2Name) => {
  nodes[pm2Name].plugins = JSON.parse(message.replace('Plugins: ', ''));
};

const parseRewardCodeReceived = (message, pm2Name, timestamp) => {
  nodes[pm2Name].rewards.lastRewardCodeReceivedAt = timestamp.toDate();
};

const parseRewardCodeClaimed = (message, pm2Name, timestamp) => {
  nodes[pm2Name].rewards.lastRewardCodeClaimedAt = timestamp.toDate();
  nodes[pm2Name].stake = parseInt(message.replace('Reward claimed successfully, current stake ', '').split(' ')[0]);
};

const publishToStreamr = (pm2Name) => {

  const node = nodes[pm2Name];
  const apiKey = process.env.BROKER_NODE_API_KEY;
  const streamId = encodeURIComponent(process.env.STREAM_ID);
  const nodeUrl = process.env.BROKER_NODE_URL;
  const nodePort = process.env.BROKER_NODE_PORT;

  axios.post(`${nodeUrl}:${nodePort}/streams/${streamId}`, {
    ...node,
    pm2Name,
  }, {
    headers: {
      Authorization: `Bearer ${apiKey}`
    },
  }).then((response) => {
    console.log(response.data);
  }).catch((error) => {

  });

}

const processEntry = (entry, pm2Name) => {

  const parts = entry.split('): ');
  const rawDateTime = parts[0].split('] (')[0].replace('INFO [', '').replace('WARN [', '');
  const timestamp = moment(rawDateTime, 'YYYY-MM-DDTHH:mm:ss:SSS').isValid() ? moment(rawDateTime, 'YYYY-MM-DDTHH:mm:ss:SSS') : moment();

  nodes[pm2Name].updatedAt = timestamp.toDate();

  const message = parts[1] || '';

  if (shouldSkip(message)) {
    // console.log(`Skipping: ${message}`);
  } else if (message.startsWith('Starting broker version')) {
    parseBrokerVersion(message, pm2Name);
  } else if (message.startsWith('Ethereum address ')) {
    parseEthereumAddress(message, pm2Name);
  } else if (message.startsWith('Welcome to the Streamr Network.')) {
    parseBrokerName(message, pm2Name);
  } else if (message.startsWith('HTTP server listening')) {
    parseHTTPServer(message, pm2Name);
  } else if (message.startsWith('MQTT server listening')) {
    parseMQTTServer(message, pm2Name);
  } else if (message.startsWith('Websocket server listening')) {
    parseWebsocketServer(message, pm2Name);
  } else if (message.startsWith('Successfully connected to')) {
    parsePeers(message, pm2Name);
  } else if (message.startsWith('Connected to tracker ')) {
    parseTracker(message, pm2Name);
  } else if (message.startsWith('NAT type: ')) {
    parseNATType(message, pm2Name);
  } else if (message.startsWith('Plugins: ')) {
    parsePlugins(message, pm2Name);
  } else if (message.startsWith('Reward code received:')) {
    parseRewardCodeReceived(message, pm2Name, timestamp);
  } else if (message.startsWith('Reward claimed successfully')) {
    parseRewardCodeClaimed(message, pm2Name, timestamp);
  }

};

const setupNodes = () => {

  let serverIndex = args[0];
  let count = args[1];
  let ENV_PM2_NAMES = 'PM2_NAMES=';

  if (!serverIndex) {
    console.log('You must provide a server index');
    return false;
  }

  if (!count) {
    console.log('You must provide the number of nodes');
    return false;
  }

  for (let i = 0; i < count; i++) {

    let offset = i * 10;
    let privateKey = ethers.Wallet.createRandom().privateKey;
    let streamrApiKey = streamrBroker.CONFIG_TEMPLATE.apiAuthentication.keys[0];
    let pm2Name = `${serverIndex}-${i + 1}`;
    ENV_PM2_NAMES += `${i > 0 ? ',' : ''}${pm2Name}`

    let template = {
      '$schema': 'http://schema.streamr.network/config-v1.schema.json',
      'client': {
        'auth': {
          'privateKey': privateKey
        }
      },
      'plugins': {
        'metrics': {},
        'websocket': {
          'port': 7170 + offset,
        },
        'mqtt': {
          'port': 1883 + offset
        },
        'publishHttp': {},
        'brubeckMiner': {}
      },
      'apiAuthentication': {
        'keys': [
          streamrApiKey
        ]
      },
      'httpServer': {
        'port': 7171 + offset
      }
    };

    let file = `${streamrDirectory}/${pm2Name}.json`;

    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, JSON.stringify(template, null, 4), () => {});
    } else {
      console.error(`Node config already exists! [${file}]`);
    }
  }

  // Update .env

  let envContent = fs.readFileSync(envFile).toString();
  envContent = envContent.split(os.EOL).map((line) => {
    return line.startsWith('PM2_NAMES') ? ENV_PM2_NAMES : line;
  }).join(os.EOL);
  fs.writeFileSync(envFile, envContent);

  // Update nodes.yml

  let nodesYmlContent = fs.readFileSync(nodesYml).toString();
  nodesYmlContent = nodesYmlContent.replaceAll('XX-', `${serverIndex}-`);
  fs.writeFileSync(nodesYml, nodesYmlContent);
};

const shouldSkip = (entry) => {

  let shouldSkip = false;

  skip.forEach((skipString) => {
    if (entry.startsWith(skipString)) {
      shouldSkip = true;
    }
  });

  return shouldSkip;
};

const main = () => {

  process.env.PM2_NAMES.split(',').forEach((pm2Name) => {
    nodes[pm2Name] = {
      ethereumAddress: null,
      http: {
        port: null,
        listening: false,
      },
      mqtt: {
        port: null,
        listening: false,
      },
      name: null,
      nat: null,
      peers: [],
      plugins: [],
      rewards: {
        balance: null,
        lastRewardCodeClaimedAt: null,
        lastRewardCodeReceivedAt: null,
      },
      stake: null,
      trackers: [],
      updatedAt: null,
      version: null,
      websocket: {
        port: null,
        listening: false,
      },
    };
  });

  for (let key in nodes) {

    console.info(`${key} | INFO [${moment().format()}] Run Started`);

    const pm2Name = key;
    const logFile = `${process.env.PM2_LOG_DIRECTORY}/${pm2Name}-out.log`;

    fs.readFile(logFile, 'utf8', (err, data) => {

      data.split('\n')
        .map((entry) => cleanEntry(entry))
        .filter(entry => entry.trim())
        .map(entry => processEntry(entry, pm2Name));

      publishToStreamr(pm2Name);

      console.info(`${key} | INFO [${moment().format()}] Run Complete`);
    });
  }

}

switch (command) {
  case 'init':
    init();
    break;

  case 'env':
    console.log(process.env);
    break;

  case 'setupNodes':
    setupNodes();
    break;

  case 'start':
  default:

    if (!process.env.PM2_NAMES) {
      console.log('No PM2_NAMES found in .env');
      init();
    } else {
      main();
      setInterval(main, 60 * 1000);
    }

    break;
}






