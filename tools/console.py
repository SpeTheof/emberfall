import json
import sys
import time
import urllib.request
import websocket

PORT = 9223
page = [p for p in json.load(urllib.request.urlopen(f'http://127.0.0.1:{PORT}/json'))
        if p.get('type') == 'page' and '127.0.0.1:8123' in p.get('url', '')][0]
ws = websocket.create_connection(page['webSocketDebuggerUrl'], timeout=3)
counter = [0]


def send(method, params=None):
    counter[0] += 1
    ws.send(json.dumps({'id': counter[0], 'method': method, 'params': params or {}}))
    while True:
        msg = json.loads(ws.recv())
        if msg.get('id') == counter[0]:
            return msg


send('Runtime.enable')
send('Log.enable')
send('Page.enable')
send('Network.enable')
send('Network.setCacheDisabled', {'cacheDisabled': True})
send('Page.navigate', {'url': 'http://127.0.0.1:8123/?demo=1&debug=game&map=peak&hero=archer&boss=1&v=99'})
end = time.time() + 8
while time.time() < end:
    try:
        ws.settimeout(0.5)
        msg = json.loads(ws.recv())
    except Exception:
        continue
    method = msg.get('method')
    if method in ('Runtime.exceptionThrown', 'Log.entryAdded', 'Runtime.consoleAPICalled'):
        print(method)
        print(json.dumps(msg.get('params'), indent=2)[:4000])
ws.close()
