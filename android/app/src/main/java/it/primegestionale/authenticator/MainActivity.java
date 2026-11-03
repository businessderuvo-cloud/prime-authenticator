package it.primegestionale.authenticator;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;

import androidx.browser.customtabs.CustomTabsIntent;

public final class MainActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Uri appUrl = Uri.parse(getString(R.string.authenticator_url));
        CustomTabsIntent browser = new CustomTabsIntent.Builder()
                .setShowTitle(true)
                .setToolbarColor(Color.rgb(20, 20, 20))
                .build();

        try {
            browser.launchUrl(this, appUrl);
        } catch (ActivityNotFoundException noCustomTabsProvider) {
            startActivity(new Intent(Intent.ACTION_VIEW, appUrl));
        }
        finish();
    }
}
