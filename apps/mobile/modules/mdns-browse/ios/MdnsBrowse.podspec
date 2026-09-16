require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'MdnsBrowse'
  s.version        = package['version']
  s.summary        = 'Bonjour browse for 5DControl (_5dcontrol._tcp)'
  s.description    = 'Discovers 5DControl servers advertised on the LAN'
  s.author         = '5DControl'
  s.homepage       = 'https://github.com/cjlawson02/5dcontrol'
  s.license        = 'UNLICENSED'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.{h,m,mm,swift}'
end
