/*------------------------------------------------------------------------------
 * Filename: contentScript.js
 * Author: Neeraj Rao; neeraj AT cise.ufl.edu
 * Purpose: This file
 *          1. detects alt-double clicks
 *          2. captures the selected word
 *          3. passes it to the Wordreference JSON API
 *          4. displays the returned data in a popup
 *          5. adds words to a word list if the user chooses
 *          6. highlights words in word list if the user chooses
 * ---------------------------------------------------------------------------*/

/*------------------------------------------------------------------------------
 * To-Dos:
 * 1. Different languages selection on sidebar
 * 4. Info notifications for important events
 * -------------------------------------------
 * Future Improvements
 * -------------------------------------------
 * 5. Shortcut keys
 * 6. Help/usage
 * 7. Options: other shortcut instead of alt
 *             highlight color
 *             language selection
 * 8. Help page content: options
 *                       sidebar
 *                       popup
 *                       first use
 * 9. One add button for all meanings at once
 * 10. Sidebar must not obscure any part of the page i.e., reflow the page
 *     to fit on the left
 * 11. Highlighting must stay on in the same tab
 * 12. Context menu option
 * 13. fading notify the user if he tries to highlight and current page has none of the saved words
 * ---------------------------------------------------------------------------*/

window.addEventListener("dblclick",captureWord);
window.addEventListener("click",removePopup);

var sidebar;
var enabled = false;
var highlightOn = false;
var sidebarOn = false;
var mouseOnQuiz = false;
var gloss = "";
var clickX = "0px";
var clickY = "0px";
var finishedDisplay = false;
var popupClicked = false;
var noTermElementsFound= true;
var numDefs = 0;
var highlightStartTag = "<span class='addedWordHighlight'>"; //style words that are in the word list
var highlightEndTag = "</span>";
var currentScroll = 0;
onceInited = false; //only set once the page is loaded

/* Fetch translations from WR
 * Source: http://bcmoney-mobiletv.com/blog/2011/06/01/wordreference-ajax-sdk-widget */
var API = 'http://api.wordreference.com';  //base URL for the API request
var API_VERSION = '0.8';                   //leave blank '' for latest version
var API_KEY = '';                     //get your own!
var API_FORMAT = 'json';                   //'json' for JSON response type, or, blank '' for HTML
var LANGUAGE = 'fren';
var REVLANGUAGE = 'enfr';
var API_URL = API + '/' + API_VERSION + '/' + API_KEY + '/' + API_FORMAT; //Example: http://api.wordreference.com/{api_version}/{API_key}/json/{dictionary}/{term}
const trans = ["FirstTranslation","SecondTranslation","ThirdTranslation","FourthTranslation"];
var response, meaning, pos, origWord, origSense, newSense;

$(window).load(function(){
                  onceInited = true;
                  chrome.extension.sendRequest(
                    {message: "getExtEnabled"},
                    function(response){ //check with background page that ext was not already enabled
                      enabled = response.enabled;
                      //if(enabled) console.log("popupDic: contentScript - extension was already enabled"); //diagnostic
                      //else console.log("popupDic: contentScript - extension was disabled"); //diagnostic
                    }
                  );
                  chrome.extension.sendRequest(
                    {message: "readyBrowserPopup",onceInited: onceInited},
                    function(){}
                  ); //tell browser popup that the page has finished loading
});

$(window).unload(function(){
                  onceInited = false; //if the user refreshes the page, browser action must again show a loading animation
                  chrome.extension.sendRequest(
                    {message: "readyBrowserPopup",onceInited: onceInited},
                    function(){}
                ); //tell browser popup that the page has finished loading
});

chrome.extension.onRequest.addListener(
  function(request,sender,sendResponse){
    if(request.message == "enabled"){ //extension has been enabled from the browser action popup
      enabled = true;
      //console.log("popupDic: contentScript - Extension enabled from browser action"); //diagnostic
    }
    else if(request.message == "disabled"){ //extension has been disabled from the browser action popup
      enabled = false;
      //console.log("popupDic: contentScript - Extension disabled from browser action"); //diagnostic
    }
    else if(request.message == "highlightOn"){ //ask for wordlist
      highlightOn = true;
      var link = document.getElementById("newHighlightStyle");
      if (!link){ // Insert new sheet only if not already present
        link = document.createElement('link');
        link.rel = 'stylesheet';
        link.type = 'text/css';
        link.href = chrome.extension.getURL("css/popupdic-highlight.css");
        link.id = "newHighlightStyle";
        (document.head||document.getElementsByTagName('head')[0]).appendChild(link);
      }
      chrome.extension.sendRequest(
          {message: "getWordlist"},
          function(){}
      ); //tell background page to return list of saved words
      //console.log("popupDic: contentScript - Asked background for wordlist so we can highlight it"); //diagnostic
    }
    else if(request.message.match(/returnWordlist/)){ //turn highlighting on
      if(request.message.match(/;/)){
        //console.log("popupDic: contentScript - received wordList for highlighting "+request.message); //diagnostic
        highlightSeenWords(request.message.split('\\')[1]);
      }
      else{
        //console.log("popupDic: contentScript - no words found to highlight!"); //diagnostic
      }
      //console.log("popupDic: contentScript - Highlighting ON"); //diagnostic
    }
    else if(request.message == "highlightOff"){ //turn highlighting off
      highlightOn = false;
      unHighlightSeenWords();
      //console.log("popupDic: contentScript - Highlighting OFF"); //diagnostic
    }
    else if(request.message == "showSidebar"){ //show sidebar
      sidebarOn = true;
      openSidebar();
      //console.log("popupDic: contentScript - Sidebar ON"); //diagnostic
    }
    else if(request.message == "removeSidebar"){ //remove sidebar
      sidebarOn = false;
      removeSidebar();
      //console.log("popupDic: contentScript - Sidebar OFF"); //diagnostic
    }
    else if(request.message == "readyBrowserPopup"){
      sendResponse({message: "readyBrowserPopup",onceInited: onceInited}, function(){}); //tell browser popup that the page has finished loading; called for first page load
    }
    else if(request.message == "getExtStatus"){ //background page is asking status of sidebar and highlighting so it can pass it on to popupPage
      sendResponse({extHighlight: highlightOn, extSidebar: sidebarOn, onceInited: onceInited}, function(){}); //tell background page to return list of saved words
      //console.log("popupDic: contentScript - informing background page of extension state "+highlightOn+', '+sidebarOn); //diagnostic
    }
    else if(request.message == "tabChanged"){ //background page tells us that the user just changed tabs. It also tells us whether the extension is already enabled.
      enabled = request.enabled;
      //if(enabled) console.log("popupDic: contentScript - tab switch; extension was already enabled"); //diagnostic
      //else console.log("popupDic: contentScript - tab switch; extension was disabled"); //diagnostic
    }
  }
);


/* listens for double clicks if extension has been enabled */
function captureWord(event){
  //console.log("popupDic: contentScript - captureWord()"); //diagnostic
  if(event.altKey){ //check if alt-key was pressed
    if(enabled){
      //console.log("popupDic: contentScript - Calling word def fn"); //diagnostic
      word = document.getSelection().toString();
      clickX = event.clientX; //mouse click x
      clickY = event.clientY; //mouse click y

      userSelection = window.getSelection();

      /* go from smallest to largest containers i.e., span -> p -> div */
      if($(event.target).closest('p,div')){
        word = checkHyphenation($(event.target).closest('p,div').text(), word.trim());
        //console.log("context: "+$(event.target).closest('p,div').text());
        gloss = extractGloss($(event.target).closest('p,div').text(), word.trim());
      }
      //console.log(word);
      //console.log(gloss);

      var screen_bottom = $(window).height();
      $('.textnode').each(function(){
        if(clickY > $(this).position().top && clickY < ($(this).position().top+$(this).height())){
          //console.log($(this).text());
        }
      });

      //console.log("popupDic: contentScript - click location "+clickX+" "+clickY); //diagnostic
      if(highlightOn){ //if highlighting was on, turn it off so it doesn't interfere
        highlightOn = false;
        unHighlightSeenWords();
      }
      queryDic(LANGUAGE,word);
      //queryDic(LANGUAGE,"aller"); //diagnostic
    }
    else{
      //console.log("popupDic: contentScript - extension was disabled"); //diagnostic
    }
  }
}

function checkHyphenation(context, word){
  temp1 = "";
  temp2 = "";
  wordStart = context.indexOf(word);
  oldWordStart = wordStart; //in case we click on the middle word of a hyphenated word
  /* deal with hyphenated words */
  if(context.charAt(wordStart-1)=='-'){ //hyphenated word; we clicked on second half
    wordStart = context.substring(0,oldWordStart).lastIndexOf(' '); //pick out the first half as well
    temp1 = context.substring(wordStart+1,oldWordStart);
  }
  if(context.charAt(oldWordStart+word.length)=='-'){ //hyphenated word; we clicked on first half
    wordStart = context.substring(oldWordStart+word.length).indexOf(' '); //pick out the second half as well
    temp2 = context.substring(oldWordStart+word.length).substring(0,wordStart); //we clicked on the first half
  }
  word = temp1 + word + temp2;
  return word;
}

function extractGloss(context, word){
  console.log("context: "+context);
  /* deal with sentence */
  wordStart = context.indexOf(word);
  terminations = ['. ','." ','.\' '];
  sentenceStartFound = false;
  for(var i=0;i<terminations.length;i++){
    sentenceStart = context.substring(0,wordStart).lastIndexOf(terminations[i]);
    if(sentenceStart != -1){
      sentenceStartFound = true;
      preWordSentence = context.substring(0,wordStart).substring(sentenceStart+2);
      break;
    }
  }
  if(!sentenceStartFound) preWordSentence = context.substring(0,wordStart);
  //console.log(preWordSentence);

  sentenceEndFound = false;
  for(var i=0;i<terminations.length;i++){
    sentenceStart = context.substring(wordStart+word.length).indexOf(terminations[i]);
    if(sentenceStart != -1){
      sentenceEndFound = true;
      postWordSentence = context.substring(wordStart+word.length).substring(0,sentenceStart+2);
      break;
    }
  }
  if(!sentenceEndFound) postWordSentence = context.substring(wordStart+word.length);
  //console.log(postWordSentence);
  return preWordSentence+"<b>"+word+"</b>"+postWordSentence;
}

/* Removes popup */
function removePopup(event){
  if(finishedDisplay){
    //console.log("popupDic: contentScript - "+popupClicked); //diagnostic
    if(!popupClicked){ //click was not on popup
      newDiv = document.getElementById("wordDefDiv");
      if(newDiv){
        newDiv.parentNode.removeChild(newDiv); //remove any old word definitions
        //console.log("popupdic: contentScript - removing popup"); //diagnostic

        /* remove other stuff that we added */
        blanketDiv = document.getElementById("blanket");
        if(blanketDiv){
          blanketDiv.parentNode.removeChild(blanketDiv); //remove any old word definitions
          //console.log("popupdic: contentScript - removing blanketDiv"); //diagnostic
        }
        css = document.getElementById("newDivStyle");
        if(css){
          css.parentNode.removeChild(css); //remove any old word definitions
          //console.log("popupdic: contentScript - removing css"); //diagnostic
        }
      }
      finishedDisplay = false;
    }
    else popupClicked = false;
  }
}

/* Queries dictionary for word meaning */
function queryDic(lang,word){
  numDefs = 0;
  meaningArray = new Array();
  posArray = new Array();
  origSenseArray = new Array();
  origWordArray = new Array();
  newSenseArray = new Array();

  var request = new XMLHttpRequest();
  request.open('GET',API_URL+'/'+lang+'/'+word,true); //true -> async request
  request.onreadystatechange = function(e){ //callback for async request
    var displayHTML = "";
    if(request.readyState === 4){ //HTML request finished
      if(request.status === 200){ //HTML response OK
        response = JSON.parse(request.responseText);

        if(response.Response){
          if(response.Response == "Redirect"){ //word was looked up in the wrong direction; reverse
           queryDic(REVLANGUAGE,word); //dictionary asked us to lookup in reverse
          }
        }
        else if(response.Error){
          if(response.Error == "NoWord"){ //no word was given to the dictionary; e.g., white space selected?
            displayHTML += "<div class='infoMsg'><center>";
            displayHTML += "<img src='"+chrome.extension.getURL('html/browserActionPopup/warning.png')+"'/><br>"
            displayHTML += "<p>Please select valid text first!";
            displayHTML += "<p>Click outside this dialog or on<br>the close button to dismiss this dialog.";
            displayHTML += "</center></div>";
            displayHTML += "</body></html>";
            showDefinition(displayHTML,true); //send HTML to iFrame
          }
          else if(response.Error == "NoTranslation"){ //no word translation was found
            displayHTML += "<div class='infoMsg'><center>";
            displayHTML += "<img src='"+chrome.extension.getURL('html/browserActionPopup/warning.png')+"'/><br>"
            displayHTML += "<p>No translation found!";
            displayHTML += "<p>Click outside this dialog or on<br>the close button to dismiss this dialog.";
            displayHTML += "</center></div>";
            displayHTML += "</body></html>";
            showDefinition(displayHTML,true); //send HTML to iFrame
          }
        }
        else{ //we have some data that's worth processing
          for(var outerKey in response){ //outer key is term0, term1,... and perhaps original
            if(outerKey.match(/term\d/g)){ //look only at term* entries because we're not interested in compound meanings
              if(noTermElementsFound){ //do this only once
                noTermElementsFound = false;
                displayHTML += "<div id='definition'><table id='word-meanings'>";
              }
              if(response[outerKey].Entries){ //primary and additional meanings were found; we're not interested in additional meanings
                //iterate over the object and retrieve primary translations
                for(var innerKey in response[outerKey].Entries){ //innerKey will be 0,1,...
                  origWord = response[outerKey].Entries[innerKey].OriginalTerm.term;
                  origWordArray.push(origWord);
                  if(response[outerKey].Entries[innerKey].OriginalTerm.POS){
                    pos = response[outerKey].Entries[innerKey].OriginalTerm.POS;
                    posArray.push(pos);
                  }
                  if(response[outerKey].Entries[innerKey].OriginalTerm.POS2){
                    pos = response[outerKey].Entries[innerKey].OriginalTerm.POS2;
                    posArray.push(pos);
                  }
                  origSense = response[outerKey].Entries[innerKey].OriginalTerm.sense;
                  origSenseArray.push(origSense);
                  for(var i = 0; i < trans.length; i++){ //trans is FirstTranslation, SecondTranslation,...
                    if(response[outerKey].Entries[innerKey][trans[i]]){
                      meaning = response[outerKey].Entries[innerKey][trans[i]].term;
                      meaningArray.push(meaning);
                      newSense = response[outerKey].Entries[innerKey][trans[i]].sense;
                      newSenseArray.push(newSense);
                      if(origSense.length>0){ //add an extra line if we have sense data
                        displayHTML += "<tr><td class='firstCol'><span class='origWord'>"+origWord+"</span><br><span class='sense'>("+origSense+")</span></td><td class='secondCol'><span class='pos'>"+pos+"</span></td>";
                      }
                      else{
                        displayHTML += "<tr><td class='firstCol'><span class='origWord'>"+origWord+"</span></td><td class='secondCol'><span class='pos'>"+pos+"</span></td>";
                      }
                      if(newSense.length>0){ //add an extra line if we have sense data
                        displayHTML += "<td class='thirdCol'>"+meaning+"<br><span class='sense'>("+newSense+")</span></td>";
                      }
                      else{
                        displayHTML += "<td class='thirdCol'>"+meaning+"</td>";
                      }
                      displayHTML += "<td class='fourthCol'><a href='' onclick='return false;'><img border='0' src='"+chrome.extension.getURL("images/addIcon.png")+"' alt='Add to word list' width='30' height='30' id='addWordBtn"+numDefs+"'/></a></td></tr>"; //return false is so that the page doesn't scroll to the top when this is clicked
                      numDefs++;
                    }
                  }
                }
              }
              else if(response[outerKey].PrincipalTranslations){ //primary and additional meanings were found; we're not interested in additional meanings
                //iterate over the object and retrieve primary translations
                for(var innerKey in response[outerKey].PrincipalTranslations){ //innerKey will be 0,1,...
                  origWord = response[outerKey].PrincipalTranslations[innerKey].OriginalTerm.term;
                  origWordArray.push(origWord);
                  if(response[outerKey].PrincipalTranslations[innerKey].OriginalTerm.POS){
                    pos = response[outerKey].PrincipalTranslations[innerKey].OriginalTerm.POS;
                    posArray.push(pos);
                  }
                  if(response[outerKey].PrincipalTranslations[innerKey].OriginalTerm.POS2){
                    pos = response[outerKey].PrincipalTranslations[innerKey].OriginalTerm.POS2;
                    posArray.push(pos);
                  }
                  origSense = response[outerKey].PrincipalTranslations[innerKey].OriginalTerm.sense;
                  origSenseArray.push(origSense);
                  for(var i = 0; i < trans.length; i++){ //trans is FirstTranslation, SecondTranslation,...
                    if(response[outerKey].PrincipalTranslations[innerKey][trans[i]]){
                      meaning = response[outerKey].PrincipalTranslations[innerKey][trans[i]].term;
                      meaningArray.push(meaning);
                      newSense = response[outerKey].PrincipalTranslations[innerKey][trans[i]].sense;
                      newSenseArray.push(newSense);
                      if(origSense.length>0){ //add an extra line if we have sense data
                        displayHTML += "<tr><td class='firstCol'><span class='origWord'>"+origWord+"</span><br><span class='sense'>("+origSense+")</span></td><td class='secondCol'><span class='pos'>"+pos+"</span></td>";
                      }
                      else{
                        displayHTML += "<tr><td class='firstCol'><span class='origWord'>"+origWord+"</span></td><td class='secondCol'><span class='pos'>"+pos+"</span></td>";
                      }
                      if(newSense.length>0){ //add an extra line if we have sense data
                        displayHTML += "<td class='thirdCol'>"+meaning+"<br><span class='sense'>("+newSense+")</span></td>";
                      }
                      else{
                        displayHTML += "<td class='thirdCol'>"+meaning+"</td>";
                      }
                      displayHTML += "<td class='fourthCol'><a href='' onclick='return false;'><img border='0' src='"+chrome.extension.getURL("images/addIcon.png")+"' alt='Add to word list' width='30' height='30' id='addWordBtn"+numDefs+"'/></a></td></tr>"; //return false is so that the page doesn't scroll to the top when this is clicked
                      numDefs++;

                      //create an array to hold the meaning. the array is so that we can refer to the specific meaning
                      //the user wants to save (by means of the array index). pass the array index in the message the
                      //html page sends to the content script. the content script will then take the corresponding
                      //array element and save it to localstorage. the localstorage bit seems simple enough
                      //don't forget to remove all of this stuff in removePopup
                      //the options page must allow user to remove all the words at one go
                      //show a minus button if the meaning has already been stored? looks like it's needed to avoid
                      //duplicates.
                    }
                  }
                }
              }
            }
            else if(noTermElementsFound){ //no translation found but it is not a malformed word or white space because compound meanings have been found
                                          //Example: Nicolas
              if(outerKey.match(/original/g)){ //no translation found but it is not a malformed word or white space because compound meanings have been found
                if(response[outerKey].Compounds){
                  displayHTML += "<div class='infoMsg'><center>";
                  displayHTML += "<img src='"+chrome.extension.getURL('html/browserActionPopup/warning.png')+"'/><br>"
                  displayHTML += "<p>No translation found!";
                  displayHTML += "<p>Click outside this dialog or on<br>the close button to dismiss this dialog.";
                  displayHTML += "</center></div>";
                  displayHTML += "</body></html>";
                  showDefinition(displayHTML,true); //send HTML to popup
                  break; //if we don't put the break, this message will be printed more than once as the for loop continues on its merry way
                }
              }
            }
          }
          if(!noTermElementsFound){ //term* and word definitions were found; OK to show
            displayHTML += "</table></div>";
            //console.log("popupDic: contentScript - "+displayHTML); //diagnostic
            noTermElementsFound = true; //reset for next word
            showDefinition(displayHTML,true); //send HTML to popup
          }
        }
      }
    }
    else{ //HTML request failed
      //console.log("popupDic: contentScript - Error", request.statusText); //diagnostic
    }
    //return displayHTML;
  };
  request.setRequestHeader("Content-type", "text/plain; charset=utf-8"); //charset is needed for accents!
  request.send(null); //null indicates no body content required for GET
}

/* quiz popup on highlighted word */
function showQuiz(event){
  clickX = event.clientX;
  clickY = event.clientY;
  clickedWord = event.target.innerHTML;
  popupClicked = true;
  //event.target.addEventListener("mouseout",removePopup);
  document.addEventListener("mousemove",checkMouseMovement);
  var displayHTML = "";
  displayHTML += "<html><body><table id='word-meanings'>";
  displayHTML += "<tr><td class='firstCol' colspan=2 style='text-align: center;'>Remember the word?</td></tr>";
  //displayHTML += "<tr style='text-align: center;'><td class='firstCol'><button id='yesRemember'>Yes</button><p style='margin:0px;font-size:13px;font-style:italic;'>(Dismiss this dialog)</p></td><td class='firstCol'><button id='noRemember'>No</button><p style='margin:0px;font-size:13px;font-style:italic;'>(Remind me!)</p></td></tr>";
  displayHTML += "<tr style='text-align: center;'><td class='firstCol' colspan='2'><button id='noRemember'>No</button><p style='margin:0px;font-size:14px;font-style:italic;'>(Remind me!)</p></td></tr>";
  displayHTML += "</table></body></html>";
  showDefinition(displayHTML,false);
  document.getElementById('wordDefDiv').addEventListener('mouseover',function(){mouseOnQuiz = true;});
  document.getElementById('wordDefDiv').addEventListener('mouseout',function(){mouseOnQuiz = false;});
  //document.getElementById('yesRemember').addEventListener('click',function(){popupClicked = false;removePopup();}); //dismiss quiz if user remembers the word
  document.getElementById('noRemember').addEventListener('click',remindWordDef); //fetch meanings from our list to remind the user; note that there's a chance the word might be saved with different senses. In such a case, show all the saved defs because we don't really know which part of speech it is
}

function remindWordDef(word){
  displayHTML = "<html><body><table id='word-meanings'>";
  chrome.extension.sendRequest(
    {message: "remindMeaning", word: clickedWord},
    function(response){ //tell background page to remind us of the meaning
      meaning = response.returnedMeaning.split('\\'); //background.js has returned word meanings
      for(var i=0;i<meaning.length-1;i++){
        //console.log(meaning[i]);
        wordMeaning = meaning[i].split(';');
        if(wordMeaning[2].length>0){ //add an extra line if we have sense data
          displayHTML += "<tr><td class='firstCol'><span class='origWord'>"+wordMeaning[0]+"</span><br><span class='sense'>("+wordMeaning[2]+")</span></td><td class='secondCol'><span class='pos'>"+wordMeaning[1]+"</span></td>";
        }
        else{
          displayHTML += "<tr><td class='firstCol'><span class='origWord'>"+wordMeaning[0]+"</span></td><td class='secondCol'><span class='pos'>"+wordMeaning[1]+"</span></td>";
        }
        if(wordMeaning[4].length>0){ //add an extra line if we have sense data
          displayHTML += "<td class='thirdCol'>"+wordMeaning[3]+"<br><span class='sense'>("+wordMeaning[4]+")</span></td>";
        }
        else{
          displayHTML += "<td class='thirdCol'>"+wordMeaning[3]+"</td>";
        }
      }
      document.removeEventListener("mousemove",checkMouseMovement,false);
      document.getElementById('wordDefDiv').removeEventListener('mouseover',function(){mouseOnQuiz = true;},false);
      document.getElementById('wordDefDiv').removeEventListener('mouseout',function(){mouseOnQuiz = false;},false);
      //document.getElementById('yesRemember').removeEventListener('click',function(){popupClicked = false;removePopup();},false); //dismiss quiz if user remembers the word
      displayHTML += "</table></body></html>";
      document.getElementById('wordDefDiv').innerHTML = displayHTML;
      closeBtn = document.createElement("img");
      closeBtn.src = chrome.extension.getURL("images/closeBtn.png");
      closeBtn.style.position = 'absolute';
      closeBtn.style.right = '-24px';
      closeBtn.style.top = '-24px';
      closeBtna = document.createElement("a"); //put the image in an anchor so the cursor changes properly
      closeBtna.href = '#';
      closeBtna.addEventListener('click',function(event){event.preventDefault();popupClicked = false; removePopup();}); //preventdefault is like 'return false;'. prevents the page from scrolling up when clicking a href '#'; //popup must close if closeBtn is clicked; even if it is part of newDiv. Thus, we set popupClicked to false;
      closeBtna.appendChild(closeBtn);
      document.getElementById('wordDefDiv').appendChild(closeBtna);
      //console.log("popupDic: contentScript - reminding meaning "+displayHTML); //diagnostic
    }
  );
  //document.getElementById('wordDefDiv').innerHTML = displayHTML;
}

/* detect mouse movement for showing quiz popup */
function checkMouseMovement(event){
  if(Math.abs(event.clientX-clickX)>10 && Math.abs(event.clientY-clickY)>10){
    if(!mouseOnQuiz){
      document.removeEventListener("mousemove",checkMouseMovement,false);
      popupClicked = false;
      removePopup();
    }
  }
}

/* Creates popup that will show the word meaning */
function showDefinition(text,showBlanket){
  completeHTML = text;

  var link = document.getElementById("newDivStyle");
  if (!link){ // Insert new sheet only if not already present
    link = document.createElement('link');
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = chrome.extension.getURL("css/popupdic-panel.css");
    link.id = "newDivStyle";

    (document.head||document.getElementsByTagName('head')[0]).appendChild(link);
  }

  blanketDiv = document.createElement("div");
  blanketDiv.id = "blanket";
  (document.body||document.getElementsByTagName('body')[0]).appendChild(blanketDiv);
  //console.log("popupDic: contentScript - "+document.getElementById("blanket")); //diagnostic

  newDiv = document.createElement("div");
  newDiv.id = "wordDefDiv";
  oldDiv = document.getElementById('wordDefDiv'); //remove preexisting divs
  if(oldDiv){
    oldDiv.parentNode.removeChild(oldDiv);
  }
  (document.body||document.getElementsByTagName('body')[0]).appendChild(newDiv);
  //console.log("popupDic: contentScript - "+document.getElementById("wordDefDiv")); //diagnostic
  newDiv.innerHTML = completeHTML;

  closeBtn = document.createElement("img");
  closeBtn.src = chrome.extension.getURL("images/closeBtn.png");
  closeBtn.style.position = 'absolute';
  closeBtn.style.right = '-24px';
  closeBtn.style.top = '-24px';
  closeBtna = document.createElement("a"); //put the image in an anchor so the cursor changes properly
  closeBtna.href = '#';
  closeBtna.addEventListener('click',function(event){event.preventDefault();popupClicked = false; removePopup();}); //preventdefault is like 'return false;'. prevents the page from scrolling up when clicking a href '#'; //popup must close if closeBtn is clicked; even if it is part of newDiv. Thus, we set popupClicked to false;
  closeBtna.appendChild(closeBtn);
  newDiv.appendChild(closeBtna);

  // add event listeners for add buttons
  for(var i=0;i<numDefs;i++){
    addWordBtn = document.getElementById("addWordBtn"+i);
    if(addWordBtn){
      addWordBtn.addEventListener("click",function(){
        addWordToList(event);
      });
    }
  }

  popup("wordDefDiv",showBlanket); //call the function that will show the popup

  //newDiv.style.display = "block"; //needs to be BEFORE offsetWidth, offsetHeight
  //console.log("popupDic: contentScript - popup dimensions "+newDiv.offsetWidth+" "+newDiv.offsetHeight); //diagnostic
  if((document.documentElement.clientWidth-clickX)<310){ //mouse is too near the right edge of the browser; 310 is because we're sure about the width of the div. not so sure about the height, though.
    //console.log("popupDic: contentScript - too near right edge!"); //diagnostic
    clickX -= newDiv.offsetWidth;
  }
  if(clickY>newDiv.offsetHeight){ //make sure mouse is far enough from the top edge of the browser
    if((document.documentElement.clientHeight-clickY)<newDiv.offsetHeight){ //mouse is too near the bottom edge of the browser
      //console.log("popupDic: contentScript - too near bottom edge!"); //diagnostic
      clickY -= newDiv.offsetHeight;
    }
  }
  //console.log("popupDic: contentScript - adjusted location "+clickX+" "+clickY); //diagnostic
  newDiv.style.position = 'fixed';
  newDiv.style.top = clickY+'px';
  newDiv.style.left = clickX+'px';

  newDiv.addEventListener("click",clickOnPopup); //prevent popup from closing if popup is clicked
}

/* Adds word and its meaning to the word list
 * if user clicked on the add button */
function addWordToList(event){
  var src = event.srcElement.id;
  $("#wordDefDiv #"+src).attr('src',chrome.extension.getURL("images/addedIcon.png"));
  var num = src.replace(/addWordBtn/g,'');
  var key = origWordArray[num]+';'+posArray[num]+';'+origSenseArray[num]+';'+meaningArray[num]+';'+newSenseArray[num]+'\\';
  //console.log("popupDic: contentScript - " + key.split(';')[0]); //diagnostic
  var value = gloss;
  //console.log("popupDic: contentScript - key+" - "+value); //diagnostic
  currentScroll = document.body.scrollTop;
  storeString = 'storeString\\'+key+value;
  chrome.extension.sendRequest(
    {message: storeString},
    function(){}
  ); //tell background page to save the word to its localstorage
}

/* Highlight words that user has looked up before */
function highlightSeenWords(highlightTerm){
  currentScroll = document.body.scrollTop;
  //console.log("popupDic: contentScript - Asked to highlight "+highlightTerm); //diagnostic
  var bodyText = document.body.innerHTML;
  highlightTermArray = highlightTerm.split(';');
  for (var i = 0; i < highlightTermArray.length-1; i++) { //ignore the last item of the split since it's an empty string
    //console.log("popupDic: contentScript - Now highlighting "+highlightTermArray[i]); //diagnostic
    bodyText = addHighlight(bodyText, highlightTermArray[i], highlightStartTag, highlightEndTag);
  }
  //console.log("popupDic: contentScript "+bodyText); //diagnostic
  document.body.innerHTML = bodyText;
  document.body.scrollTop = currentScroll;
  highlightedWords = document.getElementsByClassName('addedWordHighlight');
  for (var i = 0; i < highlightedWords.length; i++) {
    //console.log("popupDic: contentScript - adding mouseover handler to "+highlightedWords[i].innerHTML);
    highlightedWords[i].addEventListener("mouseover",showQuiz); //add a listener for quizzes
  }
  //console.log(document.body.innerHTML); //diagnostic
}

function unHighlightSeenWords(){
  currentScroll = document.body.scrollTop;
  var bodyText = document.body.innerHTML;
  css = document.getElementById("newHighlightStyle");
  if(css){
    css.parentNode.removeChild(css); //remove any old word definitions
    //console.log("popupdic: contentScript - removing css"); //diagnostic
  }
  document.body.innerHTML = bodyText.replace(/(<span class="addedWordHighlight">)(\S+)(<\/span>)/g,"$2"); //$1 must match highlightStartTag exactly!; we use \S instead of \w because Javascript can't match accented chars
  document.body.scrollTop = currentScroll;
  //console.log("popupDic: contentScript - "+document.body.innerHTML); //diagnostic
}

/* Set popupClicked if user clicks on popup.
 * This basically prevents the popup from being
 * closed (it should only be closed if the user
 * clicks SOMEWHERE ELSE on the page) */
function clickOnPopup(event){
  popupClicked = true;
  //console.log("popupDic: contentScript - popup was clicked"); //diagnostic
}

/* Functions to create window popup.
 * Code from http://www.pat-burt.com/csspopup.js */
function toggle(div_id){
  var el = document.getElementById(div_id);
  if(!el.style.display){
    el.style.display = 'block';
  }
  else{
    el.style.display = 'none';
  }
}

function blanket_size(popUpDivVar){
  if(typeof window.innerWidth != 'undefined'){
    viewportheight = window.innerHeight;
  }
  else{
    viewportheight = document.documentElement.clientHeight;
  }
  if((viewportheight > document.body.parentNode.scrollHeight) && (viewportheight > document.body.parentNode.clientHeight)){
    blanket_height = viewportheight;
  }
  else{ //total height of page
    if(document.body.parentNode.clientHeight > document.body.parentNode.scrollHeight){
      blanket_height = document.body.parentNode.clientHeight;
    }
    else{
      blanket_height = document.body.parentNode.scrollHeight;
    }
  }
}

function window_pos(popUpDivVar){
  if(typeof window.innerWidth != 'undefined'){
    viewportwidth = window.innerHeight;
  }
  else{
    viewportwidth = document.documentElement.clientHeight;
  }
  if((viewportwidth > document.body.parentNode.scrollWidth) &&(viewportwidth > document.body.parentNode.clientWidth)){
    window_width = viewportwidth;
  }
  else{
    if(document.body.parentNode.clientWidth > document.body.parentNode.scrollWidth){
      window_width = document.body.parentNode.clientWidth;
    }
    else{
      window_width = document.body.parentNode.scrollWidth;
    }
  }
}

function popup(windowname,showBlanket){
  //console.log("popupDic: contentScript - creating popup"); //diagnostic
  blanket_size(windowname);
  window_pos(windowname);
  if(showBlanket){ //word def popup
    toggle('blanket');
    //console.log("popupDic: contentScript - showing blanket");
  }
  else{ //quiz popup
    document.getElementById('blanket').style.display = 'none';
    //console.log("popupDic: contentScript - blanket not required");
  }
  toggle(windowname);
  finishedDisplay = true;
}

/* Adds span with highlighting CSS in order to highlight words on page
 * Code source: www.nsftools.com/misc/SearchAndHighlight.htm */
function addHighlight(bodyText, searchTerm, highlightStartTag, highlightEndTag){
  // find all occurences of the search term in the given text,
  // and add some "highlight" tags to them (we're not using a
  // regular expression search, because we want to filter out
  // matches that occur within HTML tags and script blocks, so
  // we have to do a little extra validation)
  var newText = "";
  var i = -1;
  var lcSearchTerm = searchTerm.toLowerCase();
  var lcBodyText = bodyText.toLowerCase();

  //console.log("popupDic: contentScript - "+searchTerm); //diagnostic

  while (bodyText.length > 0) {
    i = lcBodyText.indexOf(lcSearchTerm, i+1);
    if(i < 0){
      newText += bodyText;
      bodyText = "";
    }
    else{
      // skip anything inside an HTML tag
      if (bodyText.lastIndexOf(">", i) >= bodyText.lastIndexOf("<", i)) {
        // skip anything inside a <script> block
        if (lcBodyText.lastIndexOf("/script>", i) >= lcBodyText.lastIndexOf("<script", i)) {
          if(!bodyText[i-1].match(/\w/) && !bodyText[i+searchTerm.length].match(/\w/)){ //make sure we're only looking for whole words
            newText += bodyText.substring(0, i) + highlightStartTag + bodyText.substr(i, searchTerm.length) + highlightEndTag;
          }
          else{ //make no changes
            newText += bodyText.substring(0, i+searchTerm.length);
          }
          bodyText = bodyText.substr(i + searchTerm.length);
          lcBodyText = bodyText.toLowerCase();
          i = -1;
        }
      }
    }
  }

  //console.log("popupDic: contentScript - "+newText); //diagnostic
  return newText;
}

function formatNode(node){
  width = '340px';

  node.style.border = "0";
  node.style.visibility = "block";
  node.style.zIndex = "2147483647"; // MAX z-index = 2147483647
  node.style.position = "fixed";
  node.style.width = width; // "102%"; IE auto margin bug
  node.style.right = "0";
  node.style.bottom = "0";
  node.style.height = "100%";
  node.setAttribute("src",chrome.extension.getURL("html/sidebar.html"));
}

/* create sidebar for displaying wordlists */
function openSidebar(){
  sidebar = document.createElement("iframe");
  sidebar.id = "wordDefSidebar";
  sidebar.style.overflow = "hidden";
  formatNode(sidebar);
  if(window.top.document) (window.top.document.body||window.top.document.getElementsByTagName('body')[0]).appendChild(sidebar); //important to use window.top in case there are other iframes in the page (like in sharing widgets)
}

function removeSidebar(){
  if(sidebar){
    sidebar = window.top.document.getElementById("wordDefSidebar");
    sidebar.parentNode.removeChild(sidebar); //remove any old word definitions
  }
}
/* -----------------------------------------------------------------------------
 * EOF
 * ---------------------------------------------------------------------------*/
