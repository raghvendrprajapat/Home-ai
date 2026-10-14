package com.gharplan.app;
import java.io.File;
import java.io.IOException;
final class ProjectFileSource {
    static File resolve(File cacheDirectory, String path) throws IOException { return resolve(cacheDirectory,path,"json"); }
    static File resolve(File cacheDirectory, String path, String format) throws IOException {
        if (!"json".equals(format) && !"png".equals(format)) throw new IOException("Invalid export format");
        if (path == null || !path.matches("exports/gharplan-[a-f0-9]{32}\\." + format)) throw new IOException("Invalid export path");
        File cache = cacheDirectory.getCanonicalFile(), expectedFolder = new File(cache, "exports"), folder = expectedFolder.getCanonicalFile();
        if (!folder.equals(expectedFolder)) throw new IOException("Export folder is not private cache");
        File expectedFile = new File(cache, path).getAbsoluteFile(), file = expectedFile.getCanonicalFile();
        if (!file.equals(expectedFile) || !folder.equals(file.getParentFile()) || !file.isFile()) throw new IOException("Export source unavailable");
        return file;
    }
}
