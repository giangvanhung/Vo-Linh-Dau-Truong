# Võ Linh Đấu Trường

Game đối kháng arcade fantasy 2D, chơi trực tiếp trên trình duyệt. Chọn Hùng hoặc Mai để đấu với CPU theo thể thức ba hiệp thắng hai, hoặc vào chế độ luyện tập.

## Chạy trên máy

Cần cài Node.js. Trong thư mục dự án, chạy:

```bash
npm ci
npm run dev
```

Mở địa chỉ `http://localhost:5173` trong trình duyệt.

## Đấu qua LAN

1. Trên máy tính, mở game và chọn **Đấu 2 người qua LAN**.
2. Kết nối điện thoại và máy tính vào cùng mạng nội bộ. Quét mã QR hoặc mở liên kết hiện dưới mã.
3. Chọn **P1** hoặc **P2** trên từng điện thoại. Người còn lại có thể dùng bàn phím.
4. Trên máy tính, chọn nhân vật rồi vào trận. Mở **Kết nối tay cầm LAN** dưới sân đấu để xem lại mã QR.

Nếu có nhiều địa chỉ LAN, chọn địa chỉ của mạng đang dùng. Nếu điện thoại không vào được, kiểm tra quyền nhận kết nối của Node.js trong Windows Firewall trên mạng riêng.

## Điều khiển

| Phím | Hành động |
| --- | --- |
| A / D hoặc ← / → | Di chuyển trái / phải |
| W hoặc ↑ | Nhảy |
| S hoặc ↓ | Ngồi |
| J | Đấm nhẹ |
| K | Đấm nặng |
| L | Đá |
| P (giữ) | Đỡ đòn |
| Q | Lướt tới |
| Shift + Q | Lướt mạnh (25 năng lượng) |
| T | Thoát khi đang chịu combo từ 2 hit (50 năng lượng) |
| U / I | Kỹ năng gần / xa của nhân vật đã chọn |
| O | Tuyệt kỹ (100 năng lượng) |
| Esc | Tạm dừng hoặc tiếp tục |

## Cấu trúc

```text
src/
  main.js             Nạp cấu hình và khởi động game
  game/match.js       Điều phối trận, tính hiệp, pause và cập nhật 60 Hz
  game/training.js    Chế độ bù nhìn, số liệu combo và bản ghi input
  combat/fighter.js   Trạng thái võ sĩ, đòn đánh, hitbox và projectile
  combat/positioning.js  Hướng nhìn và va chạm thân người
  combat/cpu.js       Quyết định và độ khó CPU
  platform/keyboard.js  Trạng thái phím giữ và lệnh bấm một lần
  platform/settings.js  Mặc định và lưu vào localStorage
  platform/audio.js     Nhạc và hiệu ứng âm thanh
  render/arena.js     Vẽ sân đấu, nhân vật và hiệu ứng lên Canvas
  ui/hud.js           Thanh máu, năng lượng, tỷ số và hồ sơ nhân vật
  ui/panels.js        Menu, chọn nhân vật, cài đặt, pause và kết quả
  ui/training-panel.js   Điều khiển và số liệu luyện tập
data/fighters.json    Chỉ số nhân vật, sân đấu và thông số đòn
index.html            Cấu trúc giao diện
public/styles/styles.css Kiểu hiển thị
public/assets/characters/   Each fighter's concept, sprite sheet and atlas
public/assets/backgrounds/  Stage layers and fallback composite
server.mjs            Máy chủ tệp tĩnh cho môi trường phát triển
```

Mỗi bước mô phỏng đọc lệnh bàn phím, cập nhật quyết định CPU, xử lý vị trí và phân xử đòn đánh. Sau đó Canvas và HUD đọc trạng thái để hiển thị. Các mô-đun trong `combat/` chạy được với Node mà không cần DOM.

| Triệu chứng | Chỗ bắt đầu debug |
| --- | --- |
| Kẹt phím, nhả phím nhưng vẫn di chuyển | `platform/keyboard.js`, kiểm tra `keydown`, `keyup` và mất tiêu điểm |
| Nhảy qua CPU rồi kẹt hoặc quay sai hướng | `combat/positioning.js`, kiểm tra va chạm khi tiếp đất |
| Đòn đánh hụt, sai sát thương hoặc sai thời gian hồi | `combat/fighter.js` và `data/fighters.json` |
| CPU đỡ hoặc phản đòn sai | `combat/cpu.js`, kiểm tra trạng thái và thời gian quan sát |
| Đồng hồ, chuyển hiệp, pause hoặc chơi lại sai | `game/match.js`, kiểm tra chuyển `phase` |
| Nút, bảng thông tin hay hình vẽ hiển thị sai | `ui/panels.js`, `ui/hud.js` hoặc `render/arena.js` |
| Âm lượng hay độ khó mặc định không được nhớ | `platform/settings.js`, xem khóa `vo-linh-settings` trong DevTools |

## Luyện tập

Vào **Luyện tập** từ menu và dùng bảng dưới sân đấu để chọn bù nhìn, đặt lại vị trí, hồi máu hoặc đưa năng lượng về 0. Chế độ **Ngồi đỡ đòn thấp** đỡ đòn đá (L). Debug vẽ hurtbox xanh và hitbox đang hoạt động màu đỏ.

**Ghi input** lưu tối đa 10 giây mô phỏng. **Phát cho bù nhìn** chạy lại chuỗi lệnh bằng bộ chiêu của bù nhìn và đảo hướng trái/phải để tập đối kháng từ phía đối diện. Trong lúc phát, người chơi vẫn điều khiển nhân vật bình thường. Lợi thế khi trúng được ước tính bằng số frame hitstun còn lại của bù nhìn trừ số frame người đánh còn bị khóa.
