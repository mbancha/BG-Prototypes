from pathlib import Path
import json, hashlib
import pdfplumber
from pypdf import PdfReader
from PIL import Image, ImageDraw

OUT=Path(__file__).resolve().parent/'current'
m=json.loads((OUT/'manifest.json').read_text(encoding='utf8'))
checks=[]
def check(name,condition):
    assert condition,name
    checks.append(name)
def text(name):
    return '\n'.join(p.extract_text() or '' for p in PdfReader(OUT/name).pages)
check('19-page kit',len(PdfReader(OUT/'Battlescrap-print-and-play.pdf').pages)==19)
check('No card-back PDFs in current output',not list(OUT.glob('*backs.pdf')))
check('No recruit standee PDFs',not (OUT/'14-reserve-recruits.pdf').exists())
check('48 generic tactics',text('03-tactics.pdf').count('+2')==48)
check('One objective sheet',len(PdfReader(OUT/'07-objectives.pdf').pages)==1)
obj=text('07-objectives.pdf')
check('Exactly nine one-VP/tactic objectives',obj.count('1 VP + 1 tactic')==9 and '2 VP' not in obj and 'Trade Blows' not in obj)
check('One item sheet',len(PdfReader(OUT/'09-equipment.pdf').pages)==1)
with pdfplumber.open(OUT/'09-equipment.pdf') as d:
    check('14 item cards including upgrades',len([r for r in d.pages[0].rects if r['stroke'] and abs(r['width']-180)<.01 and abs(r['height']-126)<.01])==14)
rec=text('08-recruit-reference.pdf')
check('Recruit rules removed',not any(s in rec for s in ['AP','RAP','Poison','Move','Defense','defeat','Brightstone']))
check('Both faction recruit cards',all(n+' RECRUITS' in rec for n in ['Concord','Wildmoon']))
with pdfplumber.open(OUT/'08-recruit-reference.pdf') as d:
    check('Recruit faction raster symbols',len(d.pages[0].images)==2)
    check('No meeple symbol',not any(c.get('fill') and c.get('width',0)>40 and c.get('height',0)>40 for c in d.pages[0].curves))
with pdfplumber.open(OUT/'02-folding-standees.pdf') as d:
    rs=[r for r in d.pages[0].rects if abs(r['width']-90)<.01 and abs(r['height']-360)<.01]
    check('Ten 125-percent hero standees',len(rs)==10 and len(d.pages)==1)
    check('Standees touch in 5 by 2 grid',sorted(set(r['x0'] for r in rs))==[81,171,261,351,441] and len(set(r['top'] for r in rs))==2)
check('No recruit standee labels','Recruit' not in text('02-folding-standees.pdf'))
with pdfplumber.open(OUT/'04-tokens.pdf') as d:
    rs=[r for r in d.pages[0].rects if abs(r['width']-50)<.01 and abs(r['height']-50)<.01]
    check('72 touching token squares',len(rs)==72 and len({(round(r['x0']),round(r['top'])) for r in rs})==72)
    check('Token grid has no gutters',all(abs((r['x0']-24)%50)<.01 and abs((r['top']-18)%50)<.01 for r in rs))
tok=text('04-tokens.pdf')
check('Ten of each status',all(tok.count(s)==10 for s in ['Enraged','Fortified','Dazed','Poison']))
check('Four traps, seventeen stones, nine identical token backs',tok.count('Trap')==4 and tok.count('Brightstone')==17 and tok.count('?')==9)
q=m['queue_ap_rap']
check('Queue endpoints',q[0]==[1,0] and q[-1]==[4,3])
check('Every step progresses without decreasing',all(c>=a and d>=b and (c>a or d>b) for (a,b),(c,d) in zip(q,q[1:])))
check('Queue has no draws or unavailable slot',not any(w in text('06-action-queue.pdf').lower() for w in ['draw','unavailable']))
with pdfplumber.open(OUT/'06-action-queue.pdf') as d:
    check('One-page header strips only',len(d.pages)==1 and all(r['height']<=54.01 for r in d.pages[0].rects))
cards=text('01-tableau-cards.pdf')
check('Parenthesized ranges',all(v in cards for v in ['4 (3)','2 (2)','6 (2)']) and ' / 2' not in cards and ' / 3' not in cards)
with pdfplumber.open(OUT/'01-tableau-cards.pdf') as d:
    hearts=[c for p in d.pages for c in p.curves if c.get('stroking_color')==(1,1,1) and abs(c.get('linewidth',0)-3)<.01]
    check('Every HP heart has 3-point white outline',len(hearts)==sum(h['hp'] for h in m['heroes']))
check('White outer outline exceeds five pixels at 300dpi',m['heart_stroke_pt']/2*300/72>=5)
rules=text('00-rules-and-legend.pdf')
check('Bottom position selectable','including\nslot 0' in rules or 'including slot 0' in rules)
check('Low bidder owns highest position','Low bidder takes highest slot 5' in rules)
check('Rule sheet no queue draw','queue draw' not in rules.lower())
with pdfplumber.open(OUT/'Battlescrap-print-and-play.pdf') as d:
    for i,p in enumerate(d.pages):
        check(f'Page {i+1} text inside Letter page',all(-.1<=w['x0']<=w['x1']<=612.1 and -.1<=w['top']<=w['bottom']<=792.1 for w in p.extract_words()))
for group in range(4):
    out=Image.new('RGB',(918,840),'#dedede');draw=ImageDraw.Draw(out)
    for j,index in enumerate(range(group*6,min(group*6+6,19))):
        im=Image.open(OUT/f'preview-{index+1:02}.png');im.thumbnail((306,396));x=j%3*306;y=j//3*420;out.paste(im,(x,y));draw.text((x+10,y+398),str(index+1),fill='black')
    out.save(OUT/f'contact-{group+1}.png')
(OUT/'verification.json').write_text(json.dumps({'checks_passed':len(checks),'checks':checks,'balance':'Not playtest validated'},indent=2),encoding='utf8')
print(len(checks),'checks passed')

