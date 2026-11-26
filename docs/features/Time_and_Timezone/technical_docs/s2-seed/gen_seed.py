"""Builds the 0842 zone-catalog seed and the 0843 CLDR country defaults from the official files.
IANA tzdb 2026f (/workspace/s2/tzdb) + CLDR 49 (/workspace/s2/cldr). Offsets: Python zoneinfo on the
system tzdata 2026f (same release). Output: /workspace/s2/gen/tz_seed.sql, country_seed.sql, summary.json."""
import json, re, datetime as dt, collections
from zoneinfo import ZoneInfo
TZ='/workspace/s2/tzdb/'; CL='/workspace/s2/cldr/'
TZDB=open(TZ+'version').read().strip(); CLDR='49'
def tab(f):
    out={}
    for l in open(TZ+f, encoding='utf-8'):
        if l.startswith('#') or not l.strip(): continue
        p=l.rstrip('\n').split('\t'); out[p[2]]=p[0].split(',')
    return out
zt=tab('zone.tab'); z70=tab('zone1970.tab')
links={}
for l in open(TZ+'backward', encoding='utf-8'):
    p=l.split()
    if len(p)>=3 and p[0]=='Link': links[p[2]]=p[1]
UTC_FAMILY=['Etc/UTC','Etc/UCT','Etc/Universal','Etc/Zulu','Etc/GMT','Etc/GMT0','Etc/GMT+0','Etc/GMT-0','Etc/Greenwich',
            'GMT','GMT0','GMT+0','GMT-0','Greenwich','UCT','Universal','Zulu']
canon=sorted(set(zt)|set(z70)|{'UTC'})
cset=set(canon)
SHAPE=re.compile(r'^[A-Za-z]+(?:/[A-Za-z0-9_+-]+)+$')
aliases={}
for name,target in links.items():
    if name in cset or name in UTC_FAMILY: continue
    if not SHAPE.match(name) or name.startswith(('Etc/','SystemV/','posix/','right/')): continue
    t=target; seen=0
    while t not in cset and t in links and seen<5: t=links[t]; seen+=1
    if t in ('Etc/UTC','Etc/GMT'): t='UTC'
    if t not in cset: continue
    aliases[name]=t
for n in UTC_FAMILY: aliases[n]='UTC'
# offsets over 2026 (daily 12:00Z), IANA isdst flags
def offsets(z):
    zi=ZoneInfo('Etc/UTC' if z=='UTC' else z)
    seen=collections.Counter(); dst=set(); std=collections.Counter()
    d0=dt.datetime(2026,1,1,12,tzinfo=dt.timezone.utc)
    for i in range(365):
        x=(d0+dt.timedelta(days=i)).astimezone(zi)
        o=int(x.utcoffset().total_seconds()//60); seen[o]+=1
        if x.dst(): dst.add(o)
        else: std[o]+=1
    if len(seen)==1:
        o=next(iter(seen)); return o,o,False
    s=std.most_common(1)[0][0] if std else min(seen)
    d=[o for o in seen if o!=s]
    return s,(d[0] if d else s),True
# CLDR names
def tzn(f):
    m=json.load(open(CL+f))['main']; return m[list(m)[0]]['dates']['timeZoneNames']
en=tzn('en_tzn.json'); ar=tzn('ar_tzn.json')
mz=json.load(open(CL+'metaZones.json'))['supplemental']['metaZones']['metazoneInfo']['timezone']
def dig(d,path):
    for p in path.split('/'):
        if not isinstance(d,dict) or p not in d: return None
        d=d[p]
    return d
rev=collections.defaultdict(list)
for a,t in aliases.items(): rev[t].append(a)
def cands(z): return [z]+sorted(rev.get(z,[]))
def city(loc,z):
    for c in cands(z):
        v=dig(loc['zone'],c)
        if isinstance(v,dict) and v.get('exemplarCity'): return v['exemplarCity']
    return None
def metazone(z):
    for c in cands(z):
        v=dig(mz,c)
        if isinstance(v,list):
            cur=[u['usesMetazone'] for u in v if '_to' not in u['usesMetazone']]
            if cur: return cur[-1]['_mzone']
    return None
def mzname(loc,m):
    v=loc['metazone'].get(m) if m else None
    if not v or 'long' not in v: return None
    return v['long'].get('generic') or v['long'].get('standard')
def names(z):
    if z=='UTC':
        return en['zone']['Etc']['UTC']['long']['standard'], ar['zone']['Etc']['UTC']['long']['standard']
    ce=city(en,z) or z.split('/')[-1].replace('_',' ')
    ca=city(ar,z) or ce
    m=metazone(z); me=mzname(en,m); ma=mzname(ar,m)
    ne=en['fallbackFormat'].replace('{1}',me).replace('{0}',ce) if me else en['regionFormat'].replace('{0}',ce)
    na=ar['fallbackFormat'].replace('{1}',ma).replace('{0}',ca) if ma else ar['regionFormat'].replace('{0}',ca)
    return ne,na
def q(s): return 'NULL' if s is None else "'"+str(s).replace("'","''")+"'"
def arr(a): return "ARRAY[]::text[]" if not a else "ARRAY["+','.join(q(x) for x in a)+"]::text[]"
def offstr(m): s='+' if m>=0 else '-'; m=abs(m); return f"{s}{m//60:02d}:{m%60:02d}"
rows=[]; meta={}
for z in canon:
    s,d,u=offsets(z); ne,na=names(z)
    cc=list(dict.fromkeys((zt.get(z) or [])+(z70.get(z) or [])))
    prim=(zt.get(z) or z70.get(z) or [None])[0]
    region='Global' if z=='UTC' else z.split('/')[0]
    h=int(s/60) if s>=0 else -int(-s/60); mi=s-h*60
    rows.append(f"  ({q(z)}, true, NULL, {s}, {d}, {str(u).lower()}, {h}, {mi}, {q(offstr(s))}, {q(prim)}, {arr(cc)}, {q(region)}, {q(ne)}, {q(na)})")
    meta[z]=(s,d,u,h,mi)
for a,t in sorted(aliases.items()):
    s,d,u,h,mi=meta[t]
    region='Global' if t=='UTC' else (a.split('/')[0] if '/' in a else 'Global')
    rows.append(f"  ({q(a)}, false, {q(t)}, {s}, {d}, {str(u).lower()}, {h}, {mi}, {q(offstr(s))}, NULL, ARRAY[]::text[], {q(region)}, {q(a)}, {q(a)})")
open('/workspace/s2/gen/tz_seed.sql','w').write(',\n'.join(rows)+'\n')
# CLDR country defaults
td=json.load(open(CL+'timeData.json'))['supplemental']['timeData']
fd=json.load(open(CL+'weekData.json'))['supplemental']['weekData']['firstDay']
iso=[l.split('\t')[0] for l in open(TZ+'iso3166.tab',encoding='utf-8') if not l.startswith('#') and l.strip()]
HC={'h':'H12','hb':'H12','hB':'H12','K':'H12','H':'H23','Hb':'H23','HB':'H23','k':'H23'}
WD={'sun':0,'mon':1,'tue':2,'wed':3,'thu':4,'fri':5,'sat':6}
crow=[]
for c in sorted(iso):
    t=td.get(c); ts=c if t else '001'; t=t or td['001']
    w=fd.get(c); ws=c if w else '001'; w=w or fd['001']
    src=f"CLDR {CLDR} supplemental timeData[{ts}]+weekData firstDay[{ws}]"
    crow.append(f"  ({q(c)}, {q(HC[t['_preferred']])}, {WD[w]}, {q(t['_preferred'])}, {q(w)}, {q(src)})")
open('/workspace/s2/gen/country_seed.sql','w').write(',\n'.join(crow)+'\n')
json.dump({'tzdb':TZDB,'cldr':CLDR,'canonical':len(canon),'aliases':len(aliases),'countries':len(crow),
  'spot':{c:[r for r in crow if r.startswith(f"  ('{c}'")][0] for c in ['OM','SA','AE','US','DE','MV','KW','EG','IN','GB']},
  'names':{z:names(z) for z in ['Asia/Muscat','Asia/Riyadh','America/New_York','Asia/Kolkata','Europe/Kyiv','UTC','Asia/Kathmandu','Africa/Casablanca']},
  'off':{z:offsets(z) for z in ['Europe/Dublin','Africa/Casablanca','Australia/Lord_Howe','America/St_Johns','Asia/Kathmandu']}},
  open('/workspace/s2/gen/summary.json','w'),ensure_ascii=False,indent=1)
