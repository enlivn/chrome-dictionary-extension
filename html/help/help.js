/*****************************************************************************
 * Start of File
 *****************************************************************************/
$(document).ready(function() {
  /***************************************************************************
   * Common
   ***************************************************************************/
  $("div#helpDiv").tabs(); //add tabbed navigation to right-hand side
  $("#chooseYourPoison").myTabs("div.yourPoison",{event:'mouseover'}); //add tabbed navigation to right-hand side
  $('#popupDicOnOffChoice').css('background-image','-webkit-gradient(linear, left top, left bottom, color-stop(0, white), color-stop(1, #B1DBD1))');

  $(".featuresChoice")
  .mouseenter(function(){
    $(".featuresChoice").css('background-image','-webkit-gradient(linear, left top, left bottom, color-stop(0, white), color-stop(1, #E7E59C))');
    $(this).css('background-image','-webkit-gradient(linear, left top, left bottom, color-stop(0, white), color-stop(1, #B1DBD1))');
  })

  /* Hover effects for buttons
     Source: www.filamentgroup.com/examples/buttonFrameworkCSS */
  $(".fg-button:not(.ui-state-disabled)")
    .hover(
      function(){
        $(this).addClass("ui-state-hover");
      },
      function(){
        $(this).removeClass("ui-state-hover");
      }
  )
  .mousedown(function(){
    $(this).parents('.fg-buttonset-single:first').find(".fg-button.ui-state-active").removeClass("ui-state-active");
    if( $(this).is('.ui-state-active.fg-button-toggleable, .fg-buttonset-multi .ui-state-active') ){ $(this).removeClass("ui-state-active"); }
    else { $(this).addClass("ui-state-active"); }
  })
  .mouseup(function(){
   if(! $(this).is('.fg-button-toggleable, .fg-buttonset-single .fg-button,  .fg-buttonset-multi .fg-button') ){
    $(this).removeClass("ui-state-active");
   }
  });
});
/*****************************************************************************
 * EOF
 *****************************************************************************/
