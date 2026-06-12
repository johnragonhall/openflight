package com.openflight.mobile

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.Log

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

import expo.modules.ReactActivityDelegateWrapper

class MainActivity : ReactActivity() {

  companion object {
    private const val TAG = "OpenFlight"
    private const val APP_SCHEME = "com.openflight.mobile"

    // Allowlist of paths that may be opened via deep link.
    // Any incoming URI whose path is not in this set is silently dropped.
    private val ALLOWED_PATHS = setOf(
      "/",
      "/home",
      "/range",
      "/history",
      "/stats",
      "/course",
      "/settings",
      "/connection",
    )

    private fun isSafeDeepLink(uri: Uri): Boolean {
      // Must use the app's own scheme — reject http/https/javascript/etc.
      if (uri.scheme != APP_SCHEME) return false
      // Reject any URI carrying a host (e.g. com.openflight.mobile://attacker.com/...)
      // Deep links for this app are path-only.
      if (!uri.host.isNullOrEmpty() && uri.host != APP_SCHEME) return false
      val path = uri.path ?: "/"
      return ALLOWED_PATHS.contains(path)
    }
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    setTheme(R.style.AppTheme)
    // Validate any deep-link URI before passing control to React Native.
    sanitiseIntent(intent)
    super.onCreate(null)
  }

  override fun onNewIntent(intent: Intent) {
    sanitiseIntent(intent)
    super.onNewIntent(intent)
  }

  private fun sanitiseIntent(intent: Intent?) {
    if (intent?.action != Intent.ACTION_VIEW) return
    val uri = intent.data ?: return
    if (!isSafeDeepLink(uri)) {
      Log.w(TAG, "Blocked unsafe deep-link URI: $uri")
      // Clear the data so React Navigation never sees it.
      intent.data = null
    }
  }

  override fun getMainComponentName(): String = "main"

  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return ReactActivityDelegateWrapper(
      this,
      BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
      object : DefaultReactActivityDelegate(
        this,
        mainComponentName,
        fabricEnabled
      ) {}
    )
  }

  override fun invokeDefaultOnBackPressed() {
    if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
      if (!moveTaskToBack(false)) {
        super.invokeDefaultOnBackPressed()
      }
      return
    }
    super.invokeDefaultOnBackPressed()
  }
}
