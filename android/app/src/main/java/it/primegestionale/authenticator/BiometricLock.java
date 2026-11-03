package it.primegestionale.authenticator;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import androidx.biometric.BiometricManager;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.Arrays;
import javax.crypto.*;
import javax.crypto.spec.GCMParameterSpec;

/** Android owns sensor verification and releases this key for exactly one cipher operation. */
public final class BiometricLock {
    private static final String ALIAS="prime.native.biometric.v1";
    private static final byte[] AAD="PRIME native biometric password v1".getBytes(StandardCharsets.UTF_8);
    private final Context context;private final SharedPreferences prefs;
    public BiometricLock(Context c){context=c;prefs=c.getSharedPreferences("native-biometric",Context.MODE_PRIVATE);}
    public boolean enabled(){return prefs.contains("cipher")&&prefs.contains("iv");}
    public int availability(){return BiometricManager.from(context).canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG);}
    public void disable()throws Exception{prefs.edit().clear().commit();KeyStore s=KeyStore.getInstance("AndroidKeyStore");s.load(null);s.deleteEntry(ALIAS);}
    public Cipher beginEnable()throws Exception{
        KeyGenerator g=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");
        KeyGenParameterSpec.Builder spec=new KeyGenParameterSpec.Builder(ALIAS,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256).setUserAuthenticationRequired(true).setInvalidatedByBiometricEnrollment(true);
        if(Build.VERSION.SDK_INT>=30)spec.setUserAuthenticationParameters(0,KeyProperties.AUTH_BIOMETRIC_STRONG);
        else spec.setUserAuthenticationValidityDurationSeconds(-1);
        g.init(spec.build());Cipher c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.ENCRYPT_MODE,g.generateKey());return c;
    }
    public void finishEnable(Cipher cipher,char[] password)throws Exception{
        byte[] raw=new String(password).getBytes(StandardCharsets.UTF_8);
        // An auth-per-use Keystore operation must not receive even AAD before
        // BiometricPrompt authorizes it. Some devices cache that error until doFinal.
        try {cipher.updateAAD(AAD);byte[] wrapped=cipher.doFinal(raw);if(!prefs.edit().putString("iv",VaultStore.b64(cipher.getIV())).putString("cipher",VaultStore.b64(wrapped)).commit())throw new Exception("Impossibile salvare la configurazione biometrica.");}
        finally{Arrays.fill(raw,(byte)0);}
    }
    public Cipher beginUnlock()throws Exception{
        KeyStore s=KeyStore.getInstance("AndroidKeyStore");s.load(null);SecretKey key=(SecretKey)s.getKey(ALIAS,null);
        if(key==null)throw new Exception("Sblocca con la password e riattiva la biometria.");
        Cipher c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.DECRYPT_MODE,key,new GCMParameterSpec(128,VaultStore.un64(prefs.getString("iv",""))));return c;
    }
    public char[] finishUnlock(Cipher cipher)throws Exception{
        cipher.updateAAD(AAD);byte[] plain=cipher.doFinal(VaultStore.un64(prefs.getString("cipher","")));
        try{return new String(plain,StandardCharsets.UTF_8).toCharArray();}finally{Arrays.fill(plain,(byte)0);}
    }
    public static String failureMessage(Exception error){
        for(Throwable cause=error;cause!=null;cause=cause.getCause()){
            if(cause instanceof android.security.keystore.KeyPermanentlyInvalidatedException)
                return "La registrazione biometrica del telefono è cambiata. Sblocca con la password, disattiva e riattiva la biometria.";
            if(cause instanceof android.security.keystore.UserNotAuthenticatedException)
                return "Android non ha autorizzato la chiave. Riprova la verifica sul sensore; puoi sempre usare la password.";
        }
        // Report only the exception type, never vault data or provider payloads.
        return "Verifica biometrica non completata ("+error.getClass().getSimpleName()+"). Riprova o sblocca con la password.";
    }
    public String availabilityMessage(){
        int result=availability();
        if(result==BiometricManager.BIOMETRIC_SUCCESS)return "Usa il sensore di impronte o il riconoscimento del volto supportato da Android.";
        if(result==BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED)return "Registra prima un’impronta nelle impostazioni di sicurezza del telefono.";
        if(result==BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE)return "Sensore momentaneamente non disponibile. Riprova tra poco.";
        return "Android non espone un sensore biometrico adatto a proteggere l’archivio. Puoi usare la password.";
    }
}
