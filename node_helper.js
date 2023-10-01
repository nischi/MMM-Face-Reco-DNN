/* Magic Mirror
 * Module: MMM-Face-Reco-DNN
 *
 * By Thierry Nischelwitzer http://nischi.ch
 * MIT Licensed.
 */

/*global require, module, log*/

'use strict';

const NodeHelper = require('node_helper');
const { PythonShell } = require('python-shell');
const onExit = require('signal-exit');
var pythonStarted = false;

module.exports = NodeHelper.create({
  pyshell: null,
  python_start: function () {
    const self = this;
    const extendedDataset = this.config.extendDataset ? 'True' : 'False';
    const options = {
      mode: 'json',
      stderrParser: line => JSON.stringify(line),
      args: [
        '--cascade=' + this.config.cascade,
        '--encodings=' + this.config.encodings,
        '--rotateCamera=' + this.config.rotateCamera,
        '--method=' + this.config.method,
        '--detectionMethod=' + this.config.detectionMethod,
        '--interval=' + this.config.checkInterval,
        '--output=' + this.config.output,
        '--outputmm=' + this.config.outputmm,
        '--extendDataset=' + extendedDataset,
        '--dataset=' + this.config.dataset,
        '--tolerance=' + this.config.tolerance,
        '--brightness=' + this.config.brightness,
        '--contrast=' + this.config.contrast,
        '--resolution=' + this.config.resolution,
        '--processWidth=' + this.config.processWidth,
      ],
    };

    if (this.config.pythonPath != null && this.config.pythonPath !== '') {
      options.pythonPath = this.config.pythonPath;
    }

    // Start face reco script
    self.pyshell = new PythonShell('modules/' + this.name + '/tools/recognition.py', options);

    // check if a message of the python script is comming in
    self.pyshell.on('message', function (message) {
      // A status message has received and will log
      if (Object.prototype.hasOwnProperty.call(message, 'status')) {
        console.log('[' + self.name + '] ' + message.status);
      }

      // Somebody new are in front of the camera, send it back to the Magic Mirror Module
      if (Object.prototype.hasOwnProperty.call(message, 'camera_image')) {
        self.sendSocketNotification('camera_image', {
          image: message.camera_image.image,
        });
      }

      // Check if we get an image to show in the mirror
      if (Object.prototype.hasOwnProperty.call(message, 'login')) {
        console.log('[' + self.name + '] ' + 'Users ' + message.login.names.join(' - ') + ' logged in.');
        self.sendSocketNotification('user', {
          action: 'login',
          users: message.login.names,
        });
      }

      // Somebody left the camera, send it back to the Magic Mirror Module
      if (Object.prototype.hasOwnProperty.call(message, 'logout')) {
        console.log('[' + self.name + '] ' + 'Users ' + message.logout.names.join(' - ') + ' logged out.');
        self.sendSocketNotification('user', {
          action: 'logout',
          users: message.logout.names,
        });
      }
    });

    // Shutdown node helper
    self.pyshell.end(function (err) {
      if (err) throw err;
      console.log('[' + self.name + '] ' + 'finished running...');
    });

    onExit(function (_code, _signal) {
      self.destroy();
    });
  },

  python_stop: function () {
    this.destroy();
  },

  destroy: function () {
    console.log('[' + this.name + '] ' + 'Terminate python');
    this.pyshell.childProcess.kill();
  },

  socketNotificationReceived: function (notification, payload) {
    // Configuration are received
    if (notification === 'CONFIG') {
      this.config = payload;
      // Set static output to 0, because we do not need any output for MMM
      this.config.output = 0;
      if (!pythonStarted) {
        pythonStarted = true;
        this.python_start();
      }
    }
  },

  stop: function () {
    pythonStarted = false;
    this.python_stop();
  },
});
