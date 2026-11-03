package it.primegestionale.authenticator;

import android.content.Context;
import android.util.AtomicFile;
import android.util.Base64;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.util.Arrays;
import javax.crypto.*;
import javax.crypto.spec.*;

/** Encrypted file in app-private storage. Backups match the existing PRIME PWA format. */
public final class VaultStore {
    private final AtomicFile file;
    private static final byte[] AAD = "PRIME Authenticator v1".getBytes(StandardCharsets.UTF_8);
    public VaultStore(Context context) { file = new AtomicFile(new File(context.getFilesDir(), "prime-vault.json")); }
    public boolean exists() { return file.getBaseFile().exists(); }
    public String backup() throws Exception { return new String(file.readFully(), StandardCharsets.UTF_8); }
    public JSONArray unlock(char[] password) throws Exception { return decrypt(backup(), password); }
    public void save(JSONArray rows, char[] password) throws Exception { write(encrypt(rows, password)); }
    public void write(String envelope) throws Exception {
        FileOutputStream out = file.startWrite();
        try { out.write(envelope.getBytes(StandardCharsets.UTF_8)); file.finishWrite(out); }
        catch (Exception e) { file.failWrite(out); throw e; }
    }
    static String b64(byte[] bytes) { return Base64.encodeToString(bytes, Base64.NO_WRAP); }
    static byte[] un64(String text) { return Base64.decode(text, Base64.DEFAULT); }
    static byte[] random(int size) { byte[] b = new byte[size]; new SecureRandom().nextBytes(b); return b; }
    static SecretKey derive(char[] password, byte[] salt) throws Exception {
        // Explicit PBKDF2-HMAC-SHA256 also works on Android 7, where the JCA factory is absent.
        if (android.os.Build.VERSION.SDK_INT >= 26) {
            PBEKeySpec spec = new PBEKeySpec(password, salt, 600000, 256);
            try { return new SecretKeySpec(SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded(), "AES"); }
            finally { spec.clearPassword(); }
        }
        byte[] raw = new String(password).getBytes(StandardCharsets.UTF_8);
        try {
            Mac mac = Mac.getInstance("HmacSHA256"); mac.init(new SecretKeySpec(raw, "HmacSHA256"));
            byte[] block = Arrays.copyOf(salt, salt.length + 4); block[block.length - 1] = 1;
            byte[] u = mac.doFinal(block), result = u.clone();
            for (int i=1; i<600000; i++) { u=mac.doFinal(u); for(int j=0;j<32;j++) result[j]^=u[j]; }
            SecretKey key = new SecretKeySpec(result, "AES"); Arrays.fill(result,(byte)0); Arrays.fill(u,(byte)0); return key;
        } finally { Arrays.fill(raw, (byte)0); }
    }
    public static String encrypt(JSONArray rows, char[] password) throws Exception {
        if (password.length < 12) throw new Exception("Usa una password di almeno 12 caratteri.");
        validate(rows);
        byte[] salt = random(16), iv = random(12), plain = rows.toString().getBytes(StandardCharsets.UTF_8);
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, derive(password,salt), new GCMParameterSpec(128,iv)); cipher.updateAAD(AAD);
            return new JSONObject().put("format","prime-authenticator").put("version",1).put("salt",b64(salt))
                .put("iv",b64(iv)).put("cipher",b64(cipher.doFinal(plain))).toString();
        } finally { Arrays.fill(plain,(byte)0); }
    }
    public static JSONArray decrypt(String envelope, char[] password) throws Exception {
        if (envelope.length()>600000) throw new Exception("Backup troppo grande.");
        JSONObject v = new JSONObject(envelope);
        if (!"prime-authenticator".equals(v.optString("format")) || v.optInt("version")!=1) throw new Exception("Backup PRIME non valido.");
        byte[] salt=un64(v.getString("salt")),iv=un64(v.getString("iv"));
        if(salt.length!=16||iv.length!=12) throw new Exception("Archivio non valido.");
        byte[] plain;
        try {
            Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.DECRYPT_MODE,derive(password,salt),new GCMParameterSpec(128,iv)); cipher.updateAAD(AAD);
            plain=cipher.doFinal(un64(v.getString("cipher")));
        } catch (GeneralSecurityException e) { throw new Exception("Password errata o archivio danneggiato."); }
        try { JSONArray rows=new JSONArray(new String(plain,StandardCharsets.UTF_8)); validate(rows); return rows; }
        finally { Arrays.fill(plain,(byte)0); }
    }
    static void validate(JSONArray rows) throws Exception {
        if(rows.length()>100) throw new Exception("Massimo 100 account per archivio.");
        for(int i=0;i<rows.length();i++) {
            JSONObject r=rows.getJSONObject(i);
            if("prime-device".equals(r.optString("type"))) PrimeProtocol.validateDevice(r);
            else Totp.validate(r);
        }
    }
}
