#!/usr/bin/env bash
set -euo pipefail

# Build mobile artifacts for Flutter in local or GitHub Actions environments.
# Usage:
#   bash scripts/build_mobile_artifacts.sh [android|ios|all]

TARGET="${1:-all}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FLUTTER_DIR="${FLUTTER_DIR:-$ROOT_DIR/flutter}"
HOST_OS="$(uname -s)"
ANDROID_SDK_DIR="${ANDROID_SDK_DIR:-${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/android-sdk}}}"
ANDROID_PLATFORM_VERSION="${ANDROID_PLATFORM_VERSION:-34}"
ANDROID_BUILD_TOOLS_VERSION="${ANDROID_BUILD_TOOLS_VERSION:-34.0.0}"
ANDROID_CMDLINE_TOOLS_URL="${ANDROID_CMDLINE_TOOLS_URL:-https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip}"

if [[ ! -d "$FLUTTER_DIR" ]]; then
  echo "[error] Flutter directory not found: $FLUTTER_DIR" >&2
  exit 1
fi

if [[ "$TARGET" != "android" && "$TARGET" != "ios" && "$TARGET" != "all" ]]; then
  echo "[error] Invalid target '$TARGET'. Use: android | ios | all" >&2
  exit 1
fi

if ! command -v flutter >/dev/null 2>&1; then
  echo "[error] Flutter CLI is not installed or not on PATH." >&2
  exit 1
fi

run_flutter() {
  (
    cd "$FLUTTER_DIR"
    flutter "$@"
  )
}

ensure_command() {
  local command_name="$1"

  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "[error] Required command not found: $command_name" >&2
    exit 1
  fi
}

find_existing_android_sdk() {
  local candidate

  for candidate in \
    "$ANDROID_SDK_DIR" \
    "${ANDROID_HOME:-}" \
    "${ANDROID_SDK_ROOT:-}" \
    "$HOME/Android/Sdk" \
    "$HOME/Android/sdk" \
    "/usr/local/lib/android/sdk" \
    "/opt/android-sdk"; do
    if [[ -n "$candidate" && -d "$candidate" ]]; then
      ANDROID_SDK_DIR="$candidate"
      return 0
    fi
  done

  return 1
}

configure_android_env() {
  export ANDROID_HOME="$ANDROID_SDK_DIR"
  export ANDROID_SDK_ROOT="$ANDROID_SDK_DIR"
  export PATH="$ANDROID_SDK_DIR/platform-tools:$ANDROID_SDK_DIR/cmdline-tools/latest/bin:$PATH"
}

android_sdkmanager() {
  local sdkmanager_bin="$ANDROID_SDK_DIR/cmdline-tools/latest/bin/sdkmanager"

  if [[ ! -x "$sdkmanager_bin" ]]; then
    echo "[error] sdkmanager not found under $ANDROID_SDK_DIR/cmdline-tools/latest/bin" >&2
    exit 1
  fi

  "$sdkmanager_bin" --sdk_root="$ANDROID_SDK_DIR" "$@"
}

install_android_cmdline_tools() {
  ensure_command curl
  ensure_command unzip

  local tmp_dir
  local zip_path

  tmp_dir="$(mktemp -d)"
  zip_path="$tmp_dir/commandlinetools.zip"

  mkdir -p "$ANDROID_SDK_DIR/cmdline-tools"

  echo "[step] Downloading Android command-line tools"
  curl -fsSL "$ANDROID_CMDLINE_TOOLS_URL" -o "$zip_path"

  unzip -q "$zip_path" -d "$tmp_dir"
  rm -rf "$ANDROID_SDK_DIR/cmdline-tools/latest"
  mkdir -p "$ANDROID_SDK_DIR/cmdline-tools/latest"
  mv "$tmp_dir/cmdline-tools"/* "$ANDROID_SDK_DIR/cmdline-tools/latest/"
  rm -rf "$tmp_dir"
}

ensure_android_sdk() {
  if [[ "$HOST_OS" != "Linux" && "$HOST_OS" != "Darwin" ]]; then
    echo "[error] Android builds are only supported on Linux and macOS hosts." >&2
    exit 1
  fi

  find_existing_android_sdk || true
  configure_android_env

  if [[ ! -x "$ANDROID_SDK_DIR/cmdline-tools/latest/bin/sdkmanager" ]]; then
    install_android_cmdline_tools
    configure_android_env
  fi

  echo "[step] Installing Android SDK packages"
  yes | android_sdkmanager --licenses >/dev/null
  android_sdkmanager --install \
    "platform-tools" \
    "platforms;android-$ANDROID_PLATFORM_VERSION" \
    "build-tools;$ANDROID_BUILD_TOOLS_VERSION"

  local android_local_properties="$FLUTTER_DIR/android/local.properties"
  if [[ ! -f "$android_local_properties" ]] || ! grep -q '^sdk.dir=' "$android_local_properties"; then
    {
      echo "sdk.dir=$ANDROID_SDK_DIR"
      echo "flutter.sdk=$(cd "$(dirname "$(command -v flutter)")/.." && pwd)"
    } >> "$android_local_properties"
  fi
}

echo "[info] Flutter directory: $FLUTTER_DIR"
echo "[info] Build target: $TARGET"

echo "[step] Installing dependencies"
run_flutter pub get

echo "[step] Running static analysis"
run_flutter analyze --no-fatal-infos

APK_PATH="$FLUTTER_DIR/build/app/outputs/flutter-apk/app-release.apk"
IPA_GLOB="$FLUTTER_DIR/build/ios/ipa/*.ipa"

build_android() {
  ensure_android_sdk

  echo "[step] Building Android APK"
  run_flutter build apk --release

  if [[ ! -f "$APK_PATH" ]]; then
    echo "[error] APK not found at: $APK_PATH" >&2
    exit 1
  fi

  echo "[ok] APK built: $APK_PATH"
}

build_ios() {
  if [[ "$HOST_OS" != "Darwin" ]]; then
    echo "[error] iOS build requires macOS runner (Darwin)." >&2
    exit 1
  fi

  echo "[step] Installing CocoaPods dependencies"
  (
    cd "$FLUTTER_DIR/ios"
    pod install
  )

  if [[ -n "${IOS_CERTIFICATE_BASE64:-}" ]]; then
    echo "[step] Building signed IPA"
    run_flutter build ipa --release
  else
    echo "[step] Building unsigned IPA (no signing secrets provided)"
    run_flutter build ipa --release --no-codesign
  fi

  shopt -s nullglob
  local ipa_files=("$FLUTTER_DIR"/build/ios/ipa/*.ipa)
  shopt -u nullglob

  if (( ${#ipa_files[@]} == 0 )); then
    echo "[error] IPA not found at: $IPA_GLOB" >&2
    exit 1
  fi

  echo "[ok] IPA built: ${ipa_files[0]}"
}

if [[ "$TARGET" == "android" || "$TARGET" == "all" ]]; then
  build_android
fi

if [[ "$TARGET" == "ios" ]]; then
  build_ios
elif [[ "$TARGET" == "all" ]]; then
  if [[ "$HOST_OS" == "Darwin" ]]; then
    build_ios
  else
    echo "[warn] Skipping iOS build on $HOST_OS; macOS is required."
  fi
fi

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  {
    echo "apk_path=$APK_PATH"
    echo "ipa_glob=$IPA_GLOB"
  } >> "$GITHUB_OUTPUT"
fi

echo "[done] Build completed successfully"