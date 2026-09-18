"""Source-based animated customer guide. No browser, backend or customer actions."""
import argparse, importlib.util, json, math, subprocess, wave, hashlib
from pathlib import Path
from functools import lru_cache
import numpy as np
from PIL import Image, ImageDraw

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
WORK=ROOT/'work/launch-walkthrough-guide-2026-09-18'
WORK.mkdir(parents=True,exist_ok=True)
spec=importlib.util.spec_from_file_location('ui',ROOT/'output/launch-walkthrough-2026-09-18/render_demo.py')
ui=importlib.util.module_from_spec(spec);spec.loader.exec_module(ui)
import onboarding, extras
FPS=30; W,H=1080,1920

def scene(id,title,chapter,narration,caption,duration=10,taps=()):
    return dict(id=id,title=title,chapter=chapter,narration=narration,caption=caption,duration=duration,taps=taps)

INTRO=scene('intro','Your car. Your PSI.','WELCOME','Welcome to P S I Performance Garage. This animated guide shows account setup, your garage, booking requests and your vehicle records, using fictional examples.','A complete guide, one action at a time.',11)
HOME=scene('home','Start with your shortcuts','HOME','Your Home screen brings the app together. Open My Garage, Book Ahead, your visits, Performance Plus and workshop tools from the illustrated shortcuts.','Home → explore your shortcuts and workshop tools',15,[(13.7,603,422)])
CUSTOMISE=scene('customise','Choose your Home shortcuts','HOME','Tap Customise and select the tiles you want at the top of Home. Tap Done to keep the selection. Your shortcut preference stays on this device.','Customise → choose your shortcuts → Done',12,[(2.2,651,495),(8.5,383,1110)])
GARAGE=[
 scene('garage','Choose the right vehicle','MY GARAGE','In My Garage, use the vehicle selector to choose a saved car. Its registration, customer kilometres and P S I service dates stay together.','My Garage → select your vehicle',10,[(2.2,657,270),(4.4,335,440),(9.0,78,1257)]),
 scene('artwork','Make the Home tile yours','MY GARAGE','Open the illustration picker, find your model, then choose Use This Illustration. Your artwork changes, while your vehicle identity and saved photo stay the same.','Choose illustration → select → save',12,[(2.8,580,633),(7.4,393,1123)]),
 scene('artwork_result','See the saved illustration','MY GARAGE','Return Home to see your selected car artwork on the My Garage shortcut. Your actual vehicle details remain unchanged.','Home shows your new car illustration.',8),
 scene('photo','Keep your own vehicle photo','MY GARAGE','You can also choose a vehicle photo. Frame the car, review the crop and use the photo. This is separate from your illustrated Home tile.','Choose photo → frame your car → use this photo',10,[(6.7,380,1110)]),
 scene('odometer','Update kilometres in My Garage','MY GARAGE','Scroll to Odometer and tap Edit Details. Enter the current kilometres and save. Your customer reading stays separate from P S I workshop records.','Edit details → enter kilometres → Save details',13,[(2.2,388,754),(8.3,385,965)]),
]
BOOKING=[
 scene('booking_start','Choose the work you need','BOOK AHEAD','Open Book Ahead and choose the type of work. This example follows a Service and Report request. Dyno work asks for additional vehicle setup details.','Home → Book Ahead → choose the work',11,[(2.5,380,440),(8.7,391,1116)]),
 scene('booking_job','Describe your goal','BOOK AHEAD','Tell P S I what you want checked. Enter clear notes about the work or concern, then continue to the vehicle step.','Add your notes, then Continue.',10,[(8.5,390,1119)]),
 scene('booking_vehicle','Attach the saved vehicle','BOOK AHEAD','Choose the saved vehicle for this request and check the registration. This keeps the workshop request connected to the right car.','Check the car and registration.',8,[(6.5,390,1119)]),
 scene('booking_details','Check your contact details','BOOK AHEAD','Review your name, email and mobile number. These details help P S I contact you about the request and your workshop visit.','Check your email and mobile number.',8,[(6.5,390,1119)]),
 scene('booking_date','Request a preferred date','BOOK AHEAD','Choose your preferred date and drop-off arrangement. This requests workshop availability. P S I checks the date personally before confirming the visit.','Choose a date preference and drop-off option.',11,[(3.0,631,614),(8.9,390,1119)]),
 scene('booking_review','Review before you submit','BOOK AHEAD','Review the work, vehicle and date. For service visits, you can opt into six and twelve month reminders based on the actual completed service date.','Review your request and reminder preference.',12,[(4.7,67,964)]),
 scene('booking_consent','Read and confirm the final details','BOOK AHEAD','Before submitting, read the booking and deposit policy and confirm contact consent. P S I reviews your request first. Sending it does not reserve a date.','Read the policy → confirm consent → submit',13,[(3.1,61,570),(6.1,61,813),(11.2,390,1119)]),
 scene('booking_received','A request, ready for PSI review','BOOK AHEAD','Your request is now awaiting P S I staff review. No payment is required at this step. P S I reviews the scope and workshop availability first.','Pending PSI staff review · no payment now',11),
 scene('booking_status','Follow the next steps','YOUR BOOKINGS','Open Bookings to follow your requests and visits. After P S I approves a date, any required deposit is arranged. Confirmation follows verified payment.','Bookings → view your request and status',11),
 scene('dyno_setup','Tell PSI about your setup','DYNO & BUILD','For dyno work, describe the engine, transmission, fuel and fitted components. Accurate setup information helps P S I review what the vehicle needs.','Dyno request → complete the setup details',11),
 scene('build','Plan the next stage','DYNO & BUILD','Plan and Build helps organise your goals, build areas, timing and budget direction. Review the summary, then choose a contact option to open a draft.','Plan & Build → prepare your enquiry',12,[(7.8,380,1100)]),
]
REPORTS=[
 scene('reports','Open the right vehicle archive','YOUR RECORDS','Open Reports and select your vehicle. The archive groups service history, recommended work, dyno results, invoices, photos and supporting documents.','Reports → select a vehicle → open a category',11,[(8.0,357,472)]),
 scene('service','Review the workshop history','YOUR RECORDS','Read the service and repair records published by P S I. Workshop records are read-only for customers, keeping the published history separate from your own notes.','Service & repair history → open a record',10),
 scene('recommended','See the recommended work','YOUR RECORDS','Recommended Work keeps the next workshop recommendations visible with your vehicle. Review the detail, then discuss your next visit with P S I.','Recommended work → review the next step',10),
 scene('build_history','Keep the build history together','YOUR RECORDS','Modifications and Build History keeps published workshop records together with your car. Read the saved details and discuss the next stage with P S I.','Modifications & build history → read the record',11),
 scene('notes','Add your own note for PSI','YOUR RECORDS','Your Notes is a free feature. Add a concern or useful vehicle detail and save it for P S I. Customer notes are separate from verified workshop records.','Your notes → enter a note → Save note',12,[(8.1,390,817)]),
 scene('photos','Open your saved pictures','YOUR RECORDS','Open Workshop Photos, choose a saved picture and inspect the larger view. These fictional examples show how pictures stay with the vehicle archive.','Workshop photos → open a picture',11,[(2.1,392,1064)]),
 scene('dyno','Inspect a saved dyno graph','YOUR RECORDS','Open Dyno Results and Graphs to inspect a saved file. Here we take a closer look at the graph. The example figures are fictional.','Dyno results & graphs → inspect the file',12,[(2.1,391,435)]),
 scene('invoice','Read a saved invoice copy','YOUR RECORDS','Open Invoice Archive and choose a saved invoice. Review the document and its details. This demonstration invoice is fictional and has no amount payable.','Invoice archive → open the saved copy',12,[(2.1,391,435)]),
 scene('document','Keep supporting files together','YOUR RECORDS','Supporting documents sit with the same vehicle. Open the saved file and read the detail, so useful workshop information is easy to find again.','Reports & documents → open and inspect',11,[(2.1,391,435)]),
]
OUTRO=scene('outro','Your PSI garage, connected.','READY FOR YOUR NEXT VISIT','That is your P S I garage, from account setup to the next workshop visit. Follow P S I Performance for release news. Performance Plus is an optional paid subscription.','Launching soon · follow PSI for release news',12)

SCENES=[INTRO,*onboarding.SCENES,GARAGE[0],HOME,CUSTOMISE,*GARAGE[1:],*BOOKING,extras.SCENES[0],*REPORTS,*extras.SCENES[1:],OUTRO]
BASE_DURATIONS={s['id']:s['duration'] for s in SCENES}
ACCOUNT_CAPTIONS={'account_email':'Enter your email → request a sign-in code','account_verify':'Check your email → enter the six-digit code','account_profile':'Complete your contact details.','account_vehicle':'Add the registration, year, make and model.','account_saved':'Save account details → Open My Garage'}
for item in SCENES:
    if item['id'] in ACCOUNT_CAPTIONS:item['caption']=ACCOUNT_CAPTIONS[item['id']]
PROMO_LINES=[('intro','Your car. Your P S I. Meet your connected garage.'),('account_email','Sign in with the code sent to your email.'),('account_vehicle','Set up your profile and save your vehicle.'),('home','Your garage, bookings and workshop tools. All together.'),('artwork','Choose the car artwork for your Home tile.'),('odometer','Keep your customer kilometres up to date.'),('booking_job','Tell P S I what your vehicle needs.'),('booking_date','Choose a preferred date for staff to review.'),('booking_consent','Read the policy and confirm before you submit.'),('booking_received','P S I reviews your request before confirming.'),('build','Plan your next build and prepare an enquiry.'),('reports','Explore vehicle records with optional Performance Plus.'),('photos','Open the photos saved with your vehicle.'),('dyno','Inspect your saved dyno graphs and results.'),('invoice','Find invoice copies and useful workshop documents.'),('notes','Keep your own notes for P S I.'),('extras_notifications','Choose your booking updates and service reminders.'),('outro','Launching soon. Follow P S I Performance for release news.')]

def promo_scenes():
    rows=[]
    for id,narration in PROMO_LINES:
        s=dict(next(s for s in SCENES if s['id']==id));s.update(duration=5,narration=narration,audio_id='promo_'+id)
        rows.append(s)
    return rows

def typed(value,t,start,end): return value[:max(0,min(len(value),int(len(value)*(t-start)/(end-start))))]
def success(im,copy,y=1060):
    ui.icon(im,'checkmark-circle',40,y+2,40,ui.GREEN);ui.text(im,copy,97,y,29,ui.GREEN,True,width=650)

def top(im,title,tag='MY GARAGE',tab='My Garage'): return ui.base(title,tag,tab)

@lru_cache(None)
def garage_page():
    im=Image.new('RGB',(780,2220),ui.BG)
    ui.text(im,'YOUR VEHICLES',36,25,24,ui.CYAN,True);ui.text(im,'My Garage',36,80,55,ui.WHITE,True)
    ui.field(im,'Select vehicle','2003 Holden Commodore VY SS',197)
    ui.icon(im,'chevron-down',683,253,31)
    ui.fit(im,ui.DEMO/'holden.png',(36,362,708,390))
    ui.text(im,'PRIMARY VEHICLE',36,788,25,ui.CYAN,True);ui.text(im,'Holden Commodore VY SS',36,833,39,ui.WHITE,True)
    for label,value,x,y in [('Registration','DEMO001',36,929),('Customer odometer','120,000 km',403,929),('Last PSI service','3 Sep 2026',36,1055),('Next PSI check-in','3 Mar 2027',403,1055)]:
        ui.text(im,label,x,y,25,ui.MUTED);ui.text(im,value,x,y+42,33,ui.WHITE,True)
    ui.button(im,'CHOOSE ILLUSTRATION',1220,True)
    ui.text(im,'VEHICLE UPKEEP',36,1375,25,ui.CYAN,True);ui.text(im,'Odometer',36,1421,46,ui.WHITE,True)
    ui.text(im,'Keep your current customer odometer\nreading with this vehicle.',36,1502,31,ui.MUTED,width=700)
    ui.text(im,'Your reading stays separate from\nPSI workshop service records.',36,1625,29,ui.MUTED,width=700)
    ui.button(im,'EDIT DETAILS',1765);ui.button(im,'SERVICE HISTORY',1871,True)
    return im

def garage_frame(offset=0):
    im=Image.new('RGB',(780,1300),ui.BG);im.paste(garage_page().crop((0,int(offset),780,int(offset)+1198)),(0,0));ui.nav(im,'My Garage');return im

def garage_draw(name,t,d):
    if name=='garage':
        im=garage_frame()
        if 2.4<t<4.8:
            ui.rect(im,(36,334,744,551),'#15191c',ui.CYAN,7)
            ui.text(im,'Holden Commodore VY SS',65,362,32,ui.CYAN,True)
            ui.text(im,'2003 · DEMO001',65,410,27,ui.MUTED)
            ui.icon(im,'checkmark-circle',665,378,42)
        return im
    if name=='artwork':
        if t<1.4:return garage_frame(445)
        im=ui.avatar(t>=3.05)
        ui.rect(im,(0,1198,780,1300),ui.BG,ui.BG)
        if t>7.7:success(im,'Illustration saved',1217)
        return im
    if name=='artwork_result':return ui.home('holden-commodore-vf')
    if name=='photo':
        im=ui.base('Frame your car','Vehicle photo','My Garage')
        ui.text(im,'Choose photo',36,205,30,ui.CYAN,True)
        ui.fit(im,ui.DEMO/'holden.png',(36,328,708,440))
        ui.rect(im,(55,360,725,739),None,ui.CYAN,0,3)
        ui.text(im,'Landscape crop',36,824,34,ui.WHITE,True)
        ui.button(im,'FIT WHOLE PHOTO',913,True)
        ui.button(im,'USE THIS PHOTO',1070)
        if t>7:success(im,'Photo selected',1000)
        return im
    if name=='odometer':
        im=garage_frame(1020)
        if t>2.45:
            ui.rect(im,(20,639,762,1192),ui.BG,ui.BG)
            ui.field(im,'Customer odometer',typed('120450',t,3.1,5.5),666,active=t<8.55)
            ui.text(im,'Customer reading · kilometres',36,811,29,ui.MUTED)
            ui.button(im,'SAVE DETAILS',925)
            if t>8.6:success(im,'120,450 km saved to your account',1050)
        return im

def booking_draw(name,t,d):
    if name=='booking_start':
        im=ui.base('Book ahead','Your next PSI visit','Bookings')
        ui.text(im,'Your vehicle. Your goals.',36,230,39,ui.WHITE,True)
        for i,(title,copy) in enumerate([('Service & Report','Workshop service and inspection'),('Dyno Tuning','Tell PSI about your current setup')]):
            y=371+i*182;ui.rect(im,(36,y,744,y+148),ui.PANEL,ui.CYAN if i==0 and t>2.8 else ui.LINE)
            ui.text(im,title,65,y+26,35,ui.WHITE,True);ui.text(im,copy,65,y+82,27,ui.MUTED,width=639)
        ui.button(im,'CONTINUE →',1080);return im
    if name in ['booking_job','booking_vehicle','booking_details','booking_date','booking_review']:
        step=['booking_job','booking_vehicle','booking_details','booking_date','booking_review'].index(name)
        im=ui.booking(step)
        if step==0:
            ui.rect(im,(40,654,740,827),'#111111','#111111')
            ui.text(im,typed('Service and brake inspection, please.',t,1.4,4.8)+('|' if 1.4<t<4.8 else ''),57,665,31,ui.WHITE,width=660)
        if step==3:
            ui.rect(im,(35,360,746,976),ui.BG,ui.BG)
            ui.field(im,'Date preference','Choose a preferred date',385)
            ui.field(im,'Preferred booking date','6 October 2026',540,active=2.5<t<4)
            ui.field(im,'Drop-off preference','During business hours',702)
            ui.text(im,'PSI confirms availability personally.',36,902,30,ui.CYAN,width=700)
        if step==4:
            ui.rect(im,(30,921,750,1057),ui.BG,ui.BG)
            ui.rect(im,(38,959,82,1003),ui.CYAN if t>5 else ui.BG,ui.CYAN,4)
            if t>5:ui.icon(im,'checkmark',43,960,32,ui.BG)
            ui.text(im,'Remind me before my 6- and\n12-month services',108,951,29,ui.WHITE,True,width=608)
            ui.rect(im,(30,1061,752,1192),ui.BG,ui.BG)
            ui.text(im,'Scroll to the booking policy and consent.',36,1096,29,ui.CYAN,width=705)
        return im
    if name=='booking_consent':
        im=ui.base('Review your request','Booking & deposit policy','Bookings')
        ui.text(im,'What happens next',36,231,38,ui.WHITE,True)
        ui.text(im,'PSI reviews the date first. A deposit\nlink follows only after approval.\nConfirmation follows verified payment.',36,303,32,ui.MUTED,width=706)
        for label,copy,y,on in [('Booking and deposit terms','Read the policy in full before\naccepting the booking terms.',528,t>3.35),('Contact consent','Allow PSI to contact you about this\nrequest, dates and booking updates.',771,t>6.35)]:
            ui.rect(im,(35,y,744,y+197),ui.PANEL,ui.LINE);ui.rect(im,(42,y+21,82,y+61),ui.CYAN if on else ui.BG,ui.CYAN,3)
            if on:ui.icon(im,'checkmark',45,y+24,31,ui.BG)
            ui.text(im,label,105,y+20,31,ui.WHITE,True,width=600);ui.text(im,copy,105,y+88,29,ui.MUTED,width=604)
        ui.text(im,'Read the privacy policy ↗',36,1009,28,ui.CYAN)
        ui.button(im,'SUBMIT REQUEST FOR PSI REVIEW',1080);return im
    if name=='booking_received':return ui.received()
    if name=='booking_status':
        im=ui.base('Bookings','Your PSI visits','Bookings')
        ui.text(im,'Your requests and visits',36,204,35,ui.WHITE,True)
        ui.rect(im,(36,315,744,713),ui.PANEL,ui.LINE)
        ui.text(im,'Service & Report',62,352,43,ui.WHITE,True)
        ui.text(im,'Holden Commodore VY SS · DEMO001',62,424,28,ui.MUTED,width=650)
        ui.text(im,'Requested: 6 October 2026',62,512,32,ui.WHITE,True)
        ui.text(im,'Pending PSI staff review',62,605,31,ui.CYAN,True)
        ui.text(im,'WHAT HAPPENS NEXT',36,787,25,ui.CYAN,True)
        for i,line in enumerate(['PSI reviews the request','Date approved → deposit arranged','Payment verified → visit confirmed']):
            ui.icon(im,'checkmark-circle-outline',36,852+i*96,37,ui.CYAN)
            ui.text(im,line,98,852+i*96,30,ui.WHITE,width=620)
        return im
    if name=='dyno_setup':
        im=ui.base('Your tuning setup','Dyno request','Bookings')
        ui.text(im,'Tell PSI what is fitted',36,217,37,ui.WHITE,True)
        for label,value,y in [('Engine','Standard engine',321),('Transmission','Manual',474),('Fuel to tune','98 RON petrol',627),('Intake','Standard intake',780)]:ui.field(im,label,value,y)
        ui.text(im,'Include exact details for modified parts.',36,980,30,ui.MUTED,width=700)
        ui.button(im,'CONTINUE →',1080);return im
    if name=='build':
        im=ui.base('Plan & Build','Start with your goal','My Garage')
        ui.text(im,'Draft only',36,212,32,ui.CYAN,True)
        ui.text(im,'Nothing is sent until you choose\na contact option.',36,264,29,ui.MUTED,width=700)
        ui.field(im,'Vehicle from My Garage','Holden Commodore VY SS',377)
        ui.field(im,'Choose build areas','Engine · handling',540)
        ui.field(im,'Intended use','Street',703)
        ui.field(im,'Goal or concern — optional','Discuss the next reliable street upgrade.',866)
        ui.button(im,'OPEN EMAIL DRAFT',1065)
        if t>8.2:
            im=ui.base('Review your enquiry','Unsent email draft','My Garage')
            ui.text(im,'Plan & Build enquiry',36,242,38,ui.WHITE,True)
            ui.text(im,'Vehicle: Holden Commodore VY SS\nRegistration: DEMO001\nAreas: Engine and handling\nGoal: Reliable street upgrade',36,360,33,ui.WHITE,width=700)
            ui.text(im,'Review the draft before sending.',36,952,32,ui.CYAN,True,width=700)
        return im

def records_draw(name,t,d):
    if name=='reports':
        im=ui.reports();ui.rect(im,(22,405,762,1195),ui.BG,ui.BG)
        rows=[('Service & repair history','construct-outline'),('Recommended work','alert-circle-outline'),('Dyno results & graphs','speedometer-outline'),('Invoice archive','receipt-outline'),('Workshop photos','images-outline'),('Modifications & build history','car-sport-outline'),('Reports & documents','documents-outline')]
        for i,(label,symbol) in enumerate(rows):
            y=423+i*106;ui.rect(im,(36,y,744,y+92),ui.PANEL,ui.CYAN if i==0 and t>7.7 else ui.LINE)
            ui.icon(im,symbol,59,y+26,35);ui.text(im,label,112,y+28,28,ui.WHITE,True);ui.icon(im,'chevron-forward',694,y+31,24)
        return im
    if name=='build_history':
        im=ui.base('Modifications &\nbuild history','Your vehicle records','Reports')
        ui.text(im,'Holden Commodore VY SS · DEMO001',36,275,28,ui.MUTED,width=700)
        ui.rect(im,(36,404,744,925),ui.PANEL,ui.LINE)
        ui.text(im,'Example build record',65,447,39,ui.WHITE,True)
        ui.text(im,'Fictional workshop entry',65,529,29,ui.CYAN,True)
        ui.text(im,'Completed work and supporting\nnotes stay with the selected\nvehicle archive.',65,616,34,ui.WHITE,width=646)
        ui.text(im,'Published by PSI · read-only',65,844,28,ui.MUTED)
        return im
    if name in ['service','recommended']:
        im=ui.base('Service & repair history' if name=='service' else 'Recommended work','Your vehicle records','Reports')
        ui.text(im,'Holden Commodore VY SS · DEMO001',36,260,29,ui.MUTED,width=700)
        ui.rect(im,(36,386,744,917),ui.PANEL,ui.LINE)
        ui.text(im,'Service inspection' if name=='service' else 'Brake follow-up',64,421,39,ui.WHITE,True)
        ui.text(im,'3 September 2026 · fictional example',64,498,28,ui.CYAN,width=645)
        copy='Workshop inspection recorded.\nService checks and findings are\nkept with this vehicle.' if name=='service' else 'Discuss brake condition at the\nnext workshop visit. PSI confirms\nthe required scope after inspection.'
        ui.text(im,copy,64,586,34,ui.WHITE,width=645)
        ui.text(im,'PSI workshop record · read-only',64,826,28,ui.MUTED,width=645)
        return im
    if name=='notes':
        im=ui.base('Your notes · free','Reports','Reports')
        ui.text(im,'For your selected vehicle',36,231,30,ui.MUTED)
        ui.field(im,'Add a note for PSI',typed('Please check the brake noise when cold.',t,1.6,5.9),374,260,active=t<8.4)
        ui.button(im,'SAVE NOTE',776)
        ui.text(im,'Customer notes are separate from\nverified workshop records.',36,915,30,ui.MUTED,width=700)
        if t>8.5:success(im,'Your note has been saved.',1055)
        return im
    if name=='photos':return ui.gallery(t>2.4)
    if name in ['dyno','invoice','document']:
        key='file' if name=='document' else name
        if t<2.5:
            im=ui.base({'dyno':'Dyno results & graphs','invoice':'Invoice archive','document':'Reports & documents'}[name],'Performance+','Reports')
            ui.text(im,'Saved vehicle files',36,256,33,ui.MUTED)
            ui.rect(im,(36,374,744,618),ui.PANEL,ui.CYAN)
            ui.icon(im,'document-text-outline',61,409,50)
            ui.text(im,{'dyno':'Sample dyno graph','invoice':'Sample invoice','document':'Workshop inspection'}[name],140,414,33,ui.WHITE,True,width=560)
            ui.text(im,'Open file',140,493,31,ui.CYAN,True)
            return im
        im=ui.base({'dyno':'Dyno results & graphs','invoice':'Invoice archive','document':'Reports & documents'}[name],'Performance+','Reports')
        ui.fit(im,HERE/'documents'/f'{name}.jpg',(30,241,720,909))
        ui.text(im,'Fictional document · DEMO001',36,1155,25,ui.MUTED)
        return im

@lru_cache(maxsize=64)
def draw_cached(name,t,d):
    # Rounded times keep state/typing caching bounded while preserving motion.
    if name in {s['id'] for s in onboarding.SCENES}:return onboarding.draw(name,t,d,ui)
    if name in {s['id'] for s in extras.SCENES}:return extras.draw(name,t,d,ui)
    if name in {s['id'] for s in GARAGE}:return garage_draw(name,t,d)
    if name in {s['id'] for s in BOOKING}:return booking_draw(name,t,d)
    if name in {s['id'] for s in REPORTS}:return records_draw(name,t,d)
    if name=='home':
        page=extended_home();offset=int(1850*ui.ease((t-1.4)/7.3)*(1-ui.ease((t-10)/2.0)));im=Image.new('RGB',(780,1300),ui.BG);im.paste(page.crop((0,offset,780,offset+1198)),(0,0));ui.nav(im,'Home');return im
    if name=='customise':
        if t>8.8:return ui.home()
        im=ui.base('Choose your tiles','Home shortcuts','Home');ui.rect(im,(0,1198,780,1300),ui.BG,ui.BG)
        ui.text(im,'Select the tiles you want at\nthe top of Home.',36,255,32,ui.MUTED,width=705)
        for i,label in enumerate(['My Garage','My Bookings','Book Ahead','PSI Events','Performance+','Settings & Notifications']):
            y=400+i*100;ui.rect(im,(36,y,744,y+80),ui.PANEL,ui.LINE);ui.text(im,label,60,y+23,30,ui.WHITE,True)
            ui.icon(im,'checkmark-circle' if i!=1 or t>2.5 else 'ellipse-outline',641,y+23,34)
        ui.button(im,'DONE',1070)
        return im
    return ui.home()

@lru_cache(None)
def extended_home():
    im=Image.new('RGB',(780,3400),ui.BG);im.paste(ui.home_page(),(0,0))
    ui.rect(im,(435,379,744,447),ui.BG,ui.CYAN,0,2);ui.text(im,'CUSTOMISE',486,397,27,ui.CYAN,True)
    ui.text(im,'WORKSHOP',36,1660,38,ui.WHITE,True)
    tiles=[('DYNO TUNING','tile-hub-dyno-blue-silver.jpg'),('VEHICLE REPORTS','tile-vehicle-reports-blue-silver.jpg'),('PLAN & BUILD','tile-plan-build-blue-silver.jpg'),('TRUSTED PARTNERS','tile-trusted-partners-blue-silver.jpg'),('CUSTOMER CARS\nFOR SALE','tile-customer-cars-for-sale-blue-silver.jpg')]
    for i,(label,filename) in enumerate(tiles):
        x=36+(i%2)*368;y=1735+(i//2)*375;path=ui.ASSETS/'dashboard'/filename
        if not path.exists():path=ui.ASSETS/'dashboard/tile-my-bookings-blue-silver.jpg'
        ui.rect(im,(x,y,x+340,y+338),ui.BG,'#cbd3d8',0,4);ui.fit(im,path,(x+5,y+5,330,250))
        ui.rect(im,(x+2,y+256,x+338,y+336),ui.BG,'#cbd3d8',0,2)
        for n,line in enumerate(label.split('\n')):
            fw=ImageDraw.Draw(im).textlength(line,font=ui.font(24,True));ui.text(im,line,x+(340-fw)/2,y+270+n*28,24,ui.WHITE,True)
    return im

@lru_cache(maxsize=24)
def scaled_screen(name,t,duration):
    return draw_cached(name,t,duration).resize((900,1500),Image.Resampling.LANCZOS)

def frame(s,t,elapsed,total,chapter_num,chapter_count):
    im=Image.new('RGB',(W,H),'#060b0f')
    ui.fit(im,ui.ASSETS/'psi-logo.png',(68,55,189,86))
    ui.text(im,s['chapter'],297,73,29,ui.CYAN,True,width=713)
    if s['id'] in ['intro','outro']:
        ui.text(im,s['title'],70,245,68,ui.WHITE,True,width=940)
        ui.fit(im,ui.ASSETS/'garage-vehicles/holden-commodore-vy.jpg',(28,423,1024,750))
        ui.text(im,'ACCOUNT · GARAGE · BOOKINGS\nRECORDS · REMINDERS',72,1188,40,ui.CYAN,True,width=935)
        ui.text(im,'Your vehicle story, in one place.' if s['id']=='intro' else 'LAUNCHING SOON',72,1379,45,ui.WHITE,True,width=935)
        if s['id']=='outro':ui.text(im,'psiperformance.com.au',72,1476,37,ui.MUTED,True)
    else:
        original_duration=BASE_DURATIONS[s['id']]
        action_t=t*original_duration/s['duration']
        screen=draw_cached(s['id'],round(action_t*10)/10,original_duration)
        scaled=scaled_screen(s['id'],round(action_t*10)/10,original_duration)
        # Editorial close-up for fine document detail; keep navigation unchanged elsewhere.
        if s['id'] in ['dyno','invoice','document'] and action_t>5:
            pic=ui.pic(HERE/'documents'/f'{s["id"]}.jpg').convert('RGB')
            p=ui.ease((action_t-5)/2.0)
            cropw=pic.width*(1-.07*p)
            croph=min(pic.height,cropw*1.33)
            cy=pic.height*(.57 if s['id']=='dyno' else (.51+.09*p))
            top=max(0,min(pic.height-croph,cy-croph/2))
            crop=pic.crop(((pic.width-cropw)/2,top,(pic.width+cropw)/2,top+croph))
            close=Image.new('RGB',(780,1300),ui.BG)
            ui.text(close,'DOCUMENT CLOSE-UP',36,27,26,ui.CYAN,True)
            fitcrop=ui.ImageOps.contain(crop,(744,1080),method=Image.Resampling.LANCZOS)
            close.paste(fitcrop,((780-fitcrop.width)//2,160+(1080-fitcrop.height)//2))
            ui.text(close,'Fictional example',36,1232,27,ui.MUTED)
            screen=Image.blend(screen,close,ui.ease((action_t-5)/.55))
            scaled=screen.resize((900,1500),Image.Resampling.LANCZOS)
        ui.rect(im,(84,164,996,1676),'#0e171d','#3d525e',20,2)
        im.paste(scaled,(90,170))
        # Draw contact feedback after scaling so static interface frames are reusable.
        for event,x,y in s.get('taps',[]):
            dt=action_t-event
            if 0<=dt<.7:
                p=dt/.7;r=(18+31*ui.ease(p))*900/780;cx=90+x*900/780;cy=170+y*1500/1300
                dd=ImageDraw.Draw(im);dd.ellipse((cx-r,cy-r,cx+r,cy+r),outline=ui.CYAN,width=max(2,int(7*(1-p))))
                dd.ellipse((cx-8,cy-8,cx+8,cy+8),fill=ui.WHITE)
    ui.text(im,s['caption'],72,1710,34,ui.WHITE,True,width=935)
    ui.text(im,'ANIMATED DEMO · FICTIONAL DATA',72,1830,25,ui.CYAN,True)
    ui.text(im,f'{chapter_num:02d} / {chapter_count:02d}',873,1830,24,ui.MUTED)
    draw=ImageDraw.Draw(im);draw.line((72,1883,1008,1883),fill='#263844',width=4)
    draw.line((72,1883,72+936*(elapsed+t)/total,1883),fill=ui.CYAN,width=4)
    return im

def prepare():
    (WORK/'narration').mkdir(exist_ok=True)
    items=[{'id':s['id'],'text':s['narration']} for s in SCENES]+[{'id':s['audio_id'],'text':s['narration']} for s in promo_scenes()]
    (WORK/'narration/script.json').write_text(json.dumps(items,indent=2),encoding='utf8')
    (WORK/'script.json').write_text(json.dumps(SCENES,indent=2),encoding='utf8')
    print(f'{len(SCENES)} scenes, {sum(s["duration"] for s in SCENES)}s minimum',flush=True)

def final_scenes(narrated=True):
    chosen=[]
    for s in SCENES:
        s=dict(s)
        if narrated and (WORK/'narration'/f'{s["id"]}.wav').exists():
            with wave.open(str(WORK/'narration'/f'{s["id"]}.wav'),'rb') as audio:seconds=audio.getnframes()/audio.getframerate()
            s['duration']=max(s['duration'],math.ceil(seconds+.8))
        chosen.append(s)
    return chosen

def boards():
    (WORK/'storyboard').mkdir(exist_ok=True)
    scenes=final_scenes();total=sum(s['duration'] for s in scenes);elapsed=0;thumbs=[]
    for i,s in enumerate(scenes):
        im=frame(s,s['duration']*.72,elapsed,total,i+1,len(scenes));im.save(WORK/'storyboard'/f'{i+1:02d}-{s["id"]}.jpg',quality=90)
        thumbs.append(im.resize((216,384)));elapsed+=s['duration']
    rows=math.ceil(len(thumbs)/6);sheet=Image.new('RGB',(1296,rows*422),'#14202a')
    for i,img in enumerate(thumbs):
        x=i%6*216;y=i//6*422;sheet.paste(img,(x,y));ui.text(sheet,f'{i+1:02d} {scenes[i]["id"]}',x+5,y+390,16,ui.WHITE,True)
    sheet.save(WORK/'contact.jpg',quality=92)
    print(f'Storyboard complete: {len(scenes)} scenes, {total}s',flush=True)

def audio_track(scenes,narrated,promo=False):
    duration=sum(s['duration'] for s in scenes);sr=44100
    path=WORK/(('promo-' if promo else '')+('narrated-mix.wav' if narrated else 'music-mix.wav'))
    ui.write_score(WORK/'score.wav',duration)
    with wave.open(str(WORK/'score.wav'),'rb') as w:music=np.frombuffer(w.readframes(w.getnframes()),dtype='<i2').reshape(-1,2).astype(np.float32)/32768
    mix=music*(.7 if narrated else 2.5);elapsed=0
    for s in scenes:
        if narrated:
            audio_id=s.get('audio_id',s['id'])
            source=WORK/'narration'/f'{audio_id}.wav';normal=WORK/'narration'/f'{audio_id}-normal.wav'
            if not source.exists():raise ValueError(f'Missing narration {source}')
            with wave.open(str(source),'rb') as w:voice_seconds=w.getnframes()/w.getframerate()
            tempo=max(1,voice_seconds/(s['duration']-.55))
            if tempo>1.4:raise ValueError(f'Promo voice too fast: {audio_id} {tempo}')
            filters=f'atempo={tempo:.5f},loudnorm=I=-17:TP=-2:LRA=7'
            subprocess.run([str(ui.FFMPEG),'-y','-v','error','-i',str(source),'-af',filters,'-ar',str(sr),'-ac','2','-c:a','pcm_s16le',str(normal)],check=True)
            with wave.open(str(normal),'rb') as w:data=np.frombuffer(w.readframes(w.getnframes()),dtype='<i2').reshape(-1,2).astype(np.float32)/32768
            start=int((elapsed+.25)*sr);end=min(len(mix),start+len(data));mix[start:end]+=data[:end-start]
        elapsed+=s['duration']
    peak=np.max(np.abs(mix));mix*=min(1,.92/max(.001,peak))
    with wave.open(str(path),'wb') as w:w.setnchannels(2);w.setsampwidth(2);w.setframerate(sr);w.writeframes((mix*32767).astype('<i2').tobytes())
    return path

def stamp(seconds):
    ms=int(seconds*1000);return f'{ms//3600000:02d}:{ms//60000%60:02d}:{ms//1000%60:02d},{ms%1000:03d}'

def render(narrated=True,promo=False):
    scenes=promo_scenes() if promo else final_scenes(narrated);total=sum(s['duration'] for s in scenes);audio=audio_track(scenes,narrated,promo)
    name='PSI-Launch-Showcase-90s' if promo else 'PSI-Complete-App-Guide';dest=WORK/(name+'.mp4')
    args=[str(ui.FFMPEG),'-y','-hide_banner','-loglevel','error','-f','rawvideo','-pix_fmt','rgb24','-s','1080x1920','-r',str(FPS),'-i','pipe:0','-i',str(audio),'-c:v','libx264','-preset','veryfast','-crf','19','-pix_fmt','yuv420p','-threads','2','-c:a','aac','-b:a','160k','-movflags','+faststart','-map_metadata','-1','-shortest',str(dest)]
    with (WORK/(name+'-encode.log')).open('wb') as log:
        p=subprocess.Popen(args,stdin=subprocess.PIPE,stderr=log);elapsed=0;last=None;chapters=[];subtitles=[]
        try:
            for i,s in enumerate(scenes):
                print(f'{i+1}/{len(scenes)} {s["id"]} {elapsed}s',flush=True)
                chapters.append(dict(start=elapsed,title=s['title'],chapter=s['chapter'],duration=s['duration']))
                words=s['narration'].split();chunks=[words[k:k+12] for k in range(0,len(words),12)]
                for k,chunk in enumerate(chunks):
                    start=elapsed+s['duration']*k/len(chunks);end=elapsed+s['duration']*(k+1)/len(chunks)
                    caption=' '.join(chunk[:6])+('\n'+' '.join(chunk[6:]) if len(chunk)>6 else '')
                    subtitles.append(f'{len(subtitles)+1}\n{stamp(start)} --> {stamp(end)}\n{caption}\n')
                for j in range(s['duration']*FPS):
                    t=j/FPS;im=frame(s,t,elapsed,total,i+1,len(scenes))
                    if last is not None and t<.27:im=Image.blend(last,im,ui.ease(t/.27))
                    p.stdin.write(im.tobytes())
                last=im;elapsed+=s['duration']
            p.stdin.close();code=p.wait()
        except BaseException:p.stdin.close();p.terminate();raise
    if code:raise RuntimeError('FFmpeg encoding failed')
    subprocess.run([str(ui.FFMPEG),'-v','error','-i',str(dest),'-f','null','-'],check=True)
    (WORK/(name+'-chapters.json')).write_text(json.dumps(chapters,indent=2),encoding='utf8')
    (WORK/(name+'.srt')).write_text('\n'.join(subtitles),encoding='utf8')
    report={'duration_seconds':total,'scenes':len(scenes),'type':'source-based animation, not screen recording','narration':'Microsoft James, en-AU' if narrated else 'none','resolution':'1080x1920','fps':FPS,'full_decode_passed':True,'bytes':dest.stat().st_size,'sha256':hashlib.sha256(dest.read_bytes()).hexdigest()}
    (WORK/(name+'-validation.json')).write_text(json.dumps(report,indent=2),encoding='utf8')
    frame(scenes[0],3,0,total,1,len(scenes)).save(WORK/(name+'-poster.jpg'),quality=92)
    print(json.dumps(report,indent=2),flush=True)

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--prepare',action='store_true');p.add_argument('--boards',action='store_true');p.add_argument('--render',action='store_true');p.add_argument('--music-only',action='store_true');p.add_argument('--promo',action='store_true');args=p.parse_args()
    if args.prepare:prepare()
    if args.boards:boards()
    if args.render:render(not args.music_only,args.promo)
