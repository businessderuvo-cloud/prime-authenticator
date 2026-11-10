import subprocess,time,xml.etree.ElementTree as ET,pathlib
out=pathlib.Path('release');out.mkdir(exist_ok=True)
def adb(*args): return subprocess.check_output(['adb',*args])
def tree():
    last=None
    for attempt in range(10):
        try:
            adb('shell','uiautomator','dump','/sdcard/prime-ui.xml')
            return ET.fromstring(adb('shell','cat','/sdcard/prime-ui.xml'))
        except (subprocess.CalledProcessError,ET.ParseError) as error:
            last=error;time.sleep(1)
    raise AssertionError('Android UI hierarchy did not become available') from last
def tap(label,timeout=180,scroll=False):
    until=time.time()+timeout
    while time.time()<until:
        root=tree()
        for n in root.iter('node'):
            visible=n.get('visible-to-user','true')=='true'
            if visible and (n.get('text')==label or n.get('content-desc')==label):
                bounds=n.get('bounds').replace('][',',').replace('[','').replace(']','').split(',')
                x1,y1,x2,y2=map(int,bounds)
                if x2<=0 or y2<=0 or x1>=1080 or y1>=1920:
                    continue
                adb('shell','input','tap',str((x1+x2)//2),str((y1+y2)//2));return
        if scroll: adb('shell','input','swipe','540','1400','540','1050','600')
        time.sleep(2)
    raise AssertionError('Control not found: '+label)
def expect(text,timeout=50):
    until=time.time()+timeout
    while time.time()<until:
        root=tree()
        if any(text in (n.get('text','')+' '+n.get('content-desc','')) for n in root.iter('node')):
            assert not any(n.get('class')=='android.webkit.WebView' for n in root.iter('node'))
            return
        time.sleep(2)
    adb('logcat','-d')
    raise AssertionError('Text not found: '+text)
def scroll_expect(text,timeout=40):
    until=time.time()+timeout
    while time.time()<until:
        root=tree()
        if any(text in (n.get('text','')+' '+n.get('content-desc','')) for n in root.iter('node')):
            assert not any(n.get('class')=='android.webkit.WebView' for n in root.iter('node'))
            return
        adb('shell','input','swipe','540','1400','540','1050','600')
        time.sleep(1)
    raise AssertionError('Text not found after scrolling: '+text)
def scroll_top():
    for _ in range(5):
        adb('shell','input','swipe','540','600','540','1600','350')
        time.sleep(.3)
def shot(name):
    until=time.time()+30
    while time.time()<until:
        if not any(n.get('class')=='android.widget.ProgressBar' for n in tree().iter('node')): break
        time.sleep(1)
    (out/name).write_bytes(adb('exec-out','screencap','-p'))
try:
    adb('install','-r','android/app/build/outputs/apk/release/app-release.apk')
    adb('shell','am','start','-n','it.primegestionale.mobile/.MainActivity')
    tap('Entra nella demo pubblica')
    expect('Ogni connessione conta.');shot('01-panoramica.png')
    tap('Cambia piano ▾');tap('Secret Plan');expect('Secret Plan · Demo pubblica');shot('02-secret.png')
    tap('Scegli tema');tap('Blu VIP');expect('Ogni connessione conta.');shot('02-tema-vip.png')
    tap('Apri menu');expect('CRM · Persone');shot('03-menu.png');tap('PRIME Connect',scroll=True)
    expect('PRIME Connect');expect('Attiva dati fittizi');shot('03-connect-before-demos.png')
    tap('Attiva dati fittizi Stripe',scroll=True)
    expect('DATI DIMOSTRATIVI');shot('04-stripe-intro.png');scroll_expect('Entrate, in attesa e uscite');shot('04-stripe-demo.png')
    tap('Connect');tap('Disattiva dati fittizi Stripe',scroll=True);expect('PRIME Connect');scroll_top()
    tap('Attiva dati fittizi Wallester',scroll=True)
    expect('Wallester Business');expect('DATI DIMOSTRATIVI');shot('05-wallester-demo.png')
    tap('Connect');tap('Disattiva dati fittizi Wallester',scroll=True);expect('PRIME Connect');scroll_top()
    scroll_expect('Google Calendar');expect('CALENDARI');shot('04-connect.png')
finally:
    shot('05-last-state.png')
    (out/'android-ui.xml').write_bytes(adb('shell','cat','/sdcard/prime-ui.xml'))
    (out/'android-logcat.txt').write_bytes(adb('logcat','-d','-t','500'))
