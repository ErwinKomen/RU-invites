import cherrypy
import io, os, sys
import cv2, re
import json
import base64
import copy
import math
import time
import datetime
import smtplib      # Allow sending mail
import csv
import random
# The Radboud University adaptation of the facemorpher
from ru_morpher import ru_morpher, check_for_image_points
from utils import get_error_message, DoError, debugMsg

from settings import CONFIGURATION, SERVE_PORT, KEIZER_BASE, KEIZERS

OUT_FRAMES = "static/tmp"
DATA_DIR = "static/data"
STAT_FILE = "static/tmp/status.json"
# Define conf
conf = CONFIGURATION

def get_current_time_as_string():
    ts = time.time()
    st = datetime.datetime.fromtimestamp(ts).strftime('%Y-%m-%d_%H%M%S')
    return st

def get_template(sLoc, include_init=0):
    """Get the template from the location and return its contents"""

    sFooter = get_template_unit("templates/footer.html")
    if include_init==1:
        sFooter = sFooter.replace("@init@", "ru.invites.init_events(1);")
    elif include_init==2:
        sFooter = sFooter.replace("@init@", "ru.invites.init_events(2);")
    else:
        sFooter = sFooter.replace("@init@", "")
    sData = get_template_unit("templates/header.html") + \
            get_template_unit(sLoc) + sFooter
    # Return the data
    return sData

def get_template_unit(sLoc):
    """Get the template from the location and return its contents"""

    sRoot = os.path.abspath(os.getcwd())
    sPath = os.path.abspath(os.path.join(sRoot, sLoc))
    sData = "Template not found: {}".format(sPath)
    if os.path.exists(sPath):
        with io.open(sPath, "r", encoding="utf8") as f:
            lData = f.readlines()
        # Convert the lines into a string
        sData = "\n".join(lData)
    # Return the data
    return sData

def get_picture_name(img_counter):
    img_name = "static/opencv_frame_{}.png".format(img_counter)
    return img_name

def get_exif_info(path_name):
    f = open(path_name, "rb")
    tags = exifread.process_file(f)
    for tag in tags.keys():
        if tag.lower().find("orient") >= 0:
            print("Key: [{}] = [{}]".format(tag, tags[tag]))

def keizer_list():
    """Create a html list of emperors"""

    # Initialisations
    lstE = []
    lKeizers = KEIZERS
    volgnummer = 1
    nodeid = 1
    parent = 1
    doelgroep = ""
    geslacht = ""
    doelgroepid = 1
    geslachtid = 1

    # other initializations
    naam_vorige = ""
    keizer_code = "onclick=\"ru.invites.set_keizer(this, @k@)\""
    anchor_code = " class=\"btn btn-default btn-xs\" title=\"@t@\" {}".format(keizer_code)
    for item in lKeizers:
        # Take the correct node id
        nodeid += 1
        # Reset level changes
        bLevelDoelgroep = False # Change in doelgroep
        bLevelGeslacht = False  # Change in geslacht

        # Check for change in [doelgroep]
        if doelgroep != item['doel']:
            doelgroep = item['doel']
            # Indicate that we need a new level for this
            bLevelDoelgroep = True

        # Check for change in [geslacht]
        if doelgroep == "kind":
            g = "jongen" if item['geslacht'] == "m" else "vrouw"
        else:
            g = "man" if item['geslacht'] == "m" else "vrouw"
        if geslacht != g:
            geslacht = g
            bLevelGeslacht = True

        # Get the name and the variant-number for this name
        naam = item['naam']
        if naam == naam_vorige:
            volgnummer += 1
        else:
            volgnummer = 1
            naam_vorige = naam
        # Determine the anchor-text for the <a> element
        anchor_tekst = anchor_code.replace("@t@", naam).replace("@k@", str(item['id']))
        js_keizer = keizer_code.replace("@k@", str(item['id']))

        # Build the HTML code for this line
        lHtml = []
        # Is this a change in the level 1, Doelgroep?
        if bLevelDoelgroep:
            lHtml.append("<tr nodeid=\"{}\" childof=\"1\">".format(nodeid))
            # Process the "+" to open a doelgroep
            lHtml.append("<td class=\"arg-plus\" style=\"min-width: 20px;\" onclick=\"crpstudio.htable.plus_click(this, 'func-inline');\">+</td>")
            # Take three cells together
            lHtml.append("<td class=\"arg-text\" colspan=\"3\" style=\"width: 100%;\"><span class=\"arg-line\"><code>{}</code></span></td>".format(doelgroep))
            # Empty cell to the right
            lHtml.append("<td align=\"right\"><span></span></td>")
            lHtml.append("</tr>")
            # Set the new doelgroepid
            doelgroepid = nodeid
            # make sure nodeid gets adapted
            nodeid += 1
        # Any change in geslacht must be duly noted
        if bLevelDoelgroep or bLevelGeslacht:
            lHtml.append("<tr nodeid=\"{}\" childof=\"{}\" class=\"hidden\">".format(nodeid, doelgroepid))
            # Add an empty space 
            lHtml.append("<td class=\"arg-pre\" style=\"min-width: 20px;\"></td>")
            # Add the plus sign
            lHtml.append("<td class=\"arg-plus\" style=\"min-width: 20px;\" onclick=\"crpstudio.htable.plus_click(this, 'func-inline');\">+</td>")
            # Add the remainder taking 2 columns together
            lHtml.append("<td class=\"arg-text\" colspan=\"2\" style=\"width: 100%;\"><span class=\"arg-line\"><code>{}</code></span></td>".format(geslacht))
            # Empty cell to the right
            lHtml.append("<td align=\"right\"><span></span></td>")
            lHtml.append("</tr>")
            # Set the new geslachtid
            geslachtid = nodeid
            # make sure nodeid gets adapted
            nodeid += 1
        # All cases: add an emperor's name
        lHtml.append("<tr nodeid=\"{}\" childof=\"{}\" class=\"hidden\">".format(nodeid, geslachtid))
        # Add empty space
        lHtml.append("<td class=\"arg-pre\" colspan=\"2\" style=\"min-width: 40px;\"></td>")
        # Add empty block
        lHtml.append("<td class=\"arg-plus\" style=\"min-width: 20px;\"></td>")
        # Add emperor's name
        naam_volg = naam if volgnummer == 1 else "{} (versie #{})".format(naam, volgnummer)
        lHtml.append("<td class=\"arg-text\" style=\"width: 100%;\" {}><span class=\"arg-endnode\">{}</span></td>".format(js_keizer, naam_volg))
        # Clickable cell to the right
        lHtml.append("<td align=\"right\"><a {}>{}</a></td>".format(anchor_tekst, volgnummer))
        # Finish the line
        lHtml.append("</tr>")

        # Combine into one string
        sItem = "\n".join(lHtml)

        #sItem = "<tr><td>{}</td><td>{}</td><td>{}</td><td align='center'><a {}>{}</a></td></tr>".format(
        #    doelgroep, geslacht, naam, anchor_tekst, volgnummer)
        lstE.append(sItem)
    # Return the combination
    return "\n".join(lstE)


def keizer_image(idx):
    """Return the image file name for this keizer"""
    img_name = ""
    lKeizers = KEIZERS
    # Get the object
    oKeizer = lKeizers[int(idx) - 1]
    # Construct the file name
    if oKeizer['doel'] == "kind":
        doel = "Kinderen/"
        geslacht = "Jongens/" if oKeizer['geslacht'] == "m" else "Meisjes/"
    else:
        doel = ""
        geslacht = "Mannen/" if oKeizer['geslacht'] == "m" else "Vrouwen/"
    naam = oKeizer['naam']
    bestand = oKeizer['file']
    img_name = "{}/{}{}{}/{}".format(KEIZER_BASE, doel, geslacht, naam, bestand)
    return img_name

def treat_bom(sHtml):
    """REmove the BOM marker except at the beginning of the string"""

    # Check if it is in the beginning
    bStartsWithBom = sHtml.startswith(u'\ufeff')
    # Remove everywhere
    sHtml = sHtml.replace(u'\ufeff', '')
    # Return what we have
    return sHtml

def is_number(sText):
    if re.match("^\d+$", sText) is None:
        return False
    else:
        return True


# @cherrypy.expose
class Root(object):
    template_index = "templates/index.html"
    template_post_start = "templates/post_start.html"
    template_post_pictu = "templates/post_picture.html"
    template_post_quiz = "templates/post_quiz.html"
    template_post_choos = "templates/post_chooser.html"
    template_post_mixer = "templates/post_mixer.html"
    out_frames = OUT_FRAMES                     # Directory where the output images are stored
    data_dir = DATA_DIR                         # Directory where JSON data is stored
    status_file = os.path.abspath(os.path.join(os.getcwd(), STAT_FILE))
    imgpaths = []
    counter = 1
    session_idx = ""
    lStatus = []
    lQuiz = []
    questions = None
    answers = None
    emperors = None
    root_path = os.path.abspath(os.getcwd())
    button_list_old = [
        { 'stage': 'start',   'next': 'picture','lead': 'Neem uw foto en we gaan het zien...',
          'text': "Maak mijn portret", "title": "Stap 1: neem je eigen foto (met de webcam)" },
        { 'stage': 'picture', 'next': 'choose', 'lead': 'Uw foto is er, nu nog een keizer kiezen...',
          'text': "Neem deze keizer",  "title": "Stap 2: Neem de geselecteerde keizer" },
        { 'stage': 'choose',  'next': 'mix',    'lead': 'Houd u vast, de gezichtenmixer wordt opgestart...',
          'text': "Combineer",         "title": "Stap 3: combineer" },
        { 'stage': 'mix',     'next': 'start',  'lead': 'Hier is het resultaat...',
          'text': "Maak mijn portret", "title": "Begin helemaal overnieuw" }
    ]
    button_list = [
        { 'stage': 'start',   'next': 'quiz','lead': 'Neem uw foto en we gaan het zien...',
          'text': "Maak mijn portret", "title": "Stap 1: neem je eigen foto (met de webcam)" },
        { 'stage': 'quiz', 'next': 'choose', 'lead': 'Uw foto is er, nu hebben we een kleine quiz...',
          'text': "Ja, deze keizer(in)",  "title": "Stap 2: Neem de winnende keizer(in)" },
        { 'stage': 'choose',  'next': 'mix',    'lead': 'Houd u vast, de gezichtenmixer wordt opgestart...',
          'text': "Combineer",         "title": "Stap 3: combineer" },
        { 'stage': 'mix',     'next': 'start',  'lead': 'Hier is het resultaat...',
          'text': "Maak mijn portret", "title": "Begin helemaal overnieuw" }
    ]

    def get_status_object(self, session_id = None):
        # Read the status file

        if os.path.exists(self.status_file):
            with io.open(self.status_file, "r", encoding="utf8") as f:
                lStatus = json.load(f)
            self.lStatus = copy.copy(lStatus)
        else:
            self.lStatus = []
        if session_id == None:
            session_id = self.counter
        elif isinstance(session_id, str):
            session_id = int(session_id)
        for oItem in self.lStatus:
            if 'count' in oItem and oItem['count'] == session_id:
                return oItem
        # Getting here means no success
        return None

    def set_status(self, sStatus, sMsg="", session_id=None, ptc=0):
        if session_id == None:
            session_id = self.counter
        elif isinstance(session_id, str):
            session_id = int(session_id)
        oStatus = self.get_status_object(session_id)
        if oStatus == None:
            oStatus = {'status': '', 'msg': '', 'count': session_id}
            self.lStatus.append(oStatus)
        oStatus['status'] = sStatus
        oStatus['msg'] = sMsg
        if ptc != None:
            oStatus['ptc'] = ptc
        # Write the status
        with io.open(self.status_file, "w", encoding="utf8") as f:
            json.dump(self.lStatus, f,)

    @cherrypy.expose
    def index(self):
        """Show the opening page and allow people to start taking a picture"""

        # Read the emperor information
        self.read_quiz_data()

        # Create a session_index string
        self.session_idx = str(self.counter)

        # Load the 'root' template
        sHtml = get_template(self.template_index, 1).replace("@img_count@", self.session_idx)
        sHtml = sHtml.replace("@post_start@", get_template_unit(self.template_post_start))
        return sHtml

    @cherrypy.expose
    def post_start(self):
        """Show the opening page and allow people to start taking a picture"""

        # Default reply
        oBack = {'status': 'error', 'html': 'kon niet lezen'}

        # Increment the counter
        self.counter += 1
        if self.counter > 9:
            self.counter = 0
        # Create a session_index string
        self.session_idx = str(self.counter)
        # Set the status
        self.set_status("start", "counter={}".format(self.counter))
        # Load the 'root' template
        sHtml = get_template_unit(self.template_post_start).replace("@img_count@", self.session_idx)

        # Respond appropriately
        oBack['status'] = "ok"
        oBack['html'] = sHtml
        return json.dumps(oBack)

    @cherrypy.expose
    def post_img(self, image_content=None, counter='0'):
        """Receive the image and store it in the server"""

        # Default reply
        oBack = {'status': 'error', 'html': 'kon niet lezen'}

        # Check if there is base64 image data
        idx = image_content.find("base64")
        if idx >=0:
            # Get the raw data of the image
            idx += 7
            sData = image_content[idx:]
            data = base64.b64decode(sData)
            # Determine where to put the image
            img_name = get_picture_name(counter) 
            # Calculate the local path
            sPath = os.path.abspath(os.path.join(self.root_path, img_name))
            # Remove the old image with this name (if it exists)
            if os.path.exists(sPath):
                os.remove(sPath);
            # Write the new image
            with io.open(sPath, "wb") as fout:
                fout.write(data)

            # Set the status
            self.set_status("img", "img+name={}".format(img_name))

        # Respond appropriately
        oBack['status'] = "ok"
        oBack['html'] = "beeld gelezen"
        return json.dumps(oBack)

    @cherrypy.expose
    def post_buttonlist(self):
        return json.dumps(self.button_list)

    @cherrypy.expose
    def post_imgcount(self):
        return self.session_idx

    @cherrypy.expose
    def post_status(self, session_id=None):
        # Find the current status object
        oStatus = self.get_status_object(session_id)
        if oStatus == None:
            oStatus = {'status': 'error', 'msg': 'Cannot determine the status'}
        # Show the status in my logging
        debugMsg("status (c={}, sid={}) [{}]: {}".format(self.counter, session_id, oStatus['status'], oStatus['msg']))
        # Return the current status object
        return json.dumps(oStatus)

    @cherrypy.expose
    def post_mail(self, input_email, imgname):
        """Send an email with the image as attachment to the indicated address.

        Code idea taken from: https://www.tutorialspoint.com/python/python_sending_email.htm
        """

        debugMsg("post_mail #1")
        oResponse = {'status': 'started', 'msg': ''}
        filename = "radboud_keizerbeeld.png"

        # Possibly adapt the image name
        print("Image = [{}]".format(imgname))
        idx = imgname.find("?")
        if idx >= 0:
            imgname = imgname[:idx]
        # Load the image
        encoded = "EMPTY"
        with open(imgname, "rb") as fo:
            contents = fo.read()
            # Encode and return the encoded BYTES
            encoded = base64.b64encode(contents)    # Base-64 encode the image
            # Convert each byte to an appropriate string character
            encoded = encoded.decode()

        # Prepare the fields
        mail_from = "ekomen@science.ru.nl"
        mail_to = input_email
        subject = "Radboud - keizerbeeld"
        boundary_marker = "RADBOUD_INVITES_MARKER_OF_MAIL"

        # Create header and mail
        lMail = []
        lMail.append("From: {}".format(mail_from))
        lMail.append("To: {}".format(mail_to))
        lMail.append("Subject: {}".format(subject))
        lMail.append("MIME-Version: 1.0")
        lMail.append("Content-Type: multipart/mixed; boundary={}".format(boundary_marker))
        lMail.append("--{}".format(boundary_marker))
        lMail.append("Content-Type: text/plain")
        lMail.append("Content-Transfer-Encoding:8bit")
        lMail.append("")
        lMail.append("Hierbij uw keizerbeeld {}".format(imgname))
        lMail.append("--{}".format(boundary_marker))
        lMail.append("Content-Type: multipart/mixed; name=\"{}\"".format(filename))
        lMail.append("Content-Transfer-Encoding:base64")
        lMail.append("Content-Disposition: attachment; filename={}".format(filename))
        lMail.append("")
        lMail.append(encoded)
        lMail.append("--{}--".format(boundary_marker))
        #hdr = "From: {}\r\nTo: {}\r\nSubject: {}\r\n\r\n".format(mail_from, mail_to, subject)
        ##body = "Dit is een bericht over beeld {}".format(imgname)
        ## ========= DEBUG ====
        #debugMsg(hdr)
        ## ====================

        # Combine the message
        message = "\n".join(lMail)

        try:
            # Try to send this to the indicated email address
            smtpObj = smtplib.SMTP('localhost', 25)
            smtpObj.sendmail(mail_from, mail_to, message)
            smtpObj.quit()
            debugMsg("post_mail #2")
        except:
            sMsg = get_error_message()
            oResponse['status'] = "error"
            oResponse['msg'] = "Sorry, de mail kon niet verzonden worden ({})".format(sMsg)
            debugMsg("post_mail #3")

        # Return the response
        return json.dumps(oResponse)

    @cherrypy.expose
    def post_picture(self):
        """While showing the culprit's image, let him choose an emperor"""

        # Default reply
        oBack = {'status': 'error', 'html': 'kon niet lezen'}

        # Retrieve the currently existing image
        img_name = get_picture_name(self.counter)

        # Check whether the image contains points
        bHasPoints = check_for_image_points(img_name)

        # Load the 'picture' template - this shows the resulting picture
        sHtml = get_template_unit(self.template_post_pictu).replace("@img_name@", img_name)     
        # Put in the list of emperors
        sHtml = sHtml.replace("@keizer_list@", keizer_list())   

        # Set the status
        self.set_status("picture", "img_name={}".format(img_name))

        if bHasPoints:
            # Respond appropriately
            oBack['status'] = "ok"
            oBack['html'] = sHtml
        else:
            oBack['html'] = "Ik kan uw gezicht niet herkennen in dit beeld"

        return json.dumps(oBack)

    @cherrypy.expose
    def post_quiz(self):
        """While showing the culprit's image, let him choose an emperor"""

        # Default reply
        oBack = {'status': 'error', 'html': 'kon niet lezen'}

        # Retrieve the currently existing image
        img_name = get_picture_name(self.counter)

        # Load the 'picture' template - this shows the resulting picture
        sHtml = get_template_unit(self.template_post_quiz).replace("@img_name@", img_name)     
        # Put in the list of emperors
        sHtml = sHtml.replace("@quiz_list@", self.quiz_list())   

        # Set the status
        self.set_status("quiz", "img_name={}".format(img_name))

        # make sure what we return is okay
        oBack['status'] = "ok"
        oBack['html'] = sHtml

        return json.dumps(oBack)

    @cherrypy.expose
    def post_choose(self, id=0, qalist=""):

        # Default reply
        oBack = {'status': 'error', 'html': 'kon niet lezen'}

        # Show what has been found
        print("keizer id = {}".format(id), file=sys.stderr)
        print("qalist length = {}".format(len(qalist)), file=sys.stderr)
        print("qalist: \n{}".format(qalist), file=sys.stderr)

        # Calculate a keizer_id based on the information in qalist
        oWinner = self.quiz_result(json.loads(qalist))
        id = oWinner['keizer_id']

        # Retrieve the currently existing image
        img_self = get_picture_name(self.counter)
        # Find out which file name this is
        img_keizer = keizer_image(id)
        # Put the images in imgpaths
        self.imgpaths.clear()
        self.imgpaths.append(img_self)
        self.imgpaths.append(img_keizer)
        # Load the 'picture' template
        sHtml = get_template_unit(self.template_post_choos)
        sHtml = sHtml.replace("@img_keizer@", img_keizer)
        sHtml = sHtml.replace("@img_self@", img_self)
        sHtml = sHtml.replace("@keizer_name@", oWinner['keizer_naamNL'])
        sHtml = sHtml.replace("@keizer_score@", str(oWinner['score']) )

        # Set the status
        self.set_status("picture", "img_keizer={}".format(img_keizer))

        # Respond appropriately
        oBack['status'] = "ok"
        oBack['html'] = sHtml
        return json.dumps(oBack)

    def mix_callback(self, iCounter, percent, points):
        try:
            debugMsg("mix_callback [1]")
            percent = 1 - percent
            sMsg = "This is {:.1f}% of session {}".format(percent * 100, iCounter)
            debugMsg("mix_callback [2]: " + sMsg)
            self.set_status("callback", sMsg, session_id=iCounter, ptc= math.ceil( percent*100))
        except:
            DoError("mix_callback: ")

    @cherrypy.expose
    def post_mix(self):

        # Default reply
        sHtml = 'kon niet lezen'
        oBack = {'status': 'error', 'html': sHtml}
        lRes = []
        max_img = 18


        try:

            for item in self.imgpaths:
                debugMsg("item = [{}]".format(item))
            # Start up the facemorpher process
            out_dir = "{}/{}".format(self.out_frames, self.session_idx)

            # Set the status
            self.set_status("mix", "starting out_dir={}".format(out_dir))

            # Perform the morphing
            oMorph = ru_morpher(self.imgpaths, out_frames=out_dir, obj=self) # counter=self.counter, callback = self.mix_callback)
            # Check the reply that we received
            if oMorph['status'] == 'error':
                # We are not okay -- show the user an error message
                if 'msg' in oMorph:
                    sMsg = oMorph['msg']
                else:
                    sMsg = "Sorry, er is iets fout gegaan. Probeer het opnieuw."
                self.set_status("error", sMsg)
                oBack['status'] = 'error'
                oBack['html'] = sMsg
                return json.dumps(oBack)
            
            # Set the status
            self.set_status("mix", "creating page")

            # Load the 'picture' template
            sHtml = get_template_unit(self.template_post_mixer)
            show_img = math.floor(max_img / 2)
            # Create the result picture references
            for i in range(1,max_img + 1):
                hidden = "" if i == show_img else " hidden"
                imgnum = str(i).zfill(3)
                timestamp = get_current_time_as_string()
                sLine = "<img id=\"pic{}\" src=\"static/tmp/{}/frame{}.png?{}\" title=\"{}/{}\" class=\"result-pic {}\" />".format(
                    imgnum, self.session_idx, imgnum, timestamp, i, max_img, hidden)
                lRes.append(sLine)
            sHtml = sHtml.replace("@results@", "\n".join(lRes))
            sHtml = sHtml.replace("@session_idx@", self.session_idx)
            oBack['status'] = "ok"
            # Set the status
            self.set_status("finish", "ready")
        except:
            sHtml = get_error_message()
            DoError()

        # Respond appropriately
        oBack['html'] = sHtml
        return json.dumps(oBack)

    @cherrypy.expose
    def aanmaken_van_json(self):
        """This is the method to create JSON from possibly present CSV files"""

        print("aanmaken van json wordt aangeroepen", file=sys.stderr)
        lQuestions = []
        lAnswers = []
        lKeizers = []
        lInput = [{'file': 'quiz_vragen', 'obj': lQuestions},
                  {'file': 'quiz_antwoorden', 'obj': lAnswers},
                  {'file': 'quiz_keizers', 'obj': lKeizers}]
        try:
            for oInput in lInput:
                # Debugging
                print("Debugging. File: {}".format(oInput['file']), file=sys.stderr)
                # Determine the file location
                file = os.path.abspath(os.path.join(self.out_frames, oInput['file'] + '.txt'))
                print("Looking for file: {}".format(file), file=sys.stderr)
                # Read the file as CSV
                if os.path.exists(file):
                    print("Starting CSV from: {}".format(file), file=sys.stderr)
                    with open(file, 'r') as csvfile:
                        myreader = csv.reader(csvfile, delimiter='\t')
                        mylist = oInput['obj']
                        # Read the header
                        header = next(myreader)
                        # Look for BOM
                        if header[0].startswith(u'\ufeff'):
                            header[0] = header[0].replace(u'\ufeff', '')
                        # Read the remaining rows
                        for row in myreader:
                            oItem = {}
                            for idx, cell in enumerate(row):
                                if is_number(cell):
                                    cell = int(cell)
                                oItem[header[idx]] = cell
                            mylist.append(oItem)
                    print("Finished CSV from: {}".format(file), file=sys.stderr)

                    # If these are answers: adapt the list
                    if oInput['file'] == 'quiz_antwoorden':
                        for iAnswer, oAnswer in enumerate(mylist):
                            # Get the string list of emperor abbreviations
                            sKeizers = oAnswer['keizer_lijst']
                            # Remove brackets
                            sKeizers = sKeizers.replace("[", "").replace("]", "")
                            # Turn into list
                            lKeizers = sKeizers.split(",")
                            # Make sure spaces are stripped
                            for idx, keizer in enumerate(lKeizers):
                                lKeizers[idx] = keizer.strip()
                            mylist[iAnswer]['keizer_lijst'] = lKeizers

                    # Write the output as json
                    file = file.replace(".txt", ".json")
                    with open(file, "w") as jsonfile:
                        json.dump(mylist, jsonfile)
                    print("Written JSON to: {}".format(file), file=sys.stderr)
        except:
            sMsg = get_error_message()
            print("Error in aanmaken_van_json: {}".format(sMsg), file=sys.stderr)

        # Load the 'root' template
        sHtml = get_template(self.template_index, 1).replace("@img_count@", self.session_idx)
        sHtml = sHtml.replace("@post_start@", get_template_unit(self.template_post_start))
        return sHtml

    def read_quiz_data(self):
        """Read the JSON data for the QUIZ"""

        lQuestions = []
        lAnswers = []
        lKeizers = []
        lInput = [{'file': 'quiz_vragen', 'obj': lQuestions},
                  {'file': 'quiz_antwoorden', 'obj': lAnswers},
                  {'file': 'quiz_keizers', 'obj': lKeizers}]

        try:
            for oInput in lInput:
                # Debugging
                print("Debugging. File: {}".format(oInput['file']), file=sys.stderr)
                # Determine the file location (based on DATA_DIR)
                file = os.path.abspath(os.path.join(self.data_dir, oInput['file'] + '.json'))
                # Read JSON into object
                with open(file, "r") as fp:
                    oInput['obj'] = json.load(fp)
                # check where to store it
                if "vragen" in oInput['file']:
                    self.questions = copy.copy(oInput['obj'])
                elif "antwoorden" in oInput['file']:
                    self.answers = copy.copy(oInput['obj'])
                elif "keizers" in oInput['file']:
                    self.emperors = copy.copy( oInput['obj'])

                # Show statistics of the object that has been read
                obj = oInput['obj']
                print("Read file {} containing {} lines".format(file, len(obj)))
            # Return positively
            return True
        except:
            sMsg = get_error_message()
            print("Error in read_quiz_data: {}".format(sMsg), file=sys.stderr)
            return False

    def quiz_result(self, qalist):
        """Calculate the id of the emperor based on the Question/Answer list"""

        # Take the list of emperors as bases
        base_list = copy.copy(self.emperors)
        ## Set their counts to zero
        #for emp in base_list:
        #    emp['count'] = 0
        emp_count = {}
        max_count = 0
        emp_max = -1
        # Go through the QA list
        for oQA in qalist:
            vraag_id = oQA['vraag_id']
            nummer = oQA['nummer']
            # Find and check the entries for this question
            lReplies = [x for x in self.answers if x['vraag_id'] == vraag_id and x['nummer'] == nummer]
            if len(lReplies) >0:
                oAnswer = lReplies[0]
                # Get the list of emperors from this reply
                k_list = oAnswer['keizer_lijst']
                # Set or increment the count for the emperors in this list
                for emp in k_list:
                    if emp in emp_count:
                        emp_count[emp] += 1
                    else:
                        emp_count[emp] = 1
                    # Check who is best so far
                    count = emp_count[emp]
                    if count > max_count:
                        max_count = count
                        emp_max = emp
        # Find the emperor with the indicated abbreviation
        lEmp = [x for x in self.emperors if x['keizer_grp'] == emp_max]
        # This list may be larger
        oEmp = None
        emp_count = len(lEmp)
        print("quiz_result number of emperors found = {}, max score = {}".format(emp_count, max_count))
        if emp_count == 1:
            oEmp = lEmp[0]
        else:
            # Print the abbreviations of all the found emperors
            for idx, emp in enumerate(lEmp):
                print("quiz_result #{} = {}".format(idx+1, emp['keizer_grp']))
            # Take a random entry from the list
            idx = random.randint(1, emp_count)
            oEmp = lEmp[idx-1]
        oEmp['score'] = max_count
        # Return the result
        return oEmp

    def quiz_list(self):
        """Create a quiz with questions and answers"""

        # Initializations
        lHtml = []
        nodeid = 1
        parent = 1
        answer_code = "onclick=\"ru.invites.set_answer(this, @q@, @m@, @a@, '@L@')\""

        # other initializations
        naam_vorige = ""
        # Walk all the questions
        for q in self.questions:
            # Take the correct node id
            nodeid += 1

            vraag_id = q['vraag_id']
            vraag_tekst = q['vraag_text']
            # Build the HTML code for the introduction of this QUESTION
            lHtml.append("<tr nodeid=\"{}\" childof=\"1\">".format(nodeid))
            # Process the "+" to open a doelgroep
            lHtml.append("<td class=\"arg-plus\" style=\"min-width: 20px;\" onclick=\"crpstudio.htable.plus_click(this, 'func-inline');\">+</td>")
            # Take three cells together
            lHtml.append("<td class=\"arg-text\" colspan=\"2\" style=\"width: 100%;\"><span class=\"arg-line\"><code>{}</code></span><span>{}</span></td>".format(
                vraag_id, vraag_tekst))
            # Empty cell to the right - this may get the answer for this question
            lHtml.append("<td align=\"right\"><span id='que_ans_{}'></span></td>".format(vraag_id))
            lHtml.append("</tr>")
            # Set the new questionlineid
            questionlineid = nodeid
            # make sure nodeid gets adapted
            nodeid += 1

            # Find the possible answers to this question
            answers = [x for x in self.answers if x['vraag_id'] == vraag_id]
            # Walk all the answers
            for a in answers:
                # Get the information from this answer
                antwoord_id = a['antwoord_id']
                letter = a['nummer']
                antwoord = a['antwoord_tekst']

                lHtml.append("<tr nodeid=\"{}\" childof=\"{}\" class=\"hidden\">".format(nodeid, questionlineid))
                # Add empty space
                lHtml.append("<td class=\"arg-pre\" colspan=\"1\" style=\"min-width: 20px;\"></td>")
                # Add empty block
                lHtml.append("<td class=\"arg-plus\" style=\"min-width: 20px;\"></td>")
                # Add the answer
                js_answer = answer_code.replace("@q@", str(vraag_id)).replace("@a@", str(antwoord_id)).replace("@L@", letter)
                js_answer = js_answer.replace("@m@", str(len(self.questions)) )
                lHtml.append("<td class=\"arg-text\" style=\"width: 100%;\" {}><span class=\"arg-endnode\">{}</span></td>".format(
                    js_answer, antwoord))
                # Cell to the right with the a/b/c/d/e
                lHtml.append("<td align=\"right\" style=\"min-width: 20px;\"><b>{}</b></td>".format(letter))
                # Finish the line
                lHtml.append("</tr>")

        # Combine into one string
        sItem = "\n".join(lHtml)
        # Return the combination
        return sItem



   
# Set the port on which I will be serving
cherrypy.config.update({'server.socket_port': SERVE_PORT,})

## ----------------------------------------------------
## This is to serve as a plain python application
## Grab the main access
#if __name__ == '__main__':

#    # Start serving as if from /
#    cherrypy.quickstart(Root(), '/', conf)
## ----------------------------------------------------



# ----------------------------------------------------
# This is to serve as a UWSGI application

cherrypy.config.update({'engine.autoreload.on': False})
cherrypy.server.unsubscribe()
cherrypy.engine.start()

application = cherrypy.tree.mount(Root(), config=conf)
# ----------------------------------------------------
