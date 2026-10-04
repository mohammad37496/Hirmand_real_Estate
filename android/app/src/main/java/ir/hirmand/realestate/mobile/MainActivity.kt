package ir.hirmand.realestate.mobile

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Color
import android.location.Location
import android.location.LocationManager
import android.net.ConnectivityManager
import android.os.BatteryManager
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import ir.hirmand.realestate.mobile.storage.SecureTokenStore
import ir.hirmand.realestate.mobile.storage.SyncDatabase
import ir.hirmand.realestate.mobile.sync.HirmandApi
import ir.hirmand.realestate.mobile.sync.SyncWorker
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.UUID
import java.util.concurrent.Executors

class MainActivity : Activity() {
    private val executor = Executors.newSingleThreadExecutor()
    private lateinit var tokenStore: SecureTokenStore
    private lateinit var database: SyncDatabase
    private lateinit var statusText: TextView
    private lateinit var queueText: TextView
    private lateinit var pairingInput: EditText
    private lateinit var labelInput: EditText

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        tokenStore = SecureTokenStore(this)
        database = SyncDatabase(this)

        setContentView(buildUi())
        refreshState()
        enqueueEvent("app.opened", JSONObject().put("screen", "main"))
    }

    override fun onDestroy() {
        executor.shutdownNow()
        database.close()
        super.onDestroy()
    }

    private fun buildUi(): View {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(18), dp(18), dp(18), dp(28))
            textDirection = View.TEXT_DIRECTION_RTL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            setBackgroundColor(Color.rgb(242, 236, 226))
        }

        val scroll = ScrollView(this).apply {
            addView(root)
        }

        root.addView(title("همراه هیرمند", 28f))
        root.addView(subtitle("اپ شخصی دستگاه برای اتصال امن، ثبت وضعیت و همگام‌سازی آفلاین"))

        root.addView(sectionTitle("وضعیت اتصال"))
        statusText = bodyText()
        root.addView(statusText)

        queueText = bodyText()
        root.addView(queueText)

        root.addView(sectionTitle("جفت‌سازی با پنل هیرمند"))
        pairingInput = EditText(this).apply {
            hint = "کد ۱۰ رقمی"
            inputType = android.text.InputType.TYPE_CLASS_TEXT
            textDirection = View.TEXT_DIRECTION_LTR
            gravity = Gravity.CENTER
            setSingleLine(true)
            setPadding(dp(12), dp(10), dp(12), dp(10))
        }
        root.addView(pairingInput, fieldParams())

        labelInput = EditText(this).apply {
            hint = "نام دستگاه، مثلاً گوشی شخصی"
            setSingleLine(true)
            setPadding(dp(12), dp(10), dp(12), dp(10))
        }
        root.addView(labelInput, fieldParams())

        val pairButton = actionButton("ثبت و جفت‌سازی دستگاه")
        pairButton.setOnClickListener { pairDevice() }
        root.addView(pairButton, buttonParams())

        root.addView(sectionTitle("عملیات مجاز روی همین دستگاه"))

        val statusButton = actionButton("ارسال وضعیت دستگاه")
        statusButton.setOnClickListener {
            enqueueEvent("device.status", collectDeviceStatus())
            requestSync()
            refreshState()
        }
        root.addView(statusButton, buttonParams())

        val locationButton = actionButton("ارسال موقعیت فعلی (دستی)")
        locationButton.setOnClickListener { sendCurrentLocation() }
        root.addView(locationButton, buttonParams())

        val testButton = actionButton("ارسال رویداد آزمایشی")
        testButton.setOnClickListener {
            enqueueEvent("sync.test", JSONObject().put("source", "user-button"))
            requestSync()
            refreshState()
        }
        root.addView(testButton, buttonParams())

        val syncButton = actionButton("همگام‌سازی الآن")
        syncButton.setOnClickListener { requestSync() }
        root.addView(syncButton, buttonParams())

        val unpairButton = secondaryButton("پاک‌کردن دسترسی روی این گوشی")
        unpairButton.setOnClickListener {
            tokenStore.clear()
            refreshState()
        }
        root.addView(unpairButton, buttonParams())

        root.addView(sectionTitle("حریم خصوصی"))
        root.addView(bodyText("هیچ داده‌ای بدون اقدام کاربر در این نسخه از قابلیت موقعیت مکانی ارسال نمی‌شود. "
            + "صف آفلاین فقط رویدادهایی را نگه می‌دارد که همین اپ تولید کرده است."))

        return scroll
    }

    private fun pairDevice() {
        val code = pairingInput.text.toString().trim().uppercase(Locale.US).replace(" ", "")
        val label = labelInput.text.toString().trim().ifBlank { "گوشی شخصی" }

        if (code.length < 6) {
            statusText.text = "کد جفت‌سازی را کامل وارد کن."
            return
        }

        statusText.text = "در حال جفت‌سازی..."
        executor.execute {
            try {
                val response = HirmandApi(SyncWorker.DEFAULT_BASE_URL).register(
                    pairingCode = code,
                    deviceId = deviceId(),
                    appVersion = BuildConfig.VERSION_NAME,
                    deviceModel = deviceModel(),
                    osVersion = Build.VERSION.RELEASE.orEmpty(),
                    deviceLabel = label,
                )
                tokenStore.save(response.accessToken)
                enqueueEvent("device.registered", JSONObject().put("label", label))
                requestSync()
                runOnUiThread {
                    statusText.text = "اتصال با موفقیت انجام شد. شناسه: ${response.deviceId}"
                    refreshState()
                }
            } catch (error: Exception) {
                runOnUiThread {
                    statusText.text = "جفت‌سازی انجام نشد: ${error.message ?: "خطای شبکه"}"
                }
            }
        }
    }

    private fun sendCurrentLocation() {
        if (Build.VERSION.SDK_INT >= 23 &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED
        ) {
            ActivityCompat.requestPermissions(
                this,
                arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION),
                LOCATION_REQUEST,
            )
            return
        }

        val location = lastKnownLocation()
        if (location == null) {
            statusText.text = "موقعیت فعلی از سرویس مکان‌یابی در دسترس نیست."
            return
        }

        val payload = JSONObject()
            .put("latitude", location.latitude)
            .put("longitude", location.longitude)
            .put("accuracyMeters", location.accuracy)
            .put("provider", location.provider ?: "unknown")
            .put("capturedAt", isoNow())

        enqueueEvent("location.manual", payload)
        requestSync()
        statusText.text = "موقعیت فعلی در صف همگام‌سازی قرار گرفت."
        refreshState()
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray,
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == LOCATION_REQUEST) {
            if (grantResults.any { it == PackageManager.PERMISSION_GRANTED }) {
                sendCurrentLocation()
            } else {
                statusText.text = "مجوز موقعیت داده نشد؛ چیزی ارسال نشد."
            }
        }
    }

    private fun lastKnownLocation(): Location? {
        val manager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
        val providers = listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER)
        for (provider in providers) {
            try {
                manager.getLastKnownLocation(provider)?.let { return it }
            } catch (_: SecurityException) {
                // Permission can be revoked between the check and the call.
            }
        }
        return null
    }

    private fun collectDeviceStatus(): JSONObject {
        val battery = getSystemService(Context.BATTERY_SERVICE) as BatteryManager
        val connected = try {
            val manager = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
            manager.activeNetwork != null
        } catch (_: Exception) {
            false
        }

        return JSONObject()
            .put("model", deviceModel())
            .put("manufacturer", Build.MANUFACTURER)
            .put("androidVersion", Build.VERSION.RELEASE.orEmpty())
            .put("apiLevel", Build.VERSION.SDK_INT)
            .put("batteryPercent", battery.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY))
            .put("networkConnected", connected)
            .put("recordedAt", isoNow())
    }

    private fun enqueueEvent(eventType: String, payload: JSONObject) {
        database.enqueue(eventType, isoNow(), payload.toString())
    }

    private fun requestSync() {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        val request = OneTimeWorkRequestBuilder<SyncWorker>()
            .setConstraints(constraints)
            .build()

        WorkManager.getInstance(this).enqueueUniqueWork(
            "hirmand-mobile-sync-now",
            ExistingWorkPolicy.REPLACE,
            request,
        )
    }

    private fun refreshState() {
        val paired = tokenStore.read() != null
        statusText.text = if (paired) {
            "وضعیت: متصل و مجاز"
        } else {
            "وضعیت: هنوز جفت نشده"
        }
        queueText.text = "رویدادهای منتظر ارسال: ${database.count()}"
    }

    private fun deviceId(): String {
        val androidId = Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID)
        if (!androidId.isNullOrBlank()) return androidId

        val preferences = getSharedPreferences("hirmand_mobile_identity", MODE_PRIVATE)
        return preferences.getString("fallback_id", null) ?: UUID.randomUUID().toString().also {
            preferences.edit().putString("fallback_id", it).apply()
        }
    }

    private fun deviceModel(): String = "${Build.MANUFACTURER} ${Build.MODEL}".trim()

    private fun isoNow(): String = SimpleDateFormat(
        "yyyy-MM-dd'T'HH:mm:ssXXX",
        Locale.US,
    ).apply { timeZone = TimeZone.getTimeZone("UTC") }.format(Date())

    private fun title(text: String, size: Float) = TextView(this).apply {
        this.text = text
        textSize = size
        setTextColor(Color.rgb(19, 35, 59))
        setTypeface(typeface, android.graphics.Typeface.BOLD)
        setPadding(0, 0, 0, dp(6))
    }

    private fun subtitle(text: String) = TextView(this).apply {
        this.text = text
        textSize = 15f
        setTextColor(Color.rgb(65, 67, 68))
        setPadding(0, 0, 0, dp(14))
    }

    private fun sectionTitle(text: String) = TextView(this).apply {
        this.text = text
        textSize = 18f
        setTextColor(Color.rgb(19, 35, 59))
        setTypeface(typeface, android.graphics.Typeface.BOLD)
        setPadding(0, dp(16), 0, dp(8))
    }

    private fun bodyText() = TextView(this).apply {
        textSize = 15f
        setTextColor(Color.rgb(45, 46, 48))
        setPadding(0, 0, 0, dp(6))
    }

    private fun actionButton(text: String) = Button(this).apply {
        this.text = text
        isAllCaps = false
        setTextColor(Color.WHITE)
        setBackgroundColor(Color.rgb(19, 35, 59))
        minHeight = dp(48)
    }

    private fun secondaryButton(text: String) = Button(this).apply {
        this.text = text
        isAllCaps = false
        setTextColor(Color.rgb(19, 35, 59))
        setBackgroundColor(Color.rgb(221, 210, 190))
        minHeight = dp(48)
    }

    private fun fieldParams() = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        LinearLayout.LayoutParams.WRAP_CONTENT,
    ).apply {
        bottomMargin = dp(8)
    }

    private fun buttonParams() = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        LinearLayout.LayoutParams.WRAP_CONTENT,
    ).apply {
        topMargin = dp(4)
        bottomMargin = dp(6)
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    companion object {
        private const val LOCATION_REQUEST = 7001
    }
}
