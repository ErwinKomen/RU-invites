import cherrypy
import io, os
import cv2
import json
import base64
from settings import CONFIGURATION, SERVE_PORT

def get_template(sLoc, include_init=False):
    """Get the template from the location and return its contents"""

    sFooter = get_template_unit("templates/footer.html")
    if include_init:
        sFooter = sFooter.replace("@init@", "ru.invites.init_events();")
    else:
        sFooter = sFooter.replace("@init@", "")
    sData = get_template_unit("templates/header.html") + \
            get_template_unit(sLoc) + sFooter
    # Return the data
    return sData

def get_template_unit(sLoc):
    """Get the template from the location and return its contents"""

    sRoot = os.path.abspath(os.getcwd())
    sPath = sRoot + "/" + sLoc
    sData = "Template not found: {}".format(sPath)
    if os.path.exists(sPath):
        with io.open(sPath, "r", encoding="utf8") as f:
            lData = f.readlines()
        # Convert the lines into a string
        sData = "\n".join(lData)
    # Return the data
    return sData

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


# @cherrypy.expose
class Root(object):
    template_index = "templates/index.html"
    template_pictu = "templates/picture.html"
    template_choos = "templates/chooser.html"
    template_mixer = "templates/mixer.html"
    counter = 1

    @cherrypy.expose
    def index(self):
        """Show the opening page and allow people to start taking a picture"""

        # Increment the counter
        self.counter += 1
        # Load the 'root' template
        sHtml = get_template(self.template_index, True).replace("@img_count@", str(self.counter))
        return sHtml

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
            with io.open(img_name, "wb") as fout:
                fout.write(data)

        # Respond appropriately
        oBack['status'] = "ok"
        oBack['html'] = "beeld gelezen"
        return json.dumps(oBack)

    @cherrypy.expose
    def picture(self):
        """While showing the culprit's image, let him choose an emperor"""

        # Retrieve the currently existing image
        img_name = retrieve_picture(self.counter)
        # Load the 'picture' template - this shows the resulting picture
        sHtml = get_template(self.template_pictu).replace("@img_name@", img_name)        
        return sHtml

    @cherrypy.expose
    def choose(self):
        # Load the 'picture' template
        sHtml = get_template(self.template_choos)
        return sHtml

    @cherrypy.expose
    def mix(self):
        # Load the 'picture' template
        sHtml = get_template(self.template_mixer)
        return sHtml


   
# Set the port on which I will be serving
cherrypy.config.update({'server.socket_port': SERVE_PORT,})

# Grab the main access
if __name__ == '__main__':
    # Define conf
    conf = CONFIGURATION
    # Start serving as if from /
    cherrypy.quickstart(Root(), '/', conf)
