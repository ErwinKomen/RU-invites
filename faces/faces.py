import cherrypy
import io, os, sys
import cv2
import json
import base64
# import facemorpher      # This one is only available on Ponyland

from settings import CONFIGURATION, SERVE_PORT, KEIZER_BASE, KEIZERS

OUT_FRAMES = "static/tmp"

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

def get_error_message():
    arInfo = sys.exc_info()
    if len(arInfo) == 3:
        sMsg = str(arInfo[1])
        if arInfo[2] != None:
            sMsg += " at line " + str(arInfo[2].tb_lineno)
        return sMsg
    else:
        return ""

def DoError():
    sMsg = get_error_message()
    print("Error: " + sMsg + "\n", file=sys.stderr)

def take_picture():
    """This takes a picture and then saves it (where??)"""

    cam = cv2.VideoCapture(0)
    img_counter = 0
    cv2.namedWindow("test")
    ret, frame = cam.read()
    # Display the image in the named window "test"
    cv2.imshow("test", frame)
    # Save the image
    img_name = "static/opencv_frame_{}.png".format(img_counter)
    cv2.imwrite(img_name, frame)
    print("{} written!".format(img_name))
    #sRoot = os.path.abspath(os.getcwd())
    #sPath = sRoot + "/" + img_name
    #return sPath
    return img_name

def retrieve_picture(img_counter):
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

    lstE = []
    lKeizers = KEIZERS
    volgnummer = 1
    naam_vorige = ""
    anchor_code = " class=\"btn btn-default btn-xs\" title=\"@t@\" onclick=\"ru.invites.set_keizer(this, @k@)\""
    for item in lKeizers:
        doelgroep = item['doel']
        geslacht = "man" if item['geslacht'] == "m" else "vrouw"
        naam = item['naam']
        if naam == naam_vorige:
            volgnummer += 1
        else:
            volgnummer = 1
            naam_vorige = naam
        anchor_tekst = anchor_code.replace("@t@", naam).replace("@k@", str(item['id']))
        sItem = "<tr><td>{}</td><td>{}</td><td>{}</td><td align='center'><a {}>{}</a></td></tr>".format(
            doelgroep, geslacht, naam, anchor_tekst, volgnummer)
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
        geslacht = "Jongens/" if oKeizer['geslacht'] == "m" else "Meisjes"
    else:
        doel = ""
        geslacht = "Mannen/" if oKeizer['geslacht'] == "m" else "Vrouwen"
    naam = oKeizer['naam']
    bestand = oKeizer['file']
    img_name = "{}/{}{}{}/{}".format(KEIZER_BASE, doel, geslacht, naam, bestand)
    return img_name


# @cherrypy.expose
class Root(object):
    # ---------- OLD =-----------
    template_pictu = "templates/picture.html"
    template_choos = "templates/chooser.html"
    template_mixer = "templates/mixer.html"
    # ---------------------------

    template_index = "templates/index.html"
    template_post_start = "templates/post_start.html"
    template_post_pictu = "templates/post_picture.html"
    template_post_choos = "templates/post_chooser.html"
    template_post_mixer = "templates/post_mixer.html"
    out_frames = OUT_FRAMES                     # Directory where the output images are stored
    imgpaths = []
    counter = 1
    root_path = os.path.abspath(os.getcwd())
    button_list = [
        { 'stage': 'start',   'next': 'picture','lead': 'Neem uw foto en we gaan het zien...',
          'text': "Maak mijn portret", "title": "Stap 1: neem je eigen foto (met de webcam)" },
        { 'stage': 'picture', 'next': 'choose', 'lead': 'Uw foto is er, nu nog een keizer kiezen...',
          'text': "Neem deze keizer",  "title": "Stap 2: Neem de geselecteerde keizer" },
        { 'stage': 'choose',  'next': 'mix',    'lead': 'Houd u vast, de mixer gaat werken...',
          'text': "Combineer",         "title": "Stap 3: combineer" },
        { 'stage': 'mix',     'next': 'start',  'lead': 'Hier is het resultaat...',
          'text': "Maak mijn portret", "title": "Begin helemaal overnieuw" }
    ]

    @cherrypy.expose
    def index(self):
        """Show the opening page and allow people to start taking a picture"""

        # Increment the counter
        # self.counter += 1
        # Load the 'root' template
        sHtml = get_template(self.template_index, 1).replace("@img_count@", str(self.counter))
        sHtml = sHtml.replace("@post_start@", get_template_unit(self.template_post_start))
        return sHtml

    @cherrypy.expose
    def post_start(self):
        """Show the opening page and allow people to start taking a picture"""

        # Default reply
        oBack = {'status': 'error', 'html': 'kon niet lezen'}

        # Increment the counter
        self.counter += 1
        # Load the 'root' template
        sHtml = get_template_unit(self.template_post_start).replace("@img_count@", str(self.counter))
        # sHtml = sHtml.replace("@post_start@", get_template_unit(self.template_post_start))

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
            img_name = retrieve_picture(counter) 
            # Calculate the local path
            sPath = os.path.abspath(os.path.join(self.root_path, img_name))
            # Remove the old image with this name (if it exists)
            if os.path.exists(sPath):
                os.remove(sPath);
            # Write the new image
            with io.open(sPath, "wb") as fout:
                fout.write(data)

        # Respond appropriately
        oBack['status'] = "ok"
        oBack['html'] = "beeld gelezen"
        return json.dumps(oBack)

    @cherrypy.expose
    def post_buttonlist(self):
        return json.dumps(self.button_list)

    @cherrypy.expose
    def post_imgcount(self):
        return str(self.counter)

    @cherrypy.expose
    def post_picture(self):
        """While showing the culprit's image, let him choose an emperor"""

        # Default reply
        oBack = {'status': 'error', 'html': 'kon niet lezen'}

        # Retrieve the currently existing image
        img_name = retrieve_picture(self.counter)
        # Load the 'picture' template - this shows the resulting picture
        sHtml = get_template_unit(self.template_post_pictu).replace("@img_name@", img_name)     
        # Put in the list of emperors
        sHtml = sHtml.replace("@keizer_list@", keizer_list())   

        # Respond appropriately
        oBack['status'] = "ok"
        oBack['html'] = sHtml
        return json.dumps(oBack)

    @cherrypy.expose
    def post_choose(self, id=0):

        # Default reply
        oBack = {'status': 'error', 'html': 'kon niet lezen'}

        # Retrieve the currently existing image
        img_self = retrieve_picture(self.counter)
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

        # Respond appropriately
        oBack['status'] = "ok"
        oBack['html'] = sHtml
        return json.dumps(oBack)

    @cherrypy.expose
    def post_mix(self):

        # Default reply
        sHtml = 'kon niet lezen'
        oBack = {'status': 'error', 'html': sHtml}

        try:
            for item in self.imgpaths:
                print("item = [{}]".format(item))
            # Start up the facemorpher process
            facemorpher.morpher(self.imgpaths, out_frames=self.out_frames)
            # Load the 'picture' template
            sHtml = get_template_unit(self.template_post_mixer)
            oBack['status'] = "ok"
        except:
            sHtml = get_error_message()
            DoError()

        # Respond appropriately
        oBack['html'] = sHtml
        return json.dumps(oBack)


    @cherrypy.expose
    def picture(self):
        """While showing the culprit's image, let him choose an emperor"""

        # Retrieve the currently existing image
        img_name = retrieve_picture(self.counter)
        # Load the 'picture' template - this shows the resulting picture
        sHtml = get_template(self.template_pictu).replace("@img_name@", img_name)     
        # Put in the list of emperors
        sHtml = sHtml.replace("@keizer_list@", keizer_list())   
        return sHtml

    @cherrypy.expose
    def choose(self, id=0):

        # Retrieve the currently existing image
        img_self = retrieve_picture(self.counter)
        # Find out which file name this is
        img_keizer = keizer_image(id)
        # Put the images in imgpaths
        self.imgpaths.clear()
        self.imgpaths.append(img_self)
        self.imgpaths.append(img_keizer)
        # Load the 'picture' template
        sHtml = get_template(self.template_choos)
        sHtml = sHtml.replace("@img_keizer@", img_keizer)
        sHtml = sHtml.replace("@img_self@", img_self)
        return sHtml

    @cherrypy.expose
    def mix(self):
        sHtml = "foutje"
        try:
            for item in self.imgpaths:
                print("item = [{}]".format(item))
            # Perform the mixing
            facemorpher.morpher(self.imgpaths, out_frames=self.out_frames)
            # Load the 'picture' template
            sHtml = get_template(self.template_mixer, 2)
        except:
            sHtml = get_error_message()
            DoError()
        return sHtml


   
# Set the port on which I will be serving
cherrypy.config.update({'server.socket_port': SERVE_PORT,})

# Grab the main access
if __name__ == '__main__':
    # Define conf
    conf = CONFIGURATION
    # Start serving as if from /
    cherrypy.quickstart(Root(), '/', conf)
