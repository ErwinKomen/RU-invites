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
        loc_interrupt = false,
        loc_answers = [],
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
        loc_stage = "",
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
        var ajaxurl = "post_buttonlist";

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
        var ajaxurl = "post_imgcount";

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
            $.post("post_mail", data, function (response) {
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

      // Initialise the indicated stage
      init_stage: function (sStage) {
        var i = 1,
            data = [],
            oInfo = null;

        try {
          // Initially clear the errors
          private_methods.clearError();
          console.log("init_stage " + sStage + ": " + imgcount.toString());
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
            case "start": // Opening screen
              // Make sure initialization happens (again)
              ru.invites.init_events(1);
              // Make sure the buttons are visible and enabled
              $(butMain).removeClass("hidden");
              $(butMain).removeClass("disabled");
              // Load the correct information
              private_methods.load_stage("post_start", data, function () {
                // Make sure a new image count is fetched
                private_methods.get_imgcount();
              });
              break;
            case "quiz":
              // For now inactivate the main button
              $(butMain).addClass("disabled");
              // Make sure we get the right image count
              private_methods.get_imgcount(function () {
                // Check if stage hasn't changed
                if (loc_stage !== "quiz") { return; }
                // Snap the picture right now
                ru.invites.handle_picture(imgcount, function () {
                  // Check if stage hasn't changed
                  if (loc_stage !== "quiz") { return; }
                  // Load the next page with this picture upon success
                  private_methods.load_stage("post_quiz", data,
                    function () {
                      // Check if stage hasn't changed
                      if (loc_stage !== "quiz") { return; }
                      // Next button is not disabled any longer
                      $(butMain).removeClass("disabled");
                      // Hide the 'next' button until the user has chosen an emperor
                      $(butMain).addClass("hidden");
                      // Allow the user to choose the alternative
                      private_methods.allow_alternative(true);
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
              });
              break;
            case "descr":     // Show all the descriptions
              // For now inactivate the main button
              $(butMain).addClass("disabled");
              // Make sure we get the right image count
              private_methods.get_imgcount(function () {
                // Check if stage hasn't changed
                if (loc_stage !== "descr") { return; }
                // Call the correct method
                private_methods.load_stage("post_descr", data, function () {
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
              });
              break;
            case "picture":
              // For now inactivate the main button
              $(butMain).addClass("disabled");
              // Make sure we get the right image count
              private_methods.get_imgcount(function () {
                // Check if stage hasn't changed
                if (loc_stage !== "picture") { return; }
                // Snap the picture right now
                ru.invites.handle_picture(imgcount, function () {
                  // Check if stage hasn't changed
                  if (loc_stage !== "picture") { return; }
                  // Load the next page with this picture upon success
                  private_methods.load_stage("post_picture", data, 
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
              });
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
              // Load the correct page 
              private_methods.load_stage("post_choose", data, function () {
                // Next button is not disabled any longer
                $(butMain).removeClass("disabled");
              });
              break;
            case "mix":
              // Make sure the buttons are visible
              $(butMain).removeClass("hidden");
              // For now inactivate the main button
              $(butMain).addClass("disabled");
              // Start up a process to receive status feedback after a few milliseconds
              setTimeout(function () { ru.invites.show_status("mix"); }, 200);
              // Start up the mixer: the facemorphing process
              private_methods.load_stage("post_mix", data,
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
          elBar = $(elProgress).find(".progress-bar").first();
          // Indicate who we are to get the correct status
          data.push({"name": "session_id", "value": imgcount });
          // Get the status
          $.post("post_status", data, function (response) {
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
            ajaxurl = "post_img";  // Where to post the image to

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
            $.post("post_manual", data, function (response) {
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
