package ir.hirmand.staff

import android.Manifest
import android.app.AppOpsManager
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.LocationManager
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import android.view.Gravity
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.google.android.material.button.MaterialButton
import com.google.android.material.card.MaterialCardView
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.google.android.material.materialswitch.MaterialSwitch

private data class RuntimePermissionGroup(
    val title: String,
    val description: String,
    val permissions: List<String>,
)

private data class PermissionState(
    val active: Boolean,
    val status: String,
)

class PermissionCenter(
    private val activity: MainActivity,
    private val screenCaptureApproved: () -> Boolean,
    private val onRequestScreenCapture: () -> Unit,
    private val onStartWorkProfileProvisioning: () -> Unit,
    private val onClose: () -> Unit,
) {
    private val context: Context = activity

    fun buildView(): ScrollView {
        val scroll = ScrollView(context).apply {
            setBackgroundColor(context.getColor(R.color.hirmand_bg))
        }

        val root = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            layoutDirection = android.view.View.LAYOUT_DIRECTION_RTL
            setPadding(dp(20), dp(22), dp(20), dp(30))
        }
        scroll.addView(root)

        val back = MaterialButton(context).apply {
            text = "بازگشت"
            textSize = 12.5f
            isAllCaps = false
            setOnClickListener { onClose() }
        }
        root.addView(back, lp(-1, dp(46)).apply { bottomMargin = dp(14) })

        val mark = TextView(context).apply {
            text = "◆"
            textSize = 26f
            setTextColor(context.getColor(R.color.hirmand_gold))
            gravity = Gravity.CENTER
        }
        root.addView(mark, lp(-1, dp(46)))

        val title = TextView(context).apply {
            text = "Validate all these settings if you want to use this phone!"
            textSize = 22f
            setTextColor(context.getColor(R.color.hirmand_text))
            gravity = Gravity.CENTER
            setTypeface(typeface, android.graphics.Typeface.BOLD)
        }
        root.addView(title, lp(-1, -2).apply { topMargin = dp(9) })

        val intro = TextView(context).apply {
            text = "مرکز دسترسی‌ها و آماده‌سازی تلفن هیرمند"
            textSize = 14f
            setTextColor(context.getColor(R.color.hirmand_muted))
            gravity = Gravity.CENTER
        }
        root.addView(intro, lp(-1, -2).apply { topMargin = dp(6) })

        val note = TextView(context).apply {
            text = "کلیدها وضعیت واقعی Android را نشان می‌دهند. GO شما را به صفحه یا فرایند رسمی سیستم می‌برد؛ فعال‌سازی مجوز بدون تأیید Android انجام نمی‌شود."
            textSize = 12.5f
            setTextColor(context.getColor(R.color.hirmand_muted))
            gravity = Gravity.CENTER
            setLineSpacing(dp(2).toFloat(), 1.0f)
        }
        root.addView(note, lp(-1, -2).apply {
            topMargin = dp(10)
            bottomMargin = dp(18)
        })

        val states = currentStates()
        val activeCount = states.count { it.active }
        val summary = MaterialCardView(context).apply {
            radius = dp(18).toFloat()
            setCardBackgroundColor(context.getColor(R.color.hirmand_surface))
            strokeWidth = dp(1)
            strokeColor = context.getColor(R.color.hirmand_gold_dark)
        }
        val summaryContent = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(16), dp(14), dp(16), dp(14))
        }
        val summaryTitle = TextView(context).apply {
            text = "آمادگی دستگاه"
            textSize = 15f
            setTextColor(context.getColor(R.color.hirmand_gold))
            setTypeface(typeface, android.graphics.Typeface.BOLD)
        }
        val summaryValue = TextView(context).apply {
            text = "$activeCount / " + states.size + " مورد فعال است"
            textSize = 20f
            setTextColor(context.getColor(R.color.hirmand_text))
            setTypeface(typeface, android.graphics.Typeface.BOLD)
        }
        val summaryHint = TextView(context).apply {
            text = "برای هر مورد، وضعیت را بررسی کنید و در صورت نیاز از GO استفاده کنید."
            textSize = 12f
            setTextColor(context.getColor(R.color.hirmand_muted))
        }
        summaryContent.addView(summaryTitle, lp(-1, -2))
        summaryContent.addView(summaryValue, lp(-1, -2).apply { topMargin = dp(4) })
        summaryContent.addView(summaryHint, lp(-1, -2).apply { topMargin = dp(5) })
        summary.addView(summaryContent)
        root.addView(summary, lp(-1, -2).apply { bottomMargin = dp(18) })

        root.addView(sectionLabel("دسترسی‌های برنامه"), lp(-1, -2).apply { bottomMargin = dp(8) })

        root.addView(
            buildPermissionCard(
                title = "Enable accessibility",
                description = "Accessibility is useful for several features of the application (Instant messaging, call recording, live viewing, application blocking and website history).",
                state = { accessibilityState() },
                onAction = { showAccessibilityInstructions() },
            ),
            lp(-1, -2).apply { bottomMargin = dp(12) }
        )

        // Ask for each sensitive category only after its purpose is explained.
        // A single "enable everything" button pressures employees to over-grant.
        runtimePermissionGroups().forEach { group ->
            root.addView(
                buildPermissionCard(
                    title = group.title,
                    description = group.description,
                    state = { runtimePermissionGroupState(group) },
                    onAction = { requestRuntimePermissionGroup(group) },
                ),
                lp(-1, -2).apply { bottomMargin = dp(12) }
            )
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            root.addView(
                buildPermissionCard(
                    title = "موقعیت مکانی در پس‌زمینه",
                    description = "این دسترسی می‌تواند موقعیت را وقتی برنامه در صفحه نیست هم در دسترس قرار دهد. فقط اگر وظیفهٔ کاری مشخصی به آن نیاز دارد فعالش کنید؛ انتخاب نهایی با خود کاربر و تنظیمات اندروید است.",
                    state = { backgroundLocationState() },
                    onAction = { requestBackgroundLocation() },
                ),
                lp(-1, -2).apply { bottomMargin = dp(12) }
            )
        }

        root.addView(sectionLabel("دسترسی‌های سیستمی و ویژه"), lp(-1, -2).apply {
            topMargin = dp(8)
            bottomMargin = dp(8)
        })

        root.addView(
            buildPermissionCard(
                title = "Company / personal device management",
                description = "Company phone: Fully Managed / Device Owner. Personal phone: Android Work Profile / Profile Owner, keeping work management inside the managed profile.",
                state = { deviceManagementState() },
                onAction = { showDeviceManagementInstructions() },
            ),
            lp(-1, -2).apply { bottomMargin = dp(12) }
        )

        root.addView(
            buildPermissionCard(
                title = "Enable access to notifications",
                description = "Hide system notifications for the application and retrieve messages received from instant messengers.",
                state = { notificationListenerState() },
                onAction = { showNotificationAccessInstructions() },
            ),
            lp(-1, -2).apply { bottomMargin = dp(12) }
        )

        root.addView(
            buildPermissionCard(
                title = "Screen capture permission",
                description = "Allows you to take captures from the phone. On modern Android, the user must approve each capture session.",
                state = {
                    val active = screenCaptureApproved()
                    PermissionState(active, if (active) "تأیید شده برای جلسه جاری" else "نیازمند تأیید سیستم")
                },
                onAction = { showScreenCaptureInstructions() },
            ),
            lp(-1, -2).apply { bottomMargin = dp(12) }
        )

        root.addView(
            buildPermissionCard(
                title = "Usage data",
                description = "Provides statistics on the use of installed applications.",
                state = { usageAccessState() },
                onAction = { showUsageAccessInstructions() },
            ),
            lp(-1, -2).apply { bottomMargin = dp(12) }
        )

        root.addView(
            buildPermissionCard(
                title = "Overlay on other apps.",
                description = "Useful for the good functioning of the application.",
                state = { overlayState() },
                onAction = { openOverlaySettings() },
            ),
            lp(-1, -2).apply { bottomMargin = dp(12) }
        )

        root.addView(
            buildPermissionCard(
                title = "Disable app notifications",
                description = "Hide notifications for the application.",
                state = { appNotificationsDisabledState() },
                onAction = { openAppNotificationSettings() },
            ),
            lp(-1, -2).apply { bottomMargin = dp(12) }
        )

        root.addView(
            buildPermissionCard(
                title = "Activate location",
                description = "Use GPS, Wi-Fi, and mobile networks to determine location.",
                state = { locationState() },
                onAction = { showLocationInstructions() },
            ),
            lp(-1, -2).apply { bottomMargin = dp(12) }
        )

        root.addView(
            buildPermissionCard(
                title = "Do not optimize battery usage",
                description = "This makes it possible to keep the application running in the background.",
                state = { batteryOptimizationState() },
                onAction = { showBatteryInstructions() },
            ),
            lp(-1, -2).apply { bottomMargin = dp(16) }
        )

        val footer = TextView(context).apply {
            text = "توجه: Accessibility، Notification Access، Usage Access، Overlay، Device Admin و Battery Optimization دسترسی‌های ویژه‌اند و Android آن‌ها را جداگانه مدیریت می‌کند."
            textSize = 11.5f
            setTextColor(context.getColor(R.color.hirmand_muted))
            gravity = Gravity.CENTER
            setLineSpacing(dp(1).toFloat(), 1.0f)
        }
        root.addView(footer, lp(-1, -2))

        return scroll
    }

    private fun buildPermissionCard(
        title: String,
        description: String,
        state: () -> PermissionState,
        onAction: () -> Unit,
    ): MaterialCardView {
        val initial = state()
        val card = MaterialCardView(context).apply {
            radius = dp(18).toFloat()
            setCardBackgroundColor(context.getColor(R.color.hirmand_surface))
            strokeWidth = dp(1)
            strokeColor = context.getColor(R.color.hirmand_surface_2)
        }

        val content = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            layoutDirection = android.view.View.LAYOUT_DIRECTION_RTL
            setPadding(dp(15), dp(15), dp(15), dp(13))
        }

        val header = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            layoutDirection = android.view.View.LAYOUT_DIRECTION_RTL
        }

        val copy = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            layoutDirection = android.view.View.LAYOUT_DIRECTION_RTL
        }

        val titleView = TextView(context).apply {
            text = title
            textSize = 16f
            setTextColor(context.getColor(R.color.hirmand_text))
            setTypeface(typeface, android.graphics.Typeface.BOLD)
        }
        val descView = TextView(context).apply {
            text = description
            textSize = 12.5f
            setTextColor(context.getColor(R.color.hirmand_muted))
            setLineSpacing(dp(1).toFloat(), 1.0f)
        }

        val statusView = TextView(context).apply {
            text = initial.status
            textSize = 12f
            setTextColor(
                context.getColor(
                    if (initial.active) R.color.hirmand_gold else R.color.hirmand_muted
                )
            )
        }

        copy.addView(titleView, lp(-1, -2))
        copy.addView(descView, lp(-1, -2).apply { topMargin = dp(5) })
        copy.addView(statusView, lp(-1, -2).apply { topMargin = dp(6) })

        val toggle = MaterialSwitch(context).apply {
            isChecked = initial.active
            isFocusable = true
            contentDescription = title
            setOnClickListener {
                isChecked = state().active
                onAction()
            }
        }

        header.addView(copy, LinearLayout.LayoutParams(0, -2, 1f))
        header.addView(toggle, lp(dp(64), dp(48)))
        content.addView(header)

        val go = MaterialButton(context).apply {
            text = "GO"
            textSize = 12f
            isAllCaps = true
            setOnClickListener { onAction() }
        }
        content.addView(go, lp(-1, dp(44)).apply { topMargin = dp(10) })

        card.addView(content)
        return card
    }

    private fun currentStates(): List<PermissionState> =
        listOf(accessibilityState()) +
            runtimePermissionGroups().map { runtimePermissionGroupState(it) } +
            buildList {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) add(backgroundLocationState())
                add(deviceManagementState())
                add(notificationListenerState())
                add(PermissionState(
                    screenCaptureApproved(),
                    if (screenCaptureApproved()) "تأیید شده برای جلسه جاری" else "نیازمند تأیید سیستم"
                ))
                add(usageAccessState())
                add(overlayState())
                add(appNotificationsDisabledState())
                add(locationState())
                add(batteryOptimizationState())
            }

    private fun accessibilityState(): PermissionState {
        val enabled = Settings.Secure.getString(
            context.contentResolver,
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        ).orEmpty()
        val expected = ComponentName(context, HirmandAccessibilityService::class.java).flattenToString()
        val active = enabled.split(':').any { it == expected }
        return PermissionState(active, if (active) "فعال" else "غیرفعال")
    }

    private fun runtimePermissionGroupState(group: RuntimePermissionGroup): PermissionState =
        PermissionState(
            isGroupGranted(group),
            if (isGroupGranted(group)) "مجوزهای این بخش فعال است" else "برای این بخش مجوز لازم است",
        )

    private fun runtimePermissionGroups(): List<RuntimePermissionGroup> =
        listOf(
            RuntimePermissionGroup(
                title = "تقویم",
                description = "برای مشاهده یا مدیریت رویدادهای کاری، فقط در صورت نیاز واقعی. داده‌های تقویم شخصی حساس‌اند.",
                permissions = listOf(Manifest.permission.READ_CALENDAR, Manifest.permission.WRITE_CALENDAR),
            ),
            RuntimePermissionGroup(
                title = "دوربین",
                description = "برای عکس ملک یا مدرک در زمانی که خودتان قابلیت مربوط را اجرا می‌کنید؛ این مجوز به معنی اجازهٔ عکاسی پنهانی نیست.",
                permissions = listOf(Manifest.permission.CAMERA),
            ),
            RuntimePermissionGroup(
                title = "مخاطبین",
                description = "برای گردش‌کارهای مشخص ارتباط با مالک، متقاضی یا همکار. نام و شمارهٔ افراد دیگر نیز دادهٔ شخصی محسوب می‌شوند.",
                permissions = listOf(Manifest.permission.READ_CONTACTS),
            ),
            RuntimePermissionGroup(
                title = "موقعیت مکانی",
                description = "برای قابلیت مشخص کاری مانند ثبت حضور یا مکان دستگاه. موقعیت دقیق فقط با انتخاب و تأیید شما فعال می‌شود.",
                permissions = listOf(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION,
                ),
            ),
            RuntimePermissionGroup(
                title = "میکروفون",
                description = "فقط برای قابلیت صوتی‌ای که خودتان آغاز می‌کنید. ضبط تماس یا صدای محیط باید جداگانه و آشکار فعال شود.",
                permissions = listOf(Manifest.permission.RECORD_AUDIO),
            ),
            RuntimePermissionGroup(
                title = "تلفن",
                description = "برای وضعیت تلفن یا آغاز تماس کاری در صورت نیاز. این دسترسی به تنهایی اجازهٔ شنود تماس نمی‌دهد.",
                permissions = listOf(Manifest.permission.CALL_PHONE, Manifest.permission.READ_PHONE_STATE),
            ),
            RuntimePermissionGroup(
                title = "گزارش تماس‌ها",
                description = "می‌تواند شماره، زمان، مدت و جهت تماس‌ها را آشکار کند؛ فقط با نیاز کاری روشن فعالش کنید. اندروید ممکن است این دسترسی را محدود کند.",
                permissions = listOf(Manifest.permission.READ_CALL_LOG),
            ),
            RuntimePermissionGroup(
                title = "پیامک",
                description = "پیامک‌ها ممکن است حاوی رمز یک‌بارمصرف و اطلاعات خصوصی باشند. فعال‌سازی فقط با نیاز مشخص انجام شود؛ اندروید ممکن است آن را محدود کند.",
                permissions = listOf(Manifest.permission.READ_SMS, Manifest.permission.SEND_SMS),
            ),
            RuntimePermissionGroup(
                title = "عکس، رسانه و فایل",
                description = "در نسخه‌های جدید فقط انواع رسانهٔ انتخاب‌شده درخواست می‌شوند؛ فایل‌های کاری مشخص را ترجیحاً با انتخابگر رسمی اندروید انتخاب کنید.",
                permissions = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    listOf(
                        Manifest.permission.READ_MEDIA_IMAGES,
                        Manifest.permission.READ_MEDIA_VIDEO,
                        Manifest.permission.READ_MEDIA_AUDIO,
                    )
                } else {
                    listOf(Manifest.permission.READ_EXTERNAL_STORAGE)
                },
            ),
        ) + if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            listOf(
                RuntimePermissionGroup(
                    title = "اعلان‌های برنامه",
                    description = "برای نمایش وضعیت همگام‌سازی و هشدارهای کاری. این مجوز اعلان‌ها را از برنامه‌های دیگر نمی‌خواند.",
                    permissions = listOf(Manifest.permission.POST_NOTIFICATIONS),
                ),
            )
        } else {
            emptyList()
        }

    private fun isGroupGranted(group: RuntimePermissionGroup): Boolean =
        group.permissions.all {
            ContextCompat.checkSelfPermission(context, it) == PackageManager.PERMISSION_GRANTED
        }

    private fun requestRuntimePermissionGroup(group: RuntimePermissionGroup) {
        val missing = group.permissions.filter {
            ContextCompat.checkSelfPermission(context, it) != PackageManager.PERMISSION_GRANTED
        }

        if (missing.isEmpty()) {
            openAppPermissionsSettings()
            return
        }

        activity.requestPermissions(missing.toTypedArray(), REQUEST_GROUP_PERMISSION)
    }

    private fun backgroundLocationState(): PermissionState {
        val active = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.ACCESS_BACKGROUND_LOCATION,
        ) == PackageManager.PERMISSION_GRANTED
        return PermissionState(active, if (active) "موقعیت پس‌زمینه فعال است" else "غیرفعال؛ نیازمند انتخاب در تنظیمات")
    }

    private fun requestBackgroundLocation() {
        val foregroundLocation = runtimePermissionGroups().first { it.title == "موقعیت مکانی" }
        if (!isGroupGranted(foregroundLocation)) {
            showInstructions(
                title = "ابتدا موقعیت مکانی",
                message = "برای درخواست پس‌زمینه، ابتدا مجوز موقعیت هنگام استفاده از برنامه را به‌صورت جداگانه تأیید کنید.",
                onGo = { requestRuntimePermissionGroup(foregroundLocation) },
            )
            return
        }

        showInstructions(
            title = "موقعیت در پس‌زمینه",
            message = "این مجوز دسترسی مکان را هنگامی که برنامه باز نیست ممکن می‌کند. فقط برای وظیفه‌ای که واقعاً به ردیابی پس‌زمینه نیاز دارد ادامه دهید؛ در صفحهٔ اندروید می‌توانید آن را رد کنید.",
            onGo = { openAppPermissionsSettings() },
        )
    }

    private fun deviceManagementState(): PermissionState {
        val state = DeviceOwnerManager.state(context)
        return PermissionState(state.isManaged, state.label)
    }

    private fun notificationListenerState(): PermissionState {
        val enabled = Settings.Secure.getString(
            context.contentResolver,
            Settings.Secure.ENABLED_NOTIFICATION_LISTENERS
        ).orEmpty()
        val expected = ComponentName(context, HirmandNotificationListenerService::class.java).flattenToString()
        val active = enabled.split(':').any { it == expected }
        return PermissionState(active, if (active) "فعال" else "غیرفعال")
    }

    private fun usageAccessState(): PermissionState {
        val appOps = context.getSystemService(AppOpsManager::class.java)
        val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            appOps?.unsafeCheckOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                context.applicationInfo.uid,
                context.packageName
            ) ?: AppOpsManager.MODE_ERRORED
        } else {
            @Suppress("DEPRECATION")
            appOps?.checkOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                context.applicationInfo.uid,
                context.packageName
            ) ?: AppOpsManager.MODE_ERRORED
        }
        val active = mode == AppOpsManager.MODE_ALLOWED
        return PermissionState(active, if (active) "فعال" else "غیرفعال")
    }

    private fun overlayState(): PermissionState {
        val active = Settings.canDrawOverlays(context)
        return PermissionState(active, if (active) "فعال" else "غیرفعال")
    }

    private fun appNotificationsDisabledState(): PermissionState {
        val notificationsEnabled = NotificationManagerCompat.from(context).areNotificationsEnabled()
        val postNotificationsGranted = Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
        val disabled = !notificationsEnabled || !postNotificationsGranted
        return PermissionState(disabled, if (disabled) "غیرفعال" else "فعال")
    }

    private fun locationState(): PermissionState {
        val permissionGranted =
            ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) ==
                PackageManager.PERMISSION_GRANTED ||
                ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) ==
                PackageManager.PERMISSION_GRANTED

        val locationEnabled =
            context.getSystemService(LocationManager::class.java)?.let {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) it.isLocationEnabled else true
            } ?: false

        val active = permissionGranted && locationEnabled
        val status = when {
            active -> "مجوز و Location فعال"
            permissionGranted -> "مجوز فعال، Location دستگاه خاموش"
            locationEnabled -> "Location روشن، مجوز برنامه خاموش"
            else -> "غیرفعال"
        }
        return PermissionState(active, status)
    }

    private fun batteryOptimizationState(): PermissionState {
        val power = context.getSystemService(PowerManager::class.java)
        val active = power?.isIgnoringBatteryOptimizations(context.packageName) == true
        return PermissionState(active, if (active) "بدون محدودیت باتری" else "بهینه‌سازی فعال است")
    }

    private fun showAccessibilityInstructions() {
        showInstructions(
            title = "دسترسی‌پذیری",
            message = "این یک دسترسی ویژه است و می‌تواند محتوای صفحه را در اختیار سرویس قرار دهد. در نسخهٔ فعلی، سرویس هیرمند رویدادهای صفحه را جمع‌آوری یا ارسال نمی‌کند. فقط برای قابلیت مشخصی که فعال و توضیح داده شده ادامه دهید.",
            onGo = { openAccessibilitySettings() }
        )
    }

    private fun showDeviceManagementInstructions() {
        val state = DeviceOwnerManager.state(context)
        when (state.mode) {
            DeviceManagementMode.DEVICE_OWNER -> {
                showInstructions(
                    title = "Fully Managed / Device Owner",
                    message = "این گوشی در حالت Fully Managed مدیریت می‌شود. مجوز دوربین، میکروفون و موقعیت در مرکز دسترسی‌ها جداگانه توضیح داده و از کاربر درخواست می‌شود؛ این اپ آن‌ها را خودکار فعال نمی‌کند.",
                    onGo = { showDeviceOwnerTestCommand() }
                )
            }

            DeviceManagementMode.PROFILE_OWNER -> {
                showInstructions(
                    title = "Work Profile",
                    message = "این گوشی از طریق Work Profile مدیریت می‌شود. مدیریت سازمانی در فضای کاری محدود است و داده‌های شخصیِ پروفایل اصلی جزو فضای کاری نیستند. مجوزهای حساس داخل Work Profile باید مطابق کنترل‌های Android مدیریت شوند.",
                    onGo = { onStartWorkProfileProvisioning() }
                )
            }

            DeviceManagementMode.LEGACY_DEVICE_ADMIN -> {
                MaterialAlertDialogBuilder(context)
                    .setTitle("Legacy Device Admin")
                    .setMessage(
                        "Device Admin قدیمی فعال است. برای گوشی شخصی، Work Profile گزینه مناسب‌تری است؛ برای گوشی شرکتی، Fully Managed / Device Owner باید در فرایند Provisioning راه‌اندازی شود."
                    )
                    .setNegativeButton("لغو", null)
                    .setNeutralButton("گوشی شخصی / Work Profile") { _, _ ->
                        onStartWorkProfileProvisioning()
                    }
                    .setPositiveButton("راهنمای گوشی شرکتی") { _, _ ->
                        showDeviceOwnerTestCommand()
                    }
                    .show()
            }

            DeviceManagementMode.UNMANAGED -> {
                MaterialAlertDialogBuilder(context)
                    .setTitle("انتخاب نوع گوشی")
                    .setMessage(
                        "نوع مدیریت را متناسب با مالکیت دستگاه انتخاب کنید:\n\n" +
                            "گوشی شخصی کارمند → Work Profile / Profile Owner\n" +
                            "گوشی متعلق به شرکت → Fully Managed / Device Owner"
                    )
                    .setNegativeButton("لغو", null)
                    .setNeutralButton("گوشی شخصی") { _, _ ->
                        onStartWorkProfileProvisioning()
                    }
                    .setPositiveButton("گوشی شرکتی") { _, _ ->
                        showDeviceOwnerTestCommand()
                    }
                    .show()
            }
        }
    }

    private fun showDeviceOwnerTestCommand() {
        MaterialAlertDialogBuilder(context)
            .setTitle("دستور Provisioning")
            .setMessage(
                "Release:\n" +
                    "adb shell dpm set-device-owner ir.hirmand.staff/.HirmandDeviceAdminReceiver\n\n" +
                    "Debug:\n" +
                    "adb shell dpm set-device-owner ir.hirmand.staff.debug/.HirmandDeviceAdminReceiver\n\n" +
                    "این روش برای تست/راه‌اندازی سازمانی روی دستگاه مناسب است. روی گوشی‌ای که قبلاً به‌عنوان Device Owner مدیریت دیگری دارد، نصب معمولی کافی نیست."
            )
            .setPositiveButton("متوجه شدم", null)
            .show()
    }

    private fun showNotificationAccessInstructions() {
        showInstructions(
            title = "دسترسی اعلان‌ها",
            message = "این دسترسی می‌تواند محتوای اعلان‌های برنامه‌های دیگر را ببیند. در نسخهٔ فعلی، سرویس هیرمند محتوای اعلان‌ها را جمع‌آوری یا ارسال نمی‌کند. فقط اگر قابلیت کاری مشخصی به آن نیاز دارد ادامه دهید.",
            onGo = { openNotificationAccessSettings() }
        )
    }

    private fun showScreenCaptureInstructions() {
        showInstructions(
            title = "Screen capture permission",
            message = "Start the screen-capture flow and approve it in the Android system dialog. On Android 14 and later, approval is required for each capture session.",
            onGo = onRequestScreenCapture
        )
    }

    private fun showUsageAccessInstructions() {
        showInstructions(
            title = "Usage data",
            message = "Select Hirmand realestate and enable usage access.",
            onGo = { openUsageAccessSettings() }
        )
    }

    private fun showLocationInstructions() {
        showInstructions(
            title = "Activate location",
            message = "Enable Device location and Location Accuracy in the system location settings. The app also needs its own location permission.",
            onGo = { openLocationSettings() }
        )
    }

    private fun showBatteryInstructions() {
        showInstructions(
            title = "Stop optimising battery usage?",
            message = "Hirmand realestate will be able to run in the background. Its battery usage won't be restricted.",
            onGo = { openBatteryOptimizationSettings() }
        )
    }

    private fun showInstructions(
        title: String,
        message: String,
        onGo: () -> Unit,
    ) {
        MaterialAlertDialogBuilder(context)
            .setTitle(title)
            .setMessage(message)
            .setNegativeButton("CANCEL", null)
            .setPositiveButton("GO") { _, _ -> onGo() }
            .show()
    }

    private fun openAccessibilitySettings() {
        openSettingsSafely(Settings.ACTION_ACCESSIBILITY_SETTINGS)
    }

    private fun openDeviceAdminSettings() {
        val intent = Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN)
            .putExtra(
                DevicePolicyManager.EXTRA_DEVICE_ADMIN,
                ComponentName(context, HirmandDeviceAdminReceiver::class.java)
            )
            .putExtra(
                DevicePolicyManager.EXTRA_ADD_EXPLANATION,
                "فعال‌سازی مدیریت دستگاه برای عملیات امنیتی تأییدشده هیرمند."
            )
        startSafely(intent)
    }

    private fun openNotificationAccessSettings() {
        openSettingsSafely(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
    }

    private fun openUsageAccessSettings() {
        openSettingsSafely(Settings.ACTION_USAGE_ACCESS_SETTINGS)
    }

    private fun openOverlaySettings() {
        val intent = Intent(
            Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
            Uri.parse("package:" + context.packageName)
        )
        startSafely(intent)
    }

    private fun openAppNotificationSettings() {
        val intent = Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
            .putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
        startSafely(intent)
    }

    private fun openLocationSettings() {
        openSettingsSafely(Settings.ACTION_LOCATION_SOURCE_SETTINGS)
    }

    private fun openBatteryOptimizationSettings() {
        val intent = Intent(
            Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
            Uri.parse("package:" + context.packageName)
        )
        try {
            context.startActivity(intent)
        } catch {
            openSettingsSafely(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
        }
    }

    private fun openAppPermissionsSettings() {
        val intent = Intent(
            Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
            Uri.parse("package:" + context.packageName)
        )
        startSafely(intent)
    }

    private fun openSettingsSafely(action: String) {
        startSafely(Intent(action))
    }

    private fun startSafely(intent: Intent) {
        try {
            context.startActivity(intent)
        } catch {
            android.widget.Toast.makeText(
                context,
                "صفحه تنظیمات موردنظر روی این دستگاه در دسترس نیست.",
                android.widget.Toast.LENGTH_LONG
            ).show()
        }
    }

    private fun sectionLabel(text: String): TextView =
        TextView(context).apply {
            this.text = text
            textSize = 17f
            setTextColor(context.getColor(R.color.hirmand_text))
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            gravity = Gravity.RIGHT
        }

    private fun lp(width: Int, height: Int): LinearLayout.LayoutParams =
        LinearLayout.LayoutParams(width, height)

    private fun dp(value: Int): Int =
        (value * context.resources.displayMetrics.density).toInt()

    companion object {
        private const val REQUEST_GROUP_PERMISSION = 9101
    }
}
