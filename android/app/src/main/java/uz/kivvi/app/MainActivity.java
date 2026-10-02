package uz.kivvi.app;

import android.content.IntentSender;
import android.os.Bundle;
import android.util.Log;
import androidx.appcompat.app.AlertDialog;
import com.getcapacitor.BridgeActivity;
import com.google.android.gms.tasks.Task;
import com.google.android.play.core.appupdate.AppUpdateInfo;
import com.google.android.play.core.appupdate.AppUpdateManager;
import com.google.android.play.core.appupdate.AppUpdateManagerFactory;
import com.google.android.play.core.install.InstallStateUpdatedListener;
import com.google.android.play.core.install.model.AppUpdateType;
import com.google.android.play.core.install.model.InstallStatus;
import com.google.android.play.core.install.model.UpdateAvailability;

/**
 * MainActivity — KIVVI Android APK entry point.
 *
 * Google Play In-App Updates integratsiyasi:
 * Ilova Google Play orqali o'rnatilgan qurilmalarda avtomatik yangilanishlarni
 * tekshiradi. Agar yangi versiya chiqarilgan bo'lsa, Google Play native
 * dialogi orqali yangilashni taklif qiladi (Flexible yoki Immediate).
 * Serverga / Vercel / Render'ga kirib versiya yozish SHART EMAS.
 */
public class MainActivity extends BridgeActivity {
    private static final String TAG = "KivviAppUpdate";
    private static final int UPDATE_REQUEST_CODE = 4213;

    private AppUpdateManager appUpdateManager;
    private InstallStateUpdatedListener installStateUpdatedListener;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        initPlayInAppUpdate();
    }

    private void initPlayInAppUpdate() {
        try {
            appUpdateManager = AppUpdateManagerFactory.create(this);

            // Flexible update fonda yuklangach — restart taklif qiluvchi listener
            installStateUpdatedListener = state -> {
                if (state.installStatus() == InstallStatus.DOWNLOADED) {
                    showUpdateDownloadedDialog();
                }
            };
            appUpdateManager.registerListener(installStateUpdatedListener);

            checkPlayUpdate();
        } catch (Exception e) {
            Log.w(TAG, "Google Play in-app update init skipped: " + e.getMessage());
        }
    }

    private void checkPlayUpdate() {
        if (appUpdateManager == null) return;

        Task<AppUpdateInfo> appUpdateInfoTask = appUpdateManager.getAppUpdateInfo();
        appUpdateInfoTask.addOnSuccessListener(appUpdateInfo -> {
            if (appUpdateInfo.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE) {
                // Priority 4+ bo'lsa yoki faqat Immediate ruxsat etilgan bo'lsa -> Majburiy
                if (appUpdateInfo.updatePriority() >= 4 && appUpdateInfo.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE)) {
                    startUpdateFlow(appUpdateInfo, AppUpdateType.IMMEDIATE);
                } else if (appUpdateInfo.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE)) {
                    // Tavsiya: foydalanuvchi ilovadan foydalanishda davom etadi, fonda yuklanadi
                    startUpdateFlow(appUpdateInfo, AppUpdateType.FLEXIBLE);
                } else if (appUpdateInfo.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE)) {
                    startUpdateFlow(appUpdateInfo, AppUpdateType.IMMEDIATE);
                }
            }
        }).addOnFailureListener(e -> {
            // Sideloaded / debug APK yoki internet yo'q bo'lsa xavfsiz o'tkazib yuboriladi
            Log.d(TAG, "Update check skipped: " + e.getMessage());
        });
    }

    private void startUpdateFlow(AppUpdateInfo appUpdateInfo, int updateType) {
        try {
            appUpdateManager.startUpdateFlowForResult(
                appUpdateInfo,
                updateType,
                this,
                UPDATE_REQUEST_CODE
            );
        } catch (IntentSender.SendIntentException e) {
            Log.e(TAG, "startUpdateFlow error: " + e.getMessage());
        }
    }

    private void showUpdateDownloadedDialog() {
        try {
            new AlertDialog.Builder(this)
                .setTitle("Yangilanish tayyor")
                .setMessage("Ilovaning yangi versiyasi yuklab olindi. O'rnatish uchun qayta ishga tushiring.")
                .setPositiveButton("O'rnatish", (dialog, which) -> {
                    if (appUpdateManager != null) {
                        appUpdateManager.completeUpdate();
                    }
                })
                .setNegativeButton("Keyinroq", null)
                .setCancelable(true)
                .show();
        } catch (Exception e) {
            if (appUpdateManager != null) {
                appUpdateManager.completeUpdate();
            }
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (appUpdateManager != null) {
            appUpdateManager.getAppUpdateInfo().addOnSuccessListener(appUpdateInfo -> {
                if (appUpdateInfo.installStatus() == InstallStatus.DOWNLOADED) {
                    showUpdateDownloadedDialog();
                }
                if (appUpdateInfo.updateAvailability() == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS) {
                    startUpdateFlow(appUpdateInfo, AppUpdateType.IMMEDIATE);
                }
            });
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (appUpdateManager != null && installStateUpdatedListener != null) {
            appUpdateManager.unregisterListener(installStateUpdatedListener);
        }
    }
}
