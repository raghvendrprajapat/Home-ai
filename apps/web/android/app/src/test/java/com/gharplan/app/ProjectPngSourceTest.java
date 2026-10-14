package com.gharplan.app;
import static org.junit.Assert.*;
import org.junit.Test;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.Arrays;
import java.util.Base64;
public class ProjectPngSourceTest {
    private byte[] valid() { return Base64.getDecoder().decode("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR4nGP4z8DwH4QZoPR/AEPOB/n6gUr9AAAAAElFTkSuQmCC"); }
    @Test public void overBudgetDimensionsRejectEvenWithValidCrc() { byte[] bytes=Base64.getDecoder().decode("iVBORw0KGgoAAAANSUhEUgAACAEAAAACCAYAAAAjQldiAAAAEklEQVR4nGP4z8DwH4QZoPR/AEPOB/n6gUr9AAAAAElFTkSuQmCC");assertThrows(IOException.class,()->ProjectPngSource.check(new ByteArrayInputStream(bytes))); }
    @Test public void originalTwoPixelRowsPassAndEveryTruncationOrSingleBitMutationRejects() throws Exception {
        byte[] bytes=valid(); ProjectPngSource.check(new ByteArrayInputStream(bytes));
        for(int n=0;n<bytes.length;n++){byte[] truncated=Arrays.copyOf(bytes,n);assertThrows(IOException.class,()->ProjectPngSource.check(new ByteArrayInputStream(truncated)));}
        for(int at=0;at<bytes.length;at++)for(int bit=0;bit<8;bit++){byte[] changed=bytes.clone();changed[at]^=1<<bit;assertThrows(IOException.class,()->ProjectPngSource.check(new ByteArrayInputStream(changed)));}
        byte[] trailing=Arrays.copyOf(bytes,bytes.length+1);assertThrows(IOException.class,()->ProjectPngSource.check(new ByteArrayInputStream(trailing)));
    }
}
