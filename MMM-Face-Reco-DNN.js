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
    cascade: 'modules/MMM-Face-Reco-DNN/tools/haarcascade_frontalface_default.xml',
    // pre encoded pickle with the faces
    encodings: 'modules/MMM-Face-Reco-DNN/tools/encodings.pickle',
    // You wanna use pi camera or usb / builtin (1 = raspi camera, 0 = other camera)
    usePiCamera: 1,
    // method of face detection (dnn = deep neural network, haar = haarcascade)
    method: 'dnn',
    // which face detection model to use. "hog" is less accurate but faster on CPUs. "cnn" is a more accurate
    // deep-learning model which is GPU/CUDA accelerated (if available). The default is "hog".
    detectionMethod: 'hog',
    // how fast in ms should the modules hide and show (face effect)
    animationSpeed: 0
	},

	timouts: {},
	users: [],

	start: function() {
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
				module.hide(self.config.animationSpeed, function() {
					Log.log(module.name + ' is hidden.');
				}, {
					lockString: self.identifier
				});
			});

		MM.getModules()
			.withClass(name.toLowerCase())
			.enumerate(function(module) {
				module.show(self.config.animationSpeed, function() {
					Log.log(module.name + ' is shown.');
				}, {
					lockString: self.identifier
				});
			});
  },

	logout_user: function (name) {
    var self = this;

		MM.getModules()
			.withClass(name.toLowerCase())
			.enumerate(function(module) {
				module.hide(self.config.animationSpeed, function() {
					Log.log(module.name + ' is hidden.');

				}, {
					lockString: self.identifier
				});
			});

		if (this.users.length === 0) {
			MM.getModules()
				.withClass(self.config.defaultClass)
				.exceptWithClass(self.config.everyoneClass)
				.enumerate(function(module) {
					module.show(self.config.animationSpeed, function() {
						Log.log(module.name + ' is shown.');
					}, {
						lockString: self.identifier
					});
				});
		}
	},

	socketNotificationReceived: function(notification, payload) {
		var self = this;

		// somebody has logged in
		if (payload.action == "login") {
			for (var user of payload.users) {
				this.users.push(user);
				this.login_user(user);

				if (this.timouts[user] != null) {
					clearTimeout(this.timouts[user]);
				}
			}

			this.sendNotification("USERS_LOGIN", payload.users);
		}

		// somebody has logged out
		else if (payload.action == "logout") {
			for (var user of payload.users) {
				this.timouts[user] = setTimeout(function() {
					self.users.splice(self.users.indexOf(user), 1);
					self.logout_user(user);
				}, this.config.logoutDelay);
			}

			this.sendNotification("USERS_LOGOUT", payload.users);
		}
	},

	notificationReceived: function(notification, payload, sender) {
		var self = this;

    // Event if DOM is created
		if (notification === 'DOM_OBJECTS_CREATED') {
      // Show all Modules with default class
			MM.getModules()
				.exceptWithClass(this.config.defaultClass)
				.enumerate(function(module) {
					module.hide(0, function() {
						Log.log('Module is hidden.');
					}, {
						lockString: self.identifier
					});
				});
		}

		// load logged in users
		if (notification === 'GET_LOGGED_IN_USERS') {
			Log.log(module.name + ' get logged in users ' + this.users);
			this.sendNotification("LOGGED_IN_USERS", this.users);
		}
	}
});
