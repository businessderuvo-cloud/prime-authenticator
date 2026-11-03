package it.primegestionale.authenticator;

import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.*;
import android.provider.Settings;
import android.text.InputType;
import android.view.*;
import android.widget.*;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;
import com.journeyapps.barcodescanner.ScanContract;
import com.journeyapps.barcodescanner.ScanOptions;
import org.json.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;
import javax.crypto.Cipher;

/** Entire application UI is Android Views. There is no WebView, TWA or browser launcher. */
public final class MainActivity extends FragmentActivity {
    private static final int GOLD=Color.rgb(211,189,136), WHITE=Color.rgb(239,239,242), MUTED=Color.rgb(173,173,182);
    private final Handler handler=new Handler(Looper.getMainLooper());
    private final ExecutorService worker=Executors.newSingleThreadExecutor();
    private VaultStore store;private BiometricLock biometric;private BiometricPrompt prompt;
    private LinearLayout page,codes;private TextView status;private EditText passwordInput,confirmInput;
    private JSONArray entries=new JSONArray();private char[] password;private int generation=0;private boolean busy=false,externalFlow=false,biometricPending=false;
    private long activeAt;private String pendingQr,exportEnvelope;private AlertDialog qrDialog;private boolean stopped=true;
    private final Map<TextView,JSONObject> codeLabels=new HashMap<>();
    private final ActivityResultLauncher<ScanOptions> scanner=registerForActivityResult(new ScanContract(), result->{
        externalFlow=false;
        if(password==null)return;
        if(SystemClock.elapsedRealtime()-activeAt>60000){lock();notice("Archivio bloccato. Sbloccalo e ripeti la scansione.");return;}
        activeAt=SystemClock.elapsedRealtime();if(result.getContents()!=null)handleQr(result.getContents());
    });
    private final ActivityResultLauncher<String[]> importer=registerForActivityResult(new ActivityResultContracts.OpenDocument(),uri->{
        externalFlow=false;lock();if(uri!=null)readBackup(uri);
    });
    private final ActivityResultLauncher<String> exporter=registerForActivityResult(new ActivityResultContracts.CreateDocument("application/json"),uri->{
        externalFlow=false;String data=exportEnvelope;exportEnvelope=null;
        if(uri!=null&&data!=null){worker.execute(()->{try(OutputStream out=getContentResolver().openOutputStream(uri)){if(out==null)throw new IOException();out.write(data.getBytes(StandardCharsets.UTF_8));handler.post(()->notice("Backup cifrato salvato. Conservalo con la sua password."));}catch(Exception e){handler.post(()->notice("Impossibile salvare il backup."));}});}
        lock();
    });
    @Override public void onCreate(Bundle state){super.onCreate(state);getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);store=new VaultStore(this);biometric=new BiometricLock(this);readIntent(getIntent());showLock();handler.post(tick);}
    @Override protected void onNewIntent(Intent intent){super.onNewIntent(intent);setIntent(intent);readIntent(intent);if(password!=null)resumeQr();}
    private void readIntent(Intent intent){if(intent.getData()!=null){try{PrimeProtocol.parse(intent.getData().toString());pendingQr=intent.getData().toString();}catch(Exception ignored){pendingQr=null;}}}
    @Override protected void onResume(){super.onResume();stopped=false;if(password!=null&&SystemClock.elapsedRealtime()-activeAt>60000)lock();}
    @Override protected void onStop(){super.onStop();stopped=true;if(!externalFlow)lock();}
    @Override protected void onDestroy(){handler.removeCallbacksAndMessages(null);if(prompt!=null)prompt.cancelAuthentication();wipe();worker.shutdownNow();super.onDestroy();}
    @Override public boolean dispatchTouchEvent(android.view.MotionEvent event){activeAt=SystemClock.elapsedRealtime();return super.dispatchTouchEvent(event);}
    @Override public void onUserInteraction(){super.onUserInteraction();activeAt=SystemClock.elapsedRealtime();}
    @Override public void onBackPressed(){if(password!=null){lock();return;}super.onBackPressed();}
    private final Runnable tick=new Runnable(){public void run(){if(password!=null&&!biometricPending&&SystemClock.elapsedRealtime()-activeAt>60000)lock();else updateCodes();handler.postDelayed(this,1000);}};
    private void wipe(){if(password!=null)Arrays.fill(password,'\0');password=null;entries=new JSONArray();codeLabels.clear();}
    private void lock(){generation++;busy=false;if(prompt!=null)prompt.cancelAuthentication();biometricPending=false;wipe();if(qrDialog!=null){qrDialog.dismiss();qrDialog=null;}if(page!=null)showLock();}
    private int dp(int n){return Math.round(n*getResources().getDisplayMetrics().density);}
    private GradientDrawable background(int color,int stroke){GradientDrawable g=new GradientDrawable();g.setColor(color);g.setCornerRadius(dp(14));if(stroke!=0)g.setStroke(dp(1),stroke);return g;}
    private LinearLayout vertical(){LinearLayout l=new LinearLayout(this);l.setOrientation(LinearLayout.VERTICAL);return l;}
    private TextView text(String value,int size,int color){TextView t=new TextView(this);t.setText(value);t.setTextSize(size);t.setTextColor(color);t.setPadding(0,dp(6),0,dp(8));return t;}
    private void root(){
        codeLabels.clear();ScrollView scroll=new ScrollView(this);scroll.setFillViewport(true);scroll.setBackgroundColor(Color.rgb(17,17,17));page=vertical();page.setPadding(dp(24),dp(34),dp(24),dp(34));scroll.addView(page);setContentView(scroll);
        LinearLayout brand=new LinearLayout(this);brand.setGravity(Gravity.CENTER_VERTICAL);ImageView icon=new ImageView(this);icon.setImageResource(it.primegestionale.authenticator.R.mipmap.ic_launcher);brand.addView(icon,new LinearLayout.LayoutParams(dp(52),dp(52)));
        LinearLayout title=vertical();title.setPadding(dp(14),0,0,0);title.addView(text("PRIME",12,GOLD));TextView heading=text("Authenticator",24,WHITE);heading.setTypeface(null,Typeface.BOLD);title.addView(heading);brand.addView(title);page.addView(brand);
        page.addView(text("Scansiona. Approva. Entra.",25,WHITE));status=text("",15,GOLD);status.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);page.addView(status);
    }
    private LinearLayout panel(String heading){LinearLayout p=vertical();p.setPadding(dp(20),dp(18),dp(20),dp(20));p.setBackground(background(Color.rgb(29,29,29),Color.rgb(57,57,57)));LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,-2);lp.setMargins(0,dp(12),0,dp(12));page.addView(p,lp);if(heading!=null)p.addView(text(heading,21,WHITE));return p;}
    private Button button(LinearLayout parent,String label,boolean primary,Runnable action){Button b=new Button(this);b.setText(label);b.setAllCaps(false);b.setTextSize(15);b.setTextColor(primary?Color.rgb(25,22,15):WHITE);b.setBackground(background(primary?GOLD:Color.rgb(45,45,45),primary?0:Color.rgb(76,76,76)));LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,dp(52));lp.setMargins(0,dp(12),0,0);parent.addView(b,lp);b.setOnClickListener(v->{activeAt=SystemClock.elapsedRealtime();if(!busy)action.run();});return b;}
    private EditText field(LinearLayout parent,String hint,boolean secret){EditText f=new EditText(this);f.setSingleLine(true);f.setTextSize(16);f.setTextColor(WHITE);f.setHintTextColor(MUTED);f.setHint(hint);f.setPadding(dp(12),dp(12),dp(12),dp(12));f.setInputType(secret?InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_PASSWORD:InputType.TYPE_CLASS_TEXT);if(Build.VERSION.SDK_INT>=26)f.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_NO);f.setBackground(background(Color.rgb(18,18,18),Color.rgb(69,69,69)));LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,dp(55));lp.setMargins(0,dp(12),0,0);parent.addView(f,lp);return f;}
    private void notice(String message){if(status!=null)status.setText(message);}
    private void showLock(){root();LinearLayout p=panel(store.exists()?"Sblocca il tuo archivio":"Crea il tuo archivio");p.addView(text("Archivio cifrato salvato su questo telefono.",14,MUTED));passwordInput=field(p,"Password archivio (almeno 12 caratteri)",true);confirmInput=store.exists()?null:field(p,"Ripeti la password",true);button(p,store.exists()?"Sblocca":"Crea archivio",true,this::unlockPassword);
        if(store.exists()&&biometric.enabled())button(p,"Sblocca con impronta / volto",false,()->authenticate(false));
        button(p,"Importa backup cifrato",false,()->{externalFlow=true;importer.launch(new String[]{"application/json","text/plain","application/octet-stream"});});
        page.addView(text("Prima usavi la versione web? Esporta lì un backup cifrato e importalo qui con la stessa password.",13,MUTED));page.addView(text("Android nativa · 1.0.1",12,MUTED));
    }
    private interface Work<T>{T run()throws Exception;}
    private interface Result<T>{void run(T value)throws Exception;}
    private <T> void task(String message,Work<T> work,Result<T> done){
        if(busy)return;busy=true;notice(message);final int g=generation;
        worker.execute(()->{try{T value=work.run();handler.post(()->{if(g!=generation||isDestroyed())return;busy=false;try{done.run(value);}catch(Exception e){notice(error(e));}});}catch(Exception e){handler.post(()->{if(g==generation&&!isDestroyed()){busy=false;notice(error(e));}});}});
    }
    private String error(Exception e){String value=e.getMessage();return value==null?"Operazione non riuscita. Riprova.":value;}
    private void unlockPassword(){
        char[] input=passwordInput.getText().toString().toCharArray();boolean fresh=!store.exists();
        if(input.length<12){Arrays.fill(input,'\0');notice("Usa una password di almeno 12 caratteri.");return;}
        if(fresh&&!Arrays.equals(input,confirmInput.getText().toString().toCharArray())){Arrays.fill(input,'\0');notice("Le password non coincidono.");return;}
        final int g=generation;passwordInput.setText("");if(confirmInput!=null)confirmInput.setText("");
        task("Apertura archivio…",()->{try{JSONArray rows=fresh?new JSONArray():store.unlock(input);if(fresh)store.save(rows,input);return rows;}catch(Exception e){Arrays.fill(input,'\0');throw e;}finally{if(g!=generation)Arrays.fill(input,'\0');}},rows->{password=input;entries=rows;activeAt=SystemClock.elapsedRealtime();showVault();resumeQr();});
    }
    private void showVault(){
        root();LinearLayout actions=panel(null);button(actions,"Scansiona QR",true,()->{externalFlow=true;scanner.launch(new ScanOptions().setDesiredBarcodeFormats(ScanOptions.QR_CODE).setPrompt("Inquadra il QR PRIME o TOTP").setBeepEnabled(false).setCaptureActivity(PortraitCaptureActivity.class).setOrientationLocked(true));});
        button(actions,"Incolla QR o chiave",false,this::manualQr);button(actions,"Esporta backup cifrato",false,()->{try{exportEnvelope=store.backup();externalFlow=true;exporter.launch("prime-authenticator-backup.json");}catch(Exception e){notice(error(e));}});button(actions,"Blocca archivio",false,this::lock);
        LinearLayout bio=panel("Impronta e riconoscimento volto");bio.addView(text(biometric.enabled()?"Sblocco biometrico Android attivo.":biometric.availabilityMessage(),14,MUTED));
        button(bio,biometric.enabled()?"Disattiva biometria":"Attiva biometria sul telefono",false,()->{if(biometric.enabled()){try{biometric.disable();showVault();notice("Sblocco biometrico disattivato.");}catch(Exception e){notice(error(e));}}else authenticate(true);});
        codes=panel("I tuoi account");if(entries.length()==0)codes.addView(text("Per abbinare PRIME, apri Sicurezza account → Accesso con QR → Abbina dispositivo, poi scansiona il QR qui.",15,MUTED));
        for(int i=0;i<entries.length();i++){try{JSONObject row=entries.getJSONObject(i);LinearLayout card=vertical();card.setPadding(0,dp(14),0,dp(14));card.addView(text(row.optString("issuer","PRIME"),18,WHITE));card.addView(text(row.optString("account",""),14,MUTED));if("prime-device".equals(row.optString("type"))){card.addView(text(row.optBoolean("paired",true)?"Abbinato · scansiona un QR di accesso":"Abbinamento da confermare in PRIME",15,GOLD));if(!row.optBoolean("paired",true))button(card,"Verifica conferma",false,()->checkPairing(row));}else{TextView code=text("",36,GOLD);code.setTypeface(Typeface.MONOSPACE);card.addView(code);codeLabels.put(code,row);}final int index=i;button(card,"Rimuovi account",false,()->new AlertDialog.Builder(this).setTitle("Rimuovere questo account?").setMessage("Conserva prima un backup. Per PRIME puoi revocare il dispositivo anche dal gestionale.").setNegativeButton("Annulla",null).setPositiveButton("Rimuovi",(d,w)->{try{JSONArray next=new JSONArray(entries.toString());next.remove(index);persist(next,"Account rimosso.",null);}catch(Exception e){notice(error(e));}}).show());codes.addView(card);}catch(Exception e){notice(error(e));}}
        updateCodes();page.addView(text("Codici offline · blocco automatico quando esci o dopo un minuto di inattività.",13,MUTED));
    }
    private void updateCodes(){if(password==null)return;for(Map.Entry<TextView,JSONObject> row:codeLabels.entrySet()){try{String code=Totp.code(row.getValue(),System.currentTimeMillis());row.getKey().setText(code.substring(0,code.length()/2)+" "+code.substring(code.length()/2));}catch(Exception e){row.getKey().setText("—");}}}
    private void persist(JSONArray next,String message,Runnable after){if(password==null)return;char[] copy=password.clone();task("Salvataggio cifrato…",()->{try{store.save(next,copy);return next;}finally{Arrays.fill(copy,'\0');}},rows->{entries=rows;showVault();notice(message);if(after!=null)after.run();});}
    private void authenticate(boolean enabling){
        if(biometricPending||busy)return;
        if(biometric.availability()!=BiometricManager.BIOMETRIC_SUCCESS){new AlertDialog.Builder(this).setTitle("Biometria Android").setMessage(biometric.availabilityMessage()).setNegativeButton("Chiudi",null).setPositiveButton("Impostazioni telefono",(d,w)->{try{startActivity(new Intent(Build.VERSION.SDK_INT>=30?Settings.ACTION_BIOMETRIC_ENROLL:Settings.ACTION_SECURITY_SETTINGS));}catch(Exception e){notice("Apri le impostazioni di sicurezza del telefono.");}}).show();return;}
        final int g=generation;
        try{
            Cipher cipher=enabling?biometric.beginEnable():biometric.beginUnlock();biometricPending=true;
            prompt=new BiometricPrompt(this,ContextCompat.getMainExecutor(this),new BiometricPrompt.AuthenticationCallback(){
                @Override public void onAuthenticationError(int code,CharSequence message){if(g!=generation)return;biometricPending=false;notice("Verifica Android: "+message+". La password resta disponibile.");}
                @Override public void onAuthenticationFailed(){if(g==generation)notice("Impronta o volto non riconosciuto. Riprova sul sensore.");}
                @Override public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result){
                    if(g!=generation||stopped)return;biometricPending=false;
                    try{Cipher verified=result.getCryptoObject()==null?null:result.getCryptoObject().getCipher();if(verified==null)throw new Exception("Verifica crittografica Android non completata.");
                        if(enabling){if(password==null)throw new Exception("Sblocca prima l’archivio.");biometric.finishEnable(verified,password);activeAt=SystemClock.elapsedRealtime();showVault();notice("Biometria Android attivata. Ora puoi bloccare e sbloccare con il sensore.");}
                        else{char[] recovered=biometric.finishUnlock(verified);task("Apertura archivio…",()->{try{return store.unlock(recovered);}catch(Exception e){Arrays.fill(recovered,'\0');throw e;}finally{if(g!=generation)Arrays.fill(recovered,'\0');}},rows->{password=recovered;entries=rows;activeAt=SystemClock.elapsedRealtime();showVault();notice("Archivio sbloccato con la biometria Android.");resumeQr();});}
                    }catch(Exception e){notice(BiometricLock.failureMessage(e));}
                }
            });
            prompt.authenticate(new BiometricPrompt.PromptInfo.Builder().setTitle(enabling?"Attiva biometria PRIME":"Sblocca PRIME Authenticator").setSubtitle("Usa il sensore del telefono").setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG).setNegativeButtonText("Usa password").build(),new BiometricPrompt.CryptoObject(cipher));
        }catch(Exception e){biometricPending=false;notice(BiometricLock.failureMessage(e));}
    }
    private void readBackup(Uri uri){task("Lettura backup…",()->{try(InputStream in=getContentResolver().openInputStream(uri)){if(in==null)throw new Exception("File non disponibile.");ByteArrayOutputStream bytes=new ByteArrayOutputStream();byte[] buf=new byte[4096];int n;while((n=in.read(buf))!=-1){bytes.write(buf,0,n);if(bytes.size()>600000)throw new Exception("Backup troppo grande.");}return new String(bytes.toByteArray(),StandardCharsets.UTF_8);}},this::importBackup);}
    private void importBackup(String envelope){
        LinearLayout box=vertical();box.setPadding(dp(20),0,dp(20),0);box.addView(text("Inserisci la password usata per creare il backup. L’archivio locale sarà sostituito dopo la verifica.",14,MUTED));EditText input=field(box,"Password del backup",true);
        new AlertDialog.Builder(this).setTitle("Importa archivio PRIME").setView(box).setNegativeButton("Annulla",null).setPositiveButton("Verifica e importa",(d,w)->{char[] copy=input.getText().toString().toCharArray();input.setText("");task("Verifica del backup cifrato…",()->{try{JSONArray rows=VaultStore.decrypt(envelope,copy);store.write(envelope);biometric.disable();return rows;}finally{Arrays.fill(copy,'\0');}},rows->{showLock();notice("Backup importato. Sbloccalo e attiva la biometria Android.");});}).show();
    }
    private void manualQr(){LinearLayout box=vertical();box.setPadding(dp(20),0,dp(20),0);EditText value=field(box,"QR PRIME, URI otpauth o chiave",false);EditText account=field(box,"Nome account (per chiave manuale)",false);new AlertDialog.Builder(this).setTitle("Aggiungi account").setView(box).setNegativeButton("Annulla",null).setPositiveButton("Continua",(d,w)->{String raw=value.getText().toString().trim();if(raw.matches("(?i)[A-Z2-7 ]{16,160}")){raw="otpauth://totp/"+Uri.encode(account.getText().toString().trim().isEmpty()?"PRIME:Account":account.getText().toString())+"?secret="+raw.replace(" ","").toUpperCase(Locale.ROOT)+"&issuer=PRIME";}handleQr(raw);}).show();}
    private void resumeQr(){if(pendingQr!=null){String value=pendingQr;pendingQr=null;handleQr(value);}}
    private void handleQr(String value){if(password==null){pendingQr=value;notice("Sblocca l’archivio per continuare.");return;}try{if(value.startsWith("otpauth:")){JSONObject row=Totp.parse(value);JSONArray next=new JSONArray(entries.toString());if(next.length()>=100)throw new Exception("Massimo 100 account.");for(int i=0;i<next.length();i++)if(row.optString("secret").equals(next.getJSONObject(i).optString("secret"))&&row.optString("account").equals(next.getJSONObject(i).optString("account")))throw new Exception("Questo account è già presente.");next.put(row);persist(next,"Account aggiunto.",null);return;}PrimeProtocol.Qr q=PrimeProtocol.parse(value);if("pair".equals(q.action))pair(q);else login(q);}catch(Exception e){notice(error(e));}}
    private void pair(PrimeProtocol.Qr q){new AlertDialog.Builder(this).setTitle("Abbina questo telefono a PRIME").setMessage("Avvia l’abbinamento dal tuo account PRIME. Dopo la scansione confronta l’impronta sul gestionale e conferma il dispositivo.").setNegativeButton("Annulla",null).setPositiveButton("Abbina",(dialog,which)->{
        task("Abbinamento in corso…",()->{JSONObject keys=PrimeProtocol.newDevice(),reply=PrimeProtocol.api("pair/submit",new JSONObject().put("id",q.id).put("token",q.secret).put("label","PRIME Android · "+Build.MANUFACTURER+" "+Build.MODEL).put("public_key",keys.getJSONObject("public_key")));return keys.put("reply",reply);},keys->{JSONObject r=keys.getJSONObject("reply"),entry=new JSONObject().put("type","prime-device").put("paired",false).put("id",r.getString("device_id")).put("account",r.getString("account")).put("issuer","PRIME").put("origin",PrimeProtocol.ORIGIN).put("pair_id",q.id).put("pair_token",q.secret).put("fingerprint",r.getString("fingerprint")).put("private_key",keys.getJSONObject("private_key")).put("public_key",keys.getJSONObject("public_key"));JSONArray next=new JSONArray(entries.toString());next.put(entry);persist(next,"Conferma questo dispositivo nel gestionale.",()->showPairing(entry));});}).show();}
    private void showPairing(JSONObject entry){qrDialog=new AlertDialog.Builder(this).setTitle("Confronta l’impronta in PRIME").setMessage(entry.optString("fingerprint")+"\n\n"+entry.optString("account")+"\n\nPremi Conferma dispositivo nel gestionale, poi Verifica qui.").setNegativeButton("Chiudi",null).setPositiveButton("Verifica",(d,w)->checkPairing(entry)).show();}
    private void checkPairing(JSONObject entry){task("Verifica conferma PRIME…",()->PrimeProtocol.api("pair/status",new JSONObject().put("id",entry.getString("pair_id")).put("token",entry.getString("pair_token"))),reply->{if(!"confirmed".equals(reply.optString("status"))){showPairing(entry);notice("Conferma prima il dispositivo sul gestionale.");return;}JSONArray next=new JSONArray(entries.toString());for(int i=0;i<next.length();i++){JSONObject row=next.getJSONObject(i);if(row.optString("id").equals(entry.getString("id"))){row.put("paired",true);row.remove("pair_id");row.remove("pair_token");}}persist(next,"Dispositivo abbinato. Ora puoi approvare gli accessi con QR.",null);});}
    private void login(PrimeProtocol.Qr q){
        ArrayList<JSONObject> devices=new ArrayList<>();for(int i=0;i<entries.length();i++){JSONObject r=entries.optJSONObject(i);if(r!=null&&"prime-device".equals(r.optString("type"))&&r.optBoolean("paired",true)&&PrimeProtocol.ORIGIN.equals(r.optString("origin")))devices.add(r);}
        if(devices.isEmpty()){notice("Abbina prima questo telefono da PRIME → Sicurezza account → Accesso con QR.");return;}
        task("Lettura richiesta PRIME…",()->{JSONObject r=PrimeProtocol.api("details",new JSONObject().put("id",q.id).put("nonce",q.secret));PrimeProtocol.validateDetails(q,r);return r;},details->{String[] labels=new String[devices.size()];for(int i=0;i<labels.length;i++)labels[i]=devices.get(i).optString("account");final int[] selected={0};qrDialog=new AlertDialog.Builder(this).setTitle("Autorizzi questo accesso?").setMessage(details.getString("browser")+"\n"+PrimeProtocol.ORIGIN+"\n\nNumero da confrontare: "+details.getString("match_code")+"\n\nApprova solo un accesso che hai avviato tu.").setNegativeButton("Annulla",null).setPositiveButton("Scegli account",(d,w)->{qrDialog=new AlertDialog.Builder(this).setTitle("Account PRIME").setSingleChoiceItems(labels,0,(dialog,index)->selected[0]=index).setNegativeButton("Annulla",null).setPositiveButton("Approva accesso",(dialog,which)->approve(q,details,devices.get(selected[0]))).show();}).show();});
    }
    private void approve(PrimeProtocol.Qr q,JSONObject details,JSONObject device){task("Approvazione accesso…",()->{PrimeProtocol.validateDetails(q,details);return PrimeProtocol.api("approve",new JSONObject().put("id",q.id).put("nonce",q.secret).put("device_id",device.getString("id")).put("signature",PrimeProtocol.sign(device,details.getString("message"))));},r->notice("Accesso approvato. PRIME si aprirà sul dispositivo che ha mostrato il QR."));}
}
