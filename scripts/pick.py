# Usage: python3 scripts/pick.py key=index ...  (outil de sélection des candidats)
import json,sys
m=json.load(open('scripts/images.manifest.json'))
for a in sys.argv[1:]:
    k,i=a.split('=')
    c=json.load(open(f'candidates/{k}.json'))
    m[k]['pick']=c[int(i)]['title']; print(k, '->', m[k]['pick'], '|', c[int(i)]['license'], '|', c[int(i)]['restrictions'])
json.dump(m,open('scripts/images.manifest.json','w'),ensure_ascii=False,indent=2); open('scripts/images.manifest.json','a').write('\n')
