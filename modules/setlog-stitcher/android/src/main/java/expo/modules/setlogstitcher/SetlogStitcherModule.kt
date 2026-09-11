package expo.modules.setlogstitcher

import android.graphics.Color
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.text.SpannableString
import android.text.Spanned
import android.text.style.AbsoluteSizeSpan
import android.text.style.ForegroundColorSpan
import androidx.media3.common.Effect
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.util.UnstableApi
import androidx.media3.effect.OverlayEffect
import androidx.media3.effect.OverlaySettings
import androidx.media3.effect.Presentation
import androidx.media3.effect.StaticOverlaySettings
import androidx.media3.effect.TextOverlay
import androidx.media3.transformer.Composition
import androidx.media3.transformer.EditedMediaItem
import androidx.media3.transformer.EditedMediaItemSequence
import androidx.media3.transformer.Effects
import androidx.media3.transformer.ExportException
import androidx.media3.transformer.ExportResult
import androidx.media3.transformer.ProgressHolder
import androidx.media3.transformer.Transformer
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import java.io.File
import com.google.common.collect.ImmutableList

/**
 * Stitching a day of Setlog clips into one video, on the phone.
 *
 * The counterpart to `ios/SetlogStitcherModule.swift`, and deliberately the
 * same contract: same options, same output shape, same promise. This replaces
 * a Node worker running ffmpeg — `expo-camera` records and `expo-video`
 * plays, neither joins, and ffmpeg-kit (the usual React Native answer) was
 * retired in January 2025 with its binaries pulled. Media3 Transformer is
 * Android's own supported path for exactly this, and it is hardware
 * accelerated where ffmpeg on a phone would not have been.
 *
 * **Each clip fills the frame.** `LAYOUT_SCALE_TO_FIT_WITH_CROP` scales to
 * cover and crops the overflow from the centre, so the reel is the day
 * rather than the day letterboxed inside a field of background. Aspect is
 * never distorted; the same trade the collage now makes, and the iOS side
 * does the same thing with `max` instead of `min` on the fit ratio.
 *
 * A photo is a `MediaItem` with an explicit duration; Transformer treats an
 * image input as a clip of that length, so photos and videos take one path.
 */
@UnstableApi
class SetlogStitcherModule : Module() {
  private var transformer: Transformer? = null
  private val main = Handler(Looper.getMainLooper())

  override fun definition() = ModuleDefinition {
    Name("SetlogStitcher")

    Events("onProgress")

    AsyncFunction("stitch") { options: StitchOptions, promise: Promise ->
      main.post {
        try {
          start(options, promise)
        } catch (e: Throwable) {
          promise.reject("ERR_STITCH", e.message ?: "The reel didn't render.", e)
        }
      }
    }
  }

  private fun start(options: StitchOptions, promise: Promise) {
    val context = appContext.reactContext
      ?: return promise.reject("ERR_STITCH", "No context.", null)
    if (options.clips.isEmpty()) {
      return promise.reject("ERR_STITCH", "There is nothing to stitch.", null)
    }

    val width = options.width
    val height = options.height

    val items = options.clips.map { clip ->
      val durationUs = (clip.durationMs * 1000).toLong().coerceAtLeast(MIN_SEGMENT_US)
      val isPhoto = clip.mediaType == "photo"

      val effects = mutableListOf<Effect>(
        // Scale to cover, crop the overflow from the centre. The pane is
        // the frame, not a stamp-sized picture in the middle of one.
        Presentation.createForWidthAndHeight(
          width,
          height,
          Presentation.LAYOUT_SCALE_TO_FIT_WITH_CROP
        )
      )
      if (options.stamp) {
        overlayFor(clip, height)?.let { effects.add(it) }
      }

      val builder = EditedMediaItem.Builder(
        MediaItem.Builder()
          .setUri(Uri.parse(clip.uri))
          .build()
      )
        .setEffects(Effects(emptyList(), effects))
        // Silence a pane rather than drop the track: a sequence has to agree
        // on whether it carries audio, and a photo never does.
        .setRemoveAudio(!options.sound || isPhoto)

      if (isPhoto) {
        builder.setDurationUs(durationUs).setFrameRate(FRAME_RATE)
      }
      builder.build()
    }

    val sequence = EditedMediaItemSequence.Builder(ImmutableList.copyOf(items)).build()
    val composition = Composition.Builder(ImmutableList.of(sequence))
      .setEffects(Effects(emptyList(), emptyList()))
      .build()

    val output = File.createTempFile("setlog-reel-", ".mp4", context.cacheDir)

    val listener = object : Transformer.Listener {
      override fun onCompleted(composition: Composition, result: ExportResult) {
        stopTicking()
        sendEvent("onProgress", mapOf("progress" to 1.0))
        promise.resolve(Uri.fromFile(output).toString())
      }

      override fun onError(
        composition: Composition,
        result: ExportResult,
        exception: ExportException
      ) {
        stopTicking()
        output.delete()
        promise.reject("ERR_STITCH", exception.message ?: "The reel didn't render.", exception)
      }
    }

    transformer = Transformer.Builder(context)
      .setVideoMimeType(MimeTypes.VIDEO_H264)
      .setAudioMimeType(MimeTypes.AUDIO_AAC)
      .addListener(listener)
      .build()
      .also { it.start(composition, output.absolutePath) }

    startTicking()
  }

  // ── progress ──────────────────────────────────────────────────────────
  // Transformer reports progress by being asked, not by telling, so this
  // polls while an export is running. Every hop is on the main thread
  // because getProgress has to be.

  private var ticking = false

  private fun startTicking() {
    ticking = true
    val holder = ProgressHolder()
    val tick = object : Runnable {
      override fun run() {
        if (!ticking) return
        val state = transformer?.getProgress(holder)
        if (state == Transformer.PROGRESS_STATE_AVAILABLE) {
          sendEvent("onProgress", mapOf("progress" to holder.progress / 100.0))
        }
        main.postDelayed(this, 200)
      }
    }
    main.postDelayed(tick, 200)
  }

  private fun stopTicking() {
    ticking = false
    transformer = null
  }

  /** The clock, and the title under it, centred on the frame — the same
   *  mark the camera put on the clip and the app draws everywhere else. */
  private fun overlayFor(clip: StitchClip, height: Int): Effect? {
    val overlays = mutableListOf<TextOverlay>()

    if (clip.clock.isNotEmpty()) {
      overlays.add(
        TextOverlay.createStaticTextOverlay(
          styled(clip.clock, (height * 0.11f).toInt()),
          StaticOverlaySettings.Builder()
            .setOverlayFrameAnchor(0f, 0f)
            .setBackgroundFrameAnchor(0f, 0.04f)
            .build()
        )
      )
    }
    val title = clip.title
    if (!title.isNullOrEmpty()) {
      overlays.add(
        TextOverlay.createStaticTextOverlay(
          styled(title, (height * 0.055f).toInt()),
          StaticOverlaySettings.Builder()
            .setOverlayFrameAnchor(0f, 0f)
            .setBackgroundFrameAnchor(0f, -0.06f)
            .build()
        )
      )
    }
    if (overlays.isEmpty()) return null
    return OverlayEffect(ImmutableList.copyOf(overlays))
  }

  private fun styled(text: String, sizePx: Int): SpannableString {
    val span = SpannableString(text)
    span.setSpan(
      ForegroundColorSpan(Color.WHITE),
      0, text.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
    )
    span.setSpan(
      AbsoluteSizeSpan(sizePx),
      0, text.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
    )
    return span
  }

  companion object {
    /** Matches the iOS side: nothing is on screen for less than this, so a
     *  two-second day does not flicker past. */
    private const val MIN_SEGMENT_US = 1_200_000L
    private const val FRAME_RATE = 30
  }
}

class StitchClip : Record {
  /** A local file:// URI — the clips are already on this phone. */
  @Field var uri: String = ""
  /** "video" or "photo". */
  @Field var mediaType: String = "video"
  @Field var durationMs: Double = 2000.0
  /** Already formatted by the app: 12/24-hour is a phone preference and must
   *  not be re-derived here. */
  @Field var clock: String = ""
  @Field var title: String? = null
}

class StitchOptions : Record {
  @Field var clips: List<StitchClip> = emptyList()
  @Field var split: Int = 1
  @Field var sound: Boolean = true
  @Field var stamp: Boolean = true
  @Field var watermark: Boolean = true
  @Field var background: String = "#111827"
  @Field var watermarkUri: String? = null
  @Field var width: Int = 1080
  @Field var height: Int = 1920
}
