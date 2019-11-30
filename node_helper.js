/* Magic Mirror
 * Module: MMM-Face-Reco-DNN
 *
 * By Thierry Nischelwitzer http://nischi.ch
 * MIT Licensed.
 */

'use strict';
const NodeHelper = require('node_helper');
const {PythonShell} = require("python-shell");
const onExit = require('signal-exit')
var pythonStarted = false;
var pyshell;

module.exports = NodeHelper.create({
  python_start: function () {
    const self = this;
    const extendedDataset = this.config.extendDataset ? 'True' : 'False';
    const options = {
      mode: 'json',
      stderrParser: (line) => JSON.stringify(line),
      args: [
        '--cascade=' + this.config.cascade,
        '--encodings=' + this.config.encodings,
        '--usePiCamera=' + this.config.usePiCamera,
        '--method=' + this.config.method,
        '--detectionMethod=' + this.config.detectionMethod,
        '--interval=' + this.config.checkInterval,
        '--output=' + this.config.output,
        '--extendDataset=' + extendedDataset,
        '--dataset=' + this.config.dataset
      ]
    }

    if (this.config.pythonPath != null && this.config.pythonPath !== '') {
      options.pythonPath = this.config.pythonPath;
    }

    // Start face reco script
    self.pyshell = new PythonShell('modules/' + this.name + '/tools/facerecognition.py', options);

    // check if a message of the python script is comming in
    self.pyshell.on('message', function (message) {
      // A status message has received and will log
      if (message.hasOwnProperty('status')){
        console.log("[" + self.name + "] " + message.status);
      }

      // Somebody new are in front of the camera, send it back to the Magic Mirror Module
      if (message.hasOwnProperty('login')){
        console.log("[" + self.name + "] " + "Users " + message.login.names.join(' - ') + " logged in.");
        self.sendSocketNotification('user', {
          action: "login",
          users: message.login.names
        });
      }

      // Somebody left the camera, send it back to the Magic Mirror Module
      if (message.hasOwnProperty('logout')){
        console.log("[" + self.name + "] " + "Users " + message.logout.names.join(' - ') + " logged out.");
        self.sendSocketNotification('user', {
          action: "logout",
          users: message.logout.names
        });
      }
    });

    // Shutdown node helper
    self.pyshell.end(function (err) {
      if (err) throw err;
      console.log("[" + self.name + "] " + 'finished running...');
    });

    onExit(function (code, signal) {
      self.destroy();
    })
  },

  python_stop: function() {
    this.destroy();
  },

  destroy: function() {
    console.log("[" + this.name + "] " + "Terminate python");
    this.pyshell.childProcess.kill();
  },

  socketNotificationReceived: function(notification, payload) {
    // Configuration are received
    if(notification === 'CONFIG') {
      this.config = payload
      // Set static output to 0, because we do not need any output for MMM
      this.config['output'] = 0;
      if(!pythonStarted) {
        pythonStarted = true;
        this.python_start();
        };
    };
  },

  stop: function() {
    pythonStarted = false;
    this.python_stop();
  }
});
