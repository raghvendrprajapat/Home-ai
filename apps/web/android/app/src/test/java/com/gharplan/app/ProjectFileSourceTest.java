package com.gharplan.app;
import static org.junit.Assert.*;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;
import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
public class ProjectFileSourceTest {
    @Rule public TemporaryFolder temp = new TemporaryFolder();
    private final String name = "gharplan-0123456789abcdef0123456789abcdef.json";
    @Test public void onlyExistingGeneratedPrivateCacheFileIsAccepted() throws Exception {
        File cache = temp.newFolder("cache"), exports = new File(cache, "exports"); assertTrue(exports.mkdir());
        File source = new File(exports, name); Files.write(source.toPath(), new byte[] { 1 });
        assertEquals(source.getCanonicalFile(), ProjectFileSource.resolve(cache, "exports/" + name));
        for (String path : new String[] { "../data/project.json", source.getAbsolutePath(), "exports/../project.json", "exports/user.json", "exports/gharplan-ffffffffffffffffffffffffffffffff.json" }) assertThrows(IOException.class, () -> ProjectFileSource.resolve(cache, path));
    }
    @Test public void pngIsExplicitAndNeverAdmittedThroughDefaultJsonFormat() throws Exception {
        File cache=temp.newFolder("pngcache"), exports=new File(cache,"exports");assertTrue(exports.mkdir());String path="exports/gharplan-0123456789abcdef0123456789abcdef.png";File source=new File(cache,path);Files.write(source.toPath(),new byte[]{1});
        assertEquals(source.getCanonicalFile(),ProjectFileSource.resolve(cache,path,"png"));assertThrows(IOException.class,()->ProjectFileSource.resolve(cache,path));assertThrows(IOException.class,()->ProjectFileSource.resolve(cache,path,"jpeg"));assertThrows(IOException.class,()->ProjectFileSource.resolve(cache,"../"+path,"png"));
    }
    @Test public void directoryAndFileSymlinksCannotEscapeCache() throws Exception {
        File cache = temp.newFolder("cache"), outside = temp.newFolder("outside"), target = new File(outside, name); Files.write(target.toPath(), new byte[] { 1 });
        Files.createSymbolicLink(new File(cache, "exports").toPath(), outside.toPath());
        assertThrows(IOException.class, () -> ProjectFileSource.resolve(cache, "exports/" + name));
        Files.delete(new File(cache, "exports").toPath()); assertTrue(new File(cache, "exports").mkdir());
        Files.createSymbolicLink(new File(cache, "exports/" + name).toPath(), target.toPath());
        assertThrows(IOException.class, () -> ProjectFileSource.resolve(cache, "exports/" + name));
        Files.delete(new File(cache, "exports/" + name).toPath());
        File sameFolder = new File(cache, "exports/unrelated.json"); Files.write(sameFolder.toPath(), new byte[] { 1 });
        Files.createSymbolicLink(new File(cache, "exports/" + name).toPath(), sameFolder.toPath());
        assertThrows(IOException.class, () -> ProjectFileSource.resolve(cache, "exports/" + name));
    }
}
