# Compone las vistas de los laberintos igual que lo hace GameView:
#   imagen del laberinto en (2,6), lienzo de 228x260 negro,
#   píldora  -> fillOval(x*2+4, y*2+8, 3, 3) en blanco
#   de poder -> fillOval(x*2+1, y*2+5, 8, 8) en blanco
#   sprite   -> drawImage(x*2-1, y*2+3) de 14x14
from PIL import Image, ImageDraw, ImageFont
import os

RES='ici-workspace/MsPacManEngine/src/main/resources/data'
OUT='wiki/assets/img'
MAG=2; W=228; H=260
FUENTE='/System/Library/Fonts/Menlo.ttc'

def carga(nombre):
    lineas=open(os.path.join(RES,'mazes',nombre+'.txt')).read().rstrip('\n').split('\n')
    cab=lineas[0].split('\t')
    m={'nombre':cab[0],'pac':int(cab[1]),'carcel':int(cab[2]),'puerta':int(cab[3]),
       'n':int(cab[4]),'pildoras':int(cab[5]),'poder':int(cab[6]),'cruces':int(cab[7]),
       'x':{},'y':{},'vec':{},'pil':{},'pod':{}}
    for l in lineas[1:]:
        p=l.split('\t'); i=int(p[0])
        m['x'][i]=int(p[1]); m['y'][i]=int(p[2])
        m['vec'][i]=[int(p[3]),int(p[4]),int(p[5]),int(p[6])]
        m['pil'][i]=int(p[7]); m['pod'][i]=int(p[8])
    return m

def centro(m,i): return (m['x'][i]*MAG+6, m['y'][i]*MAG+10)

def base(letra, m, conPac=True):
    lien=Image.new('RGB',(W,H),(0,0,0))
    lab=Image.open(os.path.join(RES,'images','maze-'+letra+'.png')).convert('RGBA')
    lien.paste(lab,(2,6),lab)
    d=ImageDraw.Draw(lien)
    for i,p in m['pil'].items():
        if p>=0:
            x=m['x'][i]*MAG+4; y=m['y'][i]*MAG+8
            d.ellipse([x,y,x+3,y+3],fill=(255,255,255))
    for i,p in m['pod'].items():
        if p>=0:
            x=m['x'][i]*MAG+1; y=m['y'][i]*MAG+5
            d.ellipse([x,y,x+8,y+8],fill=(255,255,255))
    if conPac:
        sp=Image.open(os.path.join(RES,'images','mspacman-left-normal.png')).convert('RGBA')
        x=m['x'][m['pac']]*MAG-1; y=m['y'][m['pac']]*MAG+3
        lien.paste(sp,(x,y),sp)
    return lien

for letra in 'abcd':
    m=carga(letra)
    im=base(letra,m)
    im=im.resize((W*2,H*2),Image.NEAREST)
    im.save(os.path.join(OUT,'laberinto-'+letra+'.png'))
    print('laberinto-'+letra+'.png', im.size, 'nodos',m['n'],'cruces',m['cruces'])

# --- laberinto A anotado: cruces, túneles, cárcel y salida ---
m=carga('a')
im=base('a',m,conPac=True).resize((W*3,H*3),Image.NEAREST)
d=ImageDraw.Draw(im,'RGBA')
f=ImageFont.truetype(FUENTE,20)
def c3(i):
    x,y=centro(m,i); return (x*3,y*3)
cruces=[i for i,v in m['vec'].items() if sum(1 for k in v if k!=-1)>2]
for i in cruces:
    x,y=c3(i); r=10
    d.ellipse([x-r,y-r,x+r,y+r],outline=(255,205,40,255),width=4)
# túneles: aristas con salto de coordenada
tun=set()
for i,v in m['vec'].items():
    for j in v:
        if j==-1: continue
        if abs(m['x'][i]-m['x'][j])+abs(m['y'][i]-m['y'][j])!=1:
            tun.add(tuple(sorted((i,j))))
for (a,b) in sorted(tun):
    for i in (a,b):
        x,y=c3(i); r=14
        d.ellipse([x-r,y-r,x+r,y+r],outline=(110,215,255,255),width=5)
# cárcel y puerta
x,y=c3(m['carcel']); d.rectangle([x-14,y-14,x+14,y+14],outline=(255,120,200,255),width=4)
x,y=c3(m['puerta']); d.ellipse([x-11,y-11,x+11,y+11],outline=(120,255,160,255),width=4)
im.save(os.path.join(OUT,'laberinto-a-anotado.png'))
print('laberinto-a-anotado.png', im.size, 'cruces',len(cruces),'túneles',len(tun))

# --- esquina con los números de nodo ---
ESC=10
rec=(2,4,72,44)
im=base('a',m,conPac=False).crop(rec)
im=im.resize(((rec[2]-rec[0])*ESC,(rec[3]-rec[1])*ESC),Image.NEAREST)
d=ImageDraw.Draw(im,'RGBA')
f=ImageFont.truetype(FUENTE,16)
def etiqueta(i,dx,dy,anc='c'):
    cx,cy=centro(m,i)
    x=(cx-rec[0])*ESC; y=(cy-rec[1])*ESC
    d.ellipse([x-4,y-4,x+4,y+4],fill=(255,205,40,255))
    t=str(i); tw=d.textlength(t,font=f)
    tx = x-tw/2+dx if anc=='c' else x+dx
    ty = y+dy
    d.rectangle([tx-4,ty-3,tx+tw+4,ty+19],fill=(0,0,0,210))
    d.text((tx,ty-1),t,font=f,fill=(255,255,255,255))
for k,i in enumerate([0,1,2,3,4,5,6]):
    etiqueta(i,0, -32 if k%2==0 else -56)
for i in [79,85,91]:
    etiqueta(i,14,-10,'l')
im.save(os.path.join(OUT,'nodos-esquina.png'))
print('nodos-esquina.png', im.size)
