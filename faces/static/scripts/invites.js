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
        loc_appPfx = "/amatchmadeinrome/",
        loc_writable = "/var/www/applejack/live/writable/faces",
        loc_outFrames = loc_writable + "/tmp",
        loc_errDiv = "#error_messages",
        loc_keizerkeuze = 0,
        loc_interrupt = false,
        loc_answers = [],
        loc_sSession = "",    // The session_idx we have been assigned
        mediaOptions = { audio: false, video: { facingMode: "user" } },
        video = document.querySelector('#web_video'),
        canvas = document.querySelector('#web_canvas'),
        buttoncontent = document.querySelector('#buttoncontent'),
        slider = document.getElementById("slide_range"),
        butMain = document.querySelector("#main_button"),
        spanLead = document.querySelector("#lead_text"),
        width = 400,
        height = 0,
        loc_iSession = 0,     // This is the session_idx transformed into an integer
        loc_stage = "",
        button_list = null;

    var private_methods = {

      // Take a picture and return the data
      // See: https://stackoverflow.com/questions/41575083/how-to-take-an-image-from-the-webcam-in-html/41575483
      takepicture: function () {
        var my_canvas = ru.invites.get_canvas(),
            my_video = ru.invites.get_video(),
            my_width = ru.invites.get_width(),
            my_height = ru.invites.get_height();

        my_canvas.style.display = "block";

        // Double check the width/height
        if (my_video !== null) {
          my_width = my_video.clientWidth;
          my_height = my_video.videoHeight / (my_video.videoWidth / my_width);
        }

        // Temporarily switch off the width here
        my_video.style.display = "none";

        // Make sure we set the canvas to hold the picture
        my_canvas.width = my_width;
        my_canvas.height = my_height;
        my_canvas.getContext('2d').drawImage(my_video, 0, 0, my_width, my_height);

        // Put all the PNG data into [data]
        var data = my_canvas.toDataURL('image/png');

        // Return the data
        return data;
      },

      clearError : function() {
        if (loc_errDiv !== undefined && loc_errDiv !== null) {
          $(loc_errDiv).html("");
        }
      },

      showError: function(sFunction, ex) {
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
        var ajaxurl = loc_appPfx + "post_buttonlist";

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
        var ajaxurl = loc_appPfx + "post_imgcount";

        try {
          if (butMain !== null) {
            // Reset my imgcount
            loc_iSession = 0;
            // Issue a POST
            $.post(ajaxurl, null, function (response) {
              // Sanity check
              if (response !== undefined) {
                // Get the definitions
                loc_iSession = parseInt(response, 10);
                console.log("get_imgcount: " + loc_iSession.toString());
                // Also store the string
                loc_sSession = response;
                // Set it on the correct place
                $(butMain).attr("picnum", loc_iSession.toString());
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
      load_stage: function (ajaxurl, data, func_next, func_err) {
        try {
          $.post(ajaxurl, data, function (response) {
            var iStop = false,
                oResponse = null;
            // Check for interrupt
            if (loc_interrupt && ajaxurl.indexOf("post_mix") >=0) {
              loc_interrupt = false;
              return;
            }
            // Debugging
            if (ajaxurl.indexOf("post_start") >= 0) {
              iStop = false;
            }
            // Sanity check
            if (response !== undefined ) {
              oResponse = JSON.parse(response);
              if (oResponse['status'] == "ok") {
                if ('html' in oResponse) {
                  // Load the response in the appropriate place
                  $("#pane_container").html(oResponse['html']);
                  // Check if this response offers a new session_idx
                  if ('session_idx' in oResponse) {
                    loc_sSession = oResponse['session_idx'];
                    loc_iSession = parseInt(loc_sSession, 10);
                  }
                  if ('keizerkeuze' in oResponse) {
                    loc_keizerkeuze = oResponse['keizerkeuze'];
                  }
                  // Perform the next function if defined
                  if (func_next !== undefined) {
                    func_next();
                  }
                } else {
                  $(loc_errDiv).html("Response is okay, but [html] is missing");
                }
              } else if (oResponse['status'] === "error") {
                $(loc_errDiv).html(oResponse['html']);
                if (func_err !== undefined) {
                  func_err();
                }
              } else {
                $(loc_errDiv).html("Could not interpret response " + response.status);
              }
            }
          });

        } catch (ex) {
          private_methods.showError("load_stage", ex);
        }
      },

      allow_alternative: function (bChoice) {
        if (bChoice) {
          $(".alt-chooser").removeClass("hidden");
          $("#alt-group").addClass("btn-group");
        } else {
          $(".alt-chooser").addClass("hidden");
          $("#alt-group").removeClass("btn-group");
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
      // Parameter-less startup function
      startup: function () {
        ru.invites.init_events(1);
      },
      // Initialise the events 
      init_events: function (idx) {
        var bOption1 = false;

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

            if (!bOption1) {
              navigator.mediaDevices.getUserMedia(mediaOptions
                ).then(stream => { 
                  video = document.querySelector("#web_video");
                  // video.srcObject = stream;
                  video.src = window.URL.createObjectURL(stream);
                }).catch(error => { 
                  private_methods.showError("error #2 init_events navigator.getUserMedia: ", error);
                  console.log(error);
                });
            } else {
              navigator.getUserMedia(mediaOptions,
                function (stream) {
                  video = document.querySelector("#web_video");
                  video.src = window.URL.createObjectURL(stream);
                },
                function (e) {
                  private_methods.showError("error #2 init_events navigator.getUserMedia: ", e);
                  console.log(e);
                });
            }

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

      // Getters to make some media stuff available to private_methods...
      get_mediaOptions: function() { return mediaOptions;},
      get_video: function () { return video; },
      get_canvas: function () { return canvas; },
      get_width: function () { return width; },
      get_height: function () { return height; },

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

      do_print: function (elStart) {
        var img = null,
            imgSrc = "",
            lHtml = [],
            sHtml = "",
            newWin = null;

        try {
          // Get the selected image
          img = $(".result-pic").not(".hidden").first();
          imgSrc = img.attr("src");
          imgSrc = imgSrc.replace("amatch", "https://applejack.science.ru.nl/amatch");
          // Make html
          // lHtml.push("<html><body onload=\"window.print();\">");
          lHtml.push("<html><body>");
          lHtml.push("<div><img src='" + imgSrc + "' width='100%;'></div>");
          lHtml.push("</body></html>");
          sHtml = lHtml.join("\n");
          // Create a new window
          newWin = window.open('', 'Print-window');
          newWin.document.open();
          newWin.document.write(sHtml);
          newWin.print();
          //newWin.document.close();
          //setTimeout(function () { newWin.close(); }, 10);
          // Print this picture
          //img.parent().print();

        } catch (ex) {
          private_methods.showError("do_print", ex);
        }
      },

      // Send an email
      send_mail: function (elStart) {
        var frm = null,
            img = null,
            sEmail = "",
            data = [];

        try {
          // Get to the closest form
          frm = $(elStart).closest("form");
          if (frm !== undefined && frm !== null) {
            // Get the data from the form
            // data = $(frm).serializeArray();
            sEmail = $("#input_email").val();
            data.push({"name": "input_email", "value": sEmail});
            // Get the selected image
            img = $(".result-pic").not(".hidden").first();
            // Add the image count
            data.push({"name": "imgname", "value": $(img).attr("src")});
            // Now call the correct post function with this data
            $.post(loc_appPfx + "post_mail", data, function (response) {
              var oResponse = null,
                  sHtml = "";
              // Sanity check
              if (response !== undefined) {
                oResponse = JSON.parse(response);
                if ('status' in oResponse && 'msg' in oResponse) {
                  switch (oResponse['status']) {
                    case "ok":
                    case "started":
                      // Close the mail button
                      $("#mailpic").click();
                      // Open the mail message
                      $("#mail_msg").html("De foto is verzonden naar: <code>" + sEmail + "</code>");
                      // Remove the mail address
                      $("#input_email").val("");
                      // Fade out: after 5 seconds, take 3 seconds to gradually fade out
                      $("#mail_msg").delay(5000).fadeOut(3000);
                      break;
                    case "error":
                      break;
                  }
                }
              }

            });
          }
        } catch (ex) {
          private_methods.showError("send_mail", ex);
        }
      },

      // Go back to the user page
      my_user: function() {
        try {
          $("#pane_container").removeClass("hidden");
          $("#pane_info").addClass("hidden");
          $("#back_button").addClass("hidden");
        } catch (ex) {
          private_methods.showError("my_user", ex);
        }
      },

      // Initialise the indicated stage
      init_stage: function (sStage) {
        var i = 1,
            data = [],
            oInfo = null;

        try {
          // Initially clear the errors
          private_methods.clearError();
          console.log("init_stage " + sStage + ": " + loc_iSession.toString());
          // Find the indicated stage
          for (i = 0; i < button_list.length; i++) {
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

          // Keep track of the stage (to see if the user presses "Start again")
          // Note: removed  || loc_stage === "picture"
          if (sStage === "start" && (loc_stage === "mix")) {
            // The user has pressed "Start again" midway...
            loc_interrupt = true;
          } else {
            loc_interrupt = false;
          }
          loc_stage = sStage;

          // Always: don't allow for alternative
          private_methods.allow_alternative(false);

          // Action depends on the stage
          switch (sStage) {
            case "ack":   // Load the acknowledgements page
            case "about": // Load the 'about' page
            case "help":  // Show help
              data.push({'name': 'page', 'value': sStage});
              $.post(loc_appPfx + "post_page", data, function (response) {
                if (response === "") {
                  $(loc_errDiv).html("cannot load page " + sStage);
                } else {
                  $("#pane_container").addClass("hidden");
                  $("#pane_info").html(response);
                  $("#pane_info").removeClass("hidden");
                  $("#back_button").removeClass("hidden");
                }
              });
              break;
            case "start": // Opening screen
              $("#pane_container").removeClass("hidden");
              $("#pane_info").addClass("hidden");
              $("#back_button").addClass("hidden");
              // Make sure initialization happens (again)
              ru.invites.init_events(1);
              // Make sure the buttons are visible and enabled
              $(butMain).removeClass("hidden");
              $(butMain).removeClass("disabled");
              // Load the correct information (which includes a new loc_iSession we receive)
              private_methods.load_stage(loc_appPfx + "post_start", data, function () {
                // Show this number
                $("#session_number").html(loc_iSession.toString());
              });
              break;
            case "quiz":
              // For now inactivate the main button
              $(butMain).addClass("disabled");
              // make sure that we use 'OUR' session index
              data.push({ 'name': 'session_idx', 'value': loc_iSession });

              // Make sure we get the right image count
              //private_methods.get_imgcount(function () {

              // Check if stage hasn't changed
              if (loc_stage !== "quiz") { return; }
              // Snap the picture right now
              ru.invites.handle_picture(loc_iSession, function () {
                // Check if stage hasn't changed
                if (loc_stage !== "quiz") { return; }
                // Load the next page with this picture upon success
                private_methods.load_stage(loc_appPfx + "post_quiz", data,
                  function () {
                    // Check if stage hasn't changed
                    if (loc_stage !== "quiz") { return; }
                    // Next button is not disabled any longer
                    $(butMain).removeClass("disabled");
                    // Hide the 'next' button until the user has chosen an emperor
                    $(butMain).addClass("hidden");
                    // Allow the user to choose the alternative
                    private_methods.allow_alternative(true);
                    // Press the first button of the first question
                    $(".func-view tbody tr td").first().click();
                    // Reset the answers
                    loc_answers = [];
                  },
                  // Function if there is an error
                  function () {
                    // Make sure my image is not shown anymore
                    $("#user_image").addClass("hidden");
                    // Reveal the button
                    $("#startagain").removeClass("hidden");
                  }
                );
              });

              //});

              break;
            case "descr":     // Show all the descriptions
              // For now inactivate the main button
              $(butMain).addClass("disabled");

              //// Make sure we get the right image count
              //private_methods.get_imgcount(function () {

              // Check if stage hasn't changed
              if (loc_stage !== "descr") { return; }
              // Call the correct method
              private_methods.load_stage(loc_appPfx + "post_descr", data, function () {
                // Next button is not disabled any longer
                $(butMain).removeClass("disabled");
              },
              // Function if there is an error 
              function () {
                // Next button is not disabled any longer
                $(butMain).removeClass("disabled");
                // Make sure my image is not shown anymore
                $("#user_image").addClass("hidden");
                // Reveal the button
                $("#startagain").removeClass("hidden");
              });
              //});
              break;
            case "picture":
              // For now inactivate the main button
              $(butMain).addClass("disabled");

              //// Make sure we get the right image count
              //private_methods.get_imgcount(function () {

              // Check if stage hasn't changed
              if (loc_stage !== "picture") { return; }
              // make sure that we use 'OUR' session index
              data.push({ 'name': 'session_idx', 'value': loc_iSession });
              // Snap the picture right now, using our 'OWN' loc_iSession (==loc_sSession)
              ru.invites.handle_picture(loc_iSession, function () {
                // Check if stage hasn't changed
                if (loc_stage !== "picture") { return; }
                // Load the next page with this picture upon success
                private_methods.load_stage(loc_appPfx + "post_picture", data, 
                  function () {
                    // Check if stage hasn't changed
                    if (loc_stage !== "picture") { return; }
                    // Next button is not disabled any longer
                    $(butMain).removeClass("disabled");
                    // Hide the 'next' button until the user has chosen an emperor
                    $(butMain).addClass("hidden");
                  },
                  // Function if there is an error
                  function () {
                    // Make sure my image is not shown anymore
                    $("#user_image").addClass("hidden");
                    // Reveal the button
                    $("#startagain").removeClass("hidden");
                  }
                );
              });
              //});
              break;
            case "choose":
              // Make sure the buttons are visible
              $(butMain).removeClass("hidden");
              // For now inactivate the main button
              $(butMain).addClass("disabled");
              // Set the chosen emperor
              data.push({ "name": "id", "value": loc_keizerkeuze });
              // Set the list of q/a
              data.push({ "name": "qalist", "value": JSON.stringify( loc_answers) });
              // make sure that we use 'OUR' session index
              data.push({ 'name': 'session_idx', 'value': loc_iSession });
              // Load the correct page 
              private_methods.load_stage(loc_appPfx + "post_choose", data, function () {
                // Next button is not disabled any longer
                $(butMain).removeClass("disabled");
              });
              break;
            case "mix":
              // Make sure the buttons are visible
              $(butMain).removeClass("hidden");
              // For now inactivate the main button
              $(butMain).addClass("disabled");
              // make sure that we use 'OUR' session index
              data.push({ 'name': 'session_idx', 'value': loc_iSession });
              // Also make sure the emperor we 'chose' is in here
              data.push({ 'name': 'keizer_id', 'value': loc_keizerkeuze });
              // Start up a process to receive status feedback after a few milliseconds
              setTimeout(function () { ru.invites.show_status("mix"); }, 200);
              // Start up the mixer: the facemorphing process
              private_methods.load_stage(loc_appPfx + "post_mix", data,
                // Function if success
                function () {
                  // Next button is not disabled any longer
                  $(butMain).removeClass("disabled");
                  // Indicate that we are ready
                  loc_stage = "finished";
                },
                // Function if there is an error
                function () {
                  // Disable the progress bar
                  $("#py_progress").addClass("hidden");
                  // Make sure my image is not shown anymore
                  $("#user_image").addClass("hidden");
                  // Reveal the button
                  $("#startagain").removeClass("hidden");
                }
              );
              break;
          }

        } catch (ex) {
          private_methods.showError("init_stage", ex);
        }
      },

      // Show the current status
      show_status: function (sStage) {
        var elStatus = null,
            elProgress = null,
            elBar = null,
            percentage = 0,
            data = [],
            lHtml = [];

        try {
          // Check if the stage is still correct
          if (sStage !== loc_stage) { return;}
          // Try to find the status div
          elStatus = $("#py_status");
          elProgress = $("#py_progress");
          $(elProgress).removeClass("hidden");
          elBar = $(elProgress).find(".progress-bar").first();
          // Indicate who we are to get the correct status
          data.push({"name": "session_id", "value": loc_iSession });
          //  =========== DEBUG ============
          console.log("show_status 0: " + parseInt(loc_iSession, 10));
          // ===============================
          // Get the status
          $.post(loc_appPfx + "post_status", data, function (response) {
            var oResponse = null,
                sHtml = "";
            // Sanity check
            if (response !== undefined) {
              oResponse = JSON.parse(response);
              if ('status' in oResponse && 'msg' in oResponse) {
                //  =========== DEBUG ============
                console.log("show_status 1: " + oResponse['msg'] + " s=" + oResponse['status']);
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
                  case "picture":
                    //  =========== DEBUG ============
                    console.log("show_status 3: "+oResponse['status']);
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
                    setTimeout(function () { ru.invites.show_status(sStage); }, 200);
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
            ajaxurl = loc_appPfx + "post_img";  // Where to post the image to

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
            data = [],
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

            // Signal this choice of emperor to the HOST
            data.push({ "name": "id", "value": loc_keizerkeuze });
            $.post(loc_appPfx + "post_manual", data, function (response) {
              var oResponse = null,
                  bOk = false;

              // Sanity check
              if (response !== undefined) {
                oResponse = JSON.parse(response);
                if (oResponse['status'] == "ok") {
                  // Log that all is well
                  console.log("Confirmed choice of emperor: " + loc_keizerkeuze);
                  bOk = true;
                }
              }
              if (!bOk) {
                console.log("set_keizer did not receive proper feedback for " + loc_keizerkeuze);                
              }

            });

            //$("#keizerkeuze").removeClass("hidden");
            //$("#keizerkeuze").attr("href", "/choose?id=" + idx);
          }
        } catch (ex) {
          private_methods.showError("set_keizer", ex);
        }
        
      },

      // Select the indicated reply to the emperor-question
      set_answer: function (el, id_q, max_q, id_a, sAnswer) {
        var elRow = null,       // Current row
            elQuestion = null,  // Row of the question
            elNext = null,      // Row of next question
            bAll = true,       // All answered
            sLabel = "",
            id = 0,
            elTable = null;     // The whole table

        try {
          // Get the row and the table
          if (el !== undefined) {
            elRow = $(el).closest("tr");
            elTable = $(el).closest("tbody");

            // Change the style of this one row
            $(elTable).find("tr").removeClass("selected");
            $(elRow).addClass("selected");

            // Get my reply and position it next to the question
            elQuestion = $(elTable).find("#que_ans_" + id_q).first();
            $(elQuestion).html(sAnswer);

            // Close this current question
            $(elQuestion).closest("tr").find("td").first().click();

            // Open the next question
            elNext = $(elTable).find("#que_ans_" + (id_q + 1)).first();
            if (elNext.length !== 0 && $(elNext).html() === "") {
              // Open this question
              $(elNext).closest("tr").find("td").first().click();
            } else {
              // Check if everything has been answered
              loc_answers = [];
              for (id = 1; id <= max_q; id++) {
                elQuestion = $(elTable).find("#que_ans_" + id).first();
                sLabel = $(elQuestion).html();
                if (sLabel === "") {
                  bAll = false;
                  break;
                }
                // Add question/answer
                loc_answers.push({"vraag_id": id, "nummer": sLabel });
              }
              if (bAll) {
                // All questions have been answered
                // Make sure the main button is available again
                $(butMain).removeClass("hidden");
                $(butMain).html("Laat maar zien");
                // Also make sure no alternative is shown
                private_methods.allow_alternative(false);
                // Signal the chosen emperor to the host
                // loc_keizerkeuze = idx;
              }
            }

          }
        } catch (ex) {
          private_methods.showError("set_answer", ex);
        }
      }

    }

  }($, ru.config));

  return ru;
}(jQuery, window.ru || {}));

