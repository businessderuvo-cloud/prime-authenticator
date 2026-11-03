package it.primegestionale.authenticator;

import android.net.Uri;
import android.util.Base64;
import org.json.JSONObject;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.math.BigInteger;
import java.security.*;
import java.security.interfaces.*;
import java.security.spec.*;
import java.util.Arrays;

public final class PrimeProtocol {
    public static final String ORIGIN="https://primegestionale.it";
    public static final class Qr {
        public final String action,id,secret;
        Qr(String a,String i,String s){action=a;id=i;secret=s;}
    }
    public static Qr parse(String value) throws Exception {
        URI u=new URI(value.trim());
        if(!"https".equals(u.getScheme())||!"primegestionale.it".equals(u.getHost())||(u.getPort()!=-1&&u.getPort()!=443)
            ||u.getUserInfo()!=null||!"/authenticator/".equals(u.getPath()))throw new Exception("QR PRIME non valido.");
        String fragment=u.getRawFragment();if(fragment==null)throw new Exception("Il QR non contiene una richiesta PRIME.");
        Uri params=Uri.parse("https://prime.invalid/?"+fragment);
        for(String action:new String[]{"pair","login"}){
            String token=params.getQueryParameter("prime-"+action);
            if(token!=null){String[] parts=token.split("\\.");if(parts.length!=2||!parts[0].matches("[A-Za-z0-9_-]{43}")||!parts[1].matches("[A-Za-z0-9_-]{43}"))throw new Exception("QR PRIME non valido.");return new Qr(action,parts[0],parts[1]);}
        }
        throw new Exception("QR PRIME non riconosciuto.");
    }
    public static JSONObject api(String action,JSONObject body) throws Exception {
        if(!action.matches("pair/submit|pair/status|details|approve"))throw new Exception("Operazione non consentita.");
        HttpURLConnection c=(HttpURLConnection)new URL(ORIGIN+"/api/auth/qr/"+action).openConnection();
        try {
            c.setInstanceFollowRedirects(false);c.setConnectTimeout(15000);c.setReadTimeout(20000);c.setRequestMethod("POST");c.setDoOutput(true);
            c.setRequestProperty("Content-Type","application/json; charset=utf-8");c.setRequestProperty("Origin",ORIGIN);c.setRequestProperty("User-Agent","PRIME-Authenticator-Android/1.0.0");
            try(OutputStream out=c.getOutputStream()){out.write(body.toString().getBytes(StandardCharsets.UTF_8));}
            int status=c.getResponseCode();InputStream stream=status>=400?c.getErrorStream():c.getInputStream();if(stream==null)throw new Exception("Servizio PRIME non disponibile ("+status+").");
            ByteArrayOutputStream bytes=new ByteArrayOutputStream();try(InputStream in=stream){byte[] b=new byte[4096];int n;while((n=in.read(b))!=-1){bytes.write(b,0,n);if(bytes.size()>65536)throw new Exception("Risposta PRIME non valida.");}}
            JSONObject result=new JSONObject(new String(bytes.toByteArray(),StandardCharsets.UTF_8));
            if(status<200||status>=300)throw new Exception(result.optString("error","Richiesta PRIME non riuscita."));return result;
        } catch(UnknownHostException|SocketTimeoutException e){throw new Exception("Connessione a PRIME non disponibile. I codici TOTP restano utilizzabili offline.");}
        finally{c.disconnect();}
    }
    static String url64(byte[] b){return Base64.encodeToString(b,Base64.URL_SAFE|Base64.NO_WRAP|Base64.NO_PADDING);}
    static byte[] fromUrl(String b){return Base64.decode(b,Base64.URL_SAFE|Base64.NO_WRAP|Base64.NO_PADDING);}
    private static byte[] fixed(BigInteger n){byte[] raw=n.toByteArray(),out=new byte[32];System.arraycopy(raw,Math.max(0,raw.length-32),out,Math.max(0,32-raw.length),Math.min(32,raw.length));return out;}
    public static JSONObject newDevice() throws Exception {
        KeyPairGenerator g=KeyPairGenerator.getInstance("EC");g.initialize(new ECGenParameterSpec("secp256r1"));KeyPair k=g.generateKeyPair();
        ECPublicKey pub=(ECPublicKey)k.getPublic();ECPrivateKey priv=(ECPrivateKey)k.getPrivate();
        JSONObject publicKey=new JSONObject().put("kty","EC").put("crv","P-256").put("x",url64(fixed(pub.getW().getAffineX()))).put("y",url64(fixed(pub.getW().getAffineY())));
        return new JSONObject().put("public_key",publicKey).put("private_key",new JSONObject(publicKey.toString()).put("d",url64(fixed(priv.getS()))));
    }
    private static ECParameterSpec parameters()throws Exception{AlgorithmParameters p=AlgorithmParameters.getInstance("EC");p.init(new ECGenParameterSpec("secp256r1"));return p.getParameterSpec(ECParameterSpec.class);}
    static void validateDevice(JSONObject row)throws Exception{
        if(!row.optString("id").matches("[A-Za-z0-9_-]{43}")||!ORIGIN.equals(row.optString("origin")))throw new Exception("Account PRIME non valido.");
        JSONObject pub=row.getJSONObject("public_key"),priv=row.getJSONObject("private_key");
        for(JSONObject k:new JSONObject[]{pub,priv})if(!"EC".equals(k.optString("kty"))||!"P-256".equals(k.optString("crv"))||fromUrl(k.getString("x")).length!=32||fromUrl(k.getString("y")).length!=32)throw new Exception("Chiave PRIME non valida.");
        if(pub.has("d")||fromUrl(priv.getString("d")).length!=32)throw new Exception("Chiave privata non valida.");
        KeyFactory factory=KeyFactory.getInstance("EC");ECParameterSpec p=parameters();
        PrivateKey sk=factory.generatePrivate(new ECPrivateKeySpec(new BigInteger(1,fromUrl(priv.getString("d"))),p));
        PublicKey pk=factory.generatePublic(new ECPublicKeySpec(new ECPoint(new BigInteger(1,fromUrl(pub.getString("x"))),new BigInteger(1,fromUrl(pub.getString("y")))),p));
        Signature sig=Signature.getInstance("SHA256withECDSA");sig.initSign(sk);sig.update(new byte[]{1,2,3});byte[] proof=sig.sign();sig.initVerify(pk);sig.update(new byte[]{1,2,3});if(!sig.verify(proof))throw new Exception("Le chiavi del dispositivo non corrispondono.");
    }
    public static void validateDetails(Qr q,JSONObject details)throws Exception{
        JSONObject message=new JSONObject(details.getString("message"));
        if(!ORIGIN.equals(details.getString("origin"))||!ORIGIN.equals(message.getString("origin"))||!"prime-qr-login-v1".equals(message.getString("protocol"))
            ||!q.id.equals(message.getString("id"))||!q.secret.equals(message.getString("nonce"))||message.getLong("expires_at")<=System.currentTimeMillis()
            ||!message.getString("match_code").equals(details.getString("match_code"))||!message.getString("browser").equals(details.getString("browser")))throw new Exception("Richiesta di accesso scaduta o non valida.");
    }
    public static String sign(JSONObject entry,String message)throws Exception{
        JSONObject k=entry.getJSONObject("private_key");PrivateKey key=KeyFactory.getInstance("EC").generatePrivate(new ECPrivateKeySpec(new BigInteger(1,fromUrl(k.getString("d"))),parameters()));
        Signature s=Signature.getInstance("SHA256withECDSA");s.initSign(key);s.update(message.getBytes(StandardCharsets.UTF_8));return url64(p1363(s.sign()));
    }
    static byte[] p1363(byte[] der)throws Exception{
        if(der.length<8||der[0]!=0x30||der[2]!=0x02)throw new Exception("Firma non valida.");
        int rlen=der[3]&255,si=4+rlen;if(si+2>=der.length||der[si]!=0x02)throw new Exception("Firma non valida.");int slen=der[si+1]&255;
        byte[] r=Arrays.copyOfRange(der,4,4+rlen),s=Arrays.copyOfRange(der,si+2,si+2+slen),out=new byte[64];
        System.arraycopy(fixed(new BigInteger(1,r)),0,out,0,32);System.arraycopy(fixed(new BigInteger(1,s)),0,out,32,32);return out;
    }
}
