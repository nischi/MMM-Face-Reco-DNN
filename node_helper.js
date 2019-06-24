/* Magic Mirror
 * Module: MMM-Face-Reco-DNN
 *
 * By Thierry Nischelwitzer http://nischi.ch
 * MIT Licensed.
 */

'use strict';
const NodeHelper = require('node_helper');
const PythonShell = require('python-shell');
var pythonStarted = false

module.exports = NodeHelper.create({
  python_start: function () {
    const self = this;
    // Start face reco script
    const pyshell = new PythonShell('modules/' + this.name + '/tools/facerecognition.py', {
      mode: 'json',
      args: [ JSON.stringify(this.config) ]
    });

    // check if a message of the python script is comming in
    pyshell.on('message', function (message) {
      // A status message has received and will log
      if (message.hasOwnProperty('status')){
        console.log("[" + self.name + "] " + message.status);
      }

      // Somebody new are in front of the camera, send it back to the Magic Mirror Module
      if (message.hasOwnProperty('login')){
        console.log("[" + self.name + "] " + "Users " + message.login.names.join(' - ') + " logged out.");
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
    pyshell.end(function (err) {
      if (err) throw err;
      console.log("[" + self.name + "] " + 'finished running...');
    });
  },

  socketNotificationReceived: function(notification, payload) {
    // Configuration are received
    if(notification === 'CONFIG') {
      this.config = payload
      if(!pythonStarted) {
        pythonStarted = true;
        this.python_start();
        };
    };
  }
});