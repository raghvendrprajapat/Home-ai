package com.gharplan.app;
import java.io.DataInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.zip.CRC32;
/** Bounded PNG envelope/CRC admission. Browser additionally decodes before transport. */
final class ProjectPngSource {
    static void check(InputStream input) throws IOException {
        DataInputStream in = new DataInputStream(input);
        byte[] signature=new byte[8]; in.readFully(signature);
        if (!Arrays.equals(signature, new byte[]{(byte)137,80,78,71,13,10,26,10})) throw new IOException("Invalid PNG");
        long total=8; boolean data=false, ended=false; int chunks=0;
        while (!ended) {
            if (++chunks>4096) throw new IOException("PNG chunk limit");
            long size=((long)in.readInt() & 0xffffffffL); byte[] type=new byte[4]; in.readFully(type); total+=12+size;
            if(type.length!=4 || total>ProjectFileStreams.MAX_BYTES || size>ProjectFileStreams.MAX_BYTES) throw new IOException("PNG length");
            String name=new String(type,StandardCharsets.US_ASCII); if(!name.matches("[A-Za-z]{4}")) throw new IOException("PNG chunk type");
            if(chunks==1 && (!name.equals("IHDR")||size!=13) || chunks>1 && name.equals("IHDR")) throw new IOException("PNG header");
            CRC32 crc=new CRC32(); crc.update(type); long remaining=size; byte[] buffer=new byte[8192]; byte[] header=chunks==1?new byte[13]:null; int at=0;
            while(remaining>0){int count=in.read(buffer,0,(int)Math.min(remaining,buffer.length));if(count<=0)throw new IOException("PNG truncated");crc.update(buffer,0,count);if(header!=null){System.arraycopy(buffer,0,header,at,count);at+=count;}remaining-=count;}
            if(crc.getValue()!=((long)in.readInt() & 0xffffffffL))throw new IOException("PNG checksum");
            if(header!=null){java.nio.ByteBuffer h=java.nio.ByteBuffer.wrap(header);long w=((long)h.getInt() & 0xffffffffL),height=((long)h.getInt() & 0xffffffffL);if(w<1||height<1||w>2048||height>2048||w*height>4000000||header[8]!=8||(header[9]!=2&&header[9]!=6)||header[10]!=0||header[11]!=0||header[12]!=0)throw new IOException("PNG dimension budget");}
            if(name.equals("IDAT")){if(size==0)throw new IOException("PNG data");data=true;}
            if(name.equals("IEND")){if(size!=0||!data||in.read()!=-1)throw new IOException("PNG end");ended=true;}
        }
    }
}
