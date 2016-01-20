/*
 *
 * This app has been modified to work with aplite, basalt, and chalk
 * from Eric Migicovsky's original app which can be found at
 * https://github.com/ericmigi/PebbleTron.
 *
 */

var UI = require('ui');
// var Vector2 = require('vector2');
var ajax = require('ajax');
var Vibe = require('ui/vibe');
var WindowStack = require('ui/windowstack');

var clientID = 'e0635d85e5971f7c6e6d3315c331e706849b2a50d01c9f9bfadbbf7787b61e42';

Pebble.addEventListener('showConfiguration', function(){
  Pebble.openURL('https://api.lockitron.com/oauth/authorize?client_id=' + clientID + '&response_type=token&redirect_uri=pebblejs://close');
});

var accessToken = localStorage.getItem("accessToken");

Pebble.addEventListener("webviewclosed",
  function(e) {
    if (e.response === 'CANCELLED') { return; }
    console.log("Configuration window returned: " + e.response);
    accessToken = e.response.split("&")[0];
    console.log("hey look it's an accessToken: " + accessToken + "zero");
    localStorage.setItem("accessToken", accessToken);
  }
);

var lockitronUrl = 'https://api.lockitron.com/v2/locks';
var lockList = [];
var favLocks = [];

// menu setup functions

var loadState = function() {
  console.log('Loading State!'); 
  var savedFavLocks = localStorage.getItem("favLocks");
  if (savedFavLocks !== null) {
    favLocks = JSON.parse(savedFavLocks);
  }
};

var saveState = function() {
  localStorage.setItem("favLocks", JSON.stringify(favLocks));
};  

var deleteState = function() {
  lockList = [];
  localStorage.removeItem("accessToken");
  localStorage.removeItem("savedFavLocks");
  while (WindowStack.top()) {
    WindowStack.pop(); 
  }
};

// get list of locks
var requestLocks = function() {
  console.log('requesting locks!');
  var url = lockitronUrl + "?" + accessToken;
  console.log("requesting locks url: " + url);
  
  ajax({ url: url, type: 'json', method: 'get'}, function(data) {
    lockList = [];
    console.log("data.length " + data.length);
    // console.log(JSON.stringify(data,null, 2));
    for (var i = 0, ii = data.length; i < ii; ++i) {
      lockList[i] = {
        name: data[i].name,
        id: data[i].id,
        state: data[i].state,
        buttonType: data[i].button_type
      };
    console.log("lock name: " + lockList[i].name + " lock id: " + lockList[i].id);
    }
  }, function(error) {
    console.log('The ajax request failed: ' + JSON.stringify(error));
    var card = new UI.Card({ 
      title: 'Error',
      body: JSON.stringify(error),
      scrollable: true
    });
    card.show();  
  }
  );
};

/* var requestFavLocksState = function() {
  console.log('requesting favLocks states!');
  
  for (var i = 0, ii = favLocks.length; i < ii; ++i) {
    var url = lockitronUrl + '/' + favLocks[i].id + "?" + accessToken;
    ajax({ url: url, type: 'json', method: 'get'}, function(data) {
      favLocks[i].state = data.state;
      console.log("lock name: " + data.name + " lock id: " + data.id);
    }
  );
  }

};*/

// Control locks
var controlLock = function(lock, menu, numberInList) {
  var action
  if (lock.buttonType == 'unlock') {
    action = 'unlock';
  }
  else { action = 'toggle'};
  var url = lockitronUrl + '/' + lock.id + '?' + accessToken + '&state=' + action;
  console.log("trying to " + action + " lock: " + lock.name);
  ajax({ url: url, type: 'json', method: 'put'}, function(data) {
    console.log("data.state: " + data.state);
    menu.item(0, numberInList, { title: lock.name, subtitle: data.state + "ed"});
    Vibe.vibrate('short'); 
  }, function(error) {
    console.log('The ajax request failed: ' + JSON.stringify(error));
    Vibe.vibrate('long');
    var card = new UI.Card({ 
      title: error.status,
      body: error.message,
      scrollable: true
    });
    card.show();  
  }
  );
};

// Update Main Screen Lock List
function updateFavMenu (){
  mainMenu.items(0, []);
  // menu.items(0, [ { title: 'new item1' }, { title: 'new item2' } ]);
  for (var i = 0, ii = favLocks.length; i < ii; ++i) {
    mainMenu.item(0, i, {title: favLocks[i].name, subtitle: favLocks[i].state + "ed"});
  }
}

                
// starting pebble.js                

loadState();

if (accessToken === null) {
  var card = new UI.Card({ 
    title: 'Setup Account',
     body: "Login to your Lockitron account: MyPebble->Apps/Timeline->Pebbletron->Settings",
     scrollable: true
    });
  card.show();  
}
else {
  console.log("accessToken found, opening mainMenu");
  
  var mainMenu = new UI.Menu({ sections: [{}, {} ]});
  updateFavMenu();
  
  mainMenu.items(1, [ { title: 'All Locks'}, { title: 'Settings'} ]);
  mainMenu.show();
 
  requestLocks();

  mainMenu.on('select', function(e) {
    console.log("Menu section clicked: " + e.sectionIndex + " item: " + e.itemIndex);
    if (e.sectionIndex == '0') {
      controlLock ( favLocks[e.itemIndex], mainMenu, e.itemIndex);     
    }
    if (e.sectionIndex == '1') {
      if (e.itemIndex == '0') {
        console.log('throwing up allLocks');
        var allLocksMenu = new UI.Menu({ sections: [{ items: [] }] });
        for (var y = 0, yy = lockList.length; y < yy; ++y) {
        console.log( "title: " + lockList[y].name);
          allLocksMenu.item(0, y, {title: lockList[y].name, subtitle: lockList[y].state + "ed"});
        }
        allLocksMenu.show();
        allLocksMenu.on('select', function(e) {
          controlLock( lockList[e.itemIndex], allLocksMenu, e.itemIndex);
          console.log( 'Toggled lock: ' + lockList[e.itemIndex].name);        
        });
      }
    
      if (e.itemIndex == '1') {
        console.log( "opening Settings");
        var settingsMenu = new UI.Menu();
        settingsMenu.items(0, [ { title: 'Select Favourites'}, { title: 'Delete Favourites'}, { title: 'Delete Settings'} ]);
        settingsMenu.show();
        settingsMenu.on('select', function(e) {
          if (e.itemIndex == '0') {
            console.log('throwing up favourites');
            
            var favMenu = new UI.Menu({ sections: [{ items: [] }] });
            for (var i = 0, ii = lockList.length; i < ii; ++i) {
            console.log( "title: " + lockList[i].name);
              favMenu.item(0, i, {title: lockList[i].name});
            }
            favMenu.show();
            favMenu.on('select', function(e) {
              for (var i = 0, ii = favLocks.length; i < ii; ++i) {
                if (lockList[e.itemIndex].id == favLocks[i].id){
                  WindowStack.pop();
                  return;
                }
              }
              favLocks.push(lockList[e.itemIndex]);
              console.log( 'adding new lock to favLocks: ' + lockList[e.itemIndex].name);
              updateFavMenu();
              saveState();
              // Magnitude
              WindowStack.pop();
              WindowStack.pop();
            });
          }
          if (e.itemIndex == '1') {
            favLocks = [];
            updateFavMenu();
            saveState();
            WindowStack.pop();
          }
          if (e.itemIndex == '2') {
            deleteState();
          }
        });
      }
    }     
  });
}              