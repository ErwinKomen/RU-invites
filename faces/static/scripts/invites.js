var django = {
  "jQuery": jQuery.noConflict(true)
};
var jQuery = django.jQuery;
var $ = jQuery;

var ru = (function ($, ru) {
  "use strict";

  ru.invites = (function ($, config) {
    var bInitialized = false,
        streaming = false,
        video = document.querySelector('#web_video'),
        canvas = document.querySelector('#web_canvas'),
        buttoncontent = document.querySelector('#buttoncontent'),
        slider = document.getElementById("slide_range"),
        width = 400,
        height = 0;

    var private_methods = {

      // Take a picture and return the data
      // See: https://stackoverflow.com/questions/41575083/how-to-take-an-image-from-the-webcam-in-html/41575483
      takepicture: function () {
        video.style.display = "none";
        canvas.style.display = "block";

        // Make sure we set the canvas to hold the picture
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(video, 0, 0, width, height);

        // Put all the PNG data into [data]
        var data = canvas.toDataURL('image/png');

        // Return the data
        return data;
      },

      zeroFill: function( number, width ) {
        width -= number.toString().length;
        if ( width > 0 ) {
          return new Array( width + (/\./.test( number ) ? 2 : 1) ).join( '0' ) + number;
        }
        return number + ""; // always return a string
      }

    };

    // Methods that are exported for outside functions by [ru.invites]
    return {
      // Initialise the events 
      init_events: function (idx) {

        // Set default index
        if (idx == undefined) idx = 1;

        // General initialisations
        width = 400,
        height = 0;

        // Check the variables
        switch (idx) {
          case 1:
            if (video == null) video = document.querySelector('#web_video');
            if (canvas == null) canvas = document.querySelector('#web_canvas');
            if (buttoncontent == null) buttoncontent = document.querySelector('#buttoncontent');
            // Some necessary methods
            navigator.getMedia = (navigator.getUserMedia ||
              navigator.webkitGetUserMedia ||
              navigator.mozGetUserMedia ||
              navigator.msGetUserMedia);

            navigator.getMedia(
              { video: true, audio: false },
              function (stream) {
                if (navigator.mozGetUserMedia) {
                  video.mozSrcObject = stream;
                } else {
                  var vendorURL = window.URL || window.webkitURL;
                  video.src = vendorURL.createObjectURL(stream);
                }
                video.play();
              },
              function (err) {
                console.log("An error occured! " + err);
              }
            );

            video.addEventListener('canplay', function (ev) {
              if (!streaming) {
                height = video.videoHeight / (video.videoWidth / width);
                video.setAttribute('width', width);
                video.setAttribute('height', height);
                canvas.setAttribute('width', width);
                canvas.setAttribute('height', height);
                streaming = true;
              }
            }, false);
            break;
          case 2:
            if (slider == null) slider = document.querySelector("#slide_range");
            // add listener for the slider
            if (slider !== null) {
              slider.oninput = function () {
                var picnum = 0;

                // Get the value of the slider
                picnum = this.value;
                $("#testpic").html("picture number = " + picnum);
              }
            }
            break;
        }

        // Indicate that we are initialized
        bInitialized = true;
      },

      // show the picture indicated by the slider number
      update_mixer : function(el) {
        var picnum = 0,
            elTest = null,
            sPicName = "",
            sNumber = "",   // Zero-padded number
            sValue = "";

        // Get the picture number (string to integer)
        sValue = $(el)[0].value;
        if (sValue !== undefined && sValue !== "") {
          picnum = parseInt(sValue, 10);
          sNumber = private_methods.zeroFill(picnum, 3);

          // Hide all pictures
          $(".result-pic").addClass("hidden");
          // SHow the one picture we need
          $("#pic" + sNumber).removeClass("hidden");

          // Testing: show the picture name
          sPicName = "static/tmp/frame" + sNumber + ".png";
          elTest = $("#testpic");
          $(elTest).html("showing " + sPicName);
        }

      },

      // Handle taking a picture and moving to the next page
      handle_picture: function (iCounter) {
        var data = [],
            elMsg = null,
            img = null,
            counter = 1,            // The number for this image
            ajaxurl = "/post_img";  // Where to post the image to

        // Check initialization
        if (!bInitialized) {
          ru.invites.init_events();
        }

        // Check the number
        if (iCounter === undefined) { iCounter = '1';}

        // Take a picture and save it
        img = private_methods.takepicture();
        data.push(
          { 'name': 'image_content', 'value': img },
          { 'name': 'counter', 'value': iCounter }
        );

        // Send the picture to the server
        elMsg = "#storing";
        $.post(ajaxurl, data, function (response) {
          var oResponse = null;
          // Sanity check
          if (response !== undefined) {
            oResponse = JSON.parse(response);
            if (oResponse['status'] == "ok") {
              if ('html' in oResponse) {
                $(elMsg).html(oResponse['html']);
              } else {
                $(elMsg).html("Response is okay, but [html] is missing");
              }
              // Navigate to the correct place
              window.location.href = "/picture";
            } else {
              $(elMsg).html("Could not interpret response " + response.status);
            }
          }
        });

      },

      // Select the emperor with the indicated id
      set_keizer: function (el, idx) {
        var elRow = null,
            elTable = null;

        // Get the row and the table
        if (el !== undefined) {
          elRow = $(el).closest("tr");
          elTable = $(el).closest("tbody");
          // Change the style of this one row
          $(elTable).find("tr").removeClass("selected");
          $(elRow).addClass("selected");
          // Make sure the next button is available
          $("#keizerkeuze").removeClass("hidden");
          $("#keizerkeuze").attr("href", "/choose?id=" + idx);
        }
        
      }

    }

  }($, ru.config));

  return ru;
}(jQuery, window.ru || {}));
