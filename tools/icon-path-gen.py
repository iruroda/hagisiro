import math
def mir(p): return (24-p[1],24-p[0])
def rnd(p,r=1.1): return round(p,2)
def pt(p): return f"{p[0]:.2f} {p[1]:.2f}"
def build(V0,V1,V2,V3,Q_in,Vm1,Q_out,r1=1.6,r2=1.2):
    V0m,V1m,V2m,V3m,Vm1m=mir(V0),mir(V1),mir(V2),mir(V3),mir(Vm1)
    # 직선-직선 모서리만 둥글게
    def corner(A,V,B,r):
        da=math.dist(A,V); db=math.dist(B,V)
        ta=min(r/da,.5); tb=min(r/db,.5)
        P=(V[0]+(A[0]-V[0])*ta,V[1]+(A[1]-V[1])*ta); N=(V[0]+(B[0]-V[0])*tb,V[1]+(B[1]-V[1])*tb)
        return P,N
    # 순서(시계방향): Vm1 -> V0 -> V1 -> V2 -> V3 =inner quad=> V3m -> V2m -> V1m -> V0m -> Vm1m =outer quad=> Vm1
    d=[]
    P,N=corner(Vm1,V0,V1,r1); d.append(f"M{pt(Vm1)}L{pt(P)}Q{pt(V0)} {pt(N)}")
    P,N=corner(V0,V1,V2,r1); d.append(f"L{pt(P)}Q{pt(V1)} {pt(N)}")
    P,N=corner(V1,V2,V3,r2); d.append(f"L{pt(P)}Q{pt(V2)} {pt(N)}")
    d.append(f"L{pt(V3)}Q{pt(Q_in)} {pt(V3m)}")
    P,N=corner(V3m,V2m,V1m,r2); d.append(f"L{pt(P)}Q{pt(V2m)} {pt(N)}")
    P,N=corner(V2m,V1m,V0m,r1); d.append(f"L{pt(P)}Q{pt(V1m)} {pt(N)}")
    P,N=corner(V1m,V0m,Vm1m,r1); d.append(f"L{pt(P)}Q{pt(V0m)} {pt(N)}")
    d.append(f"L{pt(Vm1m)}Q{pt(Q_out)} {pt(Vm1)}z")
    return ''.join(d)
if __name__=='__main__':
    print(build((5.2,3.2),(10.0,3.2),(12.8,8.8),(10.8,10.8),(12,12),(3.2,6.0),(2.6,21.4)))
