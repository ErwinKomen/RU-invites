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
        loc_errDiv = "#error_messages",
        loc_keizerkeuze = 0,
        mediaOptions = { audio: false, video: true},
        video = document.querySelector('#web_video'),
        canvas = document.querySelector('#web_canvas'),
        buttoncontent = document.querySelector('#buttoncontent'),
        slider = document.getElementById("slide_range"),
        butMain = document.querySelector("#main_button"),
        spanLead = document.querySelector("#lead_text"),
        width = 400,
        height = 0,
        imgcount = 0,
        button_list = null;

    var private_methods = {

      // Take a picture and return the data
      // See: https://stackoverflow.com/questions/41575083/how-to-take-an-image-from-the-webcam-in-html/41575483
      takepicture: function () {
        canvas.style.display = "block";

        // Double check the width/height
        if (video !== null) {
          width = video.clientWidth;
          height = video.videoHeight / (video.videoWidth / width);
        }

        // Temporarily switch off the width here
        video.style.display = "none";

        // Make sure we set the canvas to hold the picture
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(video, 0, 0, width, height);

        // Put all the PNG data into [data]
        var data = canvas.toDataURL('image/png');

        // Return the data
        return data;
      },

      showError(sFunction, ex) {
        var sMsg = "Error in " + sFunction

        // Check ex
        if (ex !== undefined && ex !== null) {
          sMsg = "Error in " + sFunction + ": " + ex.message;
        } else {
          // The 'function'  is the whole error message
          sMsg = sFunction;
        }

        if (loc_errDiv !== undefined && loc_errDiv !== null) {
          $(loc_errDiv).html("<p><code>"+sMsg+"</code></p>");
        }
      },

      // Get the list of button definitions
      get_buttons: function (sStage) {
        var ajaxurl = "/post_buttonlist";

        try {
          if (button_list === null) {
            $.post(ajaxurl, null, function (response) {
              // Sanity check
              if (response !== undefined) {
                // Get the definitions
                button_list = JSON.parse(response);
                // If a stage is defined, go to it
                if (sStage !== undefined && sStage !== "") {
                  ru.invites.init_stage(sStage);
                }
              }
            });
          }
        } catch (ex) {
          private_methods.showError("get_buttons", ex);
        }
      },

      // Get the image count number
      get_imgcount: function (func_next) {
        var ajaxurl = "/post_imgcount";

        try {
          if (butMain !== null) {
            // Reset my imgcount
            imgcount = 0;
            // Issue a POST
            $.post(ajaxurl, null, function (response) {
              // Sanity check
              if (response !== undefined) {
                // Get the definitions
                imgcount = parseInt(response, 10);
                console.log("get_imgcount: " + imgcount.toString());
                // Set it on the correct place
                $(butMain).attr("picnum", imgcount.toString());
                // If necessary call the next function
                if (func_next !== undefined) {
                  func_next();
                }
              }
            });
          }
        } catch (ex) {
          private_methods.showError("get_imgcount", ex);
        }
      },

      // Trigger one particular stage and load the result
      load_stage: function (ajaxurl, data, func_next) {
        try {
          $.post(ajaxurl, data, function (response) {
            var oResponse = null;
            // Sanity check
            if (response !== undefined) {
              oResponse = JSON.parse(response);
              if (oResponse['status'] == "ok") {
                if ('html' in oResponse) {
                  // Load the response in the appropriate place
                  $("#pane_container").html(oResponse['html']);
                  // Perform the next function if defined
                  if (func_next !== undefined) {
                    func_next();
                  }
                } else {
                  $(loc_errDiv).html("Response is okay, but [html] is missing");
                }
              } else if (oResponse['status'] === "error") {
                $(loc_errDiv).html(oResponse['html']);
              } else {
                $(loc_errDiv).html("Could not interpret response " + response.status);
              }
            }
          });

        } catch (ex) {
          private_methods.showError("load_stage", ex);
        }
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
        width = 400;
        height = 0;

        // Check the variables
        switch (idx) {
          case 1:
            if (video == null) video = document.querySelector('#web_video');
            if (canvas == null) canvas = document.querySelector('#web_canvas');
            if (buttoncontent == null) buttoncontent = document.querySelector('#buttoncontent');
            if (butMain == null) butMain = document.querySelector("#main_button");
            if (spanLead == null) spanLead = document.querySelector("#lead_text");

            if (!navigator.getUserMedia) {
              navigator.getUserMedia = navigator.getUserMedia ||
                navigator.webkitGetUserMedia ||
                navigator.mozGetUserMedia ||
                navigator.msGetUserMedia;
            }

            if (!navigator.getUserMedia) {
              private_methods.showError("getUserMedia not supported in this browser", null);
              return alert('getUserMedia not supported in this browser.');
            }

            navigator.getUserMedia(mediaOptions,
              function (stream) {
                video = document.querySelector('#web_video');
                video.src = window.URL.createObjectURL(stream);
              },
              function (e) {
                private_methods.showError("error2: ", e);
                console.log(e);
              });

            // Get current width and height
            if (video !== null) {
              width = video.clientWidth;
              height = video.videoHeight / (video.videoWidth / width);
            }

            // Make sure the width and height is kept okay
            $(video).off();
            $(video).on("canplay", function (ev) {
              if (!streaming) {
                height = video.videoHeight / (video.videoWidth / width);
                video.setAttribute('width', width);
                video.setAttribute('height', height);
                canvas.setAttribute('width', width);
                canvas.setAttribute('height', height);
                streaming = true;
              }
            });



            /*
            // Some necessary methods
            navigator.getMedia = (navigator.getUserMedia ||
              navigator.webkitGetUserMedia ||
              navigator.mozGetUserMedia ||
              navigator.msGetUserMedia);

            // Only continue if we have it
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
              navigator.mediaDevices.getUserMedia(
                // Specify what to show and hear
                { video: true, audio: false })
                // Specify what to do when conditions are met
                .then(function (stream) {
                  // video.srcObject = stream;
                  if (navigator.mozGetUserMedia) {
                    video.mozSrcObject = stream;
                    video.srcObject = stream;
                    video.src = window.URL.createObjectURL(stream);
                  } else {
                    var vendorURL = window.URL || window.webkitURL;
                    video.src = vendorURL.createObjectURL(stream);
                  }
                  // Make sure the video starts playing
                  video.play();
                })
                // Specify what to do when an exception occurs
                .catch( function (err) {
                  console.log("An error occured! " + err);
                  private_methods.showError("getMedia", err);
              });


              //navigator.getMedia(
              //  { video: true, audio: false },
              //  function (stream) {
              //    if (navigator.mozGetUserMedia) {
              //      video.mozSrcObject = stream;
              //    } else {
              //      var vendorURL = window.URL || window.webkitURL;
              //      video.src = vendorURL.createObjectURL(stream);
              //    }
              //    video.play();
              //  },
              //  function (err) {
              //    console.log("An error occured! " + err);
              //  }
              //);
            }

            //video.addEventListener('canplay', function (ev) {
            //  if (!streaming) {
            //    height = video.videoHeight / (video.videoWidth / width);
            //    video.setAttribute('width', width);
            //    video.setAttribute('height', height);
            //    canvas.setAttribute('width', width);
            //    canvas.setAttribute('height', height);
            //    streaming = true;
            //  }
            //}, false);

            */

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

        // Load the button definitions and load 'start'
        // Also make sure the correct stage is initialized
        private_methods.get_buttons("start");

        //// Make sure the correct stage is initialized
        //ru.invites.init_stage("start");

      },

      media_success : function(stream) {
        var video = document.querySelector('#web_video');
        video.src = window.URL.createObjectURL(stream);
      },

      // show the picture indicated by the slider number
      update_mixer : function(el, sSessionIdx) {
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
          if (sSessionIdx === undefined || sSessionIdx === "") {
            sSessionIdx = "0";
          }
          sPicName = "static/tmp/" + sSessionIdx + "/frame" + sNumber + ".png";
          elTest = $("#testpic");
          //$(elTest).html("showing " + sPicName);
        }

      },

      // Initialise the indicated stage
      init_stage: function (sStage) {
        var i = 1,
            data = [],
            oInfo = null;

        try {
          console.log("init_stage " + sStage + ": " + imgcount.toString());
          // Find the indicated stage
          for (i = 0; i < button_list.length - 1; i++) {
            oInfo = button_list[i];
            if (oInfo['stage'] === sStage) {
              // We found the stage
              // Set the text of the button
              $(butMain).html(oInfo["text"]);
              // Set the title of the button
              $(butMain).attr("title", oInfo["title"]);
              // Set the lead text
              $(spanLead).html(oInfo["lead"]);

              // Remove all previous listeners
              $(butMain).off();
              // Set the new event listener
              $(butMain).on("click", function () { ru.invites.init_stage(oInfo["next"]); });
              // Break free
              break;
            }
          }

          // Action depends on the stage
          switch (sStage) {
            case "start": // Opening screen
              // Make sure initialization happens (again)
              ru.invites.init_events(1);
              // Make sure the buttons are visible
              $(butMain).removeClass("hidden");
              // Load the correct information
              private_methods.load_stage("/post_start", data, function () {
                // Make sure a new image count is fetched
                private_methods.get_imgcount();
              });
              break;
            case "picture":
              // Make sure we get the right image count
              private_methods.get_imgcount(function () {
                // Snap the picture right now
                ru.invites.handle_picture(imgcount, function () {
                  // Load the next page with this picture upon success
                  private_methods.load_stage("/post_picture", data, function () {
                    // Hide the 'next' button until the user has chosen an emperor
                    $(butMain).addClass("hidden");
                  });
                });
              });
              break;
            case "choose":
              // Make sure the buttons are visible
              $(butMain).removeClass("hidden");
              // Set the chosen emperor
              data.push({ "name": "id", "value": loc_keizerkeuze});
              // Load the correct page 
              private_methods.load_stage("/post_choose", data);
              break;
            case "mix":
              // Make sure the buttons are visible
              $(butMain).removeClass("hidden");
              // Start up a process to receive status feedback after a few milliseconds
              setTimeout(function () { ru.invites.show_status(); }, 200);
              // Start up the mixer: the facemorphing process
              private_methods.load_stage("/post_mix", data);
              break;
          }

        } catch (ex) {
          private_methods.showError("init_stage", ex);
        }
      },

      /**
       * plus_click
       *   Show or hide the <tr> elements under me, using 'nodeid' and 'childof'
       *   Also: 
       *    - adapt the +/- sign(s)
       *    - show the [arg-summary] part when sign is '+', otherwise hide it
       */
      plus_click: function (el, sClass, bShow) {
        var trNext = null,
            sStatus = "",
            elSummary = null,
            trMe = null,
            nodeid = 0;

        try {
          // Validate
          if (el === undefined) { return; }
          if ($(el).html().trim() === "") { return; }
          // Get my nodeid as INTEGER
          trMe = $(el).closest("tr");
          nodeid = $(trMe).attr("nodeid");
          // Get my status
          sStatus = $(el).html().trim();
          if (bShow !== undefined && bShow === false) {
            sStatus = "-";
          }
          // Get *ALL* the <tr> elements that are my direct children
          trNext = $(el).closest("tbody").find("tr");
          $(trNext).each(function (index) {
            if ($(this).attr("childof") === nodeid) {
              if (sStatus === "+") {
                // show it
                $(this).removeClass("hidden");
              } else {
                // hide it
                $(this).addClass("hidden");
                // Hide children too
                crpstudio.htable.plus_click($(this).find(".arg-plus").first(), loc_ht4, false);
              }
              if ($(this).hasClass("arg-grandchild")) {
                // hide it
                $(this).addClass("hidden");
              }
            }
          });
          // Find my own summary part
          elSummary = $(el).nextAll(".arg-text").find(".arg-summary").first();
          // Change my own status
          switch (sStatus) {
            case "+":
              $(el).html("-");
              // Hide the arg-summary
              $(elSummary).addClass("hidden");
              break;
            case "-":
              $(el).html("+");
              // Show the arg-summary
              $(elSummary).removeClass("hidden");
              break;
          }

        } catch (ex) {
          private_methods.showError("plus_click", ex);
        }
      },

      // Show the current status
      show_status: function () {
        var elStatus = null,
            elProgress = null,
            elBar = null,
            percentage = 0,
            data = [],
            lHtml = [];

        try {
          // Try to find the status div
          elStatus = $("#py_status");
          elProgress = $("#py_progress");
          elBar = $(elProgress).find(".progress-bar").first();
          // Indicate who we are to get the correct status
          data.push({"name": "session_id", "value": imgcount });
          // Get the status
          $.post("/post_status", data, function (response) {
            var oResponse = null,
                sHtml = "";
            // Sanity check
            if (response !== undefined) {
              oResponse = JSON.parse(response);
              if ('status' in oResponse && 'msg' in oResponse) {
                //  =========== DEBUG ============
                console.log("show_status 1: " + oResponse['msg']);
                // ===============================

                // Combine the status and the message
                lHtml = [];
                lHtml.push("<table>");
                lHtml.push("<tr><td>Status</td><td>" + oResponse['status'] + "</td></tr>");
                lHtml.push("<tr><td>Info</td><td>" + oResponse['msg'] + "</td></tr>");
                lHtml.push("</table>");
                // sHtml = "<span>Status=" + oResponse['status'] + "</span><span>" + oResponse['msg'] + "</span>";
                sHtml = lHtml.join("\n");
                $(elStatus).html(sHtml);

                // Make sure the status is updated if needed
                switch (oResponse['status']) {
                  case "finish":
                    //  =========== DEBUG ============
                    console.log("show_status 2: finish");
                    // ===============================

                    // Hide the progress bar
                    $(elBar).attr("style", "width: 0%;");
                    $(elProgress).addClass("hidden");
                    break;
                  case "mix":
                  case "callback":
                    //  =========== DEBUG ============
                    console.log("show_status 3: mix");
                    // ===============================
                    if ('ptc' in oResponse) {
                      percentage = oResponse['ptc'];
                    } else {
                      // Set the percentage to zero
                      percentage = 0;
                    }
                    $(elBar).attr("aria-valuenow", percentage.toString());
                    $(elBar).attr("style", "width: "+percentage.toString()+"%;");
                    $(elBar).html(percentage.toString());
                    // Make sure progress bar is visible
                    $(elProgress).removeClass("hidden");
                    setTimeout(function () { ru.invites.show_status(); }, 200);
                    break;
                }
              }
            }
          });
        } catch (ex) {
          private_methods.showError("show_status", ex);
        }
      },

      // Handle taking a picture and moving to the next page
      handle_picture: function (iCounter, func_next) {
        var data = [],
            elMsg = null,
            img = null,
            counter = 1,            // The number for this image
            ajaxurl = "/post_img";  // Where to post the image to

        try {
          // Check initialization
          if (!bInitialized) {
            ru.invites.init_events();
          }
          // Check the number
          if (iCounter === undefined) { iCounter = '1'; }

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
                  if (func_next === undefined) {
                    $(elMsg).html(oResponse['html']);
                  } else {
                    // Execute the next function
                    func_next();
                  }
                } else {
                  $(elMsg).html("Response is okay, but [html] is missing");
                }
                if (func_next === undefined) {
                  // Navigate to the correct place
                  window.location.href = "/picture";
                }
              } else {
                $(elMsg).html("Could not interpret response " + response.status);
              }
            }
          });
        } catch (ex) {
          private_methods.showError("handle_picture", ex);
        }
      },

      // Select the emperor with the indicated id
      set_keizer: function (el, idx) {
        var elRow = null,
            elTable = null;

        try {
          // Get the row and the table
          if (el !== undefined) {
            elRow = $(el).closest("tr");
            elTable = $(el).closest("tbody");
            // Change the style of this one row
            $(elTable).find("tr").removeClass("selected");
            $(elRow).addClass("selected");

            // Make sure the main button is available again
            $(butMain).removeClass("hidden");
            $(butMain).html("Neem keizer #" + idx);
            loc_keizerkeuze = idx;

            //$("#keizerkeuze").removeClass("hidden");
            //$("#keizerkeuze").attr("href", "/choose?id=" + idx);
          }
        } catch (ex) {
          private_methods.showError("set_keizer", ex);
        }
        
      }

    }

  }($, ru.config));

  return ru;
}(jQuery, window.ru || {}));
