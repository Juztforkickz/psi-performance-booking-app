"""Create fictional illustrated documents for a consistent animated guide."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
OUT=Path(__file__).resolve().parent/'documents'
OUT.mkdir(exist_ok=True)
def font(n,b=False):return ImageFont.truetype('C:/Windows/Fonts/'+('segoeuib.ttf' if b else 'segoeui.ttf'),n)
def text(im,s,x,y,n=36,c='#152d38',b=False):ImageDraw.Draw(im).multiline_text((x,y),s,font=font(n,b),fill=c,spacing=15)
def base(title,h=1754):
    im=Image.new('RGB',(1240,h),'white');d=ImageDraw.Draw(im)
    d.rectangle((0,0,1240,270),fill='#101820');text(im,'PSI',72,27,72,'white',True);text(im,title,72,141,52,'white',True)
    text(im,'FICTIONAL DEMONSTRATION',72,218,24,'#aebfc8',True)
    d.rectangle((0,270,1240,335),fill='#65cff8');text(im,'ALEX DRIVER · DEMO001 · HOLDEN COMMODORE VY SS',72,286,27,'#101820',True)
    return im
im=base('Sample invoice');d=ImageDraw.Draw(im)
text(im,'NOT PAYABLE · NOT A TAX INVOICE',72,374,34,'#17617a',True)
text(im,'Example date: 3 September 2026',72,438,31)
d.rectangle((72,553,1168,633),fill='#165b72');text(im,'FICTIONAL LINE ITEM',99,574,31,'white',True);text(im,'AUD',1000,574,31,'white',True)
text(im,'Demo workshop inspection',98,687,34);text(im,'$200.00',1000,687,34,b=True)
text(im,'Demo labour and report preparation',98,796,31);text(im,'$185.00',1000,796,34,b=True)
d.line((72,907,1168,907),fill='#c4cbd0',width=2)
for y,label,value in [(956,'Illustrative subtotal','$385.00'),(1036,'Illustrative GST (10%)','$38.50'),(1116,'Illustrative total','$423.50')]:
    text(im,label,460,y,33);text(im,value,998,y,34,b=True)
d.rectangle((72,1268,1168,1488),fill='#eef4f7')
text(im,'AMOUNT DUE: $0.00 AUD',102,1303,49,'#17617a',True)
text(im,'Example only. No payment is required.',102,1395,34)
text(im,'SYNTHETIC SAMPLE · NO REAL CUSTOMER OR TRANSACTION',72,1640,27,'#61737c')
im.save(OUT/'invoice.jpg',quality=95)
im=base('Workshop inspection');d=ImageDraw.Draw(im)
text(im,'Sample service record',72,390,46,b=True);text(im,'3 September 2026 · fictional inspection',72,460,32)
for i,(label,copy) in enumerate([('Vehicle checks','Example inspection entry for the selected vehicle.'),('Service notes','Findings and workshop comments are kept together.'),('Recommended work','Discuss brake condition at the next workshop visit.'),('Supporting information','This document demonstrates a saved workshop file.')]):
    y=580+i*220;d.rectangle((72,y,1168,y+166),fill='#f0f5f8');text(im,label,101,y+24,39,'#17617a',True);text(im,copy,101,y+96,31)
text(im,'FICTIONAL RECORD · READ-ONLY WORKSHOP DOCUMENT',72,1600,29,'#61737c',True)
im.save(OUT/'document.jpg',quality=95)
im=base('Sample dyno graph',1530);d=ImageDraw.Draw(im)
text(im,'ILLUSTRATIVE CURVE ONLY',72,380,36,'#17617a',True)
text(im,'No actual vehicle performance is represented.',72,441,30)
left,top,right,bottom=155,576,1150,1140
for i in range(7):
    x=left+i*(right-left)/6;d.line((x,top,x,bottom),fill='#d3dce1',width=2);text(im,str(1000+i*1000),x-38,bottom+25,25)
for i in range(5):
    y=bottom-i*(bottom-top)/4;d.line((left,y,right,y),fill='#d3dce1',width=2);text(im,str(i*75),78,y-17,27)
d.line((left,top,left,bottom,right,bottom),fill='#48616c',width=3)
points=[(left+(right-left)*p,bottom-(bottom-top)*v) for p,v in [(0,.12),(.12,.27),(.25,.44),(.38,.59),(.50,.73),(.63,.86),(.76,.91),(.89,.88),(1,.81)]]
d.line(points,fill='#25afd8',width=8)
text(im,'ENGINE SPEED (RPM)',420,1215,30,b=True)
text(im,'Power · HP at hubs',155,520,30,b=True)
d.rectangle((72,1320,1168,1450),fill='#eef4f7');text(im,'SAMPLE DATA · NOT A PERFORMANCE CLAIM',100,1364,33,'#17617a',True)
im.save(OUT/'dyno.jpg',quality=95)
print('Created three consistent fictional document images.')
