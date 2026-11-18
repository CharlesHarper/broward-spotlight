# Local stand-in for the Broward County business tax feature service (fictional records, for testing only).
import json, random
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs
random.seed(3)
cats=[('GARAGE/AUTO REPAIR','AUTO REPAIR'),('WINDOW TINT/ELECTROPLATING','WINDOW TINTING'),('BARBER SHOP/BEAUTY SALON','BEAUTY SALON'),('GENERAL CONTRACTOR','GENERAL CONTRACTOR'),('ATTORNEY','ATTORNEY'),('SINGLE RESORT DWELLING','VACATION RENTAL'),('RESTAURANTS','RESTAURANT'),('ALL OTHERS','PET GROOMING'),('ALL OTHERS','YOGA STUDIO'),(None,'CONSULTING'),('DENTIST','DENTIST'),('HEALTH CLUB','GYM')]
cities=['FORT LAUDERDALE','DAVIE','HOLLYWOOD','CORAL SPRINGS','PEMBROKE PINES','HALLANDALE BEACH','WESTON']
rows=[]
for i in range(2350):
    c,o=random.choice(cats)
    person = i % 17 == 0
    name = f'JANE DOE{i}' if person else f'SAMPLE {o} {i} LLC'
    rows.append({'OBJECTID':i+1,'Year':2025,'Business_Name':name,'DBA_Name':None,'Owner_Name':name if person else 'SOMEONE','Business_Address_Line_1':f'{100+i} SW {i%90} AVE' + (' APT 2' if i%23==0 else ''),'Business_Address_Line_2':None,'Business_City':random.choice(cities),'Business_Zip':'33314-1234','Occupation_Desc_':o,'Category_Name':c,'Business_Start_Date':1104537600000+i*86400000,'CITYNAME':random.choice(cities),'Account__':500000+i})
# one that should merge with a state restaurant record (Sample A1A Tacos in the DBPR sample data)
class H(BaseHTTPRequestHandler):
    def do_GET(self):
        q=parse_qs(urlparse(self.path).query); off=int(q.get('resultOffset',['0'])[0]); n=int(q.get('resultRecordCount',['1000'])[0])
        feats=[{'attributes':r,'geometry':{'x':-80.2,'y':26.1}} for r in rows[off:off+n]]
        b=json.dumps({'features':feats}).encode(); self.send_response(200); self.send_header('content-type','application/json'); self.end_headers(); self.wfile.write(b)
    def log_message(self,*a): pass
HTTPServer(('127.0.0.1',8098),H).serve_forever()
