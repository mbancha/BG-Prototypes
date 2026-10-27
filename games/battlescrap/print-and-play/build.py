from pathlib import Path
import ast, re, json, math, io, hashlib
from xml.sax.saxutils import escape
from PIL import Image, ImageOps
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, Color, white
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from pypdf import PdfReader, PdfWriter
import pypdfium2 as pdfium

ROOT=Path(__file__).resolve().parent
GAME=ROOT.parent
OUT=ROOT/'pdf'; OUT.mkdir(exist_ok=True)
PRE=ROOT/'previews'; PRE.mkdir(exist_ok=True)
for name,file in [('Regular','arial.ttf'),('Bold','arialbd.ttf'),('Italic','ariali.ttf'),('BoldItalic','arialbi.ttf')]:
    pdfmetrics.registerFont(TTFont(name,'C:/Windows/Fonts/'+file))
pdfmetrics.registerFontFamily('Regular',normal='Regular',bold='Bold',italic='Italic',boldItalic='BoldItalic')
src=(GAME/'src/content.ts').read_text(encoding='utf-8')
def array(name):
    start=src.index('export const '+name+'=')+len('export const '+name+'=')
    end=src.index('].map',start)+1 if name in ('heroes','cards') else src.index('];',start)+1
    return ast.literal_eval(src[start:end])
heroes=[dict(zip(['id','name','job','secondary','region','move','defense','attack','range','cost','ability','text'],h)) for h in array('heroes')]
cards=[dict(zip(['id','name','cost','effect','suit','text'],h)) for h in array('cards')]
objectives=array('objectives'); H={h['id']:h for h in heroes}
arts={h['id']:next((GAME/'public/heroes-v7').glob(h['id']+'-*.png')) for h in heroes}
INK=HexColor('#283c3b'); IVORY=HexColor('#ffffff'); GOLD=HexColor('#b58138'); LINE=HexColor('#aca99c')
COLORS={'Fire':'#bd542d','Lightning':'#906b15','Water':'#28768e','boost':'#44784c','daze':'#a46d24','stunned':'#81578f','heart':'#a44a45'}
REGIONS={'Windlands':'#a15d3b','Highholm':'#537a88','Cinder’s Rim':'#ac5439','Timberwood':'#58734e','Port Windlass':'#327c85'}
CW,CH=180,252; PW,PH=612,792; CM=72/2.54
manifest={'version':'turn-rules-v8','cards':[],'geometry':{'card_inches':[2.5,3.5],'standee_folded_inches':[1,2],'standee_insert_inches':.25,'element_cm':[1,1],'queue_side_rail_cm':.75},'text_checks':[]}

def label(c,s,x,y,size=10,font='Regular',color=INK):
    c.setFillColor(color); c.setFont(font,size); c.drawString(x,y,str(s))
def center(c,s,x,y,size=10,font='Regular',color=INK):
    c.setFillColor(color); c.setFont(font,size); c.drawCentredString(x,y,str(s))
def para(c,s,x,top,w,h,size=10,bold=False):
    sty=ParagraphStyle('p',fontName='Bold' if bold else 'Regular',fontSize=size,leading=size*1.2,textColor=INK)
    p=Paragraph(s,sty); aw,ah=p.wrap(w,h)
    if ah>h+.1: raise ValueError(f'Text overflow {ah}>{h}: {s}')
    manifest['text_checks'].append({'text':re.sub('<.*?>','',s),'size_pt':size,'height_pt':round(ah,2),'available_pt':h})
    p.drawOn(c,x,top-ah); return ah
def line(c,x1,y1,x2,y2,color=LINE,width=.35):
    c.setStrokeColor(color); c.setLineWidth(width); c.line(x1,y1,x2,y2)
def poly(c,pts,fill=True):
    p=c.beginPath();p.moveTo(*pts[0])
    for a in pts[1:]:p.lineTo(*a)
    p.close();c.drawPath(p,fill=int(fill),stroke=1)
def icon(c,name,x,y,s,color=None):
    c.saveState();c.translate(x,y);c.scale(s/24,s/24)
    c.setFillColor(color or HexColor(COLORS.get(name,'#283c3b')));c.setStrokeColor(color or HexColor(COLORS.get(name,'#283c3b')));c.setLineWidth(1.4)
    if name=='Lightning':poly(c,[(14,23),(3,10),(10,10),(8,1),(21,15),(13,15)])
    elif name=='Water':
        p=c.beginPath();p.moveTo(12,23);p.curveTo(9,17,3,12,3,8);p.curveTo(3,-3,21,-3,21,8);p.curveTo(21,12,15,17,12,23);c.drawPath(p,fill=1,stroke=0)
    elif name=='Fire':
        p=c.beginPath();p.moveTo(12,23);p.curveTo(17,17,10,15,13,10);p.curveTo(17,12,18,16,17,18);p.curveTo(29,1,11,-4,5,3);p.curveTo(-2,9,7,17,7,17);p.curveTo(5,7,13,7,12,23);c.drawPath(p,fill=1,stroke=0)
    elif name=='defense':poly(c,[(12,22),(21,18),(19,8),(12,2),(5,8),(3,18)])
    elif name in ('attack','bow'):
        c.line(4,3,20,21);c.line(4,10,11,3);c.line(4,3,7,6);c.line(15,21,20,21);c.line(20,16,20,21)
        if name=='bow':c.bezier(4,3,24,3,24,21,4,21)
    elif name=='move':
        c.line(2,12,22,12);c.line(16,18,22,12);c.line(16,6,22,12);c.line(7,18,2,12);c.line(7,6,2,12)
    elif name=='boost':
        pts=[(12+(10 if i%2==0 else 4.5)*math.sin(i*math.pi/5),12+(10 if i%2==0 else 4.5)*math.cos(i*math.pi/5)) for i in range(10)];poly(c,pts)
    elif name in ('daze','stunned'):
        poly(c,[(8,2),(16,2),(22,8),(22,16),(16,22),(8,22),(2,16),(2,8)],False)
        if name=='stunned':c.line(4,4,20,20)
        else:center(c,'−',12,5,18,'Bold')
    elif name=='heart':
        p=c.beginPath();p.moveTo(12,2);p.curveTo(-8,16,6,28,12,18);p.curveTo(18,28,32,16,12,2);c.drawPath(p,fill=1,stroke=0)
    elif name=='soldier':
        poly(c,[(8,22),(16,22),(18,17),(16,13),(20,11),(23,3),(16,3),(14,8),(10,8),(8,3),(1,3),(4,11),(8,13),(6,17)])
    elif name=='stone':poly(c,[(12,23),(21,16),(18,4),(10,1),(3,8),(5,19)],False);c.line(5,19,18,4);c.line(21,16,3,8)
    elif name=='draw':
        c.rect(4,3,13,18,fill=0);c.line(19,5,21,5);c.line(21,5,21,23);c.line(21,23,8,23)
    c.restoreState()
def art(c,h,x,y,w,hh,mirror=False,portrait=False):
    im=Image.open(arts[h]).convert('RGB')
    if portrait:
        im=im.crop((0,0,im.width,int(im.width*hh/w)))
    if mirror:im=ImageOps.mirror(im)
    im.thumbnail((round(w/72*300),round(hh/72*300)),Image.Resampling.LANCZOS)
    data=io.BytesIO();im.save(data,format='JPEG',quality=95,subsampling=0);data.seek(0)
    c.drawImage(ImageReader(data),x,y,width=w,height=hh,preserveAspectRatio=not portrait,anchor='c',mask='auto')
def base(c):c.setFillColor(IVORY);c.rect(0,0,CW,CH,stroke=0,fill=1)
def stats(c,h,y=58):
    for key,val,x in [('move',h['move'],10),('bow' if h['range']>1 else 'attack',str(h['attack'])+(f" / {h['range']}" if h['range']>1 else ''),61),('defense',h['defense'],130)]:
        icon(c,key,x,y,14);label(c,val,x+18,y+2,10,'Bold')
def hero_card(c,h):
    base(c);art(c,h['id'],0,126,180,126,portrait=True)
    para(c,escape(h['name']),10,119,160,20,12,True)
    label(c,h['job']+' / '+h['secondary'],10,87,7.1,'Bold')
    c.setFont('Regular',7.1);c.setFillColor(INK);c.drawRightString(170,87,h['region'])
    c.setStrokeColor(LINE);c.setLineWidth(.4);c.rect(7,52,166,25,stroke=1,fill=0)
    stats(c,h,55)
    tx=h['text'];paid=tx.startswith('1 AP, once: ')
    if paid:tx=tx.removeprefix('1 AP, once: ')
    heading=h['ability']+(' (1 AP, once)' if paid else ' (Passive)')
    para(c,f'<b>{escape(heading)}:</b> {escape(tx)}',10,49,160,44,8.7)
    c.setFillColor(IVORY);c.roundRect(6,225,30,21,4,fill=1,stroke=0)
    center(c,str(math.ceil(h['cost']/2))+' PP',21,232,8.5,'Bold')
def recruit_card(c,side):
    base(c);icon(c,'soldier',54,146,72);center(c,'RECRUITS',90,122,17,'Bold');center(c,side,90,103,10)
    stats(c,dict(move=2,attack=1,defense=1,range=1),76)
    para(c,'<b>2 HP each</b><br/>Move: 1 AP per recruit.<br/>Attack: 1 AP per recruit.<br/>Each action once per model per activation.',12,65,156,58,9.5)
def battle_card(c,b):
    base(c);linked=b['id'].startswith('h');h=H[b['id'][:3]] if linked else None
    if linked:
        art(c,h['id'],0,126,180,126,portrait=True)
        c.setFillColor(IVORY);c.roundRect(6,226,33,20,4,stroke=0,fill=1);center(c,str(b['cost'])+' AP',22.5,232,9,'Bold')
        label(c,h['name'],11,113,9)
        top=98
    else:
        icon(c,b['suit'],64,161,52);center(c,b['suit'].upper(),90,145,9,'Bold');label(c,'0 AP',10,234,9,'Bold');top=122
    th=para(c,escape(b['name']),11,top,158,36,14,True)
    para(c,escape(b['text']),11,top-th-12,158,78,11)
def objective_card(c,o):
    base(c);icon(c,'stone',71,186,38);center(c,'TACTICAL OBJECTIVE',90,166,8.5,'Bold')
    hh=para(c,escape(o[0]),12,141,156,38,15,True)
    para(c,escape(o[1]),12,141-hh-12,156,68,11)
    label(c,'3 RP',47,23,13,'Bold');label(c,'+',85,23,12);icon(c,'draw',105,21,21)
def equipment_card(c,e):
    c.setFillColor(IVORY);c.rect(0,0,180,126,stroke=0,fill=1)
    label(c,str(e['cost'])+' PP',10,109,9,'Bold');icon(c,e['icon'],148,101,16)
    hh=para(c,e['name'],10,90,160,30,13,True)
    para(c,e['text'],10,90-hh-9,160,57,10)


components=[]
for h in heroes:components.append(('hero',h,h['id']))
for side in ('Concord','Wildmoon'):components.append(('recruit',side,'recruits-'+side))
for side in ('A','B'):
    for b in cards[:10]:
        n=2 if int(b['id'][1:])<=8 else 1
        for i in range(n):components.append(('battle',b,f"{side}-{b['id']}-{i+1}"))
for b in cards[10:]:components.append(('battle',b,b['id']))
for i,o in enumerate(objectives):components.append(('objective',o,f'to{i+1:02}'))
gear=[dict(name='Trail Boots',cost=1,icon='move',text='+1 Move (item maximum 7).'),dict(name='Bellmetal Shield',cost=2,icon='defense',text='+1 Defense against melee. Cannot equip Orro.'),dict(name='Balanced Weapon',cost=2,icon='attack',text='+1 basic Attack. Does not improve ability-card attacks.'),dict(name='Sighting Lens',cost=2,icon='bow',text='+1 printed range on ranged basic attacks.')]
for side in ('A','B'):
    for i,e in enumerate(gear):components.append(('equipment',e,f'{side}-equipment-{i}'))
assert len(components)==86

def make_cards():
    c=canvas.Canvas(str(OUT/'01-cards.pdf'),pagesize=(PW,PH))
    for k,(typ,data,id) in enumerate(components):
        col=k%3;row=(k%9)//3;x=36+col*CW;y=18+(2-row)*CH
        if typ=='equipment':
            n=k-78;x=36+(n%3)*180;y=774-(n//3+1)*126
        c.saveState();c.translate(x,y)
        {'hero':hero_card,'recruit':recruit_card,'battle':battle_card,'objective':objective_card,'equipment':equipment_card}[typ](c,data)
        c.restoreState();c.setStrokeColor(LINE);c.setLineWidth(.25);c.rect(x,y,CW,126 if typ=='equipment' else CH,fill=0,stroke=1)
        manifest['cards'].append({'id':id,'type':typ,'page':10 if typ=='equipment' else k//9+1,'rect_pt':[x,y,CW,126 if typ=='equipment' else CH]})
        if (typ!='equipment' and (k%9==8 or k==77)) or k==len(components)-1:c.showPage()
    c.save()
    b=canvas.Canvas(str(OUT/'optional-card-backs.pdf'),pagesize=(PW,PH))
    for k,(typ,data,id) in enumerate(components):
        x=36+(2-k%3)*CW;y=18+(2-(k%9)//3)*CH
        if typ=='equipment':
            n=k-78;x=36+(2-n%3)*180;y=774-(n//3+1)*126
        b.saveState();b.translate(x,y)
        if typ=='equipment':b.scale(1,.5)
        base(b)
        for offset in (10,15):b.setStrokeColor(LINE);b.setLineWidth(.4);b.rect(offset,offset,CW-2*offset,CH-2*offset)
        icon(b,'stone' if typ=='objective' else 'draw',68,137,44)
        center(b,'BATTLESCRAP',90,113,13,'Bold');center(b,{'battle':'BATTLE DECK','objective':'OBJECTIVE','hero':'HERO','recruit':'RECRUITS','equipment':'EQUIPMENT'}[typ],90,94,9)
        b.restoreState();b.setStrokeColor(LINE);b.rect(x,y,CW,126 if typ=='equipment' else CH,fill=0,stroke=1)
        if (typ!='equipment' and (k%9==8 or k==77)) or k==len(components)-1:b.showPage()
    b.save()
    f=PdfReader(OUT/'01-cards.pdf');back=PdfReader(OUT/'optional-card-backs.pdf');w=PdfWriter()
    for a,b in zip(f.pages,back.pages):w.add_page(a);w.add_page(b)
    w.write(OUT/'optional-cards-duplex.pdf')

def standee_face(c,h,mirror=False):
    # bottom 18pt (0.25in) remains completely blank, including guides.
    c.setFillColor(white);c.rect(0,0,72,144,stroke=0,fill=1)
    if isinstance(h,dict):
        art(c,h['id'],3,38,66,99,mirror=mirror)
        a,b=h['name'].split(' ',1);center(c,a,36,30,7.2,'Bold');center(c,b,36,21,7.2,'Bold')
    else:
        icon(c,'soldier',13,59,46);center(c,h.split('|')[0],36,32,7.2,'Bold');center(c,h.split('|')[1],36,22,7.2,'Bold')
def make_standees():
    c=canvas.Canvas(str(OUT/'02-folding-standees.pdf'),pagesize=(PW,PH))
    entries=heroes+[f'{side}|Recruit {n}' for side in ('Concord','Wildmoon') for n in range(1,4)]
    for k,h in enumerate(entries):
        x=18+(k%8)*72;y=99+(1-k//8)*288
        c.saveState();c.translate(x,y);standee_face(c,h)
        c.translate(72,288);c.rotate(180);standee_face(c,h,True);c.restoreState()
        c.setStrokeColor(LINE);c.setLineWidth(.3);c.rect(x,y,72,288,fill=0,stroke=1)
        c.setDash(2,2);c.line(x,y+144,x+72,y+144);c.setDash()
    center(c,'Cut solid rectangles. Fold dashed centers; glue backs together. Finished height: 2 in.',306,65,9)
    center(c,'Bottom ¼ in on each face stays blank for insertion into a standee base.',306,50,9)
    c.save()
    manifest['standees']={'heroes':10,'recruits':6,'unfolded_inches':[1,4],'fold':'head-to-head; rear art horizontally mirrored; text readable'}

def make_tokens():
    c=canvas.Canvas(str(OUT/'03-tokens-and-elements.pdf'),pagesize=(PW,PH))
    size=18*72/25.4
    for row,(key,name,bg) in enumerate([('boost','Boosted','#eaf3e6'),('daze','Dazed','#fff0d9'),('stunned','Stunned','#f0e7f5')]):
        y=774-(row+1)*size
        for col in range(5):
            x=18+col*size
            c.setFillColor(HexColor(bg));c.rect(x,y,size,size,fill=1,stroke=0)
            icon(c,key,x+14,y+19,23);center(c,name,x+size/2,y+7,7.2,'Bold')
            c.setStrokeColor(LINE);c.setLineWidth(.3);c.rect(x,y,size,size,fill=0,stroke=1)
    for k,suit in enumerate(('Fire','Lightning','Water')):
        for j in range(4):
            x=18+(k*4+j)*CM;y=774-3*size-CM
            c.setStrokeColor(LINE);c.rect(x,y,CM,CM,fill=0,stroke=1);icon(c,suit,x+3,y+3,CM-6)
    c.save()
    manifest['tokens']={'Boosted':5,'Dazed':5,'Stunned':5,'Fire_1cm':4,'Lightning_1cm':4,'Water_1cm':4}

def make_map():
    # Two portrait Letter sheets, joined at vertical center; original ratio retained.
    im=Image.open(GAME/'public/scenario-1.png');w,h=im.size
    full_h=774;full_w=full_h*w/h;half=full_w/2
    c=canvas.Canvas(str(OUT/'04-map-two-sheets.pdf'),pagesize=(PW,PH))
    for page in range(2):
        x=(PW-half)/2;y=9
        c.saveState();p=c.beginPath();p.rect(x,y,half,full_h);c.clipPath(p,stroke=0,fill=0)
        data=io.BytesIO();im.convert('RGB').save(data,format='JPEG',quality=97,subsampling=0);data.seek(0)
        c.drawImage(ImageReader(data),x-page*half,y,full_w,full_h);c.restoreState()
        c.setStrokeColor(LINE);c.setLineWidth(.25);c.rect(x,y,half,full_h,stroke=1,fill=0)
        c.showPage()
    c.save();manifest['map']={'pages':2,'source_pixels':[w,h],'assembled_inches':[round(full_w/72,4),10.75],'margin_top_bottom_inches':.125,'no_crop':True,'join':'left then right; trim to image boundary and butt-join'}

def make_queue():
    c=canvas.Canvas(str(OUT/'05-action-queue.pdf'),pagesize=(PW,PH))
    rail=.75*CM
    sequence=[(0,0,False),(1,1,False),(2,2,False),(3,2,True),(4,3,False),(5,3,True),(6,4,False),(7,4,True)]
    # Three adjoining cards per sheet; left-to-right order across three segments.
    for page in range(3):
        entries=sequence[page*3:page*3+3]
        x0=18;y=PH-18-CH-rail
        for col,(idx,ap,draw) in enumerate(entries):
            x=x0+col*CW
            c.setFillColor(white);c.rect(x,y,CW,CH+rail,fill=1,stroke=0)
            c.setStrokeColor(LINE);c.setLineWidth(.4);c.rect(x,y,CW,CH,fill=0,stroke=1)
            center(c,str(ap)+' AP',x+CW/2-(10 if draw else 0),y+CH+7,11,'Bold')
            if draw:icon(c,'draw',x+CW/2+15,y+CH+4,14)
            center(c,'CARD '+str(idx+1),x+CW/2,y+CH/2,11,'Bold',LINE)
            if idx==0:center(c,'ACTIVE',x+CW/2,y+CH/2-17,8,'Regular',LINE)
            c.setStrokeColor(LINE);c.rect(x,y,CW,CH+rail,fill=0,stroke=1)
        c.showPage()
    c.save();manifest['queue']={'pages':3,'card_slots':8,'slot_points':[180,252],'header_points':rail,'left_to_right':['0','1','2','2 + draw','3','3 + draw','4','4 + draw'],'assembled_inches':[20,(CH+rail)/72]}

def make_guide():
    c=canvas.Canvas(str(OUT/'00-print-and-play-guide.pdf'),pagesize=(PW,PH))
    label(c,'BATTLESCRAP',36,750,23,'Bold');label(c,'PRINT & PLAY · 20 OCTOBER 2026',36,729,10)
    sections=[('PRINT AT 100% / ACTUAL SIZE','US Letter throughout. Do not use Fit or Shrink. Cards are 2½ × 3½ in and touch at the cut lines. The single-sided kit has 19 pages. For opaque sleeves, use the front-only cards. Optional duplex cards contain matching backs: print portrait, flip on the long edge. Test the first pair of pages before printing the full deck.'),
    ('CUT & ASSEMBLE','Standees: cut each 1 × 4 in rectangle; fold at the dashed center, art outward, and glue. Each face is 2 in high, with a blank ¼ in insertion area. Names read correctly on both sides; rear artwork is mirrored. Six recruit standees use a simple soldier symbol.'),
    ('MAP & QUEUE','Map: print both sheets, trim to the artwork, and butt-join left to right. The complete map is about 14.33 × 10.75 in with no map content cropped. Queue: trim each segment to its outer boundary and join pages 1 → 2 → 3 left to right. It is 20 in wide with eight exact-size card spaces and a 0.75 cm header. AP and any Battle draw icon appear together above each card.'),
    ('COMPONENTS','86 cards: 10 heroes, 2 recruit groups, 36 tactics (18 per player), 20 linked abilities, 10 shared objectives and 8 equipment cards (one set per player). 16 folding standees. Five each of Boosted, Dazed and Stunned; four 1 cm labels per element. The token sheet is packed near the top with no headings or additional markers.'),
    ('BUILD THE DECKS','Each player takes 18 tactics: 2 Press the Attack and 2 Stand Firm in each suit; 2 Fire Twist the Blade; 2 Water Riposte; 1 Lightning Shake It Off; 1 Lightning Wrong Foot. Add the two linked ability cards for each of your three selected heroes: 24 cards total. Keep unused heroes’ abilities out. Shuffle the 10 objectives into one shared deck. Equipment cards measure 2½ × 1¾ in, landscape. Equipment and activation cards never enter the Battle decks.'),
    ('ICON KEY','Move arrows • sword = Attack (melee) • bow/sword = ranged Attack / printed range • shield = Defense • heart = wound • overlapping cards = draw one Battle card. All heroes have 3 HP; recruits have 2. The stat row uses whole-number PP costs. Elements are assigned to holders, not permanently to heroes.')]
    top=695
    for head,body in sections:
        label(c,head,36,top,11,'Bold');used=para(c,escape(body),36,top-10,540,100,10);top-=used+32
    line(c,36,38,108,38,INK,.7);label(c,'1 inch scale check',116,35,8)
    c.showPage()
    label(c,'TABLE REFERENCE',36,750,21,'Bold')
    sections=[('SETUP','Each side has 20 PP (21 after a loss), fields three distinct heroes plus three free recruits, and assigns Fire, Lightning and Water to its heroes. Hero HP 3; recruit Move 2, Attack 1, Defense 1, HP 2. Prepare purchases before drawing. Start with two Battle cards and one hidden objective; hand limits are 8 Battle cards and 2 objectives. Alternate side ownership along the queue, then shuffle each side’s four activation cards only into its assigned positions.'),
    ('ACTIVATE','Score the scenario at turn start. Select a friendly card above 0 AP; record its AP and draw entitlement, move it to the bottom, and shift intervening cards. Hero Move 1 AP; basic Attack 2 AP. Recruit Move or Attack 1 AP per model; each individual action at most once per model per activation. Push 1 AP; Remove all Dazed 2 AP; respawn 2 AP. Paid core abilities: once per activation. A matching-suit tactic or linked ability may instead be discarded for +1 AP, outside combat; recruits cannot do this.'),
    ('COMBAT','Roll opposed Attack and Defense D6 pools. Compare the highest face; when both highest faces are 6, compare counts of 6. Attacker wins remaining ties. Hit: 1 wound; two more attacking sixes: 2 wounds total. Two more defending sixes: gain 1 Boosted. Before rolling, defender and attacker alternate card/pass until two consecutive passes. Heavy attack: halve final Attack (round up); hit +1 wound, miss gain 1 Dazed. Attacker may reroll own dice for 1 banked bid PP each.'),
    ('STATUSES','Boosted adds one die per token; Dazed removes one die per token, minimum final pool 1. After combat, consume one old token of each type from each participant; newly gained tokens remain. Stunned allows only movement and movement-only effects during the next activation, then expires; passive defense and defensive reactions remain legal. Haste/Slow immediately shift the queue one place and do not alter captured AP.'),
    ('END & REWARDS','Resolve physical pickups and draws; then at most one eligible objective; then the captured queue draw; clear expiring Stunned and unused AP. Only heroes collect Brightstone: secure it and draw BOTH an objective and a Battle card. Objectives become eligible at your next activation’s start, then award 3 RP + one Battle card on claim. Hero death draws one Battle card for its owner and moves its queue card to bottom; all deaths drop a physical Brightstone.'),
    ('THREE FIRES','At turn start, north gains 1 VP unless south occupies at least two bonfires. South gains 1 VP if it occupies at least two. Enemy defeats give the killer’s side 1 VP. First to 8 VP wins immediately. Blue/north and stone/south are deployment zones; X marks initial Brightstones. Printed terrain has no movement penalty. The full current Design Draft contains setup bidding, targeting, terrain, campaign and card timing details.')]
    top=713
    for head,body in sections:
        label(c,head,36,top,11,'Bold');used=para(c,escape(body),36,top-10,540,102,10);top-=used+28
    c.save()

def validate_and_preview():
    outputs={}
    for path in sorted(OUT.glob('*.pdf')):
        doc=PdfReader(path)
        for pg in doc.pages:assert tuple(float(v) for v in pg.mediabox[2:])==(612,792),path
        outputs[path.name]=len(doc.pages)
    assert outputs['01-cards.pdf']==10 and outputs['02-folding-standees.pdf']==1
    assert outputs['04-map-two-sheets.pdf']==2 and outputs['05-action-queue.pdf']==3
    for name in ['00-print-and-play-guide','01-cards','02-folding-standees','03-tokens-and-elements','04-map-two-sheets','05-action-queue']:
        doc=pdfium.PdfDocument(str(OUT/(name+'.pdf')))
        thumbs=[]
        for i in range(len(doc)):
            im=doc[i].render(scale=1.5).to_pil().convert('RGB');im.save(PRE/f'{name}-{i+1:02}.png')
            im.thumbnail((306,396));thumbs.append(im)
        contact=Image.new('RGB',(306*min(3,len(thumbs)),418*math.ceil(len(thumbs)/3)),'#d9d9d9')
        for i,im in enumerate(thumbs):contact.paste(im,((i%3)*306,(i//3)*418))
        contact.save(PRE/(name+'-contact.png'))
    manifest['pdf_pages']=outputs
    manifest['sources']={str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in [GAME/'src/content.ts',GAME/'sources/design-draft-current.txt',GAME/'public/scenario-1.png',*arts.values()]}
    (ROOT/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
    print(json.dumps(outputs,indent=2));print('Text boxes passed:',len(manifest['text_checks']))

if __name__=='__main__':
    make_cards();make_standees();make_tokens();make_map();make_queue();make_guide()
    combined=PdfWriter()
    for name in ['00-print-and-play-guide.pdf','01-cards.pdf','02-folding-standees.pdf','03-tokens-and-elements.pdf','04-map-two-sheets.pdf','05-action-queue.pdf']:
        r=PdfReader(OUT/name)
        for pg in r.pages:combined.add_page(pg)
    combined.write(OUT/'Battlescrap-print-and-play.pdf')
    validate_and_preview()

