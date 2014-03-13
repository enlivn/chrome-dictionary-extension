/*------------------------------------------------------------------------------
 * Filename: background.js
 * Author: Neeraj Rao; neeraj AT cise.ufl.edu
------------------------------------------------------------------------------*/
//defaults
extEnabled = false;
highlightOn = false;
sidebarOn = false;
tabId = "";

if(localStorage.getItem("numHighlights")){
  numHighlights = localStorage.getItem("numHighlights");
}
else{ //first run
  numHighlights = 0;
}

if(localStorage.getItem("numHighlightsReminded")){
  numHighlightsReminded = localStorage.getItem("numHighlightsReminded");
}
else{ //first run
  numHighlightsReminded = 0;
}

if(localStorage.getItem("installedDate")){
  installedDate = JSON.parse(localStorage.getItem("installedDate")).installedDate;
  //console.log("popupDic: background - installedDate was "+installedDate); //diagnostic
}
else{ //first run
  installedDate = new Date().getTime();
  //console.log("popupDic: background - installedDate is "+installedDate); //diagnostic
  localStorage.setItem("installedDate", JSON.stringify({"installedDate": installedDate}));
}

chrome.browserAction.setBadgeText({text: "OFF"});

//listener for toolbar icon click and enable/disable the extension
chrome.extension.onRequest.addListener(
  //*********************************
  //BROWSER POPUP -> BACKGROUND PAGE
  //receive info from browser action popup page
  //pass it on to contentscript
  //*********************************
  function(request,sender,sendResponse){
    if(request.message == "enabled"){ //extension has been enabled from the browser action popup
      extEnabled = true;
      sessionStorage[extEnabled] = true; //make enabling persistent for session
      chrome.tabs.getSelected(null, function(tab) { //inform the content script that the extension has been enabled
        chrome.tabs.sendRequest(tab.id, {message: request.message}, function(){});
      });
      //console.log("popupDic: background - Extension ENABLED"); //diagnostic
      chrome.browserAction.setBadgeText({text: "ON"});
    }
    else if(request.message == "disabled"){ //extension has been disabled from the browser action popup
      extEnabled = false;
      sessionStorage[extEnabled] = false; //make enabling persistent for session
      chrome.tabs.getSelected(null, function(tab) { //inform the content script that the extension has been disabled
        chrome.tabs.sendRequest(tab.id, {message: request.message}, function(){});
      });
      //console.log("popupDic: background - Extension DISABLED"); //diagnostic
      chrome.browserAction.setBadgeText({text: "OFF"});
    }
    else if(request.message == "highlightOn"){ //turn highlighting on
      highlightOn = true;
      numHighlights++;
      localStorage["numHighlights"] = numHighlights;
      chrome.tabs.getSelected(null, function(tab) { //inform the content script that highlighting has been turned on
        chrome.tabs.sendRequest(tab.id, {message: request.message}, function(){});
      });
      //console.log("popupDic: background - Highlighting ON, numHighlights = "+numHighlights); //diagnostic
    }
    else if(request.message == "highlightOff"){ //turn highlighting off
      highlightOn = false;
      chrome.tabs.getSelected(null, function(tab) { //inform the content script that highlighting has been turned off
        chrome.tabs.sendRequest(tab.id, {message: request.message}, function(){});
      });
      //console.log("popupDic: background - Highlighting OFF"); //diagnostic
    }
    else if(request.message == "showSidebar"){ //show sidebar
      sidebarOn = true;
      chrome.tabs.getSelected(null, function(tab) { //inform the content script to show sidebar
        chrome.tabs.sendRequest(tab.id, {message: request.message}, function(){});
      });
      //console.log("popupDic: background - Sidebar ON"); //diagnostic
    }
    else if(request.message == "removeSidebar"){ //comes from either sidebar.js or from browser action popup
      chrome.tabs.getSelected(null, function(tab) { //inform the content script to remove sidebar
        chrome.tabs.sendRequest(tab.id, {message: "removeSidebar"}, function(){});
      });
      //console.log("popupDic: background - Sidebar OFF"); //diagnostic
    }
    else if(request.message == "clearWordlist"){ //comes from sidebar.js
      installedDate = JSON.parse(localStorage.getItem("installedDate")).installedDate;
      if(numHighlights!=0) numHighlights = localStorage.getItem("numHighlights"); //don't also forget to update listAllItems() if you make any changes here
      if(numHighlightsReminded!=0) numHighlightsReminded = localStorage.getItem("numHighlightsReminded"); //don't also forget to update listAllItems() if you make any changes here
      localStorage.clear();
      if(numHighlights!=0) localStorage["numHighlights"] = numHighlights; //don't also forget to update listAllItems() if you make any changes here
      if(numHighlightsReminded!=0) localStorage["numHighlightsReminded"] = numHighlightsReminded; //don't also forget to update listAllItems() if you make any changes here
      localStorage.setItem("installedDate", JSON.stringify({"installedDate": installedDate}));
      updateWordlistDisplay();
      //console.log("popupDic: background - cleared list of words"); //diagnostic
    }
    else if(request.message == "populateWordlist"){ //received from sidebar.js; tells us that it needs a list of words to display
      updateWordlistDisplay();
      //console.log("popupDic: background - displaying in wordlist "+listOfWords); //diagnostic
    }
    else if(request.message.match(/storeString/)){ //the contentScript has asked us to store a word
      storeString = request.message.split('\\');
      localStorage[storeString[1]] = storeString[2];
      if(sidebarOn) updateWordlistDisplay(); //update the word list since we have just added a new word; do this only if sidebar is showing
      //console.log("popupDic: background - stored word: "+storeString[1]);
      //console.log("popupDic: background - gloss: "+storeString[2]);
    }
    else if(request.message.match(/getWordlist/)){ //the contentScript has asked us for the list of stored words
      wordList = collectWords();
      chrome.tabs.getSelected(null, function(tab) { //inform the content script that the popup must be removed
        chrome.tabs.sendRequest(tab.id, {message: wordList}, function(){});
      });
      //console.log("popupDic: background - sending wordList to contentScript "+wordList);
    }
    else if(request.message == "wasPageAlreadyLoaded"){ //browser action is trying to determine if this page was already loaded once (if the user refreshed)
      chrome.tabs.getSelected(null, function(tab){ //check status of sidebar and highlighting with contentScript
        if(tab.url.match(/^chrome/)){ //popupDic won't work on chrome:// pages
          chrome.extension.sendRequest({
                                        message: "returnStatus",
                                        valid: false
                                      }); //pass info back on to popupPage
          //console.log("popupDic: background - informing popupPage current tab is not valid"); //diagnostic
        }
        else{
          chrome.tabs.sendRequest(tab.id, {message: "getExtStatus"}, function(response){ //check status of sidebar and highlighting with contentScript
            if(response.onceInited){ //required because on the first page load, the browser action is going to want to know whether the page was already loaded
                                     //since it wasn't, we have to wait for the contentscript to take the initiative and inform the browser action when it is (via
                                     //readyBrowserPopup)
              chrome.extension.sendRequest({message: "returnStatus",
                                            enabled: extEnabled,
                                            highlight: response.extHighlight,
                                            sidebar: response.extSidebar,
                                            valid: true
                                          }); //pass info back on to popupPage
              //console.log("popupDic: background - informing popupPage of extension state "+extEnabled+', '+response.extHighlight+', '+response.extSidebar+', true'); //diagnostic
            }
          });
        }
      });
    }
    else if(request.message == "readyBrowserPopup"){ //contentScript is letting browser popup know that the page has finished loading; used only on first page load when the contentscript must take the initiative
                                                     //to inform the browser action that the page has been loaded
      chrome.extension.sendRequest({message: request.message,onceInited: request.onceInited});
    }
    else if(request.message == "getExtStatus"){ //popupPage is querying extension state so it can display the buttons correctly
      chrome.tabs.getSelected(null, function(tab) { //check status of sidebar and highlighting with contentScript
        if(tab.url.match(/^chrome:\/\//)){ //popupDic won't work on chrome:// pages
          chrome.extension.sendRequest({message: "returnStatus",
                                        valid: false
                                      }); //pass info back on to popupPage
          //console.log("popupDic: background - informing popupPage current tab is not valid"); //diagnostic
        }
        else{
          chrome.tabs.sendRequest(tab.id, {message: "getExtStatus"}, function(response){ //check status of sidebar and highlighting with contentScript
            chrome.extension.sendRequest({message: "returnStatus",
                                          enabled: extEnabled,
                                          highlight: response.extHighlight,
                                          sidebar: response.extSidebar,
                                          valid: true
                                        }); //pass info back on to popupPage
            //console.log("popupDic: background - informing popupPage of extension state "+extEnabled+', '+response.extHighlight+', '+response.extSidebar+', true'); //diagnostic
          });
        }
      });
    }
    else if(request.message == "getExtEnabled"){ //contentScript is querying extension state at startup; important if page was refreshed once the ext was already on
      chrome.tabs.getSelected(null, function(tab) { //check status of sidebar and highlighting with contentScript
        sendResponse({enabled: extEnabled}, function(){}); //pass info back to contentScript
      });
    }
    else if(request.message == "openSummary"){ //sidebar.js is asking for a summary; open a new tab
      if(tabId){ //pre-existing summary tab
        chrome.tabs.remove(tabId); //remove it before you create a new one
      }
      chrome.tabs.create({url: "../html/summary.html"}, function(tab){
        tabId = tab.id;
      });
    }
    else if(request.message == "getSummaryStats"){ //summary.js is asking for a summary
      mySummary = reportSummary(); //update displayHTML and numWordsLookedUp; numHighlights is already updated separately
      numDaysInstalled = Math.ceil((new Date().getTime() - installedDate)/(1000*60*60*24));
      //console.log("popupDic: background - numWordsLookedUp "+mySummary.numWordsLookedUp+", numDaysInstalled "+numDaysInstalled+", displayHTML "+mySummary.displayHTML); //diagnostic
      sendResponse({numHighlights: numHighlights, numHighlightsReminded: numHighlightsReminded, numWordsLookedUp: mySummary.numWordsLookedUp, numDaysInstalled: numDaysInstalled, displayHTML: mySummary.displayHTML}, function(){}); //pass info back to summary.js
    }
    else if(request.message == "remindMeaning"){ //contentScript.js is asking us to remind the user of the word's meaning
      numHighlightsReminded++;
      localStorage["numHighlightsReminded"] = numHighlightsReminded;
      chrome.tabs.getSelected(null, function(tab) {
        sendResponse({returnedMeaning: remindMeaning(request.word)}, function(){}); //pass meanings back to contentScript
      });
    }
    else if(request.message == "openHelp"){ //sidebar.js is asking us to open the help window
      if(tabId){ //pre-existing summary tab
        chrome.tabs.remove(tabId); //remove it before you create a new one
      }
      chrome.tabs.create({url: "../html/help.html"}, function(tab){
        tabId = tab.id;
      });
    }
  }
);

chrome.tabs.onSelectionChanged.addListener(function(tabId, selectInfo){
  //console.log("popupDic: background - tab changed");
  chrome.tabs.getSelected(null, function(tab){ //inform contentScript whether the extension is already enabled
    chrome.tabs.sendRequest(tab.id, {message: "tabChanged", enabled: extEnabled}, function(){});
  });
});

function remindMeaning(word){
  returnWords = "";
  if(localStorage.length==0){
    returnWords += "";
  }
  else{
    for (i=0; i<localStorage.length; i++){
      key = localStorage.key(i);
      if(key.split(';')[0]==word.toLowerCase()){
        returnWords += key+'\\';
      }
    }
  }
  //console.log("returning "+returnWords);
  return returnWords;
}

function updateWordlistDisplay(){
  listOfWords = listAllItems();
  chrome.tabs.getSelected(null, function(tab) {
    chrome.tabs.sendRequest(tab.id, {message: listOfWords}, function(){}); //pass on words to add to wordlist to sidebar.js
  });
  //console.log("popupDic: background - "+listOfWords); //diagnostic
}

function collectWords(){ //encapsulate the wordlist and send it on to sidebar.js
  returnWords = "returnWordlist\\";
  if(localStorage.length==0){
    returnWords += "";
  }
  else{
    var listOfWords = "";
    for (i=0; i<localStorage.length; i++){
      key = localStorage.key(i);
      listOfWords += key.split(';')[0]+';';
    }
    listOfWords = listOfWords.split(';').getUnique(); //needed because same word may be stored with multiple senses
    for (i=0; i<listOfWords.length-1; i++){
      returnWords += listOfWords[i]+';';
    }
  }
  return returnWords;
}

/* returns unique values in array; needed because same word may be stored with multiple
 * senses
 * Source: http://stackoverflow.com/questions/1960473/unique-values-in-an-array */
Array.prototype.getUnique = function(){
   var u = {}, a = [];
   for(var i = 0, l = this.length; i < l; ++i){
      if(this[i] in u)
         continue;
      a.push(this[i]);
      u[this[i]] = 1;
   }
   return a;
}

function reportSummary(){
  var displayHTML = ""; //ready displayHTML so it can be sent in response to getSummaryStats
  if(localStorage.length==0){
    displayHTML += "Wordlist empty\\";
  }
  else{
    numWordsLookedUp = 0;
    var rowOdder = true;
    displayHTML += "<tr class='header'><td colspan=2 style='border-bottom: 1px solid gray;'>Saved Words</td></tr>";
    for (i=0; i<localStorage.length; i++){
      key = localStorage.key(i).split(';');
      if(key != "numHighlights" && key != "installedDate" && key != "numHighlightsReminded"){
        numWordsLookedUp++; //will be used with getSummaryStats
        if(rowOdder) trClass = 'oddrow'; //much easier to toggle a binar then mod2 numWordsLookedUp
        else trClass = 'evenrow';
        rowOdder = !rowOdder;

        displayHTML += "<tr class='"+trClass+"'><td><span class='origWord'>"+key[0]+"</span></td><td><span class='pos'>"+key[1]+"</span></td></tr>"; //export only the word and the part of speech so the user gets a fair chance to remember whether or not he really has the word down pat
      }
    }
  }
  return {numWordsLookedUp: numWordsLookedUp, displayHTML: displayHTML}
}

function listAllItems(){ //encapsulate the wordlist and send it on to sidebar.js
  listOfWords = "populateWordlist\\";
  if(localStorage.length==3 && localStorage.getItem("numHighlightsReminded") && localStorage.getItem("numHighlights") && localStorage.getItem("installedDate")||
     localStorage.length==1 && localStorage.getItem("installedDate")){ //highlighting hasn't been used as yet
    listOfWords += "Wordlist empty\\";
  }
  else{
    for (i=0; i<localStorage.length; i++){
      key = localStorage.key(i);
      val = localStorage.getItem(key);
      if(key != "numHighlights" && key != "numHighlightsReminded" && key != "installedDate"){
        listOfWords += key+';'+val+"\\";
      }
    }
  }
  return listOfWords;
}
/*------------------------------------------------------------------------------
 * EOF
------------------------------------------------------------------------------*/
