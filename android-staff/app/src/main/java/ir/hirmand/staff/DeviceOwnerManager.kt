package ir.hirmand.staff

import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context

enum class DeviceManagementMode {
    DEVICE_OWNER,
    PROFILE_OWNER,
    LEGACY_DEVICE_ADMIN,
    UNMANAGED,
}

data class DeviceManagementState(
    val mode: DeviceManagementMode,
    val label: String,
    val isManaged: Boolean,
    val provisioningAllowed: Boolean,
)

object DeviceOwnerManager {
    fun adminComponent(context: Context): ComponentName =
        ComponentName(context, HirmandDeviceAdminReceiver::class.java)

    fun state(context: Context): DeviceManagementState {
        val manager = context.getSystemService(DevicePolicyManager::class.java)
        val packageName = context.packageName
        val admin = adminComponent(context)

        val deviceOwner = manager?.isDeviceOwnerApp(packageName) == true
        val profileOwner = manager?.isProfileOwnerApp(packageName) == true
        val legacyAdmin = manager?.isAdminActive(admin) == true

        val mode = when {
            deviceOwner -> DeviceManagementMode.DEVICE_OWNER
            profileOwner -> DeviceManagementMode.PROFILE_OWNER
            legacyAdmin -> DeviceManagementMode.LEGACY_DEVICE_ADMIN
            else -> DeviceManagementMode.UNMANAGED
        }

        val label = when (mode) {
            DeviceManagementMode.DEVICE_OWNER -> "Fully Managed / Device Owner فعال"
            DeviceManagementMode.PROFILE_OWNER -> "Work Profile / Profile Owner فعال"
            DeviceManagementMode.LEGACY_DEVICE_ADMIN -> "Device Admin قدیمی فعال"
            DeviceManagementMode.UNMANAGED -> "مدیریت سازمانی فعال نیست"
        }

        val provisioningAllowed = runCatching {
            manager?.isProvisioningAllowed(DevicePolicyManager.ACTION_PROVISION_MANAGED_DEVICE) == true ||
                manager?.isProvisioningAllowed(DevicePolicyManager.ACTION_PROVISION_MANAGED_PROFILE) == true
        }.getOrDefault(false)

        return DeviceManagementState(
            mode = mode,
            label = label,
            isManaged = deviceOwner || profileOwner,
            provisioningAllowed = provisioningAllowed,
        )
    }

    fun isDeviceOwner(context: Context): Boolean =
        context.getSystemService(DevicePolicyManager::class.java)
            ?.isDeviceOwnerApp(context.packageName) == true

    fun applyCompanyIdentity(context: Context) {
        val manager = context.getSystemService(DevicePolicyManager::class.java) ?: return
        if (!manager.isDeviceOwnerApp(context.packageName)) return

        runCatching {
            manager.setOrganizationName(adminComponent(context), "املاک هیرمند")
        }

    }
}
