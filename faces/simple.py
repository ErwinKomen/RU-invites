import cherrypy
from datetime import datetime
from settings import CONFIGURATION, SERVE_PORT, KEIZER_BASE, KEIZERS, SUBDOMAIN

# Define conf
conf = CONFIGURATION

class HelloWorld(object):
    def index(self):
        now = datetime.now()
        return "Hello World! - this is a simple test by Erwin at {}".format(now.strftime("%d-%m-%Y %H:%M"))
    index.exposed = True

# Set the port on which I will be serving
cherrypy.config.update({'server.socket_port': SERVE_PORT})

application = cherrypy.tree.mount(HelloWorld(), SUBDOMAIN , config=conf)

cherrypy.engine.start()
cherrypy.engine.block()

# cherrypy.quickstart(HelloWorld())