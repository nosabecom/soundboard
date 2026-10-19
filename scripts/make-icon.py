# Code-drawn launcher icon: no external graphics dependency.
import struct
import zlib
from pathlib import Path
n=180
rows=[]
for y in range(n):
    row=bytearray()
    for x in range(n):
        color=(242,241,237)
        for left,top,accent in [(30,30,False),(96,30,False),(30,96,False),(96,96,True)]:
            size=54; radius=9
            if left <= x < left+size and top <= y < top+size:
                dx=max(left+radius-x,0,x-(left+size-radius-1))
                dy=max(top+radius-y,0,y-(top+size-radius-1))
                if dx*dx+dy*dy <= radius*radius:
                    color=(235,98,62) if accent else (44,48,56)
        row.extend(color)
    rows.append(b'\0'+row)
def chunk(tag,data):
    return struct.pack('>I',len(data))+tag+data+struct.pack('>I',zlib.crc32(tag+data))
Path('public/apple-touch-icon.png').write_bytes(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',n,n,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(b''.join(rows)))+chunk(b'IEND',b''))
