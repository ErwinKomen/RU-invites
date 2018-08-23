import os
import cherrypy

CONFIGURATION = {
        "/": {
                # 'request.dispatch': cherrypy.dispatch.MethodDispatcher(),
                'tools.sessions.on': True, 
                'tools.staticdir.root': os.path.abspath(os.getcwd()),
                # 'tools.response_headers.on': True,
                # 'tools.response_headers.headers': [('Content-Type', 'text/plain')],
             },
        "/static": {
                'tools.staticdir.on': True,
                'tools.staticdir.dir': './static'
             },
        }

SERVE_PORT = 3640