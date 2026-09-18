"""A labelled animated demonstration, NOT an app screen recording.

Uses existing PSI artwork and source-checked labels. No browser, backend, user
account, booking, payment, notification or Apple submission is accessed.
"""
from pathlib import Path
from functools import lru_cache
import argparse, json, math, subprocess, hashlib, wave
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
ASSETS = ROOT / 'mobile/assets/images'
DEMO = OUT / 'demo'
FFMPEG = ROOT / 'output/promo-refresh-2026-09-12/tools/ffmpeg.exe'
W,H,FPS=1080,1920,30
SW,SH=780,1300
BG='#050505'; PANEL='#171717'; LINE='#42484c'; WHITE='#ffffff'; MUTED='#aab1b5'; CYAN='#65cff8'; GREEN='#82d6a0'
glyphs=json.loads((ROOT/'mobile/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json').read_text())

@lru_cache(None)
def font(n=30,bold=False):
    return ImageFont.truetype('C:/Windows/Fonts/'+('segoeuib.ttf' if bold else 'segoeui.ttf'),n)

def text(im,s,x,y,n=30,c=WHITE,b=False,width=None):
    d=ImageDraw.Draw(im); f=font(n,b)
    lines=[]
    for para in str(s).split('\n'):
        line=''
        for word in para.split(' '):
            candidate=(line+' '+word).strip()
            if width and d.textlength(candidate,font=f)>width and line:
                lines.append(line);line=word
            else:line=candidate
        lines.append(line)
    for line in lines:
        d.text((x,y),line,font=f,fill=c,stroke_width=0);y+=int(n*1.32)
    return y

def center(im,s,y,n=30,c=WHITE,b=False):
    d=ImageDraw.Draw(im); x=(im.width-d.textlength(s,font=font(n,b)))/2
    return text(im,s,x,y,n,c,b)

def rect(im,box,fill=PANEL,outline=LINE,r=0,w=2):
    d=ImageDraw.Draw(im)
    if r:d.rounded_rectangle(box,r,fill,outline,w)
    else:d.rectangle(box,fill,outline,w)

def icon(im,name,x,y,n=42,c=CYAN):
    f=ImageFont.truetype(str(ROOT/'mobile/assets/fonts/Ionicons.ttf'),n)
    ImageDraw.Draw(im).text((x,y),chr(glyphs[name]),font=f,fill=c)

@lru_cache(None)
def pic(path):return Image.open(path).convert('RGBA')

@lru_cache(None)
def sized_pic(path,w,h,cover):
    original=pic(path)
    return ImageOps.fit(original,(w,h),method=Image.Resampling.LANCZOS) if cover else ImageOps.contain(original,(w,h),method=Image.Resampling.LANCZOS)

def fit(im,path,box,cover=False):
    x,y,w,h=map(int,box)
    p=sized_pic(str(path),w,h,cover)
    im.paste(p,(x+(w-p.width)//2,y+(h-p.height)//2),p)

def button(im,label,y,outline=False,x=36,w=708):
    rect(im,(x,y,x+w,y+78),BG if outline else CYAN,CYAN,0,2)
    d=ImageDraw.Draw(im); n=28
    while d.textlength(label,font=font(n,True))>w-28:n-=1
    text(im,label,x+(w-d.textlength(label,font=font(n,True)))/2,y+19,n,CYAN if outline else BG,True)

def field(im,label,value,y,h=68,active=False):
    text(im,label,36,y,25,MUTED,True)
    rect(im,(36,y+40,744,y+40+h),'#111111',CYAN if active else '#7d858b',8,2)
    text(im,value,57,y+55,30,WHITE,False,660)

def nav(im,selected):
    rect(im,(0,1198,SW,SH),'#101010','#cbd3d8',0,2)
    names=['Home','My Garage','Bookings','Reports','Settings']
    icons=['home-outline','car-sport-outline','calendar-outline','document-text-outline','notifications-outline']
    for i,(label,symbol) in enumerate(zip(names,icons)):
        c=CYAN if label==selected else MUTED
        icon(im,symbol,i*156+60,1210,35,c)
        d=ImageDraw.Draw(im); text(im,label,i*156+(156-d.textlength(label,font=font(20,True)))/2,1254,20,c,True)

def base(title,eyebrow,tab='Home'):
    im=Image.new('RGB',(SW,SH),BG)
    text(im,eyebrow.upper(),36,28,24,CYAN,True)
    text(im,title,36,77,56,WHITE,True,width=710)
    nav(im,tab)
    return im

@lru_cache(None)
def home_page(art='holden-commodore-vy'):
    content=Image.new('RGB',(SW,1920),BG)
    fit(content,ASSETS/'psi-logo.png',(36,30,220,100))
    text(content,'YOUR PSI GARAGE',300,56,24,CYAN,True)
    text(content,'YOUR PSI APP.',36,168,62,WHITE,True)
    text(content,'Your vehicle visits, results and next plan\nin one place.',36,264,31,MUTED,width=700)
    text(content,'YOUR SHORTCUTS',36,394,32,WHITE,True)
    tiles=[('MY GARAGE',ASSETS/f'garage-vehicles/{art}.jpg'),('MY BOOKINGS',ASSETS/'dashboard/tile-my-bookings-blue-silver.jpg'),('BOOK AHEAD',ASSETS/'dashboard/tile-book-ahead-blue-silver.jpg'),('PSI EVENTS',ASSETS/'dashboard/tile-events-blue-silver-v2.jpg'),('PERFORMANCE+',ASSETS/'dashboard/tile-performance-plus-symbol-blue-silver.jpg'),('SETTINGS',ASSETS/'dashboard/tile-alerts-blue-silver.jpg')]
    for i,(label,path) in enumerate(tiles):
        x=36+(i%2)*368;y=466+(i//2)*375
        rect(content,(x,y,x+340,y+338),BG,'#cbd3d8',0,4)
        fit(content,path,(x+5,y+5,330,250))
        rect(content,(x+2,y+256,x+338,y+336),BG,'#cbd3d8',0,2)
        d=ImageDraw.Draw(content);text(content,label,x+(340-d.textlength(label,font=font(25,True)))/2,y+279,25,WHITE,True)
    return content

def home(art='holden-commodore-vy',offset=0):
    im=Image.new('RGB',(SW,SH),BG);im.paste(home_page(art).crop((0,int(offset),SW,int(offset)+1198)),(0,0));nav(im,'Home');return im

def progress(im,step):
    for i,label in enumerate(['Job','Vehicle','Details','Date','Review']):
        x=38+i*146;c=CYAN if i<=step else LINE
        rect(im,(x,187,x+120,193),c,c)
        text(im,label,x,205,23,c,i==step)

def booking(step,typed=True):
    im=base('Book ahead','Service & Report','Bookings');progress(im,step)
    headings=['Your vehicle. Your goals.','Choose your vehicle','Your details','Your preferred date','Review your request']
    text(im,headings[step],36,290,40,WHITE,True,width=700)
    if step==0:
        rect(im,(36,385,744,558),PANEL,LINE)
        text(im,'SERVICE & REPORT',60,410,33,WHITE,True)
        text(im,'From $423.50 AUD incl. GST',60,462,29,MUTED)
        text(im,'Deposit after PSI approves a date',60,512,24,CYAN)
        field(im,'What exactly are you after?','Service and brake inspection, please.' if typed else '',610,180,True)
        text(im,'PSI reviews every request personally.',36,902,27,MUTED,width=700)
    elif step==1:
        field(im,'Saved vehicle','2003 Holden Commodore VY SS',389)
        field(im,'Registration','DEMO001',540)
        fit(im,DEMO/'holden.png',(70,715,640,325))
    elif step==2:
        for label,value,y in [('First name','Alex',386),('Last name','Driver',536),('Email','alex.driver@example.com',686),('Mobile','0491 570 006',836)]:field(im,label,value,y)
    elif step==3:
        field(im,'Preferred date','6 October 2026',385,active=True)
        field(im,'Arrival arrangement','During business hours',545)
        rect(im,(36,730,744,955),PANEL,LINE)
        icon(im,'calendar-outline',60,755)
        text(im,'REQUEST A DATE',122,757,29,WHITE,True)
        text(im,'PSI confirms workshop availability\nand the right scope before booking.',60,825,29,MUTED,width=650)
    else:
        for j,(label,value) in enumerate([('Booking','Service & Report'),('Vehicle','Holden Commodore VY SS'),('Preferred date','6 October 2026'),('Contact','Alex Driver')]):
            y=395+j*118;text(im,label,40,y,25,MUTED);text(im,value,40,y+42,32,WHITE,True);rect(im,(36,y+100,744,y+101),LINE,LINE)
        text(im,'Request reviewed by PSI before confirmation.',36,930,27,CYAN,width=708)
        button(im,'DEMO REQUEST · NO REAL BOOKING',1080)
    if step!=4:button(im,'CONTINUE →',1080)
    return im

def received():
    im=base('PSI will check\nthe date first.','Request received for review','Bookings')
    icon(im,'checkmark-circle-outline',324,300,110,GREEN)
    rect(im,(36,475,744,925),PANEL,LINE)
    for label,value,y in [('Request reference','DEMO-BOOK-001',515),('Current state','Pending PSI staff review',648),('Payment required now','No',781)]:
        text(im,label,65,y,26,MUTED);text(im,value,65,y+45,33,WHITE,True,width=650)
    text(im,'Fictional request shown for demonstration.',36,978,27,CYAN,width=700)
    button(im,'RETURN TO PSI HOME',1080);return im

def garage(odo='120,000',art='holden-commodore-vy'):
    im=base('My Garage','Your vehicle','My Garage')
    field(im,'Select vehicle','2003 Holden Commodore VY SS',193)
    fit(im,ASSETS/f'garage-vehicles/{art}.jpg',(36,350,708,420))
    text(im,'HOLDEN COMMODORE VY SS',36,789,34,WHITE,True)
    text(im,'DEMO001',36,852,29,MUTED)
    rect(im,(36,921,744,1120),PANEL,LINE)
    text(im,'CUSTOMER ODOMETER',63,944,25,CYAN,True)
    text(im,odo+' km',63,996,46,WHITE,True)
    icon(im,'create-outline',664,1008,42)
    return im

def avatar(selected=False):
    im=base('Choose your car','My Garage','My Garage')
    text(im,'Find your model. Make it yours.',36,172,31,MUTED)
    field(im,'Search illustrations','Holden',247,active=True)
    text(im,'HOLDEN',36,411,27,CYAN,True);text(im,'Silver collection',482,411,25,MUTED)
    for i,(name,file) in enumerate([('Commodore VY SS','holden-commodore-vy'),('Commodore VF SS','holden-commodore-vf')]):
        x=36+i*364
        rect(im,(x,478,x+344,918),PANEL,CYAN if selected and i==1 else LINE,10,3)
        fit(im,ASSETS/f'garage-vehicles/{file}.jpg',(x+5,488,334,278))
        text(im,'Holden',x+22,791,25,MUTED)
        text(im,name,x+22,836,28,WHITE,True,width=300)
        if selected and i==1:icon(im,'checkmark-circle',x+274,499,46)
    text(im,'YOUR SELECTION',36,982,23,CYAN,True)
    text(im,'Holden Commodore VF SS' if selected else 'Holden Commodore VY SS',36,1020,30,WHITE,True)
    button(im,'USE THIS ILLUSTRATION',1090);return im

def odo(value,saved=False):
    im=base('Odometer','Vehicle upkeep','My Garage')
    text(im,'Holden Commodore VY SS · DEMO001',36,196,30,MUTED,width=700)
    rect(im,(36,306,744,968),PANEL,LINE)
    text(im,'Keep your current customer odometer\nreading with this vehicle.',65,345,31,WHITE,width=650)
    field(im,'Customer odometer',value,508,active=not saved)
    text(im,'Customer reading · kilometres',58,644,26,MUTED)
    button(im,'SAVE DEMO DETAILS',754,x=61,w=658)
    text(im,'Your reading stays separate from\nPSI workshop service records.',61,864,26,MUTED,width=660)
    if saved:text(im,'✓  Demo odometer updated for this session.',36,1021,29,GREEN,True,width=700)
    return im

def reports(highlight=''):
    im=base('Reports','Your vehicle','Reports')
    field(im,'Select vehicle','Holden Commodore VY SS · DEMO001',190)
    text(im,'PERFORMANCE+ · UNLOCKED',36,358,27,CYAN,True)
    categories=[('Service & repair history','construct-outline'),('Recommended work','alert-circle-outline'),('Dyno results & graphs','speedometer-outline'),('Invoice archive','receipt-outline'),('Workshop photos','images-outline'),('Supporting documents','documents-outline')]
    for i,(label,symbol) in enumerate(categories):
        y=425+i*119;rect(im,(36,y,744,y+99),PANEL,CYAN if label==highlight else LINE)
        icon(im,symbol,60,y+27,37);text(im,label,122,y+28,29,WHITE,True);icon(im,'chevron-forward',686,y+31,28)
    return im

def gallery(opened=False):
    im=base('Workshop photos','Performance+','Reports')
    text(im,'Holden Commodore VY SS · DEMO001',36,177,28,MUTED,width=710)
    if opened:
        fit(im,DEMO/'holden.png',(36,285,708,820))
        text(im,'Sample vehicle picture',36,1131,25,MUTED)
    else:
        fit(im,DEMO/'holden.png',(36,294,708,485));text(im,'Saved vehicle picture',36,824,35,WHITE,True)
        text(im,'Demonstration image · view full size',36,882,28,MUTED)
        button(im,'OPEN PHOTO',1025)
    return im

def document(kind):
    title,file={'dyno':('Dyno results & graphs','demo-dyno-graph.jpg'),'invoice':('Invoice archive','demo-invoice-not-payable.jpg'),'file':('Supporting documents','demo-workshop-inspection.jpg')}[kind]
    im=base(title,'Performance+','Reports')
    fit(im,DEMO/file,(30,235,720,899))
    if kind=='dyno':text(im,'Sample data · not a performance claim',36,1140,25,MUTED)
    else:text(im,'Demonstration document · fictional data',36,1140,25,MUTED)
    return im

def reminders(on=False):
    im=base('Settings','Stay up to date','Settings')
    text(im,'Notification preferences',36,216,36,WHITE,True)
    text(im,'Demo controls',36,275,27,CYAN)
    rows=[('Booking updates','Confirmations and date changes\nfor your visits.',True),('Service & visit reminders','Before visits and opted-in\nservice milestones.',on),('PSI event alerts','New and updated PSI event\ndates and details.',True)]
    for i,(label,copy,enabled) in enumerate(rows):
        y=351+i*249;rect(im,(36,y,744,y+221),PANEL,LINE)
        text(im,label,61,y+28,29,WHITE,True,width=505)
        text(im,copy,61,y+99,27,MUTED,width=560)
        rect(im,(622,y+30,717,y+82),CYAN if enabled else '#555b61',None,26)
        ImageDraw.Draw(im).ellipse((667 if enabled else 629,y+37,710 if enabled else 672,y+76),fill=WHITE)
    text(im,'Example settings. No notifications are sent.',36,1133,25,CYAN,width=710)
    return im

# Each chapter uses consistent values and the actual app's labels. Layouts are
# deliberately composed illustrations, never passed off as captured app UI.
SCENES=[
 ('intro',4,'Your car. Your PSI.','Meet PSI Performance Garage.'),
 ('home',7,'Everything in one place.','Your garage, bookings and vehicle story.'),
 ('job',6,'Plan your next workshop visit.','Describe the work you need.'),
 ('vehicle',3,'Choose your saved vehicle.','Keep the request with the right car.'),
 ('details',3,'Review your details.','Fictional customer information shown.'),
 ('date',4,'Pick a preferred date.','PSI checks workshop availability.'),
 ('review',4,'Review your request.','Scope and dates are confirmed by PSI.'),
 ('received',4,'Request sent for review.','Animated example. No real booking made.'),
 ('garage',4,'Make your garage yours.','Your vehicle, with your choice of artwork.'),
 ('avatar',7,'Choose your car illustration.','Browse the silver collection and select.'),
 ('newhome',4,'Your new Home tile.','Artwork changes the tile, not the vehicle record.'),
 ('odo',8,'Keep kilometres current.','Add a customer odometer reading.'),
 ('reports',5,'Open your vehicle story.','Archive features shown require Performance+.'),
 ('photos',6,'Revisit saved pictures.','Open the pictures stored with your vehicle.'),
 ('dyno',6,'Inspect your dyno results.','Example graph and fictional results.'),
 ('invoice',6,'Keep invoices close.','Open the saved copy when you need it.'),
 ('file',6,'Find the supporting detail.','Vehicle documents, together in your archive.'),
 ('reminders',7,'Stay ahead of the next visit.','Choose your service and visit reminders.'),
 ('outro',6,'Your PSI garage, connected.','Launching soon · follow PSI for release news.'),
]

@lru_cache(None)
def static(name,state=0):
    if name in ['job','vehicle','details','date','review']:return booking(['job','vehicle','details','date','review'].index(name),bool(state))
    if name=='received':return received()
    if name=='garage':return garage()
    if name=='avatar':return avatar(bool(state))
    if name=='newhome':return home('holden-commodore-vf')
    if name=='odo':return odo('120450' if state else '120000',state==2)
    if name=='reports':return reports()
    if name=='photos':return gallery(bool(state))
    if name in ['dyno','invoice','file']:return document(name)
    if name=='reminders':return reminders(bool(state))
    return home()

def ease(p):p=max(0,min(1,p));return p*p*(3-2*p)

def frame(name,duration,title,caption,t,global_t,total):
    im=Image.new('RGB',(W,H),'#070b0e')
    d=ImageDraw.Draw(im)
    # Intentional, restrained graphic frame; all key copy is inside broad margins.
    for i in range(0,W,60):d.line((i,0,i,H),fill='#0b1318')
    fit(im,ASSETS/'psi-logo.png',(80,86,207,96))
    text(im,'PERFORMANCE GARAGE',331,113,27,CYAN,True)
    if name in ['intro','outro']:
        fit(im,ASSETS/'garage-vehicles/holden-commodore-vy.jpg',(38,407,1004,770))
        text(im,title,80,268,66,WHITE,True,width=920)
        if name=='intro':
            text(im,'Bookings. Records. Reminders.\nBuilt around your vehicle.',80,1195,45,WHITE,True,width=880)
            text(im,'A guided demonstration of the PSI app.',80,1388,32,MUTED,width=890)
        else:
            text(im,'LAUNCHING SOON',80,1190,49,CYAN,True)
            text(im,'Follow PSI Performance\nfor release news.',80,1289,43,WHITE,True,width=890)
            text(im,'psiperformance.com.au',80,1443,38,WHITE,True)
            text(im,'Performance+ is an optional paid subscription.',80,1513,27,MUTED,width=890)
    else:
        text(im,title,80,199,48,WHITE,True,width=920)
        state=0
        if name=='job':state=int(t>1.15)
        elif name=='avatar':state=int(t>2.7)
        elif name=='odo':state=2 if t>5.6 else (1 if t>2.2 else 0)
        elif name=='photos':state=int(t>2.4)
        elif name=='reminders':state=int(t>3.0)
        screen=static(name,state)
        if name=='home':screen=home(offset=int(380*ease((t-1.3)/3.7)))
        screen=screen.copy()
        # Animated entry, not a screenshot or real transaction.
        if name=='job' and 1.15<t<3.65:
            rect(screen,(40,654,740,827),'#111111','#111111')
            s='Service and brake inspection, please.'
            text(screen,s[:int((t-1.15)/2.5*len(s))]+'|',57,665,30,WHITE,width=660)
        if name=='odo' and 1.1<t<2.2:
            rect(screen,(40,553,740,611),'#111111','#111111')
            text(screen,'120450'[:max(1,int((t-1.1)/1.1*6))]+'|',57,563,30)
        tap=None
        if name in ['job','vehicle','details','date','review']:tap=(390,1117,duration-.85)
        if name=='avatar':tap=(588,630,2.45) if t<4 else (390,1125,5.5)
        if name=='odo':tap=(390,792,5.35)
        if name=='photos':tap=(390,1058,2.15)
        if name=='reminders':tap=(668,659,2.75)
        if tap and 0<t-tap[2]<.65:
            p=(t-tap[2])/.65; rr=int(22+28*p); draw=ImageDraw.Draw(screen)
            draw.ellipse((tap[0]-rr,tap[1]-rr,tap[0]+rr,tap[1]+rr),outline=CYAN,width=max(2,int(7*(1-p))))
        x,y=150,331+int(35*(1-ease(t/.35)))
        rect(im,(x-13,y-13,x+SW+13,y+SH+13),'#111a20','#50636c',30,3)
        im.paste(screen,(x,y))
    text(im,caption,80,1687,32,WHITE,False,width=910)
    text(im,'ANIMATED DEMO · FICTIONAL DATA',80,1787,26,CYAN,True)
    d=ImageDraw.Draw(im);d.line((80,1845,1000,1845),fill='#233741',width=4);d.line((80,1845,80+920*global_t/total,1845),fill=CYAN,width=4)
    return im

def write_score(path,duration):
    # Original procedurally synthesised score; no third-party music samples.
    sr=44100; n=int(duration*sr); audio=np.zeros(n,dtype=np.float32)
    beat=60/108
    rng=np.random.default_rng(18092026)
    def add(start,sound,gain=1):
        at=int(start*sr); end=min(n,at+len(sound))
        if at<n:audio[at:end]+=sound[:end-at]*gain
    for k in range(int(duration/beat)):
        t=np.arange(int(.19*sr))/sr
        kick=np.sin(2*np.pi*(48*t+6*(1-np.exp(-t*38))))*np.exp(-t*23)
        if k%2==0:add(k*beat,kick,.16)
        ht=np.arange(int(.07*sr))/sr
        add(k*beat+beat/2,rng.normal(0,1,len(ht))*np.exp(-ht*90),.018)
        if k%4==2:add(k*beat,rng.normal(0,1,len(ht))*np.exp(-ht*55),.034)
        freqs=[146.832,174.614,220.0,195.998]
        f=freqs[(k//8)%4]*(2 if k%3==0 else 1)
        nt=np.arange(int(beat*.85*sr))/sr
        tone=(np.sin(2*np.pi*f*nt)+.23*np.sin(2*np.pi*2*f*nt))*np.sin(np.pi*np.minimum(1,nt/.025)/2)*np.exp(-nt*5)
        add(k*beat,tone,.045)
    fade=np.minimum(1,np.arange(n)/sr/2)*np.minimum(1,(n-np.arange(n))/sr/2)
    audio=np.tanh(audio*fade)*.7
    pcm=(np.column_stack((audio,audio*.96))*32767).astype('<i2')
    with wave.open(str(path),'wb') as w:w.setnchannels(2);w.setsampwidth(2);w.setframerate(sr);w.writeframes(pcm.tobytes())

def render(short=False):
    chosen=SCENES if not short else [SCENES[i] for i in [0,2,9,11,13,14,15,17,18]]
    if short:chosen=[(a,3 if a!='outro' else 6,c,d) for a,b,c,d in chosen]
    total=sum(s[1] for s in chosen); name='PSI-Animated-Demo-30s' if short else 'PSI-Animated-Full-Walkthrough'
    output=OUT/(name+'.mp4');audio=OUT/(name+'.wav');write_score(audio,total)
    args=[str(FFMPEG),'-y','-hide_banner','-loglevel','error','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','pipe:0','-i',str(audio),'-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p','-threads','2','-c:a','aac','-b:a','128k','-ar','44100','-movflags','+faststart','-map_metadata','-1','-shortest',str(output)]
    with (OUT/(name+'-encode.log')).open('wb') as log:
        proc=subprocess.Popen(args,stdin=subprocess.PIPE,stderr=log)
        elapsed=0
        try:
            for chapter,duration,title,caption in chosen:
                print(f'{name}: {chapter} ({elapsed}s)',flush=True)
                for j in range(duration*FPS):
                    local=j/FPS
                    source_duration=next(s[1] for s in SCENES if s[0]==chapter)
                    source_time=local*source_duration/duration
                    im=frame(chapter,source_duration,title,caption,source_time,elapsed+local,total)
                    proc.stdin.write(im.tobytes())
                elapsed+=duration
            proc.stdin.close();code=proc.wait()
        except BaseException:
            proc.stdin.close();proc.terminate();raise
    if code:raise RuntimeError(f'Encoding failed: {name}')
    verify=subprocess.run([str(FFMPEG),'-v','error','-i',str(output),'-f','null','-'],capture_output=True,text=True)
    if verify.returncode:raise RuntimeError(verify.stderr)
    meta={'type':'animated demonstration, not a screen recording','duration_seconds':total,'width':W,'height':H,'fps':FPS,'video':'H.264 yuv420p','audio':'AAC, original synthesised score','sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'bytes':output.stat().st_size,'full_decode_passed':True,'chapters':chosen}
    (OUT/(name+'-validation.json')).write_text(json.dumps(meta,indent=2),encoding='utf8')
    frame(*chosen[0],2.0,2.0,total).save(OUT/(name+'-poster.jpg'),quality=92)
    print(f'FINISHED {output} {total}s {output.stat().st_size} bytes',flush=True)

def boards():
    (OUT/'storyboard').mkdir(exist_ok=True)
    thumbs=[];elapsed=0;total=sum(s[1] for s in SCENES)
    for i,scene in enumerate(SCENES):
        name,duration,title,caption=scene
        im=frame(name,duration,title,caption,duration*.76,elapsed+duration*.76,total)
        im.save(OUT/'storyboard'/f'{i+1:02d}-{name}.jpg',quality=90)
        thumbs.append(im.resize((270,480)))
        elapsed+=duration
    sheet=Image.new('RGB',(270*5,520*4),'#15212a')
    for i,p in enumerate(thumbs):
        x=(i%5)*270;y=(i//5)*520;sheet.paste(p,(x,y));text(sheet,f'{i+1:02d} · {SCENES[i][0]}',x+8,y+484,19,WHITE,True)
    sheet.save(OUT/'storyboard-contact-sheet.jpg',quality=92)
    (OUT/'chapters.json').write_text(json.dumps(SCENES,indent=2),encoding='utf8')

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--render',action='store_true');p.add_argument('--short',action='store_true');a=p.parse_args()
    OUT.mkdir(parents=True,exist_ok=True);boards()
    if a.render:render(a.short)
