# Outil de sélection : python3 scripts/pick.py cle=index | cle=autre-cle:index | cle="File:Titre exact.jpg"
import json,sys
m=json.load(open('scripts/images.manifest.json'))
for a in sys.argv[1:]:
    k,v=a.split('=',1)
    if v.startswith('File:'):
        m[k]['pick']=v; print(k,'->',v); continue
    src,i=(v.split(':') if ':' in v else (k,v))
    c=json.load(open(f'candidates/{src}.json'))[int(i)]
    m[k]['pick']=c['title']; print(k,'->',c['title'],'|',c['license'],'|',c['restrictions'])
json.dump(m,open('scripts/images.manifest.json','w'),ensure_ascii=False,indent=2); open('scripts/images.manifest.json','a').write('\n')
