from playwright.sync_api import sync_playwright
import json,sys
F='/home/claude/hagisiro-repo/tools/fakefb/'
seed={}
T=[('2026-04-30','동아리 계획서',1),('2026-05-01','모의고사 감독',1),('2026-05-05','중간고사 문항 검토',1),('2026-05-07','체험학습 동의서 회수',1),('2026-05-08','어버이날 편지 지도',1),('2026-05-12','교과협의회',1),('2026-05-13','수행평가 채점',0),('2026-05-13','진로 상담 자료',0),('2026-05-15','스승의 날 행사',0),('2026-05-18','학부모 상담 주간',0),('2026-05-19','생기부 점검',0),('2026-05-21','체육대회 준비',0),('2026-05-22','체육대회',0),('2026-05-25','교무회의',0),('2026-05-27','방과후 신청',0)]
for i,(d,t,dn) in enumerate(T):
    r={"text":t,"date":d,"done":bool(dn),"order":i}
    if t=='체육대회': r['dday']=True
    if t=='교무회의': r['al']='09:00'
    seed[f"users/u1/todos/t{i}"]=r
seed["users/u1/classes/c1"]={"name":"1반","order":1}
def att(i,d,name,typ): seed[f"users/u1/att/a{i}"]={"classId":"c1","studentId":"s"+name,"name":name,"no":1,"date":d,"type":typ,"cat":"질병","from":0,"to":0,"reason":"","created":i}
att(1,'2026-05-07','김네모','결석'); att(2,'2026-05-12','박동글','지각'); att(3,'2026-05-13','이세모','결석'); att(4,'2026-05-13','최별이','조퇴')
seed["consults/c0"]={"owner":"u1","title":"1학기 진학 상담","slots":[],"closeAt":0}
for sid in ['202605181530','202605181610','202605191550','202605201550']:
    seed[f"consults/c0/books/{sid}"]={"name":"학생","cancelled":False}
def run(w,h,out,url='http://localhost:8770/app/?widget=1'):
    with sync_playwright() as p:
        b=p.chromium.launch(); ctx=b.new_context(service_workers='block',viewport={'width':w,'height':h},device_scale_factor=2); pg=ctx.new_page()
        for n,f in (('firebase-app.js',F+'app.js'),('firebase-auth.js',F+'auth.js'),('firebase-firestore.js',F+'fs.js')):
            pg.route('**/firebasejs/**/'+n,lambda r,_q=None,f=f:r.fulfill(path=f,content_type='text/javascript'))
        pg.route('https://www.googleapis.com/**',lambda r:r.fulfill(status=200,content_type='application/json',body='{"items":[]}'))
        pg.add_init_script("localStorage.setItem('fake:fs',%s)"%json.dumps(json.dumps(seed)))
        pg.clock.set_fixed_time('2026-05-13T10:00:00+09:00')
        pg.goto(url); pg.wait_for_timeout(3500)
        pg.evaluate("document.querySelectorAll('.tour').forEach(e=>e.remove())")
        pg.screenshot(path=out,omit_background=True); b.close()
run(800,620,'/tmp/sb/shots/new.png')
