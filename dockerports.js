/**
 * Get the private ports for active modules to serve .ed locally running apps
 * @module dockerports
 */

const Docker = require('dockerode');
const fs     = require('fs-extra');
const prettyFormat = require('pretty-format'); // eslint-disable-line no-unused-vars

 // Object of {host: {httpPort, httpsPort}}
var cachedPorts;

module.exports = {
  /**
   * Returns cached ports object (refreshing if new) to map host to virtual ports
   * 
   * @returns {Object} {host: {httpPort, httpsPort}}
   */
  getPorts: async function() {
    if (cachedPorts) return cachedPorts;
    cachedPorts = await this.refreshContainerPorts();
    return cachedPorts;
  },
  /**
   * Refreshes cached ports object using docker api
   *
   * @returns {Object} {host: {httpPort, httpsPort}}
   */
  refreshContainerPorts: async function () {
    const socket = '/tmp/docker.sock';
  
    const stats  = await fs.stat(socket);
    if (!stats.isSocket()) {
      throw new Error('Could not find /tmp/docker.sock - is volume setup correctly?');
    }

    const docker = new Docker({ socketPath: socket });

    const ports = {};
    const containers = await docker.listContainers();
    const promiseContainers = [];
    containers.forEach((container) => {
      promiseContainers.push(async function (pcontainer) {
        const containerObject = docker.getContainer(pcontainer.Id);
        const json = await containerObject.inspect();
        // console.log(prettyFormat(json.Name));
        env = json.Config.Env;
        let virtualPort = '';
        let virtualProto = '';
        let virtualHost = '';
        // locate relevant values
        env.forEach(item => {
          const itemName = item.substring(0, item.indexOf('='));
          const itemValue = item.substring(item.indexOf('=') + 1);
          if (itemName === 'VIRTUAL_PORT') virtualPort = itemValue;
          if (itemName === 'VIRTUAL_PROTO') virtualProto = itemValue;
          if (itemName === 'VIRTUAL_HOST') virtualHost = itemValue;
        });
        // console.log(`virtualHost: ${virtualHost} virtualPort: ${virtualPort} virtualProto: ${virtualProto}`);
        if (virtualHost) {
          virtualHost.split(',').forEach(host => {
            ports[host] = {};
            if (virtualProto === 'https') {
              ports[host].httpsPort = virtualPort;
            } else {
              ports[host].httpPort = virtualPort || '80';
            }
          })
        }
      }(container));
    });
    await Promise.all(promiseContainers);
    // console.log(`ports: ${prettyFormat(ports)}`);
    return ports;
  }
 }
