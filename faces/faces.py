import cherrypy

class Root(object):
    @cherrypy.expose
    def index(self):
        sHtml = "bladibla"
        # return "Hello World Erwin - Root!"
        return sHtml
    
# Set the port on which I will be serving
cherrypy.config.update({'server.socket_port': 3640,})

# Grab the main access
if __name__ == '__main__':
    # Start serving as if from /
    cherrypy.quickstart(Root(), '/erwin', "app.conf")
