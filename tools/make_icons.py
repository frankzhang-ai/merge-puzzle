#!/usr/bin/env python3
from PIL import Image, ImageDraw
from pathlib import Path
out=Path('public/icons');out.mkdir(parents=True,exist_ok=True)
def icon(size):
 im=Image.new('RGBA',(size,size),'#fff6fb');d=ImageDraw.Draw(im);pad=size*.08;d.rounded_rectangle((pad,pad,size-pad,size-pad),radius=size*.22,fill='#ffdce8');cx=cy=size/2;rad=size*.19
 for i,col in enumerate(['#ff8fab','#70cda9','#75c9f5','#ffd1a8','#b993f5']):
  import math
  a=2*math.pi*i/5-math.pi/2;x=cx+math.cos(a)*rad;y=cy+math.sin(a)*rad;rr=size*.16;d.ellipse((x-rr,y-rr,x+rr,y+rr),fill=col)
 d.ellipse((cx-size*.13,cy-size*.13,cx+size*.13,cy+size*.13),fill='#fff1a8');d.ellipse((cx-size*.045,cy-size*.02,cx-size*.015,cy+size*.01),fill='#59465b');d.ellipse((cx+size*.015,cy-size*.02,cx+size*.045,cy+size*.01),fill='#59465b')
 return im
for n in [180,192,512]:icon(n).save(out/f'icon-{n}.png')
for n in [192,512]:icon(n).save(out/f'maskable-{n}.png')
icon(32).save(out/'favicon-32.png')
icon(512).save(out/'splash-512.png')
