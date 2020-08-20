/* Magic Mirror
 * Module: MMM-Face-Reco-DNN
 *
 * By Thierry Nischelwitzer http://nischi.ch
 * MIT Licensed.
 */

'use strict';

Module.register('MMM-Face-Reco-DNN', {
  defaults: {
    // Logout 15 seconds after user was not detecte anymore, if they will be detected between this 15
    // Seconds, they delay will start again
    logoutDelay: 15000,
    // How many time the recognition starts, with a RasPi 3+ it would be good every 2 seconds
    checkInterval: 2000,
    // Module set used for when there is no face detected ie no one is in front of the camera
    noFaceClass: 'noface',
    // Module set used for when there is an unknown/unrecognised face detected 
    unknownClass: 'unknown',
    // Module set used for when there is a known/recognised face detected 
    knownClass: 'known',
    // Module set used for strangers and if no user is detected
    defaultClass: 'default',
    // Set of modules which should be shown for any user ie when there is any face detected
    everyoneClass: 'everyone',
    // Set of modules that are always shown - show if there is a face or no face detected
    alwaysClass: 'always',
    // xml to recognize with haarcascae
    cascade:
      'modules/MMM-Face-Reco-DNN/tools/haarcascade_frontalface_default.xml',
    // pre encoded pickle with the faces
    encodings: 'modules/MMM-Face-Reco-DNN/tools/encodings.pickle',
    // You wanna use pi camera or usb / builtin (1 = raspi camera, 0 = other camera)
    usePiCamera: 1,
    // if you don't use the pi camera, which stream do you want to use
    source: 0,
    // rotate camera?
    rotateCamera: 0,
    // method of face recognition (dnn = deep neural network, haar = haarcascade)
    method: 'dnn',
    // which face detection model to use. "hog" is less accurate but faster on CPUs. "cnn" is a more accurate
    // deep-learning model which is GPU/CUDA accelerated (if available). The default is "hog".
    detectionMethod: 'hog',
    // how fast in ms should the modules hide and show (face effect)
    animationSpeed: 0,
    // Path to Python to run the face recognition (null / '' means default path)
    pythonPath: null,
    // Boolean to toggle welcomeMessage
    welcomeMessage: true,
    // Save some pictures from recognized people, if unknown we save it in folder "unknown"
    // So you can extend your dataset and retrain it afterwards for better recognitions
    extendDataset: false,
    // if extenDataset is set, you need to set the full path of the dataset
    dataset: 'modules/MMM-Face-Reco-DNN/dataset/',
    // How much distance between faces to consider it a match. Lower is more strict.
    tolerance: 0.6,
    // allow multiple concurrent user logins, 0=no, 1=yes
    multiUser: 0,
    // turn on extra debugging 0=no, 1=yes
    debug: 0,
    
  },

  timouts: {},
  users: [],

  // ----------------------------------------------------------------------------------------------------
  start: function() {
    this.sendSocketNotification('CONFIG', this.config);
    Log.log('Starting module: ' + this.name);

    this.config.debug && Log.log(this.config);

    // there are 3 states (noface, unknown face, known face). Each of these has classes that allow them
    // this configuration defines which classes provide which states
    this.config.classes_noface =[this.config.noFaceClass, this.config.defaultClass,                           this.config.alwaysClass];
    this.config.classes_unknown=[this.config.unknownClass,this.config.defaultClass, this.config.everyoneClass,this.config.alwaysClass];
    this.config.classes_known  =[this.config.knownClass,                            this.config.everyoneClass,this.config.alwaysClass];

  },

  // ----------------------------------------------------------------------------------------------------
  // Define required translations.
  getTranslations: function() {
    return {
      en: 'translations/en.json',
      de: 'translations/de.json',
      es: 'translations/es.json',
      zh: 'translations/zh.json',
      nl: 'translations/nl.json',
      sv: 'translations/sv.json',
      fr: 'translations/fr.json',
      id: 'translations/id.json',
      it: 'translations/it.json',
      bg: 'translations/bg.json',
      ru: 'translations/ru.json',
    };
  },

  // ----------------------------------------------------------------------------------------------------
  login_user: function(name) {
    var self = this;
    
    Log.log('Logged in user:' + name);
    this.config.debug && Log.log('User list:' + this.users);

    // what we do here depends on if we recognise the user or not
    if (name === 'unknown') {
      // this is the state of an unknown face
      // we want to show the new classes allowed by this target state (unknown state)
      this.show_modules(this.config.classes_unknown,this.config.classes_noface);
      
      // we want to hide the old classes from the previous state (noface state)
      this.hide_modules(this.config.classes_noface,this.config.classes_unknown);

    } else {
     // this is the state of a known face
     // we want to show the new classes allowed by this target state (known state)
     // copy the config classes to a new array
     var newClasses=this.config.classes_known.slice();
     this.config.debug && Log.log('Adding ' + name + ' to ' + this.config.classes_known);
     newClasses.push(name.toLowerCase());
     
     // we want to show the new classes allowed by this target state (known state)
     this.show_modules(newClasses,this.config.classes_noface);
      
      // we want to hide the old classes from the previous state (noface state)
      this.hide_modules(this.config.classes_noface,newClasses);
    }
    
    // now show a welcome message
    if (this.config.welcomeMessage) {
      var person = name;
      var welcomeMessage;
  
      // We get unknown from Face-Reco and then it should be translated to stranger
      if (person === 'unknown') {
        person = this.translate('stranger');
        welcomeMessage = this.translate('unknownlogin').replace('%person', person);
      } else {
        // set up the slightly different message for a known person
        welcomeMessage = this.translate('knownlogin').replace('%person', person);
      }

      this.sendNotification('SHOW_ALERT', {
        type: 'notification',
        message: welcomeMessage,
        title: this.translate('title'),
      });
    }

    
  },

  // ----------------------------------------------------------------------------------------------------
  logout_user: function(name) {
    var self = this;

    Log.log('Logged out user:' + name);
    this.config.debug && Log.log('User list:' + this.users);

    // see how many users are left
    if (this.users.length === 0) {
      // no users left, so we are going to the noface state
      // the name of the logging out user determines what state we are coming from
      
      // what we do here depends on if we recognise the user or not
      if (name === 'unknown') {
       // this is the transition from the unknown state to the noface state

       // we want to show the new classes allowed by this target state (noface state)
       this.show_modules(this.config.classes_noface,this.config.classes_unknown);

       // we want to hide the old classes from the previous state (unknown state)
       this.hide_modules(this.config.classes_unknown,this.config.classes_noface);
       
      } else {
       // this is the transition from the known state to the noface state

       // we want to show the new classes allowed by this target state (noface state)
       // copy the config classes to a new array
       var oldClasses=this.config.classes_known.slice();
       this.config.debug && Log.log('Adding ' + name + ' to ' + this.config.classes_known);
       oldClasses.push(name.toLowerCase());
       
       // we want to show the new classes allowed by this target state (noface state)
       this.show_modules(this.config.classes_noface,oldClasses);
        
       // we want to hide the old classes from the previous state (known state)
       this.hide_modules(oldClasses,this.config.classes_noface);
      }
    } else {
      // in this transition we go from multiple users to a lower number of users, leaving one or more logged in
      // the logic for this is not fully developed
      // to do this properly you have to go through all the remaining users and work out what classes would be left after we remove this one user
      // start by removing only the classes related to this user
      // this might not always be right as you might leave behind an unknown user etc
      // what we do here depends on if we recognise the user or not
      if (name === 'unknown') {
       // we want to hide the old classes related to an unknown users
       this.config.debug && Log.log('Hiding all old classes:' + this.config.classes_unknown);
       
      } else {
       var oldClasses=this.config.classes_known;
       oldClasses.push(name.toLowerCase());
       
       // we want to hide the old classes related to a known user
       this.hide_modules(oldClasses,0);
      }
    }
    
  },

  // ----------------------------------------------------------------------------------------------------
  show_modules: function(showClasses,exceptClasses) {
    // show modules with "showClasses" except for those with "exceptClasses"
    var self = this;
    this.config.debug && Log.log('Showing all new classes:' + showClasses + ', except old classes:' + exceptClasses);
    MM.getModules()
      .withClass(showClasses)
      .exceptWithClass(exceptClasses)
      .enumerate(function(module) {
       module.show(
         self.config.animationSpeed,
         function() {
           Log.log(module.name + ' is shown.');
         },
         {
           lockString: self.identifier,
         }
       );
      });
  },
  // ----------------------------------------------------------------------------------------------------
  hide_modules: function(hideClasses,exceptClasses) {
    // hide modules with "hideClasses" except for those with "exceptClasses"
    var self = this;
    // there must be a fancier javascript way to do this if with just runs that same getModules code but with different collections of selectors
    // look to fix this later
    if (hideClasses===0) {
      this.config.debug && Log.log('Hiding all classes except new classes:' + exceptClasses);
      MM.getModules()
       .exceptWithClass(exceptClasses)
       .enumerate(function(module) {
         module.hide(
           self.config.animationSpeed,
           function() {
             Log.log(module.name + ' is hidden.');
           },
           {
             lockString: self.identifier,
           }
         );
       });
    } else if (exceptClasses===0) {
      this.config.debug && Log.log('Hiding old classes:' + hideClasses);
      MM.getModules()
       .withClass(hideClasses)
       .enumerate(function(module) {
         module.hide(
           self.config.animationSpeed,
           function() {
             Log.log(module.name + ' is hidden.');
           },
           {
             lockString: self.identifier,
           }
         );
       });
    } else {
      this.config.debug && Log.log('Hiding all old classes:' + hideClasses + ', except new classes:' + exceptClasses);
      MM.getModules()
       .withClass(hideClasses)
       .exceptWithClass(exceptClasses)
       .enumerate(function(module) {
         module.hide(
           self.config.animationSpeed,
           function() {
             Log.log(module.name + ' is hidden.');
           },
           {
             lockString: self.identifier,
           }
         );
       });
    }
    
    
  },
  // ----------------------------------------------------------------------------------------------------
  socketNotificationReceived: function(notification, payload) {
    var self = this;
    var user;

    // somebody has logged in
    if (payload.action === 'login') {
      for (user of payload.users) {
        if (user != null) {
          
          // if there are currently no users logged in OR we allow multiple users
          if (this.users.length === 0 || this.config.multiUser) {
            // check if the user is already logged in
            if (!this.users.includes(user)) {
              // user not currently logged in so add them to the list of logged in users
              this.users.push(user);
              // run the login procedure
              this.login_user(user);
            } else {
              this.config.debug && Log.log('Detected ' + user + ' again.');
            }
          } else {
            this.config.debug && Log.log('Detected a login event for ' + user + ' but multiple concurrent logins is disabled and ' + this.users + ' is already logged in.');
          }

          // clear any timeouts the user might have so that they stay logged in
          if (this.timouts[user] != null) {
            clearTimeout(this.timouts[user]);
          }
        }
      }
	  
	  // We still need to broadcast MM notification for backward compatability.
      this.sendNotification('USERS_LOGIN', payload.users);
    } else if (payload.action === 'logout') {
      for (user of payload.users) {
        if (user != null) {
          // see if user is even logged in, since you can only log out if you are actually logged in
          if (this.users.includes(user)) {
            this.timouts[user] = setTimeout(function() {
              self.users = self.users.filter(function(u) {
                return u !== user;
              });
              self.logout_user(user);
            }, this.config.logoutDelay);
          } else {
            this.config.debug && Log.log('Detected a logout event for ' + user + ' but they were not logged in.');
          }
        }
      }

      this.sendNotification('USERS_LOGOUT', payload.users);
    }
  },

  // ----------------------------------------------------------------------------------------------------
  notificationReceived: function(notification, payload, sender) {
    var self = this;

    // Event if DOM is created
    if (notification === 'DOM_OBJECTS_CREATED') {
      // at startup modules will already be shown
      // we want to hide modules (by class) that are not supposed to be shown
      // in this case we want to hide any class except those which bring us to the noface state
      // this list of classes is contained in this.classes_noface
      this.hide_modules(0,this.config.classes_noface);
    }

    // load logged in users
    if (notification === 'GET_LOGGED_IN_USERS') {
      Log.log(this.name + ' get logged in users ' + this.users);
      this.sendNotification('LOGGED_IN_USERS', this.users);
    }
  },
});
