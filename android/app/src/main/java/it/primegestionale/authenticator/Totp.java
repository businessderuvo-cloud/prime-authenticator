package it.primegestionale.authenticator;

import android.net.Uri;
import org.json.JSONObject;
import java.nio.ByteBuffer;
import java.util.Locale;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

public final class Totp {
    public static JSONObject parse(String text) throws Exception {
        Uri u=Uri.parse(text.trim());
        if(!"otpauth".equals(u.getScheme())||!"totp".equals(u.getHost()))throw new Exception("Scansiona un QR PRIME o TOTP.");
        String label=u.getPath()==null?"Account":u.getPath().substring(1),issuer=u.getQueryParameter("issuer");
        String[] parts=label.split(":",2);
        JSONObject r=new JSONObject().put("id",UUID.randomUUID().toString()).put("issuer",issuer==null?parts[0]:issuer)
            .put("account",parts.length>1?parts[1]:label).put("secret",value(u,"secret","").replaceAll("\\s","").toUpperCase(Locale.ROOT))
            .put("algorithm",value(u,"algorithm","SHA1").toUpperCase(Locale.ROOT)).put("digits",Integer.parseInt(value(u,"digits","6")))
            .put("period",Integer.parseInt(value(u,"period","30")));
        validate(r);return r;
    }
    private static String value(Uri u,String k,String fallback){String v=u.getQueryParameter(k);return v==null?fallback:v;}
    static void validate(JSONObject r) throws Exception {
        if(!r.optString("secret").matches("[A-Z2-7]{16,128}")||!r.optString("algorithm").matches("SHA(1|256|512)")
            ||(r.optInt("digits")!=6&&r.optInt("digits")!=8)||r.optInt("period")<15||r.optInt("period")>120)
            throw new Exception("Parametri TOTP non validi.");
    }
    public static String code(JSONObject r,long millis) throws Exception {
        validate(r);int bits=0,data=0,n=0;byte[] secret=new byte[r.getString("secret").length()*5/8];
        for(char c:r.getString("secret").toCharArray()){data=(data<<5)|"ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".indexOf(c);bits+=5;if(bits>=8){secret[n++]=(byte)(data>>>(bits-8));bits-=8;}}
        Mac mac=Mac.getInstance("Hmac"+r.getString("algorithm"));mac.init(new SecretKeySpec(secret,mac.getAlgorithm()));
        byte[] hash=mac.doFinal(ByteBuffer.allocate(8).putLong(millis/1000/r.getInt("period")).array());int o=hash[hash.length-1]&15;
        int value=((hash[o]&127)<<24)|((hash[o+1]&255)<<16)|((hash[o+2]&255)<<8)|(hash[o+3]&255);
        int digits=r.getInt("digits"),mod=digits==8?100000000:1000000;return String.format(Locale.ROOT,"%0"+digits+"d",value%mod);
    }
}
