import cherrypy
import os, sys
from os import path
import tempfile
from utils import get_error_message, DoError, debugMsg

from settings import CONFIGURATION, SERVE_PORT, SUBDOMAIN

# ----------------------- DEBUGGING --------------------------------------------
# SERVE_PORT = 6001
# SUBDOMAIN = "/"
# ------------------------------------------------------------------------------

# Set the port on which I will be serving
cherrypy.config.update({'server.socket_port': SERVE_PORT,})

if SERVE_PORT != 6001:
    serve_location = "lightning"

    if serve_location == "lightning":
        BASE_DIR = "/var/www/live"
        cherrypy.config.update({'log.access_file': BASE_DIR + '/writable/logs/faces_access.log',
                                'log.error_file': BASE_DIR + '/writable/logs/faces_error.log'})
    else:
        BASE_DIR = "/var/www/applejack/live"
        cherrypy.config.update({'log.access_file': BASE_DIR + '/writable/faces/logs/faces_access.log',
                                'log.error_file': BASE_DIR + '/writable/faces/logs/faces_error.log'})

    method = "leiden"   # Or else: "invites"
    if method == "leiden":
        # Define the full path of the temporary directory to be
        if serve_location == "lightning":
            TEMP_DIR = os.path.abspath(os.path.join(BASE_DIR, "writable/temp"))
        else:
            TEMP_DIR = os.path.abspath(os.path.join(BASE_DIR, "writable/faces/temp"))
        # Check if it exists
        if not path.exists(TEMP_DIR):
            # If not: create it
            os.mkdir(TEMP_DIR)
        # Set the correct temporary directory
        tempfile.tempdir = TEMP_DIR
        # Make sure the environment variable has it
        os.environ['MPLCONFIGDIR'] = tempfile.gettempdir()
        # Show what has happened
        print("WSGI.py: the tempdir has been set to: {}".format(tempfile.gettempdir()), file=sys.stderr)

    else:
        # Set the correct temporary directory
        tempfile.tempdir = os.path.abspath(os.path.join(BASE_DIR, "writable/faces/tmp"))
        # os.environ['MPLCONFIGDIR'] = tempfile.gettempdir()
        # Show what has happened
        print("WSGI.py: the tempdir has been set to: {}".format(tempfile.gettempdir()), file=sys.stderr)
        # print("wsgi.py: environment variable MPLCONFIGDIR is: {}".format(os.environ.get('MPLCONFIGDIR')), file=sys.stderr)

# See the cherrypy documentation section 8.7.4 uwsgi
cherrypy.config.update({'engine.autoreload.on': False})
cherrypy.server.unsubscribe()
cherrypy.engine.start()

# Only NOW import the root!!
from faces import Root

# Make the application available for WSGI
application = cherrypy.tree.mount(Root(), SUBDOMAIN , config=CONFIGURATION)
