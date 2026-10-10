// Runs the 41 odd Ed25519 cases (../ed25519-odd-cases.json) through the JDK's own Ed25519
// (java.security.Signature "Ed25519", JDK 15 and later) and prints a JSON result to standard output.
// Evidence only: no verifier in this repository uses it. Nothing to install:
//   java Run.java > java-results.json
import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.*;
import java.security.spec.X509EncodedKeySpec;
import java.util.*;
import java.util.regex.*;

public class Run {
    static byte[] hex(String h) {
        byte[] b = new byte[h.length() / 2];
        for (int i = 0; i < b.length; i++) b[i] = (byte) Integer.parseInt(h.substring(2 * i, 2 * i + 2), 16);
        return b;
    }

    public static void main(String[] a) throws Exception {
        String json = Files.readString(Path.of("../ed25519-odd-cases.json"));
        // The file is plain JSON with string fields; read each case's pub, msg and sig in order.
        Matcher m = Pattern.compile("\"pub\":\\s*\"([0-9a-f]*)\",\\s*\"msg\":\\s*\"([^\"]*)\",\\s*\"sig\":\\s*\"([0-9a-f]*)\"").matcher(json);
        byte[] spki = hex("302a300506032b6570032100");
        KeyFactory kf = KeyFactory.getInstance("Ed25519");
        List<String> out = new ArrayList<>();
        int n = 0;
        while (m.find()) {
            n++;
            boolean ok = false;
            try {
                byte[] pub = hex(m.group(1));
                byte[] enc = new byte[spki.length + pub.length];
                System.arraycopy(spki, 0, enc, 0, spki.length);
                System.arraycopy(pub, 0, enc, spki.length, pub.length);
                PublicKey pk = kf.generatePublic(new X509EncodedKeySpec(enc));
                Signature s = Signature.getInstance("Ed25519");
                s.initVerify(pk);
                s.update(m.group(2).getBytes(StandardCharsets.UTF_8));
                ok = s.verify(hex(m.group(3)));
            } catch (Exception e) {
                ok = false; // an exception counts as "refused"
            }
            out.add(Boolean.toString(ok));
        }
        if (n != 41) throw new RuntimeException("expected 41 cases, found " + n);
        String name = "Java Ed25519 (JDK)";
        String ver = System.getProperty("java.version") + " (" + System.getProperty("java.runtime.name") + ")";
        System.out.println("{\"versions\":{\"" + name + "\":\"" + ver + "\"},\"results\":{\"" + name + "\":[" + String.join(",", out) + "]}}");
    }
}
