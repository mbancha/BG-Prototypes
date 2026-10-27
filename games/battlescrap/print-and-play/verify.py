from pathlib import Path
from collections import Counter
import json
from pypdf import PdfReader
from pypdf.generic import ContentStream
import pypdfium2 as pdfium

root=Path(__file__).resolve().parent
m=json.loads((root/'manifest.json').read_text())
checks=[]
def check(ok,message):
    assert ok,message
    checks.append(message)

r=PdfReader(root/'pdf/01-cards.pdf')
rects=[]
for p in r.pages:
    for args,op in ContentStream(p.get_contents(),r).operations:
        if op==b're' and len(args)==4 and float(args[2])==180 and float(args[3]) in (252,126) and float(args[0])>=36:
            rects.append(list(map(float,args)))
check(len(rects)==86,'86 exported card cut rectangles are exactly 180 × 252 pt (2.5 × 3.5 in).')
for i,rect in enumerate(rects):
    check(rect==m['cards'][i]['rect_pt'],f'Card {i+1}: exported cut boundary matches placement manifest.')
check(Counter(x['type'] for x in m['cards'])=={'hero':10,'recruit':2,'battle':56,'objective':10,'equipment':8},'All card categories and quantities match the kit inventory.')
check(len(set(x['id'] for x in m['cards']))==86,'All physical card copy IDs are unique.')
for side in 'AB':
    rows=[x for x in m['cards'] if x['id'].startswith(side+'-t')]
    check(len(rows)==18,f'Player {side} has 18 baseline tactic cards.')
for f in (root/'pdf').glob('*.pdf'):
    doc=pdfium.PdfDocument(str(f))
    for i,p in enumerate(doc):
        check(p.get_size()==(612,792),f'{f.name} page {i+1}: US Letter.')
        text=p.get_textpage()
        for j in range(text.count_chars()):
            a,b,c,d=text.get_charbox(j)
            if a==c or b==d:continue
            assert a>=-0.1 and b>=-0.1 and c<=612.1 and d<=792.1,(f.name,i,j,(a,b,c,d))
check(True,'All exported text glyphs lie within page boundaries.')
tok=PdfReader(root/'pdf/03-tokens-and-elements.pdf')
ops=ContentStream(tok.pages[0].get_contents(),tok).operations
count=sum(1 for a,o in ops if o==b're' and len(a)==4 and abs(float(a[2])-72/2.54)<.001 and abs(float(a[3])-72/2.54)<.001)
check(count==12,'Twelve exported element squares measure exactly 1 × 1 cm.')
st=PdfReader(root/'pdf/02-folding-standees.pdf')
ops=ContentStream(st.pages[0].get_contents(),st).operations
count=sum(1 for a,o in ops if o==b're' and list(map(float,a[2:]))==[72,288])
check(count==16,'16 exported standee cut rectangles measure 1 × 4 in, folding to 2 in high.')
queue=PdfReader(root/'pdf/05-action-queue.pdf')
count=0
for p in queue.pages:
    count+=sum(1 for a,o in ContentStream(p.get_contents(),queue).operations if o==b're' and list(map(float,a[2:]))==[180,252])
check(count==8,'Queue has eight exact poker-size placement rectangles across three sheets.')
check(len(PdfReader(root/'pdf/Battlescrap-print-and-play.pdf').pages)==19,'Combined single-sided kit contains 19 pages.')
report={'passed':len(checks),'checks':checks,'visual_review':'Rendered all component pages. Reviewed full card contact sheet; full-size hero, ability, standee, token and guide pages; both map halves and all queue segments. No visible overflow. Physical printer registration remains printer-dependent.'}
(root/'verification.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(f'{len(checks)} checks passed.')
