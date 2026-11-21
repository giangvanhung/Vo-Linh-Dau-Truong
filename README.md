# Võ Linh Đấu Trường

Game đối kháng arcade fantasy 2D trên trình duyệt. Chọn avatar Hùng, Mai, Linh, Ngọc, Vy, Lam hoặc Diệp trước khi đấu với CPU, luyện tập hoặc chơi LAN.

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

Để chơi trên TV qua mạng nội bộ, chạy `npm start` trên máy tính cùng mạng rồi mở `http://<IP-của-máy-tính>:5173` bằng trình duyệt TV. Vào **Tay cầm điện thoại** và quét mã QR. Màn hình tay cầm đo thời gian khứ hồi từ điện thoại tới máy chủ đang chuyển tiếp tín hiệu.

### Tạo phòng khi mở game trên Vercel

Bản build tĩnh trên Vercel lấy mã QR từ máy chủ Node.js chạy WebSocket. Đặt `LAN_RELAY_URL` trên Vercel thành URL gốc HTTPS của dịch vụ Render, ví dụ `https://ten-dich-vu.onrender.com`. Đặt `LAN_ALLOWED_ORIGINS` trên Render thành URL gốc chính xác của trang game, ví dụ `https://ten-game.vercel.app`. Nếu dùng cả tên miền riêng, liệt kê từng URL gốc và phân cách bằng dấu phẩy. Triển khai lại Render sau khi đổi danh sách và build lại Vercel sau khi đổi URL relay.

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
| R | Lộn né theo hướng A/D đang giữ, mặc định lùi |
| F | Giữ để tụ nộ. Di chuyển, ra đòn, thủ hoặc bị đánh sẽ ngắt tụ khí. |
| G | Đột phá khi đầy nộ và đã đạt điều kiện của võ sĩ. |
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
  combat/fighter.js   Trạng thái võ sĩ, ra đòn và hitbox
  combat/hits.js      Phân xử va chạm đòn đánh, đỡ đòn và sát thương
  combat/projectiles.js Cập nhật đạn và luồng khí công
  combat/positioning.js  Hướng nhìn và va chạm thân người
  combat/cpu.js       Quyết định và độ khó CPU
  platform/keyboard.js  Trạng thái phím giữ và lệnh bấm một lần
  platform/settings.js  Mặc định và lưu vào localStorage
  platform/audio.js     Nhạc và hiệu ứng âm thanh
  render/arena.js     Vẽ sân đấu, nhân vật và hiệu ứng lên Canvas
  render/evolution-effects.js Cánh, hào quang và trang bị tiến hóa
  ui/hud.js           Thanh máu, năng lượng, tỷ số và hồ sơ nhân vật
  ui/panels.js        Menu, chọn nhân vật, cài đặt, pause và kết quả
  ui/controller-pairing.js  Phòng tay cầm, QR và địa chỉ mạng trên màn hình game
  ui/controller.js    Kết nối, đo độ trễ và kết nối lại trên điện thoại
  ui/controller-input.js   Joystick, nút hướng và nút hành động
  ui/controller-qr.js      Quét camera và đọc ảnh QR
  ui/controller-layout.js  Toàn màn hình, xoay và tùy chỉnh nền tay cầm
  ui/training-panel.js   Điều khiển và số liệu luyện tập
data/characters/      Mỗi file chứa chỉ số, chiêu, sprite và tiến hóa của một võ sĩ
data/roster.json      ID và thứ tự võ sĩ trong danh sách
data/stages.json      Sân đấu và cấu hình mặc định
data/combat.json      Luật chiến đấu dùng chung
index.html            Cấu trúc giao diện
public/styles/styles.css Kiểu hiển thị
public/assets/characters/   Each fighter's concept, sprite sheet and atlas
public/assets/backgrounds/  Stage layers and fallback composite
server.mjs            Máy chủ tệp tĩnh cho môi trường phát triển
```

Máy chủ local và bản build gộp dữ liệu thành một phản hồi tại `/data/fighters.json`. Khi thêm võ sĩ, tạo file `data/characters/<id>.json` và thêm ID vào `data/roster.json`.

Mỗi bước mô phỏng đọc lệnh bàn phím, cập nhật quyết định CPU, xử lý vị trí và phân xử đòn đánh. Sau đó Canvas và HUD đọc trạng thái để hiển thị. Các mô-đun trong `combat/` chạy được với Node mà không cần DOM.

| Triệu chứng | Chỗ bắt đầu debug |
| --- | --- |
| Kẹt phím, nhả phím nhưng vẫn di chuyển | `platform/keyboard.js`, kiểm tra `keydown`, `keyup` và mất tiêu điểm |
| Nhảy qua CPU rồi kẹt hoặc quay sai hướng | `combat/positioning.js`, kiểm tra va chạm khi tiếp đất |
| Đòn đánh hụt, sai sát thương hoặc sai thời gian hồi | `combat/hits.js`, `combat/projectiles.js`, `combat/fighter.js` và file võ sĩ trong `data/characters/` |
| CPU đỡ hoặc phản đòn sai | `combat/cpu.js`, kiểm tra trạng thái và thời gian quan sát |
| Đồng hồ, chuyển hiệp, pause hoặc chơi lại sai | `game/match.js`, kiểm tra chuyển `phase` |
| Nút, bảng thông tin hay hình vẽ hiển thị sai | `ui/panels.js`, `ui/hud.js` hoặc `render/arena.js` |
| Âm lượng hay độ khó mặc định không được nhớ | `platform/settings.js`, xem khóa `vo-linh-settings` trong DevTools |

## Luyện tập

Vào **Luyện tập** từ menu và dùng bảng dưới sân đấu để chọn bù nhìn, đặt lại vị trí, hồi máu hoặc đưa năng lượng về 0. Chế độ **Ngồi đỡ đòn thấp** đỡ đòn đá (L). Debug vẽ hurtbox xanh và hitbox đang hoạt động màu đỏ.

**Ghi input** lưu tối đa 10 giây mô phỏng. **Phát cho bù nhìn** chạy lại chuỗi lệnh bằng bộ chiêu của bù nhìn và đảo hướng trái/phải để tập đối kháng từ phía đối diện. Trong lúc phát, người chơi vẫn điều khiển nhân vật bình thường. Lợi thế khi trúng được ước tính bằng số frame hitstun còn lại của bù nhìn trừ số frame người đánh còn bị khóa.


### Tụ khí và Đột phá

Điều kiện Đột phá hiển thị trên màn chọn võ sĩ. Có thể hoàn thành điều kiện trước khi đầy nộ. Đột phá tiêu toàn bộ thanh nộ, kéo dài 8 giây và chỉ dùng một lần mỗi hiệp. Dùng U hoặc I như thường để tung chiêu biến thể. Trong luyện tập, nút **Nạp đầy để thử Đột phá** bỏ qua điều kiện mở khóa để thử chiêu.

Ở chế độ LAN, P2 giữ `[` để tụ khí và bấm `]` để đột phá. Tay cầm điện thoại có hai nút tương ứng.

### Võ sĩ và sân tương tác

- Lam tích một dấu Hàn với mỗi kỹ năng băng trúng. Ba dấu đóng băng đối thủ trong tối đa 0,75 giây. Đòn kế tiếp phá băng.
- Diệp có Bình Độc tạo vũng độc lúc vỡ. Độc rút nhẹ máu và làm chậm hồi thủ trong 3,5 giây. Ba lần dính đòn độc liên tiếp trong thời gian hiệu lực gây choáng ngắn.
- Chọn sân trước trận CPU, luyện tập hoặc LAN. Dùng ô **Hiệu ứng môi trường** để bật hoặc tắt trượt, gió và khe hơi. Các bệ cao vẫn dùng được khi tắt hiệu ứng.
