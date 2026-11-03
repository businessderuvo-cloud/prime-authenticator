package it.primegestionale.authenticator;

import android.content.Context;
import android.os.SystemClock;
import androidx.biometric.BiometricManager;
import androidx.test.core.app.ActivityScenario;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.uiautomator.*;
import org.json.JSONArray;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.io.File;
import java.util.regex.Pattern;
import static org.junit.Assert.*;

/** Uses the emulator's actual fingerprint HAL, system prompt and Android Keystore.
 * ci/native-smoke.sh supplies finger touches; no authentication callbacks are mocked.
 */
@RunWith(AndroidJUnit4.class)
public class NativeBiometricTest {
    private final UiDevice device=UiDevice.getInstance(InstrumentationRegistry.getInstrumentation());
    private Context context(){return InstrumentationRegistry.getInstrumentation().getTargetContext();}
    private boolean available(){return new BiometricLock(context()).availability()==BiometricManager.BIOMETRIC_SUCCESS;}
    private File requestFile(){return new File(context().getFilesDir(),"prime-finger-request");}
    private void pulse(String finger)throws Exception{
        try(java.io.FileOutputStream out=new java.io.FileOutputStream(requestFile())){out.write(finger.getBytes(java.nio.charset.StandardCharsets.UTF_8));}
    }
    private void clearPulse(){requestFile().delete();}
    private UiObject2 waitText(String text){UiObject2 item=device.wait(Until.findObject(By.text(text)),15000);assertNotNull("Missing UI: "+text,item);return item;}
    private void click(String text)throws Exception{
        if(!device.hasObject(By.text(text)))new UiScrollable(new UiSelector().scrollable(true)).scrollTextIntoView(text);
        waitText(text).click();
    }
    private void dumpFailure()throws Exception{
        device.dumpWindowHierarchy(new File(context().getExternalFilesDir(null),"biometric-failure.xml"));
    }

    @Test public void enrollEmulatorFingerprint()throws Exception{
        if(available())return;
        device.executeShellCommand("am start -a android.settings.FINGERPRINT_ENROLL");
        long deadline=SystemClock.elapsedRealtime()+100000;
        pulse("enroll");
        try{
            while(SystemClock.elapsedRealtime()<deadline){
                if(available()){device.pressHome();return;}
                UiObject2 pin=device.findObject(By.clazz("android.widget.EditText"));
                if(pin!=null){pin.setText("1234");device.pressEnter();SystemClock.sleep(1200);continue;}
                UiObject2 next=device.findObject(By.text(Pattern.compile("(?i)more|next|i agree|agree|continue|done|got it|start")));
                if(next!=null&&next.isEnabled()){next.click();SystemClock.sleep(1000);continue;}
                SystemClock.sleep(500);
            }
            dumpFailure();fail("Fingerprint enrollment did not complete; inspect biometric-failure.xml");
        }finally{clearPulse();}
    }

    @Test public void sensorActivationCancellationAndUnlock()throws Exception{
        assertTrue("Enroll emulator fingerprint before running this test",available());
        BiometricLock lock=new BiometricLock(context());lock.disable();
        char[] password="Native-biometric-regression-123".toCharArray();
        new VaultStore(context()).save(new JSONArray(),password);
        try{
            try(ActivityScenario<MainActivity> activity=ActivityScenario.launch(MainActivity.class)){
                waitText("Sblocca");device.findObject(By.clazz("android.widget.EditText")).setText(new String(password));
                activity.onActivity(a->((android.view.inputmethod.InputMethodManager)a.getSystemService(Context.INPUT_METHOD_SERVICE)).hideSoftInputFromWindow(a.getWindow().getDecorView().getWindowToken(),0));
                click("Sblocca");waitText("Scansiona QR");click("Attiva biometria sul telefono");
                waitText("Attiva biometria PRIME");assertFalse(lock.enabled());
                pulse("2");SystemClock.sleep(1500);assertFalse("Unknown fingerprint activated biometric unlock",lock.enabled());
                pulse("1");
                assertNotNull(device.wait(Until.findObject(By.textContains("Biometria Android attivata.")),15000));
                assertTrue("Sensor success did not save the Keystore envelope",lock.enabled());
                // A fresh operation cannot decrypt even immediately after a successful auth.
                try{lock.finishUnlock(lock.beginUnlock());fail("Keystore decrypted without a new sensor authentication");}catch(java.security.GeneralSecurityException expected){}
                click("Blocca archivio");click("Sblocca con impronta / volto");waitText("Sblocca PRIME Authenticator");
                click("Usa password");waitText("Sblocca");assertFalse(device.hasObject(By.text("Scansiona QR")));
                click("Sblocca con impronta / volto");waitText("Sblocca PRIME Authenticator");
                pulse("1");assertNotNull(device.wait(Until.findObject(By.text("Archivio sbloccato con la biometria Android.")),30000));
                assertNotNull(device.findObject(By.text("Scansiona QR")));
            }
            // Configuration survives a full Activity exit; the next key use needs another touch.
            try(ActivityScenario<MainActivity> activity=ActivityScenario.launch(MainActivity.class)){
                click("Sblocca con impronta / volto");waitText("Sblocca PRIME Authenticator");pulse("1");
                assertNotNull(device.wait(Until.findObject(By.text("Archivio sbloccato con la biometria Android.")),30000));
            }
        }catch(Throwable failure){dumpFailure();throw failure;}
        finally{clearPulse();java.util.Arrays.fill(password,'\0');context().deleteFile("prime-vault.json");lock.disable();}
    }
}
