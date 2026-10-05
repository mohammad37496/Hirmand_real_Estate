package ir.hirmand.staff

import android.content.Context
import android.content.Intent
import android.graphics.Typeface
import android.net.Uri
import android.os.Bundle
import android.view.Gravity
import android.widget.CheckBox
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.google.android.material.button.MaterialButton
import com.google.android.material.card.MaterialCardView

private data class StaffMember(
    val id: String,
    val name: String,
    val role: String,
)

private val staffMembers = listOf(
    StaffMember("sheikh", "آقای شیخ", "مدیر"),
    StaffMember("moradi", "آقای مرادی", "مشاور ارشد"),
)

private const val AGREEMENT_VERSION = "1.0"
private const val AGREEMENT_URL = "https://www.hirmandrealestate.ir/staff-agreement"
private const val PREFS_NAME = "hirmand_staff"
private const val PREF_AGREEMENT_VERSION = "accepted_agreement_version"
private const val PREF_AGREEMENT_ACCEPTED_AT = "agreement_accepted_at"

class MainActivity : AppCompatActivity() {

    private val preferences by lazy {
        getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        if (isAgreementAccepted()) {
            setContentView(buildHome())
        } else {
            setContentView(buildAgreementScreen())
        }
    }

    private fun isAgreementAccepted(): Boolean =
        preferences.getString(PREF_AGREEMENT_VERSION, null) == AGREEMENT_VERSION

    private fun buildAgreementScreen(): ScrollView {
        val scrollView = ScrollView(this).apply {
            setBackgroundColor(getColor(R.color.hirmand_bg))
        }

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(24), dp(20), dp(32))
        }
        scrollView.addView(root)

        val mark = TextView(this).apply {
            text = "◆"
            textSize = 28f
            setTextColor(getColor(R.color.hirmand_gold))
            gravity = Gravity.CENTER
        }
        root.addView(mark, lp(-1, dp(52)))

        val title = TextView(this).apply {
            text = "توافق‌نامه استفاده از تلفن همراه\nEmployee Mobile Device Agreement"
            textSize = 23f
            setTextColor(getColor(R.color.hirmand_text))
            gravity = Gravity.CENTER
            setTypeface(typeface, Typeface.BOLD)
        }
        root.addView(title, lp(-1, -2).apply { topMargin = dp(10) })

        val intro = TextView(this).apply {
            text = "املاک هیرمند · استفاده از گوشی متعلق به بنگاه"
            textSize = 13f
            setTextColor(getColor(R.color.hirmand_muted))
            gravity = Gravity.CENTER
        }
        root.addView(intro, lp(-1, -2).apply {
            topMargin = dp(7)
            bottomMargin = dp(20)
        })

        root.addView(buildNoticeCard(), lp(-1, -2).apply { bottomMargin = dp(14) })

        root.addView(buildContractSection(
            "1",
            "Purpose of This Agreement",
            listOf(
                "This Agreement establishes the rules, responsibilities, permissions, security requirements, data-access practices, and monitoring conditions applicable to employees and authorized personnel who use a mobile device owned, provided, controlled, or designated by Hirmand Real Estate.",
                "The purpose of this Agreement is to ensure that every employee understands clearly and in advance: that the mobile device belongs to Hirmand Real Estate or is designated as a company business device; that the device is provided primarily for legitimate business and operational purposes; which categories of device information and functions the Hirmand Real Estate application may access; why such access may be required; which information may be processed, stored, transmitted, synchronized, or made available to authorized company personnel; what the employee is agreeing to when accepting this Agreement; and how permissions may be granted, denied, revoked, or changed under Android and within the application.",
                "This Agreement is intended to provide clear notice and informed consent. It does not authorize the application to bypass Android security mechanisms, obtain permissions without system approval, or access information that Android or the application's technical controls prohibit."
            )
        ), lp(-1, -2).apply { bottomMargin = dp(14) })

        root.addView(buildContractSection(
            "2",
            "Company Ownership of the Device",
            listOf(
                "The mobile device used with the application is a company-owned or company-controlled device intended for use by authorized Hirmand Real Estate personnel."
            ),
            listOf(
                "The device is primarily a business asset.",
                "The company may configure, maintain, secure, update, inspect, reset, restrict, or replace the device when reasonably required for business, security, maintenance, compliance, or operational purposes.",
                "The employee must not intentionally disable or circumvent company security controls.",
                "The employee must immediately report loss, theft, unauthorized access, suspicious activity, or suspected compromise of the device.",
                "The employee understands that company-device usage may be subject to operational monitoring and security controls described in this Agreement."
            )
        ), lp(-1, -2).apply { bottomMargin = dp(14) })

        root.addView(buildFullAgreementLinkCard(), lp(-1, -2).apply { bottomMargin = dp(16) })

        val signedCheck = CheckBox(this).apply {
            text = "I have read, understood, and voluntarily acknowledge and accept the Hirmand Real Estate Employee Mobile Device Use, Monitoring & Consent Agreement, including the disclosed sensitive permissions, device-access categories, monitoring conditions, data-processing purposes, and responsibilities."
            textSize = 13f
            setTextColor(getColor(R.color.hirmand_text))
            gravity = Gravity.TOP
        }
        root.addView(signedCheck, lp(-1, -2).apply {
            bottomMargin = dp(14)
        })

        val acceptButton = MaterialButton(this).apply {
            text = "Accept & Electronically Sign"
            textSize = 14f
            isAllCaps = false
            isEnabled = false
            setOnClickListener {
                preferences.edit()
                    .putString(PREF_AGREEMENT_VERSION, AGREEMENT_VERSION)
                    .putLong(PREF_AGREEMENT_ACCEPTED_AT, System.currentTimeMillis())
                    .apply()
                setContentView(buildHome())
            }
        }
        root.addView(acceptButton, lp(-1, dp(54)))

        signedCheck.setOnCheckedChangeListener { _, checked ->
            acceptButton.isEnabled = checked
        }

        val version = TextView(this).apply {
            text = "Agreement version $AGREEMENT_VERSION · App version ${BuildConfig.VERSION_NAME}"
            textSize = 11f
            setTextColor(getColor(R.color.hirmand_muted))
            gravity = Gravity.CENTER
        }
        root.addView(version, lp(-1, -2).apply { topMargin = dp(13) })

        return scrollView
    }

    private fun buildNoticeCard(): MaterialCardView {
        val card = MaterialCardView(this).apply {
            radius = dp(17).toFloat()
            setCardBackgroundColor(getColor(R.color.hirmand_surface))
            strokeWidth = dp(1)
            strokeColor = getColor(R.color.hirmand_gold_dark)
        }

        val content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(16), dp(15), dp(16), dp(15))
        }

        val title = TextView(this).apply {
            text = "Please read before continuing"
            textSize = 15f
            setTextColor(getColor(R.color.hirmand_gold))
            setTypeface(typeface, Typeface.BOLD)
        }

        val body = TextView(this).apply {
            text = "This company-owned phone may be configured and monitored for legitimate business and security purposes. The full agreement on the Hirmand website lists the sensitive permissions and information categories that may be requested."
            textSize = 12.5f
            setTextColor(getColor(R.color.hirmand_muted))
            setLineSpacing(dp(2).toFloat(), 1.0f)
        }

        content.addView(title, lp(-1, -2))
        content.addView(body, lp(-1, -2).apply { topMargin = dp(7) })
        card.addView(content)
        return card
    }

    private fun buildContractSection(
        number: String,
        titleText: String,
        paragraphs: List<String>,
        bullets: List<String> = emptyList(),
    ): MaterialCardView {
        val card = MaterialCardView(this).apply {
            radius = dp(17).toFloat()
            setCardBackgroundColor(getColor(R.color.hirmand_surface))
            strokeWidth = dp(1)
            strokeColor = getColor(R.color.hirmand_surface_2)
        }

        val content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(17), dp(17), dp(17), dp(17))
        }

        val badge = TextView(this).apply {
            text = "SECTION $number"
            textSize = 11f
            setTextColor(getColor(R.color.hirmand_gold))
            setTypeface(typeface, Typeface.BOLD)
        }

        val heading = TextView(this).apply {
            text = titleText
            textSize = 18f
            setTextColor(getColor(R.color.hirmand_text))
            setTypeface(typeface, Typeface.BOLD)
        }

        content.addView(badge, lp(-1, -2))
        content.addView(heading, lp(-1, -2).apply {
            topMargin = dp(4)
            bottomMargin = dp(10)
        })

        paragraphs.forEach { paragraph ->
            content.addView(TextView(this).apply {
                text = paragraph
                textSize = 13f
                setTextColor(getColor(R.color.hirmand_muted))
                setLineSpacing(dp(2).toFloat(), 1.0f)
            }, lp(-1, -2).apply { bottomMargin = dp(9) })
        }

        bullets.forEach { bullet ->
            content.addView(TextView(this).apply {
                text = "•  $bullet"
                textSize = 12.5f
                setTextColor(getColor(R.color.hirmand_muted))
                setLineSpacing(dp(1).toFloat(), 1.0f)
            }, lp(-1, -2).apply { bottomMargin = dp(7) })
        }

        card.addView(content)
        return card
    }

    private fun buildFullAgreementLinkCard(): MaterialCardView {
        val card = MaterialCardView(this).apply {
            radius = dp(17).toFloat()
            setCardBackgroundColor(getColor(R.color.hirmand_surface_2))
            strokeWidth = dp(1)
            strokeColor = getColor(R.color.hirmand_gold_dark)
        }

        val content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(16), dp(15), dp(16), dp(15))
        }

        val title = TextView(this).apply {
            text = "Read the complete agreement"
            textSize = 15f
            setTextColor(getColor(R.color.hirmand_text))
            setTypeface(typeface, Typeface.BOLD)
        }

        val body = TextView(this).apply {
            text = "Sections 3–17 contain the remaining permissions, sensitive access categories, monitoring, data handling, employee responsibilities, and electronic-signature terms."
            textSize = 12.5f
            setTextColor(getColor(R.color.hirmand_muted))
            setLineSpacing(dp(2).toFloat(), 1.0f)
        }

        val linkButton = MaterialButton(this).apply {
            text = "Open: hirmandrealestate.ir/staff-agreement"
            textSize = 12f
            isAllCaps = false
            setOnClickListener { openFullAgreement() }
        }

        content.addView(title, lp(-1, -2))
        content.addView(body, lp(-1, -2).apply { topMargin = dp(6) })
        content.addView(linkButton, lp(-1, dp(50)).apply { topMargin = dp(11) })
        card.addView(content)
        return card
    }

    private fun openFullAgreement() {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(AGREEMENT_URL)))
        } catch {
            Toast.makeText(
                this,
                "مرورگر یا برنامه‌ای برای باز کردن قرارداد پیدا نشد.",
                Toast.LENGTH_LONG
            ).show()
        }
    }

    private fun buildHome(): ScrollView {
        val scrollView = ScrollView(this).apply {
            setBackgroundColor(getColor(R.color.hirmand_bg))
        }

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(dp(22), dp(30), dp(22), dp(28))
        }
        scrollView.addView(root)

        val mark = TextView(this).apply {
            text = "◆"
            textSize = 28f
            setTextColor(getColor(R.color.hirmand_gold))
            gravity = Gravity.CENTER
        }
        root.addView(mark, lp(58, 58))

        val title = TextView(this).apply {
            text = getString(R.string.app_name)
            textSize = 28f
            setTextColor(getColor(R.color.hirmand_text))
            gravity = Gravity.CENTER
            setTypeface(typeface, Typeface.BOLD)
        }
        root.addView(title, lp(-1, -2).apply { topMargin = dp(12) })

        val subtitle = TextView(this).apply {
            text = getString(R.string.app_subtitle)
            textSize = 15f
            setTextColor(getColor(R.color.hirmand_muted))
            gravity = Gravity.CENTER
        }
        root.addView(subtitle, lp(-1, -2).apply { topMargin = dp(5) })

        val divider = TextView(this).apply {
            setBackgroundColor(getColor(R.color.hirmand_surface_2))
        }
        root.addView(divider, lp(-1, dp(1)).apply {
            topMargin = dp(26)
            bottomMargin = dp(22)
        })

        val section = TextView(this).apply {
            text = "انتخاب کارمند"
            textSize = 18f
            setTextColor(getColor(R.color.hirmand_text))
            setTypeface(typeface, Typeface.BOLD)
            gravity = Gravity.RIGHT
        }
        root.addView(section, lp(-1, -2))

        val hint = TextView(this).apply {
            text = "این انتخاب فقط روی همین گوشی ذخیره می‌شود و فعلاً هیچ اتصال اینترنتی یا زیرساختی فعال نیست."
            textSize = 13f
            setTextColor(getColor(R.color.hirmand_muted))
            gravity = Gravity.RIGHT
        }
        root.addView(hint, lp(-1, -2).apply {
            topMargin = dp(7)
            bottomMargin = dp(14)
        })

        staffMembers.forEach { member ->
            root.addView(
                createMemberCard(member),
                lp(-1, dp(86)).apply { bottomMargin = dp(12) },
            )
        }

        val selectedId = preferences.getString("selected_staff_id", null)
        val selectedMember = staffMembers.firstOrNull { it.id == selectedId }
        val status = TextView(this).apply {
            text = selectedMember?.let { "کارمند انتخاب‌شده: ${it.name} — ${it.role}" }
                ?: "هنوز کارمندی انتخاب نشده است."
            textSize = 13f
            setTextColor(getColor(R.color.hirmand_muted))
            gravity = Gravity.CENTER
        }
        root.addView(status, lp(-1, -2).apply { topMargin = dp(10) })

        return scrollView
    }

    private fun createMemberCard(member: StaffMember): MaterialCardView {
        val selected = preferences.getString("selected_staff_id", null) == member.id

        val card = MaterialCardView(this).apply {
            radius = dp(18).toFloat()
            setCardBackgroundColor(getColor(R.color.hirmand_surface))
            strokeWidth = dp(if (selected) 2 else 1)
            strokeColor = getColor(
                if (selected) R.color.hirmand_gold else R.color.hirmand_surface_2,
            )
            isClickable = true
            isFocusable = true
            contentDescription = "${member.name}، ${member.role}"
        }

        val content = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            layoutDirection = android.view.View.LAYOUT_DIRECTION_RTL
            setPadding(dp(16), dp(10), dp(16), dp(10))
        }

        val copy = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_VERTICAL
        }

        val name = TextView(this).apply {
            text = member.name
            textSize = 16f
            setTextColor(getColor(R.color.hirmand_text))
            setTypeface(typeface, Typeface.BOLD)
        }

        val role = TextView(this).apply {
            text = member.role
            textSize = 12f
            setTextColor(getColor(R.color.hirmand_muted))
        }

        copy.addView(name, lp(-2, -2))
        copy.addView(role, lp(-2, -2).apply { topMargin = dp(3) })

        val badge = TextView(this).apply {
            text = if (selected) "انتخاب‌شده" else "انتخاب"
            textSize = 11f
            setTextColor(getColor(R.color.hirmand_gold))
            gravity = Gravity.CENTER
        }

        content.addView(copy, LinearLayout.LayoutParams(0, -1, 1f))
        content.addView(badge, lp(dp(92), -1))

        card.addView(content)
        card.setOnClickListener {
            preferences.edit().putString("selected_staff_id", member.id).apply()
            recreate()
        }
        return card
    }

    private fun lp(width: Int, height: Int): LinearLayout.LayoutParams =
        LinearLayout.LayoutParams(width, height)

    private fun dp(value: Int): Int =
        (value * resources.displayMetrics.density).toInt()
}
