package uz.kivvi.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Capacitor bridge: React faqat faol jonli efir paytida native PiP'ni yoqadi. */
@CapacitorPlugin(name = "PictureInPicture")
public class PictureInPicturePlugin extends Plugin {
    @PluginMethod
    public void setActive(PluginCall call) {
        boolean active = Boolean.TRUE.equals(call.getBoolean("active", false));
        if (!(getActivity() instanceof MainActivity)) {
            call.reject("Picture-in-picture activity is unavailable");
            return;
        }

        getActivity().runOnUiThread(() -> {
            ((MainActivity) getActivity()).setPictureInPictureActive(active);
            call.resolve();
        });
    }

    public void notifyModeChanged(boolean active) {
        JSObject state = new JSObject();
        state.put("active", active);
        notifyListeners("modeChanged", state, true);
    }
}
