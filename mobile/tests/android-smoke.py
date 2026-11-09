import subprocess,time,xml.etree.ElementTree as ET,pathlib
out=pathlib.Path('release');out.mkdir(exist_ok=True)
def adb(*args): return subprocess.check_output(['adb',*args])
def tree():
    adb('shell','uiautomator','dump','/sdcard/prime-ui.xml')
    return ET.fromstring(adb('shell','cat','/sdcard/prime-ui.xml'))
def tap(label,timeout=50,scroll=False):
    until=time.time()+timeout
    while time.time()<until:
        root=tree()
        for n in root.iter('node'):
            if n.get('text')==label or n.get('content-desc')==label:
                bounds=n.get('bounds').replace('][',',').replace('[','').replace(']','').split(',')
                x1,y1,x2,y2=map(int,bounds)
                adb('shell','input','tap',str((x1+x2)//2),str((y1+y2)//2));return
        if scroll: adb('shell','input','swipe','540','1600','540','600','400')
        time.sleep(2)
    raise AssertionError('Control not found: '+label)
def expect(text,timeout=50):
    until=time.time()+timeout
    while time.time()<until:
        root=tree()
        if any(text in n.get('text','') for n in root.iter('node')):
            assert not any(n.get('class')=='android.webkit.WebView' for n in root.iter('node'))
            return
        time.sleep(2)
    adb('logcat','-d')
    raise AssertionError('Text not found: '+text)
def shot(name): (out/name).write_bytes(adb('exec-out','screencap','-p'))
try:
    adb('install','-r','android/app/build/outputs/apk/release/app-release.apk')
    adb('shell','am','start','-n','it.primegestionale.mobile/.MainActivity')
    tap('Entra nella demo pubblica')
    expect('Ogni connessione conta.');shot('01-panoramica.png')
    tap('Cambia piano ▾');tap('Secret Plan');expect('Secret Plan · Demo pubblica')
    tap('Scegli tema');tap('Blu VIP');expect('Ogni connessione conta.');shot('02-tema-vip.png')
    tap('Apri menu');expect('Esigenze acquirenti');shot('03-menu.png');tap('PRIME Connect',scroll=True)
    expect('PRIME Connect');expect('Google Calendar');shot('04-connect.png')
finally:
    (out/'android-ui.xml').write_bytes(adb('shell','cat','/sdcard/prime-ui.xml'))
    (out/'android-logcat.txt').write_bytes(adb('logcat','-d','-t','500'))
