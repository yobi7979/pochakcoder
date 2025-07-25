from http.server import HTTPServer, SimpleHTTPRequestHandler
import json
import os

class CustomHandler(SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path.startswith('/views/'):
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            
            file_path = self.path[1:]  # Remove leading slash
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(data['content'])
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'success'}).encode())
        else:
            self.send_error(404, "File not found")

if __name__ == '__main__':
    server_address = ('', 8000)
    httpd = HTTPServer(server_address, CustomHandler)
    print('서버가 시작되었습니다. http://localhost:8000')
    httpd.serve_forever() 