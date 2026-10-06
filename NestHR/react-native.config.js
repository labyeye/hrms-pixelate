// ML Kit (used by the face detector) ships no arm64 iOS-simulator slice, which
// hides every simulator from Xcode. Set NESTHR_SIM=1 before `pod install` to
// leave the face detector out of the iOS build (see `npm run ios:sim`).
const skipFaceDetectorOnIos = process.env.NESTHR_SIM === '1';

module.exports = {
  assets: ['./src/assets/fonts'],
  dependencies: skipFaceDetectorOnIos
    ? {'react-native-vision-camera-face-detector': {platforms: {ios: null}}}
    : {},
};
