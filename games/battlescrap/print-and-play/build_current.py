"""Current starter playtest kit. Uses legacy drawing helpers, not legacy rules."""
import build as b
from pathlib import Path
import json
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, white
from reportlab.lib.utils import ImageReader
from pypdf import PdfReader, PdfWriter
import pypdfium2 as pdfium

ROOT=Path(__file__).resolve().parent
ASSETS=ROOT.parent/'assets'
OUT=ROOT/'current'; OUT.mkdir(exist_ok=True)
b.OUT=OUT
PW,PH=612,792
ROSTER=[
('h01','Kalawi Bloodmane','Windlands','STRIKER / Scout',3,5,5,1,2,5,'Lightning + 1 AP: move up to 2, then make a melee attack. If another ally is adjacent to the target, add +2 Attack dice.'),
('h11','Hester Wellward','Wellington','GUARD / Support',5,3,3,1,6,6,'Water: gain 2 Fortified.'),
('h03','Voru Cinderveil','Cinder’s Rim','CONTROLLER / Striker',2,4,4,3,2,4,'Fire: gain 1 Enraged, then Pull an enemy within 3 up to 1.'),
('h04','Tavi Sailwhistle','Port Windlass','SCOUT / Support',2,6,2,2,2,3,'Lightning + 1 AP: attack an enemy exactly 2 spaces away, then move up to 2.'),
('h13','Demea Lastbanner','Phalexia','SUPPORT / Guard',4,3,2,1,2,4,'Water: Pull any two other allies up to 2 spaces each toward Demea.'),
('h06','Niala Grassveil','Windlands','CONTROLLER / Support',3,5,2,2,2,3,'Lightning: move another ally within 3 up to 2, then give one enemy adjacent to that ally 1 Dazed.'),
('h12','Perrin Lastdrop','Wellington','SUPPORT / Guard',4,3,2,1,3,4,'Fire: gain 2 Enraged. While Perrin has Enraged, other adjacent allies gain +1 Attack die.'),
('h08','Ketu Ashheart','Cinder’s Rim','STRIKER / Controller',3,4,6,2,1,7,'Fire: gain 2 Enraged and 1 Dazed.'),
('h14','Ilex Marchstep','Phalexia','SCOUT / Guard',3,5,3,1,2,4,'Lightning: move an adjacent ally up to 3, then move Ilex up to 3.'),
('h10','Orro Stormanchor','Port Windlass','GUARD / Controller',4,3,2,2,7,6,'Water: Push up to two adjacent enemies 1 space each.')]
heroes=[dict(zip(['id','name','region','role','hp','move','attack','range','defense','cost','text'],h)) for h in ROSTER]
b.heroes=heroes
b.arts={h['id']:next(ASSETS.glob('heroes/*/'+h['id']+'-*.png')) for h in heroes}
FILES=[]
QUEUE=[(1,0),(1,1),(2,1),(2,2),(3,2),(4,3)]
b.COLORS.update(attack='#c83135',bow='#2b863f',defense='#2878c2')
_original_icon=b.icon
def current_icon(c,name,x,y,size,color=None):
    if name!='heart':return _original_icon(c,name,x,y,size,color)
    c.saveState();c.translate(x,y);c.scale(size/24,size/24)
    p=c.beginPath();p.moveTo(12,2);p.curveTo(-8,16,6,28,12,18);p.curveTo(18,28,32,16,12,2)
    c.setFillColor(HexColor(b.COLORS['heart']));c.setStrokeColor(white)
    c.setLineWidth(3*24/size);c.drawPath(p,fill=1,stroke=1);c.restoreState()
b.icon=current_icon
def current_stats(c,h,y=58):
    values=[('move',str(h['move']),10),('bow' if h['range']>1 else 'attack',str(h['attack'])+(f" ({h['range']})" if h['range']>1 else ''),61),('defense',str(h['defense']),130)]
    for key,val,x in values:b.icon(c,key,x,y,14);b.label(c,val,x+18,y+2,10,'Bold')
b.stats=current_stats

def pdf(name):
    FILES.append(name);return canvas.Canvas(str(OUT/name),pagesize=(PW,PH))
def grid(name,items,draw,w=180,h=252,cols=3,rows=3):
    c=pdf(name)
    for i,item in enumerate(items):
        x=(PW-cols*w)/2+(i%cols)*w;y=PH-18-((i//cols)%rows+1)*h
        c.saveState();c.translate(x,y);draw(c,item);c.setStrokeColor(b.LINE);c.setLineWidth(.3);c.rect(0,0,w,h);c.restoreState()
        if i%(cols*rows)==cols*rows-1 or i==len(items)-1:c.showPage()
    c.save()
def hero(c,h):
    b.art(c,h['id'],0,132,180,120,portrait=True)
    for i in range(h['hp']):b.icon(c,'heart',160,230-i*18,14)
    b.para(c,h['name'],8,125,164,32,12,True)
    b.label(c,h['region'],8,88,8);b.label(c,str(h['cost'])+' PP',142,88,9,'Bold')
    b.stats(c,h,65)
    if h['id'] in ('h04','h10'):b.label(c,'EXACTLY 2',115,52,6.5,'Bold')
    b.para(c,h['role'],8,58,164,15,7)
    b.para(c,h['text'],8,43,164,42,8)
def portrait(c,h):
    b.art(c,h['id'],0,14,126,166,portrait=True)
    b.center(c,h['name'],63,4,8,'Bold')
def tactic(c,item):
    element,bonus=item;b.icon(c,element,56,120,68)
    b.center(c,element.upper(),90,105,12,'Bold')
    b.center(c,'+2',70,25,24,'Bold');b.icon(c,bonus,101,23,25)
def objective(c,item):
    name,text,vp=item;b.center(c,'TACTICAL OBJECTIVE',90,229,9,'Bold')
    b.para(c,name,12,195,156,45,16,True);b.para(c,text,12,135,156,95,11)
    b.center(c,str(vp)+' VP + 1 tactic',90,20,12,'Bold')
def recruit(c,side):
    key='concord' if side=='Concord' else 'wildmoon'
    c.drawImage(str(ASSETS/'factions'/f'{key}.png'),35,112,105,105,mask='auto',preserveAspectRatio=True)
    b.center(c,side+' RECRUITS',90,90,12,'Bold')
    for i in range(2):b.icon(c,'heart',160,230-i*18,14)
    b.stats(c,dict(move=2,attack=1,range=1,defense=1),65)
def rules():
    c=pdf('00-rules-and-legend.pdf');b.label(c,'BATTLESCRAP · THREE FIRES',24,763,18,'Bold')
    sections=[
    ('SETUP','15 PP; choose exactly 3 heroes from your five and take 3 free recruits. Concord: Kalawi, Hester, Voru, Tavi, Demea. Wildmoon: Niala, Perrin, Ketu, Ilex, Orro. Secretly choose north/south and bid PP. If choices match, higher bid wins choice and first turn; opponent gains the bid as PP. Tied bids increase secretly. Different choices: random first player. North deploys in blue hexes; south in stone hexes. No partial-hex deployment or respawn. Shuffle 4 traps and 5 Brightstone face down onto the 9 Xs, then reveal. Each side: 24 tactics, draw 4 (limit 8); draw 1 objective (limit 2).'),
    ('ACTIVATE','Start-turn scoring first. Choose any friendly hero, including slot 0; take that slot’s AP/RAP, move its portrait to slot 0 and shift intervening portraits. Resolve poison on heroes newly reaching slot 5 and on the active hero. Spend AP on that hero or friendly recruits; RAP only on recruits. Each hero action separately costs 1/2/3… AP per use: Move, Attack, Grab, Respawn. Each recruit instead has ONE shared increasing cost across all actions. Unspent points expire.'),
    ('ABILITIES & MOVEMENT','Discard the printed matching element to use an ability during that hero’s activation; pay printed AP too. Card-only abilities stay card-only on repeats; paid abilities increase AP by 1 per repeat. Move up to Move; do not cross occupied or impassable hexes. Push steps increase distance from source; Pull steps decrease it. Stop when blocked. Any movement into a trap: 1 damage, remove trap. Any movement into fire, or ending a unit’s activation there: 1 damage. Nothing blocks line of sight.'),
    ('COMBAT','Roll Attack versus Defense D6s. Highest die wins; if both show 6 compare number of sixes; remaining ties favor attacker. Hit: 1 damage; two extra attacker sixes: +1 damage. Two extra defender sixes: gain 1 Fortified after cleanup. Final pool minimum 0: at 0 roll two dice and keep only the lower. Before rolling, alternate tactic/pass until both pass. Discard for printed +2 Attack/Defense OR +1 Attack/Defense/damage. Any element; cards stack. Damage bonuses require a hit.'),
    ('RANGE & FLANKING','Melee: +1 Attack per OTHER ally adjacent to target with no other adjacent enemy. Ranged: no flanking; -1 Attack if engaged; ordinary extended range up to double at -1 Attack. EXACTLY 2 means distance 2 only. Heavy attack: halve Attack dice, round up; +1 damage on hit, gain 1 Dazed on miss. Only unused bid compensation funds attacker rerolls: 1 PP per die.'),
    ('DAMAGE & STATUS','Red cube = 1 damage; damage reaching HP defeats. Hero defeat: owner draws 1 tactic; drop 1 Brightstone; move portrait to slot 0. Recruits do neither reward. Respawn returns one model fully healed/status-free in deployment zone. Enraged: +1 hit damage per token on next attack; spend ALL even on miss. Fortified: +1 Defense per token; Dazed: -1 Defense per token; spend BOTH entire stacks after defense. Newly gained tokens survive cleanup.'),
    ('POISON','Each application adds Poison and swaps the hero one queue slot toward 0, stopping there. Poison deals damage per token at activation start and each new arrival at slot 5; tokens remain. Poison immediately defeats recruits. Healing a poisoned unit removes ALL poison instead of healing any damage.'),
    ('REWARDS & WINNING','Grab collects a stone under the unit; friendly units also collect at turn end. Each stone: draw 1 tactic; 2 RP after battle. Control fire by having MORE adjacent units than opponent; tie = neither. North scores 1 VP at turn start unless south controls 2 fires; south scores 1 if it controls 2. Enemy defeat: 1 VP. First to 8 VP wins immediately. At turn end claim at most 1 eligible objective, gaining 1 VP + 1 tactic; then draw an objective if none held. New objectives become eligible next own turn. Objective deck never refills; tactics reshuffle discards.'),
    ('TOKEN / ICON LEGEND','Heart: HP. Arrow: Move. Red sword: Attack. Green bow: ranged Attack. Blue shield: Defense. Attack 4 (3) means 4 dice, range 3. Flame / drop / bolt: Fire / Water / Lightning payment. Star = Enraged; shield = Fortified; minus = Dazed; P = Poison. Crystal = Brightstone; T = trap. Maroon sun = Concord; blue antler-moon = Wildmoon. Ownership holders have NO elements. Starter heroes have no regional ability.')]
    x=24;y=735
    for i,(title,body) in enumerate(sections):
        if i==4:x=318;y=735
        b.label(c,title,x,y,10,'Bold');y-=9
        used=b.para(c,body,x,y,270,700,10);y-=used+20
    x=24;y=200
    b.label(c,'QUEUE SETUP & PREPARATION',x,y,10,'Bold')
    b.para(c,'Low bidder takes highest slot 5, then alternate owners down: low 5/3/1, high 4/2/0. Randomly deal each side’s three portraits into its slots. Equal bids with different zones: second player takes slot 5. Buy before drawing: extra recruit 3 PP; group Boots 2 (+1 Move), Shields 3 (+1 Defense), Weapons 3 (+1 Attack), each once; extra starting tactic 1 PP (hand limit 8). One equipment per hero and one copy per army; retained on respawn. Ordinary unspent PP expires; only unused bid compensation remains for rerolls. If deployment is full, use a nearest reachable empty FULL hex. Ability-granted recruit Moves count toward that recruit’s action count; Pull/Push do not.',x,y-10,270,130,8.4)
    for i,(key,name) in enumerate([('heart','HP'),('move','Move'),('attack','Attack'),('bow','Ranged'),('defense','Defense'),('Fire','Fire'),('Water','Water'),('Lightning','Lightning')]):
        b.icon(c,key,28+i*70,35,20);b.label(c,name,22+i*70,20,8)
    c.save()
def tokens():
    c=pdf('04-tokens.pdf');entries=[]
    for name,symbol,color in [('Enraged','boost','#ed9c75'),('Fortified','defense','#89bde3'),('Dazed','daze','#e8ce65'),('Poison','P','#b5ce7c')]:entries += [(name,symbol,color)]*10
    entries += [('Trap','T','#ddd4c2')]*4+[('Brightstone','stone','#ddd4c2')]*5+[('Brightstone','stone','#b4dcd7')]*12
    entries += [('Concord VP','C','#d9a6b2'),('Wildmoon VP','W','#aad8f2')]+[('', '?','#ddd4c2')]*9
    for i,(name,symbol,color) in enumerate(entries):
        x=24+i%10*50;y=724-i//10*50;c.setFillColor(HexColor(color));c.rect(x,y,50,50,fill=1,stroke=1)
        if symbol in ('P','T','C','W','?'):b.center(c,symbol,x+25,y+20,20,'Bold')
        else:b.icon(c,symbol,x+14,y+17,22)
        b.center(c,name,x+25,y+5,6.5,'Bold')
    for i in range(9):b.center(c,str(i),45+i*55,310,16,'Bold')
    c.save()
def holders():
    c=pdf('05-ownership-holders.pdf')
    for i in range(6):
        side='concord' if i<3 else 'wildmoon';x=36+(i%3)*180;y=510-(i//3)*252
        c.setFillColor(HexColor('#75263e' if i<3 else '#77bfe8'));c.rect(x,y,166,225,fill=1,stroke=0)
        c.setFillColor(white);c.rect(x+20,y+12,126,180,fill=1,stroke=0)
        c.drawImage(str(ASSETS/'factions'/f'{side}.png'),x+67,y+195,30,26,mask='auto',preserveAspectRatio=True)
        c.setStrokeColor(b.LINE);c.rect(x,y,166,225)
    c.save()
def queue():
    c=pdf('06-action-queue.pdf')
    # Two cuttable header strips, joined end to end above the ownership holders.
    for strip in range(2):
        y=700-strip*100
        c.setStrokeColor(b.LINE);c.rect(36,y,498,54)
        for col in range(3):
            idx=strip*3+col;ap,rap=QUEUE[idx];x=36+col*166
            if col:c.line(x,y,x,y+54)
            b.center(c,f'{ap} AP'+(f' + {rap} RAP' if rap else ''),x+83,y+28,12,'Bold')
            b.center(c,str(idx),x+83,y+12,8)
            # Downward pointer only; no card-sized box beneath the header.
            b.poly(c,[(x+79,y+6),(x+87,y+6),(x+83,y+1)])
    c.save()
def standees():
    c=pdf('02-folding-standees.pdf')
    for k,h in enumerate(heroes):
        x=81+(k%5)*90;y=36+(1-k//5)*360
        c.saveState();c.translate(x,y);c.scale(1.25,1.25);b.standee_face(c,h)
        c.translate(72,288);c.rotate(180);b.standee_face(c,h,True);c.restoreState()
        c.setStrokeColor(b.LINE);c.setLineWidth(.3);c.rect(x,y,90,360)
        c.setDash(2,2);c.line(x,y+180,x+90,y+180);c.setDash()
    c.save()
def main():
    rules();grid('01-tableau-cards.pdf',heroes,hero)
    grid('02-portrait-cards.pdf',heroes,portrait,126,180,4,4)
    tactics=[(e,k) for side in range(2) for e in ('Fire','Water','Lightning') for k in ('attack','defense') for n in range(4)]
    grid('03-tactics.pdf',tactics,tactic)
    names=[('Draw Blood','Hit an enemy with an attack.',1),('Stand Fast','Block an enemy attack.',1),('Hero Hunter','Defeat an enemy hero with an attack.',1),('Break the Rank','Defeat two distinct enemy recruits with attacks.',1),('Cut Down','Defeat an enemy recruit with an attack.',1),('Press the Advantage','The same hero hits twice in one activation.',1),('Against the Odds','Block an attack whose final Attack pool exceeds your Defense pool.',1),('Crushing Blow','Deal at least 2 actual damage in one attack.',1),('Hold Together','Two distinct friendly defenders each block an attack.',1),('Trade Blows','The same surviving hero hits and blocks an attack.',1)]
    grid('07-objectives.pdf',[(name,text,1) for name,text,_ in names[:9]],objective)
    grid('08-recruit-reference.pdf',['Concord','Wildmoon'],recruit)
    for e in b.gear:
        e['text']=e['text'].replace(' Cannot equip Orro.','')
        if e['name']=='Sighting Lens':e['text']='+1 ordinary printed ranged range; not EXACTLY-range attacks.'
    upgrades=[dict(name='Recruit '+n,cost=cost,icon=icon,text=txt) for n,cost,icon,txt in [('Boots',2,'move','All friendly recruits gain +1 Move.'),('Shields',3,'defense','All friendly recruits gain +1 Defense.'),('Weapons',3,'attack','All friendly recruits gain +1 Attack.')]]
    grid('09-equipment.pdf',b.gear*2+upgrades*2,b.equipment_card,180,126,3,6)
    tokens();holders();queue();standees()
    # Source map is printed unchanged, preserving its original aspect ratio.
    im=b.Image.open(ASSETS/'maps/three-fires-original.png');w,h=im.size;fh=750;fw=fh*w/h
    c=pdf('10-map.pdf')
    for i in range(2):
        x=(612-fw/2)/2;c.saveState();p=c.beginPath();p.rect(x,21,fw/2,fh);c.clipPath(p,stroke=0,fill=0);c.drawImage(ImageReader(im),x-i*fw/2,21,fw,fh);c.restoreState();c.showPage()
    c.save()
    allpdf=PdfWriter()
    for file in FILES:
        r=PdfReader(OUT/file)
        for page in r.pages:allpdf.add_page(page)
    allpdf.write(OUT/'Battlescrap-print-and-play.pdf')
    (OUT/'manifest.json').write_text(json.dumps({'heroes':heroes,'files':FILES,'objective_deck':'nine distinct objectives; all reward 1 VP + 1 tactic; no refill','queue_ap_rap':QUEUE,'range_notation':'Attack dice (range)','heart_stroke_pt':3,'standee_folded_inches':[1.25,2.5],'balance':'TEST stats and prices; four Cinder/Windlass choices confirmed; new heroes selected; Windlands recommended defaults retained'},indent=2),encoding='utf8')
    doc=pdfium.PdfDocument(str(OUT/'Battlescrap-print-and-play.pdf'))
    for i in range(len(doc)):doc[i].render(scale=1).to_pil().save(OUT/f'preview-{i+1:02}.png')
    print('Built',len(doc),'pages; all text boxes fit.')
if __name__=='__main__':main()


