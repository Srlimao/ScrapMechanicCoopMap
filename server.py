import http.server
import socketserver
import webbrowser
import os
import sys
import json
import threading
from backend.memory_reader import MemoryReader
from backend.save_manager import make_save_snapshot
from backend.path_finder import get_survival_saves, find_game_directory

DIRECTORY = os.path.dirname(os.path.abspath(__file__))
mem_reader = MemoryReader()

class TacticalMapHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        if self.path == '/api/player' or self.path.startswith('/api/player?'):
            self.handle_api_player()
            return
        elif self.path.startswith('/api/terrain'):
            self.handle_api_terrain()
            return
        elif self.path == '/api/saves' or self.path.startswith('/api/saves?'):
            self.handle_api_saves()
            return
        elif self.path == '/api/active_save' or self.path.startswith('/api/active_save?'):
            self.handle_api_active_save()
            return
            
        super().do_GET()

    def handle_api_saves(self):
        saves = get_survival_saves()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps({"success": True, "saves": saves}).encode('utf-8'))

    def handle_api_active_save(self):
        save_name = None
        if '?' in self.path:
            query = self.path.split('?')[1]
            params = dict(qc.split('=') for qc in query.split('&') if '=' in qc)
            if 'name' in params:
                save_name = params['name']

        snapshot_path, filename, err = make_save_snapshot(DIRECTORY, save_name)
        if err or not snapshot_path or not os.path.exists(snapshot_path):
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({"success": False, "error": err or "Failed to snapshot save"}).encode('utf-8'))
            return

        try:
            with open(snapshot_path, 'rb') as fp:
                data = fp.read()

            self.send_response(200)
            self.send_header('Content-Type', 'application/x-sqlite3')
            self.send_header('Content-Length', str(len(data)))
            self.send_header('X-Save-Name', filename)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Expose-Headers', 'X-Save-Name')
            self.end_headers()
            self.wfile.write(data)
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({"success": False, "error": str(e)}).encode('utf-8'))

    def handle_api_terrain(self):
        seed = 631793443
        if '?' in self.path:
            query = self.path.split('?')[1]
            params = dict(qc.split('=') for qc in query.split('&') if '=' in qc)
            if 'seed' in params and params['seed'].isdigit():
                seed = int(params['seed'])

        try:
            from terrain_builder import generate_terrain_for_seed, get_terrain_cells_for_seed
            cells = get_terrain_cells_for_seed(seed)
            img_file = generate_terrain_for_seed(seed)
            resp_data = {"success": True, "seed": seed, "image": img_file, "cells": cells}
        except Exception as e:
            print(f"[Server] Terrain generation error for seed {seed}: {e}", flush=True)
            resp_data = {"success": False, "seed": seed, "error": str(e), "image": "survival-world-surface.webp"}

        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(resp_data).encode('utf-8'))

    def handle_api_player(self):
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(mem_reader.state).encode('utf-8'))

    def end_headers(self):
        if self.path.endswith(('.js', '.json', '.css')):
            self.send_header('Cache-Control', 'no-cache, must-revalidate')
        super().end_headers()

def start_server(open_browser=True):
    os.chdir(DIRECTORY)
    
    # Start background memory reader thread
    mem_thread = threading.Thread(target=mem_reader.run_loop, daemon=True)
    mem_thread.start()

    ports = [8000, 8080, 8081, 8888, 3000]
    httpd = None
    selected_port = None
    
    for port in ports:
        try:
            httpd = socketserver.TCPServer(("", port), TacticalMapHandler)
            selected_port = port
            break
        except OSError:
            continue
            
    if not httpd:
        try:
            httpd = socketserver.TCPServer(("", 0), TacticalMapHandler)
            selected_port = httpd.server_address[1]
        except Exception as e:
            print(f"[Server] Error starting server: {e}", flush=True)
            sys.exit(1)

    url = f"http://localhost:{selected_port}"
    print("=" * 65, flush=True)
    print("  SCRAP MECHANIC - TACTICAL MAP & ZERO-MOD LIVE TRACKER", flush=True)
    print("=" * 65, flush=True)
    print(f"  Web Server:       {url}", flush=True)
    print(f"  Game Directory:   {find_game_directory()}", flush=True)
    print(f"  Survival Saves:   {len(get_survival_saves())} found", flush=True)
    print("=" * 65, flush=True)
    
    if open_browser and '--no-browser' not in sys.argv:
        webbrowser.open(url)
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[Server] Server stopped.", flush=True)
    finally:
        httpd.server_close()

if __name__ == '__main__':
    open_browser = '--no-browser' not in sys.argv
    start_server(open_browser=open_browser)
