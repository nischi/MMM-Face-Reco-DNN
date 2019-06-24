/* Magic Mirror
 * Module: MMM-Face-Reco-DNN
 *
 * By Thierry Nischelwitzer http://nischi.ch
 * MIT Licensed.
 */

'use strict';

Module.register("MMM-Face-Reco-DNN", {
	defaults: {
    // Logout 15 seconds after user was not detecte anymore, if they will be detected between this 15
    // Seconds, they delay will start again
    logoutDelay: 15000,
    // How many time the recognition starts, with a RasPi 3+ it would be good every 2 seconds
    checkInterval: 2000,
    // Module set used for strangers and if no user is detected
    defaultClass: "default",
    // Set of modules which should be shown for every user
    everyoneClass: "everyone",
    // xml to recognize with haarcascae
    cascade: 'tools/haarcascade_frontalface_default.xml',
    // pre encoded pickle with the faces
    encodings: 'tools/encodings.pickle',
    // You wanna use pi camera or usb / builtin (1 = raspi camera, 0 = other camera)
    usePiCamera: 1,
    // method of face detection (dnn = deep neural network, haar = haarcascade)
    method: 'dnn',
    // hich face detection model to use. "hog" is less accurate but faster on CPUs. "cnn" is a more accurate
    // deep-learning model which is GPU/CUDA accelerated (if available). The default is "hog".
    detectionMethod: 'hog'
	},

	timouts: {},

	start: function() {
    this.config = Object.assign({}, this.defaults, this.config);
		this.sendSocketNotification('CONFIG', this.config);
    Log.log("Starting module: " + this.name);
	},

	// Define required translations.
	getTranslations: function() {
		return {
			en: "translations/en.json",
			de: "translations/de.json",
      es: "translations/es.json",
      zh: "translations/zh.json",
      nl: "translations/nl.json",
			sv: "translations/sv.json",
			fr: "translations/fr.json",
			id: "translations/id.json"
		};
  },

	login_user: function (name) {
    var self = this;

    MM.getModules()
      .withClass(this.config.defaultClass)
      .exceptWithClass(this.config.everyoneClass)
      .enumerate(function(module) {
			module.hide(1000, function() {
				Log.log(module.name + ' is hidden.');

        MM.getModules()
          .withClass(name)
          .enumerate(function(module) {
					module.show(1000, function() {
						Log.log(module.name + ' is shown.');
					}, {
            lockString: self.identifier
          });
				});
			}, {
        lockString: self.identifier
      });
		});
  },

	logout_user: function (name) {
    var self = this;

		MM.getModules().withClass(name).enumerate(function(module) {
			module.hide(1000, function() {
				Log.log(module.name + ' is hidden.');

        MM.getModules()
          .withClass(self.config.defaultClass)
          .exceptWithClass(self.config.everyoneClass)
          .enumerate(function(module) {
					module.show(1000, function() {
						Log.log(module.name + ' is shown.');
					}, {
            lockString: self.identifier
          });
				});
			}, {
        lockString: self.identifier
      });
		});
	},

	socketNotificationReceived: function(notification, payload) {
		var self = this;

		// somebody has logged in
		if (payload.action == "login") {
			for (user in payload.users) {
				this.login_user(user);

				if (this.timouts[user] != null) {
					clearTimeout(this.timouts[user]);
				}
			}

			this.sendNotification("USERS_LOGIN", payload.users);
		}
		// somebody has logged out
		else if (payload.action == "logout") {
			for (user in payload.users) {
				this.timouts[user] = setTimeout(function() {
					self.logout_user(user);
				}, this.config.logoutDelay);
			}

			this.sendNotification("USERS_LOGOUT", payload.users);
		}
	},

	notificationReceived: function(notification, payload, sender) {
    // Event if DOM is created
		if (notification === 'DOM_OBJECTS_CREATED') {
      var self = this;
      // Show all Modules with default class
			MM.getModules().exceptWithClass(this.config.defaultClass).enumerate(function(module) {
				module.hide(0, function() {
					Log.log('Module is hidden.');
        }, {
          lockString: self.identifier
        });
			});
		}
	}
});
