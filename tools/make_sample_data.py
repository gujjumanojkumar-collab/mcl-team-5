import json, random, datetime
random.seed(11)
PLAN_H, PLAN_E, KG_H, M3_H, PLAN_B = 400, 20000, 50, 25, 10000
N_SHOVEL, TIPPERS, LOAD_MIN, PAY, SWELL, EFF = 16, 5, 5, 10, 1.3, 0.85
start = datetime.date(2026,10,28)
days = 30
# incidents keyed by shift index
inc = {}
def add(i0,i1,**kw):
    for i in range(i0,i1+1): inc.setdefault(i,{}).update(kw)
add(12,19, drill=0.38, drill_cause="Drill rig breakdown (hydraulic)")
add(20,22, drill=0.7, drill_cause="Drill bit shortage")
add(40,41, blast_delay=170, blast_cause="Rain / lightning hold")
add(52,57, expl=0.55, blast_cause="Explosive delivery delay")
add(66,67, tipper=38, load_cause="Haul road wet / rain")
add(68,69, shovel_down=0, tipper=33, load_cause="Haul road wet / rain")
add(78,83, shovel_down=5, tipper=31, load_cause="Shovel breakdown + tipper shortage")
rows=[]; holes_open=800; muck_open=15000
for d in range(days):
    for si,s in enumerate("ABC"):
        i=d*3+si; e=inc.get(i,{})
        a=e.get("drill", min(1.04, random.gauss(0.985,0.03)))
        drilled=round(PLAN_H*a)
        dd=round(480*(1-min(a,1)))
        dc=e.get("drill_cause","Minor stoppages" if a<0.95 else "")
        ex=e.get("expl", min(1.0, random.gauss(0.995,0.015)))
        issued=round(PLAN_E*ex/100)*100
        bdelay=e.get("blast_delay", max(0,round(random.gauss(8,8))))
        bc=e.get("blast_cause","Safety clearance / permit" if bdelay>=20 else "")
        if "expl" in e and "blast_delay" not in e: bdelay=max(0,round(random.gauss(8,8)))
        expl_cap=issued//KG_H; time_cap=int(PLAN_H*(1-bdelay/480))
        blasted=max(0,min(holes_open,expl_cap,time_cap,PLAN_H))
        sh=N_SHOVEL-e.get("shovel_down", random.choice([0,0,0,0,0,0,0,1]))
        T=e.get("tipper", max(21,round(random.gauss(23.5,1.6),1)))
        lc=e.get("load_cause","Minor delays" if (sh<16 or T>25) else "")
        interval=max(LOAD_MIN,T/TIPPERS)
        cap=sh*480*EFF/interval*PAY/SWELL*random.uniform(0.995,1.01)
        exc=round(min(cap,muck_open))
        rows.append(dict(date=(start+datetime.timedelta(days=d)).isoformat(),shift=s,
          holes_drilled=drilled,drill_downtime_min=dd,drill_cause=dc,
          holes_open=holes_open,explosive_issued_kg=issued,blast_delay_min=bdelay,blast_cause=bc,holes_blasted=blasted,
          muck_open_bcm=round(muck_open),shovels_working=sh,tipper_cycle_min=T,load_cause=lc,excavated_bcm=exc))
        holes_open=holes_open-blasted+drilled
        muck_open=muck_open+blasted*M3_H-exc
meta=[{"label":"How made","value":"Simulated by sim.py (seeded). Not real mine data: replace with shift reports."},
      {"label":"Plan per shift","value":"400 holes, 20,000 kg explosive, 10,000 BCM excavated"}]
json.dump({"rows":rows,"meta":meta},open("shifts.json","w"))
tot=sum(r["excavated_bcm"] for r in rows);print(len(rows),tot,tot/900000)
for r in rows[::3]: print(r["date"],r["holes_drilled"],r["holes_open"],r["holes_blasted"],r["muck_open_bcm"],r["excavated_bcm"])
