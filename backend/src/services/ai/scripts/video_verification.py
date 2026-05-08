import argparse
import base64
import hashlib
import json
import sys

try:
    import cv2
except Exception as exc:  # pragma: no cover
    print(json.dumps({"ok": False, "error": f"OpenCV import failed: {exc}"}))
    sys.exit(1)


def frame_signature(gray_frame):
    resized = cv2.resize(gray_frame, (16, 16))
    mean_val = resized.mean()
    bits = (resized > mean_val).astype("uint8").flatten().tolist()
    return "".join("1" if bit else "0" for bit in bits)


def encode_preview_frame(frame):
    resized = cv2.resize(frame, (320, 180))
    ok, encoded = cv2.imencode(".jpg", resized, [int(cv2.IMWRITE_JPEG_QUALITY), 65])
    if not ok:
        return None
    return base64.b64encode(encoded.tobytes()).decode("utf-8")


def build_sample_indexes(frame_count, target_count=6):
    if frame_count <= 0:
        return []
    if frame_count <= target_count:
        return list(range(frame_count))

    indexes = []
    for i in range(target_count):
        ratio = (i + 1) / (target_count + 1)
        idx = int(round((frame_count - 1) * ratio))
        indexes.append(idx)
    return sorted(set(indexes))


def analyze_video(video_path, include_samples=False):
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return {"ok": False, "error": "Unable to open video file."}

    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    fps = float(cap.get(cv2.CAP_PROP_FPS) or 0)
    duration = (frame_count / fps) if fps > 0 else 0

    sample_target = 24
    step = max(1, frame_count // sample_target) if frame_count > 0 else 1

    frame_hashes = []
    sample_frames = []
    sample_indexes = set(build_sample_indexes(frame_count, 6)) if include_samples else set()
    fallback_sample_stride = max(1, step * 3)
    index = 0

    while True:
        ok, frame = cap.read()
        if not ok:
            break

        if index % step == 0:
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            frame_hashes.append(frame_signature(gray))
            if include_samples and len(sample_frames) < 6:
                should_sample = False
                if sample_indexes:
                    should_sample = index in sample_indexes
                else:
                    should_sample = (index % fallback_sample_stride) == 0

                if should_sample:
                    sample = encode_preview_frame(frame)
                    if sample:
                        sample_frames.append(sample)
        index += 1

    cap.release()

    analyzed_frames = len(frame_hashes)
    unique_ratio = (len(set(frame_hashes)) / analyzed_frames) if analyzed_frames else 0

    signature_source = "|".join(frame_hashes[:40]) + f"|fc={frame_count}|fps={round(fps, 2)}"
    signature = hashlib.sha256(signature_source.encode("utf-8")).hexdigest()

    result = {
        "ok": True,
        "frameCount": frame_count,
        "fps": fps,
        "durationSeconds": duration,
        "analyzedFrames": analyzed_frames,
        "uniqueRatio": unique_ratio,
        "signature": signature,
    }
    if include_samples:
        result["sampleFrames"] = sample_frames

    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Analyze video for AI verification.")
    parser.add_argument("video_path")
    parser.add_argument("--include-samples", action="store_true")
    args = parser.parse_args()

    if not args.video_path:
        print(json.dumps({"ok": False, "error": "Missing video path argument."}))
        sys.exit(1)

    result = analyze_video(args.video_path, include_samples=args.include_samples)
    print(json.dumps(result))
    if not result.get("ok"):
        sys.exit(1)
