package com.radiofy.app;

import android.Manifest;
import android.content.ComponentName;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.ContextCompat;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.session.MediaController;
import androidx.media3.session.SessionToken;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.getcapacitor.PermissionState;
import com.google.common.util.concurrent.ListenableFuture;
import org.json.JSONException;
import java.util.concurrent.ExecutionException;

@CapacitorPlugin(
    name = "RadioPlayback",
    permissions = {
        @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS })
    }
)
public final class RadioPlaybackPlugin extends Plugin {
    private ListenableFuture<MediaController> controllerFuture;
    private boolean listenerAttached;

    @Override
    public void load() {
        connectToSession();
    }

    @PluginMethod
    public void play(PluginCall call) {
        String url = call.getString("url");
        String title = call.getString("title");
        if (url == null || title == null || title.trim().isEmpty()) {
            call.reject("La emisora necesita una URL y un nombre.");
            return;
        }

        Uri uri = Uri.parse(url);
        String scheme = uri.getScheme();
        if (scheme == null || (!scheme.equalsIgnoreCase("http") && !scheme.equalsIgnoreCase("https"))) {
            call.reject("La URL de la emisora debe usar HTTP o HTTPS.");
            return;
        }

        runWithController(call, mediaController -> {
            String country = call.getString("country", "");
            String language = call.getString("language", "");
            String artist = country;
            if (!language.isEmpty()) {
                artist = artist.isEmpty() ? language : artist + " · " + language;
            }

            MediaMetadata metadata = new MediaMetadata.Builder()
                .setTitle(title)
                .setArtist(artist)
                .build();
            MediaItem mediaItem = new MediaItem.Builder()
                .setMediaId(url)
                .setUri(uri)
                .setMediaMetadata(metadata)
                .build();

            mediaController.setMediaItem(mediaItem);
            mediaController.prepare();
            mediaController.play();
            call.resolve();
        });
    }

    @PluginMethod
    public void pause(PluginCall call) {
        runWithController(call, mediaController -> {
            mediaController.pause();
            call.resolve();
        });
    }

    @PluginMethod
    public void resume(PluginCall call) {
        runWithController(call, mediaController -> {
            mediaController.play();
            call.resolve();
        });
    }

    @PluginMethod
    public void getPlaybackState(PluginCall call) {
        runWithController(call, mediaController -> {
            JSObject state = new JSObject();
            state.put("isPlaying", mediaController.isPlaying());
            call.resolve(state);
        });
    }

    @PluginMethod
    public void syncScheduledRadios(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
            && getPermissionState("notifications") != PermissionState.GRANTED) {
            if (call.getBoolean("requestNotificationPermission", false)) {
                requestPermissionForAlias("notifications", call, "notificationPermissionCallback");
            } else {
                JSObject result = new JSObject();
                result.put("notificationPermissionRequired", true);
                call.resolve(result);
            }
            return;
        }

        syncSchedules(call);
    }

    @PermissionCallback
    private void notificationPermissionCallback(PluginCall call) {
        if (getPermissionState("notifications") != PermissionState.GRANTED) {
            JSObject result = new JSObject();
            result.put("notificationPermissionRequired", true);
            call.resolve(result);
            return;
        }
        syncSchedules(call);
    }

    @PluginMethod
    public void requestExactAlarmPermission(PluginCall call) {
        if (RadioScheduleManager.canScheduleExactAlarms(getContext())) {
            call.resolve();
            return;
        }

        try {
            Intent settingsIntent = new Intent(
                Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
                Uri.parse("package:" + getContext().getPackageName())
            );
            getActivity().startActivity(settingsIntent);
            call.resolve();
        } catch (RuntimeException error) {
            call.reject("No se pudo abrir el permiso de alarmas exactas de Android.", error);
        }
    }

    private void syncSchedules(PluginCall call) {
        if (!RadioScheduleManager.canScheduleExactAlarms(getContext())) {
            JSObject result = new JSObject();
            result.put("exactAlarmPermissionRequired", true);
            call.resolve(result);
            return;
        }

        try {
            RadioScheduleManager.sync(getContext(), call.getString("schedules", "[]"));
            JSObject result = new JSObject();
            result.put("synced", true);
            call.resolve(result);
        } catch (JSONException | RuntimeException error) {
            call.reject("No se pudieron sincronizar las radios programadas.", error);
        }
    }

    private void runWithController(PluginCall call, ControllerAction action) {
        connectToSession();
        controllerFuture.addListener(() -> {
            try {
                MediaController mediaController = controllerFuture.get();
                attachPlaybackListener(mediaController);
                action.run(mediaController);
            } catch (InterruptedException error) {
                Thread.currentThread().interrupt();
                call.reject("Se interrumpió la conexión con el reproductor.", error);
            } catch (ExecutionException error) {
                call.reject("No se pudo conectar con el reproductor de Radiofy.", error);
            } catch (RuntimeException error) {
                call.reject("No se pudo controlar la reproducción.", error);
            }
        }, ContextCompat.getMainExecutor(getContext()));
    }

    private void connectToSession() {
        if (controllerFuture != null) {
            return;
        }

        SessionToken token = new SessionToken(
            getContext(),
            new ComponentName(getContext(), RadioPlaybackService.class)
        );
        controllerFuture = new MediaController.Builder(getContext(), token).buildAsync();
        controllerFuture.addListener(() -> {
            try {
                attachPlaybackListener(controllerFuture.get());
            } catch (InterruptedException error) {
                Thread.currentThread().interrupt();
                notifyPlaybackError("Se interrumpió la conexión con el reproductor.");
            } catch (ExecutionException error) {
                notifyPlaybackError("No se pudo conectar con el reproductor de Radiofy.");
            }
        }, ContextCompat.getMainExecutor(getContext()));
    }

    private void attachPlaybackListener(MediaController mediaController) {
        if (listenerAttached) {
            return;
        }

        listenerAttached = true;
        mediaController.addListener(new Player.Listener() {
            @Override
            public void onIsPlayingChanged(boolean isPlaying) {
                JSObject state = new JSObject();
                state.put("isPlaying", isPlaying);
                notifyListeners("playbackStateChanged", state);
            }

            @Override
            public void onPlayerError(PlaybackException error) {
                String message = error.getMessage() == null
                    ? "No se pudo reproducir esta emisora."
                    : error.getMessage();
                notifyPlaybackError(message);
            }
        });
    }

    private void notifyPlaybackError(String message) {
        JSObject error = new JSObject();
        error.put("message", message);
        notifyListeners("playbackError", error);
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        if (intent == null || !RadioScheduleManager.ACTION_OPEN_SCHEDULE.equals(intent.getAction())) {
            return;
        }

        String url = intent.getStringExtra(RadioScheduleManager.EXTRA_URL);
        if (url == null || url.isEmpty()) {
            return;
        }
        JSObject station = new JSObject();
        station.put("url_resolved", url);
        station.put("name", intent.getStringExtra(RadioScheduleManager.EXTRA_NAME));
        station.put("country", intent.getStringExtra(RadioScheduleManager.EXTRA_COUNTRY));
        station.put("language", intent.getStringExtra(RadioScheduleManager.EXTRA_LANGUAGE));
        notifyListeners("scheduledStationRequested", station, true);
    }

    @Override
    protected void handleOnDestroy() {
        if (controllerFuture != null) {
            MediaController.releaseFuture(controllerFuture);
            controllerFuture = null;
            listenerAttached = false;
        }
    }

    private interface ControllerAction {
        void run(MediaController controller);
    }
}
