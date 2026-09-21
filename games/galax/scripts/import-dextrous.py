"""Import authored Dextrous/TTS faces and a bounded Sheets values snapshot.
Requires Python 3.10+ and Pillow. Never evaluates Lua or other export scripts.
python scripts/import-dextrous.py --tts export.json --sheet cards-sheet.json
"""
import argparse, hashlib, json, re, urllib.request
from pathlib import Path
from PIL import Image
parser=argparse.ArgumentParser()
parser.add_argument('--tts',required=True,type=Path)
parser.add_argument('--sheet',required=True,type=Path)
parser.add_argument('--sheets',type=Path,help='Optional predownloaded sheet-N.png and back-N.png directory')
args=parser.parse_args()
root=Path(__file__).resolve().parents[1]
out=root/'public/cards';out.mkdir(parents=True,exist_ok=True)
cache=root/'artifacts/import-cache';cache.mkdir(parents=True,exist_ok=True)
export=json.loads(args.tts.read_text(encoding='utf-8-sig'))
manifest={}
for di,deck in enumerate(export['ObjectStates']):
    specs=deck['CustomDeck']
    images={}
    for key,spec in specs.items():
        for face,field in [('sheet','FaceUrl'),('back','BackUrl')]:
            path=(args.sheets or cache)/f'{face}-{di}.png'
            if not args.sheets:
                url=spec[field].removeprefix('{verifycache}')
                if not url.startswith('https://'):raise ValueError('HTTPS image URL required')
                urllib.request.urlretrieve(url,path)
            images[(key,face)]=Image.open(path).convert('RGB')
        images[(key,'back')].save(out/f'back-{di}.webp',quality=93)
    for obj in deck['ContainedObjects']:
        cid=obj['CardID'];key=str(cid//100);spec=specs[key];index=cid%100
        im=images[(key,'sheet')];cols,rows=spec['NumWidth'],spec['NumHeight']
        if im.width%cols or im.height%rows or index>=cols*rows:raise ValueError('Invalid sprite geometry')
        w,h=im.width//cols,im.height//rows;x,y=index%cols*w,index//cols*h
        name=obj['Nickname']
        if not re.fullmatch(r'[catr]\d{2}',name):raise ValueError('Unexpected card ID: '+name)
        dest=out/f'{name}.webp';im.crop((x,y,x+w,y+h)).save(dest,quality=93)
        count=manifest.get(name,{}).get('copies',0)+1
        manifest[name]={'file':f'cards/{name}.webp','sheet':di,'index':index,'width':w,'height':h,'copies':count,'sha256':hashlib.sha256(dest.read_bytes()).hexdigest()}
snapshot=json.loads(args.sheet.read_text(encoding='utf-8-sig'))
rows=snapshot['values'];headers=rows[0];cards=[]
resource={'$normalPlanet':'none','$cardPlanet':'cards','$fleetPlanet':'fleet','$researchPlanet':'research'}
for row in rows[1:]:
    d=dict(zip(headers,row));id=d.get('Nickname','')
    if not re.fullmatch(r'c\d{2}',id):continue
    planets=[{'resource':resource[d[k]],'resistance':1} for k in ['planet 1','planet 2','planet 3','planet 4'] if d.get(k)]
    cards.append(dict(id=id,kind='system',color=d['color'],rank=int(d['rank']),techName=d['tech name'].lstrip('🗲∞ '),techText=d['tech'],techType=d['tech type'],name=d['system name'],planets=planets,burst=d.get('bursticon','').count('$burst'),shield=d.get('bursticon','').count('$shield')))
if len(cards)!=44 or {c['id'] for c in cards}!={f'c{i:02}' for i in range(1,45)}:raise ValueError('Expected 44 unique system IDs c01–c44')
for i in range(1,13):
    kind=['asteroid','nebula','wormhole'][(i-1)//4];color=['Blue','Green','Red','Yellow'][(i-1)%4]
    burst,shield=([(1,2),(3,0),(0,3),(2,1)][(i-1)%4] if i<=4 else (0,0))
    cards.append(dict(id=f'a{i:02}',kind=kind,color=color,rank=[2,3,5][(i-1)//4],techName='',techText='',techType='',name=kind.title()+' '+color,planets=[],burst=burst,shield=shield))
cards.append(dict(id='a13',kind='supernova',color='Blue',rank=0,name='Super Nova',planets=[],burst=0,shield=0,techName='',techText='',techType=''))
if any(c['id'] not in manifest for c in cards):raise ValueError('Missing face for structured card')
(root/'src/data/cards.json').write_text(json.dumps(cards,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
(root/'sources/asset-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(f'{len(cards)} gameplay cards; {len(manifest)} unique faces; {sum(v["copies"] for v in manifest.values())} exported copies')
print('Anomaly metadata is transcribed from the September 20 faces. Review it when that deck changes.')
