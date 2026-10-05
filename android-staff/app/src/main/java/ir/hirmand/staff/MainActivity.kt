package ir.hirmand.staff

import android.content.Context
import android.graphics.Typeface
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
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

class MainActivity : AppCompatActivity() {

    private val preferences by lazy {
        getSharedPreferences("hirmand_staff", Context.MODE_PRIVATE)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(buildHome())
    }

    private fun buildHome(): LinearLayout {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(dp(22), dp(30), dp(22), dp(28))
            setBackgroundColor(getColor(R.color.hirmand_bg))
        }

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
            text = "این انتخاب فقط روی همین گوشی ذخیره می‌شود و هنوز هیچ اتصال اینترنتی یا زیرساختی فعال نیست."
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

        return root
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
