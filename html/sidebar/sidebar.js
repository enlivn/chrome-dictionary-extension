/*------------------------------------------------------------------------------
 * Filename: sidebar.js
 * Author: Neeraj Rao; neeraj AT cise.ufl.edu
------------------------------------------------------------------------------*/
window.onload = function(){
  /* we cannot have this code in contentscript because of the same-origin policy */
  clearList = document.getElementById("clearList");
  clearList.addEventListener("click",clearWordList);
  function clearWordList(){
    chrome.extension.sendRequest({message: "clearWordlist"}, function(){}); //ask background page to clear wordlist and return a 'Wordlist empty' message
    //sidebarContent = document.getElementById('sidebarContent');
    //sidebarContent.innerHTML = "Wordlist empty";
  }

  helpButton = document.getElementById("helpButton");
  helpButton.addEventListener("click",openHelp);
  function openHelp(){
    chrome.extension.sendRequest({message: "openHelp"}, function(){}); //route to contentScript via background page
  }

  closeButton = document.getElementById("closeButton");
  closeButton.addEventListener("click",removeSidebar);
  function removeSidebar(){
    chrome.extension.sendRequest({message: "removeSidebar"}, function(){}); //route to contentScript via background page
  }

  summary = document.getElementById("summary");
  summary.addEventListener("click",openSummary);
  function openSummary(){
    chrome.extension.sendRequest({message: "openSummary"}, function(){}); //ask background page to generate a summary and open up summary.html
  }

  chrome.extension.onRequest.addListener(
    function(request,sender,sendResponse){
      if(request.message.match(/populateWordlist/)){ //comes from background page
        sidebarContent = document.getElementById('sidebarContent');
        newWord = request.message.split('\\');
        var temp = "";
        var rowOdder = true;
        for(var i=1;i<newWord.length-1;i++){
          if(newWord[i].match(';')){
            word = newWord[i].split(';');
            if(i==1) temp += "<table id='word-meanings'>";

            if(rowOdder) trClass = 'oddrow';
            else trClass = 'evenrow';
            rowOdder = !rowOdder;

            if(word[2]!=""){
              temp += "<tr class='word "+trClass+"'><td class='firstCol'><span class='origWord'>"+word[0]+"</span><br><span class='sense'>("+word[2]+")</span></td><td class='secondCol'><span class='pos'>"+word[1]+"</span></td>";
            }
            else{
              temp += "<tr class='word "+trClass+"'><td class='firstCol'><span class='origWord'>"+word[0]+"</span></td><td class='secondCol'><span class='pos'>"+word[1]+"</span></td>";
            }
            if(word[4]!=""){
              temp += "<td class='thirdCol'>"+word[3]+"<br><span class='sense'>("+word[4]+")</span></td>";
            }
            else{
              temp += "<td class='thirdCol'>"+word[3]+"</span></td>";
            }
            temp += "<td class='fourthCol'><a href='#' onclick='return false;'><img id='word"+i+"' src='sidebar/gloss.png'/></a></td></tr>";
            gloss = "";
            for(var j=5;j<word.length;j++){
              gloss += word[j]; //in case the gloss also had a ';' in it
              if(j!==word.length-1) gloss += ';'; //in case the gloss also had a ';' in it
            }
            temp += "<tr class='gloss "+trClass+"' id='gloss"+i+"'><td colspan=4 class='tdgloss'>"+gloss+"</td></tr>";
            if(i==newWord.length-2) temp += "</table>";
          }
          else{
            temp += "<div id='infoMsg'>"+newWord[1]+"</div>"; //'Wordlist empty'
          }
        }
        //console.log(temp);
        sidebarContent.innerHTML = temp;
        $('td.fourthCol').click(function(event){
          num = event.target.id.match(/\d+/);
          id = "#gloss"+num;
          //console.log('img#word'+num)
          if($(id).is(":visible")){
            $(id).hide(200);
            $('img#word'+num).attr('src','sidebar/gloss.png');
          }
          else{
            $(id).show(200);
            $('img#word'+num).attr('src','sidebar/glossOn.png');
          }
        })
      }
    }
  );


  chrome.extension.sendRequest({message: "populateWordlist"}, function(){}); //every time sidebar is loaded, ask background page to return list of stored words
}
/*------------------------------------------------------------------------------
 * EOF
------------------------------------------------------------------------------*/
