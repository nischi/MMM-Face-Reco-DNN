/* Magic Mirror
 * Module: MMM-Face-Reco-DNN
 *
 * By Thierry Nischelwitzer http://nischi.ch
 * MIT Licensed.
 */

'use strict';

Module.register("MMM-Face-Reco-DNN", {
	defaults: {
    logoutDelay: 15000,
    checkInterval: 2000,
    defaultClass: "default",
    everyoneClass: "everyone",
    welcomeMessage: true,
    cascade: 'tools/haarcascade_frontalface_default.xml',
    encodings: 'tools/encodings.pickle',
    usePiCamera: 1,
    method: 'dnn',
    detectionMethod: 'hog'
  },

	start: function() {
		this.config = Object.assign({}, this.defaults, this.config);
    Log.log("Starting module: " + this.name);
	}
});
