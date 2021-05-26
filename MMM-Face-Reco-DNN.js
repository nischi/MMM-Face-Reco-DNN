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
    // Dictionary for person name mapping in welcome message
    // Allows for displaying name with complex character sets in welcome message 
    // e.g. jerome => Jérôme, hideyuki => 英之, mourad => مراد 
    usernameDisplayMapping: null,
    // Save some pictures from recognized people, if unknown we save it in folder "unknown"
    // So you can extend your dataset and retrain it afterwards for better recognitions
    extendDataset: false,
    // if extenDataset is set, you need to set the full path of the dataset
    dataset: 'modules/MMM-Face-Reco-DNN/dataset/',
    // How much distance between faces to consider it a match. Lower is more strict.
    tolerance: 0.6,
    // allow multiple concurrent user logins, 0=no, any other number is the maximum number of concurrent logins
    multiUser: 0,
    // turn on extra debugging 0=no, 1=yes
    debug: 0,
    
  },

  timouts: {},
  users: [],
  userClasses: [],

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
      nb: 'translations/nb.json',
    };
  },

  // ----------------------------------------------------------------------------------------------------
  login_user: function(name) {
    var self = this;
    var thisUserClasses;
    var existingClasses;
    var newClassList;
    
    this.config.debug && Log.log('User list before login:' + this.users);
    Log.log('Logged in user:' + name);
    // user not currently logged in so add them to the list of logged in users
    this.users.push(name);
    this.config.debug && Log.log('User list after login:' + this.users);

    if (this.users.length===1) {
      // this is the login of the first user
      // this means we are coming from a noface state
      existingClasses=this.config.classes_noface;
    } else if (this.users.length>1) {
      // there is at least one user already logged in so the list of existing classes comes from this.userClasses
      existingClasses=this.get_class_set(this.userClasses);
    }

    this.config.debug && Log.log('User Classes Before Login');
    this.config.debug && Log.log(existingClasses);

    // what we do here depends on if we recognise the user or not
    if (name === 'unknown') {
      // this is the state of an unknown face
      // we want to show the new classes allowed by this target state (unknown state)
      thisUserClasses=this.config.classes_unknown;
    } else {
      // this is the state of a known face
      // we want to show the new classes allowed by this target state (known state)
      // copy the config classes to a new array
      var newClasses=this.config.classes_known.slice();
      this.config.debug && Log.log('Adding ' + name + ' to classlist:' + this.config.classes_known);
      // add the specific classes for this new known user
      newClasses.push(name.toLowerCase());
      thisUserClasses=newClasses;
    }

    // add the new user's classes to the list of user classes
    this.userClasses[name]=thisUserClasses;
    this.config.debug && Log.log('User Classes After Login');
    this.config.debug && Log.log(this.userClasses);
    
    // so the full list of all classes that should be shown is now in userClasses
    newClassList=this.get_class_set(this.userClasses);

    // show all the new classes from the new user except the existing classes
    this.show_modules(newClassList,existingClasses);
      
    // we want to hide the old classes from the previous state, except those shown by the new user
    this.hide_modules(existingClasses,newClassList);

    // now show a welcome message
    if (this.config.welcomeMessage) {
      var person = name;
      var welcomeMessage;
  
      // We get unknown from Face-Reco and then it should be translated to stranger
      if (person === 'unknown') {
        person = this.translate('stranger');
        welcomeMessage = this.translate('unknownlogin').replace('%person', person);
      } else {
        // set up the slightly different message for a known person, attempt to find a Name mapping for display purposes
        var personDisplayName = person;
        if (this.config.usernameDisplayMapping && this.config.usernameDisplayMapping[person]) {
          personDisplayName = this.config.usernameDisplayMapping[person];
        } 
        welcomeMessage = this.translate('knownlogin').replace('%person', personDisplayName);
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

    this.config.debug && Log.log('User list before logout:' + this.users);
    Log.log('Logged out user:' + name);
    
    // just double check the the user we are logging out is actually logged in
    if (this.users.includes(name)) {
      // it does include the user so all good

      // remove the user from the list of users
      this.users = this.users.filter(function(u) {
        return u !== name;
      });
      
      this.config.debug && Log.log('User list after logout:' + this.users);
      
      // remove the users property from the list of classes
      // copy the class list to another array before deleting the logging out user
      this.config.debug && Log.log('User Classes Before Logout');
      this.config.debug && Log.log(this.userClasses);
      var oldUserClasses=Object.assign({},this.userClasses); // assign works doing a shallow copy because the object is simply enough

      // delete the user from the list of user classes
      delete this.userClasses[name];

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
         this.config.debug && Log.log('Adding ' + name + ' to classlist: ' + this.config.classes_known);
         oldClasses.push(name.toLowerCase());
         
         // we want to show the new classes allowed by this target state (noface state)
         this.show_modules(this.config.classes_noface,oldClasses);
          
         // we want to hide the old classes from the previous state (known state)
         this.hide_modules(oldClasses,this.config.classes_noface);
        }
      } else {
        // in this transition we go from multiple users to a lower number of users, leaving one or more logged in
        // to do this properly you have to go through all the remaining users and work out what classes would be left after we remove this one user

        this.config.debug && Log.log('User Classes Remaining');
        this.config.debug && Log.log(this.userClasses);

        // build shownClasses to be the list of classes that are showing now
        var shownClasses=this.get_class_set(oldUserClasses);
        this.config.debug && Log.log('Returned Showing List of Classes');
        this.config.debug && Log.log(shownClasses);

        // build remainingClasses to be the list of classes that still should be shown
        var remainingClasses=this.get_class_set(this.userClasses);
        this.config.debug && Log.log('Returned Remaining List of Classes');
        this.config.debug && Log.log(remainingClasses);

        this.config.debug && Log.log('Hide:' + shownClasses + ' except:' + remainingClasses);
        this.hide_modules(shownClasses,remainingClasses);
        
      }
    } else {
      // not how we get to here, but we do. It should be stopped in the socketNotificationReceived function but somehow either something else calls this function or that code does not work
      this.config.debug && Log.log('Detected a logout_user call for ' + name + ' but they were not logged in.');
    }
    
  },

  // ----------------------------------------------------------------------------------------------------
  get_class_set: function(userClasses) {
    // function to take all the classes from logged in users and work out the total set (no duplicates) of the classes
    var self = this;

    // all the classes from all the logged in users are in this.userClasses like
    // this.userClasses[user1]=array of classes
    // this.userClasses[user2]=array of classes
    // etc
    
    var classList=[];
    var finalClasses=[];
    
    Object.values(userClasses).forEach(function(classes) {
      // classes is an array of classes for a user
      classes.forEach(val=>classList[val]=1);      
    });

    // classList should now have a unique list of the classes as properties
    Object.keys(classList).forEach(function(val) {
      // val is a string which is the name of a class
      finalClasses.push(val);
    });
    
    return finalClasses;
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
      var loginCount=0;
      for (user of payload.users) {
        if (user != null) {
          
          // if there are currently no users logged in OR we allow multiple users
          this.config.debug && Log.log('Number of logged in users:' + this.users.length + ', Allowed Number of Users:' + this.config.multiUser);
          if (this.users.length === 0 || this.users.length < this.config.multiUser) {
            // check if the user is already logged in
            if (!this.users.includes(user)) {
              // run the login procedure
              this.login_user(user);
              // increment the counter
              loginCount++;
            } else {
              this.config.debug && Log.log('Detected ' + user + ' again.');
            }
          } else {
            this.config.debug && Log.log('Detected a login event for ' + user + ' but multiple concurrent logins is limited to ' + this.config.multiUser +  ' and ' + this.users + ' is already logged in.');
          }

          // clear any timeouts the user might have so that they stay logged in
          if (this.timouts[user] != null) {
            this.config.debug && Log.log('Clearing timeouts for ' + user);
            this.config.debug && Log.log('Remaining timeouts BEFORE:')
            this.config.debug && Log.log(this.timouts);
            clearTimeout(this.timouts[user]);
            this.config.debug && Log.log('Remaining timeouts AFTER:')
            this.config.debug && Log.log(this.timouts);
          }
        }
      }

      if (loginCount>0) {
         // We still need to broadcast MM notification for backward compatability.
         this.config.debug && Log.log('Detected ' + loginCount + ' logins.');
         this.sendNotification('USERS_LOGIN', payload.users);
      }
    } else if (payload.action === 'logout') {
      var logoutCount=0;
      for (user of payload.users) {
        if (user != null) {
          // see if user is even logged in, since you can only log out if you are actually logged in
          if (this.users.includes(user)) {
            this.config.debug && Log.log('Setting logout timer for ' + user + ' for ' + this.config.logoutDelay + 'ms');
            this.timouts[user] = setTimeout(function() {
        
              // Broadcast notificaiton that we are about to hide modules.
              // Ideally this would be USERS_LOGOUT to be consistent with hide/show timer, but to prevent regression using a new type.
              self.sendNotification('USERS_LOGOUT_MODULES', user);
              self.logout_user(user);
              logoutCount++;
            }, this.config.logoutDelay);
          } else {
            this.config.debug && Log.log('Detected a logout event for ' + user + ' but they were not logged in.');
          }
        }
      }

      if (logoutCount>0) {
         this.config.debug && Log.log('Detected ' + logoutCount + ' logouts.');
         this.sendNotification('USERS_LOGOUT', payload.users);
      }
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
