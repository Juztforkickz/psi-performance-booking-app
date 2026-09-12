"""Reproducible FFmpeg motion-graphics edit; source artwork is never overwritten."""
from pathlib import Path
import argparse, concurrent.futures, json, shutil, subprocess

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[1]
FF = ROOT / 'tools/ffmpeg.exe'
ASSETS = REPO / 'mobile/assets/images'
BUILD = ROOT / 'preview/render'
BUILD.mkdir(parents=True, exist_ok=True)
for src, dst in [('arial.ttf', 'regular.ttf'), ('arialbd.ttf', 'bold.ttf')]:
    shutil.copyfile(Path('C:/Windows/Fonts') / src, ROOT / 'tools' / dst)
WHITE = '0xEDF3F6'
BLUE = '0x68D3F4'
MUTED = '0xA9BAC3'
BG = '0x061014'

def rel(path):
    return Path(path).relative_to(ROOT).as_posix()

class Scene:
    def __init__(self, name, height, duration):
        self.name, self.h, self.d = name, height, duration
        self.w, self.feed = 1080, height == 1350
        self.key = f'{name}-{height}-{duration:g}'
        self.filters, self.seq, self.inputs = [], 0, []
        self.cmd = [str(FF), '-hide_banner', '-loglevel', 'error', '-filter_complex_threads', '1', '-f', 'lavfi', '-i', f'color=c={BG}:s=1080x{height}:r=30:d={duration}']
        self.last = '0:v'
    def apply(self, filter):
        self.seq += 1
        label = f'b{self.seq}'
        self.filters.append(f'[{self.last}]{filter}[{label}]')
        self.last = label
    def box(self,x,y,w,h,color,thickness='fill'):
        self.apply(f'drawbox=x={x}:y={y}:w={w}:h={h}:color={color}:t={thickness}')
    def text(self,text,y,size=50,color=WHITE,x='(w-text_w)/2',bold=True,alpha=None):
        file = BUILD / f'{self.key}-{self.seq}.txt'
        file.write_text(text, encoding='utf-8')
        f = f"drawtext=fontfile=tools/{'bold' if bold else 'regular'}.ttf:textfile={rel(file)}:fontsize={size}:fontcolor={color}:x={x}:y={y}"
        if alpha: f += f":alpha='{alpha}'"
        self.apply(f)
    def image(self,path,x,y,w,h,bg=BG,video=False,zoom=False,grade=None):
        self.inputs.append(str(path))
        idx = len(self.inputs)
        if video: self.cmd += ['-stream_loop','-1','-i',str(path)]
        else: self.cmd += ['-loop','1','-framerate','30','-i',str(path)]
        label = f'img{idx}'
        chain=(grade+',' if grade else '')+f'scale={w}:{h}:force_original_aspect_ratio=decrease:force_divisible_by=2,pad={w}:{h}:(ow-iw)/2:(oh-ih)/2:color={bg},setsar=1'
        if zoom:
            chain += f",zoompan=z='1+0.035*on/{max(1,int(self.d*30))}':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s={w}x{h}:fps=30"
        self.filters.append(f'[{idx}:v]{chain},setpts=PTS-STARTPTS[{label}]')
        self.seq += 1
        nextlabel=f'b{self.seq}'
        self.filters.append(f'[{self.last}][{label}]overlay=x={x}:y={y}:shortest=1[{nextlabel}]')
        self.last=nextlabel
    def shell(self,num,tag='THE PSI APP'):
        self.apply('drawgrid=w=108:h=108:t=1:c=0x68D3F4@0.022')
        top=80 if self.feed else 174
        self.text('PSI PERFORMANCE',top,29,x=76)
        self.text(tag,top+2,25,BLUE,x='w-text_w-76')
        self.box(76,top+58,928,2,'0x6D8995@0.50')
        self.text(f'{num:02d} / YOUR CAR. CONNECTED.',self.h-(94 if self.feed else 174),22,MUTED,x=76)
        self.box(76,self.h-(122 if self.feed else 204),928,2,'0x6D8995@0.50')
        self.apply(f"drawbox=x=76:y={self.h-(122 if self.feed else 204)}:w=928:h=2:c={BLUE}:t=fill")
    def heading(self,a,b=None):
        y=206 if self.feed else 328
        self.text(a,y,68 if self.feed else 78)
        if b: self.text(b,y+(79 if self.feed else 94),68 if self.feed else 78,BLUE)
    def render(self):
        self.apply(f'fade=t=in:st=0:d=0.16,fade=t=out:st={self.d-0.16}:d=0.16,format=yuv420p')
        script=BUILD/f'{self.key}.filters'
        script.write_text(';\n'.join(self.filters),encoding='utf-8')
        out=BUILD/f'{self.key}.mp4'
        cmd=self.cmd+['-filter_complex_script',rel(script),'-map',f'[{self.last}]','-t',str(self.d),'-r','30','-an','-c:v','libx264','-threads','2','-preset','fast','-crf','19','-movflags','+faststart','-y',str(out)]
        log=BUILD/f'{self.key}.log'
        result=subprocess.run(cmd,cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
        log.write_text(result.stdout,encoding='utf-8')
        if result.returncode: raise RuntimeError(f'{self.key}: {result.stdout[-1800:]}')
        print(f'Rendered {self.key}',flush=True)
        return out

PARTNERS=[
 ('dark-side-film.jpg','Dark Side of the Film'),
 ('race-wires.jpg','Race Wires Auto Electrics'),
 ('elite-autobody.jpg','Elite Autobody'),
 ('kng-tow.jpg','KNG TOW'),
 ('eye-candy.jpg','EyeCandy Motorsports'),
 ('luxe-interiors.jpg','Luxe Automotive Interiors'),
 ('elite-detailing.jpg','Elite Car Detailing Studio'),
 ('trb-visuals.jpg','TRB Visuals Photography'),
 ('martini-racing-products.jpg','Martini Racing Products'),
 ('fab-car-audio.jpg','Fab Car Audio'),
]

def make(name,h,d):
    s=Scene(name,h,d)
    feed=s.feed
    if name=='opening':
        s.image(ROOT/'source/updated-opening.png',0,0,1080,h,zoom=True)
        return s
    if name=='plus':
        s.shell(1,'PERFORMANCE+')
        s.heading('PERFORMANCE+','THE GAME CHANGER.')
        y,sz=(410,600) if feed else (585,850)
        s.image(ASSETS/'dashboard/tile-performance-plus-symbol-blue-silver.jpg',(1080-sz)//2,y,sz,sz,zoom=True)
        s.text('Your car. Its complete PSI story.',1070 if feed else 1492,38 if feed else 42)
        s.text('Optional paid subscription',1130 if feed else 1560,27,MUTED,bold=False)
    elif name=='vault':
        s.shell(2,'PERFORMANCE+')
        s.heading('YOUR PRIVATE','VEHICLE VAULT.')
        top=410 if feed else 596
        ph=650 if feed else 890
        pw=300 if feed else 410
        s.box(90,top-8,pw+16,ph+16,'0x68D3F4@0.65',2)
        s.image(ROOT/'source/app-performance-plus-dark.png',98,top,pw,ph,bg='black')
        tx=548 if not feed else 468
        gap=124 if not feed else 91
        labels=['PSI invoices','Workshop photos','Dyno reports','Service history','Build milestones']
        for i,label in enumerate(labels):
            y=top+80+i*gap
            s.box(tx,y+8,6,34,BLUE)
            s.text(label,y,36 if feed else 38,x=tx+25)
        s.text('One subscription. Every vehicle in your PSI account.',1100 if feed else 1560,27 if feed else 30,MUTED)
        s.text('Actual app preview · demonstration records',1144 if feed else 1608,22,MUTED,bold=False)
    elif name=='dyno':
        s.shell(3,'PERFORMANCE+')
        s.heading('SEE THE RESULTS.','KEEP THE HISTORY.')
        y,ah=(410,626) if feed else (580,924)
        s.image(ROOT/'source/dyno-card-loop.mp4',240 if feed else 150,y,600 if feed else 780,ah,video=True)
        s.text('Dyno PDFs. Comparisons. Your PSI journey.',1080 if feed else 1560,32 if feed else 36)
        s.text('Illustrated dyno example',1130 if feed else 1614,24,MUTED,bold=False)
    elif name in ['partners-a','partners-b']:
        s.shell(4 if name.endswith('a') else 5,'TRUSTED PARTNERS')
        s.heading('TRUSTED TEAMS.','ONE PLACE.')
        off=0 if name.endswith('a') else 5
        top=424 if feed else 594
        rh=208 if feed else 298
        positions=[(82,top),(560,top),(82,top+rh),(560,top+rh),(321,top+rh*2)]
        for (file,label),(x,y) in zip(PARTNERS[off:off+5],positions):
            iw,ih=(430,148) if feed else (430,220)
            s.box(x-2,y-2,iw+4,ih+4,'0x5F8494',1)
            s.image(ASSETS/'partners'/file,x,y,iw,ih,bg='white' if file=='martini-racing-products.jpg' else 'black',grade='eq=gamma=1.8' if file=='fab-car-audio.jpg' else None)
            s.text(label,y+ih+17,23 if feed else 25,x=f'{x}+({iw}-text_w)/2',bold=True)
        s.text('The specialists we work with.',1142 if feed else 1586,30,MUTED,bold=False)
    elif name=='cars':
        s.shell(6,'CUSTOMER CARS FOR SALE')
        s.heading('YOUR NEXT CHAPTER.','SELL YOUR PSI CAR.')
        y,sz=(405,590) if feed else (570,810)
        s.image(ASSETS/'dashboard/tile-customer-cars-for-sale-blue-silver.jpg',(1080-sz)//2,y,sz,sz,bg='black',zoom=True)
        # Dollar mark matches the new customer-cars tile's recognisable purpose.
        s.box(786,y+32,114,114,'0x061014@0.94')
        s.text('$',y+44,78,BLUE,x=820)
        s.text('A car PSI has worked on?',1050 if feed else 1454,39)
        s.text('Ask us to feature it.',1105 if feed else 1514,36,BLUE)
        s.text('Owner permission and PSI approval required.',1154 if feed else 1580,24,MUTED,bold=False)
    elif name=='everyday':
        s.shell(7,'YOUR EVERYDAY PSI')
        s.heading('YOUR GARAGE.','ALWAYS WITH YOU.')
        top=420 if feed else 600
        size=300
        files=[('tile-my-garage-blue-silver.jpg','MY GARAGE'),('tile-my-bookings-blue-silver.jpg','BOOKINGS'),('tile-plan-build-blue-silver.jpg','PLAN & BUILD')]
        step=316
        for i,(file,label) in enumerate(files):
            x=65+i*step
            s.image(ASSETS/'dashboard'/file,x,top,size,400 if not feed else 340,bg='black')
            s.text(label,top+(426 if not feed else 366),26,x=f'{x}+(300-text_w)/2')
        s.text('Less searching. More enjoying your car.',950 if feed else 1244,42)
        s.text('Garage, booking requests and reminders are free.',1020 if feed else 1318,29,MUTED,bold=False)
        s.text('Unlock deeper vehicle history with Performance+.',1080 if feed else 1380,29,BLUE,bold=False)
    elif name=='end':
        s.shell(8,'DISCOVER PERFORMANCE+')
        s.heading('YOUR CAR.','ITS COMPLETE STORY.')
        size=300 if feed else 470
        y=430 if feed else 650
        s.image(REPO/'artifacts/PSI APP/psi-app-icon-1024.png',(1080-size)//2,y,size,size,bg='black',zoom=True)
        s.text('EXPLORE THE PSI APP',810 if feed else 1240,49,BLUE)
        s.text('psiperformance.com.au',884 if feed else 1322,40)
        s.text('Performance+ is an optional paid subscription.',1048 if feed else 1540,28,MUTED,bold=False)
        s.text('App preview · records depend on what PSI publishes.',1100 if feed else 1594,24,MUTED,bold=False)
    else: raise ValueError(name)
    return s

MAIN=[('opening',3),('plus',4),('vault',5),('dyno',5),('partners-a',3),('partners-b',3),('cars',5),('everyday',4),('end',4)]
SHORT=[('opening',2),('plus',3),('dyno',3),('partners-a',1.5),('partners-b',1.5),('cars',2),('end',2)]

def render_cut(name,h,timeline):
    scenes=[make(n,h,d) for n,d in timeline]
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        files=list(pool.map(lambda s:s.render(),scenes))
    return assemble_cut(name,files)

def assemble_cut(name,files):
    manifest=BUILD/f'{name}.concat'
    manifest.write_text('\n'.join("file '"+p.as_posix().replace("'","'\\''")+"'" for p in files),encoding='utf-8')
    out=ROOT/'social'/f'{name}.mp4'
    subprocess.run([str(FF),'-hide_banner','-loglevel','error','-f','concat','-safe','0','-i',str(manifest),'-c','copy','-movflags','+faststart','-y',str(out)],check=True)
    print(f'COMPLETE {out.name}',flush=True)
    return out

def website(edition='arrived'):
    path=ROOT/f'website/psi-app-{edition}-hero.png'
    # A restrained silent loop, preserving every word in the supplied launch artwork.
    filters="scale=1920:1080,zoompan=z='1+0.025*on/360':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s=1920x1080:fps=30,format=yuv420p"
    subprocess.run([str(FF),'-hide_banner','-loglevel','error','-loop','1','-i',str(path),'-vf',filters,'-t','12','-an','-c:v','libx264','-threads','2','-preset','fast','-crf','21','-movflags','+faststart','-y',str(ROOT/f'website/psi-app-{edition}-loop-16x9.mp4')],check=True)
    subprocess.run([str(FF),'-hide_banner','-loglevel','error','-i',str(path),'-frames:v','1','-c:v','libwebp','-quality','88','-y',str(ROOT/f'website/psi-app-{edition}-hero.webp')],check=True)
    print('COMPLETE website artwork and loop',flush=True)

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--cut',choices=['vertical','feed','short','website','all'],default='all')
    args=parser.parse_args()
    if args.cut in ['vertical','all']: render_cut('PSI-Performance-App-36s-Reel-9x16',1920,MAIN)
    if args.cut in ['feed','all']: render_cut('PSI-Performance-App-36s-Feed-4x5',1350,MAIN)
    if args.cut in ['short','all']: render_cut('PSI-Performance-App-15s-Reel-9x16',1920,SHORT)
    if args.cut in ['website','all']:
        website()
        if (ROOT/'website/psi-app-preview-hero.png').exists(): website('preview')
