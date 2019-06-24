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
    // Should we show a welcome-message
    welcomeMessage: true,
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

	start: function() {
		this.config = Object.assign({}, this.defaults, this.config);
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
});
