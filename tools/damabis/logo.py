from PIL import Image, ImageDraw
S=4; W,H=520*S,520*S
img=Image.new("RGBA",(W,H),(0,0,0,0)); d=ImageDraw.Draw(img)
PINK=(255,150,180,255); PINK_D=(255,107,157,255); PINK_L=(255,214,224,255)
OUT=(232,90,138,255); BLUSH=(255,140,175,255); DARK=(74,20,45,255)
def e(b,f,o=None,w=3*S): d.ellipse(b,fill=f,outline=o,width=w)
# cola
d.polygon([(150*S,420*S),(60*S,470*S),(70*S,360*S)],fill=PINK,outline=OUT)
# patas
for cx,cy,rx,ry in [(150*S,430*S,34*S,24*S),(370*S,430*S,34*S,24*S)]:
    e((cx-rx,cy-ry,cx+rx,cy+ry),PINK,OUT)
# brazos
e((110*S,285*S,190*S,340*S),PINK,OUT); e((330*S,285*S,410*S,340*S),PINK,OUT)
# cuerpo
e((170*S,265*S,350*S,455*S),PINK,OUT); e((205*S,305*S,315*S,440*S),PINK_L,None)
# branquias
for sx in (0,1):
    for i,(ax,ay,ln) in enumerate([(-1,-46,1),(-1,-6,1.15),(-1,34,1)]):
        bx = 168*S if sx==0 else 352*S
        dirx = -1 if sx==0 else 1
        y = 165*S+ay*S*2.0
        for k in range(3):
            r=(26-k*5)*S*ln; cx=bx+dirx*(28+k*34)*S; cy=y+dirx*0
            e((cx-r,cy-r,cx+r,cy+r),PINK_D,OUT,2*S)
# cabeza
e((150*S,60*S,370*S,280*S),PINK,OUT,4*S)
# ojos
for cx in (208*S,312*S):
    e((cx-30*S,138*S,cx+30*S,212*S),DARK)
    e((cx-14*S,152*S,cx+8*S,178*S),(255,255,255,255))
    e((cx+6*S,186*S,cx+20*S,200*S),(255,255,255,235))
# boca
d.pieslice((228*S,196*S,292*S,254*S),0,180,fill=(214,60,100,255),outline=OUT,width=3*S)
d.ellipse((242*S,228*S,278*S,250*S),fill=(255,150,175,255))
# blush
e((166*S,196*S,202*S,222*S),BLUSH); e((318*S,196*S,354*S,222*S),BLUSH)
img.resize((520,520),Image.LANCZOS).save("/tmp/claude-0/-home-user-pagina-web/38b1380c-584b-55c2-8699-038270dfa567/scratchpad/damabis/ajolote.png")
print("ok")
