# Summary

This package parses PM2 log files and utilizes a Streamr broker node to send messages.

# Prerequisites

The host that is running your broker node(s) will need to utilize [PM2](https://pm2.io/docs/runtime/guide/installation/) to manage the processes. 

You'll need to know the name of each PM2 process you want to monitor. You can specify the names when 
starting your broker nodes.

If you wanted to start a broker node with a PM2 name of `foo`, you would use the following:

`pm2 start --name foo streamr-broker -- /your/home/directory/.streamr/config/default.json`

To review the state of PM2, you can run a status check:

`pm2 status`

If everything worked, you should see a table with your broker node running.

# Install

`npm install -g streamr-monitor`

After the package has been installed, you'll need to edit to the `.env` file that was created, located at:

`/your/home/directory/.streamr-monitor/config/.env`

```
BROKER_NODE_URL=http://your-broker-node.com
BROKER_NODE_PORT=7101
BROKER_NODE_APKI_KEY=yourBrokerNodeApiAuthenticationKey

STREAM_ID=yourStreamId

PM2_LOG_DIRECTORY=/probably/your/home/directory/.pm2/logs
PM2_NAMES=foo,bar,hello,world
```

# Check ENV

After you've updated the `.env`, you can confirm the environment variables are being found:

`streamr-monitor env`

# Start

If everything looks good, you're now ready to start the monitor.

`streamr-monitor start` 

You may even want to utilize PM2 to manage the monitor as well, in which case you'd start the monitor like this:

`pm2 start --name monitor streamr-monitor`
