/*------------------------------------------------------------------------------
 * Filename: summary.js
 * Author: Neeraj Rao; neeraj AT cise.ufl.edu
------------------------------------------------------------------------------*/
numLookedUpWords = 0;
numHighlights = 0;
numWordsRemembered = 0;
duration = 200;
window.onload = function(){
  chrome.extension.sendRequest({message: "getSummaryStats"}, function(response){
    numWordsLookedUp = response.numWordsLookedUp;
    numHighlights = response.numHighlights;
    numHighlightsReminded = response.numHighlightsReminded;
    numDaysInstalled = response.numDaysInstalled;
    $('#wordList').html(response.displayHTML);
    if(numWordsLookedUp == 0){ //no words have been looked up yet
      $('#summarySkeleton').show(duration);
      $('#error').show(duration);
    }
    else{
      $('#numWordsLookedUp').html("You have been using <em>popupDic</em> for <b>"+numDaysInstalled+"</b> day(s).<br><br>In this interval, you have looked up a total of <b>"+numWordsLookedUp+"</b> words; an average of <b>"+Math.round((numWordsLookedUp/numDaysInstalled)*100)/100+"</b> per day."); //neeraj finish days tracking
      $('#numHighlights').html("You have activated highlighting <b>"+Math.round((numHighlights/numDaysInstalled)*100)/100+"</b> times per day on average.");
      $('#numHighlightsReminded').html("You have reminded yourself of meanings <b>"+numHighlightsReminded+"</b> time(s); an average of <b>"+Math.round((numHighlightsReminded/numDaysInstalled)*100)/100+"</b> time(s) per day."); //neeraj finish days tracking
      $('#trnumWordsRemembered').hide();
      $('#summarySkeleton').show(duration);
      $('#trnumWordsLookedUp').show(duration);
      $('#numWordsLookedUp').show(duration);
      $('#trnumHighlights').show(duration);
      $('#trnumHighlightsReminded').show(duration);
      $('#numHighlights').show(duration);
      $('#numHighlightsReminded').show(duration);
      $('#next1').show(duration);
    }
  });

  $('#nextBtn1').click(function(){
    $('#trnumHighlights').hide();
    $('#trnumHighlightsReminded').hide();
    $('#next1').hide();
    $('#trdoYouRemember').show(duration);
    $('#wordList').show(duration);
    $('#next2').show(duration);
  });

  $('#nextBtn2').click(function(){
    value = $('#numRememberedWords').val().trim();
    if(!value || value.match(/\D+/)){ //validate input
      alert("Please enter a valid number!");
    }
    else if(value>numWordsLookedUp){
      alert("Your input must not exceed the total number of words!");
    }
    else{
      $('#next2').hide();
      $('#wordList').hide();
      $('#trdoYouRemember').hide();
      numWordsRemembered = $('#numRememberedWords').val();
      $('#numWordsRemembered').html("You remembered <b>"+numWordsRemembered+"</b> out of <b>"+numWordsLookedUp+"</b> words.");
      $('#finalResults').html("<b>1. Total number of words looked up.<br><font style='color:red'>"+numWordsLookedUp+"</font><br><br>2. Total number of days popupDic installed.<br><font style='color:red'>"+numDaysInstalled+"</font><br><br>3. Average number of words looked up per day.<br><font style='color:red'>"+Math.round((numWordsLookedUp/numDaysInstalled)*100)/100+"</font><br><br>4. Number of words you remembered.<br><font style='color:red'>"+numWordsRemembered+"</font><br><br>5. Average number of times highlighting activated per day.<br><font style='color:red'>"+Math.round((numHighlights/numDaysInstalled)*100)/100+"</font><br><br>6. Average number of meanings reminded per day.<br><font style='color:red'>"+Math.round((numHighlightsReminded/numDaysInstalled)*100)/100+"</font></b>");
      $('#trnumHighlights').show();
      $('#trnumHighlightsReminded').show();
      $('#trnumWordsRemembered').show(duration);
      $('#numWordsRemembered').show(duration);
      $('#next3').show(duration);
    }
  });

  $('#nextBtn3').click(function(){
    $('#trnumWordsLookedUp').hide();
    $('#trnumHighlights').hide();
    $('#trnumHighlightsReminded').hide();
    $('#trnumWordsRemembered').hide();
    $('#trfinalResults').show();
    $('#finalResults').show();
    $('#next3').hide();
    $('#survey1').show();
    $('#survey2').show();
  });

  $('#goToSurvey').click(function(){
  });
}
/*------------------------------------------------------------------------------
 * EOF
------------------------------------------------------------------------------*/
