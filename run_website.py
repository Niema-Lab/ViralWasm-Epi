import http.server
import socketserver
import subprocess
import socket
import os

PORT = 5001
# get current directory and set it as the directory to serve
DIRECTORY = os.path.dirname(os.path.realpath(__file__)) + "/dist"

def kill_port_unix(port):
    command = f"lsof -i :{port} -t"
    try:
        result = subprocess.check_output(command, shell=True).decode("utf-8")
        pids = result.strip().split("\n")
        for pid in pids:
            subprocess.run(f"kill -9 {pid}", shell=True)
    except subprocess.CalledProcessError as e:
        return

def kill_port_windows(port):
    command = f"netstat -ano | findstr :{port}"
    try:
        result = subprocess.check_output(command, shell=True).decode("utf-8").strip().split("\n")
        for line in result:
            pid = line.split()[-1]
            subprocess.run(f"taskkill /F /PID {pid}", shell=True)
    except subprocess.CalledProcessError as e:
        return

# Check if port is already in use
sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
port_in_use = sock.connect_ex(('127.0.0.1', PORT)) == 0
sock.close()

# If port is in use, suggest using --force option
if port_in_use:
	force_port = input(f"Port {PORT} is already in use. Try to close the port and continue [Y/n]? ")
	if force_port.lower() == "y":
		kill_port_unix(PORT)
		kill_port_windows(PORT)
	else: 
		exit(1)

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f'Serving at port {PORT}. Visit http://localhost:{PORT}/index.html')
    httpd.serve_forever()