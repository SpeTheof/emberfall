import json
import os
import sys
import time
import urllib.request
import websocket

PORT = int(os.environ.get('CDP_PORT', '9223'))
URL_NEEDLE = os.environ.get('CDP_URL_CONTAINS', '127.0.0.1:8123')


def get_page():
    pages = json.load(urllib.request.urlopen(f'http://127.0.0.1:{PORT}/json'))
    for p in pages:
        if p.get('type') == 'page' and URL_NEEDLE in p.get('url', ''):
            return p
    raise SystemExit('game page not found')


def main():
    if len(sys.argv) < 2:
        raise SystemExit('usage: cdp.py eval <js> | shot <path> | reload [url] | errors')
    cmd = sys.argv[1]
    page = get_page()
    ws = websocket.create_connection(page['webSocketDebuggerUrl'], timeout=120)
    counter = [0]

    def send(method, params=None):
        counter[0] += 1
        ws.send(json.dumps({'id': counter[0], 'method': method, 'params': params or {}}))
        while True:
            msg = json.loads(ws.recv())
            if msg.get('id') == counter[0]:
                return msg

    def evaluate(expr):
        msg = send('Runtime.evaluate', {'expression': expr, 'returnByValue': True, 'awaitPromise': True})
        res = msg.get('result', {}).get('result', {})
        if 'exceptionDetails' in msg.get('result', {}):
            return {'exception': msg['result']['exceptionDetails']}
        return res.get('value', res)

    if cmd == 'eval':
        print(json.dumps(evaluate(' '.join(sys.argv[2:])), indent=2, ensure_ascii=False))
    elif cmd == 'errors':
        print(json.dumps(evaluate('window.__emberErrors || []'), indent=2, ensure_ascii=False))
    elif cmd == 'shot':
        path = sys.argv[2]
        send('Page.enable')
        msg = send('Page.captureScreenshot', {'format': 'png', 'captureBeyondViewport': False})
        import base64
        data = msg['result']['data']
        with open(path, 'wb') as f:
            f.write(base64.b64decode(data))
        print('saved', path)
    elif cmd == 'reload':
        url = sys.argv[2] if len(sys.argv) > 2 else page['url']
        send('Network.enable')
        send('Network.setCacheDisabled', {'cacheDisabled': True})
        send('Page.navigate', {'url': url})
        time.sleep(1.2)
        print('navigated', url)
    elif cmd == 'viewport':
        w, h = int(sys.argv[2]), int(sys.argv[3])
        send('Emulation.setDeviceMetricsOverride', {
            'width': w, 'height': h, 'deviceScaleFactor': 1, 'mobile': w < 700,
        })
        print('viewport', w, h)
    elif cmd == 'key':
        code = sys.argv[2]
        send('Input.dispatchKeyEvent', {'type': 'keyDown', 'code': code, 'key': code})
        time.sleep(0.08)
        send('Input.dispatchKeyEvent', {'type': 'keyUp', 'code': code, 'key': code})
        print('key', code)
    elif cmd == 'hold':
        code = sys.argv[2]
        ms = int(sys.argv[3]) if len(sys.argv) > 3 else 500
        send('Input.dispatchKeyEvent', {'type': 'keyDown', 'code': code, 'key': code})
        time.sleep(ms / 1000)
        send('Input.dispatchKeyEvent', {'type': 'keyUp', 'code': code, 'key': code})
        print('held', code, ms)
    else:
        raise SystemExit('unknown command')
    ws.close()


if __name__ == '__main__':
    main()
