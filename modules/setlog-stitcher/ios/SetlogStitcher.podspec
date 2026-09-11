Pod::Spec.new do |s|
  s.name           = 'SetlogStitcher'
  s.version        = '1.0.0'
  s.summary        = 'Stitches a day of Setlog clips into one video, on the phone.'
  s.description    = 'AVFoundation composition + export. No ffmpeg, no server.'
  s.author         = ''
  s.homepage       = 'https://namzoed.com'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
