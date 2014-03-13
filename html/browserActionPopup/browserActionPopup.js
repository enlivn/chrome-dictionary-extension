/*------------------------------------------------------------------------------
 * Filename: browserActionPopup.js
 * Author: Neeraj Rao; neeraj AT cise.ufl.edu
------------------------------------------------------------------------------*/
enabled = false;
highlightOn = false;
sidebarOn = false;
autoset = false;
$(window).load(function(){
  chrome.extension.sendRequest({message: "wasPageAlreadyLoaded"}, function(){});
  $('#getHelpURL').click(function(){
    chrome.extension.sendRequest({message: "openHelp"}, function(){}); //ask the background page for extension state
  });

  chrome.extension.onRequest.addListener(
    function(request,sender,sendResponse){
      if(request.message == "readyBrowserPopup"){ //contentScript is letting us know that the page has finished loading
        if(request.onceInited){
          chrome.extension.sendRequest({message: "getExtStatus"}, function(){}); //ask the background page for extension state
        }
      }
      else if(request.message == "returnStatus"){ //background page has returned extension state
        console.log("response received from background page");
        if(request.valid){
          enabled = request.enabled;
          highlightOn = request.highlight;
          sidebarOn = request.sidebar;
          $('#popupDicLoadingIcon').attr("z-index","0");
          $('#popupDicLoadingIcon').hide();
          $('#popupDic-table').show();
          createBoxes();
          if(enabled){
            autoset = true;
            $('#on_off').iButton("toggle",true);
          }
        }
        else{ //meant for chrome:// pages where popupDic won't work
          $('#popupDicLoadingIcon').hide();
          $('#popupDic-infoMsg').show();
        }
      }
    }
  );

  function createBoxes(){
    /* Turn highlighting on/off */
    $('#highlight').iButton({
      duration: 100,
      labelOn: 'ON',
      labelOff: 'OFF',
      enableFx: true,
      change: function() {
        if(!$('#highlight').is(':disabled') && !autoset && $('#on_off').is(':checked')){ //disabling also triggers onChange; we just want it trigerred for unchecking
          if($('#highlight').is(':checked')){
            highlightOn = true;
            chrome.extension.sendRequest({message: "highlightOn"}, function(){}); //inform the background page that highlight is ON
          }
          else{
            highlightOn = false;
            chrome.extension.sendRequest({message: "highlightOff"}, function(){}); //inform the background page that highlight is OFF
          }
        }
      }
    });
    $("#highlightLabel").css({"color": "gray"});

    /* Turn sidebar on/off */
    $('#showSidebar').iButton({
      duration: 100,
      labelOn: 'ON',
      labelOff: 'OFF',
      enableFx: true,
      change: function() {
        if(!$('#showSidebar').is(':disabled') && !autoset && $('#on_off').is(':checked')){ //disabling also triggers onChange; we just want it trigerred for unchecking
          if($('#showSidebar').is(':checked')){
            sidebarOn = true;
            chrome.extension.sendRequest({message: "showSidebar"}, function(){}); //inform the background page that sidebar is ON
          }
          else{
            sidebarOn = false;
            chrome.extension.sendRequest({message: "removeSidebar"}, function(){}); //inform the background page that sidebar is OFF
          }
        }
      }
    });
    $("#showSidebarLabel").css({"color": "gray"});

    $('#on_off').iButton({
      duration: 100,
      labelOn: 'ON',
      labelOff: 'OFF',
      change: function(){
        if($('#on_off').is(':checked')){
          if(!autoset) chrome.extension.sendRequest({message: "enabled"}, function(){}); //inform the background page that the extension has been enabled

          //enable and check the highlighting checkbox
          if(highlightOn) $('#highlight').iButton("toggle",true);
          if($('#highlight').is(':disabled')){
            $('#highlight').iButton("disable");
          }
          $("#highlightLabel").css({"color": "black"});

          //enable and check the sidebar checkbox
          if(sidebarOn) $('#showSidebar').iButton("toggle",true);
          if($('#showSidebar').is(':disabled')){
            $('#showSidebar').iButton("disable");
          }
          $("#showSidebarLabel").css({"color": "black"});

          autoset = false;
          enabled = true;
        }
        else if(!$('#on_off').is(':checked') && enabled){
          enabled = false;
          chrome.extension.sendRequest({message: "disabled"}, function(){}); //inform the background page that the extension has been disabled

          //disable the highlighting checkbox; turn it off first if it's already on
          if($('#highlight').is(':checked')){
            $('#highlight').iButton("toggle",false);
          }
          if(!$('#highlight').is(':disabled')){
            $('#highlight').iButton("disable");
          }
          $("#highlightLabel").css({"color": "gray"}); //update text color to gray so it looks disabled
          chrome.extension.sendRequest({message: "highlightOff"}, function(){}); //inform the background page that highlight is OFF

          //disable the sidebar checkbox; turn it off first if it's already on
          if($('#sidebarOn').is(':checked')){
            $('#sidebarOn').iButton("toggle",false);
          }
          if(!$('#sidebarOn').is(':disabled')){
            $('#sidebarOn').iButton("disable");
          }
          $("#showSidebarLabel").css({"color": "gray"}); //update text color to gray so it looks disabled
          chrome.extension.sendRequest({message: "removeSidebar"}, function(){}); //inform the background page that highlight is OFF
        }
      }
    });
  }
});
/*------------------------------------------------------------------------------
 * EOF
------------------------------------------------------------------------------*/
