package it.primegestionale.authenticator;

import android.content.Context;
import android.content.Intent;
import android.view.View;
import android.view.ViewGroup;
import androidx.test.core.app.ActivityScenario;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.uiautomator.*;
import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.security.spec.*;
import java.math.BigInteger;
import java.util.Arrays;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class NativeSecurityTest {
    private Context context(){return InstrumentationRegistry.getInstrumentation().getTargetContext();}
    @Test public void encryptedVaultRejectsWrongPasswordAndTampering()throws Exception{
        JSONObject otp=Totp.parse("otpauth://totp/PRIME:test?secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ&issuer=PRIME");JSONArray rows=new JSONArray().put(otp);
        char[] password="Native-test-Password-8273".toCharArray();String data=VaultStore.encrypt(rows,password);
        assertFalse(data.contains("GEZDGNBV"));assertEquals(otp.getString("secret"),VaultStore.decrypt(data,password).getJSONObject(0).getString("secret"));
        try{VaultStore.decrypt(data,"Incorrect-password-123".toCharArray());fail("Wrong password accepted");}catch(Exception expected){}
        JSONObject changed=new JSONObject(data);byte[] cipher=VaultStore.un64(changed.getString("cipher"));cipher[0]^=1;changed.put("cipher",VaultStore.b64(cipher));
        try{VaultStore.decrypt(changed.toString(),password);fail("Tampered ciphertext accepted");}catch(Exception expected){}
    }
    @Test public void totpMatchesRfc6238()throws Exception{
        JSONObject row=Totp.parse("otpauth://totp/RFC:test?secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ&digits=8");
        assertEquals("94287082",Totp.code(row,59000));assertEquals("07081804",Totp.code(row,1111111109000L));assertEquals("65353130",Totp.code(row,20000000000000L));
    }
    @Test public void browserBackupImportsWithoutLosingCodes()throws Exception{
        String fixture;try(java.io.InputStream in=InstrumentationRegistry.getInstrumentation().getContext().getAssets().open("pwa-backup.json")){java.io.ByteArrayOutputStream bytes=new java.io.ByteArrayOutputStream();byte[] b=new byte[1024];int n;while((n=in.read(b))!=-1)bytes.write(b,0,n);fixture=bytes.toString("UTF-8");}
        JSONArray rows=VaultStore.decrypt(fixture,"Compatibilità-Password-123".toCharArray());assertEquals(1,rows.length());assertEquals("94287082",Totp.code(rows.getJSONObject(0),59000));
    }
    @Test public void qrRejectsOtherOriginsAndMismatchedChallenges()throws Exception{
        String token="a".repeat(43),nonce="b".repeat(43);PrimeProtocol.Qr q=PrimeProtocol.parse("https://primegestionale.it/authenticator/#prime-login="+token+"."+nonce);
        assertEquals("login",q.action);
        for(String origin:new String[]{"http://primegestionale.it","https://evil.example","https://primegestionale.it.evil.example","https://primegestionale.it:8443"}){try{PrimeProtocol.parse(origin+"/authenticator/#prime-login="+token+"."+nonce);fail("Untrusted origin accepted");}catch(Exception expected){}}
        JSONObject msg=new JSONObject().put("protocol","prime-qr-login-v1").put("origin",PrimeProtocol.ORIGIN).put("id",token).put("nonce",nonce).put("expires_at",System.currentTimeMillis()+120000).put("match_code","123456").put("browser","Test");
        JSONObject details=new JSONObject().put("origin",PrimeProtocol.ORIGIN).put("match_code","123456").put("browser","Test").put("message",msg.toString());PrimeProtocol.validateDetails(q,details);
        msg.put("nonce",token);details.put("message",msg.toString());try{PrimeProtocol.validateDetails(q,details);fail("Wrong challenge accepted");}catch(Exception expected){}
    }
    @Test public void primeSignaturesUseBackendP1363Encoding()throws Exception{
        JSONObject keys=PrimeProtocol.newDevice(),entry=new JSONObject().put("id","a".repeat(43)).put("origin",PrimeProtocol.ORIGIN).put("private_key",keys.getJSONObject("private_key")).put("public_key",keys.getJSONObject("public_key"));PrimeProtocol.validateDevice(entry);
        String message="PRIME Android native approval";byte[] raw=PrimeProtocol.fromUrl(PrimeProtocol.sign(entry,message));assertEquals(64,raw.length);
        byte[] r=new BigInteger(1,Arrays.copyOfRange(raw,0,32)).toByteArray(),s=new BigInteger(1,Arrays.copyOfRange(raw,32,64)).toByteArray();byte[] der=new byte[6+r.length+s.length];der[0]=0x30;der[1]=(byte)(der.length-2);der[2]=2;der[3]=(byte)r.length;System.arraycopy(r,0,der,4,r.length);der[4+r.length]=2;der[5+r.length]=(byte)s.length;System.arraycopy(s,0,der,6+r.length,s.length);
        JSONObject jwk=keys.getJSONObject("public_key");AlgorithmParameters params=AlgorithmParameters.getInstance("EC");params.init(new ECGenParameterSpec("secp256r1"));PublicKey pk=KeyFactory.getInstance("EC").generatePublic(new ECPublicKeySpec(new ECPoint(new BigInteger(1,PrimeProtocol.fromUrl(jwk.getString("x"))),new BigInteger(1,PrimeProtocol.fromUrl(jwk.getString("y")))),params.getParameterSpec(ECParameterSpec.class)));
        Signature verify=Signature.getInstance("SHA256withECDSA");verify.initVerify(pk);verify.update(message.getBytes(StandardCharsets.UTF_8));assertTrue(verify.verify(der));
    }
    private void assertNative(View v){assertFalse("No embedded browser may render the app",v instanceof android.webkit.WebView);if(v instanceof ViewGroup){ViewGroup g=(ViewGroup)v;for(int i=0;i<g.getChildCount();i++)assertNative(g.getChildAt(i));}}
    @Test public void nativeUiCreatesAndUnlocksVaultWithoutBrowser()throws Exception{
        context().deleteFile("prime-vault.json");new BiometricLock(context()).disable();UiDevice device=UiDevice.getInstance(InstrumentationRegistry.getInstrumentation());
        try(ActivityScenario<MainActivity> activity=ActivityScenario.launch(MainActivity.class)){
            UiObject2 create=device.wait(Until.findObject(By.text("Crea archivio")),10000);assertNotNull(create);
            java.util.List<UiObject2> fields=device.findObjects(By.clazz("android.widget.EditText"));assertEquals(2,fields.size());for(UiObject2 f:fields)f.setText("Native-test-password-123");create.click();
            assertTrue(device.wait(Until.hasObject(By.text("Scansiona QR")),30000));assertEquals(context().getPackageName(),device.getCurrentPackageName());
            activity.onActivity(a->assertNative(a.getWindow().getDecorView()));
            device.findObject(By.text("Blocca archivio")).click();assertTrue(device.wait(Until.hasObject(By.text("Sblocca")),10000));
            device.findObject(By.clazz("android.widget.EditText")).setText("Native-test-password-123");device.findObject(By.text("Sblocca")).click();assertTrue(device.wait(Until.hasObject(By.text("Scansiona QR")),30000));
            device.findObject(By.text("Attiva biometria sul telefono")).click();assertNotNull(device.wait(Until.findObject(By.textContains("Biometria Android")),10000));
        }finally{context().deleteFile("prime-vault.json");new BiometricLock(context()).disable();}
    }
}
