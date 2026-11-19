# Võ Linh Đấu Trường

Game đối kháng arcade fantasy 2D, chơi trực tiếp trên trình duyệt. Bản đầu tiên có trận 1v1 giữa Hùng và Mai (CPU), ba hiệp thắng hai, các đòn đánh có khung khởi động/đang đánh/hồi chiêu, block, hitbox và phản hồi trúng đòn.

## Chạy trên máy

Cần cài Node.js. Trong thư mục dự án, chạy:

```bash
npm run dev
```

Mở địa chỉ `http://localhost:5173` trong trình duyệt. Không cần cài package bên ngoài.

## Điều khiển

| Phím | Hành động |
| --- | --- |
| A / D hoặc ← / → | Di chuyển trái / phải |
| W | Nhảy |
| S | Ngồi |
| J | Đấm nhẹ |
| K | Đấm nặng |
| L | Đá |
| P (giữ) | Đỡ đòn |
| Q | Lướt tới |
| Shift + Q | Lướt mạnh (25 năng lượng) |
| T | Thoát khi đang chịu combo từ 2 hit (50 năng lượng) |
| U | Uy Lực Trảm |
| I | Hỏa Cầu |
| O | Sóng Đấm Thép (100 năng lượng) |

Mai (CPU) sử dụng Vũ Đao Xoáy, Phong Kiếm và Vũ Điệu Lửa.

## Cấu trúc

- `src/combat.js`: trạng thái nhân vật và phân xử đòn đánh.
- `src/main.js`: vòng lặp trận đấu, CPU và vẽ sân đấu.
- `data/fighters.json`: chỉ số nhân vật, sân đấu và thông số đòn đánh.
- `styles.css`, `index.html`: giao diện.
- `prompt.md`: bản prompt/kế hoạch gốc, được giữ nguyên.
