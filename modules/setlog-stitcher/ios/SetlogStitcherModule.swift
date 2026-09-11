import ExpoModulesCore
import AVFoundation
import UIKit

/**
 Stitching a day of Setlog clips into one video, on the phone.

 This replaces a server: a Node worker with ffmpeg used to do it, because
 `expo-camera` records and `expo-video` plays and neither joins two videos
 together. The usual React Native answer to that — ffmpeg-kit — was retired
 in January 2025 and its binaries pulled, so the honest options were a
 machine somewhere or the platform's own encoder. iOS has had one built for
 exactly this job since AVFoundation shipped, and it is hardware accelerated,
 which ffmpeg on a phone would not have been.

 **How it is put together.** Everything becomes a video track first — a photo
 is written out as a still clip of the right length (`makeStillClip`) — so
 one code path composes panes, and photos and videos cannot drift apart.
 Then one `AVMutableComposition` holds one video track per pane, an
 `AVMutableVideoComposition` places and scales each pane into the 1080×1920
 frame, and Core Animation layers draw the clock, the title and the
 watermark over the top. `AVAssetExportSession` writes the file.

 **Each clip fills its pane.** Scaled to cover and centred, so the frame is
 the day rather than the day floating in a field of background. Aspect is
 never distorted — what does not fit is cropped, evenly, from the middle out.
 The background colour is still there for the gap between panes and for the
 rare clip whose shape leaves a sliver, but it is no longer most of the
 picture, which is what letterboxing every portrait clip into a portrait
 frame amounted to.
 */
public class SetlogStitcherModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SetlogStitcher")

    Events("onProgress")

    AsyncFunction("stitch") { (options: StitchOptions, promise: Promise) in
      Task.detached(priority: .userInitiated) {
        do {
          let url = try await Stitcher(options: options) { [weak self] fraction in
            self?.sendEvent("onProgress", ["progress": fraction])
          }.run()
          promise.resolve(url.absoluteString)
        } catch {
          promise.reject("ERR_STITCH", error.localizedDescription)
        }
      }
    }
  }
}

// MARK: - Options

struct StitchClip: Record {
  /** A local file:// URI. The clips are already on this phone — the cache
   *  put them there when they were recorded (lib/setlogMediaCache.ts). */
  @Field var uri: String = ""
  /** "video" or "photo". */
  @Field var mediaType: String = "video"
  @Field var durationMs: Double = 2000
  /** The clock, already formatted by the app — the phone's own 12/24-hour
   *  convention is a JS concern and must not be re-derived here. */
  @Field var clock: String = ""
  @Field var title: String? = nil
}

struct StitchOptions: Record {
  @Field var clips: [StitchClip] = []
  /** How many clips share the frame: 1, 2 or 3. */
  @Field var split: Int = 1
  @Field var sound: Bool = true
  @Field var stamp: Bool = true
  @Field var watermark: Bool = true
  /** "#RRGGBB". */
  @Field var background: String = "#111827"
  /** The logo, as a file:// URI. Passed in rather than bundled here so the
   *  module has no assets of its own to keep in step with the app's. */
  @Field var watermarkUri: String? = nil
  @Field var width: Int = 1080
  @Field var height: Int = 1920
}

enum StitchError: LocalizedError {
  case noClips
  case unreadable(String)
  case noVideoTrack(String)
  case exportFailed(String)

  var errorDescription: String? {
    switch self {
    case .noClips: return "There is nothing to stitch."
    case .unreadable(let name): return "Couldn't read \(name)."
    case .noVideoTrack(let name): return "\(name) has no video in it."
    case .exportFailed(let why): return why
    }
  }
}

// MARK: - The work

private actor Stitcher {
  private let options: StitchOptions
  private let onProgress: @Sendable (Double) -> Void
  /** Still clips written for photos, deleted on the way out. */
  private var scratch: [URL] = []

  /** A group of fewer clips than the split still has to fill the frame, and
   *  a single pane that is shorter than its group holds its last frame
   *  rather than cutting to background — so the shortest clip in a row does
   *  not decide the row. */
  private let minimumSegment: Double = 1.2

  init(options: StitchOptions, onProgress: @escaping @Sendable (Double) -> Void) {
    self.options = options
    self.onProgress = onProgress
  }

  func run() async throws -> URL {
    guard !options.clips.isEmpty else { throw StitchError.noClips }

    let split = max(1, min(3, options.split))
    let size = CGSize(width: CGFloat(options.width), height: CGFloat(options.height))
    let paneHeight = size.height / CGFloat(split)

    let composition = AVMutableComposition()
    let videoComposition = AVMutableVideoComposition()
    videoComposition.renderSize = size
    videoComposition.frameDuration = CMTime(value: 1, timescale: 30)

    // One composition track per pane, reused down the timeline: two tracks is
    // what lets two clips share a frame, and reusing them keeps the track
    // count at the split rather than at the number of clips.
    var paneTracks: [AVMutableCompositionTrack] = []
    for _ in 0..<split {
      guard let track = composition.addMutableTrack(
        withMediaType: .video,
        preferredTrackID: kCMPersistentTrackID_Invalid
      ) else { throw StitchError.exportFailed("Couldn't build the timeline.") }
      paneTracks.append(track)
    }
    let audioTrack = options.sound
      ? composition.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)
      : nil

    var instructions: [AVMutableVideoCompositionInstruction] = []
    var stamps: [(text: String, subtitle: String?, range: CMTimeRange, pane: Int)] = []
    var cursor = CMTime.zero

    let groups = stride(from: 0, to: options.clips.count, by: split).map {
      Array(options.clips[$0..<min($0 + split, options.clips.count)])
    }

    for (groupIndex, group) in groups.enumerated() {
      // The group runs as long as its longest clip, so nothing in it is cut.
      let seconds = max(
        minimumSegment,
        group.map { $0.durationMs / 1000.0 }.max() ?? minimumSegment
      )
      let groupDuration = CMTime(seconds: seconds, preferredTimescale: 600)
      var layerInstructions: [AVMutableVideoCompositionLayerInstruction] = []

      for (paneIndex, clip) in group.enumerated() {
        let assetURL = try await resolvedURL(for: clip, seconds: seconds)
        let asset = AVURLAsset(url: assetURL)
        guard let sourceTrack = try await asset.loadTracks(withMediaType: .video).first else {
          throw StitchError.noVideoTrack(clip.uri)
        }

        let assetDuration = try await asset.load(.duration)
        // Never longer than the clip has; never longer than the group needs.
        let take = CMTimeMinimum(assetDuration, groupDuration)
        let track = paneTracks[paneIndex]
        try track.insertTimeRange(
          CMTimeRange(start: .zero, duration: take),
          of: sourceTrack,
          at: cursor
        )
        // A pane that ran out holds still instead of flashing the ground.
        if take < groupDuration {
          let frozen = CMTimeRange(
            start: CMTimeMaximum(.zero, CMTimeSubtract(take, CMTime(value: 1, timescale: 30))),
            duration: CMTime(value: 1, timescale: 30)
          )
          try track.insertTimeRange(frozen, of: sourceTrack, at: CMTimeAdd(cursor, take))
          track.scaleTimeRange(
            CMTimeRange(start: CMTimeAdd(cursor, take), duration: frozen.duration),
            toDuration: CMTimeSubtract(groupDuration, take)
          )
        }

        if options.sound, let audioTrack,
           let sourceAudio = try await asset.loadTracks(withMediaType: .audio).first,
           paneIndex == 0 {
          // The first pane's sound only. Two or three simultaneous two-second
          // clips is noise, not a soundtrack.
          try? audioTrack.insertTimeRange(
            CMTimeRange(start: .zero, duration: take),
            of: sourceAudio,
            at: cursor
          )
        }

        let naturalSize = try await sourceTrack.load(.naturalSize)
        let preferred = try await sourceTrack.load(.preferredTransform)
        let layer = AVMutableVideoCompositionLayerInstruction(assetTrack: track)
        layer.setTransform(
          Self.fillTransform(
            naturalSize: naturalSize,
            preferredTransform: preferred,
            into: CGRect(
              x: 0,
              y: paneHeight * CGFloat(paneIndex),
              width: size.width,
              height: paneHeight
            )
          ),
          at: cursor
        )
        layerInstructions.append(layer)

        if options.stamp {
          stamps.append((
            text: clip.clock,
            subtitle: clip.title,
            range: CMTimeRange(start: cursor, duration: groupDuration),
            pane: paneIndex
          ))
        }
      }

      let instruction = AVMutableVideoCompositionInstruction()
      instruction.timeRange = CMTimeRange(start: cursor, duration: groupDuration)
      instruction.layerInstructions = layerInstructions.reversed()
      instruction.backgroundColor = Self.cgColor(from: options.background)
      instructions.append(instruction)

      cursor = CMTimeAdd(cursor, groupDuration)
      onProgress(Double(groupIndex + 1) / Double(groups.count) * 0.6)
    }

    videoComposition.instructions = instructions

    // Stamps and watermark are drawn over the whole timeline by Core
    // Animation rather than burned into each segment, which is what keeps
    // this to one export rather than one per group.
    if options.stamp || options.watermark {
      videoComposition.animationTool = try overlayTool(
        size: size,
        paneHeight: paneHeight,
        split: split,
        stamps: stamps,
        totalDuration: cursor
      )
    }

    defer { scratch.forEach { try? FileManager.default.removeItem(at: $0) } }
    return try await export(composition: composition, videoComposition: videoComposition)
  }

  // MARK: Photos become clips

  /** A photo has no video track, so it is written out as one. Uniform input
   *  means panes, freezes and transforms have a single implementation. */
  private func resolvedURL(for clip: StitchClip, seconds: Double) async throws -> URL {
    guard let url = URL(string: clip.uri) else { throw StitchError.unreadable(clip.uri) }
    if clip.mediaType != "photo" { return url }
    let still = try await makeStillClip(from: url, seconds: seconds)
    scratch.append(still)
    return still
  }

  private func makeStillClip(from imageURL: URL, seconds: Double) async throws -> URL {
    guard let data = try? Data(contentsOf: imageURL), let image = UIImage(data: data) else {
      throw StitchError.unreadable(imageURL.lastPathComponent)
    }
    let out = FileManager.default.temporaryDirectory
      .appendingPathComponent("setlog-still-\(UUID().uuidString).mp4")

    // Even dimensions: H.264 will not encode an odd width or height.
    let pixelSize = CGSize(
      width: (image.size.width * image.scale).rounded(.down) / 2 * 2,
      height: (image.size.height * image.scale).rounded(.down) / 2 * 2
    )
    let writer = try AVAssetWriter(outputURL: out, fileType: .mp4)
    let input = AVAssetWriterInput(
      mediaType: .video,
      outputSettings: [
        AVVideoCodecKey: AVVideoCodecType.h264,
        AVVideoWidthKey: pixelSize.width,
        AVVideoHeightKey: pixelSize.height,
      ]
    )
    input.expectsMediaDataInRealTime = false
    let adaptor = AVAssetWriterInputPixelBufferAdaptor(
      assetWriterInput: input,
      sourcePixelBufferAttributes: [
        kCVPixelBufferPixelFormatTypeKey as String: Int(kCVPixelFormatType_32ARGB),
        kCVPixelBufferWidthKey as String: pixelSize.width,
        kCVPixelBufferHeightKey as String: pixelSize.height,
      ]
    )
    writer.add(input)
    writer.startWriting()
    writer.startSession(atSourceTime: .zero)

    guard let buffer = Self.pixelBuffer(from: image, size: pixelSize) else {
      throw StitchError.unreadable(imageURL.lastPathComponent)
    }
    // Two frames — one at each end — is all a still needs; the encoder holds
    // the picture between them.
    adaptor.append(buffer, withPresentationTime: .zero)
    let end = CMTime(seconds: seconds, preferredTimescale: 600)
    adaptor.append(buffer, withPresentationTime: end)
    input.markAsFinished()
    writer.endSession(atSourceTime: end)
    await writer.finishWriting()
    if writer.status != .completed {
      throw StitchError.exportFailed(writer.error?.localizedDescription ?? "Couldn't prepare a photo.")
    }
    return out
  }

  // MARK: Overlays

  private func overlayTool(
    size: CGSize,
    paneHeight: CGFloat,
    split: Int,
    stamps: [(text: String, subtitle: String?, range: CMTimeRange, pane: Int)],
    totalDuration: CMTime
  ) throws -> AVVideoCompositionCoreAnimationTool {
    let parent = CALayer()
    parent.frame = CGRect(origin: .zero, size: size)
    let video = CALayer()
    video.frame = parent.frame
    parent.addSublayer(video)

    for stamp in stamps {
      // Core Animation's origin is bottom-left; pane 0 is the top one.
      let top = paneHeight * CGFloat(split - 1 - stamp.pane)
      let clock = Self.textLayer(
        stamp.text,
        size: paneHeight * 0.11,
        weight: .bold,
        width: size.width
      )
      clock.frame = CGRect(
        x: 0,
        y: top + paneHeight / 2 - paneHeight * 0.02,
        width: size.width,
        height: paneHeight * 0.14
      )
      Self.show(clock, during: stamp.range)
      parent.addSublayer(clock)

      if let subtitle = stamp.subtitle, !subtitle.isEmpty {
        let title = Self.textLayer(
          subtitle,
          size: paneHeight * 0.055,
          weight: .semibold,
          width: size.width
        )
        title.frame = CGRect(
          x: 0,
          y: top + paneHeight / 2 - paneHeight * 0.10,
          width: size.width,
          height: paneHeight * 0.08
        )
        Self.show(title, during: stamp.range)
        parent.addSublayer(title)
      }
    }

    if options.watermark,
       let uri = options.watermarkUri,
       let url = URL(string: uri),
       let data = try? Data(contentsOf: url),
       let logo = UIImage(data: data)?.cgImage {
      let mark = CALayer()
      let w: CGFloat = 96
      let h = w * CGFloat(logo.height) / CGFloat(logo.width)
      mark.contents = logo
      mark.contentsGravity = .resizeAspect
      mark.frame = CGRect(x: size.width - w - 40, y: 64, width: w, height: h)
      mark.opacity = 0.9
      parent.addSublayer(mark)
    }

    return AVVideoCompositionCoreAnimationTool(
      postProcessingAsVideoLayer: video,
      in: parent
    )
  }

  /** Layers are visible for the whole export unless told otherwise, so each
   *  stamp is switched on for its own clip and off again. `beginTime` of
   *  zero means "now" to Core Animation, hence the epsilon. */
  private static func show(_ layer: CALayer, during range: CMTimeRange) {
    layer.opacity = 0
    let appear = CABasicAnimation(keyPath: "opacity")
    appear.fromValue = 1
    appear.toValue = 1
    appear.beginTime = max(range.start.seconds, .ulpOfOne)
    appear.duration = range.duration.seconds
    appear.isRemovedOnCompletion = false
    appear.fillMode = .backwards
    layer.add(appear, forKey: "setlog.stamp")
  }

  private static func textLayer(
    _ text: String,
    size: CGFloat,
    weight: UIFont.Weight,
    width: CGFloat
  ) -> CATextLayer {
    let layer = CATextLayer()
    layer.string = text
    layer.font = UIFont.systemFont(ofSize: size, weight: weight)
    layer.fontSize = size
    layer.foregroundColor = UIColor.white.cgColor
    layer.alignmentMode = .center
    layer.truncationMode = .end
    layer.isWrapped = false
    layer.contentsScale = 1
    // Legible over a bright sky and a dark room alike, without a scrim over
    // the whole frame — the same trade the app's own stamp makes.
    layer.shadowColor = UIColor.black.cgColor
    layer.shadowOpacity = 0.45
    layer.shadowRadius = 10
    layer.shadowOffset = CGSize(width: 0, height: -1)
    return layer
  }

  // MARK: Geometry

  /**
   Scale to **cover** and centre.

   `max` of the two ratios, not `min`: the clip fills its pane and the
   overflow falls outside it. AVFoundation clips a layer instruction to the
   render size, so the overflow simply is not drawn — there is nothing to
   mask by hand.

   `preferredTransform` first, because a phone records landscape and marks
   the file with a rotation rather than rotating the pixels — ignoring it is
   why naively stitched clips come out on their side.
   */
  static func fillTransform(
    naturalSize: CGSize,
    preferredTransform: CGAffineTransform,
    into rect: CGRect
  ) -> CGAffineTransform {
    let oriented = CGRect(origin: .zero, size: naturalSize)
      .applying(preferredTransform)
    let sourceSize = CGSize(width: abs(oriented.width), height: abs(oriented.height))
    guard sourceSize.width > 0, sourceSize.height > 0 else { return preferredTransform }

    let scale = max(rect.width / sourceSize.width, rect.height / sourceSize.height)
    let scaled = CGSize(width: sourceSize.width * scale, height: sourceSize.height * scale)
    let offset = CGPoint(
      x: rect.minX + (rect.width - scaled.width) / 2,
      y: rect.minY + (rect.height - scaled.height) / 2
    )

    // The preferred transform can leave the frame off-origin; move it back
    // before scaling, then out to where the pane is.
    var t = preferredTransform
    t = t.concatenating(CGAffineTransform(translationX: -oriented.minX, y: -oriented.minY))
    t = t.concatenating(CGAffineTransform(scaleX: scale, y: scale))
    t = t.concatenating(CGAffineTransform(translationX: offset.x, y: offset.y))
    return t
  }

  static func cgColor(from hex: String) -> CGColor {
    var value = hex.trimmingCharacters(in: .whitespacesAndNewlines)
    if value.hasPrefix("#") { value.removeFirst() }
    guard value.count == 6, let rgb = UInt32(value, radix: 16) else {
      return UIColor.black.cgColor
    }
    return UIColor(
      red: CGFloat((rgb >> 16) & 0xFF) / 255,
      green: CGFloat((rgb >> 8) & 0xFF) / 255,
      blue: CGFloat(rgb & 0xFF) / 255,
      alpha: 1
    ).cgColor
  }

  private static func pixelBuffer(from image: UIImage, size: CGSize) -> CVPixelBuffer? {
    var buffer: CVPixelBuffer?
    let attrs: [CFString: Any] = [
      kCVPixelBufferCGImageCompatibilityKey: true,
      kCVPixelBufferCGBitmapContextCompatibilityKey: true,
    ]
    CVPixelBufferCreate(
      kCFAllocatorDefault,
      Int(size.width),
      Int(size.height),
      kCVPixelFormatType_32ARGB,
      attrs as CFDictionary,
      &buffer
    )
    guard let buffer else { return nil }
    CVPixelBufferLockBaseAddress(buffer, [])
    defer { CVPixelBufferUnlockBaseAddress(buffer, []) }
    guard let context = CGContext(
      data: CVPixelBufferGetBaseAddress(buffer),
      width: Int(size.width),
      height: Int(size.height),
      bitsPerComponent: 8,
      bytesPerRow: CVPixelBufferGetBytesPerRow(buffer),
      space: CGColorSpaceCreateDeviceRGB(),
      bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue
    ), let cgImage = image.cgImage else { return nil }
    context.draw(cgImage, in: CGRect(origin: .zero, size: size))
    return buffer
  }

  // MARK: Export

  private func export(
    composition: AVMutableComposition,
    videoComposition: AVMutableVideoComposition
  ) async throws -> URL {
    let out = FileManager.default.temporaryDirectory
      .appendingPathComponent("setlog-reel-\(UUID().uuidString).mp4")

    guard let session = AVAssetExportSession(
      asset: composition,
      presetName: AVAssetExportPresetHighestQuality
    ) else {
      throw StitchError.exportFailed("This phone can't export video.")
    }
    session.videoComposition = videoComposition
    session.outputFileType = .mp4
    session.outputURL = out
    // Playback can start before the whole file has arrived.
    session.shouldOptimizeForNetworkUse = true

    let ticker = Task { [onProgress] in
      while !Task.isCancelled {
        // 60% was the composing; the export is the rest.
        onProgress(0.6 + Double(session.progress) * 0.4)
        try? await Task.sleep(nanoseconds: 200_000_000)
      }
    }
    defer { ticker.cancel() }

    await session.export()

    switch session.status {
    case .completed:
      onProgress(1)
      return out
    case .cancelled:
      throw StitchError.exportFailed("The export was cancelled.")
    default:
      throw StitchError.exportFailed(
        session.error?.localizedDescription ?? "The reel didn't export."
      )
    }
  }
}
