package ir.hirmand.staff

import android.app.Activity
import android.app.admin.DevicePolicyManager
import android.content.Intent
import android.os.Bundle
import android.view.Gravity
import android.widget.LinearLayout
import android.widget.TextView
import com.google.android.material.button.MaterialButton

/**
 * Android Enterprise DPC provisioning entry point.
 *
 * Android 12+ uses GET_PROVISIONING_MODE and ADMIN_POLICY_COMPLIANCE
 * instead of launching ACTION_PROVISION_MANAGED_DEVICE directly.
 */
class HirmandProvisioningActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        when (intent?.action) {
            DevicePolicyManager.ACTION_GET_PROVISIONING_MODE -> returnProvisioningMode()
            DevicePolicyManager.ACTION_ADMIN_POLICY_COMPLIANCE -> showCompliance()
            else -> {
                setResult(RESULT_CANCELED)
                finish()
            }
        }
    }

    private fun returnProvisioningMode() {
        val result = Intent().apply {
            putExtra(
                DevicePolicyManager.EXTRA_PROVISIONING_MODE,
                DevicePolicyManager.PROVISIONING_MODE_FULLY_MANAGED_DEVICE,
            )

            // Do not opt out of sensor permission management.
            // Because this app is the DPC for a fully-managed company device,
            // Android may apply the Device Owner's explicit sensor grant policy
            // during provisioning. The app still exposes the managed state in
            // its own UI and does not use a blanket auto-grant policy.
        }

        setResult(RESULT_OK, result)
        finish()
    }

    private fun showCompliance() {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(dp(24), dp(32), dp(24), dp(32))
            setBackgroundColor(getColor(R.color.hirmand_bg))
        }

        root.addView(TextView(this).apply {
            text = "مدیریت سازمانی هیرمند"
            textSize = 24f
            gravity = Gravity.CENTER
            setTextColor(getColor(R.color.hirmand_text))
        }, lp(-1, -2))

        root.addView(TextView(this).apply {
            text = "این دستگاه به‌عنوان گوشی متعلق به شرکت، تحت مدیریت Fully Managed قرار می‌گیرد. سیاست‌های مدیریتی فقط از طریق Android Enterprise اعمال می‌شوند و دسترسی‌های حساس همچنان تابع مجوزهای رسمی Android هستند."
            textSize = 14f
            gravity = Gravity.CENTER
            setTextColor(getColor(R.color.hirmand_muted))
            setLineSpacing(dp(2).toFloat(), 1.0f)
        }, lp(-1, -2).apply { topMargin = dp(16) })

        root.addView(MaterialButton(this).apply {
            text = "تأیید و ادامه"
            isAllCaps = false
            textSize = 14f
            setOnClickListener {
                setResult(RESULT_OK)
                finish()
            }
        }, lp(-1, dp(52)).apply { topMargin = dp(24) })

        setContentView(root)
    }

    private fun lp(width: Int, height: Int): LinearLayout.LayoutParams =
        LinearLayout.LayoutParams(width, height)

    private fun dp(value: Int): Int =
        (value * resources.displayMetrics.density).toInt()
}
