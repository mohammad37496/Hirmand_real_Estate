package ir.hirmand.phonebridge.remote

import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import com.google.android.material.button.MaterialButton

/**
 * Per-command consent screen for disclosure of a one-time live location.
 * Opening the notification never sends the location; the user must press Allow.
 */
class RemoteLocationApprovalActivity : AppCompatActivity() {
    private var commandId: String = ""
    private var decided = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        commandId = intent.getStringExtra(RemoteControlService.EXTRA_COMMAND_ID).orEmpty().trim()
        if (commandId.isBlank()) {
            finish()
            return
        }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                decide(allow = false)
            }
        })

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            setPadding(dp(24), dp(28), dp(24), dp(28))
            setBackgroundColor(Color.rgb(12, 18, 26))
        }
        root.addView(TextView(this).apply {
            text = "درخواست ارسال موقعیت فعلی"
            textSize = 22f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
            setTypeface(typeface, android.graphics.Typeface.BOLD)
        }, lp(-1, -2))

        root.addView(TextView(this).apply {
            text = "پنل هیرمند درخواست کرده است مختصات GPS، دقت و زمان ثبت موقعیت فعلی این گوشی برای سرور ارسال شود. تا وقتی «اجازه می‌دهم» را نزنید، این درخواست موقعیت را دریافت یا ارسال نمی‌کند. می‌توانید درخواست را رد کنید."
            textSize = 16f
            setTextColor(Color.rgb(220, 227, 235))
            gravity = Gravity.CENTER
            setLineSpacing(dp(4).toFloat(), 1f)
        }, lp(-1, -2).apply { topMargin = dp(18); bottomMargin = dp(24) })

        root.addView(MaterialButton(this).apply {
            text = "اجازه می‌دهم؛ موقعیت فعلی ارسال شود"
            isAllCaps = false
            setOnClickListener { decide(allow = true) }
        }, lp(-1, dp(54)))

        root.addView(MaterialButton(this).apply {
            text = "رد درخواست"
            isAllCaps = false
            setOnClickListener { decide(allow = false) }
        }, lp(-1, dp(50)).apply { topMargin = dp(10) })

        setContentView(root)
    }

    private fun decide(allow: Boolean) {
        if (decided) return
        decided = true
        val action = if (allow) {
            RemoteControlService.ACTION_APPROVE_LOCATION
        } else {
            RemoteControlService.ACTION_DENY_LOCATION
        }
        startService(
            Intent(this, RemoteControlService::class.java)
                .setAction(action)
                .putExtra(RemoteControlService.EXTRA_COMMAND_ID, commandId)
        )
        finish()
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    private fun lp(width: Int, height: Int): LinearLayout.LayoutParams =
        LinearLayout.LayoutParams(width, height)
}
