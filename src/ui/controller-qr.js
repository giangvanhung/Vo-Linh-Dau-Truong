export function createControllerQr({ label, onRoom }) {
  const qrImage = document.querySelector('#qr-image');
  const scanQr = document.querySelector('#scan-qr');
  const scanner = document.querySelector('#qr-scanner');
  const preview = document.querySelector('#qr-preview');
  let scanSession;

  function decodeQr(source, canvas, limit, x, y, width, height) {
    const scale = Math.min(1, limit / Math.max(width, height));
    const frameWidth = Math.max(1, Math.round(width * scale));
    const frameHeight = Math.max(1, Math.round(height * scale));
    if (canvas.width !== frameWidth) canvas.width = frameWidth;
    if (canvas.height !== frameHeight) canvas.height = frameHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(source, x, y, width, height, 0, 0, canvas.width, canvas.height);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return globalThis.jsQR(pixels.data, pixels.width, pixels.height);
  }

  function openRoomQr(text) {
    let link;
    try { link = new URL(text); } catch { return false; }
    const nextRoom = link.searchParams.get('room');
    if (!['http:', 'https:'].includes(link.protocol) || link.username || link.password
        || !['/controller', '/controller/', '/controller.html'].includes(link.pathname)
        || !/^[A-Za-z0-9_-]{16}$/.test(nextRoom ?? '')) return false;
    link.pathname = '/controller';
    stopScan();
    if (link.origin !== location.origin) {
      location.replace(link.href);
      return true;
    }
    onRoom(nextRoom, link);
    return true;
  }

  function stopScan() {
    const session = scanSession;
    scanSession = undefined;
    clearTimeout(session?.timer);
    session?.stream?.getTracks().forEach(track => track.stop());
    preview.srcObject = null;
    scanner.hidden = true;
    scanQr.disabled = qrImage.disabled = false;
  }

  scanQr.onclick = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      label.textContent = 'Camera trực tiếp cần trang HTTPS. Bạn có thể dùng Chọn ảnh QR.';
      return;
    }
    if (typeof globalThis.BarcodeDetector !== 'function' && typeof globalThis.jsQR !== 'function') {
      label.textContent = 'Không tải được bộ đọc QR. Hãy tải lại trang hoặc dùng camera của điện thoại.';
      return;
    }
    const session = scanSession = {};
    scanQr.disabled = qrImage.disabled = true;
    scanner.hidden = false;
    label.textContent = 'Cho phép dùng camera rồi đưa mã QR vào khung.';
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      if (scanSession !== session) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      session.stream = stream;
      preview.srcObject = stream;
      await preview.play();
      if (scanSession !== session) return;
      let detector;
      try {
        if (typeof globalThis.BarcodeDetector === 'function') {
          detector = new globalThis.BarcodeDetector({ formats: ['qr_code'] });
        }
      } catch {
        // Some browsers expose BarcodeDetector without a working backend.
      }
      label.textContent = 'Đưa trọn mã QR vào giữa khung và giữ điện thoại ổn định. Mã sẽ tự được nhận.';
      const canvas = document.createElement('canvas');
      let scanCenter = true;
      const startedAt = performance.now();
      let readOtherCode = false;
      async function scanFrame() {
        if (scanSession !== session) return;
        try {
          const { videoWidth, videoHeight } = preview;
          if (preview.readyState >= 2 && videoWidth && videoHeight) {
            if (detector) {
              let codes = [];
              try {
                codes = await detector.detect(preview);
              } catch {
                detector = undefined;
              }
              if (scanSession !== session) return;
              if (codes.some(code => openRoomQr(code.rawValue))) return;
              readOtherCode ||= codes.length > 0;
            }
            if (typeof globalThis.jsQR === 'function') {
              const side = Math.floor(Math.min(videoWidth, videoHeight) * 0.75);
              const code = scanCenter
                ? decodeQr(preview, canvas, 1080, (videoWidth - side) / 2, (videoHeight - side) / 2, side, side)
                : decodeQr(preview, canvas, 1920, 0, 0, videoWidth, videoHeight);
              scanCenter = !scanCenter;
              if (code && openRoomQr(code.data)) return;
              readOtherCode ||= Boolean(code);
            } else if (!detector) {
              throw new Error('QR decoder unavailable');
            }
          }
          if (readOtherCode) {
            label.textContent = 'Camera đã đọc được mã. Hãy đưa đúng mã QR phòng tay cầm vào khung.';
          } else if (performance.now() - startedAt > 5000) {
            label.textContent = 'Chưa nhận được mã. Đưa điện thoại gần hơn, giữ trọn mã trong hình và tránh lóa màn hình.';
          }
        } catch {
          stopScan();
          label.textContent = 'Không đọc được hình từ camera. Hãy thử Chọn ảnh QR.';
          return;
        }
        session.timer = setTimeout(scanFrame, 180);
      }
      scanFrame();
    } catch {
      if (scanSession !== session) return;
      stopScan();
      label.textContent = 'Không mở được camera. Hãy kiểm tra quyền camera hoặc chọn ảnh QR.';
    }
  };

  document.querySelector('#stop-qr').onclick = () => {
    stopScan();
    label.textContent = 'Đã đóng camera. Bấm Quét QR mới để thử lại.';
  };
  async function readRoomQr(event) {
    const input = event.currentTarget;
    const file = input.files[0];
    input.value = '';
    if (!file) return;
    scanQr.disabled = qrImage.disabled = true;
    label.textContent = 'Đang đọc mã QR…';
    const objectUrl = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = objectUrl;
      await image.decode();
      const code = decodeQr(image, document.createElement('canvas'), 1600, 0, 0, image.naturalWidth, image.naturalHeight);
      if (!code) {
        label.textContent = 'Chưa đọc được mã QR. Hãy chụp gần hơn và lấy trọn mã.';
        return;
      }
      if (!openRoomQr(code.data)) {
        label.textContent = 'Mã này không phải mã QR phòng tay cầm.';
      }
    } catch {
      label.textContent = 'Không đọc được ảnh. Hãy thử chụp lại hoặc chọn ảnh khác.';
    } finally {
      URL.revokeObjectURL(objectUrl);
      scanQr.disabled = qrImage.disabled = false;
    }
  }

  qrImage.addEventListener('change', readRoomQr);

  return { stopScan };
}
